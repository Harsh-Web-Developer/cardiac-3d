from typing import Any


def calculate_confidence(
    evidence: list[dict[str, Any]],
) -> float:
    """
    Calculate answer confidence from retrieval scores.

    This represents how strongly the retrieved evidence
    supports the answer. It is NOT clinical certainty.
    """

    if not evidence:
        return 0.0

    scores = []

    for item in evidence:
        score = item.get("score")

        if isinstance(score, (int, float)):
            scores.append(float(score))

    if not scores:
        return 0.0

    # Use the strongest retrieved evidence as the main signal.
    best_score = max(scores)

    # Clamp to a valid confidence range.
    confidence = max(
        0.0,
        min(1.0, best_score),
    )

    return round(confidence, 3)


def confidence_level(
    confidence: float,
) -> str:
    """
    Convert numerical retrieval confidence into
    a simple human-readable quality level.
    """

    if confidence >= 0.80:
        return "high"

    if confidence >= 0.60:
        return "medium"

    return "low"