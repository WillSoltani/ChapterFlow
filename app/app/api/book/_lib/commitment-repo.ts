import "server-only";

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, commitmentSk, nowIso } from "./keys";
import type { BookUserCommitmentItem, CommitmentStatus, CommitmentOutcome } from "./types";

const EXPIRY_GRACE_MS = 7 * 86400000;

export function isCommitmentExpired(item: BookUserCommitmentItem): boolean {
  return (
    item.status === "active" &&
    new Date(item.followUpDate).getTime() + EXPIRY_GRACE_MS < Date.now()
  );
}

export async function createCommitment(
  tableName: string,
  item: BookUserCommitmentItem,
): Promise<BookUserCommitmentItem> {
  const now = nowIso();
  const record = { ...item, createdAt: now, updatedAt: now };
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(item.userId),
        SK: commitmentSk(item.commitmentId),
        entity: "BOOK_USER_COMMITMENT",
        ...record,
      },
      ConditionExpression: "attribute_not_exists(SK)",
    }),
  );
  return record;
}

export async function getCommitment(
  tableName: string,
  userId: string,
  commitmentId: string,
): Promise<BookUserCommitmentItem | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: commitmentSk(commitmentId) },
    }),
  );
  const item = (result.Item as BookUserCommitmentItem) ?? null;
  if (item && isCommitmentExpired(item)) {
    return { ...item, status: "expired" };
  }
  return item;
}

export async function listCommitments(
  tableName: string,
  userId: string,
  statusFilter?: CommitmentStatus,
): Promise<BookUserCommitmentItem[]> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "COMMITMENT#",
      },
    }),
  );
  let items = (result.Items ?? []) as BookUserCommitmentItem[];

  const toExpire: string[] = [];
  items = items.map((item) => {
    if (isCommitmentExpired(item)) {
      toExpire.push(item.commitmentId);
      return { ...item, status: "expired" as const };
    }
    return item;
  });

  if (toExpire.length > 0) {
    Promise.allSettled(
      toExpire.map((id) =>
        updateCommitmentStatus(tableName, userId, id, "expired"),
      ),
    ).catch(() => {});
  }

  if (statusFilter) {
    items = items.filter((item) => item.status === statusFilter);
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function hasActiveCommitmentForChapter(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
): Promise<boolean> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "bookId = :bid AND chapterNumber = :cn AND #status = :active",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "COMMITMENT#",
        ":bid": bookId,
        ":cn": chapterNumber,
        ":active": "active",
      },
    }),
  );
  const items = (result.Items ?? []) as BookUserCommitmentItem[];
  return items.some((item) => !isCommitmentExpired(item));
}

export async function updateCommitmentStatus(
  tableName: string,
  userId: string,
  commitmentId: string,
  status: CommitmentStatus,
  reflection?: string,
  ipAwarded?: number,
  outcome?: CommitmentOutcome,
): Promise<BookUserCommitmentItem | null> {
  const now = nowIso();

  const updateParts: string[] = [
    "#status = :status",
    "updatedAt = :now",
  ];
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = { ":status": status, ":now": now, ":activeStatus": "active" };

  if (reflection !== undefined) {
    updateParts.push("followThroughReflection = :reflection");
    updateParts.push("followThroughSubmittedAt = :now");
    values[":reflection"] = reflection;
  }

  if (ipAwarded !== undefined) {
    updateParts.push("ipAwarded = :ipAwarded");
    values[":ipAwarded"] = ipAwarded;
  }

  // `#outcome` is a defensive alias (not strictly required — OUTCOME isn't a
  // DynamoDB reserved word). Gated so skip/expire paths (which never pass it)
  // leave the field untouched and add no unused alias.
  if (outcome !== undefined) {
    updateParts.push("#outcome = :outcome");
    names["#outcome"] = "outcome";
    values[":outcome"] = outcome;
  }

  const result = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: commitmentSk(commitmentId) },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(SK) AND #status = :activeStatus",
      ReturnValues: "ALL_NEW",
    }),
  );
  return (result.Attributes as BookUserCommitmentItem) ?? null;
}

/**
 * Single-page (unpaginated) raw scan of a user's COMMITMENT# rows for the
 * Notebook feed. Moved verbatim from me/notebook/route.ts's GET handler
 * (WS3-002) — deliberately distinct from `listCommitments` above, which also
 * auto-expires stale commitments as a side effect and maps to the typed
 * `BookUserCommitmentItem[]` shape; the Notebook route only reads
 * `followThroughReflection`/`ifThenPlan`/`followThroughSubmittedAt` off the
 * raw item and must not trigger the auto-expiry write on every notebook load.
 */
export async function queryCommitmentItemsForNotebook(
  tableName: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "COMMITMENT#",
      },
    }),
  );
  return result.Items ?? [];
}
