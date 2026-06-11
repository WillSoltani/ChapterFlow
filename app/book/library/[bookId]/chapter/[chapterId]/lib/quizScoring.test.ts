import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCarryForwardAnswers, scoreSessionLocally } from "./quizScoring";
import type { QuizQuestionView, QuizSessionView } from "../hooks/useQuizSession";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXED_NOW = () => "2026-06-11T00:00:00.000Z";

function choiceId(questionId: string, index: number): string {
  return `${questionId}-choice-${index}`;
}

function makeQuestion(questionId: string, correctIndex: number): QuizQuestionView {
  return {
    questionId,
    prompt: `Prompt ${questionId}`,
    choices: [0, 1, 2, 3].map((index) => ({
      choiceId: choiceId(questionId, index),
      text: `Choice ${index}`,
    })),
    explanation: "Because.",
    correctChoiceId: choiceId(questionId, correctIndex),
    correctIndex,
  };
}

/** A fresh (no-result) session of 3 questions whose correct answers are index 0. */
function makeSession(passingScorePercent = 70): QuizSessionView {
  return {
    chapterId: "book:1",
    chapterNumber: 1,
    title: "Chapter 1",
    passingScorePercent,
    status: "ready",
    attemptNumber: 1,
    nextAttemptNumber: null,
    attemptsCount: 0,
    failureStreak: 0,
    cooldownSeconds: 0,
    nextAttemptAvailableAt: null,
    highestScorePercent: 0,
    unlockedNextChapter: false,
    questions: [makeQuestion("q1", 0), makeQuestion("q2", 0), makeQuestion("q3", 0)],
    result: null,
    history: [],
  };
}

const correct = (questionId: string) => choiceId(questionId, 0);
const wrong = (questionId: string) => choiceId(questionId, 1);

// ─── Tests ───────────────────────────────────────────────────────────────────

test("retake answering the previously-missed questions correctly scores 100% (guards the score-drop regression)", () => {
  const session = makeSession(70);

  // First attempt: q1 right, q2 wrong, q3 right → 2/3 = 67%, fails the 70% gate.
  const firstAttemptAnswers = {
    q1: correct("q1"),
    q2: wrong("q2"),
    q3: correct("q3"),
  };
  const firstGraded = scoreSessionLocally(session, firstAttemptAnswers, FIXED_NOW);
  assert.ok(firstGraded?.result, "first attempt should produce a result");
  assert.equal(firstGraded!.result!.scorePercent, 67);
  assert.equal(firstGraded!.result!.passed, false);

  // Retake with default settings (retryIncorrectOnly): q1 and q3 are hidden, so
  // the user only re-answers q2. Their q1/q3 answers must be carried forward.
  const carried = buildCarryForwardAnswers(firstGraded!);
  assert.deepEqual(
    carried,
    { q1: correct("q1"), q3: correct("q3") },
    "carry-forward should seed exactly the previously-correct answers",
  );

  // User now answers the one missed question (q2) correctly.
  const retakeAnswers = { ...carried, q2: correct("q2") };
  const retakeGraded = scoreSessionLocally(makeSession(70), retakeAnswers, FIXED_NOW);
  assert.ok(retakeGraded?.result, "retake should produce a result");
  assert.equal(retakeGraded!.result!.scorePercent, 100);
  assert.equal(retakeGraded!.result!.correctAnswers, 3);
  assert.equal(retakeGraded!.result!.passed, true);
});

test("without carry-forward, the same retake would regress below the first score (documents the bug)", () => {
  const session = makeSession(70);
  const firstGraded = scoreSessionLocally(
    session,
    { q1: correct("q1"), q2: wrong("q2"), q3: correct("q3") },
    FIXED_NOW,
  );

  // The pre-fix behavior: only the visible (previously-missed) question is in
  // the answer map; q1/q3 fall through to null and are scored wrong.
  const buggyRetake = scoreSessionLocally(makeSession(70), { q2: correct("q2") }, FIXED_NOW);
  assert.equal(buggyRetake!.result!.scorePercent, 33);
  assert.ok(
    buggyRetake!.result!.scorePercent < firstGraded!.result!.scorePercent,
    "without carry-forward an improving user's score paradoxically drops",
  );
});

test("buildCarryForwardAnswers ignores incorrect and unanswered questions", () => {
  const graded = scoreSessionLocally(
    makeSession(70),
    { q1: correct("q1"), q2: wrong("q2") /* q3 unanswered */ },
    FIXED_NOW,
  );
  assert.deepEqual(buildCarryForwardAnswers(graded!), { q1: correct("q1") });
});

test("scoreSessionLocally returns null when there are no questions", () => {
  const empty = { ...makeSession(70), questions: [] };
  assert.equal(scoreSessionLocally(empty, {}, FIXED_NOW), null);
});
