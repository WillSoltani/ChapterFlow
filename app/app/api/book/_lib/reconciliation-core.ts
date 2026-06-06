/**
 * Pure billing-reconciliation logic — no I/O, no server-only, no AWS/Stripe SDK
 * — so it is unit-testable. The Stripe + DynamoDB fetching lives in
 * reconciliation.ts, which maps its results into the minimal shapes below and
 * calls categorizeReconciliation().
 */

export type ReconDiscrepancyType =
  | "orphan_stripe_sub" // live Stripe sub with no matching entitlement (customer→user map missing)
  | "stripe_live_but_db_not_pro" // Stripe billing the customer, DynamoDB says not PRO (missed upgrade)
  | "db_pro_but_stripe_inactive" // DynamoDB stripe-PRO, Stripe has no active sub (missed cancellation)
  | "prosource_mismatch" // active Stripe sub but entitlement proSource != "stripe"
  | "price_mismatch" // Stripe price id != stored stripePriceId
  | "amount_mismatch" // Stripe unit amount != stored subscriptionAmountCents
  | "customer_collision"; // two users share one Stripe customer id (join is ambiguous)

export type ReconDiscrepancy = {
  type: ReconDiscrepancyType;
  userId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  detail: string;
  dbPlan?: string;
  dbProSource?: string;
  stripeStatus?: string;
};

/** Minimal projection of a DynamoDB entitlement the reconciliation needs. */
export type ReconEntitlement = {
  userId: string;
  plan: "FREE" | "PRO";
  proSource?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionAmountCents?: number;
};

/** Minimal projection of a live Stripe subscription the reconciliation needs. */
export type ReconSubscription = {
  id: string;
  status: string;
  customerId: string | null;
  priceId: string | null;
  amountCents: number | null;
};

// Statuses that entitle the user to Pro in our webhook (mapSubscriptionStatus).
// The default Stripe subscriptions.list ALSO returns incomplete / unpaid /
// paused — those legitimately map to a FREE/canceled entitlement, so we must
// NOT treat them as "should be PRO" (else every abandoned checkout looks like
// drift). Their customer is intentionally excluded from liveCustomerIds so a DB
// row wrongly marked stripe-PRO for such a sub is still caught by pass 2.
export const PRO_WORTHY_STATUSES = new Set(["active", "trialing", "past_due"]);

export function categorizeReconciliation(
  entitlements: ReconEntitlement[],
  liveSubs: ReconSubscription[],
  opts?: { truncated?: boolean },
): ReconDiscrepancy[] {
  const truncated = opts?.truncated ?? false;
  const discrepancies: ReconDiscrepancy[] = [];

  // Build customerId → entitlement, flagging the (rare, historical) case where
  // two users share one Stripe customer id — otherwise the collision is masked
  // by the last writer and corrupts both passes.
  const byCustomer = new Map<string, ReconEntitlement>();
  for (const e of entitlements) {
    if (!e.stripeCustomerId) continue;
    const existing = byCustomer.get(e.stripeCustomerId);
    if (existing && existing.userId !== e.userId) {
      discrepancies.push({
        type: "customer_collision",
        userId: e.userId,
        stripeCustomerId: e.stripeCustomerId,
        stripeSubscriptionId: e.stripeSubscriptionId ?? null,
        detail: `Stripe customer ${e.stripeCustomerId} is attached to two users (also ${existing.userId}) — reconciliation can only attribute its subscription to one.`,
        dbPlan: e.plan,
        dbProSource: e.proSource,
      });
    }
    byCustomer.set(e.stripeCustomerId, e);
  }

  // Pass 1 — each PRO-worthy live sub should map to a stripe-source PRO entitlement.
  const liveCustomerIds = new Set<string>();
  for (const sub of liveSubs) {
    if (!PRO_WORTHY_STATUSES.has(sub.status)) continue;
    if (sub.customerId) liveCustomerIds.add(sub.customerId);
    const ent = sub.customerId ? byCustomer.get(sub.customerId) : undefined;

    if (!ent) {
      discrepancies.push({
        type: "orphan_stripe_sub",
        userId: null,
        stripeCustomerId: sub.customerId,
        stripeSubscriptionId: sub.id,
        detail:
          "Live Stripe subscription has no matching DynamoDB entitlement (customer→user mapping missing).",
        stripeStatus: sub.status,
      });
      continue;
    }
    if (ent.plan !== "PRO") {
      discrepancies.push({
        type: "stripe_live_but_db_not_pro",
        userId: ent.userId,
        stripeCustomerId: sub.customerId,
        stripeSubscriptionId: sub.id,
        detail: `Stripe subscription is ${sub.status} but DynamoDB plan is ${ent.plan} (missed upgrade webhook).`,
        dbPlan: ent.plan,
        dbProSource: ent.proSource,
        stripeStatus: sub.status,
      });
      continue;
    }
    if (ent.proSource && ent.proSource !== "stripe") {
      discrepancies.push({
        type: "prosource_mismatch",
        userId: ent.userId,
        stripeCustomerId: sub.customerId,
        stripeSubscriptionId: sub.id,
        detail: `Active Stripe subscription, but entitlement proSource is "${ent.proSource}" — the user is billed by Stripe yet entitled via ${ent.proSource}.`,
        dbPlan: ent.plan,
        dbProSource: ent.proSource,
        stripeStatus: sub.status,
      });
    }
    if (sub.priceId && ent.stripePriceId && sub.priceId !== ent.stripePriceId) {
      discrepancies.push({
        type: "price_mismatch",
        userId: ent.userId,
        stripeCustomerId: sub.customerId,
        stripeSubscriptionId: sub.id,
        detail: `Stripe price ${sub.priceId} != stored ${ent.stripePriceId}.`,
        dbPlan: ent.plan,
        dbProSource: ent.proSource,
        stripeStatus: sub.status,
      });
    }
    if (
      sub.amountCents != null &&
      ent.subscriptionAmountCents != null &&
      sub.amountCents !== ent.subscriptionAmountCents
    ) {
      discrepancies.push({
        type: "amount_mismatch",
        userId: ent.userId,
        stripeCustomerId: sub.customerId,
        stripeSubscriptionId: sub.id,
        detail: `Stripe amount ${sub.amountCents}¢ != stored ${ent.subscriptionAmountCents}¢.`,
        dbPlan: ent.plan,
        dbProSource: ent.proSource,
        stripeStatus: sub.status,
      });
    }
  }

  // Pass 2 — DynamoDB stripe-source PROs with NO active Stripe sub: a
  // cancellation webhook was likely missed. Skipped when the Stripe list was
  // truncated, since liveCustomerIds would be partial → false positives.
  if (!truncated) {
    for (const e of entitlements) {
      if (e.plan === "PRO" && e.proSource === "stripe") {
        if (!e.stripeCustomerId || !liveCustomerIds.has(e.stripeCustomerId)) {
          discrepancies.push({
            type: "db_pro_but_stripe_inactive",
            userId: e.userId,
            stripeCustomerId: e.stripeCustomerId ?? null,
            stripeSubscriptionId: e.stripeSubscriptionId ?? null,
            detail:
              "DynamoDB shows stripe-source PRO but Stripe has no active subscription (missed cancellation webhook).",
            dbPlan: e.plan,
            dbProSource: e.proSource,
          });
        }
      }
    }
  }

  return discrepancies;
}
