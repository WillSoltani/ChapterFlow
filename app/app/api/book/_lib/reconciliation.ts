import "server-only";

import type Stripe from "stripe";
import { scanAllEntitlements } from "./admin-metrics";
import {
  categorizeReconciliation,
  type ReconDiscrepancy,
  type ReconSubscription,
} from "./reconciliation-core";

/**
 * Billing reconciliation: fetch live Stripe subscriptions + DynamoDB
 * entitlements and delegate the comparison to the pure core
 * (reconciliation-core.ts). Read only — never mutates.
 */

export type { ReconDiscrepancy, ReconDiscrepancyType } from "./reconciliation-core";

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

  // With no `status` filter, Stripe returns subscriptions that are NOT canceled
  // (active / trialing / past_due / paused / unpaid / incomplete). The pure core
  // decides which of those count as "should be PRO".
  const liveSubs: ReconSubscription[] = [];
  let truncated = false;
  let startingAfter: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await stripe.subscriptions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const sub of res.data) {
      const price = sub.items?.data?.[0]?.price;
      liveSubs.push({
        id: sub.id,
        status: sub.status,
        customerId: customerIdOf(sub),
        priceId: price?.id ?? null,
        amountCents: price?.unit_amount ?? null,
      });
    }
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
    if (page === maxPages - 1 && res.has_more) truncated = true;
  }

  const discrepancies = categorizeReconciliation(entitlements, liveSubs, { truncated });

  return {
    liveStripeSubs: liveSubs.length,
    entitlementsScanned: entitlements.length,
    discrepancies,
    truncated,
  };
}
