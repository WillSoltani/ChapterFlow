import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const destination = new URL(
    `/book/pair-accept?code=${encodeURIComponent(normalized)}`,
    req.url,
  );
  return NextResponse.redirect(destination);
}
