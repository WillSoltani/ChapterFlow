import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LEARNING_MODE,
  isValidLearningMode,
  quizQuestionCountForMode,
  resolveLearningMode,
} from "./learning-mode";

test("isValidLearningMode accepts only the three canonical modes", () => {
  assert.equal(isValidLearningMode("guided"), true);
  assert.equal(isValidLearningMode("standard"), true);
  assert.equal(isValidLearningMode("challenge"), true);

  assert.equal(isValidLearningMode("deep"), false);
  assert.equal(isValidLearningMode("GUIDED"), false);
  assert.equal(isValidLearningMode(""), false);
  assert.equal(isValidLearningMode(undefined), false);
  assert.equal(isValidLearningMode(null), false);
  assert.equal(isValidLearningMode(3), false);
  assert.equal(isValidLearningMode({ learningMode: "challenge" }), false);
});

test("resolveLearningMode prefers the canonical top-level key", () => {
  assert.equal(resolveLearningMode({ learningMode: "challenge" }), "challenge");
  assert.equal(resolveLearningMode({ learningMode: "guided" }), "guided");
  assert.equal(resolveLearningMode({ learningMode: "standard" }), "standard");
});

test("resolveLearningMode falls back to extended.learningMode (self-heals pre-mirror users)", () => {
  // The bug this fixes: mode was only ever written under `extended`, so before
  // the backfill these readers were silently treated as "standard".
  assert.equal(
    resolveLearningMode({ extended: { learningMode: "challenge" } }),
    "challenge",
  );
  assert.equal(
    resolveLearningMode({ extended: { learningMode: "guided" } }),
    "guided",
  );
});

test("resolveLearningMode: top-level wins over extended when both present", () => {
  assert.equal(
    resolveLearningMode({
      learningMode: "guided",
      extended: { learningMode: "challenge" },
    }),
    "guided",
  );
});

test("resolveLearningMode: invalid top-level falls through to a valid extended", () => {
  assert.equal(
    resolveLearningMode({
      learningMode: "bogus",
      extended: { learningMode: "challenge" },
    }),
    "challenge",
  );
});

test("quizQuestionCountForMode is keyed by learning mode (server-trusted), not client difficulty", () => {
  // The defect this guards (cluster quiz-difficulty-server / A9): the strict
  // (v21/v12) quiz path previously sized the attempt from a CLIENT-supplied
  // `difficulty` param, so a reader could hand-pick `difficulty=simple` (5
  // questions) to clear the quiz on the smallest set and unlock the next
  // chapter / farm Insight Points. The count must instead be a pure function of
  // the SERVER-RESOLVED learning mode.
  assert.equal(quizQuestionCountForMode("guided"), 5);
  assert.equal(quizQuestionCountForMode("standard"), 7);
  assert.equal(quizQuestionCountForMode("challenge"), 10);
});

test("quizQuestionCountForMode stays in lockstep with the client QUIZ_QUESTION_COUNTS map", () => {
  // QUIZ_QUESTION_COUNTS (app/book/_lib/flow-points-economy.ts) is the client's
  // source of truth for per-mode question counts; it can't be imported here
  // (it pulls lucide-react via the badge UI chain). Pin the values so the two
  // maps can't silently diverge — a divergence would mis-size the strict quiz
  // (different question set ⇒ different choiceId scheme ⇒ mis-grade) on the GET,
  // /check and submit routes that all now route through quizQuestionCountForMode.
  const CLIENT_QUIZ_QUESTION_COUNTS = { guided: 5, standard: 7, challenge: 10 } as const;
  assert.equal(quizQuestionCountForMode("guided"), CLIENT_QUIZ_QUESTION_COUNTS.guided);
  assert.equal(quizQuestionCountForMode("standard"), CLIENT_QUIZ_QUESTION_COUNTS.standard);
  assert.equal(quizQuestionCountForMode("challenge"), CLIENT_QUIZ_QUESTION_COUNTS.challenge);
});

test("the resolved mode for malformed settings yields the standard (7-question) count, never the smallest", () => {
  // End-to-end of the fix's trust chain: a request that omits / tampers with the
  // mode resolves to DEFAULT_LEARNING_MODE ("standard") and therefore a 7-question
  // quiz — it can NOT collapse to the 5-question "guided" set the way a
  // client-supplied difficulty=simple used to.
  assert.equal(quizQuestionCountForMode(resolveLearningMode(undefined)), 7);
  assert.equal(quizQuestionCountForMode(resolveLearningMode({})), 7);
  assert.equal(quizQuestionCountForMode(resolveLearningMode({ learningMode: "bogus" })), 7);
  // A genuine guided reader still gets the smaller set — the count tracks the
  // stored mode, it isn't pinned to standard.
  assert.equal(quizQuestionCountForMode(resolveLearningMode({ learningMode: "guided" })), 5);
});

test("resolveLearningMode defaults to standard when absent / malformed", () => {
  assert.equal(resolveLearningMode(undefined), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode(null), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode({}), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode({ learningMode: "bogus" }), DEFAULT_LEARNING_MODE);
  assert.equal(
    resolveLearningMode({ extended: { learningMode: "bogus" } }),
    DEFAULT_LEARNING_MODE,
  );
  // `extended` is not a record (legacy / corrupt shape) — must not throw.
  assert.equal(resolveLearningMode({ extended: "challenge" }), DEFAULT_LEARNING_MODE);
  assert.equal(resolveLearningMode({ extended: null }), DEFAULT_LEARNING_MODE);
  assert.equal(DEFAULT_LEARNING_MODE, "standard");
});
