import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAppleTransactionClaimRead,
  buildAppleTransactionClaimWrite,
} from "./apple-transaction-claim-core";
import {
  appleOriginalTransactionPk,
  appleOriginalTransactionSk,
  accountStatusSk,
  bookUserPk,
} from "./keys";

test("transaction claim atomically writes conditional map and erasure pointer", () => {
  const input = {
    tableName: "ChapterFlow-test",
    originalTransactionId: "1000000987654321",
    userId: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    updatedAt: "2027-01-01T00:00:00.000Z",
    accountBindingVersion: "cognito_sub_v1",
  };
  const built = buildAppleTransactionClaimWrite(input);
  assert.equal(built.TransactItems.length, 3);

  const map = built.TransactItems[0].Update;
  assert.deepEqual(
    { PK: map.Key.PK, SK: map.Key.SK },
    {
      PK: appleOriginalTransactionPk(input.originalTransactionId),
      SK: appleOriginalTransactionSk(),
    },
  );
  assert.equal(
    map.ConditionExpression,
    "attribute_not_exists(PK) OR userId = :userId",
  );
  assert.equal(map.ExpressionAttributeValues[":userId"], input.userId);
  assert.equal(
    map.ExpressionAttributeValues[":accountBindingVersion"],
    "cognito_sub_v1",
  );
  assert.match(
    map.UpdateExpression,
    /accountBindingVersion = if_not_exists\(accountBindingVersion, :accountBindingVersion\)/,
  );

  const pointer = built.TransactItems[1].Put.Item;
  assert.equal(pointer.PK, bookUserPk(input.userId));
  assert.equal(pointer.entity, "BOOK_APPLE_TXN_POINTER");
  assert.equal(pointer.targetPK, map.Key.PK);
  assert.equal(pointer.targetSK, map.Key.SK);

  const accountGate = built.TransactItems[2].ConditionCheck;
  assert.deepEqual(accountGate.Key, {
    PK: bookUserPk(input.userId),
    SK: accountStatusSk(),
  });
  assert.equal(
    accountGate.ConditionExpression,
    "attribute_not_exists(#status) OR #status <> :deletedStatus",
  );
  assert.equal(
    accountGate.ExpressionAttributeValues[":deletedStatus"],
    "deleted",
  );
});

test("tokenless replay preserves any existing binding marker", () => {
  const built = buildAppleTransactionClaimWrite({
    tableName: "ChapterFlow-test",
    originalTransactionId: "1000000987654321",
    userId: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    updatedAt: "2027-01-01T00:00:00.000Z",
  });
  const update = built.TransactItems[0].Update;
  assert.doesNotMatch(update.UpdateExpression, /accountBindingVersion/);
  assert.equal(update.ExpressionAttributeValues[":accountBindingVersion"], undefined);
  // Dynamo Update leaves every unmentioned attribute intact, unlike the prior
  // Put shape which could erase a concurrently-upgraded v1 marker.
});

test("claim lookup is strongly consistent so a notification cannot false-miss", () => {
  const built = buildAppleTransactionClaimRead({
    tableName: "ChapterFlow-test",
    originalTransactionId: "1000000987654321",
  });
  assert.equal(built.ConsistentRead, true);
  assert.deepEqual(built.Key, {
    PK: appleOriginalTransactionPk("1000000987654321"),
    SK: appleOriginalTransactionSk(),
  });
});

test("Production TestFlight claims use the isolated storage namespace", () => {
  const input = {
    tableName: "ChapterFlow-staging",
    originalTransactionId: "1000000987654321",
    userId: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    updatedAt: "2027-01-01T00:00:00.000Z",
    storageLane: "TestFlightSandbox" as const,
    storeEnvironment: "Sandbox" as const,
  };
  const write = buildAppleTransactionClaimWrite(input);
  const map = write.TransactItems[0].Update;
  const pointer = write.TransactItems[1].Put.Item;
  const read = buildAppleTransactionClaimRead(input);

  assert.deepEqual(map.Key, {
    PK: appleOriginalTransactionPk(
      input.originalTransactionId,
      "TestFlightSandbox",
    ),
    SK: appleOriginalTransactionSk(),
  });
  assert.equal(map.ExpressionAttributeValues[":environment"], "Sandbox");
  assert.equal(pointer.appleStorageLane, "TestFlightSandbox");
  assert.equal(pointer.targetPK, map.Key.PK);
  assert.deepEqual(read.Key, map.Key);
  assert.notEqual(
    map.Key.PK,
    appleOriginalTransactionPk(input.originalTransactionId, "Primary"),
  );
});

test("ordinary staging Sandbox uses the deployment-authoritative Primary keys", () => {
  const input = {
    tableName: "ChapterFlow-staging",
    originalTransactionId: "1000000987654321",
    userId: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    updatedAt: "2027-01-01T00:00:00.000Z",
    storageLane: "Primary" as const,
    storeEnvironment: "Sandbox" as const,
  };
  const write = buildAppleTransactionClaimWrite(input);
  const map = write.TransactItems[0].Update;
  const read = buildAppleTransactionClaimRead(input);

  assert.deepEqual(map.Key, {
    PK: appleOriginalTransactionPk(input.originalTransactionId),
    SK: appleOriginalTransactionSk(),
  });
  assert.equal(map.ExpressionAttributeValues[":environment"], "Sandbox");
  assert.deepEqual(read.Key, map.Key);
});
