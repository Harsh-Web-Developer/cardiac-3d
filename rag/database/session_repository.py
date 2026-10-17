from typing import Any

from rag.database.supabase_client import get_supabase


VALID_SESSION_STATUSES = {
    "running",
    "paused",
    "completed",
    "abandoned",
}


def create_session(
    status: str = "running",
    patient_id: str | None = None,
    initial_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Create a new CARDIA simulation session.
    """

    if status not in VALID_SESSION_STATUSES:
        raise ValueError(
            f"Invalid session status '{status}'. "
            f"Expected one of: {sorted(VALID_SESSION_STATUSES)}"
        )

    row: dict[str, Any] = {
        "status": status,
        "initial_state": initial_state,
    }

    if patient_id:
        row["patient_id"] = patient_id

    response = (
        get_supabase()
        .table("simulation_sessions")
        .insert(row)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            "Supabase did not return the created simulation session."
        )

    return response.data[0]


def get_session(session_id: str) -> dict[str, Any]:
    """
    Retrieve a CARDIA simulation session by ID.
    """

    response = (
        get_supabase()
        .table("simulation_sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            f"Simulation session '{session_id}' was not found."
        )

    return response.data