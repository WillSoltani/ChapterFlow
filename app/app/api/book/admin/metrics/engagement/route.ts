import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  dauForDay,
  dailySeries,
  lastNDays,
  queryEventsForDay,
  sumFieldOnDay,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const url = new URL(req.url);
    const range = Number(url.searchParams.get("range") ?? "30");
    const days = lastNDays(Math.max(7, Math.min(90, range)));

    // For each day, compute DAU + reading minutes + sessions.
    const daily = await Promise.all(
      days.map(async (d) => {
        const [dau, sessions, readingMs] = await Promise.all([
          dauForDay(analyticsTable, d),
          countEvents(analyticsTable, d, "reading_session"),
          sumFieldOnDay(analyticsTable, d, "reading_session", "deltaMs"),
        ]);
        return { date: d, dau, sessions, minutes: Math.round(readingMs / 60000) };
      }),
    );

    // Quiz events
    const quizSeries = await dailySeries(analyticsTable, days, "quiz_attempt");
    const quizPasses = await dailySeries(analyticsTable, days, "quiz_passed");

    // Hour×Weekday session heatmap (last 14 days)
    const heatmapDays = days.slice(-14);
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const d of heatmapDays) {
      const { events } = await queryEventsForDay(analyticsTable, d, "reading_session");
      for (const e of events) {
        const occurredAt = e.occurredAt;
        if (typeof occurredAt !== "string") continue;
        const date = new Date(occurredAt);
        const dow = date.getUTCDay();
        const hour = date.getUTCHours();
        heatmap[dow][hour] += 1;
      }
    }

    return bookOk({
      generatedAt: new Date().toISOString(),
      range: days.length,
      daily,
      quizAttempts: quizSeries.map((d) => ({ date: d.date, value: d.events })),
      quizPasses: quizPasses.map((d) => ({ date: d.date, value: d.events })),
      heatmap,
    });
  });
}

async function countEvents(table: string, day: string, type: string): Promise<number> {
  const series = await dailySeries(table, [day], type);
  return series[0]?.events ?? 0;
}
