import type { BookUserEntitlement } from "./types";

/**
 * Build the effective read model for an allowlisted Production TestFlight QA
 * account. StoreKit Sandbox billing state remains isolated in its own row, but
 * the normal application reads may temporarily use that row as the authority
 * for access. User-scoped production fields stay attached so enabling the QA
 * lane never forks unlock history or loses the identifiers used by billing and
 * erasure flows.
 */
function overlaySandboxEntitlement(
  production: BookUserEntitlement | null,
  sandbox: BookUserEntitlement,
): BookUserEntitlement {
  if (!production) return sandbox;

  return {
    ...sandbox,
    freeBookSlots: production.freeBookSlots,
    unlockedBookIds: production.unlockedBookIds,
    stripeCustomerId: production.stripeCustomerId,
    stripeSubscriptionId: production.stripeSubscriptionId,
    stripePriceId: production.stripePriceId,
    subscriptionInterval: production.subscriptionInterval,
    discountCouponId: production.discountCouponId,
    lastStripeEventAt: production.lastStripeEventAt,
  };
}

/**
 * Select the entitlement returned by every normal repository read.
 *
 * Production Pro always wins. Otherwise an active Sandbox Pro row may grant
 * access only while the caller is explicitly allowlisted. If neither row is
 * effectively Pro, the Production row remains primary; a Sandbox-only FREE row
 * is surfaced solely when there is no Production row at all.
 */
export function selectAppleTestFlightEntitlement(input: {
  production: BookUserEntitlement | null;
  sandbox: BookUserEntitlement | null;
  sandboxAllowed: boolean;
}): BookUserEntitlement | null {
  if (!input.sandboxAllowed) return input.production;
  if (input.production?.plan === "PRO") return input.production;
  if (input.sandbox?.plan === "PRO") {
    return overlaySandboxEntitlement(input.production, input.sandbox);
  }
  return input.production ?? input.sandbox;
}
