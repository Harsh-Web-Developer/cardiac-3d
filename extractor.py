"""
CARDIA ML feature extraction.

The real CARDIA simulator will eventually provide a SimulationState.
This module converts that state into the five ML inputs.
"""


FEATURES = [
    "heart_rate",
    "systolic_bp",
    "diastolic_bp",
    "edv",
    "esv",
]


def extract_features(state):
    """
    Extract the five official ML features from a simulation state.

    Parameters
    ----------
    state : dict
        Dictionary containing CARDIA observable cardiovascular values.

    Returns
    -------
    list[float]
        Features in the exact order expected by the ML model.
    """

    return [
        float(state["heart_rate"]),
        float(state["systolic_bp"]),
        float(state["diastolic_bp"]),
        float(state["edv"]),
        float(state["esv"]),
    ]


def feature_names():
    """Return the official feature order."""

    return FEATURES.copy()