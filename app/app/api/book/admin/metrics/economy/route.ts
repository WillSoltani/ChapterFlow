import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  computeEconomyHealth,
  generateAlerts,
} from "@/app/app/api/book/_lib/economy-health";
import {
  dailySeries,
  lastNDays,
  queryEventsForDay,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

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
    const days = lastNDays(Math.max(7, Math.min(90, range)));

    // Compute economy health (this scans the main table - moderately expensive)
    // For solo founder scale this is fine; for larger scale, this should be cached.
    const metrics = await computeEconomyHealth(tableName, range);
    const alerts = generateAlerts(metrics);

    // Daily faucet/sink from analytics events
    const [earned, spent] = await Promise.all([
      dailySeries(analyticsTable, days, "flow_points_earned"),
      dailySeries(analyticsTable, days, "flow_points_spent"),
    ]);

    // Aggregate IP earned by source over the period
    const earnedBySource: Record<string, number> = {};
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d, "flow_points_earned");
      for (const e of events) {
        const source = typeof e.sourceType === "string" ? e.sourceType : "unknown";
        const delta = typeof e.deltaPoints === "number" ? e.deltaPoints : 0;
        earnedBySource[source] = (earnedBySource[source] ?? 0) + delta;
      }
    }

    // Aggregate IP spent by reward type
    const spentByReward: Record<string, number> = {};
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d, "flow_points_spent");
      for (const e of events) {
        const rewardId = typeof e.rewardId === "string" ? e.rewardId : "other";
        const delta = typeof e.deltaPoints === "number" ? Math.abs(e.deltaPoints) : 0;
        spentByReward[rewardId] = (spentByReward[rewardId] ?? 0) + delta;
      }
    }

    const dailyFlow = days.map((d, i) => ({
      date: d,
      earned: earned[i]?.events ?? 0,
      spent: spent[i]?.events ?? 0,
    }));

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      metrics,
      alerts,
      dailyFlow,
      earnedBySource: Object.entries(earnedBySource)
        .sort((a, b) => b[1] - a[1])
        .map(([source, amount]) => ({ source, amount })),
      spentByReward: Object.entries(spentByReward)
        .sort((a, b) => b[1] - a[1])
        .map(([rewardId, amount]) => ({ rewardId, amount })),
    });
  });
}
