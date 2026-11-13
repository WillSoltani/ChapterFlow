import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canRetakeFromReview,
  classifyQuizSubmission,
  completionScore,
  createInFlightGuard,
  emptyQuizProgress,
  isQuizAttemptInProgress,
  isStaleAfterRecordedSubmit,
  mergeQuizDraft,
  projectIncorrectQuestionReviews,
  quizSubmitErrorMessage,
  readQuizDraft,
  shouldEnrollFlashcards,
  shouldReloadQuizAfterSubmitError,
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

// READER-10: per-question grading and retry counts survive a tab switch or a
// refresh, stored with the answer draft for the same attempt.
const savedProgress = {
  feedback: { q1: "correct", q2: "incorrect-retry", q3: "incorrect-final" } as const,
  retriesUsed: { q2: 1, q3: 3 },
  disabledChoices: { q2: ["q2::choice::1"], q3: ["q3::choice::0", "q3::choice::2"] },
  correctByQuestion: { q1: "q1::choice::0" },
  retakeQuestionIds: ["q2", "q3"],
};

test("readQuizDraft restores answers and grading progress for the same attempt only", () => {
  const raw = { attemptNumber: 2, answers: { q1: "q1::choice::0" }, progress: savedProgress };
  const restored = readQuizDraft(raw, 2);
  assert.deepEqual(restored.answers, { q1: "q1::choice::0" });
  assert.deepEqual(restored.progress, savedProgress);
  assert.deepEqual(readQuizDraft(raw, 3), { answers: {}, progress: emptyQuizProgress() });
});

test("readQuizDraft reads an older answers-only draft and drops malformed progress", () => {
  assert.deepEqual(readQuizDraft({ attemptNumber: 1, answers: { q1: "a" } }, 1), {
    answers: { q1: "a" },
    progress: emptyQuizProgress(),
  });
  const messy = {
    attemptNumber: 1,
    answers: { q1: "a", q2: 7 },
    progress: {
      feedback: { q1: "pending", q2: "correct", q3: "bogus" },
      retriesUsed: { q1: "2", q2: 1 },
      disabledChoices: { q1: "x", q2: ["b", 3] },
      correctByQuestion: { q2: "b", q3: null },
      retakeQuestionIds: ["q2", 4],
    },
  };
  assert.deepEqual(readQuizDraft(messy, 1), {
    answers: { q1: "a" },
    progress: {
      feedback: { q2: "correct" },
      retriesUsed: { q2: 1 },
      disabledChoices: { q2: ["b"] },
      correctByQuestion: { q2: "b" },
      retakeQuestionIds: ["q2"],
    },
  });
  assert.deepEqual(readQuizDraft(null, 1), { answers: {}, progress: emptyQuizProgress() });
});

test("mergeQuizDraft keeps the other half of the draft for the same attempt and resets on a new one", () => {
  const existing = { attemptNumber: 2, answers: { q1: "a" }, progress: savedProgress };
  assert.deepEqual(mergeQuizDraft(existing, 2, { answers: { q1: "a", q2: "b" } }), {
    attemptNumber: 2,
    answers: { q1: "a", q2: "b" },
    progress: savedProgress,
  });
  assert.deepEqual(mergeQuizDraft(existing, 2, { progress: emptyQuizProgress() }), {
    attemptNumber: 2,
    answers: { q1: "a" },
    progress: emptyQuizProgress(),
  });
  assert.deepEqual(mergeQuizDraft(existing, 3, { answers: { q4: "d" } }), {
    attemptNumber: 3,
    answers: { q4: "d" },
    progress: emptyQuizProgress(),
  });
});

// READER-11: the server keeps a passed quiz passed and issues no new attempt,
// so the review view must not offer a retake that does nothing.
test("canRetakeFromReview is false once the attempt passed", () => {
  assert.equal(canRetakeFromReview({ result: { passed: true, scorePercent: 80 } }), false);
  assert.equal(canRetakeFromReview({ result: { passed: false, scorePercent: 40 } }), true);
  assert.equal(canRetakeFromReview({ result: null }), false);
  assert.equal(canRetakeFromReview(null), false);
});

// READER-12 (part in this package): a mode switch mid-quiz can leave the reader
// holding the old mode's question set; the server then refuses the submit.
test("isQuizAttemptInProgress is true only for an unsubmitted attempt with an answer", () => {
  assert.equal(isQuizAttemptInProgress({ result: null }, { q1: "a" }), true);
  assert.equal(isQuizAttemptInProgress({ result: null }, {}), false);
  assert.equal(isQuizAttemptInProgress({ result: null }, { q1: "" }), false);
  assert.equal(isQuizAttemptInProgress({ result: { passed: false } }, { q1: "a" }), false);
  assert.equal(isQuizAttemptInProgress(null, { q1: "a" }), false);
});

test("shouldReloadQuizAfterSubmitError reloads on a cooldown or a question-set mismatch", () => {
  assert.equal(shouldReloadQuizAfterSubmitError({ code: "attempt_cooldown" }), true);
  assert.equal(shouldReloadQuizAfterSubmitError({ code: "invalid_answers" }), true);
  assert.equal(shouldReloadQuizAfterSubmitError({ code: "quiz_session_stale" }), false);
  assert.equal(shouldReloadQuizAfterSubmitError(new Error("offline")), false);
});
