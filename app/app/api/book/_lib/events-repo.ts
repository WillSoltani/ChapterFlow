import "server-only";

import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, eventParticipationSk, nowIso } from "./keys";
import type { EventParticipationItem } from "./types";

export async function joinEvent(
  tableName: string,
  userId: string,
  eventId: string,
): Promise<EventParticipationItem> {
  const now = nowIso();
  const item: EventParticipationItem = {
    userId,
    eventId,
    joinedAt: now,
    dailyProgress: {},
    totalChaptersCompleted: 0,
    completed: false,
    completedAt: null,
    badgeAwarded: false,
    ipBonusAwarded: false,
    createdAt: now,
    updatedAt: now,
  };

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(userId),
        SK: eventParticipationSk(eventId),
        entity: "EVENT_PARTICIPATION",
        ...item,
      },
      ConditionExpression: "attribute_not_exists(SK)",
    }),
  );

  return item;
}

export async function getEventProgress(
  tableName: string,
  userId: string,
  eventId: string,
): Promise<EventParticipationItem | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: eventParticipationSk(eventId) },
    }),
  );
  return (result.Item as EventParticipationItem) ?? null;
}

export async function listUserEvents(
  tableName: string,
  userId: string,
): Promise<EventParticipationItem[]> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "EVENT#",
      },
    }),
  );
  return (result.Items ?? []) as EventParticipationItem[];
}

export async function recordEventChapter(
  tableName: string,
  userId: string,
  eventId: string,
  chapterId: string,
): Promise<EventParticipationItem | null> {
  const today = new Date().toISOString().slice(0, 10);
  const now = nowIso();

  // Get current progress
  const current = await getEventProgress(tableName, userId, eventId);
  if (!current || current.completed) return current;

  // Update daily progress
  const dailyProgress = { ...current.dailyProgress };
  const todayChapters = dailyProgress[today] ?? [];
  if (todayChapters.includes(chapterId)) return current; // Already counted
  dailyProgress[today] = [...todayChapters, chapterId];

  const totalChaptersCompleted = current.totalChaptersCompleted + 1;

  const result = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: eventParticipationSk(eventId) },
      UpdateExpression:
        "SET dailyProgress = :dp, totalChaptersCompleted = :total, updatedAt = :now",
      ExpressionAttributeValues: {
        ":dp": dailyProgress,
        ":total": totalChaptersCompleted,
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  return (result.Attributes as EventParticipationItem) ?? null;
}
