// Pure builder for the DynamoDB Update performed by updateIngestionJob (repo.ts).
// Extracted so the expression-building is unit testable — repo.ts pulls in
// `server-only` (via aws.ts) and cannot be imported by `tsx --test`, whereas this
// module is pure (no AWS / server-only dependency).
//
// Why this exists (the B8 clobber bug): the previous static UpdateExpression always
// SET details/errorReportKey/bookId to a value, defaulting to DynamoDB NULL when the
// caller omitted them. The FAILED-status update in admin/ingest/run/route.ts passes
// no bookId, so a job created (or moved to RUNNING) WITH a bookId had that bookId
// silently overwritten to NULL the moment ingestion failed — destroying the
// book↔job association exactly when an admin most needs it (to find the failed book).
//
// Fix: build the SET clause dynamically. `status` and `updatedAt` are always written;
// `details`, `errorReportKey`, and `bookId` are written ONLY when the caller actually
// supplies them. When a field is omitted, its attribute is left untouched, so a
// status-only transition (e.g. RUNNING -> FAILED) can no longer clobber a previously
// stored value.

export interface IngestionJobUpdateInput {
  status: "RUNNING" | "FAILED" | "SUCCEEDED";
  updatedAt: string;
  // Optional fields: only included in the write when actually provided.
  details?: unknown | undefined;
  errorReportKey?: string | undefined;
  bookId?: string | undefined;
}

export interface DynamoUpdateParts {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
}

/**
 * Builds the DynamoDB Update (expression + names + values) for an ingestion-job
 * status transition. Only fields present on `input` are SET; omitted optional fields
 * are left untouched so a partial update never clobbers a previously stored value.
 * The caller supplies the `Key`.
 */
export function buildIngestionJobUpdate(input: IngestionJobUpdateInput): DynamoUpdateParts {
  const setClauses: string[] = ["#status = :status", "updatedAt = :updatedAt"];
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = {
    ":status": input.status,
    ":updatedAt": input.updatedAt,
  };

  // `details` is intentionally allowed to be any value including null when explicitly
  // provided, but is only written when the caller passed the key (not undefined).
  if (input.details !== undefined) {
    setClauses.push("details = :details");
    values[":details"] = input.details;
  }
  if (input.errorReportKey !== undefined) {
    setClauses.push("errorReportKey = :errorReportKey");
    values[":errorReportKey"] = input.errorReportKey;
  }
  if (input.bookId !== undefined) {
    setClauses.push("bookId = :bookId");
    values[":bookId"] = input.bookId;
  }

  return {
    UpdateExpression: `SET ${setClauses.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}
