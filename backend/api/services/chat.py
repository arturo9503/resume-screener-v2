"""
Chat service: builds RAG context and streams Claude responses.
"""
from django.conf import settings
from django.db import connection
from . import rag

MAX_RESUME_CHARS = 1500


def api_key_configured() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def _get_db_stats() -> str:
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT COUNT(*), array_agg(DISTINCT "Category") FROM resume'
        )
        total, categories = cursor.fetchone()
    sorted_cats = ", ".join(sorted(c for c in categories if c))
    return f"Total resumes: {total}\nCategories: {sorted_cats}"


def _build_system_prompt(results: list[dict], db_stats: str) -> str:
    resume_context = "\n\n---\n\n".join(
        f"ID: {r['ID']}, Category: {r['Category']}\n{str(r['Resume_str'])[:MAX_RESUME_CHARS]}"
        for r in results
    )
    return (
        f"You are analyzing a resume database.\n\nDatabase stats:\n{db_stats}\n\n"
        f"These {len(results)} resumes were retrieved as most relevant to the current question:\n\n"
        f"{resume_context}\n\n"
        "Answer clearly and specifically based on the retrieved resumes above."
    )


def stream_response(messages: list[dict], query: str):
    """
    Generator that yields text chunks (str) then a final list[dict] of sources.
    """
    import anthropic

    results = rag.search(query, k=10)
    db_stats = _get_db_stats()
    system_prompt = _build_system_prompt(results, db_stats)

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    with client.messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text

    # Yield sources as final item so the view can separate them
    yield [
        {"ID": r["ID"], "Category": r["Category"], "score": round(r["score"], 3)}
        for r in results
    ]
