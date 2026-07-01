import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_COOKIE_NAME,
  parseBearerToken,
  cookieHeaderHasAuthToken,
  resolveCredentialToken,
  isHeaderAuthenticatedRequest,
} from "./auth-credential-core";

// ─── parseBearerToken ─────────────────────────────────────────────────────────

test("parseBearerToken extracts the token from a well-formed header", () => {
  assert.equal(parseBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
});

test("parseBearerToken matches the scheme case-insensitively (RFC 7235)", () => {
  assert.equal(parseBearerToken("bearer tok"), "tok");
  assert.equal(parseBearerToken("BEARER tok"), "tok");
  assert.equal(parseBearerToken("BeArEr tok"), "tok");
});

test("parseBearerToken trims surrounding and inter-token whitespace/tabs", () => {
  assert.equal(parseBearerToken("   Bearer   tok  "), "tok");
  assert.equal(parseBearerToken("Bearer\ttok"), "tok");
});

test("parseBearerToken rejects other schemes and returns null", () => {
  // Only the Bearer scheme resolves a token — an access-token-style Basic header
  // must never be treated as a credential here.
  assert.equal(parseBearerToken("Basic dXNlcjpwYXNz"), null);
  assert.equal(parseBearerToken("token abc"), null);
  assert.equal(parseBearerToken("Bearerabc"), null, "no delimiter → not a Bearer header");
});

test("parseBearerToken returns null for empty/missing token or header", () => {
  assert.equal(parseBearerToken("Bearer"), null);
  assert.equal(parseBearerToken("Bearer   "), null);
  assert.equal(parseBearerToken(""), null);
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken(undefined), null);
});

// ─── cookieHeaderHasAuthToken ─────────────────────────────────────────────────

test("cookieHeaderHasAuthToken detects a non-empty id_token cookie in any position", () => {
  assert.equal(cookieHeaderHasAuthToken(`${AUTH_COOKIE_NAME}=abc`), true);
  assert.equal(cookieHeaderHasAuthToken(`${AUTH_COOKIE_NAME}=abc; other=xyz`), true);
  assert.equal(cookieHeaderHasAuthToken(`other=xyz; ${AUTH_COOKIE_NAME}=abc`), true);
  assert.equal(cookieHeaderHasAuthToken(` ${AUTH_COOKIE_NAME} = abc `), true, "tolerates spaces");
});

test("cookieHeaderHasAuthToken is false for absent, empty, or look-alike cookies", () => {
  assert.equal(cookieHeaderHasAuthToken(null), false);
  assert.equal(cookieHeaderHasAuthToken(undefined), false);
  assert.equal(cookieHeaderHasAuthToken(""), false);
  assert.equal(cookieHeaderHasAuthToken("other=xyz"), false);
  assert.equal(cookieHeaderHasAuthToken(`${AUTH_COOKIE_NAME}=`), false, "empty value is not present");
  assert.equal(cookieHeaderHasAuthToken(`x${AUTH_COOKIE_NAME}=abc`), false, "suffix name must not match");
  assert.equal(cookieHeaderHasAuthToken(`${AUTH_COOKIE_NAME}_x=abc`), false, "prefix name must not match");
});

// ─── resolveCredentialToken (cookie is the web default, header the fallback) ───

test("resolveCredentialToken: the cookie WINS when both are present", () => {
  assert.equal(
    resolveCredentialToken({ cookieToken: "cookie-tok", bearerToken: "bearer-tok" }),
    "cookie-tok"
  );
});

test("resolveCredentialToken: falls back to the Bearer token when there is no cookie", () => {
  assert.equal(resolveCredentialToken({ cookieToken: undefined, bearerToken: "bearer-tok" }), "bearer-tok");
  assert.equal(resolveCredentialToken({ cookieToken: "", bearerToken: "bearer-tok" }), "bearer-tok");
  assert.equal(resolveCredentialToken({ cookieToken: null, bearerToken: "bearer-tok" }), "bearer-tok");
});

test("resolveCredentialToken: cookie-only and neither-present", () => {
  assert.equal(resolveCredentialToken({ cookieToken: "cookie-tok", bearerToken: null }), "cookie-tok");
  assert.equal(resolveCredentialToken({ cookieToken: undefined, bearerToken: undefined }), null);
  assert.equal(resolveCredentialToken({ cookieToken: "", bearerToken: "" }), null);
});

// ─── isHeaderAuthenticatedRequest (the CSRF-skip signal) ──────────────────────

test("isHeaderAuthenticatedRequest: Bearer present AND no cookie → true (CSRF guard skipped)", () => {
  assert.equal(
    isHeaderAuthenticatedRequest({ authorizationHeader: "Bearer tok", cookieHeader: null }),
    true
  );
  assert.equal(
    isHeaderAuthenticatedRequest({ authorizationHeader: "Bearer tok", cookieHeader: "other=1" }),
    true
  );
  assert.equal(
    isHeaderAuthenticatedRequest({
      authorizationHeader: "Bearer tok",
      cookieHeader: `${AUTH_COOKIE_NAME}=`,
    }),
    true,
    "empty id_token cookie does not count as a cookie credential"
  );
});

test("isHeaderAuthenticatedRequest: a cookie credential keeps the guard even WITH a Bearer header", () => {
  // Defense-in-depth: if an id_token cookie is attached the request is treated as
  // cookie-authed (cookie wins), so CSRF protection must NOT be skipped.
  assert.equal(
    isHeaderAuthenticatedRequest({
      authorizationHeader: "Bearer tok",
      cookieHeader: `${AUTH_COOKIE_NAME}=abc`,
    }),
    false
  );
});

test("isHeaderAuthenticatedRequest: no Bearer token → false (cookie or unauthenticated path)", () => {
  assert.equal(isHeaderAuthenticatedRequest({ authorizationHeader: null, cookieHeader: null }), false);
  assert.equal(
    isHeaderAuthenticatedRequest({ authorizationHeader: null, cookieHeader: `${AUTH_COOKIE_NAME}=abc` }),
    false
  );
  assert.equal(
    isHeaderAuthenticatedRequest({ authorizationHeader: "Basic abc", cookieHeader: null }),
    false,
    "a non-Bearer scheme is not header-authentication"
  );
});
