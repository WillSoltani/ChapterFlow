import "server-only";

import type Stripe from "stripe";
import { scanAllEntitlements, type EntitlementSnapshot } from "./admin-metrics";

/**
 * Billing reconciliation: compare live Stripe subscription state against the
 * DynamoDB entitlement records and report where they disagree. This is the
 * safety net for missed/failed webhooks and historical data drift — it never
 * mutates anything, only reports.
 */

export type ReconDiscrepancyType =
  | "orphan_stripe_sub" // live Stripe sub with no matching entitlement (customer→user map missing)
  | "stripe_live_but_db_not_pro" // Stripe billing the customer, DynamoDB says not PRO (missed upgrade)
  | "db_pro_but_stripe_inactive" // DynamoDB stripe-PRO, Stripe has no live sub (missed cancellation)
  | "prosource_mismatch" // active Stripe sub but entitlement proSource != "stripe"
  | "price_mismatch" // Stripe price id != stored stripePriceId
  | "amount_mismatch" // Stripe unit amount != stored subscriptionAmountCents
  | "customer_collision"; // two users share one Stripe customer id (join is ambiguous)

// Statuses that entitle the user to Pro in our webhook (mapSubscriptionStatus).
// The default subscriptions.list ALSO returns incomplete / unpaid / paused —
// those legitimately map to a FREE/canceled entitlement, so we must not treat
// them as "should be PRO" (doing so flags every abandoned checkout as drift).
const PRO_WORTHY_STATUSES = new Set(["active", "trialing", "past_due"]);

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

export type ReconResult = {
  liveStripeSubs: number;
  entitlementsScanned: number;
  discrepancies: ReconDiscrepancy[];
  /** True if the Stripe subscription list was paginated beyond maxPages and stopped early. */
  truncated: boolean;
};

function customerIdOf(sub: Stripe.Subscription): string | null {
  return typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
}

export async function reconcileStripeEntitlements(
  stripe: Stripe,
  bookTableName: string,
  opts?: { maxPages?: number },
): Promise<ReconResult> {
  const maxPages = opts?.maxPages ?? 20; // 100 subs/page → up to 2000 live subs

  const entitlements = await scanAllEntitlements(bookTableName);
  const discrepancies: ReconDiscrepancy[] = [];

  // Build a customerId → entitlement map, flagging the (rare, historical) case
  // where two different users carry the same Stripe customer id — otherwise the
  // collision is silently masked by the last writer and corrupts both passes.
  const byCustomer = new Map<string, EntitlementSnapshot>();
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

  const liveCustomerIds = new Set<string>();
  let liveStripeSubs = 0;
  let truncated = false;

  // Pass 1 — live Stripe subs. With no `status` filter, Stripe returns
  // subscriptions that are NOT canceled (active / trialing / past_due / paused
  // / unpaid). Each should map to a stripe-source PRO entitlement.
  let startingAfter: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await stripe.subscriptions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const sub of res.data) {
      liveStripeSubs++;
      // Skip not-yet/no-longer-entitling statuses (incomplete/unpaid/paused):
      // their FREE/canceled entitlement is correct, not drift. Pass 2 still
      // catches a DB row wrongly marked stripe-PRO for such a sub, because its
      // customer is intentionally NOT added to liveCustomerIds here.
      if (!PRO_WORTHY_STATUSES.has(sub.status)) continue;
      const customerId = customerIdOf(sub);
      if (customerId) liveCustomerIds.add(customerId);
      const ent = customerId ? byCustomer.get(customerId) : undefined;
      const item = sub.items?.data?.[0];
      const priceId = item?.price?.id ?? null;
      const amountCents = item?.price?.unit_amount ?? null;

      if (!ent) {
        discrepancies.push({
          type: "orphan_stripe_sub",
          userId: null,
          stripeCustomerId: customerId,
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
          stripeCustomerId: customerId,
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
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          detail: `Active Stripe subscription, but entitlement proSource is "${ent.proSource}" — the user is billed by Stripe yet entitled via ${ent.proSource}.`,
          dbPlan: ent.plan,
          dbProSource: ent.proSource,
          stripeStatus: sub.status,
        });
      }
      if (priceId && ent.stripePriceId && priceId !== ent.stripePriceId) {
        discrepancies.push({
          type: "price_mismatch",
          userId: ent.userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          detail: `Stripe price ${priceId} != stored ${ent.stripePriceId}.`,
          dbPlan: ent.plan,
          dbProSource: ent.proSource,
          stripeStatus: sub.status,
        });
      }
      if (
        amountCents != null &&
        ent.subscriptionAmountCents != null &&
        amountCents !== ent.subscriptionAmountCents
      ) {
        discrepancies.push({
          type: "amount_mismatch",
          userId: ent.userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          detail: `Stripe amount ${amountCents}¢ != stored ${ent.subscriptionAmountCents}¢.`,
          dbPlan: ent.plan,
          dbProSource: ent.proSource,
          stripeStatus: sub.status,
        });
      }
    }
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
    if (page === maxPages - 1 && res.has_more) truncated = true;
  }

  // Pass 2 — DynamoDB stripe-source PROs that have NO active Stripe sub: a
  // cancellation webhook was likely missed, so they retain Pro for free. Only
  // run when the Stripe list was NOT truncated, otherwise liveCustomerIds is
  // partial and every PRO on an unscanned page would be a false positive.
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

  return {
    liveStripeSubs,
    entitlementsScanned: entitlements.length,
    discrepancies,
    truncated,
  };
}
