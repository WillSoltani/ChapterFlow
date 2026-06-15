import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureHttpsUrl } from "./cognito-domain-core";

test("ensureHttpsUrl adds https:// to a bare domain", () => {
  assert.equal(ensureHttpsUrl("example.com"), "https://example.com");
});

test("ensureHttpsUrl upgrades http:// to https://", () => {
  assert.equal(ensureHttpsUrl("http://example.com"), "https://example.com");
});

test("ensureHttpsUrl leaves https:// as-is and trims the trailing slash", () => {
  assert.equal(ensureHttpsUrl("https://example.com/"), "https://example.com");
});

test("ensureHttpsUrl forces https for a non-special scheme (the URL.protocol-setter no-op case)", () => {
  // Reassigning URL.protocol would NOT have upgraded these; rebuilding does.
  assert.equal(ensureHttpsUrl("foo://example.com"), "https://example.com");
  assert.equal(ensureHttpsUrl("ftp://auth.example.com"), "https://auth.example.com");
});

test("ensureHttpsUrl preserves a path while trimming the trailing slash", () => {
  assert.equal(ensureHttpsUrl("example.com/oauth2/"), "https://example.com/oauth2");
});

test("ensureHttpsUrl throws on empty / whitespace input", () => {
  assert.throws(() => ensureHttpsUrl(""), /COGNITO_DOMAIN/);
  assert.throws(() => ensureHttpsUrl("   "), /COGNITO_DOMAIN/);
});
