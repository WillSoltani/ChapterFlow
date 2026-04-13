"use client";

import { useCallback, useState } from "react";

type FeedbackState = {
  loading: boolean;
  feedbackText: string;
  error: string | null;
  cached: boolean;
};

export function useReflectionFeedback() {
  const [state, setState] = useState<FeedbackState>({
    loading: false,
    feedbackText: "",
    error: null,
    cached: false,
  });

  const requestFeedback = useCallback(
    async (params: {
      bookId: string;
      chapterNumber: number;
      exampleId: string;
      reflectionText: string;
      scenario: string;
      whatToDo: string;
      whyItMatters: string;
      chapterTitle: string;
    }) => {
      setState({ loading: true, feedbackText: "", error: null, cached: false });

      try {
        const res = await fetch(
          `/app/api/book/me/reflections/${encodeURIComponent(params.bookId)}/${params.chapterNumber}/feedback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          },
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = (err as { error?: { message?: string } })?.error?.message ?? "Failed to get feedback";
          setState((prev) => ({ ...prev, loading: false, error: message }));
          return;
        }

        const contentType = res.headers.get("Content-Type") ?? "";

        // Non-streaming (cached response)
        if (contentType.includes("application/json")) {
          const data = (await res.json()) as { feedbackText: string; cached: boolean };
          setState({
            loading: false,
            feedbackText: data.feedbackText,
            error: null,
            cached: data.cached,
          });
          return;
        }

        // Streaming SSE response
        const reader = res.body?.getReader();
        if (!reader) {
          setState((prev) => ({ ...prev, loading: false, error: "No response stream" }));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

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
                | { type: "done"; fullText: string; cached: boolean }
                | { type: "error"; message: string };

              if (event.type === "token") {
                accumulated += event.text;
                setState((prev) => ({ ...prev, feedbackText: accumulated }));
              } else if (event.type === "done") {
                setState({
                  loading: false,
                  feedbackText: event.fullText,
                  error: null,
                  cached: event.cached,
                });
              } else if (event.type === "error") {
                setState((prev) => ({
                  ...prev,
                  loading: false,
                  error: event.message,
                }));
              }
            } catch {}
          }
        }

        // If stream ended without a "done" event (e.g. connection dropped)
        setState((prev) => {
          if (!prev.loading) return prev;
          return {
            loading: false,
            feedbackText: accumulated || prev.feedbackText,
            error: accumulated ? null : "Stream ended unexpectedly",
            cached: false,
          };
        });
      } catch {
        setState((prev) => ({ ...prev, loading: false, error: "Network error" }));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ loading: false, feedbackText: "", error: null, cached: false });
  }, []);

  return { ...state, requestFeedback, reset };
}
