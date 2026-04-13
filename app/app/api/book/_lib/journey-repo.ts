import "server-only";

import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, journeySk, nowIso } from "./keys";
import { awardFlowPoints } from "./flow-points-repo";
import { putBadgeAward } from "./repo";
import type { BookUserJourneyItem, JourneyDefinition } from "./types";
import journeyDefinitions from "@/content/journeys/journeys.json";

export async function startJourney(
  tableName: string,
  userId: string,
  journeyId: string,
  completedBookIds: string[] = [],
): Promise<BookUserJourneyItem> {
  const now = nowIso();
  const item: BookUserJourneyItem = {
    userId,
    journeyId,
    startedAt: now,
    currentBookIndex: completedBookIds.length,
    completedBookIds,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(userId),
        SK: journeySk(journeyId),
        entity: "BOOK_USER_JOURNEY",
        ...item,
      },
      ConditionExpression: "attribute_not_exists(SK)",
    }),
  );

  return item;
}

export async function getJourneyProgress(
  tableName: string,
  userId: string,
  journeyId: string,
): Promise<BookUserJourneyItem | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: journeySk(journeyId) },
    }),
  );
  return (result.Item as BookUserJourneyItem) ?? null;
}

export async function listUserJourneys(
  tableName: string,
  userId: string,
): Promise<BookUserJourneyItem[]> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "JOURNEY#",
      },
    }),
  );
  return (result.Items ?? []) as BookUserJourneyItem[];
}

export async function advanceJourney(
  tableName: string,
  userId: string,
  journeyId: string,
  completedBookId: string,
  totalBooks: number,
): Promise<BookUserJourneyItem | null> {
  const now = nowIso();

  let result;
  try {
    result = await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: journeySk(journeyId) },
        UpdateExpression:
          "SET completedBookIds = list_append(if_not_exists(completedBookIds, :empty), :bookList), currentBookIndex = if_not_exists(currentBookIndex, :zero) + :one, updatedAt = :now",
        ExpressionAttributeValues: {
          ":empty": [],
          ":bookList": [completedBookId],
          ":bookId": completedBookId,
          ":zero": 0,
          ":one": 1,
          ":now": now,
        },
        ConditionExpression: "attribute_exists(SK) AND NOT contains(completedBookIds, :bookId)",
        ReturnValues: "ALL_NEW",
      }),
    );
  } catch (error) {
    if (isConditionalCheckFailed(error)) return null;
    throw error;
  }

  const updated = result.Attributes as BookUserJourneyItem | undefined;
  if (!updated) return null;

  // Check if journey is now complete
  if (updated.completedBookIds.length >= totalBooks && !updated.completedAt) {
    try {
      const completeResult = await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(userId), SK: journeySk(journeyId) },
          UpdateExpression: "SET completedAt = :now, updatedAt = :now",
          ExpressionAttributeValues: { ":now": now, ":nullType": "NULL" },
          ConditionExpression: "attribute_not_exists(completedAt) OR attribute_type(completedAt, :nullType)",
          ReturnValues: "ALL_NEW",
        }),
      );
      return (completeResult.Attributes as BookUserJourneyItem) ?? updated;
    } catch (error) {
      // Another request already marked completion — return without completedAt
      // so the caller doesn't double-award IP/badges
      if (isConditionalCheckFailed(error)) return updated;
      throw error;
    }
  }

  return updated;
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException" ||
    (typeof rec.message === "string" &&
      rec.message.includes("ConditionalCheckFailedException"))
  );
}

// ── Orchestrator ───────────────────────────────────────────────────────────

export type JourneyAdvancementResult = {
  journeyId: string;
  advanced: boolean;
  completed: boolean;
  bonusIPAwarded: number;
  badgeAwarded: string | null;
};

export async function checkAndAdvanceJourneys(
  tableName: string,
  userId: string,
  completedBookId: string,
): Promise<JourneyAdvancementResult[]> {
  const userJourneys = await listUserJourneys(tableName, userId);
  const activeJourneys = userJourneys.filter((j) => !j.completedAt);
  if (activeJourneys.length === 0) return [];

  const definitions = journeyDefinitions as JourneyDefinition[];
  const results: JourneyAdvancementResult[] = [];

  for (const journey of activeJourneys) {
    const def = definitions.find((d) => d.journeyId === journey.journeyId);
    if (!def) continue;

    const bookInJourney = def.books.some((b) => b.bookId === completedBookId);
    if (!bookInJourney) continue;

    const updated = await advanceJourney(
      tableName,
      userId,
      journey.journeyId,
      completedBookId,
      def.books.length,
    );

    if (!updated) {
      // Duplicate book or condition check failed — skip
      results.push({
        journeyId: journey.journeyId,
        advanced: false,
        completed: false,
        bonusIPAwarded: 0,
        badgeAwarded: null,
      });
      continue;
    }

    const justCompleted = !!updated.completedAt;
    let bonusIPAwarded = 0;
    let badgeAwarded: string | null = null;

    if (justCompleted) {
      const now = nowIso();

      // Award bonus IP
      if (def.bonusIP > 0) {
        const ipResult = await awardFlowPoints(tableName, {
          userId,
          amount: def.bonusIP,
          sourceType: "journey_complete",
          sourceId: journey.journeyId,
          metadata: { journeyId: journey.journeyId, journeyTitle: def.title },
        });
        if (ipResult.awarded) bonusIPAwarded = def.bonusIP;
      }

      // Award journey badge
      if (def.badge?.badgeId) {
        const awarded = await putBadgeAward(tableName, {
          userId,
          badgeId: def.badge.badgeId,
          earnedAt: now,
          tier: "gold",
        });
        if (awarded) badgeAwarded = def.badge.badgeId;
      }
    }

    results.push({
      journeyId: journey.journeyId,
      advanced: true,
      completed: justCompleted,
      bonusIPAwarded,
      badgeAwarded,
    });
  }

  return results;
}
