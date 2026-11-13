import "server-only";

import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, journeySk, nowIso } from "./keys";
import { awardFlowPoints } from "./flow-points-repo";
import { getUserProgress, putBadgeAward } from "./repo";
import { readPinnedChapterCounts } from "./content-service";
import {
  reconcileJourneyCore,
  type JourneyAdvancementResult,
} from "./journey-reconcile-core";
import type { BookUserJourneyItem, JourneyDefinition } from "./types";
import journeyDefinitions from "@/content/journeys/journeys.json";

export type { JourneyAdvancementResult } from "./journey-reconcile-core";

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

/**
 * The journey-completion award (bonus points + badge). Call only after the
 * advance that set `completedAt` (advanceJourney returns it only on that call);
 * the point award is keyed by journey and the badge write is conditional.
 */
async function awardJourneyCompletion(
  tableName: string,
  userId: string,
  def: JourneyDefinition,
): Promise<{ bonusIPAwarded: number; badgeAwarded: string | null }> {
  let bonusIPAwarded = 0;
  let badgeAwarded: string | null = null;

  if (def.bonusIP > 0) {
    const ipResult = await awardFlowPoints(tableName, {
      userId,
      amount: def.bonusIP,
      sourceType: "journey_complete",
      sourceId: def.journeyId,
      metadata: { journeyId: def.journeyId, journeyTitle: def.title },
    });
    if (ipResult.awarded) bonusIPAwarded = def.bonusIP;
  }

  if (def.badge?.badgeId) {
    const awarded = await putBadgeAward(tableName, {
      userId,
      badgeId: def.badge.badgeId,
      earnedAt: nowIso(),
      tier: "gold",
    });
    if (awarded) badgeAwarded = def.badge.badgeId;
  }

  return { bonusIPAwarded, badgeAwarded };
}

/**
 * Credit journey books the reader had already finished (e.g. before starting
 * the journey) and complete the journey when that finishes it. Write paths only
 * (journey start, passed quiz); GET routes stay read-only.
 */
export async function reconcileJourneyCompletedBooks(
  tableName: string,
  contentBucket: string,
  userId: string,
  journey: BookUserJourneyItem,
): Promise<JourneyAdvancementResult | null> {
  const def = (journeyDefinitions as JourneyDefinition[]).find(
    (d) => d.journeyId === journey.journeyId,
  );
  if (!def) return null;

  return reconcileJourneyCore(
    {
      readProgress: async (bookIds) => {
        // Consistent reads: the quiz that just finished a book wrote its row.
        const rows = await Promise.all(
          bookIds.map((bookId) =>
            getUserProgress(tableName, userId, bookId, { consistentRead: true }),
          ),
        );
        return rows.filter((r): r is NonNullable<typeof r> => r !== null);
      },
      readChapterCounts: (entries) => readPinnedChapterCounts({ contentBucket, entries }),
      advance: (bookId) =>
        advanceJourney(tableName, userId, journey.journeyId, bookId, def.books.length),
      awardCompletion: () => awardJourneyCompletion(tableName, userId, def),
    },
    journey,
    def,
  );
}

/** Reconcile every active journey; used by the quiz-submit journey step. */
export async function reconcileActiveJourneys(
  tableName: string,
  contentBucket: string,
  userId: string,
): Promise<JourneyAdvancementResult[]> {
  const journeys = await listUserJourneys(tableName, userId);
  const results: JourneyAdvancementResult[] = [];
  for (const journey of journeys) {
    if (journey.completedAt) continue;
    const result = await reconcileJourneyCompletedBooks(
      tableName,
      contentBucket,
      userId,
      journey,
    );
    if (result) results.push(result);
  }
  return results;
}

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
      ({ bonusIPAwarded, badgeAwarded } = await awardJourneyCompletion(
        tableName,
        userId,
        def,
      ));
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
