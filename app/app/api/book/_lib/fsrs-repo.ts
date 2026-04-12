import {
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, fsrsCardSk, fsrsReviewLogSk, nowIso } from "./keys";
import { createNewCard, scheduleCard, isDue } from "./fsrs";
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
  const cards: FSRSCardState[] = [];

  for (const rc of reviewCards) {
    const cardId = `${bookId}:ch${String(chapterNumber).padStart(2, "0")}-${rc.cardId}`;

    const existing = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: bookUserPk(userId), sk: fsrsCardSk(cardId) },
      })
    );

    if (existing.Item) continue;

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
          pk: bookUserPk(userId),
          sk: fsrsCardSk(cardId),
          ...card,
        },
      })
    );

    cards.push(card);
  }

  return cards;
}

export async function getDueCards(
  tableName: string,
  userId: string,
  limit: number = 20,
  bookIds?: string[]
): Promise<FSRSCardState[]> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "FSRS#CARD#",
      },
    })
  );

  const now = new Date();
  const items = (result.Items ?? []) as FSRSCardState[];

  return items
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
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "FSRS#CARD#",
      },
    })
  );

  const items = (result.Items ?? []) as FSRSCardState[];
  if (bookId) return items.filter((card) => card.bookId === bookId);
  return items;
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
      Key: { pk: bookUserPk(userId), sk: fsrsCardSk(cardId) },
    })
  );

  const card = getResult.Item as FSRSCardState | undefined;
  if (!card) {
    throw new Error(`FSRS card not found: ${cardId}`);
  }

  const now = new Date();
  const updated = scheduleCard(card, rating, now);

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: bookUserPk(userId),
        sk: fsrsCardSk(cardId),
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
        pk: bookUserPk(userId),
        sk: fsrsReviewLogSk(reviewedAt, reviewId),
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
      ? activeCards.reduce((sum, c) => {
          const elapsed =
            (now.getTime() - new Date(c.lastReviewAt).getTime()) / 86400000;
          const r =
            c.stability > 0
              ? Math.pow(
                  1 + (((0.9 ** (1 / -0.5) - 1) * elapsed) / c.stability),
                  -0.5
                )
              : 0;
          return sum + r;
        }, 0) / activeCards.length
      : 0;

  const bookIds = [...new Set(cards.map((c) => c.bookId))];

  return {
    totalCards: cards.length,
    dueCards,
    avgRetrievability: Math.round(avgRetrievability * 1000) / 1000,
    bookIds,
  };
}
