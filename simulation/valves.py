"""Cardiac valve logic.

Implements pressure-driven one-way valve flow.

Physics
-------
A valve opens when upstream pressure exceeds downstream pressure by more
than a small hysteresis threshold (to prevent numerical chatter):

    Q = max(0,  (P_up - P_down - hysteresis) / R_valve)   (mL/s)

Valves never permit reverse flow (one-way).

Flow paths
----------
    Tricuspid : right_atrium  → right_ventricle
    Pulmonary : right_ventricle → pulmonary_artery
    Mitral    : left_atrium   → left_ventricle
    Aortic    : left_ventricle  → aorta / systemic arteries
"""

from __future__ import annotations

from simulation.parameters import ValveParams, VALVES


# ---------------------------------------------------------------------------
# Single valve flow
# ---------------------------------------------------------------------------

def compute_valve_flow(
    p_upstream: float,
    p_downstream: float,
    valve_params: ValveParams,
) -> tuple[float, bool]:
    """Compute flow through one valve.

    Parameters
    ----------
    p_upstream : float
        Upstream chamber/compartment pressure (mmHg).
    p_downstream : float
        Downstream chamber/compartment pressure (mmHg).
    valve_params : ValveParams
        Resistance and hysteresis parameters.

    Returns
    -------
    flow_ml_per_s : float
        Volumetric flow (mL/s). Always ≥ 0.
    is_open : bool
        True if the valve is conducting flow.
    """
    dp = p_upstream - p_downstream - valve_params.hysteresis_mmhg
    if dp > 0.0:
        flow = dp / valve_params.resistance_mmhg_s_per_ml
        return flow, True
    return 0.0, False


# ---------------------------------------------------------------------------
# All four valves in one call
# ---------------------------------------------------------------------------

def compute_all_valve_flows(
    p_ra: float,
    p_rv: float,
    p_la: float,
    p_lv: float,
    p_aorta: float,
    p_pulmonary_artery: float,
    valve_params: dict[str, ValveParams] | None = None,
) -> dict[str, tuple[float, bool]]:
    """Compute flows through all four cardiac valves.

    Parameters
    ----------
    p_ra  : float  Right atrium pressure (mmHg)
    p_rv  : float  Right ventricle pressure (mmHg)
    p_la  : float  Left atrium pressure (mmHg)
    p_lv  : float  Left ventricle pressure (mmHg)
    p_aorta : float  Aortic / systemic arterial pressure (mmHg)
    p_pulmonary_artery : float  Pulmonary artery pressure (mmHg)
    valve_params : dict, optional
        Per-valve parameters; defaults to module-level VALVES.

    Returns
    -------
    dict[str, (flow_ml_per_s, is_open)]
        Keys: 'tricuspid', 'pulmonary', 'mitral', 'aortic'
    """
    vp = valve_params if valve_params is not None else VALVES

    tricuspid_flow, tricuspid_open = compute_valve_flow(
        p_ra, p_rv, vp["tricuspid"]
    )
    pulmonary_flow, pulmonary_open = compute_valve_flow(
        p_rv, p_pulmonary_artery, vp["pulmonary"]
    )
    mitral_flow, mitral_open = compute_valve_flow(
        p_la, p_lv, vp["mitral"]
    )
    aortic_flow, aortic_open = compute_valve_flow(
        p_lv, p_aorta, vp["aortic"]
    )

    return {
        "tricuspid": (tricuspid_flow, tricuspid_open),
        "pulmonary": (pulmonary_flow, pulmonary_open),
        "mitral":    (mitral_flow,    mitral_open),
        "aortic":    (aortic_flow,    aortic_open),
    }
