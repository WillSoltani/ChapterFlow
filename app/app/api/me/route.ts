import { NextResponse } from "next/server";
import { requireUser, AuthError } from "../_lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    return NextResponse.json({
      authenticated: true,
      user: {
        sub: user.sub,
        email: user.email,
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
