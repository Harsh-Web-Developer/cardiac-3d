from pathlib import Path

from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

QDRANT_PATH = Path("data/qdrant")
COLLECTION_NAME = "cardia_physiology"

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

QUESTION = "Why did cardiac output fall?"

TOP_K = 5


# ---------------------------------------------------------
# Load embedding model
# ---------------------------------------------------------

print("Loading embedding model...")

model = SentenceTransformer(EMBEDDING_MODEL_NAME)

print("Embedding model loaded.")


# ---------------------------------------------------------
# Create question embedding
# ---------------------------------------------------------

print()
print(f"Question: {QUESTION}")
print("Creating question embedding...")

question_embedding = model.encode(
    QUESTION,
    normalize_embeddings=True
)

print("Question embedding created.")


# ---------------------------------------------------------
# Connect to Qdrant
# ---------------------------------------------------------

print()
print("Opening Qdrant...")

client = QdrantClient(
    path=str(QDRANT_PATH)
)


# ---------------------------------------------------------
# Semantic search
# ---------------------------------------------------------

print(f"Searching for top {TOP_K} relevant chunks...")

results = client.query_points(
    collection_name=COLLECTION_NAME,
    query=question_embedding.tolist(),
    limit=TOP_K
).points


# ---------------------------------------------------------
# Display results
# ---------------------------------------------------------

print()
print("=" * 60)
print("RETRIEVAL RESULTS")
print("=" * 60)

for rank, result in enumerate(results, start=1):

    payload = result.payload

    print()
    print(f"RESULT #{rank}")
    print("-" * 60)

    print(f"Score: {result.score:.4f}")
    print(f"Chunk ID: {payload.get('chunk_id')}")
    print(f"Title: {payload.get('title')}")
    print(f"Topic: {payload.get('topic')}")
    print(f"Organ: {payload.get('organ')}")
    print(f"Mechanism: {payload.get('mechanism')}")
    print(f"Equation: {payload.get('equation')}")
    print(f"Page: {payload.get('page')}")

    print()
    print("Text:")
    print(payload.get("text"))


print()
print("=" * 60)
print("RETRIEVAL TEST COMPLETE")
print("=" * 60)