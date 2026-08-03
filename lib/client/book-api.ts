"use client";

// Canonical client data-access boundary (WS3-001).

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
    throw new BookClientError(message, response.status, code, details);
  }

  return payload as T;
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
