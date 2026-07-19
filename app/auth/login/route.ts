import { NextRequest, NextResponse } from "next/server";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { resolvePublicOrigin } from "@/app/app/_lib/server-origin";
import { resolveCognitoDomain } from "../_lib/cognito-domain";
import { getAuthCookieBase } from "../_lib/auth-cookie";
import { rotateAuthCacheGeneration } from "../_lib/auth-cache-generation";
import { sanitizeReturnTo } from "../_lib/return-to";
import { encryptState } from "../_lib/state-crypto";

// Identity providers the branded entry screen is allowed to deep-link into.
// Validated server-side so a crafted ?identity_provider= value can never be
// injected verbatim into the Cognito authorize URL. Names must match the
// provider names configured in the Cognito user pool.
const ALLOWED_IDPS = new Set(["Google", "SignInWithApple", "COGNITO"]);

function base64UrlEncode(bytes: Uint8Array) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = Buffer.from(str, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomBase64Url(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]");

/** Only forward a login_hint that looks like a plausible email, capped in length. */
function sanitizeLoginHint(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 254);
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

export async function GET(req: NextRequest) {
  const origin = resolvePublicOrigin({
    hostHeader: req.headers.get("host"),
    forwardedHostHeader: req.headers.get("x-forwarded-host"),
    forwardedProtoHeader: req.headers.get("x-forwarded-proto"),
    fallbackOrigin: req.nextUrl.origin,
  });

  try {
    // Deleted-account terminus. requireDashboardAccess() redirects deleted users
    // to /auth/login?reason=deleted; if we forwarded that to Cognito, the still-
    // live IdP session would silently re-issue a code and loop them back to /book
    // → deleted → login forever. Instead, clear the local session and land them
    // on the explainer page (which offers a full IdP logout). Clearing the cookies
    // also means the *next* /book hit sees UNAUTHENTICATED, not "deleted", so the
    // loop cannot re-form.
    if (req.nextUrl.searchParams.get("reason") === "deleted") {
      const res = NextResponse.redirect(new URL("/account-deleted", origin));
      const cookieBase = getAuthCookieBase();
      res.cookies.set("id_token", "", { ...cookieBase, maxAge: 0 });
      res.cookies.set("access_token", "", { ...cookieBase, maxAge: 0 });
      // Clear the refresh token too — otherwise a deleted account keeps a live
      // 30-day credential that /auth/refresh would happily re-mint into a fresh
      // session (soft-delete is a DynamoDB status, not a Cognito disable).
      res.cookies.set("refresh_token", "", { ...cookieBase, maxAge: 0 });
      res.cookies.set("auth_expires_at", "", { ...cookieBase, httpOnly: false, maxAge: 0 });
      rotateAuthCacheGeneration(res);
      return res;
    }

    // mustServerEnv / resolveCognitoDomain throw "Missing env var: …" when a
    // required Cognito variable is unset. Inside this try, a misconfigured
    // deploy yields a graceful redirect to /?auth=server_error instead of a raw
    // Next 500 on the primary sign-in entry point (mirrors callback/route.ts).
    const domain = await resolveCognitoDomain();
    const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
    const redirectUri = await mustServerEnv("COGNITO_REDIRECT_URI");

    const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get("returnTo"), "/book");

    // Optional branded deep-links from the entry screen: jump straight into a
    // social IdP, and/or prefill the email on the hosted UI.
    const idpParam = req.nextUrl.searchParams.get("identity_provider");
    const identityProvider = idpParam && ALLOWED_IDPS.has(idpParam) ? idpParam : null;
    const loginHint = sanitizeLoginHint(req.nextUrl.searchParams.get("login_hint"));

    // Step-up re-auth (#5, Tier 3). When a sensitive action returns 401
    // `reauth_required`, the client redirects here with `?prompt=login` (and a
    // returnTo back to the originating action). We forward `prompt=login` to the
    // Cognito authorize URL so the hosted UI forces a FRESH interactive
    // authentication — even if the IdP session is still live — which mints a
    // token with a current `auth_time`, clearing the step-up gate on retry.
    // Boolean-flag only (any presence of the param enables it).
    const forceReauth =
      req.nextUrl.searchParams.has("prompt") || req.nextUrl.searchParams.get("reauth") === "1";

    const codeVerifier = randomBase64Url(32);
    const codeChallenge = await sha256Base64Url(codeVerifier);

    // Capture acquisition signals (referer + UTM) for first-touch attribution.
    // Truncate to keep state payload small.
    const referer = (req.headers.get("referer") ?? "").slice(0, 512);
    const utmSource = (req.nextUrl.searchParams.get("utm_source") ?? "").slice(0, 64);
    const utmMedium = (req.nextUrl.searchParams.get("utm_medium") ?? "").slice(0, 64);
    const utmCampaign = (req.nextUrl.searchParams.get("utm_campaign") ?? "").slice(0, 64);

    const nonce = crypto.randomUUID();
    const encrypted = await encryptState({
      v: codeVerifier,
      r: returnTo,
      n: nonce,
      ref: referer || undefined,
      us: utmSource || undefined,
      um: utmMedium || undefined,
      uc: utmCampaign || undefined,
    });
    const state = encrypted ?? nonce;

    let url =
      `${domain}/oauth2/authorize` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("openid email profile")}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`;

    if (identityProvider) {
      url += `&identity_provider=${encodeURIComponent(identityProvider)}`;
    }
    if (loginHint) {
      url += `&login_hint=${encodeURIComponent(loginHint)}`;
    }
    if (forceReauth) {
      // `prompt=login` is Cognito's supported mechanism to force a fresh
      // interactive authentication (even with a live IdP session), which mints a
      // token with a current `auth_time` and clears the step-up gate on retry.
      // (`max_age` is not a documented Cognito /oauth2/authorize parameter, so we
      // rely on `prompt=login` alone.)
      url += `&prompt=login`;
    }

    const res = NextResponse.redirect(url);
    const cookieBase = getAuthCookieBase();

    // Keep cookies as a backward-compatible fallback. The callback will
    // prefer the encrypted state parameter but falls back to cookies if
    // decryption fails (e.g. during rolling deployment).
    res.cookies.set("oauth_state", nonce, {
      ...cookieBase,
      maxAge: 10 * 60,
    });

    res.cookies.set("pkce_verifier", codeVerifier, {
      ...cookieBase,
      maxAge: 10 * 60,
    });

    res.cookies.set("post_auth_redirect", returnTo, {
      ...cookieBase,
      maxAge: 10 * 60,
    });

    return res;
  } catch (error: unknown) {
    console.error("auth_login_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/?auth=server_error", origin));
  }
}
