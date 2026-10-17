from pathlib import Path
import os

from dotenv import load_dotenv
from supabase import create_client


RAG_DIR = Path(__file__).resolve().parent.parent
load_dotenv(RAG_DIR / ".env")


supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SECRET_KEY"),
)


TEST_ID = "9654c882-1604-4f16-9c55-a1152a84bd50"


print("Removing temporary CARDIA RAG test row...")

response = (
    supabase
    .table("explanations")
    .delete()
    .eq("id", TEST_ID)
    .execute()
)


print("Delete request completed.")
print("Deleted rows:", len(response.data))
print()
print("TEST ROW CLEANUP COMPLETE")