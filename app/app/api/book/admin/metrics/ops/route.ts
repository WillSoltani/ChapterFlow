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
import {
  estimateMonthlyCost,
  getDdbHealth,
  getLambdaHealth,
  type DdbHealth,
  type LambdaHealth,
} from "@/app/app/api/book/_lib/cloudwatch-metrics";
import { listRecentOpsFailures } from "@/app/app/api/book/_lib/ops-failure-repo";

export const runtime = "nodejs";

type IngestionJob = {
  jobId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  bookId: string | null;
  errorReportKey: string | null;
};

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
      fetchIngestionJobs(tableName).catch((err) => {
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

const INGESTION_JOBS_TO_RETURN = 20;

async function fetchIngestionJobs(tableName: string): Promise<IngestionJob[]> {
  // A filtered Scan's `Limit` caps items SCANNED (pre-filter), not items MATCHED,
  // so a single Limit:50 page can be fully consumed by unrelated rows and return
  // few/no jobs even when many exist. Paginate until we have enough matching jobs
  // (or run out), bounded by page count so this can't scan the whole table.
  const jobs: IngestionJob[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  let pages = 0;
  do {
    const ingestionRes = await ddbDoc.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :e",
        ExpressionAttributeValues: { ":e": "BOOK_INGEST_JOB" },
        Limit: 200,
        ExclusiveStartKey,
      }),
    );
    for (const item of ingestionRes.Items ?? []) {
      jobs.push({
        jobId: String(item.jobId ?? ""),
        status: String(item.status ?? "unknown"),
        createdAt: String(item.createdAt ?? ""),
        updatedAt: String(item.updatedAt ?? ""),
        bookId: typeof item.bookId === "string" ? item.bookId : null,
        errorReportKey: typeof item.errorReportKey === "string" ? item.errorReportKey : null,
      });
    }
    ExclusiveStartKey = ingestionRes.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages += 1;
    // Stop early once we have comfortably more than we return, so the recency
    // sort+slice below has a full window without paginating the entire table.
  } while (ExclusiveStartKey && jobs.length < INGESTION_JOBS_TO_RETURN * 5 && pages < 10);

  return jobs
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, INGESTION_JOBS_TO_RETURN);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Re-export types for the Ops client's response typing
export type { LambdaHealth, DdbHealth };
