/**
 * S05 — the book-level soft-ban budget blocker (F4) must name chapters.
 *
 * The live wedge: bookGate's F4 ("soft-banned phrase "rather than" appears 24
 * times (budget 15)") carried no `chapters`, so the QC evaluator gave its QC
 * BLOCKER no location, and the QC-repair preflight refuses ANY location-less
 * blocker with REPAIR_FINDING_UNSCOPED — before a model call, on every resume.
 *
 * F4 now names the FEWEST chapters (highest per-chapter count first, ties to
 * the lower chapter number) whose occurrences, removed, bring the book back
 * within budget. The emission is proved here; the evaluator's chNN location is
 * proved in v4-candidate-qc-evaluator.test.ts; the preflight pins below prove
 * the port still refuses a truly unscoped blocker and accepts the located F4.
 */

import assert from "node:assert/strict";

import { runBookGate } from "../../src/critics/bookGate.js";
import type { ChapterV21 } from "../../src/types.js";
import { makeGateCleanChapter } from "../helpers.js";
import { finishV25Tests, requiredTest } from "./harness.js";
import { rig } from "./repairPortRig.js";

const BOOK = "f4-scope-book";

/** Put `count` occurrences of the phrase into DIFFERENT fields the F4 counter
 *  reads (mixed case — the match is case-insensitive), so the per-chapter
 *  attribution is exercised across fields, not just one string. */
function sprinkle(chapter: ChapterV21, count: number): ChapterV21 {
  // The gate-clean fixture already uses the phrase in places; neutralize those
  // so each chapter's count is exactly the one the case states.
  const next = JSON.parse(JSON.stringify(chapter).replace(/rather than/gi, "instead of")) as ChapterV21;
  const setters: Array<(text: string) => void> = [
    (t) => { next.hook = `${next.hook} ${t}`; },
    (t) => { next.keyTakeaway = `${next.keyTakeaway} ${t}`; },
    (t) => { next.examples[0].scenario = `${next.examples[0].scenario} ${t}`; },
    (t) => { next.quiz.questions[0].explanation = `${next.quiz.questions[0].explanation} ${t}`; },
    (t) => { next.reviewCards[0].back = `${next.reviewCards[0].back} ${t}`; },
    (t) => { next.implementationPlan.weeklyPractice = `${next.implementationPlan.weeklyPractice} ${t}`; },
  ];
  for (let index = 0; index < count; index += 1) {
    setters[index % setters.length](index % 2 === 0 ? "Choose the note rather than the guess." : "RATHER THAN wait, act.");
  }
  return next;
}

function book(counts: Readonly<Record<number, number>>, chapterCount = 10): ChapterV21[] {
  return Array.from({ length: chapterCount }, (_, index) => sprinkle(makeGateCleanChapter(BOOK, index + 1), counts[index + 1] ?? 0));
}

function ratherThanF4(chapters: ChapterV21[]) {
  const report = runBookGate(BOOK, chapters);
  const f4 = report.findings.filter((finding) => finding.catalogId === "F4" && finding.evidence === "rather than");
  assert.equal(f4.length, 1, JSON.stringify(report.findings.filter((finding) => finding.catalogId === "F4"), null, 2));
  return f4[0];
}

requiredTest("F4 over budget names the fewest chapters, highest per-chapter count first, and keeps the blocker", () => {
  // 24 occurrences, budget 15 → 9 must go. ch03 (5) + ch08 (4) = 9 — the rr21 shape.
  const counts = { 1: 2, 2: 2, 3: 5, 4: 2, 5: 2, 6: 2, 7: 2, 8: 4, 9: 2, 10: 1 };
  const f4 = ratherThanF4(book(counts));
  assert.deepEqual(f4.chapters, [3, 8], `F4 must be chapter-scoped: ${JSON.stringify(f4)}`);
  assert.equal(f4.severity, "major", "F4 stays major (the QC evaluator maps it to BLOCKER) — nothing is loosened");
  assert.match(f4.message, /^soft-banned phrase "rather than" appears 24 times \(budget 15\)\./);
  assert.match(f4.message, /Scoped to ch03 \(5\), ch08 \(4\): remove every occurrence in these chapters\.$/);
});

requiredTest("F4 scope breaks ties on per-chapter count by the lower chapter number", () => {
  // 20 occurrences, budget 15 → 5 must go. Three chapters tie at 4: ch02, ch04, ch07.
  const counts = { 1: 2, 2: 4, 3: 2, 4: 4, 5: 2, 6: 2, 7: 4 };
  const f4 = ratherThanF4(book(counts));
  assert.deepEqual(f4.chapters, [2, 4]);
  assert.match(f4.message, /appears 20 times \(budget 15\)\./);
  assert.match(f4.message, /Scoped to ch02 \(4\), ch04 \(4\):/);
});

requiredTest("F4 per-chapter counts sum to the book count (budget 0: every using chapter is scoped, highest count first)", () => {
  // "chapter argues that" has budget 0, so the scope must cover EVERY occurrence;
  // the counts it prints come from the SAME fields the book count reads.
  const base = book({}, 10);
  const inject = (chapter: ChapterV21, fields: ReadonlyArray<"hook" | "counterintuition" | "tryThisNow" | "fullRead" | "choices" | "front">) => {
    for (const field of fields) {
      const text = "A chapter argues that notes beat memory.";
      if (field === "fullRead") chapter.breakdown.fullRead = `${chapter.breakdown.fullRead} ${text}`;
      else if (field === "choices") chapter.quiz.questions[1].choices[2] = `${chapter.quiz.questions[1].choices[2]} ${text}`;
      else if (field === "front") chapter.reviewCards[1].front = `${chapter.reviewCards[1].front} ${text}`;
      else chapter[field] = `${chapter[field] ?? ""} ${text}`;
    }
  };
  inject(base[1], ["hook", "choices"]);
  inject(base[4], ["tryThisNow"]);
  inject(base[8], ["fullRead", "front", "counterintuition"]);
  const report = runBookGate(BOOK, base);
  const f4 = report.findings.filter((finding) => finding.catalogId === "F4" && finding.evidence === "chapter argues that");
  assert.equal(f4.length, 1, JSON.stringify(report.findings.filter((finding) => finding.catalogId === "F4"), null, 2));
  assert.deepEqual(f4[0].chapters, [9, 2, 5]);
  assert.match(f4[0].message, /^soft-banned phrase "chapter argues that" appears 6 times \(budget 0\)\./);
  assert.match(f4[0].message, /Scoped to ch09 \(3\), ch02 \(2\), ch05 \(1\): remove every occurrence in these chapters\.$/);
});

requiredTest("F4 within budget emits nothing", () => {
  const report = runBookGate(BOOK, book({ 1: 5, 2: 5, 3: 5 }));
  assert.equal(report.findings.some((finding) => finding.catalogId === "F4" && finding.evidence === "rather than"), false);
});

requiredTest("PIN: the QC-repair preflight refuses a location-less BLOCKER with REPAIR_FINDING_UNSCOPED", async (context) => {
  const subject = rig(context, { issueCode: "F4", location: null });
  assert.equal(subject.roundBlockers()[0].location, undefined, "the rig must stage a truly location-less blocker");
  const result = await subject.port.preflight(subject.request);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "REPAIR_FINDING_UNSCOPED");
    assert.match(result.error.message, /F4 has no chapter location/);
  }
  assert.deepEqual(subject.counts, { model: 0, repair: 0, review: 0, qc: 0 });
});

requiredTest("PIN: the QC-repair preflight accepts a blocker located like the new F4 and scopes it to exactly those chapters", async (context) => {
  const subject = rig(context, {
    issueCode: "F4",
    location: "ch03,ch08",
    extraChapterNumbers: [3, 4, 5, 6, 7, 8, 9, 10],
  });
  const result = await subject.port.preflight(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) {
    assert.deepEqual(result.value.targetChapterNumbers, [3, 8]);
    assert.deepEqual([...result.value.findingsByChapter.keys()], [3, 8]);
    for (const chapter of [3, 8]) {
      assert.deepEqual(result.value.findingsByChapter.get(chapter)?.map((issue) => issue.code), ["F4"]);
    }
  }
  assert.deepEqual(subject.counts, { model: 0, repair: 0, review: 0, qc: 0 });
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
