import { useState, useRef, useEffect } from "react";
import { streamChat } from "../api";
import type { ChatMessage, ChatSource } from "../types";

interface MessageWithSources extends ChatMessage {
  sources?: ChatSource[];
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<MessageWithSources[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || streaming) return;

    const userMsg: MessageWithSources = { role: "user", content: query };
    const historyForApi: ChatMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError(null);
    setStreaming(true);

    const assistantMsg: MessageWithSources = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      for await (const chunk of streamChat(historyForApi, query)) {
        if (chunk.type === "text" && typeof chunk.content === "string") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk.content,
            };
            return updated;
          });
        } else if (chunk.type === "sources" && Array.isArray(chunk.content)) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              sources: chunk.content as ChatSource[],
            };
            return updated;
          });
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Chat error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Ask about resumes
        </h2>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Ask a question about the resume database. RAG will retrieve the
            most relevant resumes to answer.
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="space-y-1">
            <div
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content}
                {streaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant" && (
                    <span className="inline-block w-1.5 h-4 bg-gray-500 ml-0.5 animate-pulse align-middle" />
                  )}
              </div>
            </div>

            {msg.sources && msg.sources.length > 0 && (
              <details className="ml-1">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
                  {msg.sources.length} resumes retrieved (RAG)
                </summary>
                <div className="mt-1 rounded border border-gray-100 divide-y divide-gray-100 text-xs">
                  {msg.sources.map((s) => (
                    <div
                      key={s.ID}
                      className="flex justify-between px-3 py-1 text-gray-500"
                    >
                      <span>
                        <span className="font-medium text-gray-700">
                          {s.Category}
                        </span>{" "}
                        — ID {s.ID}
                      </span>
                      <span className="tabular-nums">{s.score}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 px-4 py-3 flex gap-2 items-end"
      >
        <textarea
          ref={textareaRef}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          placeholder="Ask a question about the resumes… (Enter to send, Shift+Enter for newline)"
          className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
