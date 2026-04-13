import "server-only";

import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { eventDefinitionPk, eventDefinitionSk, nowIso } from "./keys";
import type { EventDefinitionItem } from "./types";

export async function listEventDefinitions(
  tableName: string,
): Promise<EventDefinitionItem[]> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": eventDefinitionPk(),
      },
    }),
  );
  return (result.Items ?? []) as EventDefinitionItem[];
}

export async function getEventDefinition(
  tableName: string,
  eventId: string,
): Promise<EventDefinitionItem | null> {
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: eventDefinitionPk(), SK: eventDefinitionSk(eventId) },
    }),
  );
  return (result.Item as EventDefinitionItem) ?? null;
}

export async function putEventDefinition(
  tableName: string,
  item: EventDefinitionItem,
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: eventDefinitionPk(),
        SK: eventDefinitionSk(item.eventId),
        entity: "BOOK_SEASONAL_EVENT",
        ...item,
        updatedAt: nowIso(),
      },
    }),
  );
}

export async function deleteEventDefinition(
  tableName: string,
  eventId: string,
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK: eventDefinitionPk(), SK: eventDefinitionSk(eventId) },
    }),
  );
}
