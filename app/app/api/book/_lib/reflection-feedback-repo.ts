// Data-access seam for AI reflection feedback (Feature #2) (WS3-002). Moved
// verbatim out of me/reflections/[bookId]/[chapterNumber]/feedback/route.ts:
// the DynamoDB command construction+send for the answer cache and the
// per-example daily rate limit are unchanged.

import "server-only";

import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk } from "@/app/app/api/book/_lib/keys";

/** Look up a cached reflection-feedback response by its (bookId, chapter, example) SK. */
export async function getReflectionFeedbackCache(
  tableName: string,
  userId: string,
  feedbackSk: string,
): Promise<Record<string, unknown> | null> {
  const res = await ddbDoc.send(
    new GetCommand({ TableName: tableName, Key: { PK: bookUserPk(userId), SK: feedbackSk } }),
  );
  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException"
  );
}

/**
 * Atomically claim the per-(user,example,day) feedback rate-limit slot BEFORE
 * streaming. Returns true when claimed, false when the slot is already taken
 * (a ConditionalCheckFailedException — "Feedback already requested for this
 * example today"); rethrows any other error.
 */
export async function claimFeedbackRateLimitSlot(
  tableName: string,
  userId: string,
  limitSk: string,
  createdAt: string,
  ttlEpochSeconds: number,
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(userId),
          SK: limitSk,
          entity: "FEEDBACK_RATE_LIMIT",
          createdAt,
          ttl: ttlEpochSeconds,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      }),
    );
    return true;
  } catch (err) {
    if (isConditionalCheckFailed(err)) return false;
    throw err;
  }
}

/** Release a claimed rate-limit slot so a pre-output failure is retryable. */
export async function releaseFeedbackRateLimitSlot(
  tableName: string,
  userId: string,
  limitSk: string,
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({ TableName: tableName, Key: { PK: bookUserPk(userId), SK: limitSk } }),
  );
}

/** Persist a freshly-streamed reflection-feedback response to the cache. */
export async function putReflectionFeedbackCache(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    chapterNumber: number;
    exampleId: string;
    feedbackSk: string;
    reflectionHash: string;
    feedbackText: string;
    model: string;
    now: string;
    ttlEpochSeconds: number;
  },
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(params.userId),
        SK: params.feedbackSk,
        entity: "BOOK_USER_REFLECTION_FEEDBACK",
        userId: params.userId,
        bookId: params.bookId,
        chapterNumber: params.chapterNumber,
        exampleId: params.exampleId,
        reflectionHash: params.reflectionHash,
        feedbackText: params.feedbackText,
        model: params.model,
        createdAt: params.now,
        updatedAt: params.now,
        ttl: params.ttlEpochSeconds,
      },
    }),
  );
}
