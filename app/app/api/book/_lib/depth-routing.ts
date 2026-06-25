import type { BookUserDepthModelItem } from "./types";
import { nowIso } from "./keys";
import {
  computeDepthRecommendation,
  computeNextDepthModel,
  depthModelKey,
} from "./depth-routing-core";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

// Re-exported so existing call sites (e.g. the depth-recommendation route) keep
// importing the pure heuristic from this module; the implementation lives in the
// AWS-free `depth-routing-core` so it can be unit-tested.
export { computeDepthRecommendation, depthModelDataPoints } from "./depth-routing-core";

export async function getDepthModel(
  tableName: string,
  userId: string,
  bookId: string
): Promise<BookUserDepthModelItem | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      // Table key schema is uppercase PK/SK (infra appTable); lowercase keys
      // raise a DynamoDB ValidationException. See depthModelKey().
      Key: depthModelKey(userId, bookId),
    })
  );
  return (result.Item as BookUserDepthModelItem) ?? null;
}

export async function updateDepthModel(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number,
  quizScore: number,
  readingTimeMinutes: number,
  expectedReadingTimeMinutes: number,
  reviewCardRecall: number = 0
): Promise<BookUserDepthModelItem> {
  const existing = await getDepthModel(tableName, userId, bookId);

  const item = computeNextDepthModel({
    userId,
    bookId,
    chapterNumber,
    quizScore,
    readingTimeMinutes,
    expectedReadingTimeMinutes,
    reviewCardRecall,
    existing,
    now: nowIso(),
  });

  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        // Uppercase PK/SK to match the table key schema (infra appTable);
        // lowercase keys are rejected with a DynamoDB ValidationException.
        ...depthModelKey(userId, bookId),
        ...item,
      },
    })
  );

  return item;
}
