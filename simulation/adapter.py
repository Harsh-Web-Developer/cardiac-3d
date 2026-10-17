"""Simulation → ML feature adapter.

Bridges SimulationState to the five-feature dictionary expected by the
existing ML feature extractor (ml/features/extractor.py).

This module DOES NOT modify the ML package in any way.
It is a pure read-only view of the simulation state.

ML contract (must not change):
    heart_rate   : float  (bpm)
    systolic_bp  : float  (mmHg)
    diastolic_bp : float  (mmHg)
    edv          : float  (mL)
    esv          : float  (mL)
"""

from __future__ import annotations

from simulation.state import SimulationState


def state_to_ml_features(state: SimulationState) -> dict:
    """Convert a SimulationState to the ML feature dictionary.

    The returned dict is compatible with ``ml.features.extractor.extract_features``.

    Parameters
    ----------
    state : SimulationState
        Current simulation state.

    Returns
    -------
    dict
        Keys: heart_rate, systolic_bp, diastolic_bp, edv, esv
    """
    return {
        "heart_rate":   float(state.heart_rate_bpm),
        "systolic_bp":  float(state.metrics.systolic_bp_mmhg),
        "diastolic_bp": float(state.metrics.diastolic_bp_mmhg),
        "edv":          float(state.metrics.end_diastolic_volume_ml),
        "esv":          float(state.metrics.end_systolic_volume_ml),
    }


def state_to_rag_dict(state: SimulationState) -> dict:
    """Convert a SimulationState to the RAG-compatible observation dictionary.

    The RAG layer reads from this dictionary; it must never write back to
    the simulation state.

    Parameters
    ----------
    state : SimulationState
        Current simulation state.

    Returns
    -------
    dict
        All fields required by the RAG observation contract.
    """
    lv = state.chambers["left_ventricle"]
    return {
        "time":              float(state.time_s),
        "heart_rate":        float(state.heart_rate_bpm),
        "systolic_bp":       float(state.metrics.systolic_bp_mmhg),
        "diastolic_bp":      float(state.metrics.diastolic_bp_mmhg),
        "map":               float(state.metrics.map_mmhg),
        "cardiac_output":    float(state.metrics.cardiac_output_l_min),
        "stroke_volume":     float(state.metrics.stroke_volume_ml),
        "edv":               float(state.metrics.end_diastolic_volume_ml),
        "esv":               float(state.metrics.end_systolic_volume_ml),
        "lv_pressure":       float(lv.pressure_mmhg),
        "aortic_pressure":   float(state.circulation.aortic_pressure_mmhg),
        "blood_volume":      float(state.circulation.blood_volume_l),
        "contractility":     float(state.contractility),
        "svr":               float(state.circulation.systemic_vascular_resistance),
        "valves": {
            name: {
                "is_open":       v.is_open,
                "flow_ml_per_s": float(v.flow_ml_per_s),
            }
            for name, v in state.valves.items()
        },
    }
