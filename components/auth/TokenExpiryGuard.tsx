"use client";

import { useEffect, useRef, useState } from "react";

/** Seconds before access-token expiry at which we start trying to renew. */
const RENEW_BEFORE_SECONDS = 5 * 60; // 5 minutes
/** Countdown / renewal tick (ms). */
const TICK_MS = 1000;
/** Backoff between renewal attempts so a transient failure doesn't latch
 *  permanently (and a healthy retry isn't hammered every second). */
const RETRY_COOLDOWN_SECONDS = 30;

function getExpiresAt(): number | null {
  if (typeof document === "undefined") return null;
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

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Keeps an authenticated session alive. As the access token nears expiry it
 * silently calls /auth/refresh (which swaps the httpOnly refresh token for a
 * fresh access/id token) — so a reader is never kicked out mid-chapter. Only if
 * that renewal fails does it surface a dismissible warning with a live
 * countdown, and it redirects to login the moment the session truly lapses.
 *
 * Mount this inside any authenticated layout.
 */
export function TokenExpiryGuard() {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const refreshingRef = useRef(false);
  // Currently in a failed-renewal state (drives the warning banner).
  const failedRef = useRef(false);
  // Epoch seconds before which we won't attempt another renewal (backoff).
  const nextAttemptRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function attemptRenew() {
      const now = Math.floor(Date.now() / 1000);
      if (refreshingRef.current || now < nextAttemptRef.current) return;
      refreshingRef.current = true;
      try {
        const res = await fetch("/auth/refresh", {
          method: "POST",
          cache: "no-store",
        });
        // A 401 is terminal: the refresh token is gone/expired/revoked, or the
        // account was soft-deleted mid-session — in the deleted case the route
        // also CLEARS auth_expires_at, so the next tick() would early-return on
        // the null cookie and never reach the failed-countdown redirect, leaving
        // the user stranded under a stale banner. Redirect to login right now.
        if (res.status === 401) {
          window.location.assign(getLoginUrl());
          return;
        }
        if (!res.ok) throw new Error(`refresh ${res.status}`);
        // Success: the auth_expires_at cookie was rewritten with a later
        // timestamp; the next tick will see a healthy remaining and reset.
        // A short cooldown guards against re-hammering in the (pathological)
        // case where the new token is itself already inside the renew window.
        failedRef.current = false;
        nextAttemptRef.current = Math.floor(Date.now() / 1000) + RETRY_COOLDOWN_SECONDS;
        if (mounted) setShowWarning(false);
      } catch {
        // Don't latch forever — back off and let a later tick retry, so a
        // transient blip doesn't force a re-login when renewal would recover.
        failedRef.current = true;
        nextAttemptRef.current = Math.floor(Date.now() / 1000) + RETRY_COOLDOWN_SECONDS;
        if (mounted) setShowWarning(true);
      } finally {
        refreshingRef.current = false;
      }
    }

    function tick() {
      const expiresAt = getExpiresAt();
      if (!expiresAt) return; // no session cookie (e.g. dev bypass)

      const remaining = expiresAt - Math.floor(Date.now() / 1000);

      if (remaining > RENEW_BEFORE_SECONDS) {
        // Healthy — likely just renewed. Clear any prior warning state.
        if (mounted && showWarning) setShowWarning(false);
        failedRef.current = false;
        nextAttemptRef.current = 0;
        return;
      }

      // Inside the renewal window: try a silent refresh (attemptRenew enforces
      // its own backoff, so this is safe to call every tick).
      void attemptRenew();

      // Renewal isn't working — surface the warning + countdown, and redirect
      // once the session actually lapses.
      if (failedRef.current) {
        if (mounted) {
          setSecondsLeft(remaining);
          if (!dismissed) setShowWarning(true);
        }
        if (remaining <= 0) {
          window.location.assign(getLoginUrl());
        }
      }
    }

    tick();
    const interval = setInterval(tick, TICK_MS);
    const onWake = () => tick();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
    // showWarning/dismissed are read via closure each tick; intentionally not
    // deps (we want one long-lived interval, not a re-subscribe per state flip).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!showWarning || dismissed) return null;

  const expired = secondsLeft <= 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-(--cf-border-strong) bg-(--cf-surface) px-4 py-2.5 shadow-(--cf-shadow-lg)">
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 text-(--cf-warning-text)"
          aria-hidden="true"
        >
          <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={2} />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>

        <div className="flex-1">
          {/* Only the static headline is the announced live region — the
              per-second countdown below is aria-hidden so it doesn't
              re-announce the whole alert every tick. */}
          <p className="text-cf-label font-medium text-(--cf-text-1)" role="alert">
            {expired ? "Your session has expired." : "Your session is about to expire."}
          </p>
          {!expired && (
            <p className="text-cf-label-sm text-(--cf-text-3)" aria-hidden="true">
              Signing you out in{" "}
              <span className="font-mono tabular-nums text-(--cf-text-2)">
                {formatCountdown(secondsLeft)}
              </span>
            </p>
          )}
        </div>

        <a
          href={getLoginUrl()}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-(--cf-accent) px-3 text-cf-label-sm font-semibold text-(--cf-accent-contrast)"
        >
          Sign in again
        </a>

        {!expired && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss session warning"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-(--cf-text-3) hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)"
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
        )}
      </div>
    </div>
  );
}
