"""
Evaluate the trained CARDIA MLP.
"""

from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.data.preprocessing import (
    prepare_data,
)
from ml.models.mlp import CardiaMLP


MODEL_FILE = (
    Path(__file__).resolve().parent.parent
    / "artifacts"
    / "cardia_mlp.pt"
)


TARGET_NAMES = [
    "Blood Volume (L)",
    "Contractility",
    "SVR",
]


def evaluate():
    """Evaluate the trained model on the held-out test set."""

    (
        X_train,
        X_val,
        X_test,
        y_train,
        y_val,
        y_test,
        feature_scaler,
        target_scaler,
    ) = prepare_data()

    if not MODEL_FILE.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_FILE}\n"
            "Run train.py first."
        )

    model = CardiaMLP()

    model.load_state_dict(
        torch.load(
            MODEL_FILE,
            map_location="cpu",
        )
    )

    model.eval()

    X_test_tensor = torch.tensor(
        X_test,
        dtype=torch.float32,
    )

    with torch.no_grad():
        predictions_scaled = model(
            X_test_tensor
        ).numpy()

    # Convert predictions back to original units
    predictions = target_scaler.inverse_transform(
        predictions_scaled
    )

    actual = target_scaler.inverse_transform(
        y_test
    )

    print("\nCARDIA ML Evaluation")
    print("=" * 50)

    for index, target_name in enumerate(TARGET_NAMES):

        mae = mean_absolute_error(
            actual[:, index],
            predictions[:, index],
        )

        rmse = np.sqrt(
            mean_squared_error(
                actual[:, index],
                predictions[:, index],
            )
        )

        print(f"\n{target_name}")
        print(f"MAE:  {mae:.4f}")
        print(f"RMSE: {rmse:.4f}")

    print("\nExample predictions")
    print("=" * 50)

    for index in range(min(5, len(actual))):

        print(
            f"\nPatient {index + 1}"
        )

        print(
            f"Blood Volume: "
            f"{actual[index, 0]:.2f} L "
            f"→ "
            f"{predictions[index, 0]:.2f} L"
        )

        print(
            f"Contractility: "
            f"{actual[index, 1]:.3f} "
            f"→ "
            f"{predictions[index, 1]:.3f}"
        )

        print(
            f"SVR: "
            f"{actual[index, 2]:.3f} "
            f"→ "
            f"{predictions[index, 2]:.3f}"
        )


if __name__ == "__main__":
    evaluate()