// Data-access seam for push-notification device tokens (WS3-002). Moved
// verbatim out of me/devices/register/route.ts and
// me/devices/unregister/route.ts: the DynamoDB command construction+send is
// unchanged. Device-cap eviction selection (device-cap-core.ts) and
// registration/unregistration payload parsing (device-register-core.ts)
// remain pure, non-DDB modules unaffected by this move.

import "server-only";

import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, deviceTokenSk } from "@/app/app/api/book/_lib/keys";
import type { DeviceRowRef } from "@/app/app/api/book/_lib/device-cap-core";

/** Persist (create or overwrite) a device token row keyed by its identifier hash. */
export async function putDeviceToken(
  tableName: string,
  item: Record<string, unknown>
): Promise<void> {
  await ddbDoc.send(new PutCommand({ TableName: tableName, Item: item }));
}

/**
 * List a user's registered device rows, projected to just the fields the
 * device-cap eviction selector (device-cap-core.ts) needs.
 */
export async function listUserDeviceTokens(
  tableName: string,
  userId: string
): Promise<DeviceRowRef[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": bookUserPk(userId), ":prefix": "DEVICE#" },
      ProjectionExpression: "SK, lastSeenAt",
    })
  );
  return (res.Items ?? []) as DeviceRowRef[];
}

/** Delete one device row by its already-hashed SK (register's eviction path). */
export async function deleteDeviceTokenBySk(
  tableName: string,
  userId: string,
  sk: string
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({ TableName: tableName, Key: { PK: bookUserPk(userId), SK: sk } })
  );
}

/** Delete a device row by its unhashed identifier (endpoint or apnsToken). */
export async function deleteDeviceTokenByIdentifier(
  tableName: string,
  userId: string,
  identifier: string
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: deviceTokenSk(identifier),
      },
    })
  );
}
