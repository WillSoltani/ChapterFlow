import { NextRequest, NextResponse } from "next/server";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { resolvePublicOrigin } from "@/app/app/_lib/server-origin";
import { resolveCognitoDomain } from "../_lib/cognito-domain";
import { getAuthCookieBase } from "../_lib/auth-cookie";
import { sanitizeReturnTo } from "../_lib/return-to";
import { decryptState } from "../_lib/state-crypto";
import { applyDeviceIdCookie, getOrCreateDeviceId } from "@/app/app/api/book/_lib/abuse";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

// Cognito refresh tokens default to 30 days of validity. We persist the refresh
// token (httpOnly) for this window so /auth/refresh can mint fresh access/id
// tokens silently, instead of hard-ending the session at the ~1h access-token
// expiry. The exact value only needs to be an upper bound — a stale cookie just
// yields a 401 from /auth/refresh, which falls back to re-login.
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Recover the PKCE verifier and return URL from the encrypted state parameter.
 * Falls back to cookies if decryption fails (backward compatibility during
 * rolling deployments or if AUTH_STATE_SECRET is not yet configured).
 */
async function resolveAuthState(
  stateParam: string,
  req: NextRequest,
): Promise<{
  verifier: string | null;
  returnTo: string;
  nonce: string | null;
  acquisition?: { referer?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string };
}> {
  // Primary path: decrypt from URL state parameter
  const decrypted = await decryptState(stateParam);
  if (decrypted) {
    return {
      verifier: decrypted.v,
      returnTo: sanitizeReturnTo(decrypted.r, "/book"),
      nonce: decrypted.n,
      acquisition: {
        referer: decrypted.ref,
        utmSource: decrypted.us,
        utmMedium: decrypted.um,
        utmCampaign: decrypted.uc,
      },
    };
  }

  // Fallback: read from cookies (pre-upgrade compatibility)
  const verifier = req.cookies.get("pkce_verifier")?.value ?? null;
  const rawReturnTo = req.cookies.get("post_auth_redirect")?.value;
  const nonce = req.cookies.get("oauth_state")?.value ?? null;

  return {
    verifier,
    returnTo: sanitizeReturnTo(rawReturnTo, "/book"),
    nonce,
  };
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
    const stateParam = url.searchParams.get("state");

    if (!code || !stateParam) {
      return NextResponse.redirect(new URL("/?auth=error", origin));
    }

    // Recover PKCE verifier + returnTo from encrypted state (primary)
    // or cookies (fallback).
    const { verifier, returnTo, nonce, acquisition } = await resolveAuthState(
      stateParam,
      req,
    );

    if (!verifier) {
      // Neither encrypted state nor cookies had the verifier.
      // Redirect to login to start a fresh flow.
      const loginUrl = new URL("/auth/login", origin);
      loginUrl.searchParams.set("returnTo", returnTo);
      return NextResponse.redirect(loginUrl);
    }

    // Exchange authorization code + PKCE verifier for tokens
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
    const refreshToken = readString(tokens.refresh_token);

    if (!idToken || !accessToken) {
      return NextResponse.redirect(new URL("/?auth=token_error", origin));
    }

    const res = NextResponse.redirect(
      returnTo.startsWith("http") ? returnTo : new URL(returnTo, origin)
    );
    const cookieBase = getAuthCookieBase();

    const expiresIn = Number(tokens.expires_in) || 3600;
    const commonCookie = {
      ...cookieBase,
      maxAge: expiresIn,
    };

    res.cookies.set("id_token", idToken, commonCookie);
    res.cookies.set("access_token", accessToken, commonCookie);

    // Persist the refresh token (httpOnly) so /auth/refresh can silently renew
    // the session before the access token expires. Cognito only returns this on
    // the initial code exchange (refresh-token rotation is off by default), so
    // we must capture it here.
    if (refreshToken) {
      res.cookies.set("refresh_token", refreshToken, {
        ...cookieBase,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });
    }

    // Client-readable expiry timestamp for proactive session management.
    // The cookie *value* is the access-token expiry, but its *lifetime* spans
    // the whole refresh window — otherwise the cookie would evaporate at the
    // exact moment it expires, leaving TokenExpiryGuard unable to read the
    // timestamp and fire its renew/redirect logic.
    res.cookies.set("auth_expires_at", String(Math.floor(Date.now() / 1000) + expiresIn), {
      ...cookieBase,
      httpOnly: false, // Must be readable by client JS
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    // Clear ephemeral OAuth cookies
    res.cookies.set("pkce_verifier", "", { ...cookieBase, maxAge: 0 });
    res.cookies.set("oauth_state", "", { ...cookieBase, maxAge: 0 });
    res.cookies.set("post_auth_redirect", "", { ...cookieBase, maxAge: 0 });

    const { deviceId, issued } = getOrCreateDeviceId(req);
    if (issued) {
      applyDeviceIdCookie(res, deviceId, true);
    }

    // Surface acquisition signals via short-lived cookies so the first
    // profile save (onboarding) can persist them on the user record.
    if (acquisition?.referer || acquisition?.utmSource) {
      const acqMaxAge = 30 * 60; // 30 minutes
      if (acquisition.referer) {
        res.cookies.set("cf_acq_ref", acquisition.referer, { ...cookieBase, maxAge: acqMaxAge });
      }
      if (acquisition.utmSource) {
        res.cookies.set("cf_acq_us", acquisition.utmSource, { ...cookieBase, maxAge: acqMaxAge });
      }
      if (acquisition.utmMedium) {
        res.cookies.set("cf_acq_um", acquisition.utmMedium, { ...cookieBase, maxAge: acqMaxAge });
      }
      if (acquisition.utmCampaign) {
        res.cookies.set("cf_acq_uc", acquisition.utmCampaign, { ...cookieBase, maxAge: acqMaxAge });
      }
    }

    return res;
  } catch (error: unknown) {
    console.error("auth_callback_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/?auth=server_error", origin));
  }
}
