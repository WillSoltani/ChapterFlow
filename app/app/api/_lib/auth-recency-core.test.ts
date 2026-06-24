import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateAuthRecency, mapIdTokenClaims } from "./auth-recency-core";

// ─── evaluateAuthRecency (#5 step-up recency decision) ───────────────────────

const NOW = 1_700_000_000; // fixed clock (seconds)

test("fresh auth within the window passes", () => {
  // authenticated 5 minutes ago, window is 10 minutes
  const r = evaluateAuthRecency({
    authTimeSeconds: NOW - 5 * 60,
    maxAgeMinutes: 10,
    nowSeconds: NOW,
  });
  assert.deepEqual(r, { ok: true });
});

test("auth exactly at the window boundary still passes (inclusive)", () => {
  const r = evaluateAuthRecency({
    authTimeSeconds: NOW - 10 * 60,
    maxAgeMinutes: 10,
    nowSeconds: NOW,
  });
  assert.deepEqual(r, { ok: true });
});

test("auth one second past the window is stale", () => {
  const r = evaluateAuthRecency({
    authTimeSeconds: NOW - (10 * 60 + 1),
    maxAgeMinutes: 10,
    nowSeconds: NOW,
  });
  assert.deepEqual(r, { ok: false, reason: "stale" });
});

test("an old-but-valid session (1 hour) is stale for a 10-min window", () => {
  const r = evaluateAuthRecency({
    authTimeSeconds: NOW - 60 * 60,
    maxAgeMinutes: 10,
    nowSeconds: NOW,
  });
  assert.deepEqual(r, { ok: false, reason: "stale" });
});

test("missing auth_time is treated as 'missing' (re-auth required)", () => {
  assert.deepEqual(
    evaluateAuthRecency({ authTimeSeconds: undefined, maxAgeMinutes: 10, nowSeconds: NOW }),
    { ok: false, reason: "missing" }
  );
});

test("non-finite / non-positive auth_time is 'missing', never a silent pass", () => {
  for (const bad of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.deepEqual(
      evaluateAuthRecency({ authTimeSeconds: bad, maxAgeMinutes: 10, nowSeconds: NOW }),
      { ok: false, reason: "missing" },
      `auth_time=${bad} should be 'missing'`
    );
  }
});

test("future-dated auth_time (clock skew) is treated as fresh, never forced re-auth", () => {
  const r = evaluateAuthRecency({
    authTimeSeconds: NOW + 30, // 30s in the future vs our clock
    maxAgeMinutes: 5,
    nowSeconds: NOW,
  });
  assert.deepEqual(r, { ok: true });
});

test("the tighter erase window (5 min) rejects a 6-min-old auth that a 10-min window allows", () => {
  const authTimeSeconds = NOW - 6 * 60;
  assert.deepEqual(
    evaluateAuthRecency({ authTimeSeconds, maxAgeMinutes: 5, nowSeconds: NOW }),
    { ok: false, reason: "stale" }
  );
  assert.deepEqual(
    evaluateAuthRecency({ authTimeSeconds, maxAgeMinutes: 10, nowSeconds: NOW }),
    { ok: true }
  );
});

// ─── mapIdTokenClaims (#15 token_use + #5 auth_time extraction) ───────────────

function idClaims(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { token_use: "id", sub: "user-123", ...extra };
}

test("a valid id token maps to the identity subset", () => {
  const r = mapIdTokenClaims(
    idClaims({
      email: "a@b.com",
      email_verified: true,
      name: "Ada",
      given_name: "Ada",
      family_name: "Lovelace",
      preferred_username: "ada",
      "cognito:groups": ["admin"],
      auth_time: NOW,
    })
  );
  assert.equal(r.valid, true);
  if (!r.valid) return;
  assert.deepEqual(r.user, {
    sub: "user-123",
    email: "a@b.com",
    emailVerified: true,
    name: "Ada",
    givenName: "Ada",
    familyName: "Lovelace",
    preferredUsername: "ada",
    groups: ["admin"],
    authTime: NOW,
  });
});

test("token_use !== 'id' is rejected (access token from same pool)", () => {
  assert.deepEqual(mapIdTokenClaims(idClaims({ token_use: "access" })), { valid: false });
});

test("missing token_use is rejected", () => {
  const claims = idClaims();
  delete claims.token_use;
  assert.deepEqual(mapIdTokenClaims(claims), { valid: false });
});

test("missing / non-string sub is rejected", () => {
  assert.deepEqual(mapIdTokenClaims({ token_use: "id" }), { valid: false });
  assert.deepEqual(mapIdTokenClaims({ token_use: "id", sub: 42 }), { valid: false });
  assert.deepEqual(mapIdTokenClaims({ token_use: "id", sub: "" }), { valid: false });
});

test("auth_time is extracted from a number", () => {
  const r = mapIdTokenClaims(idClaims({ auth_time: 1_699_999_999 }));
  assert.equal(r.valid && r.user.authTime, 1_699_999_999);
});

test("auth_time is extracted from a numeric string", () => {
  const r = mapIdTokenClaims(idClaims({ auth_time: "1699999999" }));
  assert.equal(r.valid && r.user.authTime, 1_699_999_999);
});

test("absent / non-numeric auth_time yields undefined (caller treats as re-auth required)", () => {
  for (const bad of [undefined, "not-a-number", "12.5", null, {}]) {
    const claims = idClaims();
    if (bad !== undefined) claims.auth_time = bad;
    const r = mapIdTokenClaims(claims);
    assert.equal(r.valid, true);
    if (r.valid) assert.equal(r.user.authTime, undefined, `auth_time=${String(bad)} → undefined`);
  }
});

test("a single cognito:groups string is normalized to an array", () => {
  const r = mapIdTokenClaims(idClaims({ "cognito:groups": "admin" }));
  assert.equal(r.valid, true);
  if (r.valid) assert.deepEqual(r.user.groups, ["admin"]);
});
