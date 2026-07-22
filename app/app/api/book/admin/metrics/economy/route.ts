import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  computeEconomyHealth,
  generateAlerts,
  type EconomyHealthMetrics,
  type EconomyHealthAlert,
} from "@/app/app/api/book/_lib/economy-health";
import {
  lastNDays,
  queryEventsForDay,
} from "@/app/app/api/book/_lib/admin-metrics";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";
// NOTE (M13/N2): do NOT add `export const maxDuration = ...` here. OpenNext bundles
// every route into the single `default` ServerFn (open-next.config.ts) whose CDK
// timeout is hard-set to 30s; Next's per-route `maxDuration` is a Vercel-platform
// hint that OpenNext/Lambda does NOT honour, so it was dead config giving false
// confidence. computeEconomyHealth falls back to FALLBACK_METRICS if its table
// scan can't complete in the request budget.

const FALLBACK_METRICS: EconomyHealthMetrics = {
  computedAt: new Date().toISOString(),
  averageBalance: 0,
  medianBalance: 0,
  spendRate: 0,
  balanceGini: 0,
  grossFaucet: 0,
  grossSink: 0,
  totalUsers: 0,
  activeUsers: 0,
};

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

    const warnings: string[] = [];

    // Compute economy health (scans the main table — wrap in try/catch in case
    // the Lambda role lacks dynamodb:Scan or it times out)
    let metrics: EconomyHealthMetrics = FALLBACK_METRICS;
    let alerts: EconomyHealthAlert[] = [];
    try {
      metrics = await computeEconomyHealth(tableName, range);
      alerts = generateAlerts(metrics);
    } catch (err) {
      logger.error("admin_economy_compute_failed", { err });
      warnings.push("Balance metrics unavailable (database scan failed).");
    }

    // Daily faucet/sink + per-source aggregates — run all in parallel.
    // Each daily query is independent; use Promise.allSettled so a single
    // failure doesn't kill the whole response.
    const earnedQueries = days.map((d) =>
      queryEventsForDay(analyticsTable, d, "flow_points_earned").catch((err) => {
        logger.warn("admin_economy_flow_points_earned_query_failed", { day: d, err });
        return { events: [], uniqueUsers: new Set<string>() };
      }),
    );
    const spentQueries = days.map((d) =>
      queryEventsForDay(analyticsTable, d, "flow_points_spent").catch((err) => {
        logger.warn("admin_economy_flow_points_spent_query_failed", { day: d, err });
        return { events: [], uniqueUsers: new Set<string>() };
      }),
    );

    const [earnedResults, spentResults] = await Promise.all([
      Promise.all(earnedQueries),
      Promise.all(spentQueries),
    ]);

    // Aggregate IP earned by source
    const earnedBySource: Record<string, number> = {};
    for (const { events } of earnedResults) {
      for (const e of events) {
        const source = typeof e.sourceType === "string" ? e.sourceType : "unknown";
        const delta = typeof e.deltaPoints === "number" ? e.deltaPoints : 0;
        earnedBySource[source] = (earnedBySource[source] ?? 0) + delta;
      }
    }

    // Aggregate IP spent by reward
    const spentByReward: Record<string, number> = {};
    for (const { events } of spentResults) {
      for (const e of events) {
        const rewardId = typeof e.rewardId === "string" ? e.rewardId : "other";
        const delta = typeof e.deltaPoints === "number" ? Math.abs(e.deltaPoints) : 0;
        spentByReward[rewardId] = (spentByReward[rewardId] ?? 0) + delta;
      }
    }

    // Daily flow chart data — count events per day
    const dailyFlow = days.map((d, i) => ({
      date: d,
      earned: earnedResults[i]?.events.length ?? 0,
      spent: spentResults[i]?.events.length ?? 0,
    }));

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      metrics,
      alerts,
      warnings,
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
