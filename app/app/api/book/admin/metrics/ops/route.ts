import "server-only";

import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const days = lastNDays(7);

    // Beacon performance events to detect issues
    const beaconErrors = await dailySeries(analyticsTable, days, "beacon_performance");

    // Most recent ingestion jobs (scan, limited)
    const ingestionRes = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :e",
        ExpressionAttributeValues: { ":e": "BOOK_INGEST_JOB" },
        Limit: 50,
      }),
    );
    const ingestionJobs = (ingestionRes.Items ?? [])
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

    // Account status events (deactivations / deletions in last 7d)
    const accountChanges = { deactivated: 0, deleted: 0, reactivated: 0 };
    for (const d of days) {
      const { events } = await queryEventsForDay(analyticsTable, d);
      for (const e of events) {
        if (e.eventType === "subscription_change" && e.proStatus === "canceled") {
          accountChanges.deactivated += 1;
        }
      }
    }

    // System health summary
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = shiftDays(new Date(), -1).toISOString().slice(0, 10);
    const eventsToday = (await queryEventsForDay(analyticsTable, today)).events.length;
    const eventsYesterday = (await queryEventsForDay(analyticsTable, yesterday)).events.length;

    return bookOk({
      generatedAt: new Date().toISOString(),
      eventsToday,
      eventsYesterday,
      ingestionJobs,
      accountChanges,
      beaconErrors: beaconErrors.map((d) => ({ date: d.date, value: d.events })),
    });
  });
}
