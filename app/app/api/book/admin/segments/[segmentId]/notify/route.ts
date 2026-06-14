import "server-only";

import crypto from "crypto";
import { DeleteCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getSegment } from "@/app/app/api/book/_lib/admin-segments-repo";
import { createNotification } from "@/app/app/api/book/_lib/notifications-repo";
import { buildSegmentUsers } from "@/app/app/api/book/_lib/admin-metrics";
import { runSegment } from "@/app/app/api/book/_lib/segment-engine";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import type { BookUserNotificationItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

// Synchronous fan-out is capped FAR below what a 30s Lambda can safely flush.
// Each recipient costs a settings read + an in-app write and, when enabled, a
// CASL/CAN-SPAM-compliant SES send and a per-device push Query — so realistic
// throughput is well under the 5000 the old code allowed. Anything larger must
// run through an async worker (see the H9 handoff note): OpenNext ignores Next's
// `maxDuration` export, so the single default ServerFn's 30s timeout (set in
// infra/lib/chapterflow-frontend-stack.ts) is a hard wall we cannot raise here.
const MAX_SYNC_RECIPIENTS = 500;

// How many sends run concurrently. Bounded so we don't open hundreds of
// simultaneous DynamoDB/SES sockets, but high enough to clear the capped
// recipient set inside the request budget.
const SEND_CONCURRENCY = 15;

// Idempotency / audit-dedup markers are short-lived: they only need to outlive a
// retry of the same dispatch (API Gateway / client / Lambda async retries all
// fire within minutes). Two UTC days comfortably covers a same-day re-fire.
const DEDUP_TTL_SECONDS = 2 * 86400;

function isConditionalCheckFailed(err: unknown): boolean {
  const rec = err as { name?: string; __type?: string } | null;
  return (
    rec?.name === "ConditionalCheckFailedException" ||
    rec?.__type === "ConditionalCheckFailedException"
  );
}

type Ctx = { params: Promise<{ segmentId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const { segmentId } = await params;
    const segment = await getSegment(tableName, segmentId);
    if (!segment) return bookErr(req, 404, "not_found", "Segment not found");

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      message?: string;
      type?: BookUserNotificationItem["type"];
      dispatchId?: string;
    };

    if (!body.title || typeof body.title !== "string") {
      throw new BookApiError(400, "invalid_title", "title is required");
    }
    if (!body.message || typeof body.message !== "string") {
      throw new BookApiError(400, "invalid_message", "message is required");
    }
    const title = body.title;
    const message = body.message;
    const type = body.type ?? "weekly_digest";

    // Stable dispatch id so a retry (e.g. the request times out mid-loop and the
    // client / API Gateway re-POSTs) does NOT re-blast everyone already notified.
    // Prefer a caller-supplied idempotency key; otherwise derive a deterministic
    // one from (segment, content, UTC day) so an identical same-day re-send is
    // treated as the same dispatch and de-duplicated per user.
    const today = nowIso().slice(0, 10);
    const dispatchId =
      typeof body.dispatchId === "string" && body.dispatchId.trim()
        ? body.dispatchId.trim().slice(0, 100)
        : crypto
            .createHash("sha256")
            .update(`${segmentId}|${title}|${message}|${today}`)
            .digest("hex")
            .slice(0, 32);

    // Execute segment filter to get target users.
    const users = await buildSegmentUsers(tableName, analyticsTable);
    const matches = runSegment(users, segment.filters);

    // Hard cap — these are commercial (CASL/CAN-SPAM) sends and the work is
    // synchronous, so refuse anything we cannot reliably flush inside the
    // request budget. Larger blasts need the async worker path (see H9 handoff).
    if (matches.length > MAX_SYNC_RECIPIENTS) {
      throw new BookApiError(
        400,
        "segment_too_large",
        `Segment matches ${matches.length} users — the synchronous cap is ${MAX_SYNC_RECIPIENTS}. Refine your filters (a background bulk-send worker is required for larger blasts).`,
      );
    }

    // Audit row is written BEFORE the loop and checkpointed as we go, keyed by a
    // stable SK, so a mid-loop hard timeout still leaves a durable record of what
    // ran. (The old code wrote the audit only AFTER the loop wrapped in
    // .catch(()=>{}), so a timeout mid-loop lost the audit entry entirely.)
    const auditSk = `${nowIso()}#bulk_notify`;
    const writeAudit = async (
      status: "started" | "in_progress" | "completed",
      counts: { sent: number; failed: number; skipped: number },
    ) => {
      try {
        await ddbDoc.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: `BOOKAUDIT#${admin.sub}`, SK: auditSk },
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
              ":seg": segmentId,
              ":did": dispatchId,
              ":targeted": matches.length,
              ":sent": counts.sent,
              ":failed": counts.failed,
              ":skipped": counts.skipped,
              ":status": status,
              ":params": { title, messagePreview: message.slice(0, 120) },
              ":now": nowIso(),
            },
          }),
        );
      } catch (err) {
        console.warn("[admin-segment-notify] audit checkpoint failed", err);
      }
    };

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    await writeAudit("started", { sent, failed, skipped });

    // Send one notification, guarded by a per-(dispatch,user) idempotency marker
    // so a retried request never double-sends. The marker is claimed first with a
    // conditional write; if the send itself fails the claim is released so the
    // user can be retried on a later dispatch.
    const sendOne = async (
      user: { userId: string; email: string | null },
    ): Promise<"sent" | "skipped" | "failed"> => {
      const dedupKey = {
        PK: `ADMINNOTIFYDISPATCH#${dispatchId}`,
        SK: `USER#${user.userId}`,
      };
      try {
        await ddbDoc.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              ...dedupKey,
              entity: "ADMIN_NOTIFY_DEDUP",
              dispatchId,
              segmentId,
              userId: user.userId,
              createdAt: nowIso(),
              ttl: Math.floor(Date.now() / 1000) + DEDUP_TTL_SECONDS,
            },
            ConditionExpression:
              "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          }),
        );
      } catch (err) {
        if (isConditionalCheckFailed(err)) return "skipped";
        console.warn("[admin-segment-notify] dedup claim failed for", user.userId, err);
        return "failed";
      }

      try {
        await createNotification(tableName, {
          userId: user.userId,
          type,
          title,
          body: message,
          metadata: { source: "admin_segment", segmentId, dispatchId },
          userEmail: user.email ?? undefined,
        });
        return "sent";
      } catch (err) {
        console.warn("[admin-segment-notify] failed for", user.userId, err);
        // Release the claim so this user can be retried on a later dispatch.
        await ddbDoc
          .send(new DeleteCommand({ TableName: tableName, Key: dedupKey }))
          .catch(() => {});
        return "failed";
      }
    };

    // Bounded-concurrency synchronous sends (chunked Promise.all), checkpointing
    // the audit row after each chunk so partial progress is durably recorded if
    // the request is killed by the Lambda timeout mid-flight.
    for (let i = 0; i < matches.length; i += SEND_CONCURRENCY) {
      const chunk = matches.slice(i, i + SEND_CONCURRENCY);
      const results = await Promise.all(chunk.map((user) => sendOne(user)));
      for (const r of results) {
        if (r === "sent") sent += 1;
        else if (r === "skipped") skipped += 1;
        else failed += 1;
      }
      await writeAudit("in_progress", { sent, failed, skipped });
    }

    await writeAudit("completed", { sent, failed, skipped });

    return bookOk({
      targetedCount: matches.length,
      sent,
      failed,
      skipped,
      dispatchId,
    });
  });
}
