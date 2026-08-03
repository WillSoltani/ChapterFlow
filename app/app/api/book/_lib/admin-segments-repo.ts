import "server-only";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import type { SegmentDefinition } from "@/app/app/api/book/_lib/segment-engine";
import { logger } from "@/lib/logging/logger";

const PK = "ADMINSEGMENT#DEFS";

function sk(segmentId: string): string {
  return `SEG#${segmentId}`;
}

export async function listSegments(tableName: string): Promise<SegmentDefinition[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK },
    }),
  );
  return ((res.Items ?? []) as unknown as SegmentDefinition[]).sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
}

export async function getSegment(
  tableName: string,
  segmentId: string,
): Promise<SegmentDefinition | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK, SK: sk(segmentId) },
    }),
  );
  return ((res.Item ?? null) as unknown) as SegmentDefinition | null;
}

export async function putSegment(
  tableName: string,
  segment: SegmentDefinition,
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK,
        SK: sk(segment.segmentId),
        entity: "ADMIN_SEGMENT",
        ...segment,
      },
    }),
  );
}

export async function deleteSegment(
  tableName: string,
  segmentId: string,
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK, SK: sk(segmentId) },
    }),
  );
}

export async function writeAuditEntry(
  tableName: string,
  entry: {
    adminUserId: string;
    action: string;
    segmentId: string;
    affectedUserCount: number;
    params?: Record<string, unknown>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `BOOKAUDIT#${entry.adminUserId}`,
        SK: `${now}#${entry.action}`,
        entity: "ADMIN_AUDIT",
        ...entry,
        createdAt: now,
      },
    }),
  );
}

// ── Bulk segment-notify dispatch (WS3-002) ───────────────────────────────────
//
// Moved verbatim from admin/segments/[segmentId]/notify/route.ts: the
// checkpointed audit-row Update, the per-user dedup-claim Put, and the
// dedup-release Delete are unchanged, including their error handling.

function isConditionalCheckFailed(err: unknown): boolean {
  const rec = err as { name?: string; __type?: string } | null;
  return (
    rec?.name === "ConditionalCheckFailedException" ||
    rec?.__type === "ConditionalCheckFailedException"
  );
}

/**
 * Checkpoint the bulk-notify audit row (BOOKAUDIT#<adminSub> / <ts>#bulk_notify).
 * A stable SK across calls lets repeated checkpoints (started → in_progress →
 * completed) update the SAME row, so a mid-loop hard timeout still leaves a
 * durable record of what ran. Best-effort: swallows its own failures (logs and
 * returns) exactly as the inline version did — a failed checkpoint must never
 * fail the notify dispatch itself.
 */
export async function checkpointBulkNotifyAudit(
  tableName: string,
  params: {
    adminUserId: string;
    auditSk: string;
    segmentId: string;
    dispatchId: string;
    targetedCount: number;
    title: string;
    message: string;
    status: "started" | "in_progress" | "completed";
    counts: { sent: number; failed: number; skipped: number };
  },
): Promise<void> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: `BOOKAUDIT#${params.adminUserId}`, SK: params.auditSk },
        UpdateExpression:
          "SET #entity = :entity, #action = :action, segmentId = :seg, dispatchId = :did, targetedCount = :targeted, affectedUserCount = :sent, failedCount = :failed, skippedCount = :skipped, #status = :status, params = :params, createdAt = if_not_exists(createdAt, :now), updatedAt = :now",
        ExpressionAttributeNames: {
          "#entity": "entity",
          "#action": "action",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":entity": "ADMIN_AUDIT",
          ":action": "bulk_notify",
          ":seg": params.segmentId,
          ":did": params.dispatchId,
          ":targeted": params.targetedCount,
          ":sent": params.counts.sent,
          ":failed": params.counts.failed,
          ":skipped": params.counts.skipped,
          ":status": params.status,
          ":params": { title: params.title, messagePreview: params.message.slice(0, 120) },
          ":now": new Date().toISOString(),
        },
      }),
    );
  } catch (err) {
    logger.warn("admin_segment_notify_audit_checkpoint_failed", { err });
  }
}

/**
 * Claim the per-(dispatch,user) idempotency marker before sending a
 * notification, so a retried bulk-notify request never double-sends.
 * Returns "claimed" (proceed to send), "skipped" (already claimed — a
 * ConditionalCheckFailed), or "error" (an unexpected write failure, already
 * logged here with the same message/args the inline version used).
 */
export async function claimSegmentNotifyDedup(
  tableName: string,
  params: { dispatchId: string; segmentId: string; userId: string; ttlSeconds: number },
): Promise<"claimed" | "skipped" | "error"> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `ADMINNOTIFYDISPATCH#${params.dispatchId}`,
          SK: `USER#${params.userId}`,
          entity: "ADMIN_NOTIFY_DEDUP",
          dispatchId: params.dispatchId,
          segmentId: params.segmentId,
          userId: params.userId,
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + params.ttlSeconds,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      }),
    );
    return "claimed";
  } catch (err) {
    if (isConditionalCheckFailed(err)) return "skipped";
    logger.warn("admin_segment_notify_dedup_claim_failed", { userId: params.userId, err });
    return "error";
  }
}

/**
 * Release a previously-claimed dedup marker so the user can be retried on a
 * later dispatch (called when the send itself failed after the claim
 * succeeded). Fire-and-forget: the caller wraps this in `.catch(() => {})`,
 * unchanged from the inline version.
 */
export async function releaseSegmentNotifyDedup(
  tableName: string,
  dispatchId: string,
  userId: string,
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK: `ADMINNOTIFYDISPATCH#${dispatchId}`, SK: `USER#${userId}` },
    }),
  );
}
