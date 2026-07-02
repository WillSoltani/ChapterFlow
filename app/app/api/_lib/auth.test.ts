import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Integration coverage for requireUser()'s DUAL credential transports: the
// `id_token` cookie (web default) and the `Authorization: Bearer <id_token>`
// header (native fallback). Both must be verified IDENTICALLY — same JWKS,
// issuer, audience, and token_use==="id".
//
// requireUser pulls `server-only` + `next/headers` + `jose`. We neutralize
// `server-only`, mock `next/headers` to feed a controllable cookie/Authorization
// header, and intercept ONLY `jose.createRemoteJWKSet` so the REAL `jwtVerify`
// runs against a locally-generated key set (no network). Using the real verifier
// proves the Bearer path enforces issuer/audience/expiry/signature/token_use —
// not a stub. Static imports hoist, so the patch is installed here (top-level)
// BEFORE any dynamic import of ./auth.

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;

// Per-request inputs the mocked next/headers returns; each test sets them.
let currentCookie: string | null = null;
let currentAuthHeader: string | null = null;
// The local JWKS the mocked createRemoteJWKSet hands to the real jwtVerify.
let localJwks: unknown = null;

Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  if (request === "next/headers") {
    return {
      cookies: async () => ({
        get: (name: string) =>
          name === "id_token" && currentCookie ? { value: currentCookie } : undefined,
      }),
      headers: async () => ({
        get: (name: string) =>
          name.toLowerCase() === "authorization" ? currentAuthHeader : null,
      }),
    };
  }
  if (request === "jose") {
    const real = originalLoad.call(this, "jose", parent, isMain) as Record<string, unknown>;
    // Keep the REAL jwtVerify + errors; only swap the remote key fetch for the
    // in-memory local set generated in before().
    return { ...real, createRemoteJWKSet: () => localJwks };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TESTPOOL";
const CLIENT_ID = "test-client-id";
const KID = "test-kid";

let requireUser: typeof import("./auth").requireUser;
let AuthError: typeof import("./auth").AuthError;
let validIdToken: string;
let expiredIdToken: string;
let wrongSigToken: string;
let accessToken: string;
let wrongAudienceToken: string;

before(async () => {
  process.env.COGNITO_REGION = "us-east-1";
  process.env.COGNITO_USER_POOL_ID = "us-east-1_TESTPOOL";
  process.env.COGNITO_CLIENT_ID = CLIENT_ID;
  delete process.env.DEV_AUTH_BYPASS; // exercise the real verify path, not the dev bypass

  const jose = await import("jose");
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256");
  const wrongPair = await jose.generateKeyPair("RS256");
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.kid = KID;
  publicJwk.alg = "RS256";
  localJwks = jose.createLocalJWKSet({ keys: [publicJwk] });

  const nowSec = Math.floor(Date.now() / 1000);
  const sign = (
    claims: Record<string, unknown>,
    opts: { key?: CryptoKey; aud?: string; exp?: number } = {}
  ) =>
    new jose.SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer(ISSUER)
      .setAudience(opts.aud ?? CLIENT_ID)
      .setSubject("user-sub-123")
      .setIssuedAt(nowSec)
      .setExpirationTime(opts.exp ?? nowSec + 3600)
      .sign(opts.key ?? privateKey);

  validIdToken = await sign({ token_use: "id", email: "a@b.com", email_verified: true, auth_time: nowSec });
  expiredIdToken = await sign({ token_use: "id" }, { exp: nowSec - 3600 });
  wrongSigToken = await sign({ token_use: "id" }, { key: wrongPair.privateKey });
  accessToken = await sign({ token_use: "access", scope: "aws.cognito.signin.user.admin" });
  wrongAudienceToken = await sign({ token_use: "id" }, { aud: "some-other-client" });

  ({ requireUser, AuthError } = await import("./auth"));
});

after(() => {
  Module._load = originalLoad;
});

async function expectAuthError(code: string) {
  await assert.rejects(
    () => requireUser(),
    (e: unknown) => e instanceof AuthError && e.message === code,
    `expected AuthError("${code}")`
  );
}

// ─── Bearer header path (the native-client addition) ──────────────────────────

test("a valid id_token in the Authorization: Bearer header authenticates", async () => {
  currentCookie = null;
  currentAuthHeader = `Bearer ${validIdToken}`;
  const user = await requireUser();
  assert.equal(user.sub, "user-sub-123");
  assert.equal(user.email, "a@b.com");
  assert.equal(user.emailVerified, true);
});

test("an invalid Bearer token (bad signature) → INVALID_TOKEN", async () => {
  currentCookie = null;
  currentAuthHeader = `Bearer ${wrongSigToken}`;
  await expectAuthError("INVALID_TOKEN");
});

test("a malformed Bearer token → INVALID_TOKEN", async () => {
  currentCookie = null;
  currentAuthHeader = "Bearer not.a.jwt";
  await expectAuthError("INVALID_TOKEN");
});

test("an expired Bearer token → INVALID_TOKEN", async () => {
  currentCookie = null;
  currentAuthHeader = `Bearer ${expiredIdToken}`;
  await expectAuthError("INVALID_TOKEN");
});

test("a Bearer ACCESS token is rejected — identity must be an id_token (#3) → INVALID_TOKEN", async () => {
  currentCookie = null;
  currentAuthHeader = `Bearer ${accessToken}`;
  await expectAuthError("INVALID_TOKEN");
});

test("a Bearer id_token minted for a DIFFERENT audience → INVALID_TOKEN", async () => {
  currentCookie = null;
  currentAuthHeader = `Bearer ${wrongAudienceToken}`;
  await expectAuthError("INVALID_TOKEN");
});

test("a non-Bearer Authorization scheme is ignored → UNAUTHENTICATED", async () => {
  currentCookie = null;
  currentAuthHeader = "Basic dXNlcjpwYXNz";
  await expectAuthError("UNAUTHENTICATED");
});

// ─── Cookie path (unchanged web behavior) + precedence ────────────────────────

test("a valid id_token in the cookie still authenticates (web default preserved)", async () => {
  currentCookie = validIdToken;
  currentAuthHeader = null;
  const user = await requireUser();
  assert.equal(user.sub, "user-sub-123");
});

test("the cookie WINS when both a cookie and a Bearer header are present", async () => {
  // Valid cookie + garbage Bearer → the cookie is used, so it succeeds.
  currentCookie = validIdToken;
  currentAuthHeader = "Bearer garbage.token.value";
  const user = await requireUser();
  assert.equal(user.sub, "user-sub-123");
});

test("no cookie and no Authorization header → UNAUTHENTICATED", async () => {
  currentCookie = null;
  currentAuthHeader = null;
  await expectAuthError("UNAUTHENTICATED");
});
