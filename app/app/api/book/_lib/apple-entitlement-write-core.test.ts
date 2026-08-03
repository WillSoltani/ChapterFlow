import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAppleEntitlementTransactWrite,
  buildEntitlementUpdateFromApple,
  type AppleEntitlementWriteParams,
} from "./apple-entitlement-write-core";
import { accountStatusSk, bookUserPk, entitlementSk } from "./keys";

const UPDATED_AT = "2027-01-01T00:00:00.000Z";

// The exact condition clauses the builder emits (assert membership, not
// substrings, so a misplaced/mis-joined clause can't slip through).
const ACTIVATE_SOURCE_GUARD =
  "(attribute_not_exists(proSource) OR proSource = :appleSource OR proSource = :nullSource OR (proSource = :stripeSource AND ((attribute_exists(activePaidIntentAtMs) AND activePaidIntentAtMs <= :paidIntentAtMs) OR (attribute_not_exists(activePaidIntentAtMs) AND (attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :paidIntentAtSeconds)))) OR (proSource = :licenseSource AND attribute_exists(licenseExpiresAt) AND (licenseExpiresAt < :updatedAt OR licenseExpiresAt < :periodEnd)) OR ((proSource = :flowPointsSource OR proSource = :giftCodeSource) AND attribute_exists(currentPeriodEnd) AND (currentPeriodEnd < :updatedAt OR currentPeriodEnd < :periodEnd)))";
const APPLE_ONLY_GUARD = "proSource = :appleSource";
const APPLE_LINEAGE_GUARD = "appleOriginalTransactionId = :appleOtx";
const SAME_LINEAGE_SOURCE_GUARD =
  "(attribute_not_exists(proSource) OR proSource = :appleSource OR proSource = :nullSource)";
const ORDERING_GUARD =
  "(attribute_not_exists(lastAppleSignedDate) OR lastAppleSignedDate <= :appleSignedDate)";
const STAMP_SET = "lastAppleSignedDate = :appleSignedDate";

function activate(
  overrides: Partial<AppleEntitlementWriteParams> = {},
): AppleEntitlementWriteParams {
  return {
    plan: "PRO",
    proStatus: "active",
    originalTransactionId: "1000000000000001",
    productId: "chapterflow.pro.monthly",
    currentPeriodEnd: "2027-01-31T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    appleSignedDateMs: 1_700_000_000_000,
    guard: "activate",
    ...overrides,
  };
}

function assertExactExpressionValues(input: {
  updateExpression: string;
  conditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
}): void {
  const references = new Set(
    `${input.updateExpression} ${input.conditionExpression}`.match(
      /:[A-Za-z][A-Za-z0-9]*/g,
    ) ?? [],
  );
  assert.deepEqual(
    Object.keys(input.expressionAttributeValues).sort(),
    [...references].sort(),
    "DynamoDB rejects both missing and unused expression values",
  );
}

type StoredItem = {
  pkExists?: boolean;
  proSource?: "stripe" | "apple" | "license" | "flow_points" | "gift_code" | "admin" | null | undefined;
  lastAppleSignedDate?: number;
  appleOriginalTransactionId?: string;
  licenseExpiresAt?: string;
  currentPeriodEnd?: string;
  activePaidIntentAtMs?: number;
  lastStripeEventAt?: number;
};

/**
 * Faithful evaluator of the exact ConditionExpression clauses the builder emits,
 * run against a simulated stored item. Returns whether the conditional write
 * would APPLY. Throws on any unrecognized clause (drift guard).
 */
function conditionApplies(
  conditionParts: string[],
  eav: Record<string, unknown>,
  stored: StoredItem,
): boolean {
  const pkExists = stored.pkExists ?? true;
  const proSource = pkExists ? stored.proSource : undefined;
  const hasProSource = proSource !== undefined && proSource !== null;

  return conditionParts.every((clause) => {
    switch (clause) {
      case ACTIVATE_SOURCE_GUARD:
        if (
          !hasProSource ||
          proSource === "apple" ||
          proSource === null
        ) {
          return true;
        }
        if (proSource === "stripe") {
          if (stored.activePaidIntentAtMs !== undefined) {
            return (
              stored.activePaidIntentAtMs <=
              (eav[":paidIntentAtMs"] as number)
            );
          }
          return (
            stored.lastStripeEventAt === undefined ||
            stored.lastStripeEventAt <=
              (eav[":paidIntentAtSeconds"] as number)
          );
        }
        if (proSource === "license") {
          return (
            stored.licenseExpiresAt !== undefined &&
            (stored.licenseExpiresAt < (eav[":updatedAt"] as string) ||
              (typeof eav[":periodEnd"] === "string" &&
                stored.licenseExpiresAt < eav[":periodEnd"]))
          );
        }
        if (proSource === "flow_points" || proSource === "gift_code") {
          return (
            stored.currentPeriodEnd !== undefined &&
            (stored.currentPeriodEnd < (eav[":updatedAt"] as string) ||
              (typeof eav[":periodEnd"] === "string" &&
                stored.currentPeriodEnd < eav[":periodEnd"]))
          );
        }
        return false;
      case SAME_LINEAGE_SOURCE_GUARD:
        return !hasProSource || proSource === "apple" || proSource === null;
      case APPLE_ONLY_GUARD:
        return proSource === "apple";
      case APPLE_LINEAGE_GUARD:
        return (
          stored.appleOriginalTransactionId ===
          (eav[":appleOtx"] as string)
        );
      case ORDERING_GUARD: {
        if (stored.lastAppleSignedDate === undefined) return true;
        return stored.lastAppleSignedDate <= (eav[":appleSignedDate"] as number);
      }
      default:
        throw new Error(`Unrecognized condition clause: ${clause}`);
    }
  });
}

// ─── SHAPE ───────────────────────────────────────────────────────────────────

test("activation write: sets Pro fields, apple source, ordering stamp", () => {
  const built = buildEntitlementUpdateFromApple(activate(), UPDATED_AT);
  assert.equal(built.expressionAttributeValues[":plan"], "PRO");
  assert.equal(built.expressionAttributeValues[":proSource"], "apple");
  assert.equal(built.expressionAttributeValues[":appleOtx"], "1000000000000001");
  assert.ok(built.setParts.includes("proSource = :proSource"));
  assert.ok(built.setParts.includes(STAMP_SET));
  assert.ok(built.setParts.includes("activePaidIntentAtMs = :paidIntentAtMs"));
  assert.ok(built.conditionParts.includes(ACTIVATE_SOURCE_GUARD));
  assert.ok(built.conditionParts.includes(ORDERING_GUARD));
});

test("notification mutation atomically refuses a deleted account", () => {
  const transaction = buildAppleEntitlementTransactWrite({
    tableName: "ChapterFlow-test",
    userId: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    params: activate(),
    updatedAtIso: UPDATED_AT,
  });
  const update = transaction.TransactItems[0].Update;
  assert.deepEqual(update.Key, {
    PK: bookUserPk("8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f"),
    SK: entitlementSk(),
  });
  assert.match(update.UpdateExpression, /entity = :entity/);
  assert.match(update.UpdateExpression, /userId = :userId/);
  assert.equal(
    update.ExpressionAttributeValues[":entity"],
    "BOOK_USER_ENTITLEMENT",
  );
  assert.equal(
    update.ExpressionAttributeValues[":userId"],
    "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
  );
  const accountGate = transaction.TransactItems[1].ConditionCheck;
  assert.deepEqual(accountGate.Key, {
    PK: bookUserPk("8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f"),
    SK: accountStatusSk(),
  });
  assert.equal(
    accountGate.ExpressionAttributeValues[":deletedAccountStatus"],
    "deleted",
  );
  assert.match(accountGate.ConditionExpression, /#accountStatus <>/);
});

test("Sandbox notification entitlement writes never touch Production state", () => {
  const transaction = buildAppleEntitlementTransactWrite({
    tableName: "ChapterFlow-staging",
    userId: "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f",
    params: activate(),
    updatedAtIso: UPDATED_AT,
    storageLane: "TestFlightSandbox",
  });
  assert.deepEqual(transaction.TransactItems[0].Update.Key, {
    PK: bookUserPk("8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f"),
    SK: entitlementSk("TestFlightSandbox"),
  });
  assert.notEqual(
    transaction.TransactItems[0].Update.Key.SK,
    entitlementSk("Primary"),
  );
  assert.equal(
    transaction.TransactItems[0].Update.ExpressionAttributeValues[":entity"],
    "BOOK_USER_ENTITLEMENT_APPLE_SANDBOX",
    "Sandbox QA rows must stay out of Production admin/revenue scans",
  );
});

test("downgrade to FREE clears proSource and defaults the cancel flag", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ plan: "FREE", proStatus: "inactive", cancelAtPeriodEnd: undefined, guard: "apple_only" }),
    UPDATED_AT,
  );
  assert.equal(built.expressionAttributeValues[":proSource"], null);
  assert.equal(built.expressionAttributeValues[":cancelAtPeriodEnd"], false);
  assert.ok(built.conditionParts.includes(APPLE_ONLY_GUARD));
  assert.ok(built.conditionParts.includes(APPLE_LINEAGE_GUARD));
  assert.ok(!built.conditionParts.includes(ACTIVATE_SOURCE_GUARD));
});

test("a write without a signedDate carries no ordering guard/stamp", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ appleSignedDateMs: undefined }),
    UPDATED_AT,
  );
  assert.ok(!built.setParts.includes(STAMP_SET));
  assert.ok(!built.conditionParts.includes(ORDERING_GUARD));
  assert.ok(!built.setParts.includes("activePaidIntentAtMs = :paidIntentAtMs"));
  assert.doesNotMatch(built.conditionParts[0]!, /proSource = :stripeSource/);
});

test("every Apple guard emits exactly the DynamoDB values it references", () => {
  for (const params of [
    activate(),
    activate({ appleSignedDateMs: undefined }),
    activate({ guard: "same_lineage_activate" }),
    activate({ plan: "FREE", proStatus: "inactive", guard: "apple_only" }),
  ]) {
    assertExactExpressionValues(
      buildEntitlementUpdateFromApple(params, UPDATED_AT),
    );
  }
});

// ─── CROSS-SOURCE ARBITRATION ────────────────────────────────────────────────

test("activation takes over an absent, null, apple, or stripe source", () => {
  const built = buildEntitlementUpdateFromApple(activate(), UPDATED_AT);
  const eav = built.expressionAttributeValues;
  for (const src of [undefined, null, "apple", "stripe"] as const) {
    assert.equal(
      conditionApplies(built.conditionParts, eav, { proSource: src }),
      true,
      `activation should apply over proSource=${String(src)}`,
    );
  }
});

test("Apple activation cannot displace a newer Stripe paid intent", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ appleSignedDateMs: 3_000 }),
    UPDATED_AT,
  );
  const eav = built.expressionAttributeValues;

  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: "stripe",
      activePaidIntentAtMs: 4_000,
    }),
    false,
  );
  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: "stripe",
      activePaidIntentAtMs: 2_000,
    }),
    true,
  );
  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: "stripe",
      lastStripeEventAt: 4,
    }),
    false,
    "legacy rows fall back to Stripe's seconds-based high-water mark",
  );
});

test("activation never overrides admin or a malformed untimed promo grant", () => {
  const built = buildEntitlementUpdateFromApple(activate(), UPDATED_AT);
  const eav = built.expressionAttributeValues;
  for (const src of ["license", "flow_points", "gift_code", "admin"] as const) {
    assert.equal(
      conditionApplies(built.conditionParts, eav, { proSource: src }),
      false,
      `activation must not apply over proSource=${String(src)}`,
    );
  }
});

test("activation takes over expired or shorter timed promos but never shortens access", () => {
  const built = buildEntitlementUpdateFromApple(activate(), UPDATED_AT);
  const eav = built.expressionAttributeValues;
  for (const stored of [
    { proSource: "license" as const, licenseExpiresAt: "2026-12-31T23:59:59.000Z" },
    { proSource: "flow_points" as const, currentPeriodEnd: "2026-12-31T23:59:59.000Z" },
    { proSource: "gift_code" as const, currentPeriodEnd: "2026-12-31T23:59:59.000Z" },
    { proSource: "license" as const, licenseExpiresAt: "2027-01-15T00:00:00.000Z" },
    { proSource: "flow_points" as const, currentPeriodEnd: "2027-01-15T00:00:00.000Z" },
    { proSource: "gift_code" as const, currentPeriodEnd: "2027-01-15T00:00:00.000Z" },
  ]) {
    assert.equal(conditionApplies(built.conditionParts, eav, stored), true);
  }
  for (const stored of [
    { proSource: "license" as const, licenseExpiresAt: "2027-02-01T00:00:00.000Z" },
    { proSource: "flow_points" as const, currentPeriodEnd: "2027-02-01T00:00:00.000Z" },
    { proSource: "gift_code" as const, currentPeriodEnd: "2027-02-01T00:00:00.000Z" },
    { proSource: "admin" as const },
  ]) {
    assert.equal(conditionApplies(built.conditionParts, eav, stored), false);
  }
});

test("same-lineage activation restores only its prior Apple lineage", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ guard: "same_lineage_activate" }),
    UPDATED_AT,
  );
  const eav = built.expressionAttributeValues;
  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: null,
      appleOriginalTransactionId: "1000000000000001",
    }),
    true,
  );
  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: null,
      appleOriginalTransactionId: "1000000000000002",
    }),
    false,
  );
  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: "stripe",
      appleOriginalTransactionId: "1000000000000001",
    }),
    false,
  );
  assert.ok(built.conditionParts.includes(APPLE_LINEAGE_GUARD));
  assert.ok(built.conditionParts.includes(SAME_LINEAGE_SOURCE_GUARD));
});

test("apple_only downgrade applies only to the same Apple lineage", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ plan: "FREE", proStatus: "inactive", guard: "apple_only" }),
    UPDATED_AT,
  );
  const eav = built.expressionAttributeValues;
  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: "apple",
      appleOriginalTransactionId: "1000000000000001",
    }),
    true,
  );
  assert.equal(
    conditionApplies(built.conditionParts, eav, {
      proSource: "apple",
      appleOriginalTransactionId: "1000000000000002",
    }),
    false,
    "a late terminal event from lineage A cannot revoke active lineage B",
  );
  assert.equal(conditionApplies(built.conditionParts, eav, { proSource: "stripe" }), false);
  assert.equal(conditionApplies(built.conditionParts, eav, { pkExists: false }), false);
});

// ─── ORDERING (high-water mark) ──────────────────────────────────────────────

test("a stale event (older signedDate than stored) is refused", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ appleSignedDateMs: 1000 }),
    UPDATED_AT,
  );
  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, {
      proSource: "apple",
      appleOriginalTransactionId: "1000000000000001",
      lastAppleSignedDate: 2000,
    }),
    false,
  );
});

test("an equal signedDate (redelivery) is idempotently re-applied", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ appleSignedDateMs: 2000 }),
    UPDATED_AT,
  );
  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, {
      proSource: "apple",
      appleOriginalTransactionId: "1000000000000001",
      lastAppleSignedDate: 2000,
    }),
    true,
  );
});

test("a newer signedDate advances the high-water mark", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ appleSignedDateMs: 3000 }),
    UPDATED_AT,
  );
  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, {
      proSource: "apple",
      appleOriginalTransactionId: "1000000000000001",
      lastAppleSignedDate: 2000,
    }),
    true,
  );
});
