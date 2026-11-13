import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cancelStripeSubscriptionOnDelete,
  isCancellableStripeStatus,
  type StripeSubscriptionsPort,
} from "./stripe-cancel-core";

function fakeStripe(status: string) {
  const cancelled: string[] = [];
  const port: StripeSubscriptionsPort = {
    retrieve: async () => ({ status }),
    cancel: async (id) => {
      cancelled.push(id);
      return {};
    },
  };
  return { port, cancelled };
}

for (const status of ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]) {
  test(`account deletion cancels a ${status} subscription`, async () => {
    assert.equal(isCancellableStripeStatus(status), true);
    const { port, cancelled } = fakeStripe(status);
    const outcome = await cancelStripeSubscriptionOnDelete(port, "sub_123");
    assert.deepEqual(outcome, { kind: "cancelled", previousStatus: status });
    assert.deepEqual(cancelled, ["sub_123"]);
  });
}

for (const status of ["canceled", "incomplete_expired"]) {
  test(`account deletion leaves a ${status} subscription alone`, async () => {
    assert.equal(isCancellableStripeStatus(status), false);
    const { port, cancelled } = fakeStripe(status);
    const outcome = await cancelStripeSubscriptionOnDelete(port, "sub_123");
    assert.deepEqual(outcome, { kind: "already_finished", status });
    assert.deepEqual(cancelled, []);
  });
}

test("a missing status is not treated as cancellable", () => {
  assert.equal(isCancellableStripeStatus(undefined), false);
  assert.equal(isCancellableStripeStatus(""), false);
});

test("a Stripe read failure propagates so the route records it", async () => {
  const port: StripeSubscriptionsPort = {
    retrieve: async () => {
      throw new Error("stripe down");
    },
    cancel: async () => {
      throw new Error("must not be called");
    },
  };
  await assert.rejects(cancelStripeSubscriptionOnDelete(port, "sub_123"), /stripe down/);
});
