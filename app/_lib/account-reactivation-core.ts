/**
 * Pure helpers for the page-guard's auto-reactivation step
 * (`app/_lib/require-dashboard-access.ts`).
 *
 * Context: when a `deactivated` user loads a page with a valid token, the guard
 * reactivates the account (`setAccountStatus(...,"active")`) before rendering.
 * That write is a real DynamoDB mutation and can fail (throttle, transient
 * network blip). The old code ran the write *outside* its own try/catch, so a
 * failure landed in the shared status-check catch and was logged as a generic
 * `account_status_check_error` — indistinguishable from a read failure — and the
 * page rendered anyway, silently leaving the account `deactivated` in DynamoDB.
 *
 * These helpers make that path observable and self-healing without locking a
 * legitimately-signed-in user out over a transient write failure:
 *   - bounded best-effort retry of the reactivation write, and
 *   - a clear signal (distinct log/decision) when every attempt still failed.
 *
 * Kept dependency-free (no `server-only`/AWS imports) so the policy can be
 * unit-tested directly — the documented `*-core` seam pattern.
 */

/** Total attempts for the best-effort reactivation write (1 initial + retries). */
export const REACTIVATION_WRITE_MAX_ATTEMPTS = 3;

/**
 * A redirect thrown by Next.js `redirect()` carries a `digest` and must always
 * propagate — it is control flow, never a write failure to retry/swallow.
 */
export function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string"
  );
}

/**
 * Decide whether to make another reactivation-write attempt.
 *
 * - A Next.js redirect must never be retried — it is propagated by the caller.
 * - Otherwise retry while we have attempts left.
 *
 * @param attempt   1-based index of the attempt that just failed.
 * @param error     the thrown value from that attempt.
 * @param maxAttempts total attempts allowed (defaults to the module constant).
 */
export function shouldRetryReactivationWrite(
  attempt: number,
  error: unknown,
  maxAttempts: number = REACTIVATION_WRITE_MAX_ATTEMPTS
): boolean {
  if (isNextRedirectError(error)) return false;
  return attempt < maxAttempts;
}

/** Backoff (ms) before the next reactivation-write attempt. Linear, capped. */
export function reactivationRetryDelayMs(attempt: number): number {
  // attempt 1 → 50ms, attempt 2 → 100ms, … capped so a Server Component render
  // never stalls. Best-effort: the next page load retries regardless.
  return Math.min(attempt * 50, 250);
}

export type ReactivationOutcome =
  | { ok: true; attempts: number }
  | { ok: false; attempts: number; error: unknown };

export interface ReactivationRunHooks {
  /** Sleep between retries. Injected so tests run instantly. */
  sleep?: (ms: number) => Promise<void>;
  /** Structured logger. Injected so tests can assert the emitted signal. */
  log?: (
    level: "warn" | "error",
    event: string,
    detail: Record<string, unknown>
  ) => void;
  /** Total attempts allowed (defaults to the module constant). */
  maxAttempts?: number;
}

/**
 * Run the reactivation write with bounded best-effort retry. This is the F10
 * fix in pure form: the write lives in ITS OWN loop/try-catch (not folded into
 * the page guard's generic status-check catch), so a write failure is retried
 * and — if it still fails — reported as a DISTINCT terminal outcome instead of
 * being silently swallowed while the dashboard renders.
 *
 * Returns `{ ok: true }` once the write lands, or `{ ok: false, error }` after
 * every attempt fails. A Next.js `redirect()` (digest-carrying) is re-thrown,
 * never retried/swallowed — it is control flow.
 *
 * `write` is injected (the real caller passes `setAccountStatus(...)`) so this
 * loop is free of `server-only`/AWS imports and unit-testable directly.
 */
export async function runReactivationWrite(
  write: () => Promise<void>,
  hooks: ReactivationRunHooks = {}
): Promise<ReactivationOutcome> {
  const maxAttempts = hooks.maxAttempts ?? REACTIVATION_WRITE_MAX_ATTEMPTS;
  const sleep =
    hooks.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = hooks.log ?? (() => {});

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await write();
      if (attempt > 1) {
        log("warn", "account_reactivation_write_recovered", { attempt });
      }
      return { ok: true, attempts: attempt };
    } catch (error: unknown) {
      lastError = error;
      // A redirect is control flow — propagate, never retry/swallow.
      if (isNextRedirectError(error)) throw error;
      if (shouldRetryReactivationWrite(attempt, error, maxAttempts)) {
        await sleep(reactivationRetryDelayMs(attempt));
        continue;
      }
      // Terminal: every attempt failed. Emit a DISTINCT event (NOT the generic
      // read-failure log) so the fail-open is observable instead of silent.
      log("error", "account_reactivation_write_failed", {
        attempts: maxAttempts,
        message: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, attempts: maxAttempts, error };
    }
  }
  return { ok: false, attempts: maxAttempts, error: lastError };
}
