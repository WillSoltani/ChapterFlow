import "server-only";
import { NextResponse } from "next/server";
import { requestIdFromHeaders } from "@/lib/api/error-envelope";
import { logger } from "@/lib/logging/logger";
import { requireUser, AuthError } from "./auth";
import { resolveBookIdentity } from "../book/_lib/identity";
import { buildSessionResponse, type SessionOutcome } from "./session-response-core";

/**
 * The single GET handler behind BOTH session-status endpoints
 * (`/app/api/auth/session` and `/app/api/me`). It resolves the current
 * credential into a {@link SessionOutcome} and lets the shared pure mapper
 * ({@link buildSessionResponse}) decide the status + body, so the two routes can
 * never drift on the anonymous field name or status again (WS4-003).
 *
 * Error classification:
 *  - AuthError("VERIFIER_UNAVAILABLE") — JWKS unreachable → verifier_unavailable
 *    (503, retry; must NOT report logged-out).
 *  - any other AuthError (UNAUTHENTICATED / INVALID_TOKEN / REAUTH_REQUIRED) —
 *    the ordinary "not signed in" result → anonymous (200 loggedIn:false).
 *  - a non-AuthError — logged and mapped to `unexpected` (503, NOT a 200
 *    logged-out flip).
 */
export async function handleSessionGet(req: Request): Promise<NextResponse> {
  const requestId = requestIdFromHeaders(req);
  let outcome: SessionOutcome;
  try {
    const user = await requireUser();
    outcome = { kind: "authenticated", identity: resolveBookIdentity(user) };
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      outcome =
        error.message === "VERIFIER_UNAVAILABLE"
          ? { kind: "verifier_unavailable" }
          : { kind: "anonymous" };
    } else {
      logger.error("session_get_unexpected_error", { err: error });
      outcome = { kind: "unexpected" };
    }
  }
  const r = buildSessionResponse(outcome, requestId);
  return NextResponse.json(r.body, { status: r.status });
}
