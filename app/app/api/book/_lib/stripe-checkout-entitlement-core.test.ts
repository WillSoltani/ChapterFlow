import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldBlockStripeCheckout } from "./stripe-checkout-entitlement-core";

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
