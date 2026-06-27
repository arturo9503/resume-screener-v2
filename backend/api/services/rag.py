"""
RAG service: embedding with all-MiniLM-L6-v2 and pgvector search.

The sentence-transformer model is loaded once as a module-level singleton
to avoid reloading on every request.
"""
from django.db import connection

MODEL_NAME = "all-MiniLM-L6-v2"
MAX_TEXT_CHARS = 2000

_model = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def _vec_str(embedding) -> str:
    return "[" + ",".join(map(str, embedding.tolist())) + "]"


def search(query: str, k: int = 10, categories: list[str] | None = None) -> list[dict]:
    model = get_model()
    q_emb = model.encode([query], normalize_embeddings=True)[0]
    vec = _vec_str(q_emb)

    if categories:
        sql = """
            SELECT "ID", "Category", "Resume_str", "Resume_html",
                   1 - (embedding <=> CAST(%s AS vector)) AS score
            FROM resume
            WHERE embedding IS NOT NULL AND "Category" = ANY(%s)
            ORDER BY embedding <=> CAST(%s AS vector)
            LIMIT %s
        """
        params = [vec, categories, vec, k]
    else:
        sql = """
            SELECT "ID", "Category", "Resume_str", "Resume_html",
                   1 - (embedding <=> CAST(%s AS vector)) AS score
            FROM resume
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> CAST(%s AS vector)
            LIMIT %s
        """
        params = [vec, vec, k]

    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        cols = [col[0] for col in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]


def embeddings_exist() -> bool:
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM resume WHERE embedding IS NOT NULL")
        return cursor.fetchone()[0] > 0


def build_index() -> None:
    """Encode all resumes and save the vectors to PostgreSQL."""
    from django.db import transaction

    model = get_model()

    with connection.cursor() as cursor:
        cursor.execute('SELECT "ID", "Category", "Resume_str" FROM resume ORDER BY "ID"')
        cols = [col[0] for col in cursor.description]
        rows = [dict(zip(cols, row)) for row in cursor.fetchall()]

    texts = [
        f"Category: {r['Category']}\n{str(r['Resume_str'])[:MAX_TEXT_CHARS]}"
        for r in rows
    ]
    print(f"Encoding {len(texts)} resumes with {MODEL_NAME}...")
    embeddings = model.encode(
        texts, batch_size=32, show_progress_bar=True, normalize_embeddings=True
    )

    print("Saving embeddings to PostgreSQL...")
    with transaction.atomic():
        with connection.cursor() as cursor:
            for i, r in enumerate(rows):
                vec = _vec_str(embeddings[i])
                cursor.execute(
                    'UPDATE resume SET embedding = CAST(%s AS vector) WHERE "ID" = %s',
                    [vec, r["ID"]],
                )

    print(f"Done. Indexed {len(rows)} resumes.")
