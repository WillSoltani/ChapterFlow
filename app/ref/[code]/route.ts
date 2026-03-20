import { NextRequest, NextResponse } from "next/server";
import { getAuthCookieBase } from "@/app/auth/_lib/auth-cookie";
import { FLOW_POINTS_COOKIE_NAME } from "@/app/book/_lib/flow-points-economy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();
  const destination = new URL("/book", req.url);
  const response = NextResponse.redirect(destination);

  if (normalized) {
    response.cookies.set(FLOW_POINTS_COOKIE_NAME, normalized, {
      ...getAuthCookieBase(),
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return response;
}
