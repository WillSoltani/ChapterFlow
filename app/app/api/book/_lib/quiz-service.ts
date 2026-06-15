import { BookApiError } from "./errors";
import type { ChapterQuizPayload } from "./types";

// NOTE: The former `scoreQuizSubmission(quiz, number[])` helper was removed
// (L21). It had zero callers — the live submit path uses
// gradeQuizAttemptQuestions / scoreQuizResponsesByQuestionId — and it silently
// defaulted a missing answer key to index 0, treating choice A as correct.

export function scoreQuizResponsesByQuestionId(
  quiz: ChapterQuizPayload,
  responses: Array<{ questionId: string; selectedIndex: number }>,
  opts?: { questionPool?: ChapterQuizPayload["questions"] }
): {
  total: number;
  correct: number;
  scorePercent: number;
  passed: boolean;
  review: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
  }>;
} {
  if (!Array.isArray(responses) || responses.length === 0) {
    throw new BookApiError(400, "invalid_answers", "responses must include at least one answer.");
  }

  const pool = opts?.questionPool ?? quiz.questions;
  const byId = new Map(pool.map((question) => [question.questionId, question]));
  const seen = new Set<string>();
  const review: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
  }> = [];
  let correct = 0;

  for (const [index, response] of responses.entries()) {
    if (!response || typeof response !== "object") {
      throw new BookApiError(400, "invalid_answers", `responses[${index}] must be an object.`);
    }
    const questionId =
      typeof response.questionId === "string" ? response.questionId.trim() : "";
    const selected = response.selectedIndex;
    if (!questionId) {
      throw new BookApiError(400, "invalid_answers", `responses[${index}].questionId is required.`);
    }
    if (seen.has(questionId)) {
      throw new BookApiError(400, "invalid_answers", `responses contains duplicate questionId ${questionId}.`);
    }
    seen.add(questionId);
    if (
      typeof selected !== "number" ||
      !Number.isFinite(selected) ||
      Math.floor(selected) !== selected
    ) {
      throw new BookApiError(400, "invalid_answers", `responses[${index}].selectedIndex must be an integer.`);
    }
    const question = byId.get(questionId);
    if (!question) {
      throw new BookApiError(400, "invalid_answers", `Unknown questionId ${questionId}.`);
    }
    const choices: string[] = Array.isArray(question.choices)
      ? question.choices
      : Array.isArray(question.options)
        ? question.options
        : [];
    // Fail loudly on a missing answer key rather than treating choice A (index
    // 0) as correct for a content defect — a 500, not a 400, since this is a
    // server-side content problem, not a bad client submission.
    const correctIndex = question.correctAnswerIndex ?? question.correctIndex;
    if (typeof correctIndex !== "number") {
      throw new BookApiError(
        500,
        "quiz_question_missing_answer_key",
        "This quiz is temporarily unavailable. Please try again later.",
        { questionId }
      );
    }
    if (selected < 0 || selected >= choices.length) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}].selectedIndex is out of range for question ${questionId}.`
      );
    }
    const isCorrect = selected === correctIndex;
    if (isCorrect) correct += 1;
    review.push({
      questionId,
      selectedIndex: selected,
      correctIndex,
      isCorrect,
    });
  }

  const total = responses.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = scorePercent >= quiz.passingScorePercent;

  return {
    total,
    correct,
    scorePercent,
    passed,
    review,
  };
}
