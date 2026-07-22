import { NextResponse } from "next/server";

/**
 * The single JSON error shape every HTTP handler in the app returns. A machine
 * `code`, a human `message`, and a `requestId` that ties the client-visible
 * error to its server log line. `details` is an optional structured hint
 * (present only when the handler supplies one).
 *
 * This module is deliberately stack-neutral (NO `server-only` import) so the
 * three route stacks — `app/api/**`, `app/auth/**`, and `app/app/api/**` — plus
 * their unit tests can all share one serializer.
 */
export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

/**
 * Resolve a stable correlation id for a request. Prefers the AWS-injected
 * `x-amzn-trace-id` (so the envelope's requestId matches CloudWatch's trace),
 * falling back to a fresh UUID when the header is absent (local/dev).
 */
export function requestIdFromHeaders(req: Request): string {
  return req.headers.get("x-amzn-trace-id") || crypto.randomUUID();
}

/**
 * Build the canonical error response. Every JSON error path across the three
 * route stacks funnels through here so the body is always
 * `{ error: { code, message, requestId, details? } }`.
 *
 * `opts.extra` carries back-compat top-level flags (e.g. `authenticated:false`,
 * `loggedIn:null`) that legacy clients read alongside the error object; they are
 * spread BEFORE `error` so a caller can never clobber the envelope's `error`
 * key. `opts.headers` threads response headers (e.g. `Retry-After`) and
 * `opts.requestId` overrides the header-derived id when a caller already
 * computed one (so the logged line and the envelope share it).
 */
export function jsonErrorResponse(
  req: Request,
  status: number,
  code: string,
  message: string,
  opts?: {
    details?: unknown;
    requestId?: string;
    headers?: HeadersInit;
    extra?: Record<string, unknown>;
  }
): NextResponse {
  return NextResponse.json(
    {
      ...opts?.extra,
      error: {
        code,
        message,
        requestId: opts?.requestId ?? requestIdFromHeaders(req),
        ...(opts?.details !== undefined ? { details: opts.details } : {}),
      },
    },
    { status, headers: opts?.headers }
  );
}
