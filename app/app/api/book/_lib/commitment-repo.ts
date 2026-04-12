import "server-only";

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, commitmentSk, nowIso } from "./keys";
import type { BookUserCommitmentItem, CommitmentStatus } from "./types";

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
  return (result.Item as BookUserCommitmentItem) ?? null;
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

  const now = new Date();
  items = items.map((item) => {
    if (
      item.status === "active" &&
      new Date(item.followUpDate).getTime() + 7 * 86400000 < now.getTime()
    ) {
      return { ...item, status: "expired" as const };
    }
    return item;
  });

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
  const all = await listCommitments(tableName, userId, "active");
  return all.some(
    (c) => c.bookId === bookId && c.chapterNumber === chapterNumber,
  );
}

export async function updateCommitmentStatus(
  tableName: string,
  userId: string,
  commitmentId: string,
  status: CommitmentStatus,
  reflection?: string,
): Promise<BookUserCommitmentItem | null> {
  const now = nowIso();

  const updateParts: string[] = [
    "#status = :status",
    "updatedAt = :now",
  ];
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = { ":status": status, ":now": now };

  if (reflection !== undefined) {
    updateParts.push("followThroughReflection = :reflection");
    updateParts.push("followThroughSubmittedAt = :now");
    values[":reflection"] = reflection;
  }

  const result = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: commitmentSk(commitmentId) },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(SK)",
      ReturnValues: "ALL_NEW",
    }),
  );
  return (result.Attributes as BookUserCommitmentItem) ?? null;
}
