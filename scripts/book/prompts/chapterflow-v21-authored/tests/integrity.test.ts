import assert from "node:assert/strict";

import { test } from "./harness.js";
import { checkTryThisNowComplexity } from "../src/critics/integrity.js";

test("A17 flags a homework-style tryThisNow (over-long + multi-item ranking)", () => {
  const homework =
    "Within the next 24 hours, the first time a routine item lands loose, spend ten minutes ranking keys, medicine, and bills by risk. Move one object to cue the top item.";
  const f = checkTryThisNowComplexity(homework);
  assert.ok(f.length >= 1, JSON.stringify(f)); // fires on both the word cap and the ranking list
});

test("A17 does NOT fire on a tight one-trigger-one-move tryThisNow", () => {
  const tight = "Pick one thing you lose often. Move its home to the place your hand already goes.";
  assert.deepEqual(checkTryThisNowComplexity(tight), []);
});

test("A17 flags a ranking/sorting verb over a 3+ item list (single or multi-word items)", () => {
  assert.ok(checkTryThisNowComplexity("Sort your keys, wallet, and phone by how often you lose them.").some((x) => /rank\/sort/.test(x.message)));
  assert.ok(checkTryThisNowComplexity("Rank your unread email, your meds, and your bills by what hurts most.").some((x) => /rank\/sort/.test(x.message)));
});

test("A17 does NOT fire on a gold-style coordinated list (the A13 comma trap)", () => {
  // Gold tryThisNow legitimately uses lists ("price, fear, status, novelty") and ordered
  // lines ("WHY first, HOW second, WHAT last") — neither is a ranking-of-3-things chore.
  assert.deepEqual(checkTryThisNowComplexity("Find one nudge you use often. Label it price, fear, status, or novelty."), []);
  assert.deepEqual(checkTryThisNowComplexity("Write your pitch in three lines: WHY first, HOW second, WHAT last."), []);
});
