/**
 * coprime helpers — gcd + assertCoprimeSteps, the deal-time guard that turns a
 * palette-size/step drift into a loud, self-explaining failure (the venuePlan convention,
 * generalized for stakesPlan + openerPlan).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { gcd, assertCoprimeSteps } from "../src/lib/coprime.js";

test("gcd: basic cases", () => {
  assert.equal(gcd(13, 5), 1);
  assert.equal(gcd(14, 7), 7);
  assert.equal(gcd(12, 11), 1);
  assert.equal(gcd(12, 4), 4);
  assert.equal(gcd(-15, 10), 5);
});

test("assertCoprimeSteps: passes when every step is coprime with N", () => {
  assert.doesNotThrow(() => assertCoprimeSteps(13, [5, 7], "stakes-plan")); // current stakes palette
  assert.doesNotThrow(() => assertCoprimeSteps(12, [5, 11], "opener-plan spine")); // current spine
});

test("assertCoprimeSteps: throws a clear, labeled message when a step shares a factor with N", () => {
  // e.g. growing the 13-stake palette to 14 → CHAPTER_STEP 7 shares a factor with 14.
  assert.throws(
    () => assertCoprimeSteps(14, [5, 7], "stakes-plan"),
    (err: Error) => {
      assert.match(err.message, /stakes-plan/);
      assert.match(err.message, /not coprime/);
      assert.match(err.message, /\b14\b/);
      assert.match(err.message, /\b7\b/);
      return true;
    },
  );
});
