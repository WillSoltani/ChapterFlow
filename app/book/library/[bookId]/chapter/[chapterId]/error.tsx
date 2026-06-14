"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ChapterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Chapter reading error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "var(--cr-bg-root)",
        color: "var(--cr-text-heading)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--cr-text-secondary)",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          We couldn&apos;t load this chapter. Your reading progress is safe.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              backgroundColor: "var(--cr-bg-surface-3)",
              border: "1px solid var(--cr-glass-border)",
              color: "var(--cr-text-heading)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/book/library"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 24px",
              borderRadius: 12,
              backgroundColor: "var(--cr-bg-surface-3)",
              border: "1px solid var(--cr-glass-border)",
              color: "var(--cr-text-heading)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Back to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
