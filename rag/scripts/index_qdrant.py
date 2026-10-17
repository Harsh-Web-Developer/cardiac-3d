import json
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer


# ---------------------------------------------------------
# Paths
# ---------------------------------------------------------

CHUNKS_FILE = Path("data/chunks/cardia_chunks.json")
QDRANT_PATH = Path("data/qdrant")

COLLECTION_NAME = "cardia_physiology"

EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


# ---------------------------------------------------------
# Load chunks
# ---------------------------------------------------------

if not CHUNKS_FILE.exists():
    raise FileNotFoundError(
        f"Chunk file not found: {CHUNKS_FILE}"
    )

with open(
    CHUNKS_FILE,
    "r",
    encoding="utf-8"
) as file:

    chunks = json.load(file)

print(f"Loaded chunks: {len(chunks)}")


# ---------------------------------------------------------
# Load embedding model
# ---------------------------------------------------------

print("Loading embedding model...")

model = SentenceTransformer(
    EMBEDDING_MODEL_NAME
)

print("Embedding model loaded.")


# ---------------------------------------------------------
# Create embeddings
# ---------------------------------------------------------

texts = [
    chunk["text"]
    for chunk in chunks
]

print("Creating embeddings...")

embeddings = model.encode(
    texts,
    normalize_embeddings=True,
    show_progress_bar=True
)

print(
    f"Embeddings created: {len(embeddings)}"
)

print(
    f"Vector dimension: {len(embeddings[0])}"
)


# ---------------------------------------------------------
# Create local Qdrant database
# ---------------------------------------------------------

QDRANT_PATH.mkdir(
    parents=True,
    exist_ok=True
)

print("Opening local Qdrant database...")

client = QdrantClient(
    path=str(QDRANT_PATH)
)


# ---------------------------------------------------------
# Recreate collection
# ---------------------------------------------------------

vector_size = len(embeddings[0])

if client.collection_exists(
    COLLECTION_NAME
):

    print(
        f"Collection '{COLLECTION_NAME}' already exists."
    )

    print("Deleting old collection...")

    client.delete_collection(
        COLLECTION_NAME
    )


client.create_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=VectorParams(
        size=vector_size,
        distance=Distance.COSINE
    )
)

print(
    f"Created collection: {COLLECTION_NAME}"
)


# ---------------------------------------------------------
# Prepare Qdrant points
# ---------------------------------------------------------

points = []

for index, (
    chunk,
    embedding
) in enumerate(
    zip(chunks, embeddings)
):

    # -----------------------------------------------------
    # Complete metadata payload
    # -----------------------------------------------------

    payload = {

        # ---------------------------------------------
        # Identity
        # ---------------------------------------------

        "chunk_id": chunk.get(
            "chunk_id"
        ),

        "title": chunk.get(
            "title"
        ),

        "text": chunk.get(
            "text"
        ),

        # ---------------------------------------------
        # Source provenance
        # ---------------------------------------------

        "source": chunk.get(
            "source"
        ),

        "source_title": chunk.get(
            "source_title"
        ),

        "source_type": chunk.get(
            "source_type"
        ),

        "authority_level": chunk.get(
            "authority_level"
        ),

        "author": chunk.get(
            "author"
        ),

        "chapter": chunk.get(
            "chapter"
        ),

        "page": chunk.get(
            "page"
        ),

        # ---------------------------------------------
        # Physiological metadata
        # ---------------------------------------------

        "topic": chunk.get(
            "topic"
        ),

        "organ": chunk.get(
            "organ"
        ),

        "mechanism": chunk.get(
            "mechanism"
        ),

        "equation": chunk.get(
            "equation"
        ),
    }

    point = PointStruct(
        id=index,
        vector=embedding.tolist(),
        payload=payload
    )

    points.append(point)


# ---------------------------------------------------------
# Insert into Qdrant
# ---------------------------------------------------------

print("Indexing chunks into Qdrant...")

client.upsert(
    collection_name=COLLECTION_NAME,
    points=points
)


# ---------------------------------------------------------
# Verify collection
# ---------------------------------------------------------

collection_info = client.get_collection(
    COLLECTION_NAME
)


print()
print("==========================================")
print("QDRANT INDEXING COMPLETE")
print("==========================================")

print(
    f"Collection: {COLLECTION_NAME}"
)

print(
    f"Chunks indexed: {collection_info.points_count}"
)

print(
    f"Vector dimension: {vector_size}"
)

print(
    f"Database: {QDRANT_PATH}"
)

print("==========================================")