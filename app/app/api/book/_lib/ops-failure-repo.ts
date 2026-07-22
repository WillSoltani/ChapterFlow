import "server-only";

import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import { nowIso, opsFailurePk, opsFailureSk, ttlEpochSeconds, RETENTION_DAYS_18_MONTHS } from "./keys";
import { putOpsMetric } from "./cloudwatch-metrics";
import type { OpsFailureItem, OpsFailureKind } from "./types";
import { logger } from "@/lib/logging/logger";

function readStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** An ops-failure plus its `ref` (the SK) so callers can resolve/retry it. */
export type OpsFailureRecord = OpsFailureItem & { ref: string };

function parseItem(item: Record<string, unknown>): OpsFailureRecord {
  const createdAt = readStr(item.createdAt) ?? "";
  const id = readStr(item.id) ?? "";
  return {
    ref: opsFailureSk(createdAt, id),
    id,
    kind: (readStr(item.kind) as OpsFailureKind) ?? "stripe_cancel",
    context: readStr(item.context) ?? "",
    userId: readStr(item.userId) ?? "",
    subscriptionId: readStr(item.subscriptionId),
    stripeCustomerId: readStr(item.stripeCustomerId),
    errorCode: readStr(item.errorCode),
    errorMessage: readStr(item.errorMessage),
    createdAt,
    resolvedAt: readStr(item.resolvedAt),
    resolvedBy: readStr(item.resolvedBy),
    resolutionNote: readStr(item.resolutionNote),
  };
}

export type RecordOpsFailureInput = {
  kind: OpsFailureKind;
  context: string;
  userId: string;
  subscriptionId?: string;
  stripeCustomerId?: string;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Persist an operational failure for later operator follow-up. Best-effort: it
 * MUST NOT throw into the calling lifecycle action (e.g. account deletion must
 * still succeed even if we can't record the Stripe failure). Returns the `ref`
 * (SK) on success, or null if recording itself failed.
 */
export async function recordOpsFailure(
  tableName: string,
  input: RecordOpsFailureInput
): Promise<string | null> {
  const createdAt = nowIso();
  const id = crypto.randomUUID();
  const ref = opsFailureSk(createdAt, id);
  let persisted: string | null = null;
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: opsFailurePk(),
          SK: ref,
          entity: "BOOK_OPS_FAILURE",
          id,
          kind: input.kind,
          context: input.context,
          userId: input.userId,
          subscriptionId: input.subscriptionId,
          stripeCustomerId: input.stripeCustomerId,
          errorCode: input.errorCode,
          // Cap the message so a verbose stack can't bloat the item.
          errorMessage: input.errorMessage?.slice(0, 1000),
          createdAt,
          // Data retention (#16): ops-failure rows are high-volume and have no
          // compliance value once acted on, so stamp a DynamoDB TTL (epoch
          // SECONDS) to age them out after ~18 months. Written to the main app
          // table, whose `ttl` attribute is already enabled. NOT a finance/fraud
          // record — see retentionPolicyFor + docs/DATA-RETENTION.md.
          ttl: ttlEpochSeconds(RETENTION_DAYS_18_MONTHS),
        },
      })
    );
    persisted = ref;
  } catch (error) {
    logger.error("ops_failure_record_error", {
      context: input.context,
      userId: input.userId,
      err: error,
    });
  }
  // Always emit the alarm metric — even if persistence failed, the operator
  // must be paged. A single `OpsFailure` metric (dimensioned by kind) backs the
  // CloudWatch alarm, so every failure kind is covered by one alarm.
  await putOpsMetric("OpsFailure", 1, { kind: input.kind });
  return persisted;
}

/**
 * List recent ops failures (newest first). By default returns only UNRESOLVED
 * failures (what an operator needs to act on); pass includeResolved to see all.
 */
export async function listRecentOpsFailures(
  tableName: string,
  opts?: { limit?: number; includeResolved?: boolean }
): Promise<OpsFailureRecord[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const includeResolved = opts?.includeResolved ?? false;
  const out: OpsFailureRecord[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  let pages = 0;
  // Paginate until we have `limit` matching rows or run out (bounded so a long
  // tail of resolved rows can't make this scan the whole partition unboundedly).
  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": opsFailurePk() },
        ScanIndexForward: false, // newest first
        Limit: Math.max(limit, 50),
        ExclusiveStartKey,
      })
    );
    for (const item of res.Items ?? []) {
      const rec = parseItem(item);
      if (includeResolved || !rec.resolvedAt) {
        out.push(rec);
        if (out.length >= limit) break;
      }
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages += 1;
  } while (ExclusiveStartKey && out.length < limit && pages < 10);
  return out.slice(0, limit);
}

/** Extract a Stripe SDK error's `code` and `message` defensively. */
export function stripeErrorParts(error: unknown): { code?: string; message: string } {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : undefined;
  const message = typeof e?.message === "string" ? e.message : String(error);
  return { code, message };
}

/**
 * Capture a failed Stripe subscription cancellation: log it, persist an
 * ops-failure record for admin follow-up, AND emit a CloudWatch metric (which a
 * deploy-time alarm pages on). Best-effort and non-throwing — the calling
 * account delete/deactivate action must still succeed.
 */
export async function captureStripeCancelFailure(
  tableName: string,
  input: {
    kind: OpsFailureKind;
    context: string;
    userId: string;
    subscriptionId?: string;
    stripeCustomerId?: string;
    error: unknown;
  }
): Promise<void> {
  const { code, message } = stripeErrorParts(input.error);
  logger.error("stripe_cancellation_failed", {
    context: input.context,
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    code,
    message,
  });
  // recordOpsFailure persists the item AND emits the unified `OpsFailure`
  // CloudWatch metric, so no separate metric call is needed here.
  await recordOpsFailure(tableName, {
    kind: input.kind,
    context: input.context,
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    stripeCustomerId: input.stripeCustomerId,
    errorCode: code,
    errorMessage: message,
  });
}

export async function getOpsFailure(
  tableName: string,
  ref: string
): Promise<OpsFailureRecord | null> {
  const res = await ddbDoc.send(
    new GetCommand({ TableName: tableName, Key: { PK: opsFailurePk(), SK: ref } })
  );
  return res.Item ? parseItem(res.Item) : null;
}

/** Mark an ops failure resolved. Throws 404 if it no longer exists. */
export async function resolveOpsFailure(
  tableName: string,
  ref: string,
  opts: { resolvedBy: string; note?: string }
): Promise<void> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: opsFailurePk(), SK: ref },
        UpdateExpression:
          "SET resolvedAt = :at, resolvedBy = :by" + (opts.note ? ", resolutionNote = :note" : ""),
        ExpressionAttributeValues: {
          ":at": nowIso(),
          ":by": opts.resolvedBy,
          ...(opts.note ? { ":note": opts.note.slice(0, 500) } : {}),
        },
        ConditionExpression: "attribute_exists(PK)",
      })
    );
  } catch (error) {
    if (error && typeof error === "object" && (error as { name?: string }).name === "ConditionalCheckFailedException") {
      throw new BookApiError(404, "ops_failure_not_found", "That operational failure record no longer exists.");
    }
    throw error;
  }
}
