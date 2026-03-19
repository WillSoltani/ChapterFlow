import { NextResponse } from "next/server";
import { requireUser } from "@/app/app/api/_lib/auth";
import { resolveBookIdentity } from "@/app/app/api/book/_lib/identity";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ loggedIn: true, user: resolveBookIdentity(user) });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}
