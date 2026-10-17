"""
Simple baseline model for CARDIA.

This is not the primary model.
The PyTorch MLP is the official model.

The baseline is useful for checking whether the MLP
actually provides useful learning.
"""

from sklearn.ensemble import RandomForestRegressor


def create_baseline_model():
    """Create a lightweight Random Forest baseline."""

    return RandomForestRegressor(
        n_estimators=50,
        max_depth=12,
        random_state=42,
        n_jobs=-1,
    )


if __name__ == "__main__":
    model = create_baseline_model()

    print("CARDIA baseline model:")
    print(model)