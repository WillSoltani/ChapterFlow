import { NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/api/error-envelope";
import { requireUser, AuthError } from "../_lib/auth";
import { resolveBookIdentity } from "../book/_lib/identity";
import { logger } from "@/lib/logging/logger";

/**
 * Map a caught error from the `/api/me` handler onto the canonical error
 * envelope. Preserves the legacy top-level `authenticated:false` flag (clients
 * read it alongside `.error.code`). Exported so the contract test can exercise
 * the failure paths without booting the auth verifier.
 */
export function buildMeErrorResponse(req: Request, error: unknown): NextResponse {
  if (error instanceof AuthError) {
    // The verifier could not be reached (JWKS fetch failed). We cannot
    // conclude the user is logged out, so report transient unavailability
    // (503) and let the client retry instead of forcing a re-login.
    if (error.message === "VERIFIER_UNAVAILABLE") {
      return jsonErrorResponse(
        req,
        503,
        "verifier_unavailable",
        "Authentication is temporarily unavailable. Please retry."
      );
    }
    return jsonErrorResponse(req, 401, "unauthenticated", "Authentication is required.", {
      extra: { authenticated: false },
    });
  }
  logger.error("me_get_unexpected_error", { err: error });
  return jsonErrorResponse(req, 500, "server_error", "An unexpected server error occurred.", {
    extra: { authenticated: false },
  });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const identity = resolveBookIdentity(user);

    return NextResponse.json({
      authenticated: true,
      user: {
        ...identity,
      },
    });
  } catch (error: unknown) {
    return buildMeErrorResponse(req, error);
  }
}
