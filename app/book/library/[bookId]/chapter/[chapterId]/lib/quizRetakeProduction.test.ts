import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildQuizSubmitResponses, planRetakeCarry } from "./quizScoring";
import { shouldUseLocalFallback } from "./fallbackPolicy";
import type { QuizQuestionView, QuizSessionView } from "../hooks/useQuizSession";

// Production path (IS_DEV === false). In production the hook has no local quiz
// session, so a retake is whatever the server GET returns: a fresh "ready"
// attempt with every selectedChoiceId null and no answer key. These tests guard
// that a retake on that path can still be submitted.

const IS_DEV = false;

const serverChoiceId = (questionId: string, index: number) => `${questionId}::choice::${index}`;

function serverQuestion(questionId: string, graded?: { selected: number; correct: number }): QuizQuestionView {
  return {
    questionId,
    prompt: `Prompt ${questionId}`,
    choices: [0, 1, 2, 3].map((index) => ({ choiceId: serverChoiceId(questionId, index), text: `Choice ${index}` })),
    selectedChoiceId: graded ? serverChoiceId(questionId, graded.selected) : null,
    correctChoiceId: graded ? serverChoiceId(questionId, graded.correct) : undefined,
    isCorrect: graded ? graded.selected === graded.correct : undefined,
  };
}

function baseSession(overrides: Partial<QuizSessionView>): QuizSessionView {
  return {
    chapterId: "book:1",
    chapterNumber: 1,
    title: "Chapter 1",
    passingScorePercent: 80,
    status: "ready",
    attemptNumber: 1,
    nextAttemptNumber: 2,
    attemptsCount: 1,
    failureStreak: 1,
    cooldownSeconds: 0,
    nextAttemptAvailableAt: null,
    highestScorePercent: 60,
    unlockedNextChapter: false,
    questions: [],
    result: null,
    history: [],
    ...overrides,
  };
}

/** The /submit response for a failed first attempt: q1, q3, q5 right; q2, q4 wrong. */
function failedAttempt(): QuizSessionView {
  return baseSession({
    attemptNumber: 1,
    questions: [
      serverQuestion("q1", { selected: 0, correct: 0 }),
      serverQuestion("q2", { selected: 1, correct: 2 }),
      serverQuestion("q3", { selected: 3, correct: 3 }),
      serverQuestion("q4", { selected: 0, correct: 1 }),
      serverQuestion("q5", { selected: 2, correct: 2 }),
    ],
    result: {
      attemptNumber: 1,
      scorePercent: 60,
      correctAnswers: 3,
      totalQuestions: 5,
      passed: false,
      submittedAt: "2026-11-12T00:00:00.000Z",
    },
  });
}

/** What the server GET returns once the retake is allowed: attempt 2, no answers, no key. */
function serverRetakeSession(): QuizSessionView {
  return baseSession({
    attemptNumber: 2,
    nextAttemptNumber: 2,
    questions: ["q1", "q2", "q3", "q4", "q5"].map((id) => serverQuestion(id)),
    result: null,
  });
}

test("production never builds a local quiz session, so a retake uses the server session", () => {
  assert.equal(shouldUseLocalFallback(IS_DEV, null), false);
});

test("READER-01: a production retake answering only the missed questions submits an answer for every question", () => {
  const graded = failedAttempt();
  const server = serverRetakeSession();

  const carry = planRetakeCarry({ graded, next: server, retryIncorrectOnly: true });
  // The reader only sees q2 and q4 on the retake and answers them.
  const answers = { ...carry, q2: serverChoiceId("q2", 2), q4: serverChoiceId("q4", 1) };
  const responses = buildQuizSubmitResponses(server.questions, answers);

  assert.equal(responses.length, 5);
  for (const response of responses) {
    assert.ok(response.selectedChoiceId, `${response.questionId} must carry a selectedChoiceId`);
  }
  assert.equal(responses.find((r) => r.questionId === "q1")?.selectedChoiceId, serverChoiceId("q1", 0));
});

test("planRetakeCarry carries nothing on a full retake, or when the next session is not a fresh attempt", () => {
  const graded = failedAttempt();
  assert.deepEqual(planRetakeCarry({ graded, next: serverRetakeSession(), retryIncorrectOnly: false }), {});
  assert.deepEqual(planRetakeCarry({ graded, next: graded, retryIncorrectOnly: true }), {});
  assert.deepEqual(planRetakeCarry({ graded: null, next: serverRetakeSession(), retryIncorrectOnly: true }), {});
  assert.deepEqual(planRetakeCarry({ graded, next: null, retryIncorrectOnly: true }), {});
});

test("buildQuizSubmitResponses sends null for an unanswered question (the server rejects it)", () => {
  const responses = buildQuizSubmitResponses(serverRetakeSession().questions, {});
  assert.ok(responses.every((r) => r.selectedChoiceId === null));
});

test("useQuizSession.retry() seats the carry on the session load() returns, outside the dev-only branch", () => {
  const source = readFileSync(new URL("../hooks/useQuizSession.ts", import.meta.url), "utf8");
  const retryBody = source.slice(source.indexOf("const retry = useCallback"), source.indexOf("const toggleExplanation"));
  const devBranchEnd = retryBody.lastIndexOf("return fresh;");
  const tail = retryBody.slice(devBranchEnd);
  assert.match(tail, /await load\(\)/, "production retry must await the server session");
  assert.match(tail, /planRetakeCarry\(/, "production retry must carry forward previously-correct answers");
  assert.match(source, /responses: buildQuizSubmitResponses\(/, "submit must build responses through the tested helper");
});

test("READER-07: submit() and the results button refuse a quiz with an unanswered question", () => {
  const hook = readFileSync(new URL("../hooks/useQuizSession.ts", import.meta.url), "utf8");
  const submitBody = hook.slice(hook.indexOf("const submit = useCallback"), hook.indexOf("fetchBookJson<QuizSubmitResponse>"));
  assert.match(submitBody, /unansweredQuestionIds\(session\.questions, answers\)\.length > 0/);
  const panel = readFileSync(new URL("../components/QuizPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /unansweredQuestionIds\(session\.questions, answers\)/);
  assert.doesNotMatch(panel, /\{isLast && resolved && \(\s*<div[^>]*>\s*<button type="button" onClick=\{onSeeResults\}/);
});
