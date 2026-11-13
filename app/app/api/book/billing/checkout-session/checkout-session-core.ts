/**
 * Pure decisions for POST /billing/checkout-session (unit-tested).
 *
 * Stripe allows several open Checkout sessions per customer, and each one can
 * complete into its own subscription. The route therefore keeps at most one
 * open session per customer: it reuses an open session for the same user and
 * billing interval, and expires every other open one before creating a new one.
 */

/** Stripe subscription statuses that are still billing (or about to). */
const BILLABLE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isBillableSubscriptionStatus(status: string): boolean {
  return BILLABLE_SUBSCRIPTION_STATUSES.has(status);
}

/**
 * An already-subscribed Stripe customer is sent to the billing portal instead of
 * a second Checkout. Pro from any other source keeps the 409 already_pro.
 */
export function isStripeSubscriberEntitlement(
  entitlement: {
    plan?: string | undefined;
    proSource?: string | null | undefined;
    stripeCustomerId?: string | undefined;
  } | null
): boolean {
  return (
    entitlement?.plan === "PRO" &&
    entitlement.proSource === "stripe" &&
    typeof entitlement.stripeCustomerId === "string" &&
    entitlement.stripeCustomerId.length > 0
  );
}

export type OpenCheckoutSession = {
  id: string;
  url: string | null;
  expires_at?: number | null;
  metadata?: Record<string, string> | null;
};

/** A reused session must stay open at least this long after we hand it out. */
export const MIN_REUSE_REMAINING_SECONDS = 10 * 60;

/**
 * Picks an open session to hand back (same user, same interval, a URL, and not
 * about to expire) and lists every other open session to expire.
 */
export function planOpenCheckoutSessions(
  open: readonly OpenCheckoutSession[],
  params: { userId: string; interval: string; nowSeconds: number }
): { reuse: OpenCheckoutSession | null; expire: string[] } {
  let reuse: OpenCheckoutSession | null = null;
  const expire: string[] = [];
  for (const session of open) {
    const matches =
      reuse === null &&
      typeof session.url === "string" &&
      session.url.length > 0 &&
      session.metadata?.userId === params.userId &&
      session.metadata?.interval === params.interval &&
      typeof session.expires_at === "number" &&
      session.expires_at - params.nowSeconds >= MIN_REUSE_REMAINING_SECONDS;
    if (matches) {
      reuse = session;
    } else {
      expire.push(session.id);
    }
  }
  return { reuse, expire };
}
