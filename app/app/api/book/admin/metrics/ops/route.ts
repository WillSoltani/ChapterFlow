import "server-only";

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  dailySeries,
  lastNDays,
  shiftDays,
  queryEventsForDay,
} from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

type IngestionJob = {
  jobId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  bookId: string | null;
  errorReportKey: string | null;
};

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const days = lastNDays(7);
    const warnings: string[] = [];

    // Run all the independent queries in parallel
    const [
      beaconErrors,
      ingestionJobs,
      subscriptionEventsByDay,
      eventsTodayResult,
      eventsYesterdayResult,
    ] = await Promise.all([
      // Beacon performance events to detect issues
      dailySeries(analyticsTable, days, "beacon_performance").catch((err) => {
        console.warn("[admin-ops] beacon_performance query failed:", err);
        return [] as Array<{ date: string; events: number; uniqueUsers: number }>;
      }),

      // Ingestion jobs (Scan with FilterExpression — could fail without scan permission)
      fetchIngestionJobs(tableName).catch((err) => {
        console.warn("[admin-ops] ingestion jobs scan failed:", err);
        warnings.push("Ingestion jobs unavailable (database scan failed).");
        return [] as IngestionJob[];
      }),

      // Targeted query: only subscription_change events (avoid scanning all events)
      Promise.all(
        days.map((d) =>
          queryEventsForDay(analyticsTable, d, "subscription_change").catch((err) => {
            console.warn(`[admin-ops] subscription_change query failed for ${d}:`, err);
            return { events: [], uniqueUsers: new Set<string>() };
          }),
        ),
      ),

      // Today's event count
      queryEventsForDay(analyticsTable, dayKey(new Date())).catch((err) => {
        console.warn("[admin-ops] events today query failed:", err);
        return { events: [], uniqueUsers: new Set<string>() };
      }),

      // Yesterday's event count
      queryEventsForDay(analyticsTable, dayKey(shiftDays(new Date(), -1))).catch((err) => {
        console.warn("[admin-ops] events yesterday query failed:", err);
        return { events: [], uniqueUsers: new Set<string>() };
      }),
    ]);

    // Tally subscription cancellations from the targeted query
    const accountChanges = { deactivated: 0, deleted: 0, reactivated: 0 };
    for (const { events } of subscriptionEventsByDay) {
      for (const e of events) {
        if (e.proStatus === "canceled") {
          accountChanges.deactivated += 1;
        }
      }
    }

    return bookOk({
      generatedAt: new Date().toISOString(),
      eventsToday: eventsTodayResult.events.length,
      eventsYesterday: eventsYesterdayResult.events.length,
      ingestionJobs,
      accountChanges,
      beaconErrors: beaconErrors.map((d) => ({ date: d.date, value: d.events })),
      warnings,
    });
  });
}

async function fetchIngestionJobs(tableName: string): Promise<IngestionJob[]> {
  const ingestionRes = await ddbDoc.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: "entity = :e",
      ExpressionAttributeValues: { ":e": "BOOK_INGEST_JOB" },
      Limit: 50,
    }),
  );
  return (ingestionRes.Items ?? [])
    .map((item) => ({
      jobId: String(item.jobId ?? ""),
      status: String(item.status ?? "unknown"),
      createdAt: String(item.createdAt ?? ""),
      updatedAt: String(item.updatedAt ?? ""),
      bookId: typeof item.bookId === "string" ? item.bookId : null,
      errorReportKey: typeof item.errorReportKey === "string" ? item.errorReportKey : null,
    }))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 20);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
