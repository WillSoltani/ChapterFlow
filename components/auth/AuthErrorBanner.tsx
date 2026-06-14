"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// Keys mirror exactly what the auth callback can emit (error / token_error /
// server_error). state_error and config_error were never produced, so they're
// dropped rather than left as dead-but-reachable copy.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  error: "We couldn’t finish signing you in. Let’s try that again.",
  token_error: "Something interrupted sign-in. One more try should do it.",
  server_error: "That’s on us — a hiccup on our end. Please try again in a moment.",
};

const RETRY_URL = "/auth/login?returnTo=%2Fbook";

export function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const authParam = searchParams.get("auth");
  const message = authParam
    ? AUTH_ERROR_MESSAGES[authParam] ?? AUTH_ERROR_MESSAGES.error
    : null;

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
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 rounded-xl border border-(--border-subtle) bg-(--bg-elevated) px-4 py-3 shadow-(--shadow-card)">
        {/* Warning icon */}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          className="mt-0.5 shrink-0 text-(--accent-amber)"
          aria-hidden="true"
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
          <p className="text-(--text-secondary)">{message}</p>
          <a
            href={RETRY_URL}
            className="mt-1.5 inline-block text-[13px] font-semibold text-(--accent-amber) underline underline-offset-2"
          >
            Try again
          </a>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="-my-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-(--text-muted) hover:text-(--text-heading)"
          aria-label="Dismiss"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
