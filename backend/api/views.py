import json
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_GET, require_POST

from .models import Posting
from .services import rag, chat


@require_GET
def postings(request):
    qs = Posting.objects.filter(description__isnull=False).order_by("?")[:5]
    data = list(qs.values("job_id", "company_name", "title", "description", "location"))
    return JsonResponse(data, safe=False)


@require_POST
def search(request):
    body = json.loads(request.body)
    description = body.get("description", "").strip()
    if not description:
        return JsonResponse({"error": "description required"}, status=400)

    results = rag.search(description, k=50)
    return JsonResponse(results, safe=False)


@require_POST
def chat_stream(request):
    body = json.loads(request.body)
    messages = body.get("messages", [])
    query = body.get("query", "")

    if not query:
        return JsonResponse({"error": "query required"}, status=400)

    if not chat.api_key_configured():
        return JsonResponse({"error": "ANTHROPIC_API_KEY not configured"}, status=503)

    def event_stream():
        sources = None
        for chunk in chat.stream_response(messages, query):
            if isinstance(chunk, list):
                sources = chunk
            else:
                yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"

        if sources is not None:
            yield f"data: {json.dumps({'type': 'sources', 'content': sources})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
