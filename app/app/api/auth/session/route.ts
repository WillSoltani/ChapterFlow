import "server-only";
import { NextResponse } from "next/server";
import { requireUser } from "../../_lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ loggedIn: true }, { status: 200 });
  } catch {
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  }
}
