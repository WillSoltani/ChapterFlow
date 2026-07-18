// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { buildIngestionJobUpdate } from "./ingestion-job-update-core";
import {
  ingestJobPk,
  ingestJobSk,
  nowIso,
} from "./keys";

export async function createOrUpdateIngestionJob(
  tableName: string,
  params: {
    jobId: string;
    createdBy: string;
    ingestBucket: string;
    ingestKey: string;
    bookId?: string;
    status: "PENDING" | "RUNNING" | "FAILED" | "SUCCEEDED";
    details?: unknown;
    errorReportKey?: string;
  }
) {
  const ts = nowIso();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: ingestJobPk(params.jobId),
        SK: ingestJobSk(),
        entity: "BOOK_INGEST_JOB",
        jobId: params.jobId,
        createdBy: params.createdBy,
        ingestBucket: params.ingestBucket,
        ingestKey: params.ingestKey,
        bookId: params.bookId,
        status: params.status,
        details: params.details,
        errorReportKey: params.errorReportKey,
        updatedAt: ts,
        createdAt: ts,
      },
    })
  );
}

export async function updateIngestionJob(
  tableName: string,
  jobId: string,
  params: {
    status: "RUNNING" | "FAILED" | "SUCCEEDED";
    details?: unknown;
    errorReportKey?: string;
    bookId?: string;
  }
) {
  const ts = nowIso();
  // Build the update dynamically so a partial transition (e.g. RUNNING -> FAILED,
  // which passes no bookId) does not clobber a previously stored bookId/details/
  // errorReportKey to NULL. Only fields the caller actually supplied are written.
  // Spec + truth-table: ingestion-job-update-core.ts.
  const update = buildIngestionJobUpdate({
    status: params.status,
    updatedAt: ts,
    details: params.details,
    errorReportKey: params.errorReportKey,
    bookId: params.bookId,
  });
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: ingestJobPk(jobId),
        SK: ingestJobSk(),
      },
      UpdateExpression: update.UpdateExpression,
      ExpressionAttributeNames: update.ExpressionAttributeNames,
      ExpressionAttributeValues: update.ExpressionAttributeValues,
    })
  );
}

export async function getIngestionJob(tableName: string, jobId: string): Promise<Record<string, unknown> | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: ingestJobPk(jobId),
        SK: ingestJobSk(),
      },
    })
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

/** Shape the admin Ops dashboard's ingestion-jobs tile expects. */
export type AdminIngestionJob = {
  jobId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  bookId: string | null;
  errorReportKey: string | null;
};

const ADMIN_INGESTION_JOBS_TO_RETURN = 20;

/**
 * List the most recently updated ingestion jobs for the admin Ops dashboard.
 * Moved verbatim from admin/metrics/ops/route.ts's `fetchIngestionJobs`
 * (WS3-002): a filtered Scan's `Limit` caps items SCANNED (pre-filter), not
 * items MATCHED, so a single Limit:200 page can be fully consumed by
 * unrelated rows and return few/no jobs even when many exist — paginate until
 * there are comfortably more matching jobs than will be returned (or the page
 * cap is hit), then sort+slice. No internal try/catch: the route wraps this
 * call in `.catch(() => [])`, so an unhandled rejection here reproduces the
 * exact same "ingestion jobs unavailable" fallback as before the move.
 */
export async function listRecentIngestionJobsForAdmin(
  tableName: string,
): Promise<AdminIngestionJob[]> {
  const jobs: AdminIngestionJob[] = [];
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
  } while (ExclusiveStartKey && jobs.length < ADMIN_INGESTION_JOBS_TO_RETURN * 5 && pages < 10);

  return jobs
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, ADMIN_INGESTION_JOBS_TO_RETURN);
}
