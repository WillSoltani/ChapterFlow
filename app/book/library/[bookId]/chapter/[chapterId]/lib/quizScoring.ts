import type { QuizSessionView } from "../hooks/useQuizSession";

/**
 * Pure, framework-free quiz scoring + retake helpers.
 *
 * These were extracted from `useQuizSession` so the score-on-retake invariant
 * can be unit-tested without a DOM (the project's test runner is `node:test`
 * via `tsx`, with no testing-library / renderHook). The hook calls into these
 * so the test guards the exact code path that ships.
 */

/**
 * Build the carry-forward answer seed from a graded session: the user's
 * selected choice for every question they already answered correctly.
 *
 * Why this exists: with `retryIncorrectOnly` (the default) a retake only shows
 * the previously-missed questions, so the user never re-answers the ones they
 * already got right. Without carrying those answers forward they would submit
 * as `null` — which the server rejects (400) and local scoring counts as wrong
 * — so a user who FIXES their mistakes would watch their score DROP. Seeding the
 * answer map with the prior correct selections keeps the submitted answer set
 * complete and correct.
 */
export function buildCarryForwardAnswers(
  session: Pick<QuizSessionView, "questions">,
): Record<string, string> {
  const seed: Record<string, string> = {};
  for (const question of session.questions) {
    if (question.isCorrect && question.selectedChoiceId) {
      seed[question.questionId] = question.selectedChoiceId;
    }
  }
  return seed;
}

/**
 * Score an answer map against a session's questions locally. Used as the
 * provisional fallback when the submit API is unreachable; mirrors the server's
 * grading (a question is correct iff its answer matches `correctChoiceId`).
 * Returns `null` when there are no questions to score.
 */
export function scoreSessionLocally(
  session: QuizSessionView,
  answers: Record<string, string>,
  now: () => string = () => new Date().toISOString(),
): QuizSessionView | null {
  let correct = 0;
  const scoredQuestions = session.questions.map((question) => {
    const selectedId = answers[question.questionId] ?? null;
    const isCorrect = selectedId === question.correctChoiceId;
    if (isCorrect) correct += 1;
    return { ...question, selectedChoiceId: selectedId, isCorrect };
  });
  if (scoredQuestions.length === 0) return null;
  const scorePercent = Math.round((correct / scoredQuestions.length) * 100);
  const passed = scorePercent >= session.passingScorePercent;
  return {
    ...session,
    status: passed ? "passed" : "ready",
    questions: scoredQuestions,
    result: {
      attemptNumber: session.attemptNumber,
      scorePercent,
      correctAnswers: correct,
      totalQuestions: scoredQuestions.length,
      passed,
      submittedAt: now(),
    },
  };
}
