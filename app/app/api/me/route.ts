import { NextResponse } from "next/server";
import { requireUser, AuthError } from "../_lib/auth";
import { resolveBookIdentity } from "../book/_lib/identity";
import { logger } from "@/lib/logging/logger";

export async function GET() {
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
    if (error instanceof AuthError) {
      // The verifier could not be reached (JWKS fetch failed). We cannot
      // conclude the user is logged out, so report transient unavailability
      // (503) and let the client retry instead of forcing a re-login.
      if (error.message === "VERIFIER_UNAVAILABLE") {
        return NextResponse.json({ error: "auth_verifier_unavailable" }, { status: 503 });
      }
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    logger.error("me_get_unexpected_error", { err: error });
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
