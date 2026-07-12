/**
 * IMP-20 §C / WP-B3 — the quiz-integrity lane.
 *
 * Pins IMP-20 unit tests 14, 15, 16:
 *   14 — a wrong quiz key BLOCKS the lane;
 *   15 — a genuinely-ambiguous key (two defensible answers) BLOCKS the lane;
 *   16 — a uniquely-correct, mechanism-supported quiz PASSES.
 *
 * The lane reuses the shipped two-phase blindness mechanism verbatim
 * (buildQuizDerivation → commitQuizDerivation BEFORE any key → adjudicate) and
 * composes the frozen QuizIntegrityResultV1 by populating EVERY field from an
 * explicit source. The phase-2 adjudication is INJECTED as a canned
 * strict-schema-valid fenced-JSON reply (exactly as quiz-two-phase.test.ts injects
 * canned replies) — ZERO live model calls.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fxChapter } from "./migrationFixtures.js";
import type { ChapterV21 } from "../src/types.js";
import {
  buildQuizDerivation,
  commitQuizDerivation,
  type ReaderDerivationDetail,
} from "../src/review/quizDerivation.js";
import {
  buildQuizIntegrityAdjudicationTask,
  chapterContentShaFor,
  composeQuizIntegrityResult,
  computeQuizItemTells,
  parseQuizIntegrityAdjudication,
  QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
  QUIZ_INTEGRITY_PHASE2_VERSION,
  QuizIntegrityError,
  runQuizIntegrityLane,
  validateQuizIntegrityAdjudication,
} from "../src/review/quizIntegrityReview.js";
import { validateQuizIntegrityResult } from "../src/contracts/quizIntegrityReview.js";

// ── fixtures ─────────────────────────────────────────────────────────────────

/** A two-question quiz chapter. Choices are near-equal length so a PASS case
 *  carries no accidental length-tell noise (tellDetected is advisory anyway). */
function quizChapter(over: Partial<ChapterV21> = {}): ChapterV21 {
  return fxChapter({
    hook: "People misjudge friction because it hides in defaults.",
    breakdown: { fastRead: "Friction hides in defaults.", deepRead: "The deep read explains the mechanism at length.", fullRead: "The full read tells the whole story." },
    keyTakeaway: "Change the default, not the person.",
    tryThisNow: "Move one default today.",
    examples: [{ title: "The form", scenario: "A team shortened a form.", whatToDo: "Cut one field.", whyItMatters: "Completion rose." }],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q1", prompt: "Why did completion rise?", choices: ["Because they advertised", "Because a field was cut", "Because they paid users"], correctIndex: 1, explanation: "Cutting a field lowered friction." },
        { questionId: "q2", prompt: "Where does friction hide?", choices: ["Inside the defaults", "Inside the slogans", "Inside the budgets"], correctIndex: 0, explanation: "The hook states friction hides in defaults." },
      ],
    },
    reviewCards: [{ front: "What moves behavior?", back: "Defaults." }],
    memorableLines: [{ text: "Defaults decide.", why: "Compact." }],
    ...over,
  } as Partial<ChapterV21>) as ChapterV21;
}

const P1SHA = "d".repeat(64);

/** Commit a blind derivation for `answers` (per-question letters). */
function commit(ch: ChapterV21, detail: ReaderDerivationDetail) {
  const derivation = buildQuizDerivation(ch, detail, P1SHA, "sess-1");
  const itemIds = (ch.quiz?.questions ?? []).map((q) => q.questionId);
  return commitQuizDerivation(derivation, { documentSha256: P1SHA, questionCount: itemIds.length, itemIds });
}

type AdjItem = {
  itemId: string;
  keyedAnswerIndex: number;
  derivedAnswerIndex: number;
  agreement: boolean;
  keyCorrect: "correct" | "ambiguous" | "wrong";
  rationale: string;
  defensibleAnswerIndices: number[];
  keyedMechanismSupported: boolean;
};

/** A fenced-JSON phase-2 superset adjudication reply (what the model would emit). */
function mkAdjReply(items: AdjItem[]): string {
  return "```json\n" + JSON.stringify({ schema: QUIZ_INTEGRITY_ADJUDICATION_SCHEMA, items }) + "\n```";
}

// ── test 16 — correct, unique, mechanism-supported → PASS ─────────────────────

test("16: a uniquely-correct, mechanism-supported quiz composes result PASS", () => {
  const ch = quizChapter();
  const committed = commit(ch, { answers: ["b", "a"], evidence: [["a field was cut"], ["hides in defaults"]] });
  const reply = mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "Only choice b is supported.", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "correct", rationale: "The hook names defaults.", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
  ]);
  const parsed = parseQuizIntegrityAdjudication(reply)!;
  assert.ok(parsed, "adjudication parses");
  assert.deepEqual(validateQuizIntegrityAdjudication(parsed, ch, committed), [], "honest adjudication verifies");

  const result = composeQuizIntegrityResult(ch, committed, parsed, { chapterContentSha256: chapterContentShaFor(ch) });
  assert.equal(result.result, "PASS");
  assert.deepEqual(validateQuizIntegrityResult(result), [], "the composed result is a valid frozen QuizIntegrityResultV1");
  // Every frozen field populated from its explicit source — none left empty.
  assert.equal(result.derivationSha256, committed.sha256);
  const q1 = result.questions[0];
  assert.equal(q1.derivedAnswer, "b");           // committed phase-1 index 1 → b
  assert.equal(q1.keyedAnswer, "b");             // phase-2 keyed index 1 → b
  assert.equal(q1.keyCorrect, true);
  assert.equal(q1.uniqueAnswer, true);
  assert.equal(q1.mechanismSupported, true);
  assert.deepEqual(q1.defensibleAlternatives, ["b"]);
  assert.equal(q1.explanation, "Only choice b is supported.");
  assert.deepEqual(q1.evidenceSpans, ["a field was cut"]);
});

// ── test 14 — wrong key → BLOCK ──────────────────────────────────────────────

test("14: a wrong quiz key (keyCorrect wrong) BLOCKS the lane", () => {
  const ch = quizChapter();
  // q1 stored key is b (index 1). The blind reader derived a (index 0) and the
  // adjudicator rules the stored key WRONG — choice a is the best-supported answer.
  const committed = commit(ch, { answers: ["a", "a"], evidence: [["advertised"], ["defaults"]] });
  const reply = mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 0, agreement: false, keyCorrect: "wrong", rationale: "Choice a is the best-supported answer, not the keyed b.", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
  ]);
  const parsed = parseQuizIntegrityAdjudication(reply)!;
  assert.deepEqual(validateQuizIntegrityAdjudication(parsed, ch, committed), [], "the wrong-key verdict still trust-verifies (real key + agreement honest)");

  const result = composeQuizIntegrityResult(ch, committed, parsed, { chapterContentSha256: chapterContentShaFor(ch) });
  assert.equal(result.result, "BLOCK");
  assert.equal(result.questions[0].keyCorrect, false, "the flagged item carries keyCorrect=false");
  assert.deepEqual(validateQuizIntegrityResult(result), []);
});

// ── test 15 — genuine ambiguity → BLOCK ──────────────────────────────────────

test("15: a genuinely-ambiguous key (two defensible answers) BLOCKS the lane", () => {
  const ch = quizChapter();
  const committed = commit(ch, { answers: ["b", "a"], evidence: [["a field was cut"], ["defaults"]] });
  const reply = mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
    // q2: both "defaults" and "budgets" read as defensible — genuine ambiguity.
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "ambiguous", rationale: "Both a and c are defensible readings.", defensibleAnswerIndices: [0, 2], keyedMechanismSupported: true },
  ]);
  const parsed = parseQuizIntegrityAdjudication(reply)!;
  assert.deepEqual(validateQuizIntegrityAdjudication(parsed, ch, committed), []);

  const result = composeQuizIntegrityResult(ch, committed, parsed, { chapterContentSha256: chapterContentShaFor(ch) });
  assert.equal(result.result, "BLOCK");
  const q2 = result.questions[1];
  assert.equal(q2.uniqueAnswer, false, "an ambiguous key is not a unique answer");
  assert.equal(q2.keyCorrect, false, "an ambiguous key is not correct");
  assert.deepEqual(q2.defensibleAlternatives, ["a", "c"]);
  assert.deepEqual(validateQuizIntegrityResult(result), []);
});

// ── mechanism-unsupported also blocks ────────────────────────────────────────

test("an unsupported causal mechanism on an otherwise-correct key BLOCKS the lane", () => {
  const ch = quizChapter();
  const committed = commit(ch, { answers: ["b", "a"] });
  const reply = mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "The key names the right choice but overstates the cause.", defensibleAnswerIndices: [1], keyedMechanismSupported: false },
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
  ]);
  const parsed = parseQuizIntegrityAdjudication(reply)!;
  const result = composeQuizIntegrityResult(ch, committed, parsed, { chapterContentSha256: chapterContentShaFor(ch) });
  assert.equal(result.result, "BLOCK");
  assert.equal(result.questions[0].mechanismSupported, false);
});

// ── validator teeth (strict superset) ────────────────────────────────────────

test("the superset validator rejects out-of-range / duplicate defensible indices and inconsistent ambiguity", () => {
  const ch = quizChapter();
  const committed = commit(ch, { answers: ["b", "a"] });
  // ambiguous but only one defensible index → rejected.
  const badAmbiguous = parseQuizIntegrityAdjudication(mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "ambiguous", rationale: "x", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "correct", rationale: "x", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
  ]))!;
  assert.ok(validateQuizIntegrityAdjudication(badAmbiguous, ch, committed).some((e) => /requires >=2 defensible/.test(e)));

  // defensible index out of range (choice count is 3 → valid 0..2).
  const badRange = parseQuizIntegrityAdjudication(mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "x", defensibleAnswerIndices: [5], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "correct", rationale: "x", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
  ]))!;
  assert.ok(validateQuizIntegrityAdjudication(badRange, ch, committed).some((e) => /out of range/.test(e)));

  // Misreporting the real key is still caught by the reused base trust check.
  const misreport = parseQuizIntegrityAdjudication(mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 2, derivedAnswerIndex: 1, agreement: false, keyCorrect: "correct", rationale: "x", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "correct", rationale: "x", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
  ]))!;
  assert.ok(validateQuizIntegrityAdjudication(misreport, ch, committed).some((e) => /misreports the real key/.test(e)));

  // composeQuizIntegrityResult refuses to compose from an untrusted adjudication.
  assert.throws(() => composeQuizIntegrityResult(ch, committed, misreport, { chapterContentSha256: chapterContentShaFor(ch) }), QuizIntegrityError);
});

test("parse rejects a reply missing a superset field (defensibleAnswerIndices / keyedMechanismSupported)", () => {
  const ch = quizChapter();
  const missing = "```json\n" + JSON.stringify({
    schema: QUIZ_INTEGRITY_ADJUDICATION_SCHEMA,
    items: [{ itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "x" }],
  }) + "\n```";
  assert.equal(parseQuizIntegrityAdjudication(missing), null, "a base-only adjudication is not the superset");
  assert.equal(parseQuizIntegrityAdjudication("no fence here"), null);
  // The task card names the superset fields and the phase version constant is exported.
  const task = buildQuizIntegrityAdjudicationTask("ch01.phase2.txt");
  assert.ok(task.includes("defensibleAnswerIndices") && task.includes("keyedMechanismSupported"));
  assert.ok(task.includes("ch01.phase2.txt") && task.includes(QUIZ_INTEGRITY_ADJUDICATION_SCHEMA));
  assert.equal(QUIZ_INTEGRITY_PHASE2_VERSION, "quiz-integrity-phase2-v1");
  void ch;
});

// ── deterministic tell heuristic is model-independent ────────────────────────

test("computeQuizItemTells flags a unique answer-length outlier deterministically (model cannot hide it)", () => {
  const ch = quizChapter({
    quiz: {
      passingScorePercent: 70,
      questions: [
        // key is the uniquely-longest choice by a wide margin → length-tell.
        { questionId: "q1", prompt: "Which is right?", choices: ["No", "Maybe", "Because removing a single field lowered the friction that hid inside the default"], correctIndex: 2, explanation: "e" },
        // key (index 1) is the MIDDLE-length choice → no length outlier, no absolute word.
        { questionId: "q2", prompt: "Where?", choices: ["Inside the quarterly budgets and plans", "Inside the defaults", "In the slogans"], correctIndex: 1, explanation: "e" },
      ],
    },
  } as Partial<ChapterV21>);
  const tells = computeQuizItemTells(ch);
  assert.equal(tells[0], true, "q1 key is the uniquely-longest choice → tell");
  assert.equal(tells[1], false, "q2 choices are balanced → no tell");
});

// ── INCONCLUSIVE + fail-closed operational paths ─────────────────────────────

test("runQuizIntegrityLane: a missing/unparseable adjudication → INCONCLUSIVE, never a silent PASS", () => {
  const ch = quizChapter();
  const committed = commit(ch, { answers: ["b", "a"] });
  const result = runQuizIntegrityLane(ch, committed, null);
  assert.equal(result.result, "INCONCLUSIVE");
  assert.deepEqual(validateQuizIntegrityResult(result), [], "INCONCLUSIVE result is still a valid frozen shape");
  assert.ok(result.questions.every((q) => q.keyCorrect === false && q.uniqueAnswer === false), "unknown key correctness is never asserted true");

  // A valid injected reply routes to a real composed verdict.
  const reply = mkAdjReply([
    { itemId: "q1", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [1], keyedMechanismSupported: true },
    { itemId: "q2", keyedAnswerIndex: 0, derivedAnswerIndex: 0, agreement: true, keyCorrect: "correct", rationale: "ok", defensibleAnswerIndices: [0], keyedMechanismSupported: true },
  ]);
  assert.equal(runQuizIntegrityLane(ch, committed, reply).result, "PASS");
});

test("runQuizIntegrityLane fail-closes on an incomplete blind derivation (no normalizable answer)", () => {
  const ch = quizChapter();
  const committed = commit(ch, { answers: ["b"] }); // q2 unanswered → derivedAnswerIndex -1
  assert.throws(() => runQuizIntegrityLane(ch, committed, null), QuizIntegrityError);
});
