import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categorizeReconciliation,
  type ReconEntitlement,
  type ReconSubscription,
} from "./reconciliation-core";

const ent = (over: Partial<ReconEntitlement> = {}): ReconEntitlement => ({
  userId: "u1",
  plan: "PRO",
  proSource: "stripe",
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  stripePriceId: "price_1",
  subscriptionAmountCents: 799,
  ...over,
});

const sub = (over: Partial<ReconSubscription> = {}): ReconSubscription => ({
  id: "sub_1",
  status: "active",
  customerId: "cus_1",
  priceId: "price_1",
  amountCents: 799,
  ...over,
});

const typesOf = (ds: { type: string }[]) => ds.map((d) => d.type).sort();

test("matching stripe PRO ↔ active sub yields no discrepancies", () => {
  assert.deepEqual(categorizeReconciliation([ent()], [sub()]), []);
});

test("orphan_stripe_sub: live sub with no matching entitlement", () => {
  const ds = categorizeReconciliation([], [sub({ customerId: "cus_x" })]);
  assert.deepEqual(typesOf(ds), ["orphan_stripe_sub"]);
  assert.equal(ds[0].stripeSubscriptionId, "sub_1");
});

test("stripe_live_but_db_not_pro: active sub but entitlement is FREE", () => {
  const ds = categorizeReconciliation([ent({ plan: "FREE", proSource: undefined })], [sub()]);
  assert.deepEqual(typesOf(ds), ["stripe_live_but_db_not_pro"]);
});

test("prosource_mismatch: active stripe sub but entitlement proSource is license", () => {
  const ds = categorizeReconciliation([ent({ proSource: "license" })], [sub()]);
  assert.deepEqual(typesOf(ds), ["prosource_mismatch"]);
});

test("price_mismatch and amount_mismatch fire only when both sides present", () => {
  const ds = categorizeReconciliation(
    [ent({ stripePriceId: "price_OLD", subscriptionAmountCents: 599 })],
    [sub({ priceId: "price_NEW", amountCents: 799 })],
  );
  assert.deepEqual(typesOf(ds), ["amount_mismatch", "price_mismatch"]);

  // missing on one side → no false positive
  assert.deepEqual(
    categorizeReconciliation([ent({ stripePriceId: undefined })], [sub({ priceId: "price_NEW" })]),
    [],
  );
});

test("db_pro_but_stripe_inactive: stripe PRO entitlement with no live sub", () => {
  const ds = categorizeReconciliation([ent()], []);
  assert.deepEqual(typesOf(ds), ["db_pro_but_stripe_inactive"]);
});

test("incomplete/unpaid/paused subs are NOT flagged as missed-upgrade", () => {
  // FREE entitlement + an incomplete sub is correct, not drift.
  assert.deepEqual(
    categorizeReconciliation(
      [ent({ plan: "FREE", proSource: undefined })],
      [sub({ status: "incomplete" })],
    ),
    [],
  );
  // But a stripe-PRO entitlement whose only sub is incomplete is still caught by
  // pass 2 (its customer is not added to the live set).
  const ds = categorizeReconciliation([ent()], [sub({ status: "incomplete" })]);
  assert.deepEqual(typesOf(ds), ["db_pro_but_stripe_inactive"]);
});

test("past_due is treated as live PRO (no false missed-cancellation)", () => {
  assert.deepEqual(categorizeReconciliation([ent()], [sub({ status: "past_due" })]), []);
});

test("customer_collision: two users share one Stripe customer id", () => {
  const ds = categorizeReconciliation(
    [ent({ userId: "u1" }), ent({ userId: "u2" })],
    [sub()],
  );
  assert.ok(ds.some((d) => d.type === "customer_collision"));
});

test("truncated list skips pass 2 to avoid false missed-cancellations", () => {
  // A stripe-PRO with no live sub would normally be flagged, but not when truncated.
  const ds = categorizeReconciliation([ent()], [], { truncated: true });
  assert.equal(
    ds.some((d) => d.type === "db_pro_but_stripe_inactive"),
    false,
  );
});
