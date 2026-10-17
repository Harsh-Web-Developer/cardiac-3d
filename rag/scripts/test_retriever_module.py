import sys
from pathlib import Path


# ============================================================
# PROJECT PATH
# ============================================================

RAG_DIR = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(RAG_DIR))


from retrieval.retriever import retrieve


# ============================================================
# TEST
# ============================================================

def main():

    question = "What happens if the AV node stops working?"

    print()
    print("=" * 70)
    print("CARDIA RETRIEVER + PROVENANCE TEST")
    print("=" * 70)

    print()
    print(f"Question: {question}")

    print()
    print("Filter:")
    print("Topic: cardiac_conduction")

    print()
    print("Retrieving evidence...")

    results = retrieve(
        question=question,
        top_k=5,
        topic="cardiac_conduction",
    )

    print()
    print("=" * 70)
    print("FILTERED RETRIEVED EVIDENCE")
    print("=" * 70)

    for index, result in enumerate(results, start=1):

        print()
        print(f"RESULT #{index}")
        print("-" * 70)

        # ----------------------------------------------------
        # Retrieval information
        # ----------------------------------------------------

        print(f"Score: {result['score']:.4f}")
        print(f"Chunk ID: {result['chunk_id']}")
        print(f"Title: {result['title']}")

        # ----------------------------------------------------
        # Source provenance
        # ----------------------------------------------------

        print()
        print("SOURCE PROVENANCE")
        print(f"Source: {result['source']}")
        print(f"Source Title: {result['source_title']}")
        print(f"Source Type: {result['source_type']}")
        print(f"Authority Level: {result['authority_level']}")
        print(f"Author: {result['author']}")
        print(f"Chapter: {result['chapter']}")
        print(f"Page: {result['page']}")

        # ----------------------------------------------------
        # Physiological metadata
        # ----------------------------------------------------

        print()
        print("PHYSIOLOGICAL METADATA")
        print(f"Topic: {result['topic']}")
        print(f"Organ: {result['organ']}")
        print(f"Mechanism: {result['mechanism']}")
        print(f"Equation: {result['equation']}")

        # ----------------------------------------------------
        # Retrieved evidence
        # ----------------------------------------------------

        print()
        print("Text:")
        print(result["text"])

    # ========================================================
    # BASIC VALIDATION
    # ========================================================

    print()
    print("=" * 70)
    print("PROVENANCE VALIDATION")
    print("=" * 70)

    required_fields = [
        "source",
        "source_title",
        "source_type",
        "authority_level",
        "author",
        "chapter",
        "topic",
        "organ",
        "mechanism",
        "equation",
        "page",
    ]

    all_valid = True

    for field in required_fields:

        present = all(
            field in result
            for result in results
        )

        status = "PASS" if present else "FAIL"

        print(f"{field}: {status}")

        if not present:
            all_valid = False

    print()

    if all_valid:
        print("ALL PROVENANCE FIELDS VERIFIED.")
    else:
        print("PROVENANCE VALIDATION FAILED.")

    print()
    print("=" * 70)
    print("RETRIEVER + PROVENANCE TEST COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()