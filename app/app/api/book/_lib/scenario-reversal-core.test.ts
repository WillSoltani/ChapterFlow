import { test } from "node:test";
import assert from "node:assert/strict";

import {
  decideScenarioReversal,
  clampReversalDeduction,
} from "./scenario-reversal-core";

// --- decideScenarioReversal --------------------------------------------------

test("approved->rejected with a prior positive award reverses that amount (H4)", () => {
  const decision = decideScenarioReversal({
    wasApprovedAlready: true,
    status: "rejected",
    pointsAwarded: 50,
  });
  assert.deepEqual(decision, { reverse: true, amount: 50 });
});

test("re-rejecting a never-approved submission reverses nothing", () => {
  const decision = decideScenarioReversal({
    wasApprovedAlready: false,
    status: "rejected",
    pointsAwarded: 50,
  });
  assert.deepEqual(decision, { reverse: false });
});

test("approving (or re-approving) never triggers a reversal", () => {
  assert.deepEqual(
    decideScenarioReversal({ wasApprovedAlready: false, status: "approved", pointsAwarded: 50 }),
    { reverse: false }
  );
  assert.deepEqual(
    decideScenarioReversal({ wasApprovedAlready: true, status: "approved", pointsAwarded: 50 }),
    { reverse: false }
  );
});

test("approved->rejected with a zero/negative/non-finite award is a no-op", () => {
  for (const pointsAwarded of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      decideScenarioReversal({ wasApprovedAlready: true, status: "rejected", pointsAwarded }),
      { reverse: false },
      `pointsAwarded=${pointsAwarded}`
    );
  }
});

test("reversal amount is floored to a non-negative integer (mirrors the award)", () => {
  const decision = decideScenarioReversal({
    wasApprovedAlready: true,
    status: "rejected",
    pointsAwarded: 50.9,
  });
  assert.deepEqual(decision, { reverse: true, amount: 50 });
});

// --- clampReversalDeduction --------------------------------------------------

test("clamp deducts the full award when the balance covers it", () => {
  assert.equal(clampReversalDeduction(50, 120), 50);
});

test("clamp never drives the balance negative when points were already spent", () => {
  // User earned 50, then spent 30 → only 20 remain to claw back.
  assert.equal(clampReversalDeduction(50, 20), 20);
});

test("clamp on a zero balance deducts nothing", () => {
  assert.equal(clampReversalDeduction(50, 0), 0);
});

test("clamp floors and floors-to-zero malformed inputs", () => {
  assert.equal(clampReversalDeduction(50.9, 30.4), 30);
  assert.equal(clampReversalDeduction(Number.NaN, 100), 0);
  assert.equal(clampReversalDeduction(50, Number.NaN), 0);
  assert.equal(clampReversalDeduction(-5, 100), 0);
});
