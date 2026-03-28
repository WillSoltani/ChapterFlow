import { NextRequest, NextResponse } from "next/server";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { resolvePublicOrigin } from "@/app/app/_lib/server-origin";
import { resolveCognitoDomain } from "../_lib/cognito-domain";
import { getAuthCookieBase } from "../_lib/auth-cookie";
import { sanitizeReturnTo } from "../_lib/return-to";
import { applyDeviceIdCookie, getOrCreateDeviceId } from "@/app/app/api/book/_lib/abuse";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function GET(req: NextRequest) {
  const origin = resolvePublicOrigin({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
    fallbackOrigin: new URL(req.url).origin,
  });
  try {
    const domain = await resolveCognitoDomain();
    const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
    const redirectUri = await mustServerEnv("COGNITO_REDIRECT_URI");

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?auth=error", origin));
    }

    const verifier = req.cookies.get("pkce_verifier")?.value;
    const expectedState = req.cookies.get("oauth_state")?.value;
    const rawReturnTo = req.cookies.get("post_auth_redirect")?.value;
    const returnTo = sanitizeReturnTo(rawReturnTo, "/book");

    // If cookies are missing entirely (browser didn't commit them from the
    // redirect response), silently restart the login flow instead of showing
    // an error. The second attempt succeeds because cookies are set fresh.
    if (!verifier || !expectedState) {
      const loginUrl = new URL("/auth/login", origin);
      loginUrl.searchParams.set("returnTo", returnTo);
      return NextResponse.redirect(loginUrl);
    }
    if (state !== expectedState) {
      return NextResponse.redirect(new URL("/?auth=state_error", origin));
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const tokenRes = await fetch(`${domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/?auth=token_error", origin));
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>;
    const idToken = readString(tokens.id_token);
    const accessToken = readString(tokens.access_token);

    if (!idToken || !accessToken) {
      return NextResponse.redirect(new URL("/?auth=token_error", origin));
    }

    const res = NextResponse.redirect(
      returnTo.startsWith("http") ? returnTo : new URL(returnTo, origin)
    );
    const cookieBase = getAuthCookieBase();

    const commonCookie = {
      ...cookieBase,
      maxAge: Number(tokens.expires_in) || 3600,
    };

    res.cookies.set("id_token", idToken, commonCookie);
    res.cookies.set("access_token", accessToken, commonCookie);
    res.cookies.set("pkce_verifier", "", { ...cookieBase, maxAge: 0 });
    res.cookies.set("oauth_state", "", { ...cookieBase, maxAge: 0 });
    res.cookies.set("post_auth_redirect", "", { ...cookieBase, maxAge: 0 });
    const { deviceId, issued } = getOrCreateDeviceId(req);
    if (issued) {
      applyDeviceIdCookie(res, deviceId, true);
    }

    return res;
  } catch (error: unknown) {
    console.error("auth_callback_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/?auth=server_error", origin));
  }
}
