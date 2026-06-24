import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyAccountStatusTransition,
  type AccountTransitionDeps,
} from "./account-status-transition";

type Entitlement = {
  proStatus?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
};

type CaptureInput = Parameters<AccountTransitionDeps["captureCancelFailure"]>[0];

/**
 * Build injected deps that record every call. `entitlement` is the resolved
 * value of getEntitlement; pass `readError` to make getEntitlement reject;
 * pass `cancelError` to make the cancel calls reject.
 */
function makeDeps(opts: {
  entitlement?: Entitlement | null;
  readError?: Error;
  cancelError?: Error;
} = {}) {
  const calls = {
    getEntitlement: 0,
    setStatus: 0,
    cancelImmediately: [] as string[],
    cancelAtPeriodEnd: [] as string[],
    capture: [] as CaptureInput[],
  };
  const deps: AccountTransitionDeps = {
    getEntitlement: async () => {
      calls.getEntitlement += 1;
      if (opts.readError) throw opts.readError;
      return opts.entitlement ?? null;
    },
    setStatus: async () => {
      calls.setStatus += 1;
    },
    cancelImmediately: async (id) => {
      calls.cancelImmediately.push(id);
      if (opts.cancelError) throw opts.cancelError;
    },
    cancelAtPeriodEnd: async (id) => {
      calls.cancelAtPeriodEnd.push(id);
      if (opts.cancelError) throw opts.cancelError;
    },
    captureCancelFailure: async (input) => {
      calls.capture.push(input);
    },
  };
  return { deps, calls };
}

const ACTIVE: Entitlement = {
  proStatus: "active",
  stripeSubscriptionId: "sub_123",
  stripeCustomerId: "cus_123",
};

// THE regression: a DynamoDB read failure must propagate (so the admin retries)
// and must NOT mutate status or silently skip the cancel. Before the fix the
// route wrapped the read in `.catch(() => null)`, which swallowed this into a
// success that left the paying subscription billing with no trace.
test("read failure propagates and leaves the transition un-applied", async () => {
  const { deps, calls } = makeDeps({ readError: new Error("dynamo unavailable") });
  await assert.rejects(
    applyAccountStatusTransition("delete", deps),
    /dynamo unavailable/,
  );
  assert.equal(calls.setStatus, 0, "status must not change when the read fails");
  assert.equal(calls.cancelImmediately.length, 0);
  assert.equal(calls.cancelAtPeriodEnd.length, 0);
  assert.equal(calls.capture.length, 0);
});

test("no entitlement row (null) → status set, cancel legitimately skipped", async () => {
  const { deps, calls } = makeDeps({ entitlement: null });
  await applyAccountStatusTransition("delete", deps);
  assert.equal(calls.getEntitlement, 1);
  assert.equal(calls.setStatus, 1);
  assert.equal(calls.cancelImmediately.length, 0);
  assert.equal(calls.capture.length, 0);
});

test("delete + active sub → immediate cancel, status set, no capture", async () => {
  const { deps, calls } = makeDeps({ entitlement: ACTIVE });
  await applyAccountStatusTransition("delete", deps);
  assert.equal(calls.setStatus, 1);
  assert.deepEqual(calls.cancelImmediately, ["sub_123"]);
  assert.equal(calls.cancelAtPeriodEnd.length, 0);
  assert.equal(calls.capture.length, 0);
});

test("deactivate + active sub → cancel at period end", async () => {
  const { deps, calls } = makeDeps({ entitlement: ACTIVE });
  await applyAccountStatusTransition("deactivate", deps);
  assert.equal(calls.setStatus, 1);
  assert.deepEqual(calls.cancelAtPeriodEnd, ["sub_123"]);
  assert.equal(calls.cancelImmediately.length, 0);
  assert.equal(calls.capture.length, 0);
});

test("Stripe cancel failure is captured (best-effort), transition still resolves", async () => {
  const cancelError = new Error("stripe down");
  const { deps, calls } = makeDeps({ entitlement: ACTIVE, cancelError });
  await applyAccountStatusTransition("delete", deps); // resolves, does not throw
  assert.equal(calls.setStatus, 1);
  assert.equal(calls.capture.length, 1);
  assert.equal(calls.capture[0].kind, "stripe_cancel");
  assert.equal(calls.capture[0].subscriptionId, "sub_123");
  assert.equal(calls.capture[0].stripeCustomerId, "cus_123");
  assert.equal(calls.capture[0].error, cancelError);
});

test("deactivate cancel failure captures stripe_cancel_at_period_end", async () => {
  const { deps, calls } = makeDeps({ entitlement: ACTIVE, cancelError: new Error("x") });
  await applyAccountStatusTransition("deactivate", deps);
  assert.equal(calls.capture.length, 1);
  assert.equal(calls.capture[0].kind, "stripe_cancel_at_period_end");
});

test("reactivate never reads entitlement and never cancels", async () => {
  const { deps, calls } = makeDeps({ entitlement: ACTIVE });
  await applyAccountStatusTransition("reactivate", deps);
  assert.equal(calls.getEntitlement, 0, "reactivate must not be blocked by a billing read");
  assert.equal(calls.setStatus, 1);
  assert.equal(calls.cancelImmediately.length, 0);
  assert.equal(calls.cancelAtPeriodEnd.length, 0);
  assert.equal(calls.capture.length, 0);
});

test("non-active proStatus → no cancel even with a subscription id", async () => {
  const { deps, calls } = makeDeps({
    entitlement: { proStatus: "canceled", stripeSubscriptionId: "sub_123" },
  });
  await applyAccountStatusTransition("delete", deps);
  assert.equal(calls.setStatus, 1);
  assert.equal(calls.cancelImmediately.length, 0);
  assert.equal(calls.capture.length, 0);
});
