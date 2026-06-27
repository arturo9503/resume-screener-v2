import type { Posting, ResumeResult, ChatMessage, ChatSource } from "./types";

export async function fetchPostings(): Promise<Posting[]> {
  const res = await fetch("/api/postings/");
  if (!res.ok) throw new Error("Failed to load postings");
  return res.json();
}

export async function searchResumes(description: string): Promise<ResumeResult[]> {
  const res = await fetch("/api/search/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export interface ChatChunk {
  type: "text" | "sources" | "done";
  content?: string | ChatSource[];
}

export async function* streamChat(
  messages: ChatMessage[],
  query: string
): AsyncGenerator<ChatChunk> {
  const res = await fetch("/api/chat/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Chat request failed" }));
    throw new Error(err.error ?? "Chat request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (part.startsWith("data: ")) {
        yield JSON.parse(part.slice(6)) as ChatChunk;
      }
    }
  }
}
