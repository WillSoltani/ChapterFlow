"use client";

import { useEffect, useState } from "react";

/** Seconds before expiry at which we show the warning banner. */
const WARN_BEFORE_SECONDS = 5 * 60; // 5 minutes
/** How often to check expiry (ms). */
const CHECK_INTERVAL_MS = 30_000; // 30 seconds

function getExpiresAt(): number | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("auth_expires_at="));
  if (!match) return null;
  const value = Number(match.split("=")[1]);
  return Number.isFinite(value) ? value : null;
}

function getLoginUrl(): string {
  const returnTo = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  return `/auth/login?returnTo=${returnTo}`;
}

/**
 * Monitors the auth_expires_at cookie and shows a warning banner
 * when the session is about to expire. Redirects on full expiry.
 *
 * Mount this inside any authenticated layout.
 */
export function TokenExpiryGuard() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    function check() {
      const expiresAt = getExpiresAt();
      if (!expiresAt) return;

      const remaining = expiresAt - Math.floor(Date.now() / 1000);

      if (remaining <= 0) {
        // Token has expired — redirect to login
        window.location.assign(getLoginUrl());
        return;
      }

      if (remaining <= WARN_BEFORE_SECONDS) {
        setShowWarning(true);
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!showWarning) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2"
      role="alert"
    >
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg"
        style={{
          backgroundColor: "var(--cf-surface-muted, #1e293b)",
          border: "1px solid var(--cf-border, #334155)",
          color: "var(--cf-text-1, #e2e8f0)",
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0"
          style={{ color: "var(--cf-accent, #22d3ee)" }}
        >
          <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={2} />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
        <p className="flex-1 text-[13px]" style={{ color: "var(--cf-text-3, #94a3b8)" }}>
          Your session expires soon.
        </p>
        <a
          href={getLoginUrl()}
          className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium"
          style={{
            backgroundColor: "var(--cf-accent, #22d3ee)",
            color: "var(--primary-foreground, #0f172a)",
          }}
        >
          Sign in again
        </a>
      </div>
    </div>
  );
}
