import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameBudget, type FrameCache } from "./frame-cache";

/** A stand-in cache that records which frames the budget evicted. */
function fakeCache(): FrameCache & { evicted: number[] } {
  const evicted: number[] = [];
  return { evicted, evict: (i: number) => evicted.push(i) } as unknown as FrameCache & { evicted: number[] };
}

test("the shared budget evicts the least-recently-used frame across caches", () => {
  const budget = new FrameBudget(30);
  const a = fakeCache();
  const b = fakeCache();
  budget.track(a, 0, 10);
  budget.track(a, 1, 10);
  budget.track(b, 0, 10);
  assert.equal(budget.usedBytes, 30);
  assert.deepEqual(a.evicted, []);
  // Over the limit: the oldest entry (a#0) goes, whatever cache it belongs to.
  budget.track(b, 1, 10);
  assert.deepEqual(a.evicted, [0]);
  assert.equal(budget.usedBytes, 30);
  // Touching a frame moves it to the back of the line: a#1 survives, b#0 goes.
  budget.touch(a, 1);
  budget.track(b, 2, 10);
  assert.deepEqual(b.evicted, [0]);
  assert.deepEqual(a.evicted, [0]);
});

test("a frame larger than the whole budget is kept on its own", () => {
  const budget = new FrameBudget(5);
  const a = fakeCache();
  budget.track(a, 0, 10);
  assert.deepEqual(a.evicted, []);
  assert.equal(budget.count, 1);
  budget.track(a, 1, 10);
  assert.deepEqual(a.evicted, [0]);
});

test("release forgets a frame the cache dropped itself", () => {
  const budget = new FrameBudget(100);
  const a = fakeCache();
  budget.track(a, 0, 40);
  budget.track(a, 1, 40);
  budget.release(a, 0);
  assert.equal(budget.usedBytes, 40);
  assert.equal(budget.count, 1);
  budget.release(a, 99); // unknown: no-op
  assert.equal(budget.usedBytes, 40);
});
