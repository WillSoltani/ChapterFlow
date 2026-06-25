/**
 * Pure catch-policy decision for the onboarding-funnel "already-onboarded"
 * guard, shared by the two funnel entry points (`/book`, `/onboarding`).
 *
 * The guard reads user settings purely to OPTIMIZE — to redirect an already-
 * onboarded user straight to /dashboard instead of re-showing the flow. A
 * failure of that optional read must never crash the route to the generic error
 * boundary. So we only re-throw:
 *   - a Next.js redirect (the already-onboarded → /dashboard bounce itself), and
 *   - an auth failure (expired/invalid token) which belongs at the auth boundary.
 * Everything else (a locally-unset BOOK_TABLE_NAME in dev/CI, or a transient
 * DynamoDB/network hiccup in prod) is swallowed so the route fails open and
 * renders the flow — mirroring `requireDashboardAccess`'s own fail-open policy.
 *
 * Kept dependency-free (no `server-only` imports — `auth.ts` is `server-only`,
 * so `AuthError` is duck-typed by its `.name`) so it can be unit-tested directly.
 */
export function shouldRethrowOnboardingGuardError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  // Next.js redirect() throws an object carrying a `digest` — must propagate so
  // the already-onboarded → /dashboard redirect actually fires.
  if ("digest" in error) return true;
  // Auth failures reach the auth boundary, not the onboarding flow.
  if (error instanceof Error && error.name === "AuthError") return true;
  // Optimization-only failure (unset data plane, transient backend) → fail open.
  return false;
}
