import "server-only";

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, eventParticipationSk, nowIso } from "./keys";
import { awardFlowPoints } from "./flow-points-repo";
import { putBadgeAward } from "./repo";
import { createNotification } from "./notifications-repo";
import type { EventDefinition, EventParticipationItem } from "./types";

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException"
  );
}

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

  // Read-modify-write under optimistic concurrency. The Update is guarded by an
  // `updatedAt = :expected` ConditionExpression so two concurrent loop
  // completions for the same event cannot read the same `current` and clobber
  // each other's increment (lost-update race). On a conflicting write we re-read
  // the latest state and recompute, so the counter advances exactly once per
  // distinct chapterId.
  const MAX_ATTEMPTS = 5;
  let justCompleted = false;
  let result: UpdateCommandOutput | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
    justCompleted =
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

    // Optimistic-concurrency guard on the value we read. A legacy record may have
    // no updatedAt; in that case :expected would be dropped (removeUndefinedValues)
    // and `updatedAt = :expected` would fail with a non-retryable ValidationException,
    // so match attribute_not_exists(updatedAt) instead.
    const conditionExpression =
      current.updatedAt === undefined
        ? "attribute_not_exists(updatedAt)"
        : "updatedAt = :expected";
    if (current.updatedAt !== undefined) exprValues[":expected"] = current.updatedAt;

    if (justCompleted) {
      updateParts.push("completed = :t", "completedAt = :now");
      updateParts.push("badgeAwarded = :t", "ipBonusAwarded = :t");
      exprValues[":t"] = true;
    }

    try {
      result = await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(userId), SK: eventParticipationSk(eventId) },
          UpdateExpression: `SET ${updateParts.join(", ")}`,
          ConditionExpression: conditionExpression,
          ExpressionAttributeValues: exprValues,
          ReturnValues: "ALL_NEW",
        }),
      );
      break;
    } catch (error: unknown) {
      // A concurrent writer advanced the record; re-read and retry.
      if (isConditionalCheckFailed(error)) continue;
      throw error;
    }
  }

  if (!result) {
    // Exhausted retries under sustained contention; report the latest state
    // without double-counting rather than silently clobbering.
    return getEventProgress(tableName, userId, eventId);
  }

  // Award IP, persist the completion badge, and notify (fire-and-forget).
  if (justCompleted && eventDef) {
    const now = nowIso();
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
        badgeId: eventDef.badge?.badgeId ?? null,
        ip: eventDef.bonusIP,
      },
    }).catch(() => {});
  }

  return (result.Attributes as EventParticipationItem) ?? null;
}
