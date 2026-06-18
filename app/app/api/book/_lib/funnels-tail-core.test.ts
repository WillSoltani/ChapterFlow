import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countFunnelTail,
  scaleFunnelCount,
  type FunnelTailEvent,
} from "./funnels-tail-core";

/**
 * Behavior-loop funnel TAIL (feedback #8).
 *
 * Guards the three derived tail steps:
 *   - returned        = any followup_completed (helped optional / irrelevant).
 *   - reportedHelped  = helped==="helped" ONLY (absent/null/partly/didnt excluded).
 *   - applied         = application_complete present (0, not a crash, when absent).
 * All three are PER-USER PRESENCE counts (a user with multiple matching events counts
 * once), and the same single scale factor is applied to every tail counter.
 */

const fc = (helped?: unknown): FunnelTailEvent =>
  helped === undefined ? { eventType: "followup_completed" } : { eventType: "followup_completed", helped };
const app = (): FunnelTailEvent => ({ eventType: "application_complete" });

test("(a) followup_completed helped='partly' → returned, NOT reported_helped", () => {
  const counts = countFunnelTail([[fc("partly")]]);
  assert.equal(counts.returned, 1);
  assert.equal(counts.reportedHelped, 0);
});

test("(b) followup_completed with no/undefined/null helped → returned, NOT reported_helped", () => {
  // user 1: no helped field at all; user 2: helped explicitly undefined; user 3: helped null
  const counts = countFunnelTail([
    [fc()],
    [{ eventType: "followup_completed", helped: undefined }],
    [{ eventType: "followup_completed", helped: null }],
  ]);
  assert.equal(counts.returned, 3);
  assert.equal(counts.reportedHelped, 0);
});

test("reported_helped counts ONLY helped==='helped'", () => {
  const counts = countFunnelTail([[fc("helped")], [fc("didnt")], [fc("partly")]]);
  assert.equal(counts.returned, 3);
  assert.equal(counts.reportedHelped, 1);
});

test("(c) a user with TWO followup_completed events counts ONCE (per-user dedup)", () => {
  const counts = countFunnelTail([[fc("helped"), fc("partly"), fc("helped")]]);
  assert.equal(counts.returned, 1, "returned dedups per user");
  assert.equal(counts.reportedHelped, 1, "reported_helped dedups per user");
});

test("(d) application_complete present → applied; absent → applied=0 (no crash)", () => {
  const present = countFunnelTail([[app()], [fc("helped"), app()]]);
  assert.equal(present.applied, 2);
  const absent = countFunnelTail([[fc("helped")], [{ eventType: "commitment_created" }]]);
  assert.equal(absent.applied, 0, "missing event type → 0, not a throw");
});

test("applied also dedups per user", () => {
  const counts = countFunnelTail([[app(), app(), app()]]);
  assert.equal(counts.applied, 1);
});

test("empty / no-events input does not crash and yields zeros", () => {
  assert.deepEqual(countFunnelTail([]), { returned: 0, reportedHelped: 0, applied: 0 });
  assert.deepEqual(countFunnelTail([[], []]), { returned: 0, reportedHelped: 0, applied: 0 });
});

test("ignores unrelated event types and malformed events", () => {
  const counts = countFunnelTail([
    [{ eventType: "commitment_created" }, { eventType: "quiz_attempt" }],
    [{} as FunnelTailEvent, { eventType: undefined }],
  ]);
  assert.deepEqual(counts, { returned: 0, reportedHelped: 0, applied: 0 });
});

test("(e) the SAME single scale factor is applied consistently to all tail counters", () => {
  // sampleSize=10, total=100 → factor 10. Distinct raw counts prove the SAME factor
  // (not a per-counter factor) scales each one.
  const sampleSize = 10;
  const total = 100;
  const tail = { returned: 5, reportedHelped: 3, applied: 2 };
  assert.equal(scaleFunnelCount(tail.returned, sampleSize, total), 50);
  assert.equal(scaleFunnelCount(tail.reportedHelped, sampleSize, total), 30);
  assert.equal(scaleFunnelCount(tail.applied, sampleSize, total), 20);
  // …and the head-step uses the exact same function → identical factor.
  assert.equal(scaleFunnelCount(7 /* firstCommitment */, sampleSize, total), 70);
});

test("scaleFunnelCount: no scaling when sample covers the whole population", () => {
  assert.equal(scaleFunnelCount(4, 10, 10), 4, "sampleSize === total → unscaled");
  assert.equal(scaleFunnelCount(4, 12, 10), 4, "sampleSize > total → unscaled");
});

test("scaleFunnelCount: empty sample → 0 (no divide-by-zero)", () => {
  assert.equal(scaleFunnelCount(0, 0, 100), 0);
});

test("scaleFunnelCount rounds to whole users", () => {
  // 1 of 3 sampled, total 10 → 1 * 10/3 = 3.33 → 3
  assert.equal(scaleFunnelCount(1, 3, 10), 3);
});
