import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LEARNING_MODE,
  isValidLearningMode,
  quizQuestionCountForMode,
  resolveLearningMode,
  resolveStrictQuizQuestionCount,
} from "./learning-mode";
import { QUIZ_QUESTION_COUNTS } from "@/app/book/_lib/quiz-question-counts";

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

test("quizQuestionCountForMode reads the single shared QUIZ_QUESTION_COUNTS source of truth", () => {
  // quizQuestionCountForMode now resolves the SAME dependency-free map the client
  // economy module (app/book/_lib/flow-points-economy.ts) re-exports as
  // QUIZ_QUESTION_COUNTS — extracted to quiz-question-counts.ts precisely so it
  // can be imported here without the badge UI's lucide-react chain. Asserting
  // against the real imported map (not a hand-copied literal) makes any future
  // divergence impossible: there is only one definition. A divergence would
  // mis-size the strict quiz (different question set ⇒ different choiceId scheme
  // ⇒ mis-grade) on the GET, /check and submit routes that all route through it.
  assert.equal(quizQuestionCountForMode("guided"), QUIZ_QUESTION_COUNTS.guided);
  assert.equal(quizQuestionCountForMode("standard"), QUIZ_QUESTION_COUNTS.standard);
  assert.equal(quizQuestionCountForMode("challenge"), QUIZ_QUESTION_COUNTS.challenge);
  // Pin the absolute values too, so a change to the shared map is a deliberate,
  // reviewed edit rather than a silent drift.
  assert.deepEqual(QUIZ_QUESTION_COUNTS, { guided: 5, standard: 7, challenge: 10 });
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

// ── resolveStrictQuizQuestionCount — the actual route-level seam (A9) ──────────
// The strict GET / /check / submit routes size the quiz attempt through THIS
// function (not quizQuestionCountForMode directly). It must hold two properties
// at once: (a) a customized reader cannot shrink their quiz via the request body
// — the count is a pure function of stored settings; and (b) an un-customized
// reader (the default first-visit "Fast short-path") still gets the 5-question
// set even though their mode resolves to "standard".

test("resolveStrictQuizQuestionCount: un-customized reader keeps the Fast 5-question short-path", () => {
  // Regression for the PR's UX bug: defaults are learningMode:"standard" +
  // profileCustomized:false, and on `main` the client sent difficulty=simple → 5
  // for these readers. The server must reproduce that 5, NOT collapse them to the
  // 7-question standard count. Mode resolves to standard here, yet count is 5.
  assert.equal(resolveLearningMode({}), "standard");

  // No settings at all (brand-new reader, no settings item yet) → fast path.
  assert.equal(resolveStrictQuizQuestionCount(undefined), 5);
  assert.equal(resolveStrictQuizQuestionCount(null), 5);
  assert.equal(resolveStrictQuizQuestionCount({}), 5);
  // Explicit un-customized flag → fast path, even with a non-guided mode stored.
  assert.equal(
    resolveStrictQuizQuestionCount({
      learningMode: "standard",
      extended: { profileCustomized: false },
    }),
    5,
  );
  assert.equal(
    resolveStrictQuizQuestionCount({
      learningMode: "challenge",
      extended: { profileCustomized: false },
    }),
    5,
  );
  // Non-boolean / corrupt profileCustomized shapes → treated as un-customized.
  assert.equal(
    resolveStrictQuizQuestionCount({ extended: { profileCustomized: "true" } }),
    5,
  );
  assert.equal(resolveStrictQuizQuestionCount({ extended: "nope" }), 5);
});

test("resolveStrictQuizQuestionCount: a customized reader is sized by mode and can't shrink via the request body", () => {
  // (a) the anti-gaming property — once a reader customizes (which is exactly
  // what picking a learning mode does in the reader/settings UI), the count is a
  // pure function of their STORED mode. There is no request-body input here, so a
  // challenge reader who tries to be served / graded on the 5-question set has no
  // lever to do it: the count is 10 and stays 10.
  assert.equal(
    resolveStrictQuizQuestionCount({
      learningMode: "challenge",
      extended: { profileCustomized: true },
    }),
    10,
  );
  assert.equal(
    resolveStrictQuizQuestionCount({
      learningMode: "standard",
      extended: { profileCustomized: true },
    }),
    7,
  );
  // A customized guided reader genuinely wants the small set — still 5, but now
  // because their mode says so, not because the request asked for it.
  assert.equal(
    resolveStrictQuizQuestionCount({
      learningMode: "guided",
      extended: { profileCustomized: true },
    }),
    5,
  );
  // Self-heal: mode only ever written under extended (pre-mirror reader) is still
  // honored for a customized reader.
  assert.equal(
    resolveStrictQuizQuestionCount({
      extended: { learningMode: "challenge", profileCustomized: true },
    }),
    10,
  );
});

test("resolveStrictQuizQuestionCount stays in lockstep with quizQuestionCountForMode for customized readers", () => {
  // The customized branch is literally quizQuestionCountForMode(resolveLearningMode(...)),
  // so it must equal that composition across all three modes — the GET / /check /
  // submit routes rely on this identity to keep the choiceId scheme aligned.
  for (const mode of ["guided", "standard", "challenge"] as const) {
    assert.equal(
      resolveStrictQuizQuestionCount({ learningMode: mode, extended: { profileCustomized: true } }),
      quizQuestionCountForMode(mode),
    );
  }
});
