import { NextResponse, type NextRequest } from "next/server";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";

let missingConfigWarned = false;

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function resolveRequestOrigin(req: NextRequest): string {
  const forwardedHost = firstForwardedValue(
    req.headers.get("x-forwarded-host"),
  );
  const host = forwardedHost || req.headers.get("host");
  const proto =
    firstForwardedValue(req.headers.get("x-forwarded-proto")) ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) {
    return `${proto}://${host}`;
  }

  return req.nextUrl.origin;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public, unauthenticated endpoints that live under an otherwise-protected
  // prefix. One-click email unsubscribe (CASL/CAN-SPAM) is token-authenticated
  // and must work for logged-out recipients and automated mail clients.
  if (pathname.startsWith("/app/api/book/email/unsubscribe")) {
    return NextResponse.next();
  }

  const protectedSurface =
    pathname.startsWith("/app") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/dashboard");

  if (!protectedSurface) {
    return NextResponse.next();
  }

  // Dev bypass — allow all in development when enabled or Cognito not configured
  if (isDevAuthBypassEnabled()) {
    return NextResponse.next();
  }

  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.COGNITO_REGION || !process.env.COGNITO_USER_POOL_ID)
  ) {
    if (!missingConfigWarned) {
      missingConfigWarned = true;
      console.warn(
        "middleware_auth_skip: COGNITO env vars not set in dev; skipping auth check",
      );
    }
    return NextResponse.next();
  }

  // Lightweight cookie-presence + expiry check. Full JWT verification
  // happens in requireUser() at the route/API level.
  const token = req.cookies.get("id_token")?.value;
  const expiresAt = Number(req.cookies.get("auth_expires_at")?.value);
  const isExpired =
    Number.isFinite(expiresAt) && expiresAt <= Math.floor(Date.now() / 1000);

  if (!token || isExpired) {
    const publicOrigin = resolveRequestOrigin(req);
    const currentTarget = new URL(
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
      publicOrigin,
    );
    const loginUrl = new URL("/auth/login", publicOrigin);
    loginUrl.searchParams.set("returnTo", currentTarget.toString());
    const res = NextResponse.redirect(loginUrl);

    // Clear any stale token fragments
    res.cookies.set("id_token", "", { path: "/", maxAge: 0 });
    res.cookies.set("access_token", "", { path: "/", maxAge: 0 });

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/book/:path*", "/dashboard/:path*"],
};
