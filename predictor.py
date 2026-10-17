"""
CARDIA ML inference.

Converts observable cardiovascular measurements
into hidden physiological state estimates.
"""

from pathlib import Path

import joblib
import numpy as np
import torch

from ml.models.mlp import CardiaMLP


ARTIFACT_DIR = (
    Path(__file__).resolve().parent.parent
    / "artifacts"
)

MODEL_FILE = ARTIFACT_DIR / "cardia_mlp.pt"
FEATURE_SCALER_FILE = ARTIFACT_DIR / "feature_scaler.pkl"
TARGET_SCALER_FILE = ARTIFACT_DIR / "target_scaler.pkl"


class CardiaPredictor:
    """CARDIA hidden physiological state predictor."""

    def __init__(self):
        if not MODEL_FILE.exists():
            raise FileNotFoundError(
                "ML model not found. "
                "Run ml/training/train.py first."
            )

        if not FEATURE_SCALER_FILE.exists():
            raise FileNotFoundError(
                "Feature scaler not found. "
                "Run ml/training/train.py first."
            )

        if not TARGET_SCALER_FILE.exists():
            raise FileNotFoundError(
                "Target scaler not found. "
                "Run ml/training/train.py first."
            )

        self.feature_scaler = joblib.load(
            FEATURE_SCALER_FILE
        )

        self.target_scaler = joblib.load(
            TARGET_SCALER_FILE
        )

        self.model = CardiaMLP()

        self.model.load_state_dict(
            torch.load(
                MODEL_FILE,
                map_location="cpu",
            )
        )

        self.model.eval()

    def predict(
        self,
        heart_rate,
        systolic_bp,
        diastolic_bp,
        edv,
        esv,
    ):
        """
        Estimate hidden physiological parameters.

        Returns
        -------
        dict
            blood_volume in litres,
            contractility around 1.0,
            SVR around 1.0.
        """

        features = np.array(
            [[
                heart_rate,
                systolic_bp,
                diastolic_bp,
                edv,
                esv,
            ]],
            dtype=np.float32,
        )

        features_scaled = self.feature_scaler.transform(
            features
        )

        features_tensor = torch.tensor(
            features_scaled,
            dtype=torch.float32,
        )

        with torch.no_grad():
            prediction_scaled = self.model(
                features_tensor
            ).numpy()

        prediction = self.target_scaler.inverse_transform(
            prediction_scaled
        )[0]

        return {
            "blood_volume": float(prediction[0]),
            "contractility": float(prediction[1]),
            "svr": float(prediction[2]),
        }


if __name__ == "__main__":

    predictor = CardiaPredictor()

    result = predictor.predict(
        heart_rate=95,
        systolic_bp=98,
        diastolic_bp=62,
        edv=100,
        esv=50,
    )

    print("CARDIA ML Prediction")
    print("-" * 30)

    print(
        f"Blood Volume:  {result['blood_volume']:.2f} L"
    )

    print(
        f"Contractility: {result['contractility']:.3f}"
    )

    print(
        f"SVR:           {result['svr']:.3f}"
    )