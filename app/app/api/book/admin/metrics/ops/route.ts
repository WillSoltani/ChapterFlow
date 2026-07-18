import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  dailySeries,
  lastNDays,
  shiftDays,
  queryEventsForDay,
} from "@/app/app/api/book/_lib/admin-metrics";
import {
  estimateMonthlyCost,
  getDdbHealth,
  getLambdaHealth,
  type DdbHealth,
  type LambdaHealth,
} from "@/app/app/api/book/_lib/cloudwatch-metrics";
import { listRecentOpsFailures } from "@/app/app/api/book/_lib/ops-failure-repo";
import {
  listRecentIngestionJobsForAdmin,
  type AdminIngestionJob,
} from "@/app/app/api/book/_lib/ingestion-repo";

export const runtime = "nodejs";

type IngestionJob = AdminIngestionJob;

// Lambdas to monitor — names from the CDK stack
const LAMBDAS = ["ChapterFlowServer", "ImageFn", "RevalidationFn", "DynamoProviderFn"];

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

    const [
      beaconErrors,
      ingestionJobs,
      subscriptionEventsByDay,
      eventsTodayResult,
      eventsYesterdayResult,
      lambdaHealth,
      ddbHealth,
      opsFailures,
    ] = await Promise.all([
      dailySeries(analyticsTable, days, "beacon_performance").catch(() => []),
      listRecentIngestionJobsForAdmin(tableName).catch((err) => {
        console.warn("[admin-ops] ingestion jobs scan failed:", err);
        warnings.push("Ingestion jobs unavailable (database scan failed).");
        return [] as IngestionJob[];
      }),
      Promise.all(
        days.map((d) =>
          queryEventsForDay(analyticsTable, d, "subscription_change").catch(() => ({
            events: [] as Record<string, unknown>[],
            uniqueUsers: new Set<string>(),
          })),
        ),
      ),
      queryEventsForDay(analyticsTable, dayKey(new Date())).catch(() => ({
        events: [] as Record<string, unknown>[],
        uniqueUsers: new Set<string>(),
      })),
      queryEventsForDay(analyticsTable, dayKey(shiftDays(new Date(), -1))).catch(() => ({
        events: [] as Record<string, unknown>[],
        uniqueUsers: new Set<string>(),
      })),
      // CloudWatch metrics — run all Lambda health queries in parallel
      Promise.all(LAMBDAS.map((name) => getLambdaHealth(name))),
      // DDB table health — both tables
      Promise.all([
        getDdbHealth(tableName),
        getDdbHealth(analyticsTable),
      ]),
      // Unresolved operational failures (e.g. swallowed Stripe cancellations)
      listRecentOpsFailures(tableName, { limit: 25 }).catch((err) => {
        console.warn("[admin-ops] ops failures query failed:", err);
        return [];
      }),
    ]);

    // Tally subscription cancellations. NOTE: these are Stripe billing events
    // (subscription_change with proStatus === "canceled"), NOT account
    // deactivations/deletions — account lifecycle transitions are written as
    // status audit records, not analytics events, so they aren't queryable here.
    let subscriptionCancellations = 0;
    for (const { events } of subscriptionEventsByDay) {
      for (const e of events) {
        if (e.proStatus === "canceled") subscriptionCancellations += 1;
      }
    }

    // Cost projection — assume server Lambda dominates
    const serverLambda = lambdaHealth.find((l) => l.functionName === "ChapterFlowServer");
    const costEstimate = estimateMonthlyCost({
      dynamoTableSizeBytes:
        (ddbHealth[0]?.tableSizeBytes ?? 0) + (ddbHealth[1]?.tableSizeBytes ?? 0),
      lambdaInvocationsLast24h: serverLambda?.invocations ?? 0,
      lambdaAvgDurationMs: serverLambda?.durationP50Ms ?? 100,
      lambdaMemoryMB: 1024,
      s3TotalBytes: 0, // populate separately if we have bucket names
    });

    // If any Lambda returned no data, add a warning (likely IAM not granted)
    const anyLambdaData = lambdaHealth.some((l) => l.invocations > 0);
    if (!anyLambdaData) {
      warnings.push(
        "Lambda metrics unavailable — CloudWatch IAM may not yet be deployed, or the functions had no activity in the last 24h.",
      );
    }

    if (opsFailures.length > 0) {
      warnings.push(
        `${opsFailures.length} unresolved operational failure${opsFailures.length === 1 ? "" : "s"} need follow-up (e.g. Stripe cancellation failures during account delete/deactivate).`,
      );
    }

    return bookOk({
      generatedAt: new Date().toISOString(),
      eventsToday: eventsTodayResult.events.length,
      eventsYesterday: eventsYesterdayResult.events.length,
      ingestionJobs,
      subscriptionCancellations,
      // Back-compat alias for the Ops dashboard's "Cancellations" tile. The
      // deleted/reactivated buckets are not derivable from analytics events
      // (account lifecycle changes aren't recorded there), so they stay 0.
      accountChanges: { deactivated: subscriptionCancellations, deleted: 0, reactivated: 0 },
      beaconErrors: beaconErrors.map((d) => ({ date: d.date, value: d.events })),
      lambdaHealth,
      ddbHealth,
      costEstimate,
      opsFailures,
      warnings,
    });
  });
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Re-export types for the Ops client's response typing
export type { LambdaHealth, DdbHealth };
