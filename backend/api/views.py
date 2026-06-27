import json
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Posting
from .serializers import PostingSerializer, ResumeResultSerializer
from .services import rag, chat


class PostingsView(APIView):
    def get(self, request):
        postings = Posting.objects.filter(description__isnull=False).order_by("?")[:5]
        serializer = PostingSerializer(postings, many=True)
        return Response(serializer.data)


class SearchView(APIView):
    def post(self, request):
        description = request.data.get("description", "").strip()
        if not description:
            return Response({"error": "description required"}, status=status.HTTP_400_BAD_REQUEST)

        results = rag.search(description, k=50)
        serializer = ResumeResultSerializer(results, many=True)
        return Response(serializer.data)


class ChatView(APIView):
    def post(self, request):
        messages = request.data.get("messages", [])
        query = request.data.get("query", "")

        if not query:
            return Response({"error": "query required"}, status=status.HTTP_400_BAD_REQUEST)

        if not chat.api_key_configured():
            return Response(
                {"error": "ANTHROPIC_API_KEY not configured"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

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
