/**
 * openerPlan — deals each example a distinct scenario-opener CONSTRUCTION so a book's
 * scenarios are born varied instead of defaulting to "At the [venue], …" stamps
 * (scene_skeleton / location_stamping, which have no deterministic gate). Mirrors the
 * shapePlan invariants: intra-chapter distinctness, no same-slot repeat across consecutive
 * chapters, deterministic + redo-stable.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { loadScenarioOpeners, planOpeners, formatOpenerPlanForChapter } from "../src/librarian/openerPlan.js";

const BOOK = "zz-fixture-opener-plan";

test("planOpeners: every example in a chapter gets a DISTINCT opener archetype", () => {
  const plan = planOpeners(BOOK, 1, 11, 6);
  for (const [n, ids] of Object.entries(plan.allocation)) {
    assert.equal(new Set(ids).size, ids.length, `ch${n} reused an opener archetype: ${ids.join(", ")}`);
    assert.equal(ids.length, 6);
  }
});

test("planOpeners: consecutive chapters never share the same archetype at the same slot", () => {
  const plan = planOpeners(BOOK, 1, 11, 6);
  for (let n = 1; n < 11; n++) {
    const a = plan.allocation[n], b = plan.allocation[n + 1];
    for (let i = 0; i < a.length; i++) {
      assert.notEqual(a[i], b[i], `ch${n} and ch${n + 1} share opener "${a[i]}" at slot ${i}`);
    }
  }
});

test("planOpeners: deterministic — the same book deals the same plan; a single-chapter re-deal matches", () => {
  const full = planOpeners(BOOK, 1, 11, 6);
  const again = planOpeners(BOOK, 1, 11, 6);
  assert.deepEqual(again.allocation, full.allocation, "same bookId → identical allocation (redo-stable)");
  const justCh5 = planOpeners(BOOK, 5, 5, 6);
  assert.deepEqual(justCh5.allocation[5], full.allocation[5], "a single-chapter re-deal matches the full deal");
});

test("planOpeners: different books start at different rotations (not globally correlated)", () => {
  const a = planOpeners("alpha-book", 1, 1, 6).allocation[1];
  const b = planOpeners("beta-book-zzz", 1, 1, 6).allocation[1];
  assert.notDeepEqual(a, b, "two different books should not deal an identical ch1 opener sequence");
});

test("formatOpenerPlanForChapter: emits a card line per dealt slot, forbidding the stamp", () => {
  const plan = planOpeners(BOOK, 1, 1, 6);
  const lines = formatOpenerPlanForChapter(plan, 1).join("\n");
  assert.match(lines, /OPENER GRAMMAR/);
  assert.match(lines, /NOT open with "At the \[venue\]/);
  for (const id of plan.allocation[1]) assert.ok(lines.includes(id), `card must name the dealt archetype ${id}`);
  assert.deepEqual(formatOpenerPlanForChapter(plan, 99), [], "a chapter with no allocation yields no lines");
});

test("loadScenarioOpeners: the palette is large enough and has unique ids", () => {
  const openers = loadScenarioOpeners();
  assert.ok(openers.length >= 6, "need a real palette");
  assert.equal(new Set(openers.map((o) => o.id)).size, openers.length, "opener ids must be unique");
});
