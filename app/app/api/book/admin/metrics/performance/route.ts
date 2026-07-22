import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  lastNDays,
  percentile,
  queryEventsForDay,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

const NUMERIC_FIELDS = [
  "ttfbMs",
  "domContentLoadedMs",
  "firstContentfulPaintMs",
  "pageLoadMs",
  // Web Vitals (Phase 4 — captured as numbers when available)
  "lcpMs",
  "inpMs",
  "clsScore",
] as const;
type PerfField = (typeof NUMERIC_FIELDS)[number];

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const url = new URL(req.url);
    const range = Number(url.searchParams.get("range") ?? "7");
    const days = lastNDays(Math.max(1, Math.min(30, range)));

    // Pull beacon_performance events across the range (parallel)
    const dayResults = await Promise.all(
      days.map((d) =>
        queryEventsForDay(analyticsTable, d, "beacon_performance").catch(() => ({
          events: [] as Record<string, unknown>[],
          uniqueUsers: new Set<string>(),
        })),
      ),
    );
    const events = dayResults.flatMap((r) => r.events);

    // Compute percentiles per field
    const stats: Record<PerfField, { p50: number; p95: number; p99: number; count: number }> =
      {} as never;
    for (const field of NUMERIC_FIELDS) {
      const values = events
        .map((e) => e[field])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0)
        .sort((a, b) => a - b);
      stats[field] = {
        p50: Math.round(percentile(values, 50)),
        p95: Math.round(percentile(values, 95)),
        p99: Math.round(percentile(values, 99)),
        count: values.length,
      };
    }

    // Per-route averages (top 10 by sample count)
    const byRoute = new Map<string, number[]>();
    for (const e of events) {
      const path = typeof e.path === "string" ? normalizePath(e.path) : null;
      const ms = typeof e.pageLoadMs === "number" ? e.pageLoadMs : null;
      if (!path || ms === null || ms < 0) continue;
      if (!byRoute.has(path)) byRoute.set(path, []);
      byRoute.get(path)!.push(ms);
    }
    const routes = Array.from(byRoute.entries())
      .map(([path, values]) => {
        values.sort((a, b) => a - b);
        return {
          path,
          samples: values.length,
          p50: Math.round(percentile(values, 50)),
          p95: Math.round(percentile(values, 95)),
        };
      })
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 20);

    // Daily p50 trend for pageLoadMs
    const trend = days.map((d, i) => {
      const dayEvents = dayResults[i]?.events ?? [];
      const values = dayEvents
        .map((e) => e.pageLoadMs)
        .filter((v): v is number => typeof v === "number" && v >= 0)
        .sort((a, b) => a - b);
      return {
        date: d,
        p50: Math.round(percentile(values, 50)),
        p95: Math.round(percentile(values, 95)),
        samples: values.length,
      };
    });

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      stats,
      routes,
      trend,
    });
  });
}

function normalizePath(path: string): string {
  // Replace UUIDs and numeric IDs with placeholders so /book/library/abc123/...
  // groups under one route.
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:uuid")
    .replace(/\/\d+/g, "/:id")
    .slice(0, 80);
}
