from pathlib import Path
import sys


# ============================================================
# MAKE RAG PACKAGE IMPORTABLE
# ============================================================

RAG_DIR = Path(__file__).resolve().parent.parent

if str(RAG_DIR) not in sys.path:
    sys.path.insert(0, str(RAG_DIR))


# ============================================================
# CARDIA IMPORTS
# ============================================================

from retrieval.retriever import retrieve
from answer.answer_engine import create_grounded_response


# ============================================================
# TEST SIMULATION STATE
# ============================================================

SIMULATION_STATE = {
    "time": 12.42,
    "heart_rate": 82,
    "systolic_bp": 118,
    "diastolic_bp": 76,
    "map": 90,
    "cardiac_output": 5.2,
    "stroke_volume": 63,
    "edv": 128,
    "esv": 65,
    "lv_pressure": 115,
    "aortic_pressure": 90,
    "blood_volume": 100,
    "contractility": 100,
    "svr": 100,
    "valves": {
        "mitral": False,
        "aortic": True,
        "tricuspid": False,
        "pulmonary": True,
    },
}


# ============================================================
# TEST CASES
# ============================================================

TEST_CASES = [
    {
        "question": "What is stroke volume?",
        "expected_mode": "physiology",
        "topic": "cardiac_output",
    },
    {
        "question": (
            "What does the current simulation show "
            "about cardiac output?"
        ),
        "expected_mode": "simulation",
        "topic": "cardiac_output",
    },
    {
        "question": (
            "What happens if the AV node stops working?"
        ),
        "expected_mode": "what_if",
        "topic": "cardiac_conduction",
    },
]


# ============================================================
# TEST HEADER
# ============================================================

print()
print("=" * 70)
print("CARDIA ANSWER MODE INTEGRATION TEST")
print("=" * 70)


# ============================================================
# RUN TEST CASES
# ============================================================

for index, test_case in enumerate(
    TEST_CASES,
    start=1,
):

    question = test_case["question"]
    expected_mode = test_case["expected_mode"]
    topic = test_case["topic"]

    print()
    print("=" * 70)
    print(f"TEST CASE #{index}")
    print("=" * 70)

    print()
    print(f"Question:")
    print(question)

    print()
    print("Retrieving evidence...")

    evidence = retrieve(
        question=question,
        top_k=5,
        topic=topic,
    )

    print(
        f"Evidence retrieved: {len(evidence)}"
    )

    print()
    print("Building grounded response...")

    response = create_grounded_response(
        question=question,
        retrieved_evidence=evidence,
        simulation_state=SIMULATION_STATE,
    )

    print()
    print(f"Detected mode: {response['answer_mode']}")
    print(f"Expected mode: {expected_mode}")

    print()
    print("Mode instructions:")

    for instruction in response[
        "mode_instructions"
    ]:
        print(
            f"- {instruction}"
        )

    print()
    print("Sources:")
    
    for source in response["sources"]:
        print(
            f"- {source['title']} "
            f"({source['chapter']})"
        )

    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    assert (
        response["answer_mode"]
        == expected_mode
    )

    assert (
        response["answer_status"]
        == "grounded_context_ready"
    )

    assert len(
        response["evidence"]
    ) > 0

    assert (
        response["simulation_observation"][
            "available"
        ]
        is True
    )

    assert (
        response["simulation_observation"][
            "valid"
        ]
        is True
    )

    assert (
        len(
            response["sources"]
        )
        > 0
    )

    assert (
        len(
            response["mode_instructions"]
        )
        > 0
    )

    print()
    print("RESULT: PASS")


# ============================================================
# FINAL RESULT
# ============================================================

print()
print("=" * 70)
print("FINAL VALIDATION")
print("=" * 70)

print()
print("Physiology mode: PASS")
print("Simulation mode: PASS")
print("What-if mode: PASS")

print()
print("=" * 70)
print("ALL ANSWER MODE TESTS PASSED")
print("=" * 70)
print()