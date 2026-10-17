from typing import Any

from rag.database.supabase_client import get_supabase


def save_knowledge_source(
    title: str,
    author: str | None = None,
    source_type: str | None = None,
    url: str | None = None,
    publication_year: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Save a CARDIA knowledge source to Supabase.
    """

    row: dict[str, Any] = {
        "title": title,
        "author": author,
        "source_type": source_type,
        "url": url,
        "publication_year": publication_year,
        "metadata": metadata or {},
    }

    response = (
        get_supabase()
        .table("knowledge_sources")
        .insert(row)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            "Supabase did not return the inserted knowledge source."
        )

    return response.data[0]


def get_knowledge_source(
    source_id: str,
) -> dict[str, Any]:
    """
    Retrieve a CARDIA knowledge source by ID.
    """

    response = (
        get_supabase()
        .table("knowledge_sources")
        .select("*")
        .eq("id", source_id)
        .single()
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            f"Knowledge source '{source_id}' was not found."
        )

    return response.data


def find_knowledge_source(
    title: str,
    author: str | None = None,
    source_type: str | None = None,
) -> dict[str, Any] | None:
    """
    Find a registered CARDIA knowledge source using
    the provenance metadata returned by retrieval.
    """

    query = (
        get_supabase()
        .table("knowledge_sources")
        .select("*")
        .eq("title", title)
    )

    if author:
        query = query.eq("author", author)

    if source_type:
        query = query.eq("source_type", source_type)

    response = query.limit(1).execute()

    if not response.data:
        return None

    return response.data[0]