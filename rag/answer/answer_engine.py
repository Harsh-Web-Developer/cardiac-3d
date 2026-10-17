from typing import Any, Dict, List, Optional


# ============================================================
# CARDIA ANSWER ENGINE
# ============================================================
#
# Purpose:
#
#   Student Question
#          +
#   Retrieved Physiological Evidence
#          +
#   Optional Live SimulationState
#          ↓
#   Grounded Answer Context
#
# The engine supports three answer modes:
#
#   1. physiology
#   2. simulation
#   3. what_if
#
# IMPORTANT:
#
# This layer does NOT modify the simulation.
# This layer does NOT invent simulation variables.
# This layer does NOT claim hypothetical outcomes are
# simulation results.
#
# An LLM can be connected later using this structured context.
# ============================================================


# ============================================================
# REQUIRED SIMULATION VARIABLES
# ============================================================

EXPECTED_SIMULATION_FIELDS = [
    "time",
    "heart_rate",
    "systolic_bp",
    "diastolic_bp",
    "map",
    "cardiac_output",
    "stroke_volume",
    "edv",
    "esv",
    "lv_pressure",
    "aortic_pressure",
    "blood_volume",
    "contractility",
    "svr",
    "valves",
]


# ============================================================
# VALIDATE SIMULATION STATE
# ============================================================

def validate_simulation_state(
    simulation_state: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Validate an optional CARDIA SimulationState.

    This function only observes and validates the supplied
    state. It never changes it.
    """

    if simulation_state is None:
        return {
            "available": False,
            "valid": False,
            "missing_fields": EXPECTED_SIMULATION_FIELDS.copy(),
            "message": (
                "No live CARDIA simulation state was supplied."
            ),
        }

    if not isinstance(simulation_state, dict):
        raise TypeError(
            "simulation_state must be a dictionary."
        )

    missing_fields = [
        field
        for field in EXPECTED_SIMULATION_FIELDS
        if field not in simulation_state
    ]

    return {
        "available": True,
        "valid": len(missing_fields) == 0,
        "missing_fields": missing_fields,
        "message": (
            "Live CARDIA simulation state available."
            if not missing_fields
            else (
                "Simulation state is missing expected "
                "CARDIA fields."
            )
        ),
    }


# ============================================================
# NORMALIZE RETRIEVED EVIDENCE
# ============================================================

def normalize_evidence(
    retrieved_evidence: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Normalize retrieved RAG evidence into a safe,
    predictable structure.
    """

    if not isinstance(
        retrieved_evidence,
        list
    ):
        raise TypeError(
            "retrieved_evidence must be a list."
        )

    normalized = []

    for evidence in retrieved_evidence:

        if not isinstance(evidence, dict):
            continue

        normalized.append(
            {
                "chunk_id": evidence.get("chunk_id"),
                "title": evidence.get("title"),
                "text": evidence.get("text"),
                "score": evidence.get("score"),

                "source": evidence.get("source"),
                "source_title": evidence.get("source_title"),
                "source_type": evidence.get("source_type"),
                "authority_level": evidence.get(
                    "authority_level"
                ),
                "author": evidence.get("author"),
                "chapter": evidence.get("chapter"),
                "page": evidence.get("page"),

                "topic": evidence.get("topic"),
                "organ": evidence.get("organ"),
                "mechanism": evidence.get(
                    "mechanism",
                    []
                ),
                "equation": evidence.get(
                    "equation",
                    []
                ),
            }
        )

    return normalized


# ============================================================
# BUILD SOURCE LIST
# ============================================================

def build_source_list(
    evidence: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Extract source/provenance information from retrieved
    evidence.

    Duplicate sources are removed.
    """

    sources = []
    seen = set()

    for item in evidence:

        source_key = (
            item.get("source"),
            item.get("title"),
            item.get("chapter"),
            item.get("page"),
        )

        if source_key in seen:
            continue

        seen.add(source_key)

        sources.append(
            {
                "source": item.get("source"),
                "source_title": item.get(
                    "source_title"
                ),
                "source_type": item.get(
                    "source_type"
                ),
                "authority_level": item.get(
                    "authority_level"
                ),
                "author": item.get("author"),
                "chapter": item.get("chapter"),
                "page": item.get("page"),
                "title": item.get("title"),
            }
        )

    return sources


# ============================================================
# BUILD SIMULATION OBSERVATIONS
# ============================================================

def build_simulation_observations(
    simulation_state: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Return the supplied simulation state as observations.

    IMPORTANT:
        No new physiological values are calculated here.
        The simulation state is never modified.
    """

    validation = validate_simulation_state(
        simulation_state
    )

    if not validation["available"]:
        return {
            "available": False,
            "valid": False,
            "values": {},
            "missing_fields": validation[
                "missing_fields"
            ],
        }

    return {
        "available": True,
        "valid": validation["valid"],
        "values": simulation_state.copy(),
        "missing_fields": validation[
            "missing_fields"
        ],
    }


# ============================================================
# DETECT ANSWER MODE
# ============================================================

def detect_answer_mode(
    question: str,
    simulation_state: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Determine how CARDIA should approach the question.

    Returns
    -------
    str
        One of:
            physiology
            simulation
            what_if

    This is intentionally simple and deterministic.
    A future LLM/router can replace this without changing
    the rest of the answer engine.
    """

    question_lower = question.lower().strip()

    # --------------------------------------------------------
    # What-if / hypothetical questions
    # --------------------------------------------------------

    what_if_patterns = [
        "what if",
        "what happens if",
        "what would happen if",
        "suppose",
        "if the",
        "if we",
        "increase",
        "decrease",
        "stops working",
        "stopped working",
        "fails",
        "failure",
    ]

    for pattern in what_if_patterns:
        if pattern in question_lower:
            return "what_if"

    # --------------------------------------------------------
    # Questions explicitly asking about CARDIA/current state
    # --------------------------------------------------------

    simulation_patterns = [
        "simulation",
        "simulate",
        "current state",
        "current values",
        "right now",
        "in cardia",
        "in the model",
        "according to the model",
        "what is the current",
        "what does the simulation show",
    ]

    for pattern in simulation_patterns:
        if pattern in question_lower:
            return "simulation"

    # --------------------------------------------------------
    # Default: established physiology
    # --------------------------------------------------------

    return "physiology"


# ============================================================
# BUILD MODE INSTRUCTIONS
# ============================================================

def build_mode_instructions(
    answer_mode: str
) -> List[str]:
    """
    Return grounding instructions specific to the selected
    answer mode.
    """

    if answer_mode == "physiology":

        return [
            (
                "Explain established cardiovascular "
                "physiology using retrieved evidence."
            ),
            (
                "Do not imply that the current simulation "
                "caused or demonstrated the physiological "
                "mechanism unless the evidence supports it."
            ),
            (
                "Use source provenance for supporting "
                "physiological claims."
            ),
        ]

    if answer_mode == "simulation":

        return [
            (
                "Describe the supplied SimulationState "
                "as an observation."
            ),
            (
                "Use only variables actually present in "
                "SimulationState."
            ),
            (
                "Use retrieved physiology to explain the "
                "meaning of observed values."
            ),
            (
                "Do not invent unmodeled simulation outputs."
            ),
        ]

    if answer_mode == "what_if":

        return [
            (
                "Explain the established physiological "
                "consequences of the hypothetical change."
            ),
            (
                "Clearly distinguish physiological "
                "reasoning from an actual CARDIA simulation "
                "result."
            ),
            (
                "Never claim that CARDIA simulated the "
                "hypothetical condition unless a simulation "
                "result was actually supplied."
            ),
            (
                "If the current simulation does not model "
                "the requested change, state that limitation."
            ),
        ]

    raise ValueError(
        f"Unknown answer mode: {answer_mode}"
    )


# ============================================================
# BUILD GROUNDED ANSWER CONTEXT
# ============================================================

def build_answer_context(
    question: str,
    retrieved_evidence: List[Dict[str, Any]],
    simulation_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build the complete grounded context used by the future
    CARDIA answer generator.
    """

    if not question or not question.strip():
        raise ValueError(
            "Question cannot be empty."
        )

    evidence = normalize_evidence(
        retrieved_evidence
    )

    simulation = build_simulation_observations(
        simulation_state
    )

    sources = build_source_list(
        evidence
    )

    answer_mode = detect_answer_mode(
        question=question,
        simulation_state=simulation_state,
    )

    mode_instructions = build_mode_instructions(
        answer_mode
    )

    # --------------------------------------------------------
    # Universal grounding rules
    # --------------------------------------------------------

    grounding_rules = [
        (
            "Use retrieved physiological evidence "
            "as the knowledge basis."
        ),
        (
            "Treat simulation values as observations "
            "from CARDIA."
        ),
        (
            "Never invent simulation variables."
        ),
        (
            "Never modify the supplied simulation state."
        ),
        (
            "Do not present a hypothetical physiological "
            "outcome as a simulation result."
        ),
        (
            "If the simulation does not model a specific "
            "outcome, explicitly state that limitation."
        ),
        (
            "Distinguish established physiology from "
            "hypothetical reasoning."
        ),
        (
            "Use source provenance when presenting "
            "supporting evidence."
        ),
    ]

    # --------------------------------------------------------
    # Final context package
    # --------------------------------------------------------

    return {
        "question": question.strip(),

        "answer_mode": answer_mode,

        "mode_instructions": mode_instructions,

        "evidence": evidence,

        "simulation": simulation,

        "sources": sources,

        "grounding_rules": grounding_rules,
    }


# ============================================================
# SIMPLE STRUCTURED RESPONSE
# ============================================================

def create_grounded_response(
    question: str,
    retrieved_evidence: List[Dict[str, Any]],
    simulation_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Create a structured response package.

    This is intentionally NOT an LLM-generated medical answer.

    It prepares the verified information that a future
    generation model can use.
    """

    context = build_answer_context(
        question=question,
        retrieved_evidence=retrieved_evidence,
        simulation_state=simulation_state,
    )

    return {
        "question": context["question"],

        "answer_status": "grounded_context_ready",

        "answer_mode": context["answer_mode"],

        "mode_instructions": context[
            "mode_instructions"
        ],

        "evidence": context["evidence"],

        "simulation_observation": context[
            "simulation"
        ],

        "sources": context["sources"],

        "grounding_rules": context[
            "grounding_rules"
        ],
    }