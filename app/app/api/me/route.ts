import { NextResponse } from "next/server";
import { requireUser, AuthError } from "../_lib/auth";
import { resolveBookIdentity } from "../book/_lib/identity";

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
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    console.error("GET /api/me unexpected error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
