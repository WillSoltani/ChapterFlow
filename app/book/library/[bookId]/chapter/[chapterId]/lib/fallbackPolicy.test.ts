import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldUseLocalFallback } from "./fallbackPolicy";

// Statuses the reader can observe on a failed read: connectivity/empty-body
// (null), 5xx outages, and the access codes 402/403/404.
const STATUSES: Array<number | null> = [null, 500, 502, 503, 402, 403, 404, 401, 422, 429];

test("dev: always falls back to local content (no AWS data plane in dev/CI)", () => {
  for (const status of STATUSES) {
    assert.equal(
      shouldUseLocalFallback(true, status),
      true,
      `dev should fall back for status=${String(status)}`,
    );
  }
});

test("prod: never falls back — for ANY status, including 5xx/null", () => {
  for (const status of [null, 500, 502, 503, 504] as Array<number | null>) {
    assert.equal(
      shouldUseLocalFallback(false, status),
      false,
      `prod must NOT fall back for status=${String(status)}`,
    );
  }
});

test("prod: never falls back for access codes 402/403/404 (server owns gating)", () => {
  for (const status of [402, 403, 404]) {
    assert.equal(
      shouldUseLocalFallback(false, status),
      false,
      `prod must NOT fall back for access code ${status}`,
    );
  }
});

test("the decision depends only on isDev, not on status", () => {
  // For a fixed environment the answer is constant across every status.
  const devAnswers = new Set(STATUSES.map((s) => shouldUseLocalFallback(true, s)));
  const prodAnswers = new Set(STATUSES.map((s) => shouldUseLocalFallback(false, s)));
  assert.deepEqual([...devAnswers], [true]);
  assert.deepEqual([...prodAnswers], [false]);
});
