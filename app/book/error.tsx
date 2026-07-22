"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function BookError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Book section error:", error);
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
        backgroundColor: "var(--cf-page-bg)",
        color: "var(--cf-text-1)",
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
            color: "var(--cf-text-3)",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          We hit an unexpected error loading this page. Your progress is safe.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              backgroundColor: "var(--cf-surface-muted)",
              border: "1px solid var(--cf-border)",
              color: "var(--cf-text-1)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 24px",
              borderRadius: 12,
              backgroundColor: "var(--cf-surface-muted)",
              border: "1px solid var(--cf-border)",
              color: "var(--cf-text-1)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
