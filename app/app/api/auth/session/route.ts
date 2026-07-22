import "server-only";
import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/api/error-envelope";
import { requireUser, AuthError } from "../../_lib/auth";
import { resolveBookIdentity } from "../../book/_lib/identity";

export const runtime = "nodejs";

/**
 * Map a caught error from the `/api/auth/session` handler. A transient verifier
 * outage returns a 503 error envelope carrying the legacy top-level
 * `loggedIn:null` flag (useAuthStatus reads `data.loggedIn`), so the client
 * retries rather than flipping a genuinely-logged-in user to logged-out. Any
 * other error is an ordinary "not signed in" result — a 200 `loggedIn:false`
 * anonymous body (WS4-003 territory). Exported so the contract test can exercise
 * the verifier path without booting the auth verifier.
 */
export function buildSessionErrorResponse(req: Request, error: unknown): NextResponse {
  if (error instanceof AuthError && error.message === "VERIFIER_UNAVAILABLE") {
    return jsonErrorResponse(
      req,
      503,
      "verifier_unavailable",
      "Authentication is temporarily unavailable. Please retry.",
      { extra: { loggedIn: null } }
    );
  }
  return NextResponse.json({ loggedIn: false }, { status: 200 });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    return NextResponse.json(
      {
        loggedIn: true,
        user: resolveBookIdentity(user),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return buildSessionErrorResponse(req, error);
  }
}
