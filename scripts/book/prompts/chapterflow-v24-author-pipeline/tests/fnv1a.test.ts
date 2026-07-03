/**
 * fnv1a — the shared deterministic seed for every librarian "deal" allocator. These
 * known FNV-1a 32-bit vectors lock the constants: a change here would silently re-key
 * every book's deals, so the test exists to make that change impossible-by-accident.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fnv1a } from "../src/lib/fnv1a.js";

test("fnv1a: matches the canonical FNV-1a 32-bit vectors (ASCII)", () => {
  assert.equal(fnv1a(""), 0x811c9dc5); // 2166136261 — the offset basis
  assert.equal(fnv1a("a"), 0xe40c292c);
  assert.equal(fnv1a("foobar"), 0xbf9cf968);
});

test("fnv1a: pure + unsigned 32-bit", () => {
  assert.equal(fnv1a("the-paradox-of-choice:stakes"), fnv1a("the-paradox-of-choice:stakes"));
  const h = fnv1a("some-arbitrary-book-id:opener");
  assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff, "must be an unsigned 32-bit integer");
});
