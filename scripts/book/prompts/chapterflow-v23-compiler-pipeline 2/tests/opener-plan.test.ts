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

test("planOpeners: a scene-skeleton-PRONE opener class never saturates the book (the-organized-mind fix)", () => {
  const openers = loadScenarioOpeners();
  const proneOf = new Map(openers.map((o) => [o.id, o.proneClass]));
  const proneClasses = [...new Set(openers.map((o) => o.proneClass).filter(Boolean))] as string[];
  assert.ok(proneClasses.length > 0, "palette must tag at least one scene-skeleton-prone class");
  for (let N = 1; N <= 14; N++) {
    const plan = planOpeners(`zz-prone-${N}`, 1, N, 6);
    const coverage = new Map<string, number>();
    for (let n = 1; n <= N; n++) {
      const classesInChapter = new Set(
        (plan.allocation[n] ?? []).map((id) => proneOf.get(id)).filter(Boolean) as string[],
      );
      for (const c of classesInChapter) coverage.set(c, (coverage.get(c) ?? 0) + 1);
    }
    for (const c of proneClasses) {
      const share = (coverage.get(c) ?? 0) / N;
      // The round-robin guarantee: each prone class recurs in ~1/(classes+1) of chapters — always a MINORITY,
      // so the book-wide sweep can no longer flag it as cross-chapter scene-skeleton templating.
      assert.ok(share <= 0.5, `N=${N}: prone class "${c}" covers ${(share * 100).toFixed(0)}% of chapters (must stay a minority)`);
    }
  }
});

test("planOpeners: every chapter draws all but at most one opener from the non-prone spine", () => {
  const openers = loadScenarioOpeners();
  const proneIds = new Set(openers.filter((o) => o.proneClass).map((o) => o.id));
  const plan = planOpeners("zz-spine-check", 1, 12, 6);
  for (const [n, ids] of Object.entries(plan.allocation)) {
    const proneCount = ids.filter((id) => proneIds.has(id)).length;
    assert.ok(proneCount <= 1, `ch${n} has ${proneCount} prone openers (at most 1 allowed)`);
  }
});

test("planOpeners: each prone class is still DEALT at least once over a long book (rationed, not eliminated)", () => {
  // Guards against a degenerate deal that just drops prone openers entirely — they're a legitimate
  // variety, capped to a minority, not banned. Over a 12-chapter book every prone class should appear.
  const openers = loadScenarioOpeners();
  const proneOf = new Map(openers.map((o) => [o.id, o.proneClass]));
  const proneClasses = [...new Set(openers.map((o) => o.proneClass).filter(Boolean))] as string[];
  const plan = planOpeners("zz-prone-dealt", 1, 12, 6);
  const seen = new Set<string>();
  for (const ids of Object.values(plan.allocation)) for (const id of ids) { const c = proneOf.get(id); if (c) seen.add(c); }
  for (const c of proneClasses) assert.ok(seen.has(c), `prone class "${c}" was never dealt over a 12-chapter book`);
});

test("planOpeners: no opener archetype saturates a realistic-length book — spine + prone (quiet spine-cap fix)", () => {
  // PR #271 capped the PRONE classes but left the non-prone spine uncapped — on the quiet run a single
  // spine opener (hand_hovers) recurred across ~1/3 of chapters and the sweep flagged it MINOR. The fix
  // grew the spine 8->12 and chose a chapter step that SPREADS each archetype across the book, so no
  // archetype — spine OR prone — covers more than ~60% of a realistic-length book. The step-5 slot
  // spread bounds every N in 9..16 below 60%; N=10 is the TIGHTEST (its hard ceiling is exactly
  // 6 in-window chapters / 10 = 60%), so this assertion is a structural bound, not a sampled fluke.
  // (The deal-time guard's cap is looser — max(0.6, contiguousFloor) — but the spread keeps ACTUAL
  // coverage at/under 60% here; this test asserts that stronger spread property.)
  const books: string[] = [];
  for (let i = 0; i < 120; i++) books.push(`zz-cov-${i}`);
  books.push("the-organized-mind", "quiet", "fooled-by-randomness", "the-happiness-hypothesis", "nudge");
  for (let N = 9; N <= 16; N++) {
    for (const book of books) {
      const plan = planOpeners(book, 1, N, 6); // the deal-time assertMaxCoverage throws if any archetype saturates
      const coverage = new Map<string, number>();
      for (const ids of Object.values(plan.allocation)) {
        for (const id of new Set(ids)) coverage.set(id, (coverage.get(id) ?? 0) + 1);
      }
      for (const [id, count] of coverage) {
        assert.ok(count / N <= 0.6 + 1e-9, `N=${N} ${book}: opener "${id}" covers ${count}/${N} chapters (>60%)`);
      }
    }
  }
});

test("planOpeners: short books deal without a coverage false-throw (the PR #271 false-throw trap)", () => {
  // The N-aware cap (max(0.6, contiguous-deal floor)) must stay satisfiable for short books too — a flat
  // 0.6 cap would false-throw at N=6..8, where the linear deal's unavoidable floor exceeds 60%. (This is
  // the same class of bug that the prone anyCap=1 fix avoided in PR #271.) planOpeners() throwing here = a
  // regressed cap. The structural ceiling over N=6..8 is 4/6 = 66.7%, comfortably under the 70% sanity bound.
  for (let N = 6; N <= 8; N++) {
    for (let i = 0; i < 120; i++) {
      const book = `zz-short-${i}`;
      const plan = planOpeners(book, 1, N, 6); // must not throw
      const coverage = new Map<string, number>();
      for (const ids of Object.values(plan.allocation)) for (const id of new Set(ids)) coverage.set(id, (coverage.get(id) ?? 0) + 1);
      let max = 0;
      for (const [, c] of coverage) max = Math.max(max, c / N);
      assert.ok(max <= 0.7 + 1e-9, `N=${N} ${book}: max coverage ${(max * 100).toFixed(0)}% exceeded the 70% short-book sanity bound`);
    }
  }
});
