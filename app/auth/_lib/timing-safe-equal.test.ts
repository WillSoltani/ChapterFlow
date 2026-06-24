import { test } from "node:test";
import assert from "node:assert/strict";
import { timingSafeStrEqual } from "./timing-safe-equal";

test("equal strings compare true", () => {
  assert.equal(timingSafeStrEqual("abc123", "abc123"), true);
});

test("a UUID nonce matches itself", () => {
  const nonce = "6f1e2d3c-4b5a-6789-abcd-ef0123456789";
  assert.equal(timingSafeStrEqual(nonce, nonce), true);
});

test("different same-length strings compare false", () => {
  assert.equal(timingSafeStrEqual("abc123", "abc124"), false);
});

test("a one-character difference (last byte) is false (no early short-circuit pass)", () => {
  assert.equal(timingSafeStrEqual("aaaaaaaaaaaaaaab", "aaaaaaaaaaaaaaaa"), false);
});

test("length mismatch is false and does NOT throw (timingSafeEqual would throw)", () => {
  assert.equal(timingSafeStrEqual("abc", "abcd"), false);
  assert.equal(timingSafeStrEqual("", "x"), false);
  assert.equal(timingSafeStrEqual("longer-prefix-string", "longer-prefix"), false);
});

test("two empty strings are equal", () => {
  assert.equal(timingSafeStrEqual("", ""), true);
});

test("multibyte UTF-8 is handled by byte-length, not char-length", () => {
  // "é" is 2 bytes in UTF-8; a 1-byte string can never equal it (and must not throw).
  assert.equal(timingSafeStrEqual("é", "e"), false);
  assert.equal(timingSafeStrEqual("café", "café"), true);
});
