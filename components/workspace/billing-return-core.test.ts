import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BILLING_TRY_AT_MS,
  billingReturnKind,
  startBillingReturnPoll,
  type BillingReturnStatus,
} from "./billing-return-core";

// ACCT-17 + DATA-17: after checkout, Home re-reads the plan at 1.5, 3 and 5 s,
// stops on Pro, stops after the last try, and leaves no timers after unmount.

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimer(fn: () => void, ms: number) {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer(id: unknown) {
      timers.delete(id as number);
    },
    pending: () => timers.size,
    now: () => now,
    /** Run every timer due up to `to` ms, letting promises settle between them. */
    async advanceTo(to: number) {
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= to)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
        for (let i = 0; i < 5; i++) await Promise.resolve();
      }
      now = to;
    },
  };
}

function run(results: Array<boolean | Error>) {
  const clock = fakeClock();
  const statuses: BillingReturnStatus[] = [];
  const triedAt: number[] = [];
  const stop = startBillingReturnPoll({
    check: () => {
      triedAt.push(clock.now());
      const next = results.shift() ?? false;
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    onStatus: (s) => statuses.push(s),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return { clock, statuses, triedAt, stop };
}

test("tries at 1.5, 3 and 5 seconds", () => {
  assert.deepEqual([...BILLING_TRY_AT_MS], [1500, 3000, 5000]);
});

test("still Free after the last try: activating, then pending; no timers left", async () => {
  const { clock, statuses, triedAt } = run([false, false, false]);
  assert.deepEqual(statuses, ["activating"]);
  await clock.advanceTo(10_000);
  assert.deepEqual(triedAt, [1500, 3000, 5000]);
  assert.deepEqual(statuses, ["activating", "pending"]);
  assert.equal(clock.pending(), 0);
});

test("stops as soon as the plan is Pro", async () => {
  const { clock, statuses, triedAt } = run([false, true]);
  await clock.advanceTo(10_000);
  assert.deepEqual(triedAt, [1500, 3000]);
  assert.deepEqual(statuses, ["activating", "active"]);
  assert.equal(clock.pending(), 0);
});

test("a failed read counts as not Pro yet and the poll goes on", async () => {
  const { clock, statuses, triedAt } = run([new Error("offline"), false, true]);
  await clock.advanceTo(10_000);
  assert.deepEqual(triedAt, [1500, 3000, 5000]);
  assert.deepEqual(statuses, ["activating", "active"]);
});

test("after unmount no try runs and no timer is left", async () => {
  const { clock, statuses, triedAt, stop } = run([false, false, false]);
  await clock.advanceTo(2000);
  stop();
  assert.equal(clock.pending(), 0);
  await clock.advanceTo(10_000);
  assert.deepEqual(triedAt, [1500]);
  assert.deepEqual(statuses, ["activating"]);
});

test("a result that lands after unmount is ignored", async () => {
  const clock = fakeClock();
  const statuses: BillingReturnStatus[] = [];
  let resolveCheck: (pro: boolean) => void = () => {};
  const stop = startBillingReturnPoll({
    check: () => new Promise<boolean>((resolve) => (resolveCheck = resolve)),
    onStatus: (s) => statuses.push(s),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  await clock.advanceTo(1500);
  stop();
  resolveCheck(true);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(statuses, ["activating"]);
  assert.equal(clock.pending(), 0);
});

test("the billing query value maps to success, cancelled or nothing", () => {
  assert.equal(billingReturnKind("success"), "success");
  assert.equal(billingReturnKind("cancelled"), "cancelled");
  assert.equal(billingReturnKind("other"), null);
  assert.equal(billingReturnKind(null), null);
});
