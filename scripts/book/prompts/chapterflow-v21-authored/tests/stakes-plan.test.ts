/**
 * stakesPlan — deals each chapter a MENU of modern felt-consequence stakes so chapters
 * land a real cost the reader recognizes ("more useful than exciting" reader review).
 * Mirrors the openerPlan invariants: intra-chapter distinctness, deterministic + redo-stable,
 * a deal-time coverage cap that never false-throws on a short book.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { loadStakes, planStakes, formatStakesForChapter } from "../src/librarian/stakesPlan.js";

const BOOK = "zz-fixture-stakes";

test("planStakes: every chapter gets perChapter DISTINCT stakes", () => {
  const plan = planStakes(BOOK, 1, 12, 3);
  for (const [n, ids] of Object.entries(plan.allocation)) {
    assert.equal(new Set(ids).size, ids.length, `ch${n} reused a stake: ${ids.join(", ")}`);
    assert.equal(ids.length, 3);
  }
});

test("planStakes: deterministic — same book deals the same plan; a single-chapter redo matches", () => {
  const full = planStakes(BOOK, 1, 12, 3);
  const again = planStakes(BOOK, 1, 12, 3);
  assert.deepEqual(again.allocation, full.allocation, "same bookId → identical allocation (redo-stable)");
  const justCh7 = planStakes(BOOK, 7, 7, 3);
  assert.deepEqual(justCh7.allocation[7], full.allocation[7], "a single-chapter re-deal matches the full deal");
});

test("planStakes: different books deal different menus", () => {
  const a = planStakes("alpha-book", 1, 1, 3).allocation[1];
  const b = planStakes("beta-book-zzz", 1, 1, 3).allocation[1];
  assert.notDeepEqual(a, b, "two different books should not deal an identical ch1 stakes menu");
});

test("planStakes: no stake saturates the book, and the deal never false-throws (N=1..20, many books)", () => {
  const books: string[] = [];
  for (let i = 0; i < 80; i++) books.push(`zz-stk-${i}`);
  books.push("the-paradox-of-choice", "nudge", "quiet");
  for (let N = 1; N <= 20; N++) {
    for (const book of books) {
      const plan = planStakes(book, 1, N, 3); // throws if the coverage cap or distinctness invariant trips
      if (N >= 9) {
        // realistic book lengths: the structural max coverage is perChapter/N ≤ 3/9 = 33%
        const cov = new Map<string, number>();
        for (const ids of Object.values(plan.allocation)) for (const id of new Set(ids)) cov.set(id, (cov.get(id) ?? 0) + 1);
        for (const [id, c] of cov) {
          assert.ok(c / N <= 0.5 + 1e-9, `N=${N} ${book}: stake "${id}" covers ${c}/${N} chapters (>50%)`);
        }
      }
    }
  }
});

test("formatStakesForChapter: emits a fit-or-substitute menu naming each dealt stake", () => {
  const plan = planStakes(BOOK, 1, 1, 3);
  const lines = formatStakesForChapter(plan, 1).join("\n");
  assert.match(lines, /STAKES/);
  assert.match(lines, /FEEL the cost/i);
  for (const id of plan.allocation[1]) assert.ok(lines.includes(id), `card must name the dealt stake ${id}`);
  assert.deepEqual(formatStakesForChapter(plan, 99), [], "a chapter with no allocation yields no lines");
});

test("loadStakes: the palette is large enough and has unique ids", () => {
  const stakes = loadStakes();
  assert.ok(stakes.length >= 8, "need a real palette");
  assert.equal(new Set(stakes.map((s) => s.id)).size, stakes.length, "stake ids must be unique");
});
