// Data-access seam for the Ask-Book AI chat feature (WS3-002). Moved verbatim
// out of books/[bookId]/ask/route.ts: the DynamoDB command construction+send
// for the daily question cap and the cached-answer lookup/write are
// unchanged. Streaming, prompt-building, and Anthropic-client logic stay in
// the route.

import "server-only";

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  aiCachedAnswerPk,
  aiCachedAnswerSk,
  aiQuestionCountSk,
  bookUserPk,
} from "@/app/app/api/book/_lib/keys";

/**
 * Cheap fast-path read of today's AI-question count for a user. NOT the
 * authoritative gate (a stale read here can let concurrent requests through)
 * — `reserveDailyAiQuestionSlot` below is the real serialization point.
 */
export async function getAiQuestionCount(
  tableName: string,
  userId: string,
  dateKey: string,
): Promise<number> {
  const countResult = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: aiQuestionCountSk(dateKey) },
    }),
  );
  return (countResult.Item as { count?: number })?.count ?? 0;
}

/** Look up a cached standalone-question answer for one (bookId, questionHash). */
export async function getCachedAiAnswer(
  tableName: string,
  bookId: string,
  questionHash: string,
): Promise<Record<string, unknown> | null> {
  const cached = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: aiCachedAnswerPk(bookId), SK: aiCachedAnswerSk(questionHash) },
    }),
  );
  return (cached.Item as Record<string, unknown> | undefined) ?? null;
}

/** Fire-and-forget hit-count bump on a cache hit. Caller wraps with `.catch()`. */
export async function incrementCachedAiAnswerHitCount(
  tableName: string,
  bookId: string,
  questionHash: string,
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: aiCachedAnswerPk(bookId), SK: aiCachedAnswerSk(questionHash) },
      UpdateExpression: "SET hitCount = if_not_exists(hitCount, :zero) + :one",
      ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    }),
  );
}

/**
 * Atomically reserve one question against the daily cap BEFORE any tokens
 * flow (H10). Returns true when reserved, false when the daily cap is
 * already reached (a ConditionalCheckFailedException); rethrows any other
 * error.
 */
export async function reserveDailyAiQuestionSlot(
  tableName: string,
  userId: string,
  dateKey: string,
  limit: number,
  ttlEpochSeconds: number,
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: aiQuestionCountSk(dateKey) },
        UpdateExpression:
          "SET #count = if_not_exists(#count, :zero) + :one, updatedAt = :now, entity = :entity, #ttl = :ttl",
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":now": new Date().toISOString(),
          ":entity": "AI_QUESTION_COUNT",
          ":ttl": ttlEpochSeconds,
          ":limit": limit,
        },
      }),
    );
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) {
      return false;
    }
    throw e;
  }
}

/** Persist a freshly-generated standalone answer to the cache. */
export async function putCachedAiAnswer(
  tableName: string,
  params: {
    bookId: string;
    questionHash: string;
    question: string;
    answer: string;
    ttlEpochSeconds: number;
  },
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: aiCachedAnswerPk(params.bookId),
        SK: aiCachedAnswerSk(params.questionHash),
        entity: "AI_CACHED_ANSWER",
        bookId: params.bookId,
        questionHash: params.questionHash,
        question: params.question,
        answer: params.answer,
        tone: "direct",
        hitCount: 0,
        ttl: params.ttlEpochSeconds,
        createdAt: new Date().toISOString(),
      },
    }),
  );
}
