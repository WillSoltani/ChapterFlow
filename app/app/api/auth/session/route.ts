import "server-only";
import { NextResponse } from "next/server";
import { requireUser, AuthError } from "../../_lib/auth";
import { resolveBookIdentity } from "../../book/_lib/identity";

export const runtime = "nodejs";

export async function GET() {
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
    // When the JWKS verifier is transiently unreachable we cannot decide
    // whether the session is valid. Return 5xx (with loggedIn:null) instead of
    // a definitive loggedIn:false so the client retries rather than flipping a
    // genuinely-logged-in user's UI to logged-out.
    if (error instanceof AuthError && error.message === "VERIFIER_UNAVAILABLE") {
      return NextResponse.json({ loggedIn: null }, { status: 503 });
    }
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  }
}
