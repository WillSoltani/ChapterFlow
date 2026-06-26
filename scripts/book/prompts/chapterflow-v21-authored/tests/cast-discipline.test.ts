/**
 * Cast discipline (C24 cast-overflow, C25 example↔quiz cast-shuffle) + the C23
 * re-arm calibration record.
 *
 * THE DEFECTS (Finding #5):
 *  - Willpower's "Bailey" is THREE different people across the examples and the
 *    quiz — one name silently reassigned to new roles. C23 catches the
 *    example-vs-example half; C25 adds the cross-surface half (the reshuffled
 *    name leaking into a GRADED quiz question).
 *  - A regen chapter ran NINE interchangeable coaches — nobody counted the cast.
 *    C24 caps the distinct named protagonists per chapter at 6.
 *
 * THE CALIBRATION CONTRACT (mirrors evidence-integrity.test.ts):
 *  - TRUE POSITIVES fire (a gate that flags nothing is useless), and
 *  - the GOLD corpus (synthetic goldChapterFiles + real daring-greatly /
 *    start-with-why) stays at ZERO for C24, C25, AND C23.
 *
 * THE C23 RE-ARM RECORD. C23 now has a confirmed example-vs-example true-positive
 * (the Bailey-leads-two-scenes fixture below), closing the "no TP yet" half of
 * its shadow rationale. But re-arming it to gating (blocker / ENFORCED_MAJOR) was
 * REJECTED: a full-corpus sweep (330 shipped chapters) showed C23 fires on
 * think-and-grow-rich-ch01, where "Edison" legitimately leads two example scenes
 * (a real recurring historical figure). C23 is gold-clean but not clean on the
 * wider shipped corpus, so it stays a SHADOW major; C24/C25 are the gold-AND-
 * defect-separable replacements. See FAILURE-MODES.md C23/C24/C25.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { test, skip } from "./harness.js";
import { makeChapter, goldChapterFiles, STATE_CHAPTERS } from "./helpers.js";
import {
  countPersonNames,
  chapterCast,
  multiOwnedLeads,
  checkCastSize,
  checkExampleQuizNameConsistency,
  checkExampleProtagonistReuse,
} from "../src/critics/narrative.js";
import { runShipGate } from "../src/critics/finalGate.js";
import type { ChapterV21 } from "../src/types.js";

// Pad a short named snippet to a schema-valid scenario length without adding any
// new capitalized cast names ("The" is a stopword; the filler is lowercase).
const PAD =
  " The team reviews the live record against the signed note before the next handoff begins, checking the timestamp and the prior entry against the source carefully and without rushing past the discrepancy.";

// ── A crowded cast: 7 distinct named protagonists each recurring in their scene ──
const SEVEN_CAST = [
  "Alda opens the intake desk before dawn. Alda checks the ledger twice.",
  "Busayo reviews the billing queue. Busayo flags a duplicate charge.",
  "Cyrus holds the release. Cyrus traces the broken scan.",
  "Dahlia runs the training shift. Dahlia asks for the signed note.",
  "Eitan audits the bench. Eitan restores the missing context.",
  "Fiona watches the support lane. Fiona links the evidence.",
  "Galen closes the warehouse. Galen signs the final manifest.",
];

// ── The Bailey reshuffle: one name leads two scenes as two different people ──
const BAILEY_RESHUFFLE = [
  "Bailey is a night nurse at the clinic. Bailey checks a chart before the handoff, and Bailey pauses over a dose.",
  "Bailey runs a hedge-fund desk downtown. Bailey reviews a trade, and Bailey hesitates before the close.",
  "Corwin teaches a packed lecture. Corwin grades the late essays after class.",
];

// ── Clean constructions a reference book legitimately uses (must NOT fire) ──
const MUST_NOT_FIRE_CAST: Array<[string, string[]]> = [
  // Six named protagonists, one per scene — exactly at the cap.
  ["six distinct protagonists (at cap)", SEVEN_CAST.slice(0, 6)],
  // Cities + a real org appear ONCE each — not recurring actors, so not cast.
  ["one-off cities and an org", [
    "Rowan lands in Houston, meets a Dell rep at the Boston office, then flies on to Halifax by night.",
    "Mei reviews the Kyoto file while a Toronto vendor and a Lisbon partner wait on the call.",
  ]],
  // Capitalized common nouns (determiner-guarded) + gerund openers — not names.
  ["determiner nouns + gerund openers", [
    "Watching the queue, the Delivery team checks the Table twice and the Report once more.",
    "Standing by the desk, a Manager signs the Form while the Ledger sits open.",
  ]],
];

// ── C24: cast overflow ────────────────────────────────────────────────────────

test("C24: chapterCast counts 7 distinct recurring protagonists as overflow", () => {
  assert.equal(chapterCast(SEVEN_CAST).length, 7);
});

test("C24: checkCastSize fires on a >6 cast and is silent at exactly 6", () => {
  const over = makeChapter("zz-c24-over", 1);
  SEVEN_CAST.forEach((s, i) => { if (i < over.examples.length) over.examples[i].scenario = s + PAD; });
  // 6 examples carry the first 6 names; the 7th name is added as a foil in ex0.
  over.examples[0].scenario = "Alda opens the intake desk before dawn. Alda checks the ledger, then Galen signs off. Galen logs the entry." + PAD;
  const fired = checkCastSize(over);
  assert.ok(fired.some((f) => f.checkId === "C24.cast_overflow"), `expected C24; cast=${chapterCast(over.examples.map((e) => e.scenario as string))}`);
  assert.ok(fired.every((f) => f.severity === "major"), "C24 is a major");

  const atCap = makeChapter("zz-c24-cap", 2);
  SEVEN_CAST.slice(0, 6).forEach((s, i) => { atCap.examples[i].scenario = s + PAD; });
  assert.equal(checkCastSize(atCap).length, 0, "a 6-person cast is at the cap, not over it");
});

test("C24: clean constructions never fire (cities, orgs, determiner nouns, gerunds)", () => {
  for (const [label, scenarios] of MUST_NOT_FIRE_CAST) {
    assert.ok(chapterCast(scenarios).length <= 6, `false overflow on ${label}: ${JSON.stringify(chapterCast(scenarios))}`);
  }
});

test("C24: a one-off capitalized token is not counted as a cast member", () => {
  // Each appears once → not a recurring actor → cast is empty.
  assert.deepEqual(chapterCast(["Rowan briefs Houston and Dell, then leaves."]), []);
  // The same name twice → counted once.
  assert.deepEqual(chapterCast(["Rowan briefs the room. Rowan signs off."]), ["Rowan"]);
});

// ── C25: example↔quiz cast shuffle ───────────────────────────────────────────

test("C25: multiOwnedLeads flags a name leading two scenes, ignores single-owner leads", () => {
  const owners = multiOwnedLeads(BAILEY_RESHUFFLE);
  assert.deepEqual(owners.get("Bailey"), [1, 2], "Bailey leads scenes 1 and 2");
  assert.ok(!owners.has("Corwin"), "Corwin leads only one scene — not multi-owned");
});

test("C25: a reshuffled name reaching the quiz fires; pulling it out of the quiz does not", () => {
  const ch = makeChapter("zz-c25", 3);
  ch.examples[0].scenario = BAILEY_RESHUFFLE[0] + PAD;
  ch.examples[1].scenario = BAILEY_RESHUFFLE[1] + PAD;
  // Bailey now leads ex1 + ex2 (two different people). Name it in a quiz question.
  ch.quiz.questions[0].prompt = "Bailey faces the same call on the floor and must decide what to verify first before acting.";
  const fired = checkExampleQuizNameConsistency(ch);
  assert.ok(fired.some((f) => f.checkId === "C25.cast_shuffle"), "expected C25 when the reshuffled name is in the quiz");
  assert.ok(fired.every((f) => f.severity === "major"), "C25 is a major");

  // Remove Bailey from every quiz question → the reshuffle stays inside the
  // examples, which is C23's job, not C25's.
  ch.quiz.questions.forEach((q) => {
    q.prompt = q.prompt.replace(/Bailey/g, "Whoever");
    q.choices = q.choices.map((c) => c.replace(/Bailey/g, "Whoever"));
    q.explanation = (q.explanation ?? "").replace(/Bailey/g, "Whoever");
  });
  assert.equal(checkExampleQuizNameConsistency(ch).length, 0, "no C25 once the reshuffled name leaves the quiz");
});

test("C25: consistent single-owner reuse of an example name in its quiz does NOT fire (the gold pattern)", () => {
  // daring-greatly reuses each UNIQUE example protagonist in its matching quiz
  // question (Mei→q3). One owner → no reshuffle → silent.
  const ch = makeChapter("zz-c25-clean", 4);
  ch.examples[2].scenario = "Mei is a designer reviewing a layout. Mei compares two drafts, and Mei picks the simpler one." + PAD;
  ch.quiz.questions[2].prompt = "Mei reviews a third layout later that week and has to choose again under the same pressure.";
  assert.equal(checkExampleQuizNameConsistency(ch).length, 0, "single-owner reuse in the quiz is a clean callback");
});

// ── C23: the now-confirmed example-vs-example true-positive ───────────────────

test("C23: the Bailey reshuffle is a confirmed example-vs-example true-positive", () => {
  // This is the TP the old shadow comment said did not exist. C23 now fires —
  // but per the full-corpus sweep it ALSO fires on real recurring figures
  // (think-and-grow-rich's Edison), so it stays a SHADOW major (see file header).
  const fired = checkExampleProtagonistReuse(BAILEY_RESHUFFLE.map((scenario) => ({ scenario })));
  assert.ok(fired.some((f) => f.checkId === "narrative.example_protagonist_reuse"), "expected C23 to fire on a name leading two scenes");
});

// ── Ship-gate wiring + severity ──────────────────────────────────────────────

test("C24: the ship gate surfaces a cast overflow as a major (wiring + severity)", () => {
  const ch = makeChapter("zz-c24-gate", 5);
  const NAMED = [
    "Alda opens the desk at dawn. Alda signs off, then Busayo takes over and Busayo logs the entry.",
    "Cyrus reviews the queue. Cyrus flags a charge.",
    "Dahlia holds the release. Dahlia traces the scan.",
    "Eitan runs training. Eitan asks for the note.",
    "Fiona audits the bench. Fiona restores context.",
    "Galen closes support. Galen links the evidence.",
  ];
  NAMED.forEach((n, i) => { ch.examples[i].scenario = n + " " + (ch.examples[i].scenario as string); });
  const report = runShipGate(ch);
  assert.ok(report.majors.some((m) => m.catalogId === "C24.cast_overflow"), `expected a C24 major; got ${report.majors.map((m) => m.catalogId).join(", ")}`);
});

test("C25: the ship gate surfaces a quiz cast-shuffle as a major (wiring + severity)", () => {
  const ch = makeChapter("zz-c25-gate", 6);
  ch.examples[0].scenario = BAILEY_RESHUFFLE[0] + " " + (ch.examples[0].scenario as string);
  ch.examples[1].scenario = BAILEY_RESHUFFLE[1] + " " + (ch.examples[1].scenario as string);
  ch.quiz.questions[0].prompt = "Bailey faces the same call on the floor and must decide what to verify first before acting.";
  const report = runShipGate(ch);
  assert.ok(report.majors.some((m) => m.catalogId === "C25.cast_shuffle"), `expected a C25 major; got ${report.majors.map((m) => m.catalogId).join(", ")}`);
});

// ── Gold-corpus zero-FP calibration (the shadow-major calibration gate) ───────

function castFindings(ch: ChapterV21) {
  return [
    ...checkCastSize(ch),
    ...checkExampleQuizNameConsistency(ch),
    ...checkExampleProtagonistReuse(ch.examples ?? []),
  ];
}

test("cast discipline: synthetic gold corpus has ZERO C23/C24/C25 findings", () => {
  for (const { bookId, files } of goldChapterFiles()) {
    for (const file of files) {
      const ch = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      const hits = castFindings(ch);
      assert.equal(hits.length, 0, `cast-discipline false positive on synthetic gold ${bookId} ${ch.chapterId}: ${hits.map((h) => h.message.slice(0, 100)).join(" | ")}`);
    }
  }
});

for (const bookId of ["daring-greatly", "start-with-why"]) {
  const files = existsSync(STATE_CHAPTERS)
    ? readdirSync(STATE_CHAPTERS).filter((f) => f.startsWith(`${bookId}-ch`) && f.endsWith(".v21-native.chapter.json"))
    : [];
  if (files.length === 0) {
    skip(`cast-discipline gold zero-FP: ${bookId}`, `no ${bookId} chapters in state/chapters/ on this machine`);
    continue;
  }
  test(`cast discipline: real gold corpus ${bookId} (${files.length} ch) emits ZERO C23/C24/C25 findings`, () => {
    const offenders: string[] = [];
    for (const f of files) {
      const ch = JSON.parse(readFileSync(resolve(STATE_CHAPTERS, f), "utf8")) as ChapterV21;
      for (const hit of castFindings(ch)) offenders.push(`${ch.chapterId}: ${hit.checkId} — ${hit.message.slice(0, 110)}`);
    }
    assert.equal(offenders.length, 0, `cast-discipline false-positives on reference-quality ${bookId} (miscalibrated):\n${offenders.join("\n")}`);
  });
}
