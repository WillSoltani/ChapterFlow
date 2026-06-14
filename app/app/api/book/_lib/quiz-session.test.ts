import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuizClientSession } from "./quiz-session";
import type {
  BookUserQuizStateItem,
  ChapterQuizPayload,
  QuizAttemptItem,
} from "./types";

/**
 * Guards the client projection built by buildQuizClientSession — the payload
 * returned by the GET quiz route and the /submit route. Before this file the
 * function had ZERO test coverage, yet it decides exactly which fields cross
 * the server/client boundary, including the quiz answer key (H3).
 *
 * preserveAuthoredOrder:true keeps choices in authored order so choiceIds are
 * deterministic: `${questionId}::choice::${canonicalIndex}` (the server scheme,
 * shared by buildQuizAttemptQuestions + gradeQuizAttemptQuestions — changing it
 * silently breaks grading).
 */

const QUIZ: ChapterQuizPayload = {
  chapterId: "bookX:1",
  number: 1,
  title: "Chapter 1",
  passingScorePercent: 80,
  questions: [
    { questionId: "q1", prompt: "P1", choices: ["a", "b", "c", "d"], correctAnswerIndex: 2, explanation: "e1" },
    { questionId: "q2", prompt: "P2", choices: ["a", "b", "c", "d"], correctAnswerIndex: 0, explanation: "e2" },
  ],
};

function readySession() {
  return buildQuizClientSession({
    quiz: QUIZ,
    userId: "u1",
    bookId: "bookX",
    chapterNumber: 1,
    quizState: null,
    latestAttempt: null,
    history: [],
    preserveAuthoredOrder: true,
  });
}

// ─── ready (fresh, answerable) attempt ────────────────────────────────────────

test("ready attempt: status is ready and per-result fields are gated to null/undefined", () => {
  const session = readySession();
  assert.equal(session.status, "ready");
  assert.equal(session.result, null);
  assert.equal(session.questions.length, 2);
  for (const q of session.questions) {
    assert.equal(q.selectedChoiceId, null, "no selection before submit");
    assert.equal(q.isCorrect, undefined, "no correctness verdict before submit");
  }
});

test("ready attempt: choiceIds use the server `<qid>::choice::<index>` scheme (pins build/grade contract)", () => {
  const session = readySession();
  assert.deepEqual(
    session.questions[0].choices.map((c) => c.choiceId),
    ["q1::choice::0", "q1::choice::1", "q1::choice::2", "q1::choice::3"],
  );
});

test("correctIndex is NOT emitted to the client (dead, answer-revealing field — H3)", () => {
  const session = readySession();
  // It has zero client consumers and is a redundant plaintext copy of the
  // answer; it must never appear on the wire, in any status.
  assert.ok(!("correctIndex" in session.questions[0]), "ready");
  assert.equal(session.questions[0].correctIndex, undefined);
});

test("KNOWN H3 LEAK (documents current behavior until approach (a) lands): correctChoiceId is still emitted on a ready attempt", () => {
  // correctChoiceId is the canonical answer (its string encodes the index), yet
  // it is sent for an unanswered quiz because the inline-feedback UX grades
  // clicks client-side. Closing the leak (server /check round-trip) MUST flip
  // this assertion to `assert.equal(session.questions[0].correctChoiceId,
  // undefined)` and gate the field to non-ready states in buildQuizClientSession.
  const session = readySession();
  assert.equal(session.questions[0].correctChoiceId, "q1::choice::2");
  assert.equal(session.questions[1].correctChoiceId, "q2::choice::0");
});

// ─── post-submit (review) projection ──────────────────────────────────────────

test("passed review: selectedChoiceId/isCorrect come from the attempt, correctChoiceId stays, correctIndex never", () => {
  const latestAttempt: QuizAttemptItem = {
    userId: "u1",
    bookId: "bookX",
    chapterNumber: 1,
    quizId: "bookX:1",
    attemptNumber: 1,
    passingScorePercent: 80,
    scorePercent: 100,
    correctCount: 2,
    totalQuestions: 2,
    passed: true,
    cooldownSeconds: 0,
    nextEligibleAttemptAt: null,
    unlockedNextChapter: true,
    responses: [
      { questionId: "q1", selectedChoiceId: "q1::choice::2" },
      { questionId: "q2", selectedChoiceId: "q2::choice::1" },
    ],
    questionResults: [
      { questionId: "q1", selectedChoiceId: "q1::choice::2", selectedIndex: 2, correctChoiceId: "q1::choice::2", correctIndex: 2, isCorrect: true },
      { questionId: "q2", selectedChoiceId: "q2::choice::1", selectedIndex: 1, correctChoiceId: "q2::choice::0", correctIndex: 0, isCorrect: false },
    ],
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
  };
  const quizState: BookUserQuizStateItem = {
    userId: "u1",
    bookId: "bookX",
    chapterNumber: 1,
    quizId: "bookX:1",
    attemptsCount: 1,
    failureStreak: 0,
    passed: true,
    highestScorePercent: 100,
    lastScorePercent: 100,
    lastCorrectCount: 2,
    lastTotalQuestions: 2,
    lastAttemptAt: "2026-06-11T00:00:00.000Z",
    lastAttemptNumber: 1,
    nextEligibleAttemptAt: null,
    passedAt: "2026-06-11T00:00:00.000Z",
    unlockedNextChapter: true,
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
  };

  const session = buildQuizClientSession({
    quiz: QUIZ,
    userId: "u1",
    bookId: "bookX",
    chapterNumber: 1,
    quizState,
    latestAttempt,
    history: [latestAttempt],
    preserveAuthoredOrder: true,
  });

  assert.equal(session.status, "passed");
  assert.equal(session.result?.scorePercent, 100);
  // Review screens (ReviewMistakesView, FSRS enrolment) legitimately need the
  // key here — it is read off a session that already has a result — so the
  // future gate must keep emitting correctChoiceId in non-ready states.
  assert.equal(session.questions[0].correctChoiceId, "q1::choice::2");
  assert.equal(session.questions[0].selectedChoiceId, "q1::choice::2");
  assert.equal(session.questions[0].isCorrect, true);
  assert.equal(session.questions[1].selectedChoiceId, "q2::choice::1");
  assert.equal(session.questions[1].isCorrect, false);
  assert.ok(!("correctIndex" in session.questions[0]), "passed");
});
