"""
Temporary synthetic CARDIA patient generator.

This generator is only used until the real CARDIA simulator is available.

ML inputs:
    - heart_rate
    - systolic_bp
    - diastolic_bp
    - edv
    - esv

ML targets:
    - blood_volume       (litres)
    - contractility      (normalized around 1.0)
    - svr                (normalized around 1.0)
"""

import random


# ---------------------------------------------------------------------------
# Hidden physiological parameter ranges
# ---------------------------------------------------------------------------

BLOOD_VOLUME_MIN = 3.5
BLOOD_VOLUME_MAX = 5.5

CONTRACTILITY_MIN = 0.70
CONTRACTILITY_MAX = 1.30

SVR_MIN = 0.70
SVR_MAX = 1.30


def generate_patient():
    """
    Generate one synthetic CARDIA patient.

    Hidden physiological parameters are generated first.
    Observable cardiovascular measurements are then generated
    from those hidden parameters.

    This is a temporary mock generator.
    The real CARDIA simulator will eventually replace it.
    """

    # -----------------------------------------------------------------------
    # Hidden physiological state / ML targets
    # -----------------------------------------------------------------------

    blood_volume = random.uniform(
        BLOOD_VOLUME_MIN,
        BLOOD_VOLUME_MAX,
    )

    contractility = random.uniform(
        CONTRACTILITY_MIN,
        CONTRACTILITY_MAX,
    )

    svr = random.uniform(
        SVR_MIN,
        SVR_MAX,
    )

    # Deviations from a normal/reference state
    blood_volume_effect = blood_volume - 4.5
    contractility_effect = contractility - 1.0
    svr_effect = svr - 1.0

    # -----------------------------------------------------------------------
    # Observable cardiovascular measurements
    # -----------------------------------------------------------------------

    # Heart rate
    heart_rate = (
        75
        - 8.0 * blood_volume_effect
        - 20.0 * contractility_effect
        + 18.0 * svr_effect
        + random.gauss(0, 2.0)
    )

    # EDV is strongly influenced by blood volume / preload
    edv = (
        120
        + 25.0 * blood_volume_effect
        + random.gauss(0, 3.0)
    )

    # Ejection fraction is influenced by contractility
    ejection_fraction = (
        0.55
        + 0.50 * contractility_effect
    )

    # Keep the temporary generator within a reasonable range
    ejection_fraction = max(
        0.35,
        min(0.75, ejection_fraction),
    )

    # ESV follows from EDV and ejection fraction
    esv = (
        edv * (1.0 - ejection_fraction)
        + random.gauss(0, 2.0)
    )

    # Stroke volume
    stroke_volume = edv - esv

    # Mean arterial pressure
    mean_arterial_pressure = (
        90
        + 8.0 * blood_volume_effect
        + 15.0 * contractility_effect
        + 35.0 * svr_effect
        + random.gauss(0, 2.0)
    )

    # Pulse pressure
    pulse_pressure = (
        40
        + 15.0 * contractility_effect
        + random.gauss(0, 2.0)
    )

    # Systolic and diastolic pressure
    systolic_bp = (
        mean_arterial_pressure
        + pulse_pressure / 2.0
        + random.gauss(0, 1.5)
    )

    diastolic_bp = (
        mean_arterial_pressure
        - pulse_pressure / 2.0
        + random.gauss(0, 1.5)
    )

    # Keep values within reasonable prototype ranges
    heart_rate = max(40.0, min(160.0, heart_rate))
    systolic_bp = max(70.0, min(180.0, systolic_bp))
    diastolic_bp = max(40.0, min(120.0, diastolic_bp))
    edv = max(60.0, min(220.0, edv))
    esv = max(25.0, min(edv - 5.0, esv))

    return {
        # ---------------------------------------------------------------
        # Observable ML inputs
        # ---------------------------------------------------------------
        "heart_rate": heart_rate,
        "systolic_bp": systolic_bp,
        "diastolic_bp": diastolic_bp,
        "edv": edv,
        "esv": esv,

        # ---------------------------------------------------------------
        # Hidden ML targets
        # ---------------------------------------------------------------
        "blood_volume": blood_volume,
        "contractility": contractility,
        "svr": svr,
    }


if __name__ == "__main__":
    patient = generate_patient()

    print("Synthetic CARDIA Patient")
    print("-" * 30)

    print("\nObservable inputs:")
    print(f"Heart Rate:       {patient['heart_rate']:.2f} bpm")
    print(f"Systolic BP:      {patient['systolic_bp']:.2f} mmHg")
    print(f"Diastolic BP:     {patient['diastolic_bp']:.2f} mmHg")
    print(f"EDV:              {patient['edv']:.2f} mL")
    print(f"ESV:              {patient['esv']:.2f} mL")

    print("\nHidden targets:")
    print(f"Blood Volume:     {patient['blood_volume']:.2f} L")
    print(f"Contractility:    {patient['contractility']:.3f}")
    print(f"SVR:              {patient['svr']:.3f}")