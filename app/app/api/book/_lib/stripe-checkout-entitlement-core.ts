/**
 * Starting Stripe Checkout is unsafe while an Apple lineage remains attached,
 * even when its effective read-time plan has just expired. The Stripe webhook
 * intentionally cannot overwrite an Apple source; allowing checkout would
 * charge the customer and then refuse the Stripe grant.
 */
export function shouldBlockStripeCheckout(entitlement: {
  plan?: string;
  proSource?: string;
} | null): boolean {
  return entitlement?.plan === "PRO" || entitlement?.proSource === "apple";
}
