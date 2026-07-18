/**
 * Starting Stripe Checkout is unsafe while an Apple lineage remains attached,
 * even when its effective read-time plan has just expired. The Stripe webhook
 * intentionally cannot overwrite an Apple source; allowing checkout would
 * charge the customer and then refuse the Stripe grant.
 *
 * It is likewise unsafe while an unresolved chargeback (disputeOpen) stands: the
 * webhook's grant write is refused by its attribute_not_exists(disputeOpen)
 * condition, so charging first would create the same paid-without-access chain.
 */
export function stripeCheckoutBlockReason(entitlement: {
  plan?: string;
  proSource?: string;
  disputeOpen?: boolean;
} | null): "already_pro" | "billing_disputed" | null {
  // already_pro is checked FIRST so a disputed-but-still-Pro account keeps the
  // accurate answer.
  if (entitlement?.plan === "PRO" || entitlement?.proSource === "apple") {
    return "already_pro";
  }
  if (entitlement?.disputeOpen === true) {
    return "billing_disputed";
  }
  return null;
}

export function shouldBlockStripeCheckout(entitlement: {
  plan?: string;
  proSource?: string;
  disputeOpen?: boolean;
} | null): boolean {
  return stripeCheckoutBlockReason(entitlement) !== null;
}
