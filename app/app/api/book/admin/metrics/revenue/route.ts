import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  batchGetUserSnapshots,
  dailySeries,
  lastNDays,
  queryEventsForDay,
  scanAllEntitlements,
} from "@/app/app/api/book/_lib/admin-metrics";
import { PRICING } from "@/lib/pricing";

export const runtime = "nodejs";

// Default monthly price assumption — used purely for MRR estimation.
// NOTE: this is the CAD list price; the response still labels it "USD" below —
// that currency mislabel is tracked separately under the currency-correctness
// work (W2), not changed here.
const DEFAULT_PRO_PRICE = PRICING.monthlyAmount;

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const url = new URL(req.url);
    const range = Number(url.searchParams.get("range") ?? "30");
    const days = lastNDays(Math.max(7, Math.min(180, range)));
    const warnings: string[] = [];

    const [subSeries, licenseSeries, entitlements] = await Promise.all([
      dailySeries(analyticsTable, days, "subscription_change").catch((err) => {
        console.warn("[admin-revenue] subscription_change query failed:", err);
        return [];
      }),
      dailySeries(analyticsTable, days, "license_redemption_attempt").catch((err) => {
        console.warn("[admin-revenue] license_redemption_attempt query failed:", err);
        return [];
      }),
      scanAllEntitlements(tableName).catch((err) => {
        console.warn("[admin-revenue] entitlement scan failed:", err);
        warnings.push("Entitlement data unavailable (database scan failed).");
        return [];
      }),
    ]);

    // Active PRO entitlements (source of truth for plan)
    const proEntitlements = entitlements.filter(
      (e) => e.plan === "PRO" && e.proStatus !== "canceled" && e.proStatus !== "inactive",
    );
    const freeEntitlements = entitlements.filter((e) => e.plan === "FREE");
    const proTotal = proEntitlements.length;
    const freeTotal = freeEntitlements.length;

    // PRO source breakdown from current entitlements (not from event log)
    const proSourceBreakdown: Record<string, number> = {};
    for (const e of proEntitlements) {
      const source = e.proSource ?? "unknown";
      proSourceBreakdown[source] = (proSourceBreakdown[source] ?? 0) + 1;
    }

    // For new/churned counts in range, scan subscription_change events
    let newPros = 0;
    let churnedPros = 0;
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d, "subscription_change").catch(
        () => ({ events: [], uniqueUsers: new Set<string>() }),
      );
      for (const e of events) {
        const newPlan = typeof e.plan === "string" ? e.plan : null;
        const proStatus = typeof e.proStatus === "string" ? e.proStatus : null;
        if (newPlan === "PRO" && (proStatus === "active" || !proStatus)) newPros += 1;
        if (newPlan === "FREE" || proStatus === "canceled") churnedPros += 1;
      }
    }

    // Activity counts for PRO users — overlay with snapshot lastActiveAt
    const now = Date.now();
    const ms7d = 7 * 86_400_000;
    const ms30d = 30 * 86_400_000;
    let proActive7d = 0;
    let proActive30d = 0;
    let snapshots = new Map<string, Record<string, unknown>>();
    if (proEntitlements.length > 0) {
      snapshots = await batchGetUserSnapshots(
        analyticsTable,
        proEntitlements.map((e) => e.userId),
      );
      for (const e of proEntitlements) {
        const snap = snapshots.get(e.userId);
        const lastActiveAt = snap?.lastActiveAt;
        if (typeof lastActiveAt !== "string") continue;
        const ts = new Date(lastActiveAt).getTime();
        if (Number.isNaN(ts)) continue;
        if (now - ts <= ms7d) proActive7d += 1;
        if (now - ts <= ms30d) proActive30d += 1;
      }
    }

    // MRR estimate: only count stripe-source PRO (license/flow_points are free)
    const mrrCount = proEntitlements.filter((e) => e.proSource === "stripe").length;
    const mrrEstimate = mrrCount * DEFAULT_PRO_PRICE;
    const arrEstimate = mrrEstimate * 12;

    // Recent PRO list (sorted by subscriptionStartedAt or updatedAt desc)
    const recentProList = proEntitlements
      .map((e) => {
        const snap = snapshots.get(e.userId);
        return {
          userId: e.userId,
          email: typeof snap?.email === "string" ? snap.email : null,
          proStatus: e.proStatus ?? null,
          proSource: e.proSource ?? null,
          subscriptionStartedAt:
            typeof snap?.subscriptionStartedAt === "string"
              ? snap.subscriptionStartedAt
              : null,
          currentPeriodEnd: e.currentPeriodEnd ?? null,
          licenseExpiresAt: e.licenseExpiresAt ?? null,
          lastActiveAt: typeof snap?.lastActiveAt === "string" ? snap.lastActiveAt : null,
          cancelAtPeriodEnd: e.cancelAtPeriodEnd ?? false,
        };
      })
      .sort((a, b) => {
        const tA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const tB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return tB - tA;
      })
      .slice(0, 50);

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
      warnings,
    });
  });
}
