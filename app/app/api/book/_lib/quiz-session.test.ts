import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuizAttemptQuestions, buildQuizClientSession } from "./quiz-session";
import { BookApiError } from "./errors";
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
    session.questions[0]!.choices.map((c) => c.choiceId),
    ["q1::choice::0", "q1::choice::1", "q1::choice::2", "q1::choice::3"],
  );
});

test("correctIndex is NOT emitted to the client (dead, answer-revealing field — H3)", () => {
  const session = readySession();
  // It has zero client consumers and is a redundant plaintext copy of the
  // answer; it must never appear on the wire, in any status.
  assert.ok(!("correctIndex" in session.questions[0]!), "ready");
  assert.equal(session.questions[0]!.correctIndex, undefined);
});

test("H3 CLOSED: correctChoiceId is NOT emitted on a ready attempt (the answer key never ships pre-submit)", () => {
  // correctChoiceId is the canonical answer (its string encodes the index). It is
  // now withheld for an unanswered ("ready") attempt — the reader grades each
  // click via the server /check endpoint, which returns only correctness. The
  // key is revealed only in the post-submit review projection (asserted below).
  const session = readySession();
  assert.equal(session.questions[0]!.correctChoiceId, undefined);
  assert.equal(session.questions[1]!.correctChoiceId, undefined);
  // And the redundant index copy must likewise never appear on a ready question.
  assert.equal(session.questions[0]!.correctIndex, undefined);
  assert.ok(!("correctIndex" in session.questions[0]!));
});

// ─── out-of-range authored answer key (A4 — permanently-failing question) ─────

/**
 * An out-of-range authored correctIndex (>= choice count, or negative) used to
 * pass the only upstream guard (`typeof !== "number"`): findIndex returned -1
 * and correctChoiceId fell back to `${qid}::choice::${authoredIndex}` — a key
 * that matches NO emitted choice (whose ids are `${qid}::choice::<0..n-1>`).
 * Grading (correctChoiceId === selectedChoiceId) then marked every reader wrong
 * forever with no operator signal. It must now fail loud as a content error.
 */
function quizWithCorrectIndex(index: number): ChapterQuizPayload {
  return {
    chapterId: "bookX:1",
    number: 1,
    title: "Chapter 1",
    passingScorePercent: 80,
    questions: [
      { questionId: "q1", prompt: "P1", choices: ["a", "b", "c", "d"], correctAnswerIndex: index, explanation: "e1" },
    ],
  };
}

/** Capture a thrown error (assert.throws returns undefined, not the error). */
function captureThrow(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({ message: "expected the call to throw, but it did not" });
}

test("A4: an out-of-range correctAnswerIndex throws quiz_answer_key_out_of_range (not a fabricated unmatchable key)", () => {
  // index 4 with only 4 choices (valid: 0..3) — the historic permanently-fail case.
  const err = captureThrow(() =>
    buildQuizAttemptQuestions({
      quiz: quizWithCorrectIndex(4),
      userId: "u1",
      bookId: "bookX",
      chapterNumber: 1,
      attemptNumber: 1,
      preserveAuthoredOrder: true,
    }),
  );
  assert.ok(err instanceof BookApiError);
  assert.equal(err.status, 500);
  assert.equal(err.code, "quiz_answer_key_out_of_range");
});

test("A4: a negative correctAnswerIndex also throws quiz_answer_key_out_of_range", () => {
  const err = captureThrow(() =>
    buildQuizAttemptQuestions({
      quiz: quizWithCorrectIndex(-1),
      userId: "u1",
      bookId: "bookX",
      chapterNumber: 1,
      attemptNumber: 1,
      preserveAuthoredOrder: true,
    }),
  );
  assert.ok(err instanceof BookApiError);
  assert.equal(err.code, "quiz_answer_key_out_of_range");
});

test("A4: the out-of-range guard surfaces through buildQuizClientSession too (the live GET/submit seam)", () => {
  const err = captureThrow(() =>
    buildQuizClientSession({
      quiz: quizWithCorrectIndex(99),
      userId: "u1",
      bookId: "bookX",
      chapterNumber: 1,
      quizState: null,
      latestAttempt: null,
      history: [],
      preserveAuthoredOrder: true,
    }),
  );
  assert.ok(err instanceof BookApiError);
  assert.equal(err.code, "quiz_answer_key_out_of_range");
});

test("A4: an in-range correctAnswerIndex still resolves to the matching choice (no false positive)", () => {
  const questions = buildQuizAttemptQuestions({
    quiz: quizWithCorrectIndex(2),
    userId: "u1",
    bookId: "bookX",
    chapterNumber: 1,
    attemptNumber: 1,
    preserveAuthoredOrder: true,
  });
  assert.equal(questions[0]!.correctChoiceId, "q1::choice::2");
  assert.equal(questions[0]!.correctIndex, 2);
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
  assert.equal(session.questions[0]!.correctChoiceId, "q1::choice::2");
  assert.equal(session.questions[0]!.selectedChoiceId, "q1::choice::2");
  assert.equal(session.questions[0]!.isCorrect, true);
  assert.equal(session.questions[1]!.selectedChoiceId, "q2::choice::1");
  assert.equal(session.questions[1]!.isCorrect, false);
  // The MISSED question must ALSO carry the key here — this is the field the
  // post-submit spaced-repetition enrolment (ChapterReaderClient) reads to
  // enroll wrong answers. Gating it to non-ready states must not drop it.
  assert.equal(session.questions[1]!.correctChoiceId, "q2::choice::0");
  assert.ok(!("correctIndex" in session.questions[0]!), "passed");
});
