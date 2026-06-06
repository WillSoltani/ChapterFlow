import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  lastNDays,
  queryEventsForDay,
  scanAllEntitlements,
  type EntitlementSnapshot,
} from "@/app/app/api/book/_lib/admin-metrics";
import {
  listRecentBillingEvents,
  type BillingEventRecord,
} from "@/app/app/api/book/_lib/repo";
import { BILLING_CURRENCY } from "@/lib/pricing";

export const runtime = "nodejs";

// Billing intelligence fields now live on EntitlementSnapshot itself and are
// projected + mapped by scanAllEntitlements. The previous `as BillingEnt[]`
// cast declared these fields without the scan ever reading them, so every one
// was `undefined` at runtime → realMrr=0. Reading EntitlementSnapshot directly
// keeps TypeScript honest about what the scan actually returns.

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const warnings: string[] = [];
    const days = lastNDays(30);

    let entitlements: EntitlementSnapshot[] = [];
    try {
      entitlements = await scanAllEntitlements(tableName);
    } catch (err) {
      console.warn("[admin-billing] entitlement scan failed:", err);
      warnings.push("Entitlement data unavailable (scan failed).");
    }

    const activePro = entitlements.filter(
      (e) => e.plan === "PRO" && e.proStatus !== "canceled" && e.proStatus !== "inactive",
    );
    const stripePro = activePro.filter((e) => e.proSource === "stripe");

    // Real MRR = sum of subscriptionAmountCents over active stripe PROs. We bill
    // in a single currency (BILLING_CURRENCY), so this sum is meaningful as-is.
    // If multiple billing currencies ever appear (see the mixed-currency warning
    // below) this sum is no longer valid and needs per-currency grouping.
    const mrrCents = stripePro.reduce(
      (sum, e) => sum + (e.subscriptionAmountCents ?? 0),
      0,
    );

    // Determine the billing currency from the live data, defaulting to the
    // configured single currency. Surface a warning (rather than silently
    // mis-summing) the moment more than one currency is in play.
    const distinctCurrencies = [
      ...new Set(stripePro.map((e) => e.billingCurrency ?? BILLING_CURRENCY)),
    ];
    const currency =
      distinctCurrencies.length === 1 ? distinctCurrencies[0] : BILLING_CURRENCY;
    if (distinctCurrencies.length > 1) {
      warnings.push(
        `Mixed billing currencies in active subscriptions (${distinctCurrencies.join(
          ", ",
        )}). realMrr/realArr sum across currencies and assume one — add per-currency grouping before reporting these.`,
      );
    }

    // Real MRR by country
    const byCountry: Record<string, number> = {};
    for (const e of stripePro) {
      const c = e.billingCountry ?? "UNKNOWN";
      byCountry[c] = (byCountry[c] ?? 0) + (e.subscriptionAmountCents ?? 0);
    }
    const revenueByCountry = Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .map(([country, cents]) => ({ country, mrrCents: cents, mrr: cents / 100 }));

    // Currency mix by count
    const currencyCounts: Record<string, number> = {};
    for (const e of stripePro) {
      const cur = e.billingCurrency ?? BILLING_CURRENCY;
      currencyCounts[cur] = (currencyCounts[cur] ?? 0) + 1;
    }
    const currencyMix = Object.entries(currencyCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([currency, count]) => ({ currency, count }));

    // Card brand mix
    const brandCounts: Record<string, number> = {};
    for (const e of stripePro) {
      const brand = e.cardBrand ?? "unknown";
      brandCounts[brand] = (brandCounts[brand] ?? 0) + 1;
    }
    const cardBrandMix = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([brand, count]) => ({ brand, count }));

    // Failed payments in range — count subscription_change events where
    // the proStatus transitioned to past_due or canceled
    let paymentFailed30d = 0;
    let pastDue30d = 0;
    let canceled30d = 0;
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d, "subscription_change").catch(
        () => ({ events: [] as Record<string, unknown>[], uniqueUsers: new Set<string>() }),
      );
      for (const e of events) {
        const status = typeof e.proStatus === "string" ? e.proStatus : "";
        if (status === "past_due") pastDue30d += 1;
        if (status === "canceled") canceled30d += 1;
      }
    }
    // Count active past_due entitlements as a proxy for "payment_failed" current state
    paymentFailed30d = entitlements.filter(
      (e) => e.proStatus === "past_due" && e.failedPaymentLastReason,
    ).length;

    // Recent refunds + disputes (chargebacks), persisted by the Stripe webhook.
    const [recentRefunds, recentDisputes] = await Promise.all([
      listRecentBillingEvents(tableName, "refund", 25).catch(() => []),
      listRecentBillingEvents(tableName, "dispute", 25).catch(() => []),
    ]);
    const toBillingEventRow = (e: BillingEventRecord) => ({
      userId: e.userId,
      amountCents: e.amountCents,
      amount: e.amountCents / 100,
      currency: e.currency,
      reason: e.reason,
      status: e.status,
      createdAt: e.createdAt,
    });

    // Top paying users
    const topPayingUsers = stripePro
      .filter((e) => (e.subscriptionAmountCents ?? 0) > 0)
      .sort(
        (a, b) => (b.subscriptionAmountCents ?? 0) - (a.subscriptionAmountCents ?? 0),
      )
      .slice(0, 25)
      .map((e) => ({
        userId: e.userId,
        country: e.billingCountry ?? null,
        currency: e.billingCurrency ?? null,
        amountCents: e.subscriptionAmountCents ?? 0,
        cardBrand: e.cardBrand ?? null,
        lastInvoicePaidAt: e.lastInvoicePaidAt ?? null,
      }));

    // Upgrade coverage — % of stripe PROs with full billing data
    const withCountry = stripePro.filter((e) => e.billingCountry).length;
    const withCardBrand = stripePro.filter((e) => e.cardBrand).length;
    const coverage = stripePro.length > 0 ? {
      country: Math.round((withCountry / stripePro.length) * 100),
      cardBrand: Math.round((withCardBrand / stripePro.length) * 100),
    } : { country: 0, cardBrand: 0 };

    return bookOk({
      generatedAt: new Date().toISOString(),
      currency,
      realMrr: mrrCents / 100,
      realArr: (mrrCents * 12) / 100,
      stripeProCount: stripePro.length,
      revenueByCountry,
      currencyMix,
      cardBrandMix,
      paymentFailed30d,
      pastDue30d,
      canceled30d,
      topPayingUsers,
      recentRefunds: recentRefunds.map(toBillingEventRow),
      recentDisputes: recentDisputes.map(toBillingEventRow),
      coverage,
      warnings,
    });
  });
}
