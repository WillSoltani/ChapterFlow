import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const jar = await cookies();
  const hasIdToken = Boolean(jar.get("id_token")?.value);
  return NextResponse.json({ loggedIn: hasIdToken });
}
