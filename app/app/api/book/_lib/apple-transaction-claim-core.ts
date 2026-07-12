import {
  appleOriginalTransactionPk,
  appleOriginalTransactionSk,
  accountStatusSk,
  bookUserPk,
  type AppleStorageLane,
} from "./keys";
import type { AppleStoreEnvironment } from "./apple-purchase-policy-core";
import { buildAppleTransactionPointer } from "./erasure-pointers-core";

export type AppleTransactionClaimWrite = {
  TransactItems: [
    {
      Update: {
        TableName: string;
        Key: Record<string, unknown>;
        UpdateExpression: string;
        ConditionExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
      };
    },
    {
      Put: {
        TableName: string;
        Item: Record<string, unknown>;
      };
    },
    {
      ConditionCheck: {
        TableName: string;
        Key: Record<string, unknown>;
        ConditionExpression: string;
        ExpressionAttributeNames: Record<string, string>;
        ExpressionAttributeValues: Record<string, unknown>;
      };
    },
  ];
};

export function buildAppleTransactionClaimRead(input: {
  tableName: string;
  originalTransactionId: string;
  storageLane?: AppleStorageLane;
}): {
  TableName: string;
  Key: Record<string, unknown>;
  ConsistentRead: true;
} {
  return {
    TableName: input.tableName,
    Key: {
      PK: appleOriginalTransactionPk(
        input.originalTransactionId,
        input.storageLane,
      ),
      SK: appleOriginalTransactionSk(),
    },
    // Notification delivery is one-shot after a 200 acknowledgement. An
    // eventually-consistent false miss would permanently drop the event.
    ConsistentRead: true,
  };
}

/**
 * Build the atomic transaction-map claim and user-owned erasure pointer. The
 * conditional map is deliberately item zero so cancellation classification is
 * stable (`isTransactionConditionFailedAt(error, 0)`).
 */
export function buildAppleTransactionClaimWrite(input: {
  tableName: string;
  originalTransactionId: string;
  userId: string;
  updatedAt: string;
  accountBindingVersion?: string;
  storageLane?: AppleStorageLane;
  storeEnvironment?: AppleStoreEnvironment;
}): AppleTransactionClaimWrite {
  const storageLane = input.storageLane ?? "Primary";
  const storeEnvironment =
    input.storeEnvironment ??
    (storageLane === "TestFlightSandbox" ? "Sandbox" : "Production");
  const pointer = buildAppleTransactionPointer(
    input.userId,
    input.originalTransactionId,
    storageLane,
  );
  const setParts = [
    "entity = :entity",
    "originalTransactionId = :originalTransactionId",
    "userId = :userId",
    "updatedAt = :updatedAt",
    "environment = :environment",
  ];
  const expressionAttributeValues: Record<string, unknown> = {
    ":entity": "BOOK_APPLE_TXN_MAP",
    ":originalTransactionId": input.originalTransactionId,
    ":userId": input.userId,
    ":updatedAt": input.updatedAt,
    ":environment": storeEnvironment,
  };
  if (input.accountBindingVersion) {
    setParts.push(
      "accountBindingVersion = if_not_exists(accountBindingVersion, :accountBindingVersion)",
    );
    expressionAttributeValues[":accountBindingVersion"] =
      input.accountBindingVersion;
  }
  return {
    TransactItems: [
      {
        Update: {
          TableName: input.tableName,
          Key: {
            PK: appleOriginalTransactionPk(
              input.originalTransactionId,
              storageLane,
            ),
            SK: appleOriginalTransactionSk(),
          },
          UpdateExpression: `SET ${setParts.join(", ")}`,
          ConditionExpression: "attribute_not_exists(PK) OR userId = :userId",
          ExpressionAttributeValues: expressionAttributeValues,
        },
      },
      { Put: { TableName: input.tableName, Item: pointer } },
      {
        ConditionCheck: {
          TableName: input.tableName,
          Key: {
            PK: bookUserPk(input.userId),
            SK: accountStatusSk(),
          },
          ConditionExpression:
            "attribute_not_exists(#status) OR #status <> :deletedStatus",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":deletedStatus": "deleted" },
        },
      },
    ],
  };
}
