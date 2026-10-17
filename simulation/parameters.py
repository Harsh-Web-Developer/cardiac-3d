"""Cardiovascular simulation model parameters.

All constants are documented with units.
No magic numbers should appear elsewhere in the simulation package;
import from here instead.

Unit conventions
----------------
Pressure   : mmHg
Volume     : mL
Flow       : mL/s
Resistance : mmHg·s/mL
Compliance : mL/mmHg
Time       : s
HR         : bpm
CO         : L/min

Calibration targets
-------------------
Resting baseline:
    HR       ≈ 72 bpm
    EDV      ≈ 120 mL
    ESV      ≈ 50 mL
    SV       ≈ 70 mL
    CO       ≈ 5 L/min
    SBP/DBP  ≈ 120/80 mmHg
    MAP      ≈ 93 mmHg

Chamber pressures at resting:
    RA       ≈ 4  mmHg
    RV (dia) ≈ 4  mmHg  RV (sys) ≈ 25  mmHg
    LA       ≈ 8  mmHg
    LV (dia) ≈ 8  mmHg  LV (sys) ≈ 120 mmHg

Passive compliance calibration
-------------------------------
The passive P-V relation is:

    P_passive = (V - V_us) / C

For a diastolic LV at EDV=120 mL with P=8 mmHg:
    C_lv = (120 - V_us_lv) / 8

We choose V_us_lv = 8 mL, C_lv = (120-8)/8 = 14 mL/mmHg.

Note: SimulationState.ChamberState stores its own C and V_us from state.py
which may differ from physiological targets.  chambers.py USES the values
from CHAMBER_PHYSIOLOGY in this file (not from ChamberState), ensuring
physiologically calibrated passive pressure computation.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class CardiacPhaseParams:
    """Fraction of the cardiac cycle spent in each sub-phase.

    All four fractions must sum to 1.0.

    Attributes
    ----------
    frac_ic  : Isovolumetric contraction (0 → ejection onset)
    frac_ej  : Ejection (forward flow from ventricle)
    frac_ir  : Isovolumetric relaxation (post-ejection)
    frac_dia : Diastolic filling (remainder of cycle)
    """
    frac_ic:  float = 0.07   # ~7% of cycle  ≈ 58 ms at 72 bpm
    frac_ej:  float = 0.28   # ~28% of cycle ≈ 233 ms at 72 bpm
    frac_ir:  float = 0.08   # ~8% of cycle  ≈ 67 ms at 72 bpm
    frac_dia: float = 0.57   # ~57% of cycle ≈ 474 ms at 72 bpm


@dataclass(frozen=True)
class ChamberPhysiology:
    """Complete passive + active parameters for one heart chamber.

    These are the authoritative physiological parameters used by the
    simulation engine.  They are deliberately separate from the values
    stored in ChamberState (which come from state.py) because the two
    may differ in their default baseline assumptions.

    Attributes
    ----------
    unstressed_volume_ml      : Volume at zero passive pressure (mL)
    compliance_ml_per_mmhg    : Passive compliance (mL/mmHg)
    e_min_mmhg_per_ml         : Diastolic (minimum) elastance (mmHg/mL)
                                Set to 0 to make diastole purely passive.
    e_max_mmhg_per_ml         : Systolic (maximum) elastance (mmHg/mL)
                                Set to 0 for atria (purely passive).
    v0_ml                     : Elastance dead volume (mL)
    """
    unstressed_volume_ml:   float
    compliance_ml_per_mmhg: float
    e_min_mmhg_per_ml:      float = 0.0
    e_max_mmhg_per_ml:      float = 0.0
    v0_ml:                  float = 0.0


@dataclass(frozen=True)
class ValveParams:
    """Resistance parameters for one cardiac valve.

    Attributes
    ----------
    resistance_mmhg_s_per_ml : Flow resistance when open (mmHg·s/mL)
    hysteresis_mmhg          : Pressure hysteresis to prevent chatter (mmHg)
    """
    resistance_mmhg_s_per_ml: float
    hysteresis_mmhg:           float = 0.0


@dataclass(frozen=True)
class CirculationParams:
    """Lumped parameter constants for systemic and pulmonary circulation.

    Attributes
    ----------
    systemic_arterial_compliance_ml_per_mmhg : Windkessel arterial compliance
    systemic_venous_compliance_ml_per_mmhg   : Venous reservoir compliance
    systemic_resistance_mmhg_s_per_ml        : Baseline SVR (mmHg·s/mL)
    pulmonary_arterial_compliance_ml_per_mmhg: Pulmonary arterial compliance
    pulmonary_venous_compliance_ml_per_mmhg  : Pulmonary venous compliance
    pulmonary_resistance_mmhg_s_per_ml       : Pulmonary vascular resistance
    venous_return_resistance_mmhg_s_per_ml   : Systemic venous return resistance
    pulmonary_venous_return_resistance_mmhg_s_per_ml : Pulmonary venous return resistance
    systemic_venous_pressure_ref_mmhg        : Resting CVP (mmHg)
    pulmonary_venous_pressure_ref_mmhg       : Resting pulmonary venous pressure
    """
    systemic_arterial_compliance_ml_per_mmhg:         float = 1.5
    systemic_venous_compliance_ml_per_mmhg:           float = 50.0
    systemic_resistance_mmhg_s_per_ml:                float = 1.10   # baseline; scaled by SVR
    pulmonary_arterial_compliance_ml_per_mmhg:        float = 4.0
    pulmonary_venous_compliance_ml_per_mmhg:          float = 8.0
    pulmonary_resistance_mmhg_s_per_ml:               float = 0.12
    venous_return_resistance_mmhg_s_per_ml:           float = 0.015
    pulmonary_venous_return_resistance_mmhg_s_per_ml: float = 0.015
    systemic_venous_pressure_ref_mmhg:                float = 4.0
    pulmonary_venous_pressure_ref_mmhg:               float = 8.5


@dataclass(frozen=True)
class BaroreflexParams:
    """Baroreflex controller parameters.

    Attributes
    ----------
    map_ref_mmhg        : Target resting MAP (mmHg)
    tau_s               : Controller time-constant (s)  — deliberately slow
    gain_hr_bpm_per_mmhg: Change in HR per mmHg MAP error (bpm/mmHg)
    gain_svr            : Fractional SVR change per mmHg MAP error
    gain_contractility  : Fractional contractility change per mmHg MAP error
    hr_min_bpm          : Absolute HR lower bound (bpm)
    hr_max_bpm          : Absolute HR upper bound (bpm)
    svr_min             : Absolute SVR multiplier lower bound
    svr_max             : Absolute SVR multiplier upper bound
    contractility_min   : Absolute contractility lower bound
    contractility_max   : Absolute contractility upper bound
    """
    map_ref_mmhg:          float = 93.0
    tau_s:                 float = 20.0
    gain_hr_bpm_per_mmhg:  float = 0.3
    gain_svr:              float = 0.008
    gain_contractility:    float = 0.003
    hr_min_bpm:            float = 40.0
    hr_max_bpm:            float = 180.0
    svr_min:               float = 0.3
    svr_max:               float = 3.5
    contractility_min:     float = 0.2
    contractility_max:     float = 3.0


@dataclass(frozen=True)
class FrankStarlingParams:
    """Frank-Starling mechanism parameters.

    Attributes
    ----------
    lv_ref_volume_ml : LV reference EDV around which FS operates (mL)
    gain             : Sensitivity of effective contractility to preload
    max_boost        : Maximum fractional boost from FS (dimensionless)
    """
    lv_ref_volume_ml: float = 120.0
    gain:             float = 1.2
    max_boost:        float = 0.30


# ---------------------------------------------------------------------------
# Calibrated chamber physiology parameters
# ---------------------------------------------------------------------------

CHAMBER_PHYSIOLOGY: dict[str, ChamberPhysiology] = {
    "right_atrium": ChamberPhysiology(
        unstressed_volume_ml=30.0,
        compliance_ml_per_mmhg=10.0,   # P = (50-30)/10 = 2 mmHg at V=50
        e_min_mmhg_per_ml=0.0,
        e_max_mmhg_per_ml=0.0,
        v0_ml=0.0,
    ),
    "right_ventricle": ChamberPhysiology(
        unstressed_volume_ml=45.0,
        compliance_ml_per_mmhg=20.0,   # P = (130-45)/20 = 4.25 mmHg at V=130
        e_min_mmhg_per_ml=0.0,
        e_max_mmhg_per_ml=0.55,        # Peak RV P ≈ 0.55*(80-10) ≈ 38 mmHg (sufficient to open PA)
        v0_ml=10.0,
    ),
    "left_atrium": ChamberPhysiology(
        unstressed_volume_ml=21.0,
        compliance_ml_per_mmhg=3.0,    # P = (45-21)/3 = 8 mmHg at V=45 (target PCWP)
        e_min_mmhg_per_ml=0.0,
        e_max_mmhg_per_ml=0.0,
        v0_ml=0.0,
    ),
    "left_ventricle": ChamberPhysiology(
        unstressed_volume_ml=8.0,
        compliance_ml_per_mmhg=14.0,   # P = (120-8)/14 = 8 mmHg at V=120 (EDV)
        e_min_mmhg_per_ml=0.0,
        e_max_mmhg_per_ml=2.90,        # Peak LV P ≈ 2.9*(50-5) = 130 mmHg at ESV=50
        v0_ml=5.0,
    ),
}

VALVES: dict[str, ValveParams] = {
    # Physiological valve resistances allowing healthy flow rates and complete filling/ejection:
    "tricuspid": ValveParams(resistance_mmhg_s_per_ml=0.010, hysteresis_mmhg=0.0),
    "pulmonary": ValveParams(resistance_mmhg_s_per_ml=0.015, hysteresis_mmhg=0.0),
    "mitral":    ValveParams(resistance_mmhg_s_per_ml=0.010, hysteresis_mmhg=0.0),
    "aortic":    ValveParams(resistance_mmhg_s_per_ml=0.015, hysteresis_mmhg=0.0),
}

PHASE          = CardiacPhaseParams()
CIRCULATION    = CirculationParams()
BAROREFLEX     = BaroreflexParams()
FRANK_STARLING = FrankStarlingParams()
