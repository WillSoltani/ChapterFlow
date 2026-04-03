import { NextRequest, NextResponse } from "next/server";
import { mustServerEnv } from "@/app/app/api/_lib/server-env";
import { resolveCognitoDomain } from "../_lib/cognito-domain";
import { getAuthCookieBase } from "../_lib/auth-cookie";
import { sanitizeReturnTo } from "../_lib/return-to";
import { encryptState } from "../_lib/state-crypto";

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

export async function GET(req: NextRequest) {
  const domain = await resolveCognitoDomain();
  const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
  const redirectUri = await mustServerEnv("COGNITO_REDIRECT_URI");

  if (!domain || !clientId || !redirectUri) {
    return new NextResponse("Missing server env vars", { status: 500 });
  }

  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get("returnTo"), "/book");

  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  // Encrypt the PKCE verifier, return URL, and a nonce into the state
  // parameter. Cognito echoes this back via URL, so the callback can
  // recover these values without depending on cookies.
  // If AUTH_STATE_SECRET isn't configured, fall back to a plain UUID as
  // state — the callback will use cookies instead (original behavior).
  const nonce = crypto.randomUUID();
  const encrypted = await encryptState({ v: codeVerifier, r: returnTo, n: nonce });
  const state = encrypted ?? nonce;

  const url =
    `${domain}/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;

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
}
