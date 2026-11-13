/**
 * Pure helpers for GET /auth/refresh (SHELL-01). Kept free of "server-only" so
 * the redirect and loop rules are unit-tested (refresh-core.test.ts).
 */
import { isSafeInternalPath } from "../_lib/return-to-core";

export const REFRESH_DEFAULT_RETURN_TO = "/dashboard";

/**
 * The GET path only ever returns to a same-origin path, and never into an
 * /auth route (which could chain refresh into itself or into logout). Callers
 * pass the value through sanitizeReturnTo first; this narrows it further.
 */
export function resolveRefreshReturnTo(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!isSafeInternalPath(raw)) return REFRESH_DEFAULT_RETURN_TO;
  // Check the path the redirect will actually resolve to: the URL parser folds
  // dot segments (including percent-encoded dots) before the browser follows it.
  let path: string;
  try {
    path = new URL(raw, "http://refresh.invalid").pathname.toLowerCase();
  } catch {
    return REFRESH_DEFAULT_RETURN_TO;
  }
  if (path === "/auth" || path.startsWith("/auth/")) return REFRESH_DEFAULT_RETURN_TO;
  return raw;
}

export type RefreshGetPlan = "return" | "exchange" | "login";

/**
 * - A session that is already fresh (another tab just refreshed) returns at once.
 * - At most one exchange per navigation: once the attempt marker is set, or
 *   when there is no refresh token, the reader goes to sign-in as before.
 */
export function planRefreshGet(input: {
  sessionFresh: boolean;
  refreshAttempted: boolean;
  hasRefreshToken: boolean;
}): RefreshGetPlan {
  if (input.sessionFresh) return "return";
  if (input.refreshAttempted || !input.hasRefreshToken) return "login";
  return "exchange";
}

export function loginPathFor(returnTo: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}
