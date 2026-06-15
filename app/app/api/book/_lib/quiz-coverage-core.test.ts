import { test } from "node:test";
import assert from "node:assert/strict";
import { answersCoverAssignedQuestions } from "./quiz-coverage-core";

test("accepts a full, exact-coverage submission (any order)", () => {
  assert.equal(answersCoverAssignedQuestions(["q1", "q2", "q3"], ["q3", "q1", "q2"]), true);
});

test("rejects a partial submission (fewer answers than assigned)", () => {
  assert.equal(answersCoverAssignedQuestions(["q1", "q2", "q3"], ["q1"]), false);
});

test("rejects the legacy bypass: right COUNT but answering non-assigned pool questions", () => {
  // The exploit: submit attemptQuestions.length answers, but for questions that
  // are NOT in the assigned subset (their correct indices are exposed via the quiz GET).
  assert.equal(answersCoverAssignedQuestions(["q1", "q2", "q3"], ["q7", "q8", "q9"]), false);
  // Mixed: one assigned + two non-assigned, still the right count → reject.
  assert.equal(answersCoverAssignedQuestions(["q1", "q2", "q3"], ["q1", "q8", "q9"]), false);
});

test("rejects duplicate response ids that pad the count", () => {
  // q1 twice + q2 = length 3 but only covers {q1,q2}; must not pass for {q1,q2,q3}.
  assert.equal(answersCoverAssignedQuestions(["q1", "q2", "q3"], ["q1", "q1", "q2"]), false);
});

test("rejects extra answers beyond the assigned set", () => {
  assert.equal(answersCoverAssignedQuestions(["q1", "q2"], ["q1", "q2", "q3"]), false);
});

test("handles the single-question attempt", () => {
  assert.equal(answersCoverAssignedQuestions(["q1"], ["q1"]), true);
  assert.equal(answersCoverAssignedQuestions(["q1"], ["q2"]), false);
});
