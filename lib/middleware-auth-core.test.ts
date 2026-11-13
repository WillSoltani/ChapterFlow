import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideMiddlewareAuth,
  isSessionCookieFresh,
  type MiddlewareAuthInput,
} from "./middleware-auth-core";

const NOW = 1_800_000_000;
const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

function decide(overrides: Partial<MiddlewareAuthInput> = {}) {
  return decideMiddlewareAuth({
    idToken: undefined,
    expiresAtRaw: undefined,
    hasRefreshToken: false,
    refreshAttempted: false,
    method: "GET",
    accept: HTML_ACCEPT,
    purpose: null,
    isRsc: false,
    nowSeconds: NOW,
    ...overrides,
  });
}

test("a fresh session passes", () => {
  assert.equal(
    decide({ idToken: "t", expiresAtRaw: String(NOW + 600), hasRefreshToken: true }),
    "pass",
  );
});

test("a token without an expiry cookie passes, as before", () => {
  assert.equal(decide({ idToken: "t" }), "pass");
});

test("no cookies at all goes to sign-in (the @prod smoke contract)", () => {
  assert.equal(decide(), "login");
});

test("expired session with a refresh token goes through /auth/refresh", () => {
  assert.equal(
    decide({ idToken: "t", expiresAtRaw: String(NOW - 1), hasRefreshToken: true }),
    "refresh",
  );
  assert.equal(decide({ expiresAtRaw: String(NOW - 1), hasRefreshToken: true }), "refresh");
  assert.equal(decide({ hasRefreshToken: true }), "refresh");
});

test("expired session without a refresh token goes to sign-in", () => {
  assert.equal(decide({ idToken: "t", expiresAtRaw: String(NOW) }), "login");
});

test("a refresh already attempted for this navigation never refreshes again", () => {
  assert.equal(
    decide({ expiresAtRaw: String(NOW - 1), hasRefreshToken: true, refreshAttempted: true }),
    "login",
  );
});

test("only document navigations are sent through refresh", () => {
  const base = { expiresAtRaw: String(NOW - 1), hasRefreshToken: true };
  assert.equal(decide({ ...base, method: "POST" }), "login");
  assert.equal(decide({ ...base, accept: "application/json" }), "login");
  assert.equal(decide({ ...base, accept: null }), "login");
  assert.equal(decide({ ...base, accept: "text/x-component" }), "login");
  assert.equal(decide({ ...base, isRsc: true }), "login");
  assert.equal(decide({ ...base, purpose: "prefetch" }), "login");
  assert.equal(decide({ ...base, method: "get" }), "refresh");
});

test("isSessionCookieFresh mirrors the middleware expiry rule", () => {
  assert.equal(isSessionCookieFresh(undefined, String(NOW + 10), NOW), false);
  assert.equal(isSessionCookieFresh("", String(NOW + 10), NOW), false);
  assert.equal(isSessionCookieFresh("t", String(NOW + 10), NOW), true);
  assert.equal(isSessionCookieFresh("t", String(NOW), NOW), false);
  assert.equal(isSessionCookieFresh("t", undefined, NOW), true);
  assert.equal(isSessionCookieFresh("t", "garbage", NOW), true);
});
