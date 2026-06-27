# Resume Screener v2 — System Specification

**Version:** 1.1
**Status:** Describes the current working system as of 2026-06-26

---

## 1. System Overview

A recruiter or hiring manager pastes a job description into the UI and receives the most semantically relevant resumes from the database, ranked by similarity. They can then ask follow-up questions about the candidates in a chat interface, and the system answers grounded in the retrieved resumes.

The system has three capabilities:

1. **Surface job postings** — provides sample postings to help the user compose a search query.
2. **Search resumes** — ranks resumes by semantic relevance to a natural-language job description.
3. **Answer questions** — streams a grounded response to a question, citing the resumes it drew from.

No authentication is required. All endpoints are public.

---

## 2. Data Models

### Posting

A job posting used to seed the search UI.

```
Posting {
  job_id:       integer   // unique identifier
  company_name: string
  title:        string
  description:  string    // full text of the posting
  location:     string    // may be empty
}
```

### Resume

A candidate resume. The `embedding` field is populated by the indexing process and is required for search.

```
Resume {
  ID:          integer
  Category:    string        // occupational label, e.g. "ENGINEERING", "HR"
  Resume_str:  string        // plain-text resume content
  Resume_html: string        // HTML-formatted resume content
  embedding:   vector | null // populated after indexing; null until then
}
```

### Message

A single turn in a conversation, as sent by the client.

```
Message {
  role:    "user" | "assistant"
  content: string
}
```

### SourceItem

Attribution returned at the end of a chat response.

```
SourceItem {
  ID:       integer
  Category: string
  score:    float   // cosine similarity, rounded to 3 decimal places
}
```

---

## 3. Endpoint Contracts

All endpoints are under `/api/`.

---

### `GET /api/postings/`

Returns a random sample of job postings.

**Response `200`:** `Posting[]` — up to 5 postings, selected at random, where `description` is non-empty. Order is non-deterministic. Returns `[]` if no qualifying postings exist.

---

### `POST /api/search/`

Searches resumes by semantic similarity to a job description.

**Request body:**
```
{ description: string }
```

**Response `200`:** `ResumeResult[]` — ordered by descending similarity score, up to 50 results. Only resumes with a populated `embedding` are eligible.

```
ResumeResult {
  ID:          integer
  Category:    string
  Resume_str:  string
  Resume_html: string
  score:       float   // cosine similarity in [0, 1]
}
```

**Errors:**

| Condition | Status | Body |
|---|---|---|
| `description` absent or blank | `400` | `{"error": "description required"}` |
| Wrong HTTP method | `405` | — |

---

### `POST /api/chat/`

Streams a grounded assistant response over Server-Sent Events.

**Request body:**
```
{
  query:    string     // the user's current question; required
  messages: Message[]  // full prior conversation history; may be empty
}
```

**Response `200`:** `text/event-stream` — see §5 for the exact event sequence.

**Errors** (returned as JSON before streaming begins):

| Condition | Status | Body |
|---|---|---|
| `query` absent or empty | `400` | `{"error": "query required"}` |
| API key not configured | `503` | `{"error": "ANTHROPIC_API_KEY not configured"}` |
| Wrong HTTP method | `405` | — |

Errors that occur after streaming has begun are not surfaced as events; the stream closes silently.

---

## 4. Service Contracts

### `rag.search(query, k, categories?)`

Returns the `k` most semantically similar resumes to `query`.

**Inputs:**
- `query: string` — the natural-language text to match against
- `k: integer` — maximum results to return (default: 10)
- `categories: string[]` — if provided, restricts results to resumes in those categories; otherwise all categories are searched

**Output:** `ResumeResult[]` — length ≤ `k`, ordered by descending `score`, restricted to resumes with a non-null `embedding`. Returns `[]` if no embeddings exist.

**Precondition:** The embedding index must have been built. Without it the function returns empty results rather than an error.

**Side effects:** None.

---

### `chat.stream_response(messages, query)`

Yields a grounded streaming response, using retrieved resumes as context.

**Inputs:**
- `messages: Message[]` — full prior conversation history
- `query: string` — the user's current question

**Yields, in order:**
1. Zero or more `string` — incremental text chunks of the assistant's answer, in arrival order.
2. Exactly one `SourceItem[]` — the resumes used as context, emitted after all text chunks.

**Behavior:** Retrieves the top 10 most relevant resumes for `query`, injects them as grounding context, sends `messages` as the conversation history, and streams the response bounded at 1,000 output tokens.

**Precondition:** `ANTHROPIC_API_KEY` must be configured. Callers must verify this before calling.

**Side effects:** Consumes API tokens.

---

### `build_index`

Encodes all resumes in the database and writes their embedding vectors.

**Invocation:** `manage.py build_index [--force]`

**Behavior:**
- If any embeddings already exist and `--force` is not passed, exits without modifying the database.
- Otherwise, encodes every resume and writes all vectors in a single atomic transaction — either all succeed or none are committed.

**Safety:**
- Safe to run while the search endpoint is serving traffic. Rows without embeddings are excluded from search results until their embedding is committed.
- Not safe to run concurrently with another `build_index` invocation.
- Re-running with `--force` fully rebuilds the index.

**Precondition:** The embedding model used here must be the same model used to encode search queries (see §6).

---

## 5. Streaming Protocol

The chat endpoint uses Server-Sent Events. Each event is a `data:` line containing a JSON object, terminated by a blank line.

### Event sequence

```
data: {"type": "text",    "content": "<chunk>"}\n\n   ← zero or more
data: {"type": "sources", "content": [...]}\n\n        ← exactly one
data: {"type": "done"}\n\n                             ← exactly one, always last
```

### Invariants

- All `text` events arrive before the `sources` event.
- `done` is always the final event.
- `sources` is always present, even if the list is empty.
- The client must concatenate `text` chunks to reconstruct the full response.

---

## 6. Constraints and Invariants

**Embeddings must be built before search works.** The `/api/search/` endpoint and the chat service both depend on pre-built embeddings. Until `build_index` has run successfully, both return empty results.

**The embedding model is fixed and must be consistent.** Embeddings written during indexing and vectors computed at query time must come from the same model. Mixing outputs from different models produces undefined similarity scores. If the model is ever changed, all embeddings must be rebuilt with `--force`.

**Resume text is truncated for indexing.** Only the first 2,000 characters of each resume's plain text are used when building the embedding. This truncation is part of the embedding's definition — the same truncation applies at query time to maintain consistency.

**The chat context uses further truncation.** When resumes are injected as chat context, each is limited to 1,500 characters of plain text. This is independent of the embedding truncation and does not affect search results.

**Search and chat retrieve different result sizes.** The search endpoint returns up to 50 results. The chat service retrieves only 10 resumes for use as context. A query may surface candidates in search that do not appear in a chat response about the same query.

**The API key is checked before streaming begins.** A missing or empty `ANTHROPIC_API_KEY` returns `503` before any SSE events are emitted.

**CORS is restricted to a single origin.** Only `http://localhost:5173` is permitted as a cross-origin caller.

---

## 7. Out of Scope

- **Authentication.** Any client that can reach the server can use any endpoint.
- **Resume ingestion.** The system does not accept uploads or create resume records. The table is populated externally.
- **Posting management.** Postings are read-only from the application's perspective.
- **Pagination.** All endpoints return their full result set in one response.
- **Streaming error events.** Failures mid-stream do not produce an error event.
- **Category filtering via API.** The search service supports it internally; no endpoint exposes it.
- **Session state.** The server is stateless. The client is responsible for maintaining and re-sending conversation history on each chat request.
- **Incremental index updates.** Resumes added after the last `build_index` run are not searchable until the command is run again.
