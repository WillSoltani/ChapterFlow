import "server-only";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, nowIso } from "./keys";
import type {
  IdempotencyStore,
  ReserveResult,
  StoredIdempotentOutcome,
} from "./idempotency-core";

// Durable, account-scoped DynamoDB implementation of the idempotency store
// (WP-IDEMPOTENCY-01). Records live under the requesting user's partition
// (`bookUserPk`) so a key can only ever replay that same account's outcome, and
// expire via the table's `ttl` attribute so the dedupe ledger self-cleans.

const ENTITY = "BOOK_IDEMPOTENCY";

// A completed record replays for this long; a still-in_progress reservation is
// also bounded by it so a crashed executor cannot wedge a key forever (after
// expiry the key is simply reservable again — the client outcome was never
// applied, so re-execution is correct).
const RECORD_TTL_SECONDS = 24 * 60 * 60;

function idempotencySk(routeKey: string, key: string): string {
  return `IDEMPOTENCY#${routeKey}#${key}`;
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException"
  );
}

interface IdempotencyRecord {
  status?: "in_progress" | "completed";
  responseStatus?: number;
  responseBody?: string;
}

/**
 * Constructs an {@link IdempotencyStore} bound to a table and a `routeKey`
 * namespace. The namespace keeps the same client key isolated per operation, so
 * two unrelated routes can never replay each other's outcome even in the
 * (contractually impossible) event of a reused key.
 */
export function createDynamoIdempotencyStore(
  tableName: string,
  routeKey: string,
): IdempotencyStore {
  return {
    async reserve(accountId: string, key: string): Promise<ReserveResult> {
      const sk = idempotencySk(routeKey, key);
      const ttl = Math.floor(Date.now() / 1000) + RECORD_TTL_SECONDS;
      try {
        await ddbDoc.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: bookUserPk(accountId),
              SK: sk,
              entity: ENTITY,
              status: "in_progress",
              createdAt: nowIso(),
              ttl,
            },
            // Single-winner: only the first caller for this key may reserve it.
            ConditionExpression: "attribute_not_exists(SK)",
          }),
        );
        return { kind: "reserved" };
      } catch (error) {
        if (!isConditionalCheckFailed(error)) throw error;
      }

      // Someone already holds or completed this key. Read the current record.
      const result = await ddbDoc.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(accountId), SK: sk },
        }),
      );
      const record = (result.Item as IdempotencyRecord | undefined) ?? undefined;
      if (
        record?.status === "completed" &&
        typeof record.responseStatus === "number" &&
        typeof record.responseBody === "string"
      ) {
        return {
          kind: "replay",
          outcome: { status: record.responseStatus, bodyJson: record.responseBody },
        };
      }
      // Reserved-but-not-completed (or a race where the winner just deleted a
      // failed reservation): treat as still in progress.
      return { kind: "in_progress" };
    },

    async complete(
      accountId: string,
      key: string,
      outcome: StoredIdempotentOutcome,
    ): Promise<void> {
      await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(accountId), SK: idempotencySk(routeKey, key) },
          UpdateExpression:
            "SET #status = :completed, responseStatus = :rs, responseBody = :rb",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":completed": "completed",
            ":rs": outcome.status,
            ":rb": outcome.bodyJson,
          },
        }),
      );
    },

    async release(accountId: string, key: string): Promise<void> {
      // Only free a reservation we still own (in_progress) — never delete a
      // completed record, which must remain replayable.
      try {
        await ddbDoc.send(
          new DeleteCommand({
            TableName: tableName,
            Key: { PK: bookUserPk(accountId), SK: idempotencySk(routeKey, key) },
            ConditionExpression: "#status = :inProgress",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":inProgress": "in_progress" },
          }),
        );
      } catch (error) {
        // A concurrent completion (or expiry) means there is nothing to free.
        if (!isConditionalCheckFailed(error)) throw error;
      }
    },
  };
}
