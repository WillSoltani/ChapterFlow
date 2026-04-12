"use client";

import { useCallback, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AskBookDrawerProps = {
  bookId: string;
  bookTitle: string;
};

export function AskBookDrawer({ bookId, bookTitle }: AskBookDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question || streaming) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setStreaming(true);

    let accumulated = "";

    try {
      const res = await fetch(`/app/api/book/books/${encodeURIComponent(bookId)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: { message?: string } })?.error?.message ?? "Failed to get response");
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        setStreaming(false);
        return;
      }

      // Add placeholder assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as
              | { type: "token"; text: string }
              | { type: "done" }
              | { type: "error"; message: string };

            if (event.type === "token") {
              accumulated += event.text;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: accumulated };
                return copy;
              });
              scrollToBottom();
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {}
        }
      }
    } catch {
      setError("Network error");
    }

    setStreaming(false);
    scrollToBottom();
  }, [input, streaming, bookId, scrollToBottom]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-(--cf-accent) text-white shadow-lg transition hover:brightness-110 md:bottom-8"
        title={`Ask about ${bookTitle}`}
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 flex h-[70vh] w-full flex-col border-l border-(--cf-border) bg-(--cf-surface-strong) shadow-2xl md:bottom-4 md:right-4 md:h-[600px] md:w-[400px] md:rounded-2xl md:border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-(--cf-border) px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-(--cf-text-1)">Ask the Book</h3>
          <p className="text-xs text-(--cf-text-3)">{bookTitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-(--cf-text-3) hover:text-(--cf-text-1)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-sm text-(--cf-text-3)">
              Ask any question about this book.
              <br />
              Answers are grounded in the chapter content.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-(--cf-accent) text-white"
                  : "bg-(--cf-surface-muted) text-(--cf-text-1)"
              }`}
            >
              {msg.content || (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
            </div>
          </div>
        ))}
        {error && (
          <p className="text-center text-xs text-(--cf-danger-text)">{error}</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-(--cf-border) px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            maxLength={500}
            disabled={streaming}
            className="flex-1 rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-sm text-(--cf-text-1) placeholder:text-(--cf-text-3) focus:border-(--cf-accent) focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--cf-accent) text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
