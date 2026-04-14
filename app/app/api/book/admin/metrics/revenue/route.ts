import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  dailySeries,
  lastNDays,
  listRecentUsersByPlan,
  queryEventsForDay,
  shiftDays,
  totalUsersByPlan,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

// Default monthly price assumption — used purely for MRR estimation.
const DEFAULT_PRO_PRICE = 7.99;

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const url = new URL(req.url);
    const range = Number(url.searchParams.get("range") ?? "30");
    const days = lastNDays(Math.max(7, Math.min(180, range)));

    // Subscription change events
    const subSeries = await dailySeries(analyticsTable, days, "subscription_change");

    // Active PRO recently
    const sinceIso30d = shiftDays(new Date(), -30).toISOString();
    const sinceIso7d = shiftDays(new Date(), -7).toISOString();
    const [proTotal, freeTotal, proRecent] = await Promise.all([
      totalUsersByPlan(analyticsTable, "PRO"),
      totalUsersByPlan(analyticsTable, "FREE"),
      listRecentUsersByPlan(analyticsTable, "PRO", 100),
    ]);

    // Compute new PROs and churned PROs by inspecting subscription_change events
    let newPros = 0;
    let churnedPros = 0;
    let proSourceBreakdown: Record<string, number> = {};
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d, "subscription_change");
      for (const e of events) {
        const newPlan = typeof e.plan === "string" ? e.plan : null;
        const proStatus = typeof e.proStatus === "string" ? e.proStatus : null;
        const proSource = typeof e.proSource === "string" ? e.proSource : "unknown";
        if (newPlan === "PRO" && (proStatus === "active" || !proStatus)) {
          newPros += 1;
          proSourceBreakdown[proSource] = (proSourceBreakdown[proSource] ?? 0) + 1;
        }
        if (newPlan === "FREE" || proStatus === "canceled") {
          churnedPros += 1;
        }
      }
    }

    // PRO active counts by recency
    const now = Date.now();
    const proActive7d = proRecent.filter(
      (u) => typeof u.lastActiveAt === "string" && new Date(u.lastActiveAt).getTime() >= now - 7 * 86400_000,
    ).length;
    const proActive30d = proRecent.filter(
      (u) => typeof u.lastActiveAt === "string" && new Date(u.lastActiveAt).getTime() >= now - 30 * 86400_000,
    ).length;
    void sinceIso30d;
    void sinceIso7d;

    // MRR estimate: active PRO subscribers × monthly price
    const mrrEstimate = proTotal * DEFAULT_PRO_PRICE;
    const arrEstimate = mrrEstimate * 12;

    // License redemptions
    const licenseSeries = await dailySeries(analyticsTable, days, "license_redemption_attempt");

    // Recent PRO list for table
    const recentProList = proRecent.slice(0, 50).map((u) => ({
      userId: String(u.userId ?? ""),
      email: typeof u.email === "string" ? u.email : null,
      proStatus: typeof u.proStatus === "string" ? u.proStatus : null,
      proSource: typeof u.proSource === "string" ? u.proSource : null,
      subscriptionStartedAt:
        typeof u.subscriptionStartedAt === "string" ? u.subscriptionStartedAt : null,
      currentPeriodEnd: typeof u.currentPeriodEnd === "string" ? u.currentPeriodEnd : null,
      lastActiveAt: typeof u.lastActiveAt === "string" ? u.lastActiveAt : null,
    }));

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      mrr: { value: mrrEstimate, currency: "USD", priceAssumption: DEFAULT_PRO_PRICE },
      arr: { value: arrEstimate, currency: "USD" },
      proTotal,
      freeTotal,
      proActive7d,
      proActive30d,
      newPros,
      churnedPros,
      proSourceBreakdown,
      subscriptionEvents: subSeries.map((d) => ({ date: d.date, value: d.events })),
      licenseRedemptions: licenseSeries.map((d) => ({ date: d.date, value: d.events })),
      recentProList,
    });
  });
}
