import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MIN_REUSE_REMAINING_SECONDS,
  isBillableSubscriptionStatus,
  isStripeSubscriberEntitlement,
  planOpenCheckoutSessions,
  type OpenCheckoutSession,
} from "./checkout-session-core";

const NOW = 1_800_000_000;

function session(
  id: string,
  overrides: Partial<OpenCheckoutSession> = {}
): OpenCheckoutSession {
  return {
    id,
    url: `https://stripe.test/${id}`,
    expires_at: NOW + 3600,
    metadata: { userId: "user-1", interval: "monthly" },
    ...overrides,
  };
}

const params = { userId: "user-1", interval: "monthly", nowSeconds: NOW };

test("no open sessions: nothing to reuse or expire", () => {
  assert.deepEqual(planOpenCheckoutSessions([], params), { reuse: null, expire: [] });
});

test("an open session for the same user and interval is reused", () => {
  const plan = planOpenCheckoutSessions([session("cs_1")], params);
  assert.equal(plan.reuse?.id, "cs_1");
  assert.deepEqual(plan.expire, []);
});

test("only one session is reused; the other open ones are expired", () => {
  const plan = planOpenCheckoutSessions([session("cs_1"), session("cs_2")], params);
  assert.equal(plan.reuse?.id, "cs_1");
  assert.deepEqual(plan.expire, ["cs_2"]);
});

test("a session for another interval is expired, not reused", () => {
  const plan = planOpenCheckoutSessions(
    [session("cs_1", { metadata: { userId: "user-1", interval: "annual" } })],
    params
  );
  assert.equal(plan.reuse, null);
  assert.deepEqual(plan.expire, ["cs_1"]);
});

test("a session without our metadata (older sessions) is expired", () => {
  const plan = planOpenCheckoutSessions([session("cs_1", { metadata: { userId: "user-1" } })], params);
  assert.equal(plan.reuse, null);
  assert.deepEqual(plan.expire, ["cs_1"]);
});

test("a session about to expire is replaced", () => {
  const plan = planOpenCheckoutSessions(
    [session("cs_1", { expires_at: NOW + MIN_REUSE_REMAINING_SECONDS - 1 })],
    params
  );
  assert.equal(plan.reuse, null);
  assert.deepEqual(plan.expire, ["cs_1"]);
});

test("a session with no URL is expired", () => {
  const plan = planOpenCheckoutSessions([session("cs_1", { url: null })], params);
  assert.equal(plan.reuse, null);
  assert.deepEqual(plan.expire, ["cs_1"]);
});

test("billable subscription statuses", () => {
  for (const s of ["active", "trialing", "past_due"]) assert.equal(isBillableSubscriptionStatus(s), true);
  for (const s of ["canceled", "incomplete_expired", "incomplete", "unpaid", "paused"]) {
    assert.equal(isBillableSubscriptionStatus(s), false);
  }
});

test("only a Stripe-sourced Pro with a customer counts as a Stripe subscriber", () => {
  assert.equal(
    isStripeSubscriberEntitlement({ plan: "PRO", proSource: "stripe", stripeCustomerId: "cus_1" }),
    true
  );
  assert.equal(isStripeSubscriberEntitlement({ plan: "PRO", proSource: "gift_code" }), false);
  assert.equal(isStripeSubscriberEntitlement({ plan: "PRO", proSource: "stripe" }), false);
  assert.equal(
    isStripeSubscriberEntitlement({ plan: "FREE", proSource: "stripe", stripeCustomerId: "cus_1" }),
    false
  );
  assert.equal(isStripeSubscriberEntitlement(null), false);
});
