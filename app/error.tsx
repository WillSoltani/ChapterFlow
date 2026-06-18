"use client";

import { useEffect } from "react";
import { SUPPORT_EMAIL } from "@/lib/legal-entity";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
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
        backgroundColor: "var(--cf-page-bg, #070b16)",
        color: "var(--cf-text-1, #e2e8f0)",
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
            color: "var(--cf-text-3, #94a3b8)",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            backgroundColor: "var(--cf-surface-muted, #1e293b)",
            border: "1px solid var(--cf-border, #334155)",
            color: "var(--cf-text-1, #e2e8f0)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <p style={{ fontSize: 13, color: "var(--cf-text-3, #94a3b8)", marginTop: 20 }}>
          Still stuck? Contact{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{ color: "var(--cf-accent, #38bdf8)", textDecoration: "underline" }}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
