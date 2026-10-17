"""Lumped-parameter circulatory compartment dynamics.

Topology
--------
    Systemic Veins
         ↓  (Q_venous_return)
    Right Atrium
         ↓  (tricuspid)
    Right Ventricle
         ↓  (pulmonary valve)
    Pulmonary Artery
         ↓  (pulmonary resistance)
    Pulmonary Veins
         ↓  (mitral)
    Left Atrium
         ↓  (mitral valve)
    Left Ventricle
         ↓  (aortic valve)
    Aorta / Systemic Arteries  ← Windkessel
         ↓  (SVR)
    Systemic Veins              ← venous reservoir

All pressures are in mmHg, flows in mL/s, volumes in mL,
compliances in mL/mmHg, resistances in mmHg·s/mL.

This module provides pure functions that advance the pressures of
the vascular compartments by one timestep dt.  The caller
(cardiovascular.py) assembles the full picture.
"""

from __future__ import annotations

from dataclasses import dataclass

from simulation.parameters import CirculationParams, CIRCULATION


# ---------------------------------------------------------------------------
# Vascular compartment state (transient, not stored in SimulationState)
# ---------------------------------------------------------------------------

@dataclass
class VascularState:
    """Pressure state of all extra-cardiac compartments.

    Attributes
    ----------
    p_art_mmhg : float  Systemic arterial (aortic) pressure (mmHg)
    p_ven_mmhg : float  Systemic venous / CVP (mmHg)
    p_pa_mmhg  : float  Pulmonary artery pressure (mmHg)
    p_pv_mmhg  : float  Pulmonary venous pressure (mmHg)
    """
    p_art_mmhg: float
    p_ven_mmhg: float
    p_pa_mmhg:  float
    p_pv_mmhg:  float


# ---------------------------------------------------------------------------
# Systemic Windkessel
# ---------------------------------------------------------------------------

def step_systemic_arterial(
    p_art: float,
    q_in_aortic: float,      # flow from LV through aortic valve (mL/s)
    p_ven: float,
    svr_effective: float,    # dimensionless multiplier on baseline SVR
    dt: float,
    params: CirculationParams = CIRCULATION,
) -> tuple[float, float]:
    """Advance systemic arterial pressure by dt.

    dP_art/dt = (Q_in - Q_out) / C_art

    where Q_out = (P_art - P_ven) / (R_sys * svr_effective)

    Parameters
    ----------
    p_art : float
        Current systemic arterial pressure (mmHg).
    q_in_aortic : float
        Aortic valve flow entering the systemic arteries (mL/s).
    p_ven : float
        Current systemic venous / CVP (mmHg).
    svr_effective : float
        Current SVR multiplier from state (1.0 = resting baseline).
    dt : float
        Timestep (s).
    params : CirculationParams
        Circulation constants.

    Returns
    -------
    p_art_new : float
        Updated systemic arterial pressure (mmHg).
    q_systemic : float
        Systemic outflow (mL/s) — flow leaving arteries into veins.
    """
    r_sys = params.systemic_resistance_mmhg_s_per_ml * svr_effective
    q_out = (p_art - p_ven) / r_sys if r_sys > 0 else 0.0
    q_out = max(q_out, 0.0)  # forward-only systemic flow (capillaries are one-way net)

    dp_dt = (q_in_aortic - q_out) / params.systemic_arterial_compliance_ml_per_mmhg
    p_art_new = p_art + dp_dt * dt
    # Guard against extreme excursions (not physiologically reachable in normal sim)
    p_art_new = max(p_art_new, 1.0)

    return p_art_new, q_out


# ---------------------------------------------------------------------------
# Systemic venous reservoir
# ---------------------------------------------------------------------------

def step_systemic_venous(
    p_ven: float,
    q_in_systemic: float,   # flow arriving from systemic arteries (mL/s)
    q_out_to_ra: float,     # flow leaving via tricuspid toward RA (mL/s)
    dt: float,
    params: CirculationParams = CIRCULATION,
) -> float:
    """Advance systemic venous pressure by dt.

    dP_ven/dt = (Q_in - Q_out) / C_ven

    Parameters
    ----------
    p_ven : float
        Current venous pressure (mmHg).
    q_in_systemic : float
        Inflow from systemic capillaries (mL/s).
    q_out_to_ra : float
        Outflow via the tricuspid valve into the right atrium (mL/s).
    dt : float
        Timestep (s).
    params : CirculationParams
        Circulation constants.

    Returns
    -------
    float
        Updated venous pressure (mmHg).
    """
    dp_dt = (q_in_systemic - q_out_to_ra) / params.systemic_venous_compliance_ml_per_mmhg
    p_ven_new = p_ven + dp_dt * dt
    p_ven_new = max(p_ven_new, 0.1)
    return p_ven_new


# ---------------------------------------------------------------------------
# Pulmonary circulation
# ---------------------------------------------------------------------------

def step_pulmonary(
    p_pa: float,
    p_pv: float,
    q_rv_out: float,   # flow from RV through pulmonary valve (mL/s)
    dt: float,
    q_pv_out: float = 0.0,  # flow leaving pulmonary veins into LA (mL/s)
    params: CirculationParams = CIRCULATION,
) -> tuple[float, float, float]:
    """Advance pulmonary artery and pulmonary venous pressures by dt.

    Pulmonary artery:
        dP_pa/dt = (Q_rv_out - Q_pul) / C_pa

    Pulmonary flow:
        Q_pul = (P_pa - P_pv) / R_pul    (net flow through lungs)

    Pulmonary veins:
        dP_pv/dt = (Q_pul - Q_pv_out) / C_pv   (blood volume conservation)

    Parameters
    ----------
    p_pa : float
        Current pulmonary artery pressure (mmHg).
    p_pv : float
        Current pulmonary venous pressure (mmHg).
    q_rv_out : float
        Flow from RV into pulmonary artery (mL/s).
    dt : float
        Timestep (s).
    q_pv_out : float
        Flow leaving pulmonary veins into left atrium (mL/s).
    params : CirculationParams
        Circulation constants.

    Returns
    -------
    p_pa_new : float
        Updated pulmonary artery pressure (mmHg).
    p_pv_new : float
        Updated pulmonary venous pressure (mmHg).
    q_pul : float
        Pulmonary flow from PA to PV (mL/s).
    """
    # Flow through pulmonary vascular bed
    q_pul = max(0.0, (p_pa - p_pv) / params.pulmonary_resistance_mmhg_s_per_ml)

    # PA: receives RV output, loses to pulmonary bed
    dp_pa_dt = (q_rv_out - q_pul) / params.pulmonary_arterial_compliance_ml_per_mmhg
    p_pa_new = max(p_pa + dp_pa_dt * dt, 1.0)

    # Pulmonary veins: receives from pulmonary bed, drains into LA (q_pv_out)
    dp_pv_dt = (q_pul - q_pv_out) / params.pulmonary_venous_compliance_ml_per_mmhg
    p_pv_new = max(p_pv + dp_pv_dt * dt, 1.0)

    return p_pa_new, p_pv_new, q_pul


# ---------------------------------------------------------------------------
# Venous return to RA
# ---------------------------------------------------------------------------

def compute_venous_return(
    p_ven: float,
    p_ra: float,
    params: CirculationParams = CIRCULATION,
) -> float:
    """Compute venous return flow into the right atrium.

    Q_vr = max(0, (P_ven - P_ra) / R_vr)

    Parameters
    ----------
    p_ven : float
        Systemic venous pressure (mmHg).
    p_ra : float
        Right atrium pressure (mmHg).
    params : CirculationParams
        Circulation constants.

    Returns
    -------
    float
        Venous return flow (mL/s).
    """
    r_vr = params.venous_return_resistance_mmhg_s_per_ml
    return max(0.0, (p_ven - p_ra) / r_vr)


# ---------------------------------------------------------------------------
# Pulmonary venous return to LA
# ---------------------------------------------------------------------------

def compute_pulmonary_venous_return(
    p_pv: float,
    p_la: float,
    params: CirculationParams = CIRCULATION,
) -> float:
    """Compute pulmonary venous return flow into left atrium.

    Parameters
    ----------
    p_pv : float
        Pulmonary venous pressure (mmHg).
    p_la : float
        Left atrium pressure (mmHg).
    params : CirculationParams
        Circulation constants.

    Returns
    -------
    float
        Pulmonary venous return flow (mL/s).
    """
    r_pv = params.pulmonary_venous_return_resistance_mmhg_s_per_ml
    return max(0.0, (p_pv - p_la) / r_pv)
