import type { ReadingDepth } from "@/app/book/data/bookChapters";

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

export type QuizFeedbackState = "correct" | "incorrect-retry" | "incorrect-final";

/** Per-question grading for the current attempt, stored next to the answer
 *  draft so a tab switch or a refresh doesn't reset retries or checkmarks. */
export type QuizAttemptProgress = {
  feedback: Record<string, QuizFeedbackState>;
  retriesUsed: Record<string, number>;
  disabledChoices: Record<string, string[]>;
  correctByQuestion: Record<string, string>;
  /** On a retry-incorrect-only retake, the questions shown (last attempt's misses). */
  retakeQuestionIds: string[];
};

export type QuizDraft = {
  attemptNumber: number;
  answers: Record<string, string>;
  progress: QuizAttemptProgress;
};

export function emptyQuizProgress(): QuizAttemptProgress {
  return { feedback: {}, retriesUsed: {}, disabledChoices: {}, correctByQuestion: {}, retakeQuestionIds: [] };
}

const FEEDBACK_STATES = new Set<string>(["correct", "incorrect-retry", "incorrect-final"]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickEntries<T>(value: unknown, keep: (entry: unknown) => T | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, entry] of Object.entries(asRecord(value))) {
    const kept = keep(entry);
    if (kept !== undefined) out[key] = kept;
  }
  return out;
}

const nonEmptyString = (entry: unknown) => (typeof entry === "string" && entry ? entry : undefined);
const stringList = (entry: unknown) =>
  Array.isArray(entry) ? entry.filter((item): item is string => typeof item === "string") : undefined;

function sanitizeProgress(value: unknown): QuizAttemptProgress {
  const raw = asRecord(value);
  return {
    feedback: pickEntries(raw.feedback, (entry) =>
      typeof entry === "string" && FEEDBACK_STATES.has(entry) ? (entry as QuizFeedbackState) : undefined
    ),
    retriesUsed: pickEntries(raw.retriesUsed, (entry) =>
      typeof entry === "number" && Number.isFinite(entry) && entry >= 0 ? entry : undefined
    ),
    disabledChoices: pickEntries(raw.disabledChoices, stringList),
    correctByQuestion: pickEntries(raw.correctByQuestion, nonEmptyString),
    retakeQuestionIds: stringList(raw.retakeQuestionIds) ?? [],
  };
}

/** The saved answers and grading for `attemptNumber`; empty for any other attempt. */
export function readQuizDraft(
  raw: unknown,
  attemptNumber: number,
): { answers: Record<string, string>; progress: QuizAttemptProgress } {
  const draft = asRecord(raw);
  if (draft.attemptNumber !== attemptNumber) return { answers: {}, progress: emptyQuizProgress() };
  return { answers: pickEntries(draft.answers, nonEmptyString), progress: sanitizeProgress(draft.progress) };
}

/** Update one half of the draft for `attemptNumber`, keeping the other half. */
export function mergeQuizDraft(
  raw: unknown,
  attemptNumber: number,
  patch: { answers?: Record<string, string>; progress?: QuizAttemptProgress },
): QuizDraft {
  const current = readQuizDraft(raw, attemptNumber);
  return {
    attemptNumber,
    answers: patch.answers ?? current.answers,
    progress: patch.progress ?? current.progress,
  };
}

/** A retake is only real for a graded attempt that did not pass: the server
 *  keeps a passed quiz passed and never issues a new attempt for it. */
export function canRetakeFromReview(session: QuizSessionLike): boolean {
  return Boolean(session?.result) && session?.result?.passed !== true;
}

/** An attempt the reader has started answering and not yet submitted. Used to
 *  confirm before a learning-mode switch throws those answers away. */
export function isQuizAttemptInProgress(
  session: { result?: unknown } | null | undefined,
  answers: Record<string, string>,
): boolean {
  return Boolean(session) && !session?.result && Object.values(answers).some(Boolean);
}

/** Submit errors after which the quiz must be re-fetched: a cooldown, or a
 *  question set that no longer matches the server's (a mode switch mid-quiz). */
export function shouldReloadQuizAfterSubmitError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return code === "attempt_cooldown" || code === "invalid_answers";
}

// READER-12: a learning-mode change made on the Quiz tab. The quiz keeps the
// depth it shows until the preferences save carrying the new mode has landed
// on the server, so the reloaded quiz and the server agree on the question
// set. "landed" is that save's success (the settings cache is invalidated);
// the save status alone is not enough, because "saving" and "saved" can
// arrive in one render. A save already in flight when the change is made is
// not this change's save, so the change waits for it to end first.
export type PreferencesSaveStatusLike = "idle" | "saving" | "saved" | "error";
export type QuizDepthHoldSignal = PreferencesSaveStatusLike | "landed";

export type QuizDepthHold = {
  depth: ReadingDepth;
  phase: "await-idle" | "await-save" | "saving";
} | null;

export function startQuizDepthHold(
  current: QuizDepthHold,
  quizDepth: ReadingDepth,
  status: PreferencesSaveStatusLike,
): { hold: QuizDepthHold; applyNow: boolean } {
  const depth = current?.depth ?? quizDepth;
  return status === "saving"
    ? { hold: { depth, phase: "await-idle" }, applyNow: false }
    : { hold: { depth, phase: "await-save" }, applyNow: true };
}

/** One step per signal. Returns the same `hold` object when nothing changes.
 *  `apply`: apply the deferred change now. `failed`: this change's save failed
 *  (the hold stays until a retry lands). */
export function advanceQuizDepthHold(
  hold: QuizDepthHold,
  signal: QuizDepthHoldSignal,
): { hold: QuizDepthHold; apply: boolean; failed: boolean } {
  const same = { hold, apply: false, failed: false };
  if (!hold) return same;
  if (hold.phase === "await-idle") {
    return signal === "saving" || signal === "landed"
      ? same
      : { hold: { depth: hold.depth, phase: "await-save" }, apply: true, failed: false };
  }
  if (signal === "landed") return { hold: null, apply: false, failed: false };
  if (signal === "saving" && hold.phase === "await-save") {
    return { hold: { depth: hold.depth, phase: "saving" }, apply: false, failed: false };
  }
  if (signal === "error" && hold.phase === "saving") {
    return { hold: { depth: hold.depth, phase: "await-save" }, apply: false, failed: true };
  }
  return same;
}
