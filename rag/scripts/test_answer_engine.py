from pathlib import Path
import sys
from pprint import pprint


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
# TEST QUESTION
# ============================================================

QUESTION = "What happens if the AV node stops working?"


# ============================================================
# TEST SIMULATION STATE
# ============================================================
#
# This is ONLY test data.
#
# It represents the agreed CARDIA SimulationState contract.
# It does NOT modify the real simulation.
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
# RETRIEVE EVIDENCE
# ============================================================

print()
print("=" * 70)
print("CARDIA ANSWER ENGINE TEST")
print("=" * 70)

print()
print(f"Question: {QUESTION}")

print()
print("Retrieving cardiac conduction evidence...")

evidence = retrieve(
    question=QUESTION,
    top_k=5,
    topic="cardiac_conduction",
)


print()
print(
    f"Evidence retrieved: {len(evidence)}"
)


# ============================================================
# BUILD GROUNDED RESPONSE
# ============================================================

print()
print("Building grounded response context...")

response = create_grounded_response(
    question=QUESTION,
    retrieved_evidence=evidence,
    simulation_state=SIMULATION_STATE,
)


# ============================================================
# DISPLAY RESULT
# ============================================================

print()
print("=" * 70)
print("ANSWER ENGINE RESULT")
print("=" * 70)

print()
print("Answer Status:")
print(
    response["answer_status"]
)


print()
print("Question:")
print(
    response["question"]
)


# ============================================================
# SIMULATION OBSERVATION
# ============================================================

print()
print("SIMULATION OBSERVATION")
print("-" * 70)

simulation = response[
    "simulation_observation"
]

print(
    f"Available: {simulation['available']}"
)

print(
    f"Valid: {simulation['valid']}"
)

print(
    f"Missing fields: {simulation['missing_fields']}"
)

print()
print("Simulation values:")

pprint(
    simulation["values"]
)


# ============================================================
# SOURCES
# ============================================================

print()
print("SOURCES")
print("-" * 70)

for index, source in enumerate(
    response["sources"],
    start=1
):

    print(
        f"{index}. {source['title']}"
    )

    print(
        f"   Source: {source['source_title']}"
    )

    print(
        f"   Type: {source['source_type']}"
    )

    print(
        f"   Authority: {source['authority_level']}"
    )

    print(
        f"   Chapter: {source['chapter']}"
    )


# ============================================================
# GROUNDING RULES
# ============================================================

print()
print("GROUNDING RULES")
print("-" * 70)

for index, rule in enumerate(
    response["grounding_rules"],
    start=1
):

    print(
        f"{index}. {rule}"
    )


# ============================================================
# VALIDATION
# ============================================================

print()
print("=" * 70)
print("VALIDATION")
print("=" * 70)

assert response["question"] == QUESTION

assert (
    response["answer_status"]
    == "grounded_context_ready"
)

assert len(
    response["evidence"]
) > 0

assert (
    response["simulation_observation"]["available"]
    is True
)

assert (
    response["simulation_observation"]["valid"]
    is True
)

assert (
    len(
        response["simulation_observation"][
            "missing_fields"
        ]
    )
    == 0
)

assert len(
    response["sources"]
) > 0

required_provenance = [
    "source",
    "source_title",
    "source_type",
    "authority_level",
    "author",
    "chapter",
    "page",
]

for evidence_item in response["evidence"]:

    for field in required_provenance:

        assert field in evidence_item


print()
print("Question: PASS")
print("Evidence retrieval: PASS")
print("Simulation observation: PASS")
print("Simulation validation: PASS")
print("Provenance: PASS")
print("Grounding rules: PASS")

print()
print("=" * 70)
print("ALL ANSWER ENGINE TESTS PASSED")
print("=" * 70)
print()