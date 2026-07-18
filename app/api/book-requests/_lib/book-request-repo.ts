// Data-access seam for the public /api/book-requests intake endpoint
// (WS3-002). Moved verbatim out of route.ts: the DynamoDB command
// construction+send is unchanged, including the deliberate dynamic
// `await import(...)` of the AWS SDK modules (route.ts used this so the
// SDK is never pulled in on the local-dev fallback path where
// BOOK_TABLE_NAME is unset — see the sibling app/api/health/route.ts for
// the same lazy-import pattern). All rate-limit business logic (fail-open
// vs fail-closed, ConditionalCheckFailed → cap-reached mapping, logging)
// stays in route.ts; this module only issues the raw commands.

export type BookRequestRecord = {
  requestId: string;
  title: string;
  author?: string;
  email: string;
  note?: string;
  createdAt: string;
  source: string;
  userAgent?: string;
  ip?: string;
};

/**
 * Atomically increment the (scope, key) rate-limit window counter, guarded by
 * `#count < max`. Throws `ConditionalCheckFailedException` when the window's
 * cap is already reached (the caller in route.ts interprets that as "no slot
 * available"); any other rejection is a genuine limiter failure the caller
 * maps per its fail-open/fail-closed policy.
 */
export async function reserveBookRequestRateLimitSlot(
  tableName: string,
  scope: string,
  key: string,
  max: number,
  windowStart: number,
  windowSeconds: number,
): Promise<void> {
  const { ddbDoc } = await import("@/app/app/api/_lib/aws");
  const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: `REQLIMIT#${scope}#${key}`, SK: `WINDOW#${windowStart}` },
      UpdateExpression:
        "SET #count = if_not_exists(#count, :zero) + :one, entity = :entity, updatedAt = :now, #ttl = :ttl",
      ConditionExpression: "attribute_not_exists(#count) OR #count < :max",
      ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":zero": 0,
        ":one": 1,
        ":max": max,
        ":entity": "BOOK_REQUEST_RATELIMIT",
        ":now": new Date().toISOString(),
        ":ttl": windowStart + windowSeconds * 2,
      },
    }),
  );
}

/** Persist one book-request intake record to the operational table. */
export async function persistBookRequestRecord(
  tableName: string,
  record: BookRequestRecord,
): Promise<void> {
  const { ddbDoc } = await import("@/app/app/api/_lib/aws");
  const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `BOOKREQUEST#${record.requestId}`,
        SK: `REQUEST#${record.createdAt}`,
        entity: "BOOK_REQUEST",
        ...record,
      },
    }),
  );
}
