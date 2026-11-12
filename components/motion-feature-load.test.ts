import { test } from "node:test";
import assert from "node:assert/strict";
import { MOTION_RETRY_DELAYS, loadWithRetry } from "./motion-feature-load";
import { MOTION_APPROACH_MARGIN } from "./MotionFeatureProvider";

test("a failed feature import is retried after each delay and then resolves", async () => {
  const waits: number[] = [];
  let calls = 0;
  const v = await loadWithRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("ChunkLoadError");
      return "features";
    },
    { wait: async (ms) => void waits.push(ms), online: () => Promise.reject(new Error("not reached")) },
  );
  assert.equal(v, "features");
  assert.equal(calls, 3);
  assert.deepEqual(waits, MOTION_RETRY_DELAYS.slice(0, 2));
});

test("after every delay fails it waits for the network, then starts over; it never rejects", async () => {
  const waits: number[] = [];
  let calls = 0;
  let onlineCalls = 0;
  const errors: number[] = [];
  const v = await loadWithRetry(
    async () => {
      calls++;
      if (calls <= 1 + MOTION_RETRY_DELAYS.length) throw new Error("offline");
      return 42;
    },
    {
      wait: async (ms) => void waits.push(ms),
      online: async () => void onlineCalls++,
      onError: (_e, n) => {
        errors.push(n);
        throw new Error("a logger that throws does not break the load");
      },
    },
  );
  assert.equal(v, 42);
  assert.equal(onlineCalls, 1);
  assert.deepEqual(waits, [...MOTION_RETRY_DELAYS]);
  assert.deepEqual(errors, [1, 2, 3, 4]);
});

test("while offline for good the load stays pending (no rejection)", async () => {
  let settled = false;
  void loadWithRetry(() => Promise.reject(new Error("x")), { wait: async () => {}, online: () => new Promise(() => {}) }).then(
    () => (settled = true),
    () => (settled = true),
  );
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  assert.equal(settled, false);
});

test("the approach margin reaches above the viewport as well as below (a page restored below Pricing)", () => {
  const [top, , bottom] = MOTION_APPROACH_MARGIN.split(/\s+/);
  assert.equal(top, "150%");
  assert.equal(bottom, "150%");
});
