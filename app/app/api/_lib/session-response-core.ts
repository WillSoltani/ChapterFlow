import type { BookResolvedIdentity } from "../book/_lib/identity";

/**
 * The one canonical error code every identity handler (`/app/api/me`,
 * `/app/api/auth/session`, and `withBookApiErrors` in
 * `app/app/api/book/_lib/http.ts`) emits for a 503 verifier-unavailable
 * response. Kept as a single exported constant so the three independent
 * handlers are test-pinned to the identical string and cannot drift.
 */
export const VERIFIER_UNAVAILABLE_CODE = "verifier_unavailable" as const;

/**
 * The four outcomes a session-status probe (`/app/api/me`,
 * `/app/api/auth/session`) can resolve to. Kept as a discriminated union so the
 * mapping to an HTTP status + body is a single pure function, shared by both
 * routes, that never disagrees between endpoints.
 *
 *  - authenticated       — a verified id_token resolved a user.
 *  - anonymous           — no (or a genuinely-invalid) credential; not signed in.
 *  - verifier_unavailable — the JWKS could not be reached, so validity is
 *                          UNKNOWN. We must NOT report logged-out.
 *  - unexpected          — a non-auth error escaped the handler. Same as
 *                          verifier_unavailable, we must NOT flip a possibly
 *                          logged-in user to logged-out.
 */
export type SessionOutcome =
  | { kind: "authenticated"; identity: BookResolvedIdentity }
  | { kind: "anonymous" }
  | { kind: "verifier_unavailable" }
  | { kind: "unexpected" };

/**
 * Pure mapper from a {@link SessionOutcome} to the HTTP status + JSON body both
 * session routes emit. NO `server-only` import, so it is directly unit-testable.
 *
 * Both endpoints funnel through here so the anonymous case is byte-identical
 * (`200 { loggedIn: false }`) regardless of which route the client hit.
 *
 * The 503 cases keep the canonical error-envelope shape (`error.{code,message,
 * requestId}`) AND the legacy top-level `loggedIn: null` flag that `useAuthStatus`
 * reads. `unexpected` maps to the SAME 503 body as `verifier_unavailable`, NOT to
 * `200 { loggedIn: false }` — an unexpected error must never flip a genuinely
 * logged-in user to logged-out (useAuthStatus retries on >=500).
 */
export function buildSessionResponse(
  o: SessionOutcome,
  requestId: string
): { status: number; body: Record<string, unknown> } {
  switch (o.kind) {
    case "authenticated":
      return { status: 200, body: { loggedIn: true, user: o.identity } };
    case "anonymous":
      return { status: 200, body: { loggedIn: false } };
    case "verifier_unavailable":
    case "unexpected":
      return {
        status: 503,
        body: {
          loggedIn: null,
          error: {
            code: VERIFIER_UNAVAILABLE_CODE,
            message: "Authentication is temporarily unavailable. Please retry.",
            requestId,
          },
        },
      };
  }
}
