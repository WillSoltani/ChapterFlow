import { test } from "node:test";
import assert from "node:assert/strict";
import { constantTimeEqual, evaluateOriginVerify } from "./origin-verify-core";

// WS6-002: pins the interim origin-lock decision logic that middleware.ts relies
// on. A regression here would either brick every request (false deny) or silently
// open the direct-Function-URL bypass the lock exists to close (false allow).

const SECRET = "0123456789abcdef0123456789abcdef";

test("unset secret always allows (diff-clean behavior before the secret ships)", () => {
  assert.equal(evaluateOriginVerify(undefined, null, undefined), "allow");
  assert.equal(evaluateOriginVerify(undefined, "anything", "enforce"), "allow");
  assert.equal(evaluateOriginVerify("", "anything", undefined), "allow");
});

test("matching header allows regardless of mode", () => {
  assert.equal(evaluateOriginVerify(SECRET, SECRET, undefined), "allow");
  assert.equal(evaluateOriginVerify(SECRET, SECRET, "enforce"), "allow");
  assert.equal(evaluateOriginVerify(SECRET, SECRET, "log"), "allow");
});

test("mismatch denies by default and under explicit enforce", () => {
  assert.equal(evaluateOriginVerify(SECRET, "wrong", undefined), "deny");
  assert.equal(evaluateOriginVerify(SECRET, "wrong", "enforce"), "deny");
  // Absent header (null) is a mismatch, not an allow.
  assert.equal(evaluateOriginVerify(SECRET, null, undefined), "deny");
  assert.equal(evaluateOriginVerify(SECRET, null, "enforce"), "deny");
});

test("mismatch warns (delegates) in log mode", () => {
  assert.equal(evaluateOriginVerify(SECRET, "wrong", "log"), "warn");
  assert.equal(evaluateOriginVerify(SECRET, null, "log"), "warn");
});

test("differing lengths deny even when a prefix matches", () => {
  assert.equal(evaluateOriginVerify(SECRET, SECRET + "x", undefined), "deny");
  assert.equal(evaluateOriginVerify(SECRET, SECRET.slice(0, -1), undefined), "deny");
});

test("constantTimeEqual truth table", () => {
  assert.equal(constantTimeEqual("", ""), true);
  assert.equal(constantTimeEqual("a", "a"), true);
  assert.equal(constantTimeEqual(SECRET, SECRET), true);
  assert.equal(constantTimeEqual("a", "b"), false);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  // Length mismatches — including empty-vs-nonempty and prefix relationships.
  assert.equal(constantTimeEqual("a", ""), false);
  assert.equal(constantTimeEqual("", "a"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false);
  assert.equal(constantTimeEqual("abcd", "abc"), false);
});
