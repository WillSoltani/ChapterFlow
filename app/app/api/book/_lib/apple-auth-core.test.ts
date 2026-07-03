import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { importSPKI, jwtVerify, decodeProtectedHeader } from "jose";
import {
  APPLE_AUDIENCE,
  APPLE_REVOKE_URL,
  buildAppleClientSecret,
  buildAppleRevokeRequest,
  hasLinkedAppleIdentity,
  isAppleAuthConfigComplete,
  normalizePrivateKeyPem,
  parseCognitoIdentities,
  runAppleRevoke,
  type AppleAuthConfig,
} from "./apple-auth-core";

// A throwaway P-256 key pair so the ES256 signing path is exercised for real
// (no fixtures checked in). The public half verifies the JWT the code produces.
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const PRIVATE_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const PUBLIC_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();

const CONFIG: AppleAuthConfig = {
  teamId: "TEAM123456",
  clientId: "com.chapterflow.ios",
  keyId: "KEY7654321",
  privateKey: PRIVATE_PEM,
};

test("buildAppleClientSecret signs a verifiable ES256 JWT with Apple's required claims", async () => {
  const nowSeconds = 1_700_000_000;
  const jwt = await buildAppleClientSecret(CONFIG, nowSeconds);

  const header = decodeProtectedHeader(jwt);
  assert.equal(header.alg, "ES256");
  assert.equal(header.kid, CONFIG.keyId);

  const spki = await importSPKI(PUBLIC_PEM, "ES256");
  const { payload } = await jwtVerify(jwt, spki, {
    audience: APPLE_AUDIENCE,
    issuer: CONFIG.teamId,
    currentDate: new Date(nowSeconds * 1000),
  });
  assert.equal(payload.sub, CONFIG.clientId);
  assert.equal(payload.iat, nowSeconds);
  assert.equal(payload.exp, nowSeconds + 300);
});

test("normalizePrivateKeyPem restores literal \\n newlines and leaves real ones", () => {
  assert.equal(normalizePrivateKeyPem("a\\nb\\nc"), "a\nb\nc");
  assert.equal(normalizePrivateKeyPem("a\nb"), "a\nb");
});

test("buildAppleRevokeRequest form-encodes the revoke body", () => {
  const req = buildAppleRevokeRequest({
    clientId: "com.chapterflow.ios",
    clientSecret: "SECRET.JWT.SIG",
    token: "refresh-abc",
  });
  assert.equal(req.url, APPLE_REVOKE_URL);
  assert.equal(req.method, "POST");
  assert.equal(req.headers["Content-Type"], "application/x-www-form-urlencoded");

  const parsed = new URLSearchParams(req.body);
  assert.equal(parsed.get("client_id"), "com.chapterflow.ios");
  assert.equal(parsed.get("client_secret"), "SECRET.JWT.SIG");
  assert.equal(parsed.get("token"), "refresh-abc");
  assert.equal(parsed.get("token_type_hint"), "refresh_token");
});

test("isAppleAuthConfigComplete requires all four fields", () => {
  assert.equal(isAppleAuthConfigComplete(CONFIG), true);
  assert.equal(isAppleAuthConfigComplete({ ...CONFIG, keyId: "" }), false);
  assert.equal(isAppleAuthConfigComplete(null), false);
});

test("hasLinkedAppleIdentity detects Apple via identities attr, username, and returns false otherwise", () => {
  const appleIdentities = JSON.stringify([
    { providerName: "SignInWithApple", providerType: "SignInWithApple", primary: true },
  ]);
  assert.equal(hasLinkedAppleIdentity({ identitiesAttr: appleIdentities }), true);
  assert.equal(hasLinkedAppleIdentity({ username: "SignInWithApple_001234.abc" }), true);

  const googleIdentities = JSON.stringify([{ providerName: "Google", providerType: "Google" }]);
  assert.equal(hasLinkedAppleIdentity({ identitiesAttr: googleIdentities }), false);
  assert.equal(hasLinkedAppleIdentity({ username: "a@b.com" }), false);
  assert.equal(hasLinkedAppleIdentity({}), false);
});

test("parseCognitoIdentities tolerates missing/garbage input", () => {
  assert.deepEqual(parseCognitoIdentities(null), []);
  assert.deepEqual(parseCognitoIdentities("not json"), []);
  assert.deepEqual(parseCognitoIdentities("{}"), []);
  assert.equal(parseCognitoIdentities('[{"providerName":"Google"}]').length, 1);
});

// ---- runAppleRevoke orchestration ----------------------------------------

const fixedNow = () => 1_700_000_000_000; // ms

test("runAppleRevoke skips (no HTTP) when there is no Apple identity", async () => {
  let fetchCalls = 0;
  const outcome = await runAppleRevoke({
    hasAppleIdentity: false,
    config: CONFIG,
    getRefreshToken: async () => "should-not-be-read",
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, status: 200 };
    },
    now: fixedNow,
  });
  assert.deepEqual(outcome, { status: "skipped", reason: "no_apple_identity" });
  assert.equal(fetchCalls, 0, "must not call Apple when there is no Apple identity");
});

test("runAppleRevoke skips when Apple-linked but no token is stored", async () => {
  let fetchCalls = 0;
  const outcome = await runAppleRevoke({
    hasAppleIdentity: true,
    config: CONFIG,
    getRefreshToken: async () => null,
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, status: 200 };
    },
    now: fixedNow,
  });
  assert.deepEqual(outcome, { status: "skipped", reason: "no_token" });
  assert.equal(fetchCalls, 0);
});

test("runAppleRevoke skips when config is incomplete", async () => {
  const outcome = await runAppleRevoke({
    hasAppleIdentity: true,
    config: { ...CONFIG, privateKey: "" },
    getRefreshToken: async () => "refresh-abc",
    fetchImpl: async () => ({ ok: true, status: 200 }),
    now: fixedNow,
  });
  assert.deepEqual(outcome, { status: "skipped", reason: "not_configured" });
});

test("runAppleRevoke POSTs a correct signed request and reports revoked on 200", async () => {
  const seen: { url: string; init: { method: string; headers: Record<string, string>; body: string } }[] = [];
  const outcome = await runAppleRevoke({
    hasAppleIdentity: true,
    config: CONFIG,
    getRefreshToken: async () => "refresh-abc",
    fetchImpl: async (url, init) => {
      seen.push({ url, init });
      return { ok: true, status: 200 };
    },
    now: fixedNow,
  });

  assert.deepEqual(outcome, { status: "revoked", attempts: 1 });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, APPLE_REVOKE_URL);
  assert.equal(seen[0].init.method, "POST");

  const body = new URLSearchParams(seen[0].init.body);
  assert.equal(body.get("client_id"), CONFIG.clientId);
  assert.equal(body.get("token"), "refresh-abc");
  assert.equal(body.get("token_type_hint"), "refresh_token");

  // The client_secret must be a valid ES256 JWT signed with our key, minted at
  // floor(now/1000).
  const spki = await importSPKI(PUBLIC_PEM, "ES256");
  const { payload } = await jwtVerify(body.get("client_secret")!, spki, {
    audience: APPLE_AUDIENCE,
    issuer: CONFIG.teamId,
    currentDate: new Date(fixedNow()),
  });
  assert.equal(payload.sub, CONFIG.clientId);
  assert.equal(payload.iat, Math.floor(fixedNow() / 1000));
});

test("runAppleRevoke retries once on a 5xx then succeeds", async () => {
  let calls = 0;
  const outcome = await runAppleRevoke({
    hasAppleIdentity: true,
    config: CONFIG,
    getRefreshToken: async () => "refresh-abc",
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 };
    },
    now: fixedNow,
  });
  assert.deepEqual(outcome, { status: "revoked", attempts: 2 });
  assert.equal(calls, 2);
});

test("runAppleRevoke does NOT retry a 400 (terminal) and reports failed", async () => {
  let calls = 0;
  const outcome = await runAppleRevoke({
    hasAppleIdentity: true,
    config: CONFIG,
    getRefreshToken: async () => "refresh-abc",
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 400 };
    },
    now: fixedNow,
  });
  assert.equal(outcome.status, "failed");
  assert.equal(calls, 1, "4xx must not be retried");
});

test("runAppleRevoke retries on a thrown network error and reports failed after maxAttempts", async () => {
  let calls = 0;
  const outcome = await runAppleRevoke({
    hasAppleIdentity: true,
    config: CONFIG,
    getRefreshToken: async () => "refresh-abc",
    fetchImpl: async () => {
      calls += 1;
      throw new Error("ECONNRESET");
    },
    now: fixedNow,
  });
  assert.equal(outcome.status, "failed");
  assert.equal(calls, 2);
  if (outcome.status === "failed") assert.match(outcome.error, /ECONNRESET/);
});
