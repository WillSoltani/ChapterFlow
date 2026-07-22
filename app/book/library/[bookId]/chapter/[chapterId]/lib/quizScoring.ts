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
 * A server `/check` verdict captured while the reader was answering a question,
 * keyed by questionId. After H3 (SEC-QUIZ-LEAK) the GET quiz payload no longer
 * ships `correctChoiceId` for a "ready" attempt, so offline provisional scoring
 * can't compare against a key — it uses these captured verdicts instead.
 *
 * `correctChoiceId` is present ONLY when the client already legitimately knows
 * the correct choice (the user picked it, or an offline local-bundle grade
 * supplied it). The server `/check` endpoint NEVER returns the key.
 */
export type CheckedAnswerResult = {
  /** The choice this verdict was computed for. Offline scoring ignores a stale
   *  verdict whose choice no longer matches the user's committed answer. */
  selectedChoiceId: string;
  isCorrect: boolean;
  correctChoiceId?: string | undefined;
};

export type CheckedResults = Record<string, CheckedAnswerResult>;

/** Classify a choiceId by its scheme: the server uses `${qid}::choice::${n}` and
 *  the offline local bundle uses `${qid}-choice-${n}`. Carrying an answer from one
 *  scheme into a session of the other yields an id that never matches a choice. */
function choiceIdScheme(choiceId: string | undefined): "server" | "local" | "unknown" {
  if (!choiceId) return "unknown";
  if (choiceId.includes("::choice::")) return "server";
  if (/-choice-\d+$/.test(choiceId)) return "local";
  return "unknown";
}

/**
 * Build the carry-forward answer seed for a retake: for every question the user
 * already answered correctly in `graded`, seed the correct choice of the SAME
 * question in `target` (the session that will actually be displayed/submitted).
 *
 * Why this exists: with `retryIncorrectOnly` (the default) a retake only shows
 * the previously-missed questions, so the user never re-answers the ones they
 * already got right. Without carrying those answers forward they would submit
 * as `null` — which the server rejects (400) and local scoring counts as wrong
 * — so a user who FIXES their mistakes would watch their score DROP.
 *
 * Critically, the seed is keyed to `target`'s choiceId scheme, NOT the prior
 * session's. The server and the local fallback use different choiceId schemes
 * (`qId::choice::N` vs `qId-choice-N`); carrying the prior session's raw
 * choiceId across that boundary would seed ids that don't match the displayed
 * session's correctChoiceId, re-introducing the score drop. Because a carried
 * question is one the user got right, its carried answer is simply the correct
 * choice, which we prefer to read from `target.correctChoiceId` (always in the
 * right scheme).
 *
 * After H3 a server "ready" `target` no longer ships `correctChoiceId`. In that
 * case `graded` and `target` are both server sessions in the SAME scheme, so the
 * user's prior correct selection (`graded.selectedChoiceId` for that question)
 * is a valid carry and we fall back to it. The offline local-bundle `target`
 * still carries its own key, so the preferred branch keeps it scheme-correct.
 */
export function buildCarryForwardAnswers(
  graded: Pick<QuizSessionView, "questions">,
  target: Pick<QuizSessionView, "questions">,
): Record<string, string> {
  // For each previously-correct question, the user's own (correct) selection —
  // in the prior session's scheme. Used only as the scheme-compatible fallback
  // when `target` doesn't ship a key (see below).
  const correctSelectionByQuestion = new Map<string, string>();
  for (const q of graded.questions) {
    if (q.isCorrect && q.selectedChoiceId) {
      correctSelectionByQuestion.set(q.questionId, q.selectedChoiceId);
    }
  }
  const seed: Record<string, string> = {};
  for (const question of target.questions) {
    const priorSelection = correctSelectionByQuestion.get(question.questionId);
    if (priorSelection === undefined) continue;
    if (question.correctChoiceId) {
      // Target ships its own key (offline local bundle) — always in target scheme.
      seed[question.questionId] = question.correctChoiceId;
      continue;
    }
    // Post-H3 server "ready" target ships no key. Carry the user's prior correct
    // selection ONLY when it is already in the target's choiceId scheme. Carrying
    // a foreign-scheme id (e.g. a local `-choice-` answer onto a server
    // `::choice::` session) would seed an id the server rejects as invalid and
    // local scoring counts wrong — re-introducing the score-drop regression.
    const targetScheme = choiceIdScheme(question.choices?.[0]?.choiceId);
    if (targetScheme !== "unknown" && choiceIdScheme(priorSelection) === targetScheme) {
      seed[question.questionId] = priorSelection;
    }
  }
  return seed;
}

/**
 * Score an answer map against a session's questions locally. Used as the
 * provisional fallback when the submit API is unreachable (RF-4 D5:
 * celebrate-then-reconcile — show an optimistic result now, let the
 * authoritative /submit reconcile on reconnect). Returns `null` when there are
 * no questions to score.
 *
 * A question is correct iff: a captured server `/check` verdict says so
 * (preferred — the canonical answer is no longer shipped for "ready" sessions
 * after H3), else its answer matches the session's own `correctChoiceId` (the
 * offline local bundle still carries the key). With neither signal the answer
 * can't be verified and is counted wrong; /submit fixes the real score later.
 */
export function scoreSessionLocally(
  session: QuizSessionView,
  answers: Record<string, string>,
  checkedResults: CheckedResults = {},
  now: () => string = () => new Date().toISOString(),
): QuizSessionView | null {
  let correct = 0;
  const scoredQuestions = session.questions.map((question) => {
    const selectedId = answers[question.questionId] ?? null;
    const checked = checkedResults[question.questionId];
    // Only trust a captured verdict that was computed for the SAME choice the
    // user has committed; otherwise it's stale (e.g. carried over from a prior
    // attempt) and we fall back to the session's own key.
    const checkedMatches =
      checked != null && selectedId != null && checked.selectedChoiceId === selectedId;
    const isCorrect = checkedMatches
      ? checked.isCorrect
      : question.correctChoiceId != null && selectedId === question.correctChoiceId;
    if (isCorrect) correct += 1;
    // Resolve the correct key for the review screen / spaced-repetition enrolment:
    // the session's own key if present, else a matching captured reveal, else
    // (for a correct answer) the user's own selection. Stays undefined for a
    // wrong answer with no known key — that question simply isn't enrolled
    // offline; /submit enrols it with the real key on reconnect.
    const correctChoiceId =
      question.correctChoiceId ??
      (checkedMatches ? checked.correctChoiceId : undefined) ??
      (isCorrect ? selectedId ?? undefined : undefined);
    return { ...question, selectedChoiceId: selectedId, isCorrect, correctChoiceId };
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
