import "server-only";
import { NextResponse } from "next/server";
import { requireUser } from "../../_lib/auth";
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
  } catch {
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  }
}
