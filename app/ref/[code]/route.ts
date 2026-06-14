import { NextRequest, NextResponse } from "next/server";
import { getAuthCookieBase } from "@/app/auth/_lib/auth-cookie";
import { INSIGHT_POINTS_COOKIE_NAME } from "@/app/book/_lib/flow-points-economy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  // Land on a branded interstitial that actually acknowledges the referral,
  // instead of dumping the friend straight into the login wall with no context.
  // The attribution cookie is consumed at first profile save (onboarding).
  const destination = new URL("/ref", req.url);
  const response = NextResponse.redirect(destination);

  if (normalized) {
    response.cookies.set(INSIGHT_POINTS_COOKIE_NAME, normalized, {
      ...getAuthCookieBase(),
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return response;
}
