import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEntitlementUpdateFromApple,
  type AppleEntitlementWriteParams,
} from "./apple-entitlement-write-core";

const UPDATED_AT = "2027-01-01T00:00:00.000Z";

// The exact condition clauses the builder emits (assert membership, not
// substrings, so a misplaced/mis-joined clause can't slip through).
const ACTIVATE_SOURCE_GUARD =
  "(attribute_not_exists(proSource) OR proSource = :appleSource OR proSource = :stripeSource OR proSource = :nullSource)";
const APPLE_ONLY_GUARD = "proSource = :appleSource";
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

type StoredItem = {
  pkExists?: boolean;
  proSource?: "stripe" | "apple" | "license" | "flow_points" | "gift_code" | "admin" | null;
  lastAppleSignedDate?: number;
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
        return (
          !hasProSource ||
          proSource === "apple" ||
          proSource === "stripe" ||
          proSource === null
        );
      case APPLE_ONLY_GUARD:
        return proSource === "apple";
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
  assert.ok(built.conditionParts.includes(ACTIVATE_SOURCE_GUARD));
  assert.ok(built.conditionParts.includes(ORDERING_GUARD));
});

test("downgrade to FREE clears proSource and defaults the cancel flag", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ plan: "FREE", proStatus: "inactive", cancelAtPeriodEnd: undefined, guard: "apple_only" }),
    UPDATED_AT,
  );
  assert.equal(built.expressionAttributeValues[":proSource"], null);
  assert.equal(built.expressionAttributeValues[":cancelAtPeriodEnd"], false);
  assert.ok(built.conditionParts.includes(APPLE_ONLY_GUARD));
  assert.ok(!built.conditionParts.includes(ACTIVATE_SOURCE_GUARD));
});

test("a write without a signedDate carries no ordering guard/stamp", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ appleSignedDateMs: undefined }),
    UPDATED_AT,
  );
  assert.ok(!built.setParts.includes(STAMP_SET));
  assert.ok(!built.conditionParts.includes(ORDERING_GUARD));
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

test("activation NEVER overrides a promotional grant", () => {
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

test("apple_only downgrade applies to an apple source but not stripe/absent", () => {
  const built = buildEntitlementUpdateFromApple(
    activate({ plan: "FREE", proStatus: "inactive", guard: "apple_only" }),
    UPDATED_AT,
  );
  const eav = built.expressionAttributeValues;
  assert.equal(conditionApplies(built.conditionParts, eav, { proSource: "apple" }), true);
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
      lastAppleSignedDate: 2000,
    }),
    true,
  );
});
