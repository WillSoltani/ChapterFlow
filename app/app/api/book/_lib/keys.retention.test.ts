/**
 * Data-retention TTL helpers (#16).
 *
 * Two guards:
 *  1. `ttlEpochSeconds` returns a future epoch in SECONDS (not ms).
 *  2. `retentionPolicyFor` is the canonical ttl-vs-durable table — this test
 *     pins WHICH entity classes get a DynamoDB TTL so a future writer cannot
 *     silently flip a compliance/finance/fraud class to "expiring".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ttlEpochSeconds,
  retentionPolicyFor,
  RETENTION_DAYS_18_MONTHS,
} from "./keys";

const NOW_MS = 1_700_000_000_000; // fixed epoch ms (2023-11-14T22:13:20Z)
const NOW_S = Math.floor(NOW_MS / 1000); // 1_700_000_000

// ─── ttlEpochSeconds — epoch math, SECONDS, future-dated ──────────────────────

test("ttlEpochSeconds returns whole epoch SECONDS, not milliseconds", () => {
  const ttl = ttlEpochSeconds(30, NOW_MS);
  // Must be ~now+30d in SECONDS. If it were ms it'd be ~1.7e12, not ~1.7e9.
  assert.equal(ttl, NOW_S + 30 * 86400);
  assert.ok(Number.isInteger(ttl), "ttl must be an integer (whole seconds)");
  // Sanity: a ms-scale value would be > 1e12; a seconds-scale value is < 1e11.
  assert.ok(ttl < 1e11, "ttl is on the seconds scale, not the milliseconds scale");
});

test("ttlEpochSeconds is always in the future relative to its `now`", () => {
  const ttl = ttlEpochSeconds(RETENTION_DAYS_18_MONTHS, NOW_MS);
  assert.ok(ttl > NOW_S, "ttl must be strictly after now");
  // 18 months ≈ 548 days.
  assert.equal(ttl, NOW_S + RETENTION_DAYS_18_MONTHS * 86400);
});

test("ttlEpochSeconds defaults `nowMs` to the current clock", () => {
  const before = Math.floor(Date.now() / 1000);
  const ttl = ttlEpochSeconds(1);
  const after = Math.floor(Date.now() / 1000);
  assert.ok(ttl >= before + 86400 && ttl <= after + 86400);
});

test("RETENTION_DAYS_18_MONTHS is ~548 days (18 calendar months)", () => {
  // 18 * 365/12 ≈ 547.5 → rounds to 548.
  assert.equal(RETENTION_DAYS_18_MONTHS, 548);
});

// ─── retentionPolicyFor — the ttl-vs-durable guard table ──────────────────────

// Entities that MUST get a TTL (high-volume, non-compliance, append-only).
const TTL_ENTITIES = [
  "BOOK_ANALYTICS_EVENT",
  "BOOK_OPS_FAILURE",
  "BOOK_USER_SHARE_EVENT",
] as const;

// Entities that MUST NEVER get a TTL (durable / legal / fraud / compliance).
const DURABLE_ENTITIES = [
  "BOOK_ANALYTICS_SNAPSHOT",
  "BOOK_BILLING_EVENT",
  "BOOK_RISK_EVENT",
  "BOOK_ACCOUNT_STATUS_CHANGE",
  "BOOK_ERASURE_LOG",
  // The webhook idempotency marker owns its own ttl lifecycle in #10; retention
  // (#16) must not stamp/alter it, so retentionPolicyFor reports ttl:false here.
  "BOOK_STRIPE_WEBHOOK_EVENT",
] as const;

for (const entity of TTL_ENTITIES) {
  test(`retentionPolicyFor(${entity}) → ttl:true with a positive retention period`, () => {
    const policy = retentionPolicyFor(entity);
    assert.equal(policy.ttl, true, `${entity} must be TTL'd`);
    assert.ok(
      typeof policy.retentionDays === "number" && policy.retentionDays > 0,
      `${entity} must declare a positive retentionDays`,
    );
    assert.ok(policy.reason.length > 0);
  });
}

for (const entity of DURABLE_ENTITIES) {
  test(`retentionPolicyFor(${entity}) → ttl:false (durable/compliance, never expires)`, () => {
    const policy = retentionPolicyFor(entity);
    assert.equal(policy.ttl, false, `${entity} MUST NOT be TTL'd — it is a compliance/durable class`);
    assert.equal(policy.retentionDays, undefined, `${entity} must not declare a retention period`);
  });
}

test("the snapshot is durable while the analytics EVENT is ttl'd (the core distinction)", () => {
  assert.equal(retentionPolicyFor("BOOK_ANALYTICS_SNAPSHOT").ttl, false);
  assert.equal(retentionPolicyFor("BOOK_ANALYTICS_EVENT").ttl, true);
});

test("an unclassified entity defaults to durable (fail-safe: never silently expire)", () => {
  const policy = retentionPolicyFor("BOOK_SOME_FUTURE_DURABLE_THING");
  assert.equal(policy.ttl, false);
  assert.equal(policy.retentionDays, undefined);
});
