from pathlib import Path
import os

from dotenv import load_dotenv
from supabase import Client, create_client


# --------------------------------------------------
# LOAD ENVIRONMENT
# --------------------------------------------------

RAG_DIR = Path(__file__).resolve().parent.parent

load_dotenv(RAG_DIR / ".env")


# --------------------------------------------------
# SUPABASE CONFIGURATION
# --------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")


if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is missing from rag/.env"
    )

if not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "SUPABASE_SECRET_KEY is missing from rag/.env"
    )


# --------------------------------------------------
# CREATE BACKEND CLIENT
# --------------------------------------------------

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
)


def get_supabase() -> Client:
    """
    Return the shared Supabase backend client.
    """
    return supabase