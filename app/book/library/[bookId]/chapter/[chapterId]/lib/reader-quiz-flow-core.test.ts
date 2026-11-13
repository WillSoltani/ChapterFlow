import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyQuizSubmission,
  completionScore,
  createInFlightGuard,
  isStaleAfterRecordedSubmit,
  projectIncorrectQuestionReviews,
  quizSubmitErrorMessage,
  shouldEnrollFlashcards,
  unansweredQuestionIds,
} from "./reader-quiz-flow-core";

test("quiz submissions classify absent, failed, passed, and provisional pass outcomes", () => {
  assert.deepEqual(classifyQuizSubmission(null), {
    kind: "absent",
    provisional: false,
    scorePercent: 0,
    celebrateFreshPass: false,
  });
  assert.deepEqual(
    classifyQuizSubmission({ session: { result: { passed: false, scorePercent: 60 } } }),
    { kind: "failed", provisional: false, scorePercent: 60, celebrateFreshPass: false },
  );
  assert.deepEqual(
    classifyQuizSubmission({ session: { result: { passed: true, scorePercent: 90 } } }),
    { kind: "passed", provisional: false, scorePercent: 90, celebrateFreshPass: true },
  );
  assert.deepEqual(
    classifyQuizSubmission({
      session: { provisional: true, result: { passed: true, scorePercent: 80 } },
    }),
    { kind: "passed", provisional: true, scorePercent: 80, celebrateFreshPass: true },
  );
});

test("review projection keeps only incorrect questions with a known correct choice", () => {
  const questions = [
    { questionId: "wrong-known", isCorrect: false, correctChoiceId: "b" },
    { questionId: "wrong-unknown", isCorrect: false },
    { questionId: "correct", isCorrect: true, correctChoiceId: "a" },
  ];
  assert.deepEqual(projectIncorrectQuestionReviews(questions), [questions[0]]);
});

test("flashcards enroll only after a pass", () => {
  assert.equal(shouldEnrollFlashcards({ passed: true }), true);
  assert.equal(shouldEnrollFlashcards({ passed: false }), false);
  assert.equal(shouldEnrollFlashcards(null), false);
});

test("completion score preserves a finite result and defaults absent/non-finite values to zero", () => {
  assert.equal(completionScore({ result: { scorePercent: 87 } }), 87);
  assert.equal(completionScore({ result: { scorePercent: Number.NaN } }), 0);
  assert.equal(completionScore(null), 0);
});

// READER-07 / LIVE-03: a quiz with an unanswered question must not be submitted.
test("unansweredQuestionIds lists every session question without an answer, in order", () => {
  const questions = [{ questionId: "q1" }, { questionId: "q2" }, { questionId: "q3" }];
  assert.deepEqual(unansweredQuestionIds(questions, { q1: "a", q2: "b", q3: "c" }), []);
  // q1 was answered wrong with retries left and skipped with Next: no answer is
  // recorded for it, so it still counts as left.
  assert.deepEqual(unansweredQuestionIds(questions, { q3: "c" }), ["q1", "q2"]);
  assert.deepEqual(unansweredQuestionIds(questions, { q1: "", q2: "b", q3: "c" }), ["q1"]);
});

test("quizSubmitErrorMessage maps server codes to friendly copy instead of raw validator text", () => {
  const raw = "responses[0] must include selectedChoiceId or selectedIndex.";
  assert.equal(
    quizSubmitErrorMessage({ code: "invalid_answers", message: raw }),
    "Some answers didn't come through. Check every question is answered, then try again.",
  );
  assert.equal(
    quizSubmitErrorMessage({ code: "quiz_session_stale", message: "This quiz session is out of date." }),
    "This quiz changed since you opened it. Reload the page to get the latest version.",
  );
  assert.equal(quizSubmitErrorMessage({ code: "attempt_cooldown", message: "Locked for now." }), "Locked for now.");
  assert.equal(quizSubmitErrorMessage(new Error("Network down")), "Network down");
  assert.equal(quizSubmitErrorMessage("nope"), "Unable to submit quiz right now.");
});

// READER-06: a double tap on "See Your Results" must send one submit, and a late
// 409 for an attempt that was already recorded must not surface as an error.
test("createInFlightGuard lets one caller in until it exits", () => {
  const guard = createInFlightGuard();
  assert.equal(guard.tryEnter(), true);
  assert.equal(guard.tryEnter(), false, "a second tap while the first submit is in flight is refused");
  guard.exit();
  assert.equal(guard.tryEnter(), true);
});

test("isStaleAfterRecordedSubmit ignores a 409 only for an attempt already recorded", () => {
  const stale = { code: "quiz_session_stale" };
  assert.equal(isStaleAfterRecordedSubmit(stale, 2, 2), true);
  assert.equal(isStaleAfterRecordedSubmit(stale, 2, null), false);
  assert.equal(isStaleAfterRecordedSubmit(stale, 3, 2), false);
  assert.equal(isStaleAfterRecordedSubmit({ code: "invalid_answers" }, 2, 2), false);
  assert.equal(isStaleAfterRecordedSubmit(new Error("x"), 2, 2), false);
});
