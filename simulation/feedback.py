"""Cardiovascular feedback mechanisms.

Implements two slow regulatory systems:

1. **Frank-Starling mechanism**
   Increases effective ventricular contractility when preload (EDV) is
   elevated, using a bounded tanh saturation function so the response
   cannot grow without limit.

2. **Baroreflex**
   Compares current MAP to a reference resting MAP and slowly adjusts
   HR, SVR, and contractility toward restoring pressure.  The time
   constant is ≫ one cardiac cycle, so the baroreflex cannot jump
   instantaneously.

Neither mechanism overwrites the patient's baseline contractility stored
in SimulationState.contractility; they produce *effective* corrections
that are applied during the step computation and then stored back as
updated HR/SVR values.
"""

from __future__ import annotations

import math

from simulation.parameters import (
    BaroreflexParams,
    FrankStarlingParams,
    BAROREFLEX,
    FRANK_STARLING,
)


# ---------------------------------------------------------------------------
# Frank-Starling
# ---------------------------------------------------------------------------

def frank_starling_factor(
    lv_volume_ml: float,
    baseline_contractility: float,
    fs_params: FrankStarlingParams = FRANK_STARLING,
) -> float:
    """Return the effective contractility after Frank-Starling correction.

    The patient's baseline contractility is modulated by preload using a
    smooth tanh saturation so the effect is bounded.

    Concept
    -------
        EDV ↑  →  preload ↑  →  effective_contractility ↑  →  SV ↑

    Parameters
    ----------
    lv_volume_ml : float
        Current LV volume (mL).  Used as a proxy for preload.
    baseline_contractility : float
        Patient's myocardial contractility from SimulationState
        (dimensionless, 1.0 = healthy resting).
    fs_params : FrankStarlingParams
        Frank-Starling tuning parameters.

    Returns
    -------
    float
        Effective contractility (dimensionless).
    """
    # Normalised preload deviation from reference EDV
    norm_dev = (lv_volume_ml - fs_params.lv_ref_volume_ml) / fs_params.lv_ref_volume_ml
    # Saturating response: tanh maps any deviation to (-1, 1)
    fs_correction = fs_params.max_boost * math.tanh(fs_params.gain * norm_dev)
    effective = baseline_contractility * (1.0 + fs_correction)
    # Hard bounds to prevent runaway
    return max(0.2, min(effective, 3.0))


# ---------------------------------------------------------------------------
# Baroreflex
# ---------------------------------------------------------------------------

def baroreflex_step(
    hr_current: float,
    svr_current: float,
    contractility_current: float,
    map_current: float,
    dt: float,
    baro_params: BaroreflexParams = BAROREFLEX,
) -> tuple[float, float, float]:
    """Apply one baroreflex correction step.

    The baroreflex is implemented as a first-order controller:

        MAP_error = MAP_ref - MAP_current

    Each controlled variable moves toward its setpoint at a rate
    proportional to the error and inversely proportional to τ:

        dHR/dt   = gain_hr  * MAP_error / τ
        dSVR/dt  = gain_svr * MAP_error / τ
        dContr/dt = gain_c  * MAP_error / τ

    This produces exponential approach (not instantaneous correction),
    and the gains are small enough that one cardiac cycle has negligible
    effect.

    Parameters
    ----------
    hr_current : float
        Current heart rate (bpm).
    svr_current : float
        Current SVR multiplier (dimensionless, 1.0 = baseline).
    contractility_current : float
        Current contractility (dimensionless).
    map_current : float
        Current mean arterial pressure (mmHg).
    dt : float
        Timestep (s).
    baro_params : BaroreflexParams
        Baroreflex tuning parameters.

    Returns
    -------
    hr_new : float
        Updated heart rate (bpm).
    svr_new : float
        Updated SVR multiplier.
    contractility_new : float
        Updated contractility.
    """
    map_error = baro_params.map_ref_mmhg - map_current

    # Fractional change rates per second
    dhr_dt      = baro_params.gain_hr_bpm_per_mmhg * map_error / baro_params.tau_s
    dsvr_dt     = baro_params.gain_svr             * map_error / baro_params.tau_s
    dcontr_dt   = baro_params.gain_contractility   * map_error / baro_params.tau_s

    hr_new      = hr_current      + dhr_dt    * dt
    svr_new     = svr_current     + dsvr_dt   * dt
    contr_new   = contractility_current + dcontr_dt * dt

    # Clamp to physiological bounds
    hr_new    = max(baro_params.hr_min_bpm,    min(hr_new,   baro_params.hr_max_bpm))
    svr_new   = max(baro_params.svr_min,       min(svr_new,  baro_params.svr_max))
    contr_new = max(baro_params.contractility_min, min(contr_new, baro_params.contractility_max))

    return hr_new, svr_new, contr_new
