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
import { BILLING_CURRENCY, monthlySubscriptionCents } from "@/lib/pricing";
import { logger } from "@/lib/logging/logger";

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
      logger.warn("admin_billing_entitlement_scan_failed", { err });
      warnings.push("Entitlement data unavailable (scan failed).");
    }

    const activePro = entitlements.filter(
      (e) => e.plan === "PRO" && e.proStatus !== "canceled" && e.proStatus !== "inactive",
    );
    const stripePro = activePro.filter((e) => e.proSource === "stripe");

    // Normalize each active stripe subscription's recurring amount to a per-
    // MONTH figure. subscriptionAmountCents is stored straight from the Stripe
    // price's unit_amount, which is the amount for ONE billing period — one
    // month for a monthly plan, a FULL YEAR for an annual plan. Summing the raw
    // amounts would count each annual subscriber as ~12 months of MRR (and
    // ~144x of ARR), so we divide annual amounts by 12 via monthlySubscriptionCents
    // BEFORE any aggregation (MRR, by-country, top payers).
    //
    // Legacy rows written before subscriptionInterval was captured fall back to
    // monthly; we count them so the dashboard can warn that any annual plans
    // among them may be overstated until the next webhook backfills the interval.
    let intervalMissing = 0;
    const normalizedPro = stripePro.map((e) => {
      const amountCents = e.subscriptionAmountCents ?? 0;
      if (amountCents > 0 && !e.subscriptionInterval) intervalMissing += 1;
      return {
        ent: e,
        currency: e.billingCurrency ?? BILLING_CURRENCY,
        monthlyCents: monthlySubscriptionCents(amountCents, e.subscriptionInterval),
      };
    });
    if (intervalMissing > 0) {
      warnings.push(
        `${intervalMissing} active subscription(s) missing subscriptionInterval — treated as monthly; MRR/ARR may be overstated for any annual plans among them until the next Stripe webhook backfills the interval.`,
      );
    }

    // Determine the billing currency from the live data, defaulting to the
    // configured single currency. We bill single-currency today; summing CAD+USD
    // cents as if identical would be meaningless, so MRR is grouped per currency
    // and a single headline realMrr/realArr is only reported when exactly one
    // currency is in play (otherwise null + a warning — see below).
    const distinctCurrencies = [...new Set(normalizedPro.map((p) => p.currency))];
    const currency =
      distinctCurrencies.length === 1 ? distinctCurrencies[0] : BILLING_CURRENCY;
    if (distinctCurrencies.length > 1) {
      warnings.push(
        `Mixed billing currencies in active subscriptions (${distinctCurrencies.join(
          ", ",
        )}). realMrr/realArr are reported as null — use the per-currency mrrByCurrency breakdown instead.`,
      );
    }

    // MRR per currency (interval-normalized). Never sum across currencies.
    const mrrCentsByCurrency: Record<string, number> = {};
    for (const { currency: cur, monthlyCents } of normalizedPro) {
      mrrCentsByCurrency[cur] = (mrrCentsByCurrency[cur] ?? 0) + monthlyCents;
    }
    const mrrByCurrency = Object.entries(mrrCentsByCurrency)
      .sort((a, b) => b[1] - a[1])
      .map(([cur, cents]) => ({
        currency: cur,
        mrrCents: cents,
        mrr: cents / 100,
        arrCents: cents * 12,
        arr: (cents * 12) / 100,
      }));

    // A single headline MRR/ARR only makes sense within one currency. With more
    // than one, a single number is nonsensical → null (the warning + the
    // mrrByCurrency breakdown carry the real figures). Zero subscriptions also
    // lands here with one (default) currency → 0, matching prior behavior.
    const mrrCents =
      distinctCurrencies.length <= 1
        ? Object.values(mrrCentsByCurrency).reduce((sum, c) => sum + c, 0)
        : null;

    // Real MRR by country (interval-normalized monthly cents).
    const byCountry: Record<string, number> = {};
    for (const { ent, monthlyCents } of normalizedPro) {
      const c = ent.billingCountry ?? "UNKNOWN";
      byCountry[c] = (byCountry[c] ?? 0) + monthlyCents;
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

    // Top paying users — ranked by interval-normalized MONTHLY amount so annual
    // subscribers (whose raw amount is a full year) don't dominate the list.
    // amountCents is the monthly-equivalent; interval lets the UI label it.
    const topPayingUsers = normalizedPro
      .filter((p) => p.monthlyCents > 0)
      .sort((a, b) => b.monthlyCents - a.monthlyCents)
      .slice(0, 25)
      .map(({ ent, monthlyCents }) => ({
        userId: ent.userId,
        country: ent.billingCountry ?? null,
        currency: ent.billingCurrency ?? null,
        amountCents: monthlyCents,
        interval: ent.subscriptionInterval ?? null,
        cardBrand: ent.cardBrand ?? null,
        lastInvoicePaidAt: ent.lastInvoicePaidAt ?? null,
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
      realMrr: mrrCents === null ? null : mrrCents / 100,
      realArr: mrrCents === null ? null : (mrrCents * 12) / 100,
      mrrByCurrency,
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
