import "server-only";

import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, eventParticipationSk, nowIso } from "./keys";
import { awardFlowPoints } from "./flow-points-repo";
import { putBadgeAward } from "./repo";
import { createNotification } from "./notifications-repo";
import type { EventDefinition, EventParticipationItem } from "./types";

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
  eventDef?: EventDefinition,
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

  // Check if event is now complete
  const justCompleted =
    eventDef != null &&
    eventDef.targetChapters > 0 &&
    totalChaptersCompleted >= eventDef.targetChapters;

  const updateParts = [
    "dailyProgress = :dp",
    "totalChaptersCompleted = :total",
    "updatedAt = :now",
  ];
  const exprValues: Record<string, unknown> = {
    ":dp": dailyProgress,
    ":total": totalChaptersCompleted,
    ":now": now,
  };

  if (justCompleted) {
    updateParts.push("completed = :t", "completedAt = :now");
    updateParts.push("badgeAwarded = :t", "ipBonusAwarded = :t");
    exprValues[":t"] = true;
  }

  const result = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: eventParticipationSk(eventId) },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeValues: exprValues,
      ReturnValues: "ALL_NEW",
    }),
  );

  // Award IP, persist the completion badge, and notify (fire-and-forget).
  if (justCompleted && eventDef) {
    awardFlowPoints(tableName, {
      userId,
      amount: eventDef.bonusIP,
      sourceType: "event_complete",
      sourceId: eventId,
      metadata: { eventTitle: eventDef.title },
    }).catch(() => {});

    // Persist the badge award so it survives in the user's record (parallels
    // journey-repo). Previously only the badgeAwarded flag was set, so the
    // badge was claimed but never stored.
    if (eventDef.badge?.badgeId) {
      putBadgeAward(tableName, {
        userId,
        badgeId: eventDef.badge.badgeId,
        earnedAt: now,
      }).catch(() => {});
    }

    createNotification(tableName, {
      userId,
      type: "badge_earned",
      title: `Event Complete: ${eventDef.title}`,
      body: `You completed "${eventDef.title}" and earned ${eventDef.bonusIP} IP!`,
      metadata: {
        eventId,
        badgeId: eventDef.badge.badgeId,
        ip: eventDef.bonusIP,
      },
    }).catch(() => {});
  }

  return (result.Attributes as EventParticipationItem) ?? null;
}
