import "server-only";
import { cookies, headers } from "next/headers";
import { jwtVerify, createRemoteJWKSet, errors as joseErrors } from "jose";
import { mustServerEnv } from "./server-env";
import { DEV_BYPASS_USER, isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import { evaluateAuthRecency, mapIdTokenClaims } from "./auth-recency-core";
import {
  AUTH_COOKIE_NAME,
  parseBearerToken,
  resolveCredentialToken,
} from "./auth-credential-core";

// UNAUTHENTICATED   — no credential presented (missing cookie).
// INVALID_TOKEN     — a credential was presented but it is genuinely bad
//                     (expired / wrong signature / failed claim / wrong
//                     token_use / no matching key in the current JWKS). The user
//                     must re-authenticate.
// VERIFIER_UNAVAILABLE — we could NOT decide validity because the JWKS could
//                     not be retrieved (transport/timeout error fetching an
//                     uncached key). This is transient: callers should return a
//                     5xx and let the client retry rather than flipping a
//                     genuinely-logged-in user to logged-out.
// REAUTH_REQUIRED   — the token is valid but the authentication is too old for a
//                     sensitive action (step-up auth, #5). The caller must
//                     re-authenticate (fresh login) before retrying. Maps to a
//                     401 `reauth_required`, NOT a generic 401 — the client uses
//                     the distinct code to trigger a forced fresh login.
export type AuthErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_TOKEN"
  | "VERIFIER_UNAVAILABLE"
  | "REAUTH_REQUIRED";

export class AuthError extends Error {
  constructor(message: AuthErrorCode) {
    super(message);
    this.name = "AuthError";
  }
}

// jose error codes that mean the token (or the matched key) is genuinely
// invalid — i.e. the verifier reached a deterministic "no" verdict. Anything
// NOT in this set that originates from JWKS retrieval is treated as transient.
const GENUINELY_INVALID_TOKEN_CODES = new Set<string>([
  "ERR_JWT_EXPIRED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_INVALID",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JOSE_NOT_SUPPORTED",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  "ERR_JWK_INVALID",
  "ERR_JWKS_INVALID",
]);

// Decide whether a thrown verify error means "token is bad" (INVALID_TOKEN) or
// "we couldn't reach a verdict" (VERIFIER_UNAVAILABLE). A JWKS fetch timeout
// (ERR_JWKS_TIMEOUT) and any non-JOSE transport error (fetch TypeError,
// ECONNREFUSED/ENOTFOUND/ETIMEDOUT, undici errors, AbortError) raised while
// retrieving an uncached key are transient.
function classifyVerifyError(err: unknown): "INVALID_TOKEN" | "VERIFIER_UNAVAILABLE" {
  if (err instanceof joseErrors.JOSEError) {
    return GENUINELY_INVALID_TOKEN_CODES.has(err.code) ? "INVALID_TOKEN" : "VERIFIER_UNAVAILABLE";
  }
  // Not a jose error at all: this surfaced from the underlying JWKS fetch
  // (createRemoteJWKSet does the network call lazily). Treat as transient so a
  // logged-in user is not flipped to logged-out by an upstream blip.
  return "VERIFIER_UNAVAILABLE";
}

// Identity is carried by the Cognito **id_token**, presented via EITHER the
// `id_token` cookie (the default for the web app) OR an `Authorization: Bearer
// <id_token>` header (for native clients that cannot send cookies). Both are
// verified IDENTICALLY below. The access_token (cookie or header) is NEVER a
// credential here — nothing reads it (it is reserved for a future
// resource-server / API Gateway authorizer call), and an access_token that
// reached this reader would be rejected by the `token_use === "id"` check in
// `mapIdTokenClaims`. Do not switch identity to the access_token.
// The cookie name lives in `auth-credential-core` (AUTH_COOKIE_NAME) so the
// same-origin/CSRF guard can probe for it without importing this server module.

type AuthConfig = {
  issuer: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
  clientId: string;
};

let cachedAuthConfigPromise: Promise<AuthConfig> | null = null;

async function getAuthConfig(): Promise<AuthConfig> {
  if (cachedAuthConfigPromise) return cachedAuthConfigPromise;

  cachedAuthConfigPromise = (async () => {
    const region = await mustServerEnv("COGNITO_REGION");
    const userPoolId = await mustServerEnv("COGNITO_USER_POOL_ID");
    const clientId = await mustServerEnv("COGNITO_CLIENT_ID");
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    return { issuer, jwks, clientId };
  })();

  // Clear cache on failure so the next request retries instead of
  // permanently returning the rejected promise.
  cachedAuthConfigPromise.catch(() => {
    cachedAuthConfigPromise = null;
  });

  return cachedAuthConfigPromise;
}

export type AuthedUser = {
  sub: string;
  email?: string | undefined;
  emailVerified?: boolean | undefined;
  name?: string | undefined;
  givenName?: string | undefined;
  familyName?: string | undefined;
  preferredUsername?: string | undefined;
  groups?: string[] | undefined;
  /**
   * OIDC `auth_time` claim — seconds since epoch at which the END-USER actually
   * authenticated (NOT when the token was minted; a silent refresh keeps the
   * original auth_time). Used by `requireRecentAuth` for step-up auth (#5).
   * Undefined when the IdP did not emit the claim.
   */
  authTime?: number | undefined;
};

export async function requireUser(): Promise<AuthedUser> {
  if (isDevAuthBypassEnabled()) {
    return {
      sub: DEV_BYPASS_USER.sub,
      email: DEV_BYPASS_USER.email,
      emailVerified: true,
      name: DEV_BYPASS_USER.email?.split("@")[0] || "Developer",
      // Dev bypass authenticates "now" so step-up gates pass locally.
      authTime: Math.floor(Date.now() / 1000),
    };
  }

  // Resolve the credential from the cookie (web default) OR the Authorization
  // header (native fallback). The cookie wins when both are present so a live
  // browser session is authoritative. Both `cookies()` and `headers()` read the
  // SAME incoming request, so there is no cross-request bleed.
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const cookieToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const bearerToken = parseBearerToken(headerStore.get("authorization"));
  const token = resolveCredentialToken({ cookieToken, bearerToken });
  if (!token) throw new AuthError("UNAUTHENTICATED");

  const { issuer, jwks, clientId } = await getAuthConfig();

  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer, audience: clientId }));
  } catch (err) {
    throw new AuthError(classifyVerifyError(err));
  }

  // Map verified claims into the identity subset. This enforces:
  //  - token_use === "id" (#15): jwtVerify already checks issuer + audience, but
  //    an access token from the SAME pool shares the issuer and (for app-client
  //    tokens) can present a matching aud/client_id, so it could otherwise slip
  //    through and be treated as identity. The wrong credential type is a
  //    DETERMINISTIC "no" → INVALID_TOKEN (force re-auth, 4xx), NOT
  //    verifier-unavailable.
  //  - a non-empty string `sub`.
  // The `auth_time` claim is extracted here for step-up auth (#5). Pure mapping
  // lives in mapIdTokenClaims so it is unit-testable without `server-only`.
  const mapped = mapIdTokenClaims(payload as Record<string, unknown>);
  if (!mapped.valid) throw new AuthError("INVALID_TOKEN");
  return mapped.user;
}

/**
 * Step-up auth gate (#5). Throws `AuthError("REAUTH_REQUIRED")` when the user's
 * authentication (`authTime`) is missing or older than `maxAgeMinutes`. Pure
 * decision lives in {@link evaluateAuthRecency}; this wrapper supplies the clock.
 *
 * IMPORTANT ordering: call this AFTER the auth + account-status guard
 * (`requireUser()` / `requireActiveBookUser()`) has resolved the user — it only
 * decides recency, it does not authenticate. `withBookApiErrors` maps the thrown
 * AuthError to `BookApiError(401, "reauth_required", …)`.
 *
 * This NEVER locks out a legitimate user whose token is merely old-but-valid: it
 * forces a fresh login (`prompt=login`) and the action can then be retried. A
 * silent token refresh does NOT reset `auth_time`, so a long-lived session that
 * has not genuinely re-authenticated WILL be asked to — by design.
 */
export function requireRecentAuth(user: AuthedUser, maxAgeMinutes: number): void {
  const decision = evaluateAuthRecency({
    authTimeSeconds: user.authTime,
    maxAgeMinutes,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!decision.ok) throw new AuthError("REAUTH_REQUIRED");
}
