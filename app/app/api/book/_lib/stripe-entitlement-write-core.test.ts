import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildEntitlementUpdateFromStripe,
  buildDisputeMarkerUpdate,
  type StripeEntitlementWriteParams,
} from "./stripe-entitlement-write-core";

// The exact ConditionExpression clauses the builder emits. Asserting membership
// against these (rather than substring-matching the joined string) catches a
// clause being put in the wrong place or AND-joined incorrectly.
const PROSOURCE_GUARD =
  "(attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :nullSource)";
const ACTIVATION_PROSOURCE_GUARD =
  "(attribute_not_exists(proSource) OR proSource = :stripeSource OR proSource = :nullSource OR (proSource = :appleSource AND ((attribute_exists(activePaidIntentAtMs) AND activePaidIntentAtMs <= :paidIntentAtMs) OR (attribute_not_exists(activePaidIntentAtMs) AND (attribute_not_exists(lastAppleSignedDate) OR lastAppleSignedDate <= :paidIntentAtMs)))))";
const ORDERING_GUARD =
  "(attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :eventCreated)";
const DISPUTE_GUARD = "attribute_not_exists(disputeOpen)";
const EXISTS_PK = "attribute_exists(PK)";
const STAMP_SET = "lastStripeEventAt = :eventCreated";

const UPDATED_AT = "2026-06-24T00:00:00.000Z";

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
  // Whether the entitlement row exists at all (for attribute_exists(PK)).
  // Defaults to true — an existing item is the common case.
  pkExists?: boolean;
  proSource?: "stripe" | "apple" | "license" | "flow_points" | "gift_code" | "admin" | null;
  lastStripeEventAt?: number;
  disputeOpen?: boolean;
  activePaidIntentAtMs?: number;
  lastAppleSignedDate?: number;
};

/**
 * Faithful, minimal evaluator of the exact ConditionExpression clauses the
 * builder emits, run against a simulated stored DynamoDB item. Returns true when
 * the conditional write would APPLY. Throws on any clause it doesn't recognize,
 * so a change to the builder's clause strings can never silently pass these
 * tests (drift guard).
 */
function conditionApplies(
  conditionParts: string[],
  eav: Record<string, unknown>,
  stored: StoredItem,
): boolean {
  return conditionParts.every((clause) => {
    if (clause === PROSOURCE_GUARD || clause === ACTIVATION_PROSOURCE_GUARD) {
      // Activation additionally permits Apple as the prior paid source.
      return (
        stored.proSource === undefined ||
        stored.proSource === eav[":stripeSource"] ||
        (clause === ACTIVATION_PROSOURCE_GUARD &&
          stored.proSource === eav[":appleSource"] &&
          (stored.activePaidIntentAtMs !== undefined
            ? stored.activePaidIntentAtMs <=
              (eav[":paidIntentAtMs"] as number)
            : stored.lastAppleSignedDate === undefined ||
              stored.lastAppleSignedDate <=
                (eav[":paidIntentAtMs"] as number))) ||
        stored.proSource === eav[":nullSource"]
      );
    }
    if (clause === ORDERING_GUARD) {
      // attribute_not_exists(lastStripeEventAt) OR lastStripeEventAt <= :eventCreated
      return (
        stored.lastStripeEventAt === undefined ||
        stored.lastStripeEventAt <= (eav[":eventCreated"] as number)
      );
    }
    if (clause === DISPUTE_GUARD) {
      return stored.disputeOpen === undefined;
    }
    if (clause === EXISTS_PK) {
      return stored.pkExists !== false;
    }
    throw new Error(`unrecognized condition clause: ${clause}`);
  });
}

// Fixtures mirroring real webhook calls.
const proActivation = (
  stripeEventCreatedAt?: number,
): StripeEntitlementWriteParams => ({
  plan: "PRO",
  proStatus: "active",
  proSource: "stripe",
  stripeCustomerId: "cus_1",
  stripeEventCreatedAt,
});

const downgrade = (
  stripeEventCreatedAt?: number,
): StripeEntitlementWriteParams => ({
  plan: "FREE",
  proStatus: "canceled",
  stripeEventCreatedAt,
});

// ── Structural assertions ────────────────────────────────────────────────────

test("PRO-activation: proSource + ordering + disputeOpen guards present, stamps lastStripeEventAt", () => {
  const built = buildEntitlementUpdateFromStripe(proActivation(1000), UPDATED_AT);
  assert.ok(built.conditionParts.includes(ACTIVATION_PROSOURCE_GUARD));
  assert.ok(built.conditionParts.includes(ORDERING_GUARD));
  assert.ok(built.conditionParts.includes(DISPUTE_GUARD));
  assert.ok(built.setParts.includes(STAMP_SET));
  assert.ok(built.setParts.includes("activePaidIntentAtMs = :paidIntentAtMs"));
  assert.equal(built.expressionAttributeValues[":paidIntentAtMs"], 1_000_000);
  assert.equal(built.expressionAttributeValues[":eventCreated"], 1000);
  // The ordering clause must live in the ConditionExpression, not the SET.
  assert.match(built.conditionExpression, /lastStripeEventAt <= :eventCreated/);
  assert.doesNotMatch(
    built.updateExpression,
    /lastStripeEventAt <= :eventCreated/,
  );
});

test("plain downgrade: ordering-guarded + stamps, but no disputeOpen guard, proSource cleared", () => {
  const built = buildEntitlementUpdateFromStripe(downgrade(2000), UPDATED_AT);
  assert.ok(built.conditionParts.includes(PROSOURCE_GUARD));
  assert.ok(built.conditionParts.includes(ORDERING_GUARD));
  assert.ok(!built.conditionParts.includes(DISPUTE_GUARD));
  assert.ok(built.setParts.includes(STAMP_SET));
  assert.equal(built.expressionAttributeValues[":eventCreated"], 2000);
  assert.equal(built.expressionAttributeValues[":proSource"], null);
});

test("dispute create: exempt from ordering — no ordering clause, no stamp, sets disputeOpen", () => {
  const built = buildEntitlementUpdateFromStripe(
    {
      plan: "FREE",
      proStatus: "canceled",
      setDisputeOpen: true,
      stripeEventCreatedAt: 5000,
    },
    UPDATED_AT,
  );
  assert.ok(!built.conditionParts.includes(ORDERING_GUARD));
  assert.ok(!built.setParts.includes(STAMP_SET));
  assert.equal(built.expressionAttributeValues[":eventCreated"], undefined);
  assert.ok(built.setParts.includes("disputeOpen = :disputeOpen"));
  assert.equal(built.expressionAttributeValues[":disputeOpen"], true);
});

test("dispute won-clear: exempt from ordering and REMOVEs disputeOpen", () => {
  const built = buildEntitlementUpdateFromStripe(
    {
      plan: "FREE",
      proStatus: "canceled",
      clearDisputeOpen: true,
      stripeEventCreatedAt: 6000,
    },
    UPDATED_AT,
  );
  assert.ok(!built.conditionParts.includes(ORDERING_GUARD));
  assert.ok(!built.setParts.includes(STAMP_SET));
  assert.ok(built.removeParts.includes("disputeOpen"));
  assert.match(built.updateExpression, /REMOVE disputeOpen/);
});

test("missing stripeEventCreatedAt: no ordering clause, no stamp (back-compat / non-webhook callers)", () => {
  const built = buildEntitlementUpdateFromStripe(proActivation(undefined), UPDATED_AT);
  assert.ok(!built.conditionParts.includes(ORDERING_GUARD));
  assert.ok(!built.setParts.includes(STAMP_SET));
  assert.equal(built.expressionAttributeValues[":eventCreated"], undefined);
  // The proSource guard is unconditional and must still be present.
  assert.ok(built.conditionParts.includes(PROSOURCE_GUARD));
  assert.ok(!built.setParts.includes("activePaidIntentAtMs = :paidIntentAtMs"));
});

test("non-finite stripeEventCreatedAt (NaN) is treated as absent — never marshals a NULL into the compare", () => {
  const built = buildEntitlementUpdateFromStripe(proActivation(Number.NaN), UPDATED_AT);
  assert.ok(!built.conditionParts.includes(ORDERING_GUARD));
  assert.ok(!built.setParts.includes(STAMP_SET));
  assert.equal(built.expressionAttributeValues[":eventCreated"], undefined);
});

test("every Stripe write emits exactly the DynamoDB values it references", () => {
  for (const params of [
    proActivation(1_000),
    proActivation(undefined),
    downgrade(2_000),
    {
      ...downgrade(3_000),
      setDisputeOpen: true,
    },
  ]) {
    assertExactExpressionValues(
      buildEntitlementUpdateFromStripe(params, UPDATED_AT),
    );
  }
});

// ── Semantic sequence assertions (the actual leak) ───────────────────────────

test("canonical reorder: a stale invoice.paid (older event) is REJECTED after a newer cancellation", () => {
  // State after customer.subscription.deleted (event.created = 2000) applied:
  // plan FREE, proSource null, lastStripeEventAt 2000.
  const stored: StoredItem = { proSource: null, lastStripeEventAt: 2000 };
  // Delayed/reordered invoice.paid for the final period, event.created = 1000 (< 2000).
  const built = buildEntitlementUpdateFromStripe(proActivation(1000), UPDATED_AT);

  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, stored),
    false,
    "stale activation must not re-grant PRO",
  );

  // Pre-fix behavior check: WITHOUT the ordering guard the same stale event WOULD
  // apply (proSource is null, no disputeOpen) — i.e. the ordering clause is
  // precisely what closes the revenue leak.
  const withoutOrdering = built.conditionParts.filter((c) => c !== ORDERING_GUARD);
  assert.equal(
    conditionApplies(withoutOrdering, built.expressionAttributeValues, stored),
    true,
    "without the ordering guard the leak is reachable",
  );
});

test("in-order activation: a newer event applies", () => {
  const stored: StoredItem = { proSource: "stripe", lastStripeEventAt: 1000 };
  const built = buildEntitlementUpdateFromStripe(proActivation(2000), UPDATED_AT);
  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, stored),
    true,
  );
});

test("completed Stripe payment takes over Apple, but terminal Stripe writes do not", () => {
  const stored: StoredItem = { proSource: "apple" };
  const activation = buildEntitlementUpdateFromStripe(
    proActivation(2000),
    UPDATED_AT,
  );
  const terminal = buildEntitlementUpdateFromStripe(downgrade(3000), UPDATED_AT);

  assert.equal(
    conditionApplies(
      activation.conditionParts,
      activation.expressionAttributeValues,
      stored,
    ),
    true,
    "a paid Checkout completion must not become paid-without-access",
  );
  assert.equal(
    conditionApplies(
      terminal.conditionParts,
      terminal.expressionAttributeValues,
      stored,
    ),
    false,
    "a later Stripe terminal event cannot revoke Apple access",
  );
});

test("Stripe activation cannot displace a newer Apple paid intent", () => {
  const activation = buildEntitlementUpdateFromStripe(
    proActivation(3),
    UPDATED_AT,
  );

  assert.equal(
    conditionApplies(
      activation.conditionParts,
      activation.expressionAttributeValues,
      { proSource: "apple", activePaidIntentAtMs: 4_000 },
    ),
    false,
  );
  assert.equal(
    conditionApplies(
      activation.conditionParts,
      activation.expressionAttributeValues,
      { proSource: "apple", activePaidIntentAtMs: 2_000 },
    ),
    true,
  );
  assert.equal(
    conditionApplies(
      activation.conditionParts,
      activation.expressionAttributeValues,
      { proSource: "apple", lastAppleSignedDate: 4_000 },
    ),
    false,
    "legacy rows fall back to Apple's millisecond high-water mark",
  );
});

test("equal event.created applies (<= allows the same-second / idempotent re-apply)", () => {
  const stored: StoredItem = { proSource: "stripe", lastStripeEventAt: 1500 };
  const built = buildEntitlementUpdateFromStripe(proActivation(1500), UPDATED_AT);
  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, stored),
    true,
  );
});

test("uniform guarding: an older downgrade cannot lower the high-water mark and re-open the leak", () => {
  // Mark is 300 (a newer event already applied).
  const stored: StoredItem = { proSource: null, lastStripeEventAt: 300 };

  // An older customer.deleted (event.created = 250) must be REJECTED — applying
  // it would lower the mark to 250.
  const olderDowngrade = buildEntitlementUpdateFromStripe(downgrade(250), UPDATED_AT);
  assert.equal(
    conditionApplies(
      olderDowngrade.conditionParts,
      olderDowngrade.expressionAttributeValues,
      stored,
    ),
    false,
    "older downgrade must not lower the mark",
  );

  // Mark stays 300, so a stale invoice.paid (event.created = 280) is also rejected.
  const staleActivation = buildEntitlementUpdateFromStripe(proActivation(280), UPDATED_AT);
  assert.equal(
    conditionApplies(
      staleActivation.conditionParts,
      staleActivation.expressionAttributeValues,
      stored,
    ),
    false,
  );
});

test("first write on a legacy item (no lastStripeEventAt) applies and establishes the mark", () => {
  const stored: StoredItem = {}; // existing prod item, attribute absent
  const built = buildEntitlementUpdateFromStripe(proActivation(1000), UPDATED_AT);
  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, stored),
    true,
  );
  assert.ok(built.setParts.includes(STAMP_SET));
});

test("dispute revocation always wins; disputeOpen then blocks even a newer activation", () => {
  // Even if the stored mark were newer than the dispute, the revocation applies
  // (dispute writes are ordering-exempt).
  const storedNewerMark: StoredItem = { proSource: "stripe", lastStripeEventAt: 9999 };
  const disputeCreate = buildEntitlementUpdateFromStripe(
    {
      plan: "FREE",
      proStatus: "canceled",
      setDisputeOpen: true,
      stripeEventCreatedAt: 5000,
    },
    UPDATED_AT,
  );
  assert.equal(
    conditionApplies(
      disputeCreate.conditionParts,
      disputeCreate.expressionAttributeValues,
      storedNewerMark,
    ),
    true,
    "chargeback revocation must always apply",
  );

  // After the dispute set disputeOpen, a later (newer) invoice.paid is still
  // refused by the orthogonal disputeOpen guard.
  const afterDispute: StoredItem = {
    proSource: null,
    lastStripeEventAt: 5000,
    disputeOpen: true,
  };
  const laterActivation = buildEntitlementUpdateFromStripe(proActivation(7000), UPDATED_AT);
  assert.equal(
    conditionApplies(
      laterActivation.conditionParts,
      laterActivation.expressionAttributeValues,
      afterDispute,
    ),
    false,
    "disputeOpen blocks re-activation regardless of event ordering",
  );
});

// ── disputeOpen marker must be recorded for NON-stripe-PRO accounts ───────────
// Regression: the combined dispute write (buildEntitlementUpdateFromStripe with
// setDisputeOpen) carries the marker under the proSource guard, so a chargeback
// on a license/flow_points/gift_code account is refused outright and the sticky
// marker is silently lost — letting a later stale Stripe activation re-grant
// PRO. The dedicated buildDisputeMarkerUpdate is the un-gated complement.

test("BUG: combined dispute write is refused on a non-stripe item, dropping the disputeOpen marker", () => {
  // A flow_points-PRO user (per the documented no-already-PRO checkout gap)
  // opened a 2nd Stripe sub and charged it back.
  const stored: StoredItem = { proSource: "flow_points" };
  const built = buildEntitlementUpdateFromStripe(
    {
      plan: "FREE",
      proStatus: "canceled",
      setDisputeOpen: true,
      stripeEventCreatedAt: 5000,
    },
    UPDATED_AT,
  );
  // The proSource guard rejects the whole write — including disputeOpen.
  assert.ok(built.conditionParts.includes(PROSOURCE_GUARD));
  assert.equal(
    conditionApplies(built.conditionParts, built.expressionAttributeValues, stored),
    false,
    "the combined write does not apply, so the marker would be lost — this is the bug the dedicated write fixes",
  );
});

test("FIX: buildDisputeMarkerUpdate(true) is un-gated by proSource — applies for every PRO source", () => {
  const built = buildDisputeMarkerUpdate(true, UPDATED_AT);
  // Only attribute_exists(PK); none of the entitlement-write guards.
  assert.equal(built.conditionExpression, EXISTS_PK);
  assert.doesNotMatch(built.conditionExpression, /proSource/);
  assert.doesNotMatch(built.conditionExpression, /lastStripeEventAt/);
  assert.doesNotMatch(built.conditionExpression, /disputeOpen/);
  // Stamps the marker.
  assert.match(built.updateExpression, /SET disputeOpen = :disputeOpen/);
  assert.equal(built.expressionAttributeValues[":disputeOpen"], true);

  const parts = [built.conditionExpression];
  for (const src of ["flow_points", "license", "gift_code", "stripe"] as const) {
    assert.equal(
      conditionApplies(parts, built.expressionAttributeValues, { proSource: src }),
      true,
      `marker write must apply for proSource=${src}`,
    );
  }
  // A missing entitlement row is a deliberate no-op (handled upstream by the
  // branch's updateUserEntitlementFromStripe upsert).
  assert.equal(
    conditionApplies(parts, built.expressionAttributeValues, { pkExists: false }),
    false,
    "missing row → no-op",
  );
});

test("FIX: buildDisputeMarkerUpdate(false) REMOVEs the marker, same un-gated condition (won-dispute clear)", () => {
  const built = buildDisputeMarkerUpdate(false, UPDATED_AT);
  assert.equal(built.conditionExpression, EXISTS_PK);
  assert.match(built.updateExpression, /REMOVE disputeOpen/);
  assert.equal(built.expressionAttributeValues[":disputeOpen"], undefined);
  // A won dispute can clear a marker we planted on a non-stripe-PRO account.
  assert.equal(
    conditionApplies(
      [built.conditionExpression],
      built.expressionAttributeValues,
      { proSource: "flow_points", disputeOpen: true },
    ),
    true,
    "won-dispute clear must apply for a non-stripe account",
  );
});
