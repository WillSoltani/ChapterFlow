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

/** Session questions with no recorded answer. A wrong pick that still has
 *  retries left is never recorded, so a question skipped in that state counts. */
export function unansweredQuestionIds(
  questions: ReadonlyArray<{ questionId: string }>,
  answers: Record<string, string>,
): string[] {
  return questions.filter((question) => !answers[question.questionId]).map((question) => question.questionId);
}

const QUIZ_SUBMIT_ERROR_COPY: Record<string, string> = {
  invalid_answers: "Some answers didn't come through. Check every question is answered, then try again.",
  quiz_session_stale: "This quiz changed since you opened it. Reload the page to get the latest version.",
};

/** Reader-facing copy for a failed submit; server validator text is never shown raw. */
export function quizSubmitErrorMessage(error: unknown): string {
  const { code, message } = (typeof error === "object" && error !== null ? error : {}) as {
    code?: unknown;
    message?: unknown;
  };
  if (typeof code === "string" && QUIZ_SUBMIT_ERROR_COPY[code]) return QUIZ_SUBMIT_ERROR_COPY[code];
  return typeof message === "string" && message ? message : "Unable to submit quiz right now.";
}

/** Synchronous single-flight guard (a ref, not React state, so a second tap in
 *  the same frame sees it). */
export function createInFlightGuard() {
  let busy = false;
  return {
    tryEnter(): boolean {
      if (busy) return false;
      busy = true;
      return true;
    },
    exit(): void {
      busy = false;
    },
  };
}

/** A `quiz_session_stale` 409 for an attempt this reader already submitted
 *  successfully is a late duplicate, not an error worth showing. */
export function isStaleAfterRecordedSubmit(
  error: unknown,
  attemptNumber: number,
  lastRecordedAttempt: number | null,
): boolean {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return code === "quiz_session_stale" && lastRecordedAttempt != null && attemptNumber === lastRecordedAttempt;
}
