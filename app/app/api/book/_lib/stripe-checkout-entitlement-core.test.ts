import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldBlockStripeCheckout,
  stripeCheckoutBlockReason,
} from "./stripe-checkout-entitlement-core";

test("expired effective Apple entitlement cannot enter Stripe Checkout", () => {
  assert.equal(
    shouldBlockStripeCheckout({ plan: "FREE", proSource: "apple" }),
    true,
  );
});

test("all effective Pro users are blocked and ordinary Free users may continue", () => {
  assert.equal(
    shouldBlockStripeCheckout({ plan: "PRO", proSource: "gift_code" }),
    true,
  );
  assert.equal(
    shouldBlockStripeCheckout({ plan: "FREE", proSource: undefined }),
    false,
  );
  assert.equal(shouldBlockStripeCheckout(null), false);
});

// ─── WS4-015: a disputed (charge.dispute.created) FREE entitlement must also
// block Stripe Checkout. The webhook grant write is refused by its
// attribute_not_exists(disputeOpen) condition, so allowing checkout here would
// charge the customer and then be unable to grant access. ───────────────────

test("WS4-015: a disputed FREE entitlement is blocked from Stripe Checkout", () => {
  assert.equal(
    shouldBlockStripeCheckout({ plan: "FREE", disputeOpen: true }),
    true,
  );
});

test("stripeCheckoutBlockReason: disputed FREE entitlement -> billing_disputed", () => {
  assert.equal(
    stripeCheckoutBlockReason({ plan: "FREE", disputeOpen: true }),
    "billing_disputed",
  );
});

test("stripeCheckoutBlockReason: PRO via gift_code -> already_pro", () => {
  assert.equal(
    stripeCheckoutBlockReason({ plan: "PRO", proSource: "gift_code" }),
    "already_pro",
  );
});

test("stripeCheckoutBlockReason: expired-plan Apple lineage -> already_pro", () => {
  assert.equal(
    stripeCheckoutBlockReason({ plan: "FREE", proSource: "apple" }),
    "already_pro",
  );
});

test("stripeCheckoutBlockReason: already_pro takes precedence over disputeOpen", () => {
  assert.equal(
    stripeCheckoutBlockReason({ plan: "PRO", disputeOpen: true }),
    "already_pro",
  );
});

test("stripeCheckoutBlockReason: ordinary FREE entitlement -> null", () => {
  assert.equal(stripeCheckoutBlockReason({ plan: "FREE" }), null);
});

test("stripeCheckoutBlockReason: null entitlement -> null", () => {
  assert.equal(stripeCheckoutBlockReason(null), null);
});
