/**
 * sceneMechanismPlan — Tier 3 prevention dealer. Deals each chapter one DISTINCT functional move
 * (the dramatic transaction the marquee scene dramatizes) so the generator can't reuse one scene
 * device book-wide. Pure function of bookId; coprime round-robin spreads each move; deal-time share
 * cap forbids a saturated deal (which would create a new templating axis).
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  loadSceneMechanisms,
  planSceneMechanisms,
  formatSceneMechanismPlan,
} from "../src/librarian/sceneMechanismPlan.js";

test("palette: ≥9 usable moves, all ids distinct, every move carries a directive", () => {
  const mechs = loadSceneMechanisms();
  assert.ok(mechs.length >= 9, `palette has ${mechs.length} moves (need ≥9)`);
  assert.equal(new Set(mechs.map((m) => m.id)).size, mechs.length, "ids are distinct");
  for (const m of mechs) assert.ok(m.directive.length > 20, `move ${m.id} has a real directive`);
});

test("deal: pure + deterministic in bookId (same book → same allocation; the deal varies across books)", () => {
  const a1 = planSceneMechanisms("the-happiness-hypothesis", 1, 11);
  const a2 = planSceneMechanisms("the-happiness-hypothesis", 1, 11);
  assert.deepEqual(a1.allocation, a2.allocation, "deterministic per book");
  // The fnv1a offset is a function of bookId; across a handful of books the deal is not constant
  // (any single pair can collide on offset mod L, so assert across a set, not one pair).
  const ch1 = ["the-happiness-hypothesis", "emotional-intelligence", "deep-work", "atomic-habits", "the-undoing-project"]
    .map((b) => planSceneMechanisms(b, 1, 11).allocation[1].mechanismId);
  assert.ok(new Set(ch1).size >= 2, "different books rotate to different ch1 moves");
});

test("deal: redo-stable — a single-chapter re-deal matches that chapter in the full deal", () => {
  const full = planSceneMechanisms("the-happiness-hypothesis", 1, 11);
  for (const n of [1, 5, 8, 11]) {
    const one = planSceneMechanisms("the-happiness-hypothesis", n, n);
    assert.equal(one.allocation[n].mechanismId, full.allocation[n].mechanismId, `ch${n} redo is stable`);
  }
});

test("deal: no move exceeds the 0.34 share cap across realistic book sizes (spread holds)", () => {
  for (const book of ["the-happiness-hypothesis", "emotional-intelligence", "deep-work", "atomic-habits"]) {
    for (const N of [5, 9, 11, 13, 16]) {
      const plan = planSceneMechanisms(book, 1, N);
      const counts = Object.values(plan.diagnostics.mechanismCounts);
      const max = Math.max(...counts);
      assert.ok(max / N <= 0.34 + 1e-9, `${book} N=${N}: a move lands ${max}/${N} (> 0.34 cap)`);
    }
  }
});

test("deal: consecutive chapters never get the same move (coprime spread)", () => {
  const plan = planSceneMechanisms("the-happiness-hypothesis", 1, 11);
  for (let n = 2; n <= 11; n++) {
    assert.notEqual(plan.allocation[n].mechanismId, plan.allocation[n - 1].mechanismId, `ch${n} differs from ch${n - 1}`);
  }
});

test("deal: a NaN/inverted range yields an empty plan (defensive, matches sibling dealers)", () => {
  assert.deepEqual(planSceneMechanisms("b", 5, 2).allocation, {});
  assert.deepEqual(planSceneMechanisms("b", Number.NaN, 5).allocation, {});
});

test("format: renders one line per chapter + the counts", () => {
  const out = formatSceneMechanismPlan(planSceneMechanisms("the-happiness-hypothesis", 1, 3));
  assert.match(out, /ch01:/);
  assert.match(out, /mechanism counts:/);
});
