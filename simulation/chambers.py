"""Cardiac chamber pressure calculations.

Implements time-varying elastance for the ventricles and passive
compliance for the atria.  Nothing in this module mutates state;
all functions are pure computations that return pressure values (mmHg).

Design
------
The physiological passive compliance and active elastance parameters all
come from `simulation.parameters.CHAMBER_PHYSIOLOGY`.  This ensures that
the pressures computed here are calibrated to produce physiologically
correct values (RA ≈ 1–4 mmHg, RV ≈ 4 mmHg dia, LA ≈ 8 mmHg, LV ≈ 8 mmHg dia)
regardless of the exact volume values stored in ChamberState from state.py.

Theory
------
For atria (passive-only):
    P = (V - V_unstressed) / C

For ventricles:
    P_passive = (V - V_unstressed) / C
    activation(t_mod) ∈ [0, 1]  (smooth half-cosine)
    E(t) = E_min + activation × (E_max - E_min) × contractility_eff
    P_active = E(t) × max(V - V0, 0)
    P_total  = P_passive + P_active

E_min is set to 0.0 in default parameters so diastole is purely passive.
"""

from __future__ import annotations

import math

from simulation.parameters import ChamberPhysiology, CardiacPhaseParams, PHASE, CHAMBER_PHYSIOLOGY


# ---------------------------------------------------------------------------
# Ventricular activation function
# ---------------------------------------------------------------------------

def _ventricular_activation(
    t_mod: float,
    T: float,
    phase_params: CardiacPhaseParams = PHASE,
) -> float:
    """Return the dimensionless ventricular activation [0, 1].

    Rises from 0 at IC start, peaks at the mid-ejection boundary,
    and returns to 0 at the end of isovolumetric relaxation.

    Parameters
    ----------
    t_mod : float
        Time within the current cardiac cycle (s).  0 ≤ t_mod < T.
    T : float
        Cardiac cycle duration (s).
    phase_params : CardiacPhaseParams
        Phase timing fractions.

    Returns
    -------
    float
        Activation level in [0, 1].
    """
    t_ej_end = (phase_params.frac_ic + phase_params.frac_ej) * T
    t_ir_end = (
        phase_params.frac_ic + phase_params.frac_ej + phase_params.frac_ir
    ) * T
    systole_duration    = t_ej_end              # IC + EJ
    relaxation_duration = phase_params.frac_ir * T

    if t_mod < systole_duration:
        phi = t_mod / systole_duration
        return 0.5 * (1.0 - math.cos(math.pi * phi))
    elif t_mod < t_ir_end:
        phi = (t_mod - systole_duration) / relaxation_duration
        return 0.5 * (1.0 + math.cos(math.pi * phi))
    else:
        return 0.0  # diastole


# ---------------------------------------------------------------------------
# Single chamber pressure
# ---------------------------------------------------------------------------

def compute_chamber_pressure(
    volume_ml: float,
    phys: ChamberPhysiology,
    t_mod: float,
    T: float,
    contractility_eff: float = 1.0,
    phase_params: CardiacPhaseParams = PHASE,
) -> float:
    """Compute instantaneous chamber pressure (mmHg).

    For atria (e_max_mmhg_per_ml == 0) only the passive component is used.
    For ventricles, a time-varying elastance active component is added.

    Parameters
    ----------
    volume_ml : float
        Current chamber volume (mL).
    phys : ChamberPhysiology
        Physiological parameters for this chamber (from CHAMBER_PHYSIOLOGY).
    t_mod : float
        Time within the current cardiac cycle (s).
    T : float
        Cardiac cycle duration (s).
    contractility_eff : float
        Effective contractility multiplier (1.0 = healthy resting).
    phase_params : CardiacPhaseParams
        Phase timing fractions.

    Returns
    -------
    float
        Instantaneous chamber pressure (mmHg).
    """
    p_passive = (volume_ml - phys.unstressed_volume_ml) / phys.compliance_ml_per_mmhg

    if phys.e_max_mmhg_per_ml == 0.0:
        return p_passive  # atrium: purely passive

    activation = _ventricular_activation(t_mod, T, phase_params)
    e_t = (
        phys.e_min_mmhg_per_ml
        + activation
        * (phys.e_max_mmhg_per_ml - phys.e_min_mmhg_per_ml)
        * contractility_eff
    )
    v_above_v0 = max(volume_ml - phys.v0_ml, 0.0)
    p_active = e_t * v_above_v0

    return p_passive + p_active


# ---------------------------------------------------------------------------
# All-chamber pressures in one call
# ---------------------------------------------------------------------------

def compute_all_pressures(
    volumes: dict[str, float],
    t_mod: float,
    T: float,
    contractility_eff: float = 1.0,
    physiology: dict[str, ChamberPhysiology] | None = None,
    phase_params: CardiacPhaseParams = PHASE,
) -> dict[str, float]:
    """Compute pressures for all four chambers.

    Parameters
    ----------
    volumes : dict[str, float]
        Current volumes keyed by chamber name (mL).
    t_mod : float
        Time within the current cardiac cycle (s).
    T : float
        Cardiac cycle duration (s).
    contractility_eff : float
        Effective contractility for ventricular chambers.
    physiology : dict | None
        Chamber physiology parameters. Defaults to CHAMBER_PHYSIOLOGY.
    phase_params : CardiacPhaseParams
        Phase timing fractions.

    Returns
    -------
    dict[str, float]
        Pressures in mmHg keyed by chamber name.
    """
    if physiology is None:
        physiology = CHAMBER_PHYSIOLOGY
    return {
        name: compute_chamber_pressure(
            volume_ml=volumes[name],
            phys=physiology[name],
            t_mod=t_mod,
            T=T,
            contractility_eff=contractility_eff,
            phase_params=phase_params,
        )
        for name in volumes
    }
