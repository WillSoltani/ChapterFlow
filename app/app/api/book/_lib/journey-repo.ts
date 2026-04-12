import "server-only";

import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, journeySk, nowIso } from "./keys";
import type { BookUserJourneyItem } from "./types";

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
  const isComplete = false; // caller determines this

  const result = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: journeySk(journeyId) },
      UpdateExpression:
        "SET completedBookIds = list_append(if_not_exists(completedBookIds, :empty), :bookList), currentBookIndex = currentBookIndex + :one, updatedAt = :now",
      ExpressionAttributeValues: {
        ":empty": [],
        ":bookList": [completedBookId],
        ":one": 1,
        ":now": now,
      },
      ConditionExpression: "attribute_exists(SK)",
      ReturnValues: "ALL_NEW",
    }),
  );

  const updated = result.Attributes as BookUserJourneyItem | undefined;
  if (!updated) return null;

  // Check if journey is now complete
  if (updated.completedBookIds.length >= totalBooks && !updated.completedAt) {
    const completeResult = await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: journeySk(journeyId) },
        UpdateExpression: "SET completedAt = :now, updatedAt = :now",
        ExpressionAttributeValues: { ":now": now },
        ReturnValues: "ALL_NEW",
      }),
    );
    return (completeResult.Attributes as BookUserJourneyItem) ?? updated;
  }

  return updated;
}
