// Pure, dependency-injected Sign-in-with-Apple helpers.
//
// This file has NO `server-only` marker and NO AWS SDK imports on purpose: it is
// unit-tested directly under `tsx --test` (see the webapp test server-only trap).
// The server-only orchestration (Cognito lookup, DynamoDB token read, real fetch)
// lives in `apple-auth.ts`, which wires the real dependencies into `runAppleRevoke`.
import { SignJWT, importPKCS8 } from "jose";

/** Apple's OAuth issuer / audience for the client-secret JWT and revoke call. */
export const APPLE_AUDIENCE = "https://appleid.apple.com";
/** Apple's token-revocation endpoint (App Review requires calling this on delete). */
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

/**
 * The client-secret JWT is short-lived and minted per request. Apple allows an
 * exp up to 6 months out; a few minutes is plenty for a single revoke call and
 * limits the blast radius if the signed token ever leaks in a log.
 */
export const CLIENT_SECRET_TTL_SECONDS = 300;

/**
 * The four `APPLE_*` values (shared with B3's Apple IAP config): the team id
 * (issuer), the Services/bundle id (the OAuth client), the key id, and the .p8
 * private key. Resolved from env/SSM by the server-only wrapper.
 */
export interface AppleAuthConfig {
  /** APPLE_ISSUER_ID — the 10-char Apple Developer Team ID. JWT `iss`. */
  readonly teamId: string;
  /** APPLE_BUNDLE_ID — the Services ID / bundle id used as the OAuth client. JWT `sub` + `client_id`. */
  readonly clientId: string;
  /** APPLE_KEY_ID — the key id of the .p8 private key. JWT header `kid`. */
  readonly keyId: string;
  /** APPLE_PRIVATE_KEY — the PKCS#8 PEM of the .p8 key (literal `\n` tolerated). */
  readonly privateKey: string;
}

/** True only if every field is a non-empty string. */
export function isAppleAuthConfigComplete(
  config: { [K in keyof AppleAuthConfig]?: AppleAuthConfig[K] | undefined } | null | undefined
): config is AppleAuthConfig {
  return Boolean(
    config &&
      config.teamId &&
      config.clientId &&
      config.keyId &&
      config.privateKey
  );
}

/**
 * Env-stored PEMs frequently arrive with literal backslash-n instead of real
 * newlines (GitHub secrets, SSM SecureString round-trips). Restore the newlines
 * so `importPKCS8` can parse the key. A key that already has real newlines is
 * unchanged.
 */
export function normalizePrivateKeyPem(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/**
 * Mint the ES256 client-secret JWT Apple expects in the `client_secret` field of
 * an /auth/token or /auth/revoke request. `nowSeconds` is injected (unix seconds)
 * so the claims are deterministic under test.
 */
export async function buildAppleClientSecret(
  config: AppleAuthConfig,
  nowSeconds: number
): Promise<string> {
  const key = await importPKCS8(normalizePrivateKeyPem(config.privateKey), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + CLIENT_SECRET_TTL_SECONDS)
    .setAudience(APPLE_AUDIENCE)
    .setSubject(config.clientId)
    .sign(key);
}

export type AppleTokenTypeHint = "refresh_token" | "access_token";

export interface AppleRevokeRequest {
  readonly url: string;
  readonly method: "POST";
  readonly headers: Record<string, string>;
  /** application/x-www-form-urlencoded body. */
  readonly body: string;
}

/**
 * Build the (URL, headers, form body) for Apple's revoke endpoint. The token is
 * the user's Apple refresh (or access) token; the client_secret is the JWT from
 * `buildAppleClientSecret`. Pure — no network — so the exact request shape is
 * unit-testable.
 */
export function buildAppleRevokeRequest(params: {
  clientId: string;
  clientSecret: string;
  token: string;
  tokenTypeHint?: AppleTokenTypeHint;
}): AppleRevokeRequest {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    token: params.token,
    token_type_hint: params.tokenTypeHint ?? "refresh_token",
  });
  return {
    url: APPLE_REVOKE_URL,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  };
}

/** One entry of Cognito's `identities` user attribute (a JSON-encoded array). */
interface CognitoIdentity {
  providerName?: string;
  providerType?: string;
}

/** Tolerant parse of Cognito's `identities` attribute (a JSON string). */
export function parseCognitoIdentities(raw: string | null | undefined): CognitoIdentity[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CognitoIdentity[]) : [];
  } catch {
    return [];
  }
}

function nameIsApple(name: string | undefined): boolean {
  return typeof name === "string" && name.toLowerCase().includes("apple");
}

/**
 * Does this Cognito user have a linked Sign-in-with-Apple identity? Checks both
 * the `identities` attribute (federated providers) and the `Username` shape —
 * Cognito stores a federated Apple user as `SignInWithApple_<sub>`.
 */
export function hasLinkedAppleIdentity(params: {
  identitiesAttr?: string | null | undefined;
  username?: string | null | undefined;
}): boolean {
  const identities = parseCognitoIdentities(params.identitiesAttr);
  if (identities.some((i) => nameIsApple(i.providerName) || nameIsApple(i.providerType))) {
    return true;
  }
  return typeof params.username === "string" && /^signinwithapple_/i.test(params.username);
}

export type AppleRevokeOutcome =
  | { status: "skipped"; reason: "no_apple_identity" | "no_token" | "not_configured" }
  | { status: "revoked"; attempts: number }
  | { status: "failed"; attempts: number; error: string };

/** Minimal shape of the fetch Response fields we read. */
interface RevokeResponseLike {
  ok: boolean;
  status: number;
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<RevokeResponseLike>;

/** 5xx / 429 are transient and worth one cheap retry; 4xx won't get better. */
function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/**
 * Best-effort revoke orchestration with every dependency injected, so it is
 * unit-testable with a mocked fetch and stubbed token lookup. The server-only
 * wrapper supplies the real Cognito identity check, DynamoDB token read, global
 * fetch, clock, and logger.
 *
 * NEVER throws — the account deletion has already committed by the time this
 * runs; a revoke failure is returned as a `failed`/`skipped` outcome for the
 * caller to log, not surfaced to the user.
 */
export async function runAppleRevoke(opts: {
  hasAppleIdentity: boolean;
  config: AppleAuthConfig | null;
  getRefreshToken: () => Promise<string | null | undefined>;
  fetchImpl: FetchLike;
  now: () => number;
  log?: (event: string, fields: Record<string, unknown>) => void;
  maxAttempts?: number;
}): Promise<AppleRevokeOutcome> {
  const { hasAppleIdentity, config, getRefreshToken, fetchImpl, now, log } = opts;
  const maxAttempts = opts.maxAttempts ?? 2;

  if (!hasAppleIdentity) {
    log?.("apple_revoke_skip", { reason: "no_apple_identity" });
    return { status: "skipped", reason: "no_apple_identity" };
  }
  if (!isAppleAuthConfigComplete(config)) {
    log?.("apple_revoke_skip", { reason: "not_configured" });
    return { status: "skipped", reason: "not_configured" };
  }

  const token = await getRefreshToken();
  if (!token) {
    // Apple-linked but we hold no revocable token (e.g. hosted-UI federation never
    // exposes Apple's refresh token; only the native code-exchange flow stores one).
    log?.("apple_revoke_skip", { reason: "no_token" });
    return { status: "skipped", reason: "no_token" };
  }

  const clientSecret = await buildAppleClientSecret(config, Math.floor(now() / 1000));
  const req = buildAppleRevokeRequest({
    clientId: config.clientId,
    clientSecret,
    token,
    tokenTypeHint: "refresh_token",
  });

  let attempts = 0;
  let lastError = "";
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await fetchImpl(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      // Apple returns 200 with an empty body on success.
      if (res.ok || res.status === 200) {
        log?.("apple_revoke_ok", { attempts });
        return { status: "revoked", attempts };
      }
      lastError = `http_${res.status}`;
      if (!isRetryableStatus(res.status)) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempts < maxAttempts) log?.("apple_revoke_retry", { attempt: attempts, error: lastError });
  }

  log?.("apple_revoke_failed", { attempts, error: lastError });
  return { status: "failed", attempts, error: lastError };
}
