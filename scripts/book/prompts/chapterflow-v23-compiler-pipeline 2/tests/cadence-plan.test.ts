/**
 * chapterArchetypePlan — rotates the chapter BODY ARC so chapters don't all run the
 * identical "named scene -> you-lesson" floor plan (the cold-validation monotony
 * finding). Mirrors rhetoricPlan: deterministic round-robin, redo-stable, capped.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { planChapterArchetypes, formatCadenceForChapter, CHAPTER_ARCHETYPES } from "../src/librarian/chapterArchetypePlan.js";

test("planChapterArchetypes: one archetype per chapter, from the palette", () => {
  const plan = planChapterArchetypes("zz-cadence", 1, 11);
  const ids = new Set(CHAPTER_ARCHETYPES.map((a) => a.id));
  for (const [n, a] of Object.entries(plan.allocation)) {
    assert.ok(ids.has(a.archetype), `ch${n} got an unknown archetype "${a.archetype}"`);
    assert.ok(a.directive.length > 0);
  }
});

test("planChapterArchetypes: deterministic + a single-chapter redo matches the full deal", () => {
  const full = planChapterArchetypes("zz-cadence", 1, 11);
  const again = planChapterArchetypes("zz-cadence", 1, 11);
  assert.deepEqual(again.allocation, full.allocation);
  const justCh6 = planChapterArchetypes("zz-cadence", 6, 6);
  assert.deepEqual(justCh6.allocation[6], full.allocation[6], "absolute-index round-robin → single-chapter redo matches");
});

test("planChapterArchetypes: consecutive chapters never share an archetype", () => {
  const plan = planChapterArchetypes("zz-cadence", 1, 14);
  for (let n = 1; n < 14; n++) {
    assert.notEqual(plan.allocation[n].archetype, plan.allocation[n + 1].archetype, `ch${n}->ch${n + 1} repeat`);
  }
});

test("planChapterArchetypes: no archetype saturates the book (<40%), never throws, across N=1..30 and many books", () => {
  const books: string[] = ["the-paradox-of-choice", "nudge", "quiet"];
  for (let i = 0; i < 60; i++) books.push(`zz-cad-${i}`);
  for (let N = 1; N <= 30; N++) {
    for (const book of books) {
      const plan = planChapterArchetypes(book, 1, N); // throws if the round-robin cap regresses
      if (N >= 5) {
        const counts = new Map<string, number>();
        for (const a of Object.values(plan.allocation)) counts.set(a.archetype, (counts.get(a.archetype) ?? 0) + 1);
        for (const [id, c] of counts) assert.ok(c / N < 0.4, `N=${N} ${book}: ${id} at ${c}/${N}`);
      }
    }
  }
});

test("planChapterArchetypes: books do not all start on the same archetype (per-book rotation)", () => {
  const starts = new Set<string>();
  for (let i = 0; i < 12; i++) starts.add(planChapterArchetypes(`zz-rot-${i}`, 1, 1).allocation[1].archetype);
  assert.ok(starts.size >= 2, `expected varied starting archetypes across books, got ${[...starts].join(", ")}`);
});

test("formatCadenceForChapter: emits the dealt arc directive, scoped to the body (not the hook)", () => {
  const plan = planChapterArchetypes("zz-cadence", 1, 1);
  const lines = formatCadenceForChapter(plan, 1).join("\n");
  assert.match(lines, /CHAPTER ARC/);
  assert.match(lines, /does NOT change the hook/);
  assert.deepEqual(formatCadenceForChapter(plan, 99), [], "no allocation → no lines");
});
