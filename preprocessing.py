"""
CARDIA ML dataset preprocessing.
"""

from pathlib import Path

import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


# ---------------------------------------------------------------------------
# Official CARDIA ML input/output contract
# ---------------------------------------------------------------------------

FEATURES = [
    "heart_rate",
    "systolic_bp",
    "diastolic_bp",
    "edv",
    "esv",
]

TARGETS = [
    "blood_volume",
    "contractility",
    "svr",
]


DATA_FILE = (
    Path(__file__).resolve().parent
    / "cardia_synthetic_dataset.csv"
)


SCALER_DIR = Path(__file__).resolve().parent.parent / "artifacts"

FEATURE_SCALER_FILE = SCALER_DIR / "feature_scaler.pkl"
TARGET_SCALER_FILE = SCALER_DIR / "target_scaler.pkl"


def load_dataset():
    """Load the generated CARDIA dataset."""

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}\n"
            "Run dataset_generator.py first."
        )

    return pd.read_csv(DATA_FILE)


def split_dataset(
    test_size=0.10,
    validation_size=0.10,
    random_state=42,
):
    """
    Split the dataset into:

        80% training
        10% validation
        10% test
    """

    df = load_dataset()

    X = df[FEATURES].values
    y = df[TARGETS].values

    # First split off the final 10% test set
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
    )

    # validation_size is relative to the remaining 90%
    relative_validation_size = (
        validation_size / (1.0 - test_size)
    )

    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val,
        y_train_val,
        test_size=relative_validation_size,
        random_state=random_state,
    )

    return (
        X_train,
        X_val,
        X_test,
        y_train,
        y_val,
        y_test,
    )


def scale_data(
    X_train,
    X_val,
    X_test,
    y_train,
    y_val,
    y_test,
):
    """
    Standardize input features and targets.

    Scalers are fitted ONLY on training data.
    """

    feature_scaler = StandardScaler()
    target_scaler = StandardScaler()

    X_train_scaled = feature_scaler.fit_transform(X_train)
    X_val_scaled = feature_scaler.transform(X_val)
    X_test_scaled = feature_scaler.transform(X_test)

    y_train_scaled = target_scaler.fit_transform(y_train)
    y_val_scaled = target_scaler.transform(y_val)
    y_test_scaled = target_scaler.transform(y_test)

    return (
        X_train_scaled,
        X_val_scaled,
        X_test_scaled,
        y_train_scaled,
        y_val_scaled,
        y_test_scaled,
        feature_scaler,
        target_scaler,
    )


def prepare_data():
    """Load, split and scale the complete dataset."""

    data = split_dataset()

    return scale_data(*data)


def save_scalers(feature_scaler, target_scaler):
    """Save fitted scalers for inference."""

    SCALER_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        feature_scaler,
        FEATURE_SCALER_FILE,
    )

    joblib.dump(
        target_scaler,
        TARGET_SCALER_FILE,
    )


if __name__ == "__main__":
    data = prepare_data()

    (
        X_train,
        X_val,
        X_test,
        y_train,
        y_val,
        y_test,
        feature_scaler,
        target_scaler,
    ) = data

    save_scalers(
        feature_scaler,
        target_scaler,
    )

    print("Dataset preprocessing complete.")
    print(f"Training samples:   {len(X_train):,}")
    print(f"Validation samples: {len(X_val):,}")
    print(f"Test samples:       {len(X_test):,}")
    print(f"Input features:     {len(FEATURES)}")
    print(f"Output targets:     {len(TARGETS)}")