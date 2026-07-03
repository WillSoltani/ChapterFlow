/**
 * Deterministic validation harness for the quiz answer-key judge.
 *
 * We cannot run the live model in this environment (no ANTHROPIC_API_KEY; the
 * OpenAI key returns HTTP 429 quota-exhausted). But the live model's accuracy
 * is a SEPARATE concern from the detection harness this slice adds. This script
 * proves the harness — that a correct judgment is turned into the right finding
 * — by injecting an oracle in place of the model.
 *
 * It reproduces the exact `hooked` defect: a correct explanation/answer with
 * `correctIndex` pointed at the WRONG choice. We take a real clean promoted
 * chapter, flip the key on a known set of questions, and assert the judge:
 *   (1) stays SILENT on the untouched chapter (no false positives), and
 *   (2) flags EXACTLY the questions whose key we flipped (full recall, full
 *       precision), and
 *   (3) routes a medium-confidence disagreement to review, never to a veto.
 *
 * The oracle stands in for "an ideal model that derives the true answer." The
 * true answer is the promoted book's original `correctIndex` (captured BEFORE
 * we mutate anything), so the oracle never sees the flipped key — it derives
 * truth independently, exactly as the real model would.
 *
 * Run: npx tsx src/scratch/validate-quiz-key-judge.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { judgeQuizKeys, type AskModel } from "../critics/semantic/quizKeyJudge.js";
import type { ChapterV21 } from "../types.js";

const BOOK = resolve(__dirname, "../../book-packages/atomic-habits.v21.json");

function loadChapter(n: number): ChapterV21 {
  const book = JSON.parse(readFileSync(BOOK, "utf8"));
  const ch = book.chapters[n];
  return JSON.parse(JSON.stringify(ch)) as ChapterV21; // deep clone so mutation is local
}

/** Oracle: returns the TRUE correct index for each question (captured from the
 *  clean book before any flip), at high confidence. `medium` overrides let us
 *  test confidence-gating. The oracle is keyed by question text so it cannot
 *  accidentally read the (possibly flipped) stored correctIndex. */
function makeOracle(
  truth: Map<string, number>,
  mediumFor: Set<string> = new Set(),
): AskModel {
  return async ({ prompt, choices }) => {
    const trueIndex = truth.get(prompt);
    if (trueIndex == null) throw new Error("oracle has no truth for: " + prompt.slice(0, 40));
    const medium = mediumFor.has(prompt);
    return {
      index: trueIndex,
      confidence: medium ? "medium" : "high",
      correctText: choices[trueIndex],
      reason: "oracle: derived the source-correct answer independently of the stored key",
    };
  };
}

function captureTruth(ch: ChapterV21): Map<string, number> {
  const m = new Map<string, number>();
  for (const q of ch.quiz.questions) m.set(q.prompt, q.correctIndex);
  return m;
}

/** Flip the key on the given question indices to a deliberately wrong choice. */
function injectWrongKeys(ch: ChapterV21, questionIdxs: number[]): Set<string> {
  const flipped = new Set<string>();
  for (const i of questionIdxs) {
    const q = ch.quiz.questions[i];
    const wrong = (q.correctIndex + 1) % q.choices.length; // any choice != the real one
    q.correctIndex = wrong;
    flipped.add(q.questionId);
  }
  return flipped;
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("  ✗ FAIL: " + msg);
    process.exitCode = 1;
  } else {
    console.log("  ✓ " + msg);
  }
}

async function main() {
  console.log("=== Quiz answer-key judge — deterministic harness validation ===\n");

  // ---- TEST 1: clean chapter, judge must stay silent ----
  console.log("TEST 1 — clean chapter (atomic-habits ch01): judge must flag nothing");
  const clean = loadChapter(0);
  const truth1 = captureTruth(clean);
  const r1 = await judgeQuizKeys(clean, { ask: makeOracle(truth1) });
  assert(r1.questionsJudged === clean.quiz.questions.length, `judged all ${clean.quiz.questions.length} questions`);
  assert(r1.flagged.length === 0, `0 wrong-key flags on a clean chapter (got ${r1.flagged.length})`);
  assert(r1.review.length === 0, `0 review items on a clean chapter (got ${r1.review.length})`);

  // ---- TEST 2: inject the hooked defect on a known set, judge must catch exactly those ----
  console.log("\nTEST 2 — inject wrong keys (the hooked defect) on questions [0,2,5]; judge must catch exactly those");
  const bad = loadChapter(0);
  const truth2 = captureTruth(bad); // truth captured BEFORE flipping
  const flippedIds = injectWrongKeys(bad, [0, 2, 5]);
  const r2 = await judgeQuizKeys(bad, { ask: makeOracle(truth2) });
  const flaggedIds = new Set(r2.flagged.map((v) => v.questionId));
  assert(r2.flagged.length === 3, `flagged exactly 3 questions (got ${r2.flagged.length})`);
  assert([...flippedIds].every((id) => flaggedIds.has(id)), "every injected wrong key was flagged (full recall)");
  assert([...flaggedIds].every((id) => flippedIds.has(id)), "no clean question was flagged (full precision)");
  for (const v of r2.flagged) {
    assert(v.modelIndex !== v.storedIndex && v.confidence === "high", `${v.questionId}: confident mismatch, stored=${v.storedIndex} true=${v.modelIndex}`);
  }

  // ---- TEST 3: confidence gating — a medium-confidence disagreement is REVIEW, not a veto ----
  console.log("\nTEST 3 — confidence gating: a medium-confidence disagreement routes to review, never an auto-veto");
  const bad3 = loadChapter(0);
  const truth3 = captureTruth(bad3);
  injectWrongKeys(bad3, [1]); // q index 1 now has a wrong key
  const mediumFor = new Set([bad3.quiz.questions[1].prompt]); // but the model is only medium-confident
  const r3 = await judgeQuizKeys(bad3, { ask: makeOracle(truth3, mediumFor) });
  assert(r3.flagged.length === 0, `medium-confidence mismatch is NOT a veto (flagged=${r3.flagged.length})`);
  assert(r3.review.length === 1 && r3.review[0].questionId === bad3.quiz.questions[1].questionId, "medium-confidence mismatch surfaced as a review item");

  console.log("\n=== " + (process.exitCode ? "VALIDATION FAILED" : "ALL HARNESS ASSERTIONS PASSED") + " ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
