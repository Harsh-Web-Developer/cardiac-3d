from ml.data.patient_generator import generate_patient


def test_patient_contains_required_values():

    patient = generate_patient()

    required = [
        "heart_rate",
        "systolic_bp",
        "diastolic_bp",
        "edv",
        "esv",
        "blood_volume",
        "contractility",
        "svr",
    ]

    for field in required:
        assert field in patient


def test_target_ranges():

    patient = generate_patient()

    assert 3.5 <= patient["blood_volume"] <= 5.5
    assert 0.70 <= patient["contractility"] <= 1.30
    assert 0.70 <= patient["svr"] <= 1.30


def test_observable_values_are_positive():

    patient = generate_patient()

    assert patient["heart_rate"] > 0
    assert patient["systolic_bp"] > 0
    assert patient["diastolic_bp"] > 0
    assert patient["edv"] > 0
    assert patient["esv"] > 0