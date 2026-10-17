from ml.features.extractor import (
    extract_features,
    feature_names,
)


def test_feature_order():

    state = {
        "heart_rate": 95,
        "systolic_bp": 98,
        "diastolic_bp": 62,
        "edv": 100,
        "esv": 50,
    }

    features = extract_features(state)

    assert features == [
        95.0,
        98.0,
        62.0,
        100.0,
        50.0,
    ]


def test_feature_names():

    assert feature_names() == [
        "heart_rate",
        "systolic_bp",
        "diastolic_bp",
        "edv",
        "esv",
    ]