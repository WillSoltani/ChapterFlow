import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { mustServerEnv } from "./server-env";
import { DEV_BYPASS_USER, isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";

export class AuthError extends Error {
  constructor(message: "UNAUTHENTICATED" | "INVALID_TOKEN") {
    super(message);
    this.name = "AuthError";
  }
}

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
  } catch {
    throw new AuthError("INVALID_TOKEN");
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
