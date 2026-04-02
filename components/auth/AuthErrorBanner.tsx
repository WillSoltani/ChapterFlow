"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  error: "Something went wrong during sign-in. Please try again.",
  state_error: "Your sign-in session expired. Please try again.",
  token_error: "We couldn\u2019t complete sign-in. Please try again.",
  server_error: "A server error occurred. Please try again shortly.",
  config_error: "Service temporarily unavailable. Please try again later.",
};

const AUTH_URL = "/auth/login?returnTo=%2Fbook";

export function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const authParam = searchParams.get("auth");
  const message = authParam ? AUTH_ERROR_MESSAGES[authParam] : null;

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    if (!message || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), 12_000);
    return () => clearTimeout(timer);
  }, [message, dismissed]);

  if (!message || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    router.replace("/", { scroll: false });
  };

  return (
    <div
      className="fixed top-20 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2"
      role="alert"
    >
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg"
        style={{
          backgroundColor: "var(--bg-elevated, #1e293b)",
          border: "1px solid var(--border-subtle, #334155)",
          color: "var(--text-heading, #e2e8f0)",
        }}
      >
        {/* Warning icon */}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          className="mt-0.5 shrink-0"
          style={{ color: "var(--accent-teal, #22d3ee)" }}
        >
          <path
            d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="flex-1 text-[13px] leading-relaxed">
          <p style={{ color: "var(--text-secondary, #94a3b8)" }}>{message}</p>
          <a
            href={AUTH_URL}
            className="mt-1.5 inline-block text-[13px] font-medium underline underline-offset-2"
            style={{ color: "var(--accent-teal, #22d3ee)" }}
          >
            Sign in
          </a>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-0.5"
          style={{ color: "var(--text-muted, #64748b)" }}
          aria-label="Dismiss"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
