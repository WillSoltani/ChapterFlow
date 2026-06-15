import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet, errors as joseErrors } from "jose";
import { mustServerEnv } from "./server-env";
import { DEV_BYPASS_USER, isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";

// UNAUTHENTICATED   — no credential presented (missing cookie).
// INVALID_TOKEN     — a credential was presented but it is genuinely bad
//                     (expired / wrong signature / failed claim / no matching
//                     key in the current JWKS). The user must re-authenticate.
// VERIFIER_UNAVAILABLE — we could NOT decide validity because the JWKS could
//                     not be retrieved (transport/timeout error fetching an
//                     uncached key). This is transient: callers should return a
//                     5xx and let the client retry rather than flipping a
//                     genuinely-logged-in user to logged-out.
export type AuthErrorCode = "UNAUTHENTICATED" | "INVALID_TOKEN" | "VERIFIER_UNAVAILABLE";

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

// Identity is verified and read exclusively from the id_token cookie. The
// access_token cookie set by the auth routes is NOT a credential here — nothing
// reads it (it is reserved for a future resource-server / API Gateway
// authorizer call). Do not switch this to access_token.
const COOKIE_NAME = "id_token";

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
  email?: string;
  emailVerified?: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  preferredUsername?: string;
  groups?: string[];
};

export async function requireUser(): Promise<AuthedUser> {
  if (isDevAuthBypassEnabled()) {
    return {
      sub: DEV_BYPASS_USER.sub,
      email: DEV_BYPASS_USER.email,
      emailVerified: true,
      name: DEV_BYPASS_USER.email?.split("@")[0] || "Developer",
    };
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) throw new AuthError("UNAUTHENTICATED");

  const { issuer, jwks, clientId } = await getAuthConfig();

  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer, audience: clientId }));
  } catch (err) {
    throw new AuthError(classifyVerifyError(err));
  }

  const p = payload as Record<string, unknown>;

  const sub = p.sub;
  if (!sub || typeof sub !== "string") throw new AuthError("INVALID_TOKEN");

  const email = typeof p.email === "string" ? p.email : undefined;
  const emailVerified = typeof p.email_verified === "boolean" ? p.email_verified : undefined;
  const name = typeof p.name === "string" ? p.name : undefined;
  const givenName = typeof p.given_name === "string" ? p.given_name : undefined;
  const familyName = typeof p.family_name === "string" ? p.family_name : undefined;
  const preferredUsername =
    typeof p.preferred_username === "string" ? p.preferred_username : undefined;

  const rawGroups = p["cognito:groups"];
  const groups = Array.isArray(rawGroups)
    ? rawGroups.filter((v): v is string => typeof v === "string")
    : typeof rawGroups === "string"
      ? [rawGroups]
      : undefined;

  return {
    sub,
    email,
    emailVerified,
    name,
    givenName,
    familyName,
    preferredUsername,
    groups,
  };
}
