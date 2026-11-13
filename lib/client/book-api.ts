"use client";

// Canonical client data-access boundary (WS3-001).

import {
  AUTH_CACHE_GENERATION_COOKIE,
  readCookieValue,
} from "@/lib/auth-cache-generation";

export class BookClientError extends Error {
  status: number;
  code?: string | undefined;
  details?: unknown;

  constructor(message: string, status = 500, code?: string, details?: unknown) {
    super(message);
    this.name = "BookClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function fetchBookJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  captureDocumentAuthGeneration();
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : `Request failed with status ${response.status}`;
    const code =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "code" in payload.error &&
      typeof payload.error.code === "string"
        ? payload.error.code
        : undefined;
    const details =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "details" in payload.error
        ? payload.error.details
        : undefined;
    const error = new BookClientError(message, response.status, code, details);
    redirectOnUnauthorized(error);
    throw error;
  }

  return payload as T;
}

/**
 * DATA-08: a plain 401 means the session is gone (refresh token lapsed or
 * revoked, cookie missing). Without this, pages read it as an outage or an
 * empty library. The reader goes through GET /auth/refresh once (it renews and
 * comes back, or falls through to sign-in); if the next page still gets a 401
 * they go to sign-in; after that we stop and let the page show its error, so a
 * server that keeps rejecting a valid sign-in can never loop. The attempt count
 * lives in this tab's sessionStorage because each step is a full navigation.
 */
export const UNAUTHORIZED_REDIRECT_KEY = "cf:unauthorized-redirect";
const UNAUTHORIZED_REDIRECT_WINDOW_MS = 2 * 60_000;

type UnauthorizedRedirectStamp = { at: number; count: number };
export type UnauthorizedRedirectPlan = "refresh" | "login" | "none";

export function planUnauthorizedRedirect(
  error: BookClientError,
  previous: UnauthorizedRedirectStamp | null,
  now: number,
): UnauthorizedRedirectPlan {
  if (error.status !== 401 || isReauthRequired(error)) return "none";
  const recent = previous && now - previous.at < UNAUTHORIZED_REDIRECT_WINDOW_MS ? previous.count : 0;
  if (recent <= 0) return "refresh";
  if (recent === 1) return "login";
  return "none";
}

let unauthorizedRedirectStarted = false;
// The auth generation this document started with. Sign-out (here, in another
// tab, or via account delete/deactivate) rotates it; a 401 after that is the
// expected end of the session, and redirecting would hijack the sign-out
// navigation, so it is left alone (AuthCacheBoundary reloads the page instead).
let documentAuthGeneration: string | null | undefined;

function readAuthGeneration(): string | null {
  return typeof document === "undefined"
    ? null
    : readCookieValue(document.cookie, AUTH_CACHE_GENERATION_COOKIE);
}

function captureDocumentAuthGeneration(): void {
  if (documentAuthGeneration === undefined && typeof document !== "undefined") {
    documentAuthGeneration = readAuthGeneration();
  }
}

/** Test hook: forget that this module already navigated. */
export function resetUnauthorizedRedirectForTests(): void {
  unauthorizedRedirectStarted = false;
  documentAuthGeneration = undefined;
}

function readUnauthorizedStamp(): UnauthorizedRedirectStamp | null {
  try {
    const raw = window.sessionStorage.getItem(UNAUTHORIZED_REDIRECT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<UnauthorizedRedirectStamp>) : null;
    return parsed && typeof parsed.at === "number" && typeof parsed.count === "number"
      ? { at: parsed.at, count: parsed.count }
      : null;
  } catch {
    return null;
  }
}

function redirectOnUnauthorized(error: BookClientError): void {
  if (typeof window === "undefined" || unauthorizedRedirectStarted) return;
  if (error.status !== 401) return;
  if (documentAuthGeneration !== undefined && readAuthGeneration() !== documentAuthGeneration) {
    return;
  }
  const now = Date.now();
  const previous = readUnauthorizedStamp();
  const plan = planUnauthorizedRedirect(error, previous, now);
  if (plan === "none") return;
  const recent =
    previous && now - previous.at < UNAUTHORIZED_REDIRECT_WINDOW_MS ? previous.count : 0;
  try {
    window.sessionStorage.setItem(
      UNAUTHORIZED_REDIRECT_KEY,
      JSON.stringify({ at: now, count: recent + 1 }),
    );
  } catch {
    // Without storage the attempts cannot be counted across page loads, so
    // no loop-free promise can be made: leave the error to the page.
    return;
  }
  unauthorizedRedirectStarted = true;
  const returnTo = window.location.pathname + window.location.search;
  window.location.assign(
    `${plan === "refresh" ? "/auth/refresh" : "/auth/login"}?returnTo=${encodeURIComponent(returnTo)}`,
  );
}

/**
 * Step-up re-auth UX (#5, Tier 3). A sensitive action (export, billing portal,
 * etc.) can return 401 `reauth_required` when the user's authentication is too
 * old. When that happens, send the browser through a FORCED fresh login
 * (`prompt=login` → Cognito hosted UI re-prompts → fresh `auth_time`) and land
 * the user back where they started so they can retry.
 *
 * Returns `true` (and navigates away) if it handled a re-auth requirement, so
 * callers can stop their own error handling. Returns `false` otherwise (the
 * caller surfaces the error normally). No-op outside the browser.
 *
 * Detection is by code first (`reauth_required`), with a status+details
 * fallback, so it works whether the caller threw a `BookClientError` or read a
 * raw `Response`.
 */
export function isReauthRequired(err: unknown): boolean {
  if (err instanceof BookClientError) {
    if (err.code === "reauth_required") return true;
    if (
      err.status === 401 &&
      err.details &&
      typeof err.details === "object" &&
      (err.details as { reauth?: unknown }).reauth === true
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Raw-`Response` variant of the re-auth check for call sites that use `fetch`
 * directly (account delete/deactivate) rather than `fetchBookJson`. Returns true
 * if the response is a 401 carrying the `reauth_required` error code. Consumes
 * the body (clone if you still need it).
 */
export async function isReauthResponse(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  return body?.error?.code === "reauth_required";
}

export function redirectToReauth(returnTo?: string): void {
  if (typeof window === "undefined") return;
  const target = returnTo ?? window.location.pathname + window.location.search;
  const params = new URLSearchParams({ prompt: "login", returnTo: target });
  window.location.href = `/auth/login?${params.toString()}`;
}

/**
 * Convenience: if `err` is a step-up re-auth requirement, redirect to a forced
 * fresh login (returning to `returnTo`, defaulting to the current location) and
 * return `true`. Otherwise return `false` so the caller handles the error.
 */
export function handleReauthRequired(err: unknown, returnTo?: string): boolean {
  if (!isReauthRequired(err)) return false;
  redirectToReauth(returnTo);
  return true;
}
