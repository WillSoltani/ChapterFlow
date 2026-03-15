import { BookApiError } from "./errors";
import type { ChapterQuizPayload } from "./types";

export function scoreQuizSubmission(
  quiz: ChapterQuizPayload,
  answers: number[]
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
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new BookApiError(
      400,
      "invalid_answers",
      `answers must include exactly ${quiz.questions.length} entries.`
    );
  }

  const review: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
  }> = [];
  let correct = 0;

  for (let i = 0; i < quiz.questions.length; i += 1) {
    const question = quiz.questions[i];
    const selected = answers[i];
    if (
      typeof selected !== "number" ||
      !Number.isFinite(selected) ||
      Math.floor(selected) !== selected ||
      selected < 0 ||
      selected >= question.choices.length
    ) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `answers[${i}] is out of range for question ${question.questionId}.`
      );
    }
    const isCorrect = selected === question.correctAnswerIndex;
    if (isCorrect) correct += 1;
    review.push({
      questionId: question.questionId,
      selectedIndex: selected,
      correctIndex: question.correctAnswerIndex,
      isCorrect,
    });
  }

  const total = quiz.questions.length;
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
    if (selected < 0 || selected >= question.choices.length) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}].selectedIndex is out of range for question ${questionId}.`
      );
    }
    const isCorrect = selected === question.correctAnswerIndex;
    if (isCorrect) correct += 1;
    review.push({
      questionId,
      selectedIndex: selected,
      correctIndex: question.correctAnswerIndex,
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
