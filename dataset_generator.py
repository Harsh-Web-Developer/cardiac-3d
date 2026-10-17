"""
Generate the CARDIA synthetic ML training dataset.
"""

import csv
from pathlib import Path

from patient_generator import generate_patient


# Number of virtual patients
NUM_PATIENTS = 10_000

OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = OUTPUT_DIR / "cardia_synthetic_dataset.csv"


# Official CARDIA ML input contract
FEATURES = [
    "heart_rate",
    "systolic_bp",
    "diastolic_bp",
    "edv",
    "esv",
]


# Official CARDIA ML output contract
TARGETS = [
    "blood_volume",
    "contractility",
    "svr",
]


def generate_dataset():
    """Generate and save the synthetic patient dataset."""

    fieldnames = FEATURES + TARGETS

    with open(
        OUTPUT_FILE,
        "w",
        newline="",
        encoding="utf-8",
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
        )

        writer.writeheader()

        for _ in range(NUM_PATIENTS):
            patient = generate_patient()

            row = {
                field: patient[field]
                for field in fieldnames
            }

            writer.writerow(row)

    print(f"Generated {NUM_PATIENTS:,} synthetic patients.")
    print(f"Dataset saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    generate_dataset()