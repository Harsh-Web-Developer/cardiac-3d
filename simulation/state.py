"""Cardiovascular simulation state model.

Single source of truth for the CARDIA simulation engine.
All downstream modules (chambers, valves, circulation, feedback)
import from here.
"""

from __future__ import annotations

import copy
import dataclasses
from dataclasses import dataclass


# ---------------------------------------------------------------------------
# Chamber
# ---------------------------------------------------------------------------

@dataclass
class ChamberState:
    """State of one heart chamber.

    Attributes:
        name: Identifier (right_atrium, right_ventricle, left_atrium, left_ventricle).
        volume_ml: Current blood volume in the chamber (mL).
        pressure_mmhg: Instantaneous intrachamber pressure (mmHg).
        unstressed_volume_ml: Volume at zero pressure (mL).
        compliance_ml_per_mmhg: Chamber distensibility (mL/mmHg).
    """

    name: str
    volume_ml: float
    pressure_mmhg: float
    unstressed_volume_ml: float
    compliance_ml_per_mmhg: float


# ---------------------------------------------------------------------------
# Valve
# ---------------------------------------------------------------------------

@dataclass
class ValveState:
    """State of one heart valve.

    Attributes:
        name: Identifier (tricuspid, pulmonary, mitral, aortic).
        is_open: Whether the valve is currently open.
        flow_ml_per_s: Instantaneous volumetric flow through the valve (mL/s).
    """

    name: str
    is_open: bool
    flow_ml_per_s: float


# ---------------------------------------------------------------------------
# Circulation
# ---------------------------------------------------------------------------

@dataclass
class CirculationState:
    """Systemic and pulmonary circulation variables.

    Attributes:
        blood_volume_l: Total circulating blood volume (L).
        systemic_vascular_resistance: Systemic vascular resistance (mmHg·s/mL).
        venous_pressure_mmhg: Central venous pressure (mmHg).
        aortic_pressure_mmhg: Aortic root pressure (mmHg).
        pulmonary_artery_pressure_mmhg: Pulmonary artery pressure (mmHg).
    """

    blood_volume_l: float
    systemic_vascular_resistance: float
    venous_pressure_mmhg: float
    aortic_pressure_mmhg: float
    pulmonary_artery_pressure_mmhg: float


# ---------------------------------------------------------------------------
# Cardiac metrics (derived)
# ---------------------------------------------------------------------------

@dataclass
class CardiacMetrics:
    """Derived cardiac performance metrics.

    Attributes:
        end_diastolic_volume_ml: LV end-diastolic volume (mL).
        end_systolic_volume_ml: LV end-systolic volume (mL).
        stroke_volume_ml: Stroke volume = EDV - ESV (mL).
        cardiac_output_l_min: Cardiac output = HR × SV / 1000 (L/min).
        systolic_bp_mmhg: Systolic arterial pressure (mmHg).
        diastolic_bp_mmhg: Diastolic arterial pressure (mmHg).
        map_mmhg: Mean arterial pressure (mmHg).
    """

    end_diastolic_volume_ml: float
    end_systolic_volume_ml: float
    stroke_volume_ml: float
    cardiac_output_l_min: float
    systolic_bp_mmhg: float
    diastolic_bp_mmhg: float
    map_mmhg: float


# ---------------------------------------------------------------------------
# Top-level simulation state
# ---------------------------------------------------------------------------

@dataclass
class SimulationState:
    """Complete cardiovascular simulation state.

    This is the single source of truth that all simulation modules read
    from and write to.
    """

    time_s: float
    heart_rate_bpm: float
    cardiac_phase: str  # "systole" | "diastole"
    chambers: dict[str, ChamberState]
    valves: dict[str, ValveState]
    circulation: CirculationState
    metrics: CardiacMetrics
    contractility: float  # dimensionless multiplier (1.0 = healthy resting)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def _build_chambers() -> dict[str, ChamberState]:
    """Create the four heart chambers with healthy resting values."""
    return {
        "right_atrium": ChamberState(
            name="right_atrium",
            volume_ml=50.0,
            pressure_mmhg=4.0,
            unstressed_volume_ml=30.0,
            compliance_ml_per_mmhg=10.0,
        ),
        "right_ventricle": ChamberState(
            name="right_ventricle",
            volume_ml=130.0,
            pressure_mmhg=4.0,
            unstressed_volume_ml=25.0,
            compliance_ml_per_mmhg=8.0,
        ),
        "left_atrium": ChamberState(
            name="left_atrium",
            volume_ml=45.0,
            pressure_mmhg=8.0,
            unstressed_volume_ml=30.0,
            compliance_ml_per_mmhg=8.0,
        ),
        "left_ventricle": ChamberState(
            name="left_ventricle",
            volume_ml=120.0,
            pressure_mmhg=8.0,
            unstressed_volume_ml=15.0,
            compliance_ml_per_mmhg=5.0,
        ),
    }


def _build_valves() -> dict[str, ValveState]:
    """Create the four heart valves (initial diastolic state)."""
    return {
        "tricuspid": ValveState(name="tricuspid", is_open=True, flow_ml_per_s=0.0),
        "pulmonary": ValveState(name="pulmonary", is_open=False, flow_ml_per_s=0.0),
        "mitral": ValveState(name="mitral", is_open=True, flow_ml_per_s=0.0),
        "aortic": ValveState(name="aortic", is_open=False, flow_ml_per_s=0.0),
    }


def create_initial_state() -> SimulationState:
    """Create a healthy resting adult baseline state.

    Baseline values:
        Heart rate:       72 bpm
        Blood volume:     5.2 L
        Contractility:    1.0
        LV EDV:           120 mL
        LV ESV:           50 mL
        Stroke volume:    70 mL  (EDV - ESV)
        Cardiac output:   5.04 L/min  (HR × SV / 1000)
        Blood pressure:   120/80 mmHg
        MAP:              ~93.3 mmHg  (diastolic + pulse_pressure / 3)
    """
    heart_rate_bpm = 72.0
    lv_edv = 120.0
    lv_esv = 50.0
    stroke_volume = lv_edv - lv_esv  # 70.0 mL
    cardiac_output = heart_rate_bpm * stroke_volume / 1000.0  # 5.04 L/min

    systolic_bp = 120.0
    diastolic_bp = 80.0
    pulse_pressure = systolic_bp - diastolic_bp  # 40 mmHg
    map_mmhg = diastolic_bp + pulse_pressure / 3.0  # 93.33...

    chambers = _build_chambers()
    valves = _build_valves()

    circulation = CirculationState(
        blood_volume_l=5.2,
        systemic_vascular_resistance=1.0,  # placeholder unit; will be refined
        venous_pressure_mmhg=4.0,
        aortic_pressure_mmhg=systolic_bp,
        pulmonary_artery_pressure_mmhg=25.0,
    )

    metrics = CardiacMetrics(
        end_diastolic_volume_ml=lv_edv,
        end_systolic_volume_ml=lv_esv,
        stroke_volume_ml=stroke_volume,
        cardiac_output_l_min=cardiac_output,
        systolic_bp_mmhg=systolic_bp,
        diastolic_bp_mmhg=diastolic_bp,
        map_mmhg=map_mmhg,
    )

    return SimulationState(
        time_s=0.0,
        heart_rate_bpm=heart_rate_bpm,
        cardiac_phase="diastole",
        chambers=chambers,
        valves=valves,
        circulation=circulation,
        metrics=metrics,
        contractility=1.0,
    )


# ---------------------------------------------------------------------------
# Deep copy
# ---------------------------------------------------------------------------

def copy_state(state: SimulationState) -> SimulationState:
    """Return a deep copy of *state*.

    The counterfactual engine requires independent copies so that
    mutating one branch never affects the other.
    """
    return copy.deepcopy(state)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_state(state: SimulationState) -> None:
    """Check *state* for obvious physiological inconsistencies.

    Raises:
        ValueError: If any check fails.  The message identifies the field
            and the violated constraint.
    """
    if state.heart_rate_bpm <= 0:
        raise ValueError(f"Heart rate must be > 0, got {state.heart_rate_bpm}")

    if state.contractility <= 0:
        raise ValueError(f"Contractility must be > 0, got {state.contractility}")

    if state.circulation.blood_volume_l <= 0:
        raise ValueError(
            f"Blood volume must be > 0, got {state.circulation.blood_volume_l}"
        )

    if state.circulation.systemic_vascular_resistance <= 0:
        raise ValueError(
            "Systemic vascular resistance must be > 0, "
            f"got {state.circulation.systemic_vascular_resistance}"
        )

    if state.metrics.stroke_volume_ml < 0:
        raise ValueError(
            f"Stroke volume must be >= 0, got {state.metrics.stroke_volume_ml}"
        )

    if state.metrics.cardiac_output_l_min < 0:
        raise ValueError(
            f"Cardiac output must be >= 0, got {state.metrics.cardiac_output_l_min}"
        )

    for name, chamber in state.chambers.items():
        if chamber.volume_ml < 0:
            raise ValueError(
                f"Chamber '{name}' volume must be >= 0, got {chamber.volume_ml}"
            )
        if chamber.compliance_ml_per_mmhg <= 0:
            raise ValueError(
                f"Chamber '{name}' compliance must be > 0, "
                f"got {chamber.compliance_ml_per_mmhg}"
            )
        if chamber.unstressed_volume_ml < 0:
            raise ValueError(
                f"Chamber '{name}' unstressed volume must be >= 0, "
                f"got {chamber.unstressed_volume_ml}"
            )


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def state_to_dict(state: SimulationState) -> dict:
    """Convert *state* to a plain JSON-compatible dictionary.

    Uses ``dataclasses.asdict`` which recursively converts dataclass
    instances to dicts and leaves primitive values unchanged.
    """
    return dataclasses.asdict(state)
