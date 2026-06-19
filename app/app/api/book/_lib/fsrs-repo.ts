import {
  PutCommand,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, fsrsCardSk, fsrsReviewLogSk, nowIso } from "./keys";
import {
  createNewCard,
  scheduleCard,
  isDue,
  getRetrievability,
  retentionFromTargetPercent,
  DEFAULT_DESIRED_RETENTION,
} from "./fsrs";
import { getUserEntitlement, getUserSettingsItem } from "./repo";
import type {
  FSRSCardState,
  FSRSRating,
  FSRSReviewLog,
  ReviewCard,
  ToneKeyed,
} from "./types";
import crypto from "crypto";

function toneText(tk: ToneKeyed, preferredTone: string = "direct"): string {
  return (
    tk[preferredTone as keyof ToneKeyed] || tk.direct || tk.gentle || tk.competitive || ""
  );
}

export async function initializeCardsForChapter(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  reviewCards: ReviewCard[],
  preferredTone: string = "direct"
): Promise<FSRSCardState[]> {
  // Seed cards concurrently — each card is an independent (dedupe Get + Put)
  // round-trip. Doing them sequentially adds avoidable latency to the
  // quiz-pass request that calls this on the critical path.
  const results = await Promise.all(
    reviewCards.map(async (rc): Promise<FSRSCardState | null> => {
      const cardId = `${bookId}:ch${String(chapterNumber).padStart(2, "0")}-${rc.cardId}`;

      const existing = await ddbDoc.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(userId), SK: fsrsCardSk(cardId) },
        })
      );

      if (existing.Item) return null;

      const card = createNewCard(
        cardId,
        userId,
        bookId,
        chapterNumber,
        toneText(rc.front, preferredTone),
        toneText(rc.back, preferredTone)
      );

      await ddbDoc.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: bookUserPk(userId),
            SK: fsrsCardSk(cardId),
            ...card,
          },
        })
      );

      return card;
    })
  );

  return results.filter((card): card is FSRSCardState => card !== null);
}

export async function getDueCards(
  tableName: string,
  userId: string,
  limit: number = 20,
  bookIds?: string[]
): Promise<FSRSCardState[]> {
  const allItems: FSRSCardState[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": bookUserPk(userId),
          ":prefix": "FSRS#CARD#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    allItems.push(...((result.Items ?? []) as FSRSCardState[]));
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  const now = new Date();

  return allItems
    .filter((card) => {
      if (bookIds && bookIds.length > 0 && !bookIds.includes(card.bookId)) {
        return false;
      }
      return isDue(card, now);
    })
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, limit);
}

export async function getAllCards(
  tableName: string,
  userId: string,
  bookId?: string
): Promise<FSRSCardState[]> {
  const allItems: FSRSCardState[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": bookUserPk(userId),
          ":prefix": "FSRS#CARD#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    allItems.push(...((result.Items ?? []) as FSRSCardState[]));
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  if (bookId) return allItems.filter((card) => card.bookId === bookId);
  return allItems;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * SET-3 — resolve the FSRS `desiredRetention` fraction for this review.
 *
 * The "Review retention target" slider (app/book/settings) is a **Pro** control:
 * free users see a locked card and cannot change it. The client persists the
 * whole `extended` settings blob on every save — including the default
 * `spacedRepetitionTarget: 85` — so reading the stored value unconditionally
 * would silently re-schedule *every* free user who ever opened settings (0.9 →
 * 0.85), an unintended behavior change for the non-paying majority who can't even
 * see the control. So the target only drives the scheduler for effective-PRO
 * users; everyone else keeps the proven 0.9 default.
 *
 * Fail-safe: any read error (or a missing entitlement / settings item) degrades
 * to DEFAULT_DESIRED_RETENTION rather than failing the review submit — scheduling
 * a card must never break because we couldn't load a preference.
 */
async function resolveDesiredRetentionForUser(
  tableName: string,
  userId: string
): Promise<number> {
  try {
    const entitlement = await getUserEntitlement(tableName, userId);
    // Effective plan (getUserEntitlement downgrades expired grants inline).
    if (entitlement?.plan !== "PRO") return DEFAULT_DESIRED_RETENTION;

    const settingsItem = await getUserSettingsItem(tableName, userId);
    const extended =
      settingsItem && isRecord(settingsItem.settings.extended)
        ? settingsItem.settings.extended
        : undefined;
    return retentionFromTargetPercent(extended?.spacedRepetitionTarget);
  } catch {
    return DEFAULT_DESIRED_RETENTION;
  }
}

export async function recordReview(
  tableName: string,
  userId: string,
  cardId: string,
  rating: FSRSRating
): Promise<FSRSCardState> {
  const getResult = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: fsrsCardSk(cardId) },
    })
  );

  const card = getResult.Item as FSRSCardState | undefined;
  if (!card) {
    throw new Error(`FSRS card not found: ${cardId}`);
  }

  const now = new Date();
  const desiredRetention = await resolveDesiredRetentionForUser(tableName, userId);
  const updated = scheduleCard(card, rating, now, desiredRetention);

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(userId),
        SK: fsrsCardSk(cardId),
        ...updated,
      },
    })
  );

  const reviewId = crypto.randomUUID();
  const reviewedAt = now.toISOString();
  const log: FSRSReviewLog = {
    userId,
    reviewId,
    cardId,
    bookId: card.bookId,
    rating,
    scheduledDays: updated.scheduledDays,
    elapsedDays: updated.elapsedDays,
    reviewedAt,
    state: card.state,
  };

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(userId),
        SK: fsrsReviewLogSk(reviewedAt, reviewId),
        ...log,
      },
    })
  );

  return updated;
}

export async function getReviewStats(
  tableName: string,
  userId: string
): Promise<{
  totalCards: number;
  dueCards: number;
  avgRetrievability: number;
  bookIds: string[];
}> {
  const cards = await getAllCards(tableName, userId);
  const now = new Date();

  const dueCards = cards.filter((c) => isDue(c, now)).length;
  const activeCards = cards.filter((c) => c.state !== "new");
  const avgRetrievability =
    activeCards.length > 0
      ? activeCards.reduce((sum, c) => sum + getRetrievability(c, now), 0) /
        activeCards.length
      : 0;

  const bookIds = [...new Set(cards.map((c) => c.bookId))];

  return {
    totalCards: cards.length,
    dueCards,
    avgRetrievability: Math.round(avgRetrievability * 1000) / 1000,
    bookIds,
  };
}
