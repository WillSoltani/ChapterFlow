import { NextRequest, NextResponse } from "next/server";
import { jsonErrorResponse } from "@/lib/api/error-envelope";
import { resolvePublicOrigin } from "@/app/app/_lib/server-origin";
import {
  REFRESH_ATTEMPT_COOKIE,
  REFRESH_ATTEMPT_MAX_AGE_SECONDS,
  isSessionCookieFresh,
} from "@/lib/middleware-auth-core";
import { getAuthCookieBase } from "../_lib/auth-cookie";
import { sanitizeReturnTo } from "../_lib/return-to";
import {
  REFRESH_DEFAULT_RETURN_TO,
  loginPathFor,
  planRefreshGet,
  resolveRefreshReturnTo,
} from "./refresh-core";
import {
  applyRefreshFailureCookies,
  applyRefreshedSession,
  exchangeRefreshToken,
  type RefreshFailureReason,
} from "./refresh-exchange";

export const runtime = "nodejs";

const FAILURE_RESPONSES: Record<
  RefreshFailureReason,
  { status: number; message: string }
> = {
  rate_limited: { status: 429, message: "Too many refresh attempts. Please retry shortly." },
  no_refresh_token: { status: 401, message: "No refresh token was provided." },
  config_error: {
    status: 500,
    message: "Authentication is temporarily misconfigured. Please retry.",
  },
  upstream_error: {
    status: 502,
    message: "The authentication service is unavailable. Please retry.",
  },
  refresh_rejected: { status: 401, message: "Your session has expired. Please sign in again." },
  bad_upstream_body: {
    status: 502,
    message: "The authentication service returned an invalid response. Please retry.",
  },
  incomplete_tokens: {
    status: 401,
    message: "The refresh response was incomplete. Please sign in again.",
  },
  account_deleted: { status: 401, message: "This account is no longer active." },
};

/**
 * Silent session renewal. TokenExpiryGuard calls this shortly before the access
 * token expires; it exchanges the httpOnly refresh_token cookie for fresh
 * access/id tokens via Cognito's refresh_token grant and rewrites the session
 * cookies. Returns { ok, expiresAt } on success so the client can reschedule
 * its next renewal. A 401 means the refresh token is gone/expired/revoked and
 * the client should fall back to a full login.
 */
export async function POST(req: NextRequest) {
  const result = await exchangeRefreshToken(req);
  if (!result.ok) {
    const { status, message } = FAILURE_RESPONSES[result.reason];
    const res = jsonErrorResponse(
      req,
      status,
      result.reason,
      message,
      result.reason === "rate_limited" ? { headers: { "Retry-After": "30" } } : undefined,
    );
    applyRefreshFailureCookies(res, result.reason);
    return res;
  }

  const res = NextResponse.json({ ok: true, expiresAt: result.expiresAt });
  applyRefreshedSession(req, res, result);
  return res;
}

/**
 * Cold-load renewal (SHELL-01). Middleware sends a document navigation here when
 * its session cookie is missing or expired but a refresh_token cookie is still
 * present. On success the session cookies are rewritten and the reader lands on
 * the sanitized same-origin returnTo; on any failure they go to /auth/login
 * exactly as before. A host-only marker cookie limits this to one exchange per
 * navigation, so a refresh that does not yield a usable session cannot loop.
 * Every response is no-store: a renewal carries session cookies on a URL that
 * many readers share (returnTo=/dashboard), so no cache may keep one.
 */
export async function GET(req: NextRequest) {
  const res = await refreshOnNavigation(req);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function refreshOnNavigation(req: NextRequest): Promise<NextResponse> {
  const origin = resolvePublicOrigin({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
    fallbackOrigin: req.nextUrl.origin,
  });
  const returnTo = resolveRefreshReturnTo(
    sanitizeReturnTo(req.nextUrl.searchParams.get("returnTo"), REFRESH_DEFAULT_RETURN_TO),
  );
  const toLogin = () => NextResponse.redirect(new URL(loginPathFor(returnTo), origin));

  const plan = planRefreshGet({
    sessionFresh: isSessionCookieFresh(
      req.cookies.get("id_token")?.value,
      req.cookies.get("auth_expires_at")?.value,
      Math.floor(Date.now() / 1000),
    ),
    refreshAttempted: Boolean(req.cookies.get(REFRESH_ATTEMPT_COOKIE)?.value),
    hasRefreshToken: Boolean(req.cookies.get("refresh_token")?.value),
  });
  if (plan === "return") return NextResponse.redirect(new URL(returnTo, origin));
  if (plan === "login") return toLogin();

  let res: NextResponse;
  try {
    const result = await exchangeRefreshToken(req);
    if (result.ok) {
      res = NextResponse.redirect(new URL(returnTo, origin));
      applyRefreshedSession(req, res, result);
    } else {
      // A deleted account goes to the deleted-account terminus (which clears
      // the rest of the session); every other failure signs in as before.
      res =
        result.reason === "account_deleted"
          ? NextResponse.redirect(new URL("/auth/login?reason=deleted", origin))
          : toLogin();
      applyRefreshFailureCookies(res, result.reason);
    }
  } catch {
    res = toLogin();
  }

  // Host-only on purpose: it must stick even if the browser rejects the
  // domain-scoped session cookies, which is exactly the loop it guards against.
  const { domain: _domain, ...markerBase } = getAuthCookieBase();
  res.cookies.set(REFRESH_ATTEMPT_COOKIE, "1", {
    ...markerBase,
    maxAge: REFRESH_ATTEMPT_MAX_AGE_SECONDS,
  });
  return res;
}
