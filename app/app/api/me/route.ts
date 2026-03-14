import { NextResponse } from "next/server";
import { requireUser } from "../_lib/auth";

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
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
