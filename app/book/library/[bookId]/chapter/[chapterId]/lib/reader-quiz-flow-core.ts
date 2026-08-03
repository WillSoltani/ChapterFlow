type QuizResultLike = { passed?: boolean; scorePercent?: number } | null | undefined;
type QuizSessionLike = { provisional?: boolean; result?: QuizResultLike } | null | undefined;

export type QuizSubmissionOutcome = {
  kind: "absent" | "failed" | "passed";
  provisional: boolean;
  scorePercent: number;
  celebrateFreshPass: boolean;
};

export function completionScore(session: QuizSessionLike): number {
  const score = session?.result?.scorePercent;
  return Number.isFinite(score) ? Number(score) : 0;
}

export function classifyQuizSubmission(
  submission: { session?: QuizSessionLike } | null | undefined,
): QuizSubmissionOutcome {
  const session = submission?.session;
  if (!session?.result) {
    return {
      kind: "absent",
      provisional: Boolean(session?.provisional),
      scorePercent: 0,
      celebrateFreshPass: false,
    };
  }
  const passed = session.result.passed === true;
  return {
    kind: passed ? "passed" : "failed",
    provisional: Boolean(session.provisional),
    scorePercent: completionScore(session),
    celebrateFreshPass: passed,
  };
}

export function projectIncorrectQuestionReviews<
  T extends { isCorrect?: boolean | undefined; correctChoiceId?: string | undefined },
>(questions: readonly T[] | null | undefined): T[] {
  return (questions ?? []).filter(
    (question) => question.isCorrect === false && Boolean(question.correctChoiceId),
  );
}

export function shouldEnrollFlashcards(result: QuizResultLike): boolean {
  return result?.passed === true;
}
