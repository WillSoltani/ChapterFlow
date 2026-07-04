/**
 * BP33 — causal-attribution key shape (W3, FINAL-HARDENING-PLAN 2026-07-04).
 *
 * Two LIVE incidents drove this rule: execution ch01 Q1 (stem asked what CAUSED
 * the slip; the key stated the REMEDY) and ch09 Q1 (sibling cause-framings) —
 * both split the dual-blind key derivators at publish evidence and each cost a
 * surgical repair. The deterministic detector flags ONLY incident 1's mechanical
 * shape (causal stem + imperative-led key); the semantic judgment stays with the
 * blinded readers (instrument line added) and the key-judge.
 *
 * Calibration (2026-07-04, measured): 136 shipped packages, 50 causal stems,
 * ZERO BP33 hits — zero-FP corpus-wide, including the owner top-5. ADVISORY
 * (minor) by the standing rule; these tests pin both halves.
 */

import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { test } from "./harness.js";
import { labelCleanCorpusChapterFiles } from "./helpers.js";
import { CAUSAL_STEM_RX, checkQuizCausalKeyShape } from "../src/critics/quizQuality.js";
import type { ChapterV21, QuizV21 } from "../src/types.js";

function quizOf(...questions: { prompt: string; choices: string[]; correctIndex: number }[]): QuizV21 {
  return {
    passingScorePercent: 70,
    questions: questions.map((q, i) => ({
      questionId: `q${String(i + 1).padStart(2, "0")}`,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
      explanation: "Because the prose shows exactly this and rules the siblings out.",
      bloomsLevel: "apply",
      depthLevel: "standard",
    })),
  } as QuizV21;
}

test("BP33 catches the live incident shape: causal stem keyed to an imperative remedy", () => {
  // The execution ch01 Q1 class: "what caused X" answered with a prescription.
  const quiz = quizOf({
    prompt: "What caused the launch review to collapse in week three?",
    choices: [
      "Schedule a weekly return pass with a named owner before the review.",
      "The handoff named no owner, so each follow-up decayed within days.",
      "The team lacked commitment to the launch goals from the start.",
    ],
    correctIndex: 0,
  });
  const findings = checkQuizCausalKeyShape(quiz);
  assert.equal(findings.length, 1, "the remedy-shaped key on a causal stem is flagged");
  assert.equal(findings[0].severity, "minor", "ADVISORY — key quality is semantic; only the mechanical shape flags");
  assert.match(findings[0].message, /remedy cannot be the cause/i);
});

test("BP33 passes the GOOD pattern: causal stem keyed to a prose-anchored cause with sibling-cause distractors", () => {
  const quiz = quizOf({
    prompt: "What caused the launch review to collapse in week three?",
    choices: [
      "The handoff named no owner, so each follow-up decayed within days.",
      "The review packet grew past what anyone would read before the meeting.",
      "Two teams measured progress on different dashboards and never reconciled.",
    ],
    correctIndex: 0,
  });
  assert.equal(checkQuizCausalKeyShape(quiz).length, 0, "a cause-statement key never fires — even with plausible sibling causes beside it");
});

test("BP33 never fires on non-causal stems — application questions legitimately key imperatives", () => {
  const quiz = quizOf(
    {
      prompt: "Which move fits the chapter's idea when a handoff keeps slipping?",
      choices: [
        "Schedule a return pass with a named owner and a date.",
        "Send a longer status update to more stakeholders.",
        "Escalate to the sponsor after the first slip.",
      ],
      correctIndex: 0,
    },
    {
      prompt: "A teammate misses two follow-ups. What should you do first?",
      choices: ["Set a single named checkpoint.", "Reassign the work quietly.", "Document the misses for review."],
      correctIndex: 0,
    },
  );
  assert.equal(checkQuizCausalKeyShape(quiz).length, 0, "imperative keys are the NORM on application stems — only causal stems are in scope");
});

test("BP33 stem detector covers the W3 stem family and nothing conversational", () => {
  for (const s of [
    "Why did the pilot stall after the first month?",
    "What caused the metric to recover?",
    "What led to the second rollout succeeding?",
    "What explains the gap between the two teams?",
    "What was the main reason the plan failed?",
  ]) {
    assert.ok(CAUSAL_STEM_RX.test(s), `causal: ${s}`);
  }
  for (const s of [
    "Which move fits the chapter's idea?",
    "What should you do first?",
    "How would you apply the return pass at your desk?",
  ]) {
    assert.ok(!CAUSAL_STEM_RX.test(s), `not causal: ${s}`);
  }
});

test("BP33 zero-FP pin on the clean gold corpus chapters", () => {
  let checked = 0;
  for (const fixture of labelCleanCorpusChapterFiles()) {
    for (const file of fixture.files) {
      const chapter = JSON.parse(readFileSync(file, "utf8")) as ChapterV21;
      if (!chapter?.quiz?.questions?.length) continue;
      checked++;
      const findings = checkQuizCausalKeyShape(chapter.quiz);
      assert.equal(findings.length, 0, `${file}: BP33 must stay zero-FP on the clean corpus (${findings.map((f) => f.message).join("; ")})`);
    }
  }
  assert.ok(checked > 0, "the clean-corpus fixture set resolved to at least one chapter");
});
