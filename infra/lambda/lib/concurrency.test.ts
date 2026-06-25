import { test } from "node:test";
import assert from "node:assert/strict";
import { REMINDER_CONCURRENCY, runWithConcurrency } from "./concurrency";

test("runs every item exactly once and preserves result order", async () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  const seen: number[] = [];
  const results = await runWithConcurrency(items, 3, async (n) => {
    seen.push(n);
    return n * 10;
  });
  assert.deepEqual(results, [10, 20, 30, 40, 50, 60, 70], "results align with input order");
  assert.deepEqual([...seen].sort((a, b) => a - b), items, "each item processed once");
  assert.equal(seen.length, items.length, "no item processed twice");
});

test("never exceeds the concurrency bound — the core anti-timeout guarantee", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const limit = 4;
  const items = Array.from({ length: 25 }, (_, i) => i);

  await runWithConcurrency(items, limit, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    // Yield so other workers can start and the in-flight count is observable.
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
  });

  assert.ok(maxInFlight > 1, "tasks actually ran concurrently (not serially)");
  assert.ok(maxInFlight <= limit, `at most ${limit} in flight, saw ${maxInFlight}`);
});

test("parallelizes — total wall time is far below the serial sum", async () => {
  // 12 tasks × 20ms each. Serial would be ~240ms; with 6 in flight it is ~40ms.
  // The assertion is loose (well under the serial sum) to stay non-flaky on CI.
  const items = Array.from({ length: 12 }, (_, i) => i);
  const start = Date.now();
  await runWithConcurrency(items, 6, async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 120, `expected parallel speedup, took ${elapsed}ms (serial would be ~240ms)`);
});

test("empty input is a no-op (no workers spawned)", async () => {
  let calls = 0;
  const results = await runWithConcurrency([], 8, async () => {
    calls++;
    return 1;
  });
  assert.deepEqual(results, []);
  assert.equal(calls, 0);
});

test("limit larger than item count caps workers at item count", async () => {
  let maxInFlight = 0;
  let inFlight = 0;
  const items = [1, 2, 3];
  await runWithConcurrency(items, 100, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
  });
  assert.ok(maxInFlight <= items.length, `at most ${items.length} in flight, saw ${maxInFlight}`);
});

test("REMINDER_CONCURRENCY is the shared 8-wide bound mirrored by the reminder pass", () => {
  assert.equal(REMINDER_CONCURRENCY, 8);
});
