"""
Train the CARDIA PyTorch MLP.
"""

from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

from ml.data.preprocessing import (
    prepare_data,
    save_scalers,
)
from ml.models.mlp import CardiaMLP


# ---------------------------------------------------------------------------
# Training configuration
# ---------------------------------------------------------------------------

RANDOM_SEED = 42

BATCH_SIZE = 64
EPOCHS = 50
LEARNING_RATE = 0.001

MODEL_DIR = (
    Path(__file__).resolve().parent.parent
    / "artifacts"
)

MODEL_FILE = MODEL_DIR / "cardia_mlp.pt"


def set_seed():
    """Make training more reproducible."""

    np.random.seed(RANDOM_SEED)
    torch.manual_seed(RANDOM_SEED)


def train():
    """Train the CARDIA MLP."""

    set_seed()

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

    # Save scalers for later inference
    save_scalers(
        feature_scaler,
        target_scaler,
    )

    # Convert NumPy arrays to PyTorch tensors
    X_train_tensor = torch.tensor(
        X_train,
        dtype=torch.float32,
    )

    y_train_tensor = torch.tensor(
        y_train,
        dtype=torch.float32,
    )

    X_val_tensor = torch.tensor(
        X_val,
        dtype=torch.float32,
    )

    y_val_tensor = torch.tensor(
        y_val,
        dtype=torch.float32,
    )

    train_dataset = TensorDataset(
        X_train_tensor,
        y_train_tensor,
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
    )

    model = CardiaMLP()

    criterion = torch.nn.MSELoss()

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE,
    )

    best_validation_loss = float("inf")
    best_state = None

    for epoch in range(EPOCHS):

        # ---------------------------------------------------------------
        # Training
        # ---------------------------------------------------------------

        model.train()

        training_loss = 0.0

        for X_batch, y_batch in train_loader:

            optimizer.zero_grad()

            predictions = model(X_batch)

            loss = criterion(
                predictions,
                y_batch,
            )

            loss.backward()
            optimizer.step()

            training_loss += loss.item()

        training_loss /= len(train_loader)

        # ---------------------------------------------------------------
        # Validation
        # ---------------------------------------------------------------

        model.eval()

        with torch.no_grad():
            validation_predictions = model(
                X_val_tensor
            )

            validation_loss = criterion(
                validation_predictions,
                y_val_tensor,
            ).item()

        # Keep the best model
        if validation_loss < best_validation_loss:
            best_validation_loss = validation_loss

            best_state = {
                key: value.cpu().clone()
                for key, value in model.state_dict().items()
            }

        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(
                f"Epoch {epoch + 1:03d}/{EPOCHS} | "
                f"Train Loss: {training_loss:.6f} | "
                f"Validation Loss: {validation_loss:.6f}"
            )

    # Restore best model
    if best_state is not None:
        model.load_state_dict(best_state)

    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    torch.save(
        model.state_dict(),
        MODEL_FILE,
    )

    print("\nTraining complete.")
    print(f"Model saved to: {MODEL_FILE}")


if __name__ == "__main__":
    train()