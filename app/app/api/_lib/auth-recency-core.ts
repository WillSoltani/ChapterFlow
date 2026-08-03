// Pure, `server-only`-free helpers for step-up (re-)authentication recency (#5).
// Kept in a `-core` module so they are directly unit-testable under `tsx --test`
// (importing auth.ts itself pulls `server-only` + `next/headers` + `jose`).
// auth.ts re-exports `requireRecentAuth` as the thin server-side wrapper.

/**
 * Pure decision: is an authentication whose `auth_time` is `authTimeSeconds`
 * (the Cognito/OIDC `auth_time` claim, seconds since epoch) recent enough for a
 * sensitive action that requires re-auth within `maxAgeMinutes`?
 *
 * Returns `{ ok: true }` when fresh; otherwise `{ ok: false, reason }` with a
 * machine reason: `missing` (no/invalid `auth_time` claim) or `stale`
 * (authenticated longer ago than the window). `nowSeconds` is injected so the
 * decision is deterministic in tests.
 *
 * Note: a small negative skew (auth_time slightly in the future vs our clock) is
 * treated as fresh — clock skew between Cognito and the Lambda must never force a
 * spurious re-auth on a token that was literally just issued.
 */
export function evaluateAuthRecency(params: {
  authTimeSeconds: number | undefined;
  maxAgeMinutes: number;
  nowSeconds: number;
}): { ok: true } | { ok: false; reason: "missing" | "stale" } {
  const { authTimeSeconds, maxAgeMinutes, nowSeconds } = params;
  if (
    authTimeSeconds === undefined ||
    !Number.isFinite(authTimeSeconds) ||
    authTimeSeconds <= 0
  ) {
    return { ok: false, reason: "missing" };
  }
  const ageSeconds = nowSeconds - authTimeSeconds;
  // Future-dated auth_time (clock skew) → age < 0 → always fresh.
  if (ageSeconds <= maxAgeMinutes * 60) {
    return { ok: true };
  }
  return { ok: false, reason: "stale" };
}

// ─── ID-token claim mapping (pure, testable) ─────────────────────────────────
//
// The shape of `AuthedUser` lives in auth.ts (which imports `server-only`); this
// is the structurally-identical subset returned by `mapIdTokenClaims`. Keeping
// the mapper here lets us unit-test the `token_use === "id"` assertion (#15) and
// `auth_time` extraction (#5) without dragging `server-only` / `next/headers`
// into the test runner.

export type MappedIdClaims = {
  sub: string;
  email?: string | undefined;
  emailVerified?: boolean | undefined;
  name?: string | undefined;
  givenName?: string | undefined;
  familyName?: string | undefined;
  preferredUsername?: string | undefined;
  groups?: string[] | undefined;
  authTime?: number | undefined;
};

/**
 * Map a VERIFIED JWT payload (jwtVerify has already checked sig/issuer/audience)
 * into the identity subset, enforcing the two app-level claim rules:
 *
 *  - `token_use` MUST be `"id"` (defense-in-depth: reject an access token that
 *    shares the pool's issuer/audience) → returns `{ valid: false }`.
 *  - `sub` MUST be a non-empty string → returns `{ valid: false }`.
 *
 * Both map to AuthError("INVALID_TOKEN") at the call site (a deterministic "no",
 * NOT verifier-unavailable). On success returns `{ valid: true, user }` with
 * `authTime` parsed from `auth_time` (number, or a numeric string).
 */
export function mapIdTokenClaims(
  payload: Record<string, unknown>
): { valid: false } | { valid: true; user: MappedIdClaims } {
  if (payload.token_use !== "id") return { valid: false };

  const sub = payload.sub;
  if (!sub || typeof sub !== "string") return { valid: false };

  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

  const rawGroups = payload["cognito:groups"];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.filter((v): v is string => typeof v === "string")
    : typeof rawGroups === "string"
      ? [rawGroups]
      : undefined;

  const rawAuthTime = payload.auth_time;
  const authTime =
    typeof rawAuthTime === "number" && Number.isFinite(rawAuthTime)
      ? rawAuthTime
      : typeof rawAuthTime === "string" && /^\d+$/.test(rawAuthTime)
        ? Number(rawAuthTime)
        : undefined;

  return {
    valid: true,
    user: {
      sub,
      email: str(payload.email),
      emailVerified:
        typeof payload.email_verified === "boolean" ? payload.email_verified : undefined,
      name: str(payload.name),
      givenName: str(payload.given_name),
      familyName: str(payload.family_name),
      preferredUsername: str(payload.preferred_username),
      groups,
      authTime,
    },
  };
}
