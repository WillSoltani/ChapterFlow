import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyQuizSubmission,
  completionScore,
  projectIncorrectQuestionReviews,
  shouldEnrollFlashcards,
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
