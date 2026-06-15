"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, Square, Trash2, X } from "lucide-react";
import { useBodyScrollLock } from "@/components/ui/use-body-scroll-lock";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AskBookDrawerProps = {
  bookId: string;
  bookTitle: string;
  chapterNumber?: number;
};

function sessionKey(bookId: string) {
  return `ask-book-chat:${bookId}`;
}

const STARTER_QUESTIONS = [
  "What's the main idea of this chapter?",
  "Give me the key takeaways",
  "How can I apply this today?",
];

const FOLLOW_UP_QUESTIONS = [
  "Can you give me an example?",
  "Why does this matter?",
  "What should I remember most?",
  "How does this connect to earlier chapters?",
];

function pickFollowUps(messages: Message[]): string[] {
  // Pick 2 follow-ups that haven't been asked yet
  const asked = new Set(messages.filter((m) => m.role === "user").map((m) => m.content.toLowerCase()));
  const available = FOLLOW_UP_QUESTIONS.filter((q) => !asked.has(q.toLowerCase()));
  // Seeded Fisher-Yates shuffle (uniform, unbiased) — seed derives from the
  // number of messages so the result is stable within a turn (mirroring the
  // followUpsRef memoization keyed on messages.length).
  const seed = messages.length;
  for (let i = available.length - 1; i > 0; i--) {
    const j = ((seed * 2654435761 + i * 40503) >>> 0) % (i + 1);
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, 2);
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const isBullet = /^[-*]\s/.test(line);
        const content = line.replace(/^[-*]\s/, "");
        const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[Ch\.\s*\d+\])/g);
        const rendered = parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith("*") && part.endsWith("*")) {
            return <em key={j}>{part.slice(1, -1)}</em>;
          }
          if (/^\[Ch\.\s*\d+\]$/.test(part)) {
            return (
              <span key={j} className="rounded bg-(--cf-accent)/15 px-1 text-xs font-medium text-(--cf-accent)">
                {part}
              </span>
            );
          }
          return part;
        });
        if (isBullet) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-0.5 text-(--cf-text-3)">•</span>
              <span>{rendered}</span>
            </div>
          );
        }
        return line ? <p key={i}>{rendered}</p> : <br key={i} />;
      })}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

export function AskBookDrawer({ bookId, bookTitle, chapterNumber }: AskBookDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>(messages);
  // Keep the latest-messages ref in sync after commit (instead of writing it
  // during render). messagesRef is only ever read inside the async handleSubmit
  // event handler (for the fetch `history` payload), which always runs after
  // effects have flushed, so the read sees the same last-committed value either
  // way — behaviour is identical to the previous render-phase assignment.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Hydrate messages from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey(bookId));
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        setMessages(parsed);
        messagesRef.current = parsed;
      }
    } catch {}
  }, [bookId]);

  // Persist messages to sessionStorage on change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem(sessionKey(bookId), JSON.stringify(messages));
      }
    } catch {}
  }, [messages, bookId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const handleClose = useCallback(() => {
    handleAbort();
    setOpen(false);
  }, [handleAbort]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  // Body scroll lock while the drawer is open. Uses the shared ref-counted lock
  // so it composes with NotesDrawer's Sheet (OverlayShell) — both can be open at
  // once in the reader, and an uncoordinated save/restore would leave the body
  // permanently locked when they close out of order.
  useBodyScrollLock(open);

  // Auto-focus input when drawer opens
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setError(null);
    try {
      sessionStorage.removeItem(sessionKey(bookId));
    } catch {}
  }, [bookId]);

  const handleSubmit = useCallback(async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? input).trim();
    if (!question || streaming) return;

    if (!overrideQuestion) setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";

    try {
      const res = await fetch(`/app/api/book/books/${encodeURIComponent(bookId)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: messagesRef.current, chapterNumber }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: { message?: string } })?.error?.message ?? "Failed to get response");
        abortRef.current = null;
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        abortRef.current = null;
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
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.warn("[AskBookDrawer] SSE parse error:", e, line);
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError("Network error");
      }
    }

    abortRef.current = null;
    setStreaming(false);
    scrollToBottom();
  }, [input, streaming, bookId, chapterNumber, scrollToBottom]);

  // Determine if we should show follow-up suggestions (memoized to avoid re-shuffle on every render)
  const lastMessage = messages[messages.length - 1];
  const showFollowUps = !streaming && messages.length > 0 && lastMessage?.role === "assistant" && lastMessage?.content;
  // pickFollowUps is fully deterministic (seeded Fisher-Yates seeded by
  // messages.length, with `asked` built from the immutable user-message
  // contents), so memoizing on `messages` yields the same items the previous
  // length-keyed ref produced. Recomputes harmlessly during streaming, but
  // showFollowUps is false then so it is never displayed mid-turn.
  const followUpItems = useMemo(() => pickFollowUps(messages), [messages]);
  const followUps = showFollowUps ? followUpItems : [];

  return (
    <>
      {/* Floating chat launcher — reader-tokened and anchored to the bottom-edge
       *  FAB column (safe-area aware; the audio FAB stacks above it). */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-(--cr-accent) text-(--cr-text-inverse) shadow-lg transition hover:brightness-110 md:bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] md:right-6"
          title="Ask Raymond"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {/* Backdrop overlay */}
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-(--cf-overlay) backdrop-blur-[2px]"
          onClick={handleClose}
          aria-hidden="true"
        />
      ) : null}

      {/* Drawer */}
      <aside
        className={[
          "fixed z-[60] flex flex-col border-(--cf-border) bg-(--cf-surface-strong) shadow-(--shadow-modal) transition-transform duration-200",
          "inset-x-0 bottom-0 h-[70dvh] max-h-[90dvh] rounded-t-3xl border md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-t-0",
          open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-label="Ask Raymond"
        inert={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-(--cf-divider) px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--cf-accent)/15 text-(--cf-accent)">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-(--cf-text-1)">Raymond</p>
              <p className="text-xs text-(--cf-text-3)">{bookTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && !streaming && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) transition-colors hover:text-(--cf-danger-text)"
                aria-label="Clear chat"
                title="Clear chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition-colors hover:text-(--cf-text-1)"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--cf-accent)/10 text-(--cf-accent)">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-(--cf-text-1)">Hey, I&apos;m Raymond</p>
                <p className="mt-1 text-xs text-(--cf-text-3)">
                  Ask me anything about this chapter.
                  <br />
                  I know the book inside out.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSubmit(q)}
                    className="rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-xs text-(--cf-text-2) transition-colors hover:border-(--cf-accent) hover:text-(--cf-accent)"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-(--cf-accent)/15 text-(--cf-accent)">
                  <Sparkles className="h-3 w-3" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-(--cf-accent) text-white"
                    : "bg-(--cf-surface-muted) text-(--cf-text-1)"
                }`}
              >
                {msg.content ? (
                  msg.role === "assistant" ? (
                    <SimpleMarkdown text={msg.content} />
                  ) : (
                    msg.content
                  )
                ) : (
                  <TypingIndicator />
                )}
              </div>
            </div>
          ))}

          {/* Follow-up suggestions */}
          {followUps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-8">
              {followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSubmit(q)}
                  className="rounded-lg border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-xs text-(--cf-text-3) transition-colors hover:border-(--cf-accent) hover:text-(--cf-accent)"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="text-center text-xs text-(--cf-danger-text)">{error}</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-(--cf-divider) px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Raymond..."
              maxLength={500}
              disabled={streaming}
              className="cf-input flex-1 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
            />
            {streaming ? (
              <button
                type="button"
                onClick={handleAbort}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-danger-text) transition-colors hover:bg-(--cf-danger-bg)"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-(--cf-accent) text-white transition hover:brightness-110 disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      </aside>
    </>
  );
}
