// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
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
