import { test } from "node:test";
import assert from "node:assert/strict";
import { appleNotificationStorageLane } from "./apple-notification-storage-core";
import { buildAppleTransactionClaimRead } from "./apple-transaction-claim-core";
import { buildAppleEntitlementTransactWrite } from "./apple-entitlement-write-core";

test("staging Sandbox notifications resolve and mutate Primary rows", () => {
  const storageLane = appleNotificationStorageLane("Sandbox");
  const originalTransactionId = "1000000987654321";
  const claim = buildAppleTransactionClaimRead({
    tableName: "ChapterFlow-staging",
    originalTransactionId,
    storageLane,
  });
  const entitlement = buildAppleEntitlementTransactWrite({
    tableName: "ChapterFlow-staging",
    userId: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    storageLane,
    updatedAtIso: "2027-01-01T00:00:00.000Z",
    params: {
      plan: "PRO",
      proStatus: "active",
      originalTransactionId,
      currentPeriodEnd: "2027-02-01T00:00:00.000Z",
      appleSignedDateMs: 1_800_000_000_000,
      guard: "activate",
    },
  });

  assert.equal(storageLane, "Primary");
  assert.equal(claim.Key.PK, `BOOKBILLING#APPLETXN#${originalTransactionId}`);
  assert.equal(entitlement.TransactItems[0].Update.Key.SK, "ENTITLEMENT");
});

test("Production notifications cannot enter the TestFlight storage lane", () => {
  assert.equal(appleNotificationStorageLane("Production"), "Primary");
});
