import { NextResponse, type NextRequest } from "next/server";
import { resolvePublicOrigin } from "@/app/app/_lib/server-origin";
import {
  GUEST_PROJECT_ID,
  GUEST_SESSION_COOKIE,
  guestCookieOptions,
  newGuestSessionId,
  normalizeGuestSessionId,
} from "@/app/app/api/_lib/guest-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const existing = normalizeGuestSessionId(req.cookies.get(GUEST_SESSION_COOKIE)?.value ?? null);
  const sessionId = existing ?? newGuestSessionId();
  const origin = resolvePublicOrigin({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
    fallbackOrigin: req.nextUrl.origin,
  });
  const redirectUrl = new URL(`/app/projects/${GUEST_PROJECT_ID}`, origin);

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.set(GUEST_SESSION_COOKIE, sessionId, guestCookieOptions());
  return res;
}
