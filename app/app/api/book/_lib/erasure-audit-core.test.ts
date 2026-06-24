import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { hashErasureSubject } from "./erasure-audit-core";

const SUB = "9f3c2b1a-0000-4444-8888-aaaaaaaaaaaa";
const SECRET = "a-32-plus-char-unsubscribe-secret-value";

test("keyed HMAC-SHA-256 when a secret is present", () => {
  const out = hashErasureSubject(SUB, SECRET);
  assert.equal(out.keyed, true);
  assert.equal(out.algorithm, "hmac-sha256");
  assert.equal(out.hash, createHmac("sha256", SECRET).update(SUB).digest("hex"));
  // The audit must NOT contain the plaintext sub.
  assert.notEqual(out.hash, SUB);
  assert.ok(!out.hash.includes(SUB));
});

test("unkeyed SHA-256 fallback when secret is absent/blank", () => {
  for (const secret of [null, undefined, "", "   "]) {
    const out = hashErasureSubject(SUB, secret as string | null | undefined);
    assert.equal(out.keyed, false, `secret=${JSON.stringify(secret)} must fall back`);
    assert.equal(out.algorithm, "sha256");
    assert.equal(out.hash, createHash("sha256").update(SUB).digest("hex"));
  }
});

test("deterministic for a given (sub, secret) so an operator can correlate", () => {
  assert.equal(hashErasureSubject(SUB, SECRET).hash, hashErasureSubject(SUB, SECRET).hash);
  assert.equal(hashErasureSubject(SUB, null).hash, hashErasureSubject(SUB, null).hash);
});

test("keyed and unkeyed digests differ (secret actually participates)", () => {
  assert.notEqual(hashErasureSubject(SUB, SECRET).hash, hashErasureSubject(SUB, null).hash);
});

test("different subs and different secrets produce different hashes", () => {
  assert.notEqual(hashErasureSubject(SUB, SECRET).hash, hashErasureSubject("other-sub", SECRET).hash);
  assert.notEqual(hashErasureSubject(SUB, SECRET).hash, hashErasureSubject(SUB, "other-secret").hash);
});
