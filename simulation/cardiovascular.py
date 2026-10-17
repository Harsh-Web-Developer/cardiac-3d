"""CARDIA Cardiovascular Physiology Engine — Master Step Engine.

Public API
----------
    step(state, dt=0.01)  ->  SimulationState
    simulate(state, duration, dt=0.01)  ->  list[SimulationState]

The engine is purely functional: it never mutates the caller's state.
`step()` deep-copies the input, advances it by dt seconds, and returns
the new copy.

Pipeline (one timestep)
-----------------------
 1.  Validate input state
 2.  Deep-copy (immutable output guarantee)
 3.  Advance time_s
 4.  Compute cardiac cycle period T and phase t_mod
 5.  Frank-Starling → effective contractility
 6.  Compute chamber pressures (all 4)
 7.  Compute venous return flows (systemic → RA, pulmonary veins → LA)
 8.  Compute valve flows (4 valves)
 9.  Update chamber volumes (dV = (Q_in - Q_out) * dt)
10.  Update systemic arterial Windkessel pressure
11.  Update systemic venous pressure
12.  Update pulmonary compartment pressures
13.  Track EDV / ESV
14.  Compute SV, CO, MAP
15.  Apply slow baroreflex
16.  Update new state fields
17.  Validate output state
18.  Return new state

Determinism
-----------
No random numbers are used anywhere in this module.  Two identical
starting states will always produce identical trajectories.

Numerical Stability
-------------------
Default dt = 0.01 s is well below the characteristic time constants
of all modelled compartments (fastest: arterial Windkessel τ ≈ 1–2 s).
Volumes are guarded against going below a minimum floor to prevent
negative-pressure singularities.
"""

from __future__ import annotations

import math

from simulation.state import (
    SimulationState,
    ChamberState,
    ValveState,
    CirculationState,
    CardiacMetrics,
    copy_state,
    validate_state,
)
from simulation.parameters import (
    CHAMBER_PHYSIOLOGY,
    VALVES,
    CIRCULATION,
    PHASE,
    BAROREFLEX,
    FRANK_STARLING,
)
from simulation.chambers import compute_all_pressures
from simulation.valves import compute_all_valve_flows
from simulation.circulation import (
    step_systemic_arterial,
    step_systemic_venous,
    step_pulmonary,
    compute_venous_return,
    compute_pulmonary_venous_return,
)
from simulation.feedback import frank_starling_factor, baroreflex_step


# ---------------------------------------------------------------------------
# Internal constants
# ---------------------------------------------------------------------------

_MIN_VOLUME_ML   = 0.5    # floor to prevent singularities
_MAX_PRESSURE    = 500.0  # sanity ceiling (mmHg)

# SBP/DBP tracking filter
# We track a running peak and trough of the aortic pressure waveform.
# The low-pass filter time constant is ~5 cardiac cycles ≈ 4 s at 72 bpm.
_ALPHA_TRACK = 0.005   # very slow follower — peak/trough emerge from the waveform


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _phase_label(t_mod: float, T: float) -> str:
    """Map cycle position to a human-readable detailed phase label."""
    t_ic_end = PHASE.frac_ic * T
    t_ej_end = (PHASE.frac_ic + PHASE.frac_ej) * T
    t_ir_end = (PHASE.frac_ic + PHASE.frac_ej + PHASE.frac_ir) * T
    if t_mod < t_ic_end:
        return "isovolumetric_contraction"
    elif t_mod < t_ej_end:
        return "ejection"
    elif t_mod < t_ir_end:
        return "isovolumetric_relaxation"
    else:
        return "diastole"


def _broad_phase(detailed: str) -> str:
    """Convert detailed phase to 'systole' or 'diastole' for state.cardiac_phase."""
    return "diastole" if detailed == "diastole" else "systole"


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(value, hi))


# ---------------------------------------------------------------------------
# EDV / ESV cycle tracker
# ---------------------------------------------------------------------------

class _CycleTracker:
    """Tracks LV EDV and ESV across cardiac cycles.

    Updated each step; latches EDV at the diastole→IC transition and
    ESV at the IR→diastole transition.
    """

    def __init__(self, edv: float = 120.0, esv: float = 50.0) -> None:
        self.edv: float = edv
        self.esv: float = esv
        self._lv_peak:   float = edv
        self._lv_trough: float = esv
        self._prev_phase: str  = "diastole"

    def update(self, lv_volume: float, detailed_phase: str) -> None:
        """Update peak/trough tracking and latch EDV/ESV at transitions."""
        # Track running peak during diastolic filling
        if detailed_phase == "diastole":
            if lv_volume > self._lv_peak:
                self._lv_peak = lv_volume
        # Track running trough during ejection/IR
        if detailed_phase in ("ejection", "isovolumetric_relaxation"):
            if lv_volume < self._lv_trough:
                self._lv_trough = lv_volume

        # Latch EDV at diastole → IC transition
        if (self._prev_phase == "diastole"
                and detailed_phase == "isovolumetric_contraction"):
            if self._lv_peak > _MIN_VOLUME_ML:
                self.edv = self._lv_peak
            self._lv_peak = lv_volume  # reset for next cycle

        # Latch ESV at IR → diastole transition
        if (self._prev_phase == "isovolumetric_relaxation"
                and detailed_phase == "diastole"):
            if self._lv_trough < self.edv:  # valid: ESV < EDV
                self.esv = self._lv_trough
            self._lv_trough = lv_volume  # reset for next cycle

        self._prev_phase = detailed_phase


# ---------------------------------------------------------------------------
# SBP / DBP tracker
# ---------------------------------------------------------------------------

class _BPTracker:
    """Tracks systolic and diastolic blood pressure from the arterial waveform.

    Uses a fast-rise / slow-fall filter:
    - SBP follows the peak arterial pressure (fast rise, slow decay)
    - DBP follows the trough arterial pressure (fast fall, slow rise)
    """

    def __init__(self, sbp: float = 120.0, dbp: float = 80.0) -> None:
        self.sbp: float = sbp
        self.dbp: float = dbp

    def update(self, p_art: float, dt: float) -> None:
        """Update SBP and DBP estimates from current arterial pressure."""
        # SBP: fast track upward, slow drift downward
        if p_art > self.sbp:
            # Rise quickly toward new peak
            self.sbp = self.sbp + (p_art - self.sbp) * min(20.0 * dt, 1.0)
        else:
            # Slowly relax toward current arterial pressure
            self.sbp = self.sbp + (p_art - self.sbp) * min(0.5 * dt, 1.0)

        # DBP: fast track downward, slow drift upward
        if p_art < self.dbp:
            self.dbp = self.dbp + (p_art - self.dbp) * min(20.0 * dt, 1.0)
        else:
            self.dbp = self.dbp + (p_art - self.dbp) * min(0.5 * dt, 1.0)

        # Sanity: SBP >= DBP + 1
        if self.sbp < self.dbp + 1.0:
            self.sbp = self.dbp + 1.0


# ---------------------------------------------------------------------------
# Core internal step
# ---------------------------------------------------------------------------

def _step_internal(
    state: SimulationState,
    dt: float,
    tracker: _CycleTracker,
    bp_tracker: _BPTracker,
    p_pv: float,
) -> tuple[SimulationState, float]:
    """Advance simulation by one dt.  Returns (new_state, new_p_pv).

    Parameters
    ----------
    state      : current state (not mutated)
    dt         : timestep (s)
    tracker    : cross-step EDV/ESV tracker
    bp_tracker : cross-step SBP/DBP tracker
    p_pv       : current pulmonary venous pressure (mmHg)
    """
    # 1. Validate
    validate_state(state)

    # 2. Deep-copy
    s = copy_state(state)

    # 3. Advance time
    s.time_s += dt

    # 4. Cardiac cycle period and phase
    T = 60.0 / s.heart_rate_bpm
    t_mod = math.fmod(s.time_s, T)
    detailed_phase = _phase_label(t_mod, T)
    s.cardiac_phase = _broad_phase(detailed_phase)

    # 5. Frank-Starling effective contractility
    lv_vol = s.chambers["left_ventricle"].volume_ml
    contractility_eff = frank_starling_factor(lv_vol, s.contractility, FRANK_STARLING)

    # 6. Chamber pressures — uses calibrated CHAMBER_PHYSIOLOGY from parameters.py
    volumes_dict = {name: ch.volume_ml for name, ch in s.chambers.items()}
    pressures = compute_all_pressures(
        volumes=volumes_dict,
        t_mod=t_mod,
        T=T,
        contractility_eff=contractility_eff,
        phase_params=PHASE,
    )
    p_ra  = pressures["right_atrium"]
    p_rv  = pressures["right_ventricle"]
    p_la  = pressures["left_atrium"]
    p_lv  = pressures["left_ventricle"]
    p_art = s.circulation.aortic_pressure_mmhg
    p_ven = s.circulation.venous_pressure_mmhg
    p_pa  = s.circulation.pulmonary_artery_pressure_mmhg
    svr   = s.circulation.systemic_vascular_resistance

    # 7. Extra-cardiac venous return flows
    q_venous_return = compute_venous_return(p_ven, p_ra, CIRCULATION)
    q_pv_return     = compute_pulmonary_venous_return(p_pv, p_la, CIRCULATION)

    # 8. Valve flows
    valve_results = compute_all_valve_flows(
        p_ra=p_ra,
        p_rv=p_rv,
        p_la=p_la,
        p_lv=p_lv,
        p_aorta=p_art,
        p_pulmonary_artery=p_pa,
        valve_params=VALVES,
    )
    q_tricuspid = valve_results["tricuspid"][0]
    q_pulmonary = valve_results["pulmonary"][0]
    q_mitral    = valve_results["mitral"][0]
    q_aortic    = valve_results["aortic"][0]

    # 9. Update chamber volumes  dV = (Q_in - Q_out) * dt
    dv_ra = (q_venous_return - q_tricuspid) * dt
    dv_rv = (q_tricuspid     - q_pulmonary) * dt
    dv_la = (q_pv_return     - q_mitral)    * dt
    dv_lv = (q_mitral        - q_aortic)    * dt

    new_vol_ra = max(s.chambers["right_atrium"].volume_ml    + dv_ra, _MIN_VOLUME_ML)
    new_vol_rv = max(s.chambers["right_ventricle"].volume_ml + dv_rv, _MIN_VOLUME_ML)
    new_vol_la = max(s.chambers["left_atrium"].volume_ml     + dv_la, _MIN_VOLUME_ML)
    new_vol_lv = max(s.chambers["left_ventricle"].volume_ml  + dv_lv, _MIN_VOLUME_ML)

    # 10. Systemic arterial (Windkessel)
    p_art_new, q_systemic = step_systemic_arterial(
        p_art=p_art,
        q_in_aortic=q_aortic,
        p_ven=p_ven,
        svr_effective=svr,
        dt=dt,
        params=CIRCULATION,
    )

    # 11. Systemic venous
    p_ven_new = step_systemic_venous(
        p_ven=p_ven,
        q_in_systemic=q_systemic,
        q_out_to_ra=q_venous_return,
        dt=dt,
        params=CIRCULATION,
    )

    # 12. Pulmonary
    p_pa_new, p_pv_new, _q_pul = step_pulmonary(
        p_pa=p_pa,
        p_pv=p_pv,
        q_rv_out=q_pulmonary,
        dt=dt,
        q_pv_out=q_pv_return,
        params=CIRCULATION,
    )

    # 13. EDV/ESV tracking
    tracker.update(new_vol_lv, detailed_phase)
    edv = tracker.edv
    esv = tracker.esv
    sv  = max(edv - esv, 0.0)
    co  = s.heart_rate_bpm * sv / 1000.0   # L/min

    # 14. SBP/DBP and MAP
    bp_tracker.update(p_art_new, dt)
    new_sbp  = bp_tracker.sbp
    new_dbp  = bp_tracker.dbp
    map_mmhg = new_dbp + (new_sbp - new_dbp) / 3.0

    # 15. Baroreflex
    hr_new, svr_new, contr_new = baroreflex_step(
        hr_current=s.heart_rate_bpm,
        svr_current=svr,
        contractility_current=s.contractility,
        map_current=map_mmhg,
        dt=dt,
        baro_params=BAROREFLEX,
    )

    # 16. Assemble new state
    def _update_chamber(name: str, vol: float, p: float) -> ChamberState:
        old = s.chambers[name]
        return ChamberState(
            name=name,
            volume_ml=vol,
            pressure_mmhg=_clamp(p, -10.0, _MAX_PRESSURE),
            unstressed_volume_ml=old.unstressed_volume_ml,
            compliance_ml_per_mmhg=old.compliance_ml_per_mmhg,
        )

    s.chambers["right_atrium"]    = _update_chamber("right_atrium",    new_vol_ra, p_ra)
    s.chambers["right_ventricle"] = _update_chamber("right_ventricle", new_vol_rv, p_rv)
    s.chambers["left_atrium"]     = _update_chamber("left_atrium",     new_vol_la, p_la)
    s.chambers["left_ventricle"]  = _update_chamber("left_ventricle",  new_vol_lv, p_lv)

    for name, (flow, is_open) in valve_results.items():
        s.valves[name] = ValveState(name=name, is_open=is_open, flow_ml_per_s=flow)

    s.circulation = CirculationState(
        blood_volume_l=state.circulation.blood_volume_l,   # conserved
        systemic_vascular_resistance=_clamp(svr_new, 0.1, 10.0),
        venous_pressure_mmhg=p_ven_new,
        aortic_pressure_mmhg=p_art_new,
        pulmonary_artery_pressure_mmhg=p_pa_new,
    )

    s.metrics = CardiacMetrics(
        end_diastolic_volume_ml=edv,
        end_systolic_volume_ml=esv,
        stroke_volume_ml=sv,
        cardiac_output_l_min=co,
        systolic_bp_mmhg=new_sbp,
        diastolic_bp_mmhg=new_dbp,
        map_mmhg=map_mmhg,
    )

    s.heart_rate_bpm = _clamp(hr_new, BAROREFLEX.hr_min_bpm, BAROREFLEX.hr_max_bpm)
    s.contractility  = _clamp(contr_new, BAROREFLEX.contractility_min, BAROREFLEX.contractility_max)

    # 17. Validate
    validate_state(s)

    return s, p_pv_new


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def step(
    state: SimulationState,
    dt: float = 0.01,
) -> SimulationState:
    """Advance the cardiovascular simulation by one timestep.

    For single-step use.  Uses a fresh tracker initialised from the
    current state metrics.  For long simulations use `simulate()` which
    maintains a persistent tracker across steps.

    Parameters
    ----------
    state : SimulationState
        Current simulation state (not mutated).
    dt : float
        Timestep in seconds (default 0.01 s).

    Returns
    -------
    SimulationState
        New state advanced by dt seconds.
    """
    tracker    = _CycleTracker(
        edv=state.metrics.end_diastolic_volume_ml,
        esv=state.metrics.end_systolic_volume_ml,
    )
    bp_tracker = _BPTracker(
        sbp=state.metrics.systolic_bp_mmhg,
        dbp=state.metrics.diastolic_bp_mmhg,
    )
    p_pv = CIRCULATION.pulmonary_venous_pressure_ref_mmhg
    new_state, _ = _step_internal(state, dt, tracker, bp_tracker, p_pv)
    return new_state


def simulate(
    state: SimulationState,
    duration: float,
    dt: float = 0.01,
) -> list[SimulationState]:
    """Run the cardiovascular simulation for a specified duration.

    The initial state is included as the first element of the returned
    list.  Each subsequent element is the state after one dt step.

    Parameters
    ----------
    state : SimulationState
        Initial simulation state (not mutated).
    duration : float
        Total simulation duration (s).
    dt : float
        Timestep in seconds (default 0.01 s).

    Returns
    -------
    list[SimulationState]
        Ordered list of states from t=0 to t=duration.

    Notes
    -----
    The simulation is deterministic: two calls with identical *state*
    and *dt* will produce bit-for-bit identical output lists.
    """
    if dt <= 0:
        raise ValueError(f"dt must be > 0, got {dt}")
    if duration <= 0:
        raise ValueError(f"duration must be > 0, got {duration}")

    tracker = _CycleTracker(
        edv=state.metrics.end_diastolic_volume_ml,
        esv=state.metrics.end_systolic_volume_ml,
    )
    bp_tracker = _BPTracker(
        sbp=state.metrics.systolic_bp_mmhg,
        dbp=state.metrics.diastolic_bp_mmhg,
    )
    p_pv = CIRCULATION.pulmonary_venous_pressure_ref_mmhg

    n_steps = int(round(duration / dt))
    history: list[SimulationState] = [copy_state(state)]
    current = state

    for _ in range(n_steps):
        current, p_pv = _step_internal(current, dt, tracker, bp_tracker, p_pv)
        history.append(current)

    return history
