import assert from "node:assert/strict";

import { test } from "./harness.js";
import { citesNonexistentField, allFindingsFabricated, searchableChapterText, quoteUnverifiableAgainstChapters } from "../src/qc/orchestrator/findingValidity.js";

// The exact fabrication that shipped on the-daily-stoic: a sweep finding that
// invented a non-existent `implementationPlan.challenge` field.
const fabricated = {
  unitId: "book-wide-implementationPlan-challenge-24h-duplicate",
  quote: 'CH1 challenge and twentyFourHourChallenge both read: "Use Run the Control Filter once today."',
  problem: "Across all 12 chapters, implementationPlan.challenge is duplicated verbatim into implementationPlan.twentyFourHourChallenge.",
  expectedFix: "Revise either challenge or twentyFourHourChallenge so the two differ.",
};

test("citesNonexistentField catches an invented field on a real container", () => {
  assert.equal(citesNonexistentField(fabricated), "implementationPlan.challenge");
});

test("citesNonexistentField passes real field references and non-field prose", () => {
  assert.equal(citesNonexistentField({ unitId: "chapter:1:breakdown.fastRead", quote: "x", problem: "breakdown.fastRead opens weak", expectedFix: "y" }), null);
  assert.equal(citesNonexistentField({ unitId: "chapter:1:example[0]", quote: "the scenario feels abstract", problem: "implementationPlan.twentyFourHourChallenge is fine; planSpec.venue is set", expectedFix: "z" }), null);
  // An unknown container (not in the map) is never flagged — conservative by design.
  assert.equal(citesNonexistentField({ unitId: "u", quote: "see e.g. the note", problem: "the file.txt and section.two are fine", expectedFix: "" }), null);
});

test("citesNonexistentField does NOT mis-flag a dotted array-element path (the ch4 false-positive)", () => {
  // the-daily-stoic ch04: a REAL confirm REVISE cited `examples.ex01.scenario`. The old
  // 2-level regex matched `examples.ex01`, read `ex01` as a non-existent field, and dropped
  // the finding as fabricated. The fix validates the FINAL field after an array subscript.
  assert.equal(
    citesNonexistentField({
      unitId: "examples.ex01.scenario",
      quote: "Clara marks three plain facts in the city council anteroom before a Roman forum.",
      problem: "examples.ex01.scenario blends a modern anteroom with an ancient forum",
      expectedFix: "Recast the scene as one coherent setting.",
    }),
    null,
    "examples.ex01.scenario is a real array-element field reference, not fabricated",
  );
  // numeric subscript form, and a bare element reference with no field, are also fine.
  assert.equal(citesNonexistentField({ unitId: "examples.0.whatToDo", quote: "q", problem: "examples.0.whatToDo is a proposition", expectedFix: "" }), null);
  assert.equal(citesNonexistentField({ unitId: "examples.ex02", quote: "q", problem: "examples.ex02 is abstract", expectedFix: "" }), null);
  // The genuine 2-level fabrication is still caught even with the new subscript tolerance.
  assert.equal(citesNonexistentField(fabricated), "implementationPlan.challenge");
  // A truly invented field AFTER a real subscript is still caught (we validate the final token).
  assert.equal(citesNonexistentField({ unitId: "examples.ex01.bogusfield", quote: "q", problem: "examples.ex01.bogusfield", expectedFix: "" }), "examples.bogusfield");
});

test("allFindingsFabricated is true only when EVERY finding is invented", () => {
  const real = { unitId: "chapter:2:example[1]", quote: "q", problem: "scenario lacks a setting", expectedFix: "add one" };
  assert.equal(allFindingsFabricated([fabricated]), true);
  assert.equal(allFindingsFabricated([fabricated, real]), false, "one real finding makes the sweep actionable");
  assert.equal(allFindingsFabricated([]), false, "no findings is not a fabrication");
});

// ── Paraphrased-composite sweep guard (the-power-of-full-engagement) ──────────
// A cross-chapter SWEEP finding can quote a real-SOUNDING composite that exists in
// none of the chapters it names (R3 scene_skeleton quoted "Halfway through, she sees
// the error" — 0 occurrences). With chapter text supplied, that finding is treated as
// fabricated; without it, behavior is unchanged (the path-guard alone can't see it).
const ch2 = { number: 2, examples: [{ scenario: "Genevieve drafts a blunt note for Roger B about working harder at home, then revises it after a colleague pushes back." }] };
const ch3 = { number: 3, quiz: { questions: [{ prompt: "Jeffrey Sklar at Gruntal weighs whether to renew his energy before a long trading day." }] } };
const chapterText = new Map<number, string>([[2, searchableChapterText(ch2)], [3, searchableChapterText(ch3)]]);
const getChapterText = (n: number) => chapterText.get(n);

test("sweep quote present in NO named chapter is flagged ONLY when chapter text is supplied", () => {
  const fab = {
    unitId: "book-wide-correction-scene-shell", repairClass: "scene_skeleton", chapters: [2, 3],
    quote: "Genevieve drafts a blunt note for Roger B.: try harder at home. Halfway through, she sees the error. / Jonas is halfway through canceling his gym bag pickup.",
    problem: "several chapters reuse the same halfway self-correction scene", expectedFix: "vary the dramatic shape",
  };
  assert.equal(citesNonexistentField(fab), null, "without chapter text: unchanged (path-guard sees no field)");
  const reason = citesNonexistentField(fab, { getChapterText });
  assert.ok(reason?.startsWith("unverifiable-quote:"), `expected unverifiable, got ${reason}`);
});

test("a real verbatim sweep quote present in a named chapter is NOT flagged", () => {
  const real = {
    unitId: "x", repairClass: "repeated_unit", chapters: [2, 3],
    quote: "Genevieve drafts a blunt note for Roger B about working harder at home", problem: "p", expectedFix: "f",
  };
  assert.equal(citesNonexistentField(real, { getChapterText }), null);
});

test("an incidental character-NAME match does not bless a fabricated finding (whole phrase tested)", () => {
  // 'Genevieve' IS in ch2, but the discriminating phrase is not — still flagged.
  const fab = {
    unitId: "u", repairClass: "scene_skeleton", chapters: [2, 3],
    quote: "Genevieve realizes halfway through the meeting that her plan was wrong and starts the whole thing over", problem: "p", expectedFix: "f",
  };
  assert.ok(citesNonexistentField(fab, { getChapterText })?.startsWith("unverifiable-quote:"));
});

test("the substring guard applies to SWEEP families only, never bar/confirm findings", () => {
  const nonSweep = {
    unitId: "u", repairClass: "quiz_distractor_quality", chapters: [2, 3],
    quote: "this paraphrase appears nowhere in the chapter at all whatsoever", problem: "p", expectedFix: "f",
  };
  assert.equal(citesNonexistentField(nonSweep, { getChapterText }), null);
  assert.equal(quoteUnverifiableAgainstChapters(nonSweep, getChapterText), false);
});

test("a single-chapter sweep finding is NOT subject to the cross-chapter composite guard (P2 GUARD intact)", () => {
  // The membership-clobber the guard targets only affects book-wide (>=2 chapter) findings.
  // A 1-chapter sweep finding — even with a non-verbatim summary quote — must STILL gate,
  // or the existing P2 GUARD (a sibling collision demotes a carried chapter) would break.
  const single = { unitId: "quiz", repairClass: "repeated_unit", chapters: [2], quote: "A reused review prompt shared across chapters and never quoted verbatim.", problem: "p", expectedFix: "f" };
  assert.equal(quoteUnverifiableAgainstChapters(single, getChapterText), false);
  assert.equal(citesNonexistentField(single, { getChapterText }), null, "a single-chapter sweep finding stays actionable");
});

test("a short (non-discriminating) quote segment is never enough to flag (conservative)", () => {
  const tiny = { unitId: "u", repairClass: "scene_skeleton", chapters: [2, 3], quote: "Genevieve", problem: "p", expectedFix: "f" };
  assert.equal(citesNonexistentField(tiny, { getChapterText }), null);
  assert.equal(quoteUnverifiableAgainstChapters(tiny, getChapterText), false);
  // and a (book-wide) finding naming chapters that can't be loaded is never flagged
  assert.equal(quoteUnverifiableAgainstChapters({ repairClass: "scene_skeleton", chapters: [98, 99], quote: "a long discriminating phrase that exists nowhere at all" }, getChapterText), false);
});

test("allFindingsFabricated counts an unverifiable sweep quote as fabricated (mirrors finalize+ledger)", () => {
  const fabScene = { unitId: "book-wide-correction-scene-shell", repairClass: "scene_skeleton", chapters: [2, 3], quote: "Halfway through the page she notices her own dodge and rewrites the audit", problem: "p", expectedFix: "f" };
  const fabRitual = { unitId: "ritual-pressure-review-card-shell", repairClass: "repeated_unit", chapters: [2, 3], quote: "A ritual gives the desired behavior a cue before the day starts bargaining", problem: "p", expectedFix: "f" };
  assert.equal(allFindingsFabricated([fabScene, fabRitual], { getChapterText }), true, "an all-paraphrased sweep is unactionable");
  const real = { unitId: "x", repairClass: "repeated_unit", chapters: [2, 3], quote: "Genevieve drafts a blunt note for Roger B about working harder at home", problem: "p", expectedFix: "f" };
  assert.equal(allFindingsFabricated([fabScene, real], { getChapterText }), false, "one verifiable finding keeps the sweep actionable");
  assert.equal(allFindingsFabricated([fabScene, fabRitual]), false, "without chapter text the paraphrase guard is inert (path-guard alone)");
});
