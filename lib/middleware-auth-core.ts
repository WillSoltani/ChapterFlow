/**
 * Pure, Edge-safe sign-in decision for middleware.ts (SHELL-01).
 *
 * A protected document navigation whose session cookie is missing or expired,
 * but which still holds the 30-day refresh_token cookie, is sent through
 * GET /auth/refresh first, so a returning reader is not asked to sign in again.
 * Everything else that lacks a session keeps the old behaviour: /auth/login.
 */

/**
 * Host-only, short-lived marker that GET /auth/refresh sets when it attempts an
 * exchange. While it is present, middleware and the refresh route go straight
 * to sign-in, so a refresh that did not produce a usable session cannot loop.
 */
export const REFRESH_ATTEMPT_COOKIE = "cf_refresh_attempt";
export const REFRESH_ATTEMPT_MAX_AGE_SECONDS = 60;

/** Same rule middleware has always used: a token, and no past expiry stamp. */
export function isSessionCookieFresh(
  idToken: string | null | undefined,
  expiresAtRaw: string | null | undefined,
  nowSeconds: number,
): boolean {
  if (!idToken) return false;
  const expiresAt = Number(expiresAtRaw);
  return !(Number.isFinite(expiresAt) && expiresAt <= nowSeconds);
}

export type MiddlewareAuthInput = {
  idToken: string | null | undefined;
  expiresAtRaw: string | null | undefined;
  hasRefreshToken: boolean;
  refreshAttempted: boolean;
  method: string;
  accept: string | null;
  /** `Sec-Purpose` / `Purpose` request header (browser prefetch/prerender). */
  purpose: string | null;
  /** Next.js client navigation / RSC payload request (`RSC: 1`). */
  isRsc: boolean;
  nowSeconds: number;
};

export type MiddlewareAuthDecision = "pass" | "refresh" | "login";

function isDocumentNavigation(input: MiddlewareAuthInput): boolean {
  if (input.method.toUpperCase() !== "GET") return false;
  if (input.isRsc) return false;
  if (input.purpose && /prefetch|prerender/i.test(input.purpose)) return false;
  return (input.accept ?? "").toLowerCase().includes("text/html");
}

export function decideMiddlewareAuth(
  input: MiddlewareAuthInput,
): MiddlewareAuthDecision {
  if (isSessionCookieFresh(input.idToken, input.expiresAtRaw, input.nowSeconds)) {
    return "pass";
  }
  if (
    input.hasRefreshToken &&
    !input.refreshAttempted &&
    isDocumentNavigation(input)
  ) {
    return "refresh";
  }
  return "login";
}
