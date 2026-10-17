"""ML Inference API Routes.

Connects the existing CardiaPredictor to the live SimulationState.
Never modifies the model or trained weights.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ml.inference.predictor import CardiaPredictor
from backend.services.sim_service import sim_service

router = APIRouter(prefix="/api/ml", tags=["ML"])

# Initialize predictor once
try:
    predictor = CardiaPredictor()
except Exception as err:
    print(f"Warning: Could not initialize CardiaPredictor: {err}")
    predictor = None


class PredictRequest(BaseModel):
    # If not provided, will be extracted from current live SimulationState
    heart_rate: float | None = None
    systolic_bp: float | None = None
    diastolic_bp: float | None = None
    edv: float | None = None
    esv: float | None = None


@router.post("/predict")
def predict_parameters(req: PredictRequest | None = None):
    """Run ML inference to estimate hidden physiological parameters from observables."""
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail="ML Inference model is unavailable on this host."
        )

    # Obtain features from live SimulationState or overrides
    live_features = sim_service.get_ml_features()
    
    hr = req.heart_rate if (req and req.heart_rate is not None) else live_features["heart_rate"]
    sbp = req.systolic_bp if (req and req.systolic_bp is not None) else live_features["systolic_bp"]
    dbp = req.diastolic_bp if (req and req.diastolic_bp is not None) else live_features["diastolic_bp"]
    edv = req.edv if (req and req.edv is not None) else live_features["edv"]
    esv = req.esv if (req and req.esv is not None) else live_features["esv"]

    try:
        prediction = predictor.predict(
            heart_rate=hr,
            systolic_bp=sbp,
            diastolic_bp=dbp,
            edv=edv,
            esv=esv,
        )

        return {
            "status": "success",
            "category": "INFERRED PHYSIOLOGICAL PARAMETERS",
            "inputs": {
                "heart_rate": round(hr, 1),
                "systolic_bp": round(sbp, 1),
                "diastolic_bp": round(dbp, 1),
                "edv": round(edv, 1),
                "esv": round(esv, 1),
            },
            "inferred_parameters": {
                "blood_volume_l": round(prediction["blood_volume"], 2),
                "contractility": round(prediction["contractility"], 3),
                "systemic_vascular_resistance": round(prediction["svr"], 3),
            },
            "current_simulation_parameters": {
                "blood_volume_l": round(sim_service.state.circulation.blood_volume_l, 2),
                "contractility": round(sim_service.state.contractility, 3),
                "systemic_vascular_resistance": round(sim_service.state.circulation.systemic_vascular_resistance, 3),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML inference error: {str(e)}")
