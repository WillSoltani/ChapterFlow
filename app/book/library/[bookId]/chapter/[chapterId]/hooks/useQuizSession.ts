"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { ToneKey } from "@/app/book/data/bookPackages";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import type { LoopPipelineResult } from "@/app/book/_lib/flow-points-economy";
import { buildCarryForwardAnswers, scoreSessionLocally, type CheckedResults } from "../lib/quizScoring";

type QuizSubmitResponse = {
  quiz: QuizSessionView;
  progress?: { currentChapterNumber: number };
  loopPipeline?: LoopPipelineResult;
};

export type QuizChoiceView = {
  choiceId: string;
  text: string;
};

export type QuizQuestionView = {
  questionId: string;
  prompt: string;
  choices: QuizChoiceView[];
  explanation?: string;
  selectedChoiceId?: string | null;
  correctChoiceId?: string;
  correctIndex?: number;
  isCorrect?: boolean;
};

export type QuizAttemptSummaryView = {
  attemptNumber: number;
  scorePercent: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  submittedAt: string;
};

export type QuizSessionView = {
  chapterId: string;
  chapterNumber: number;
  title: string;
  passingScorePercent: number;
  status: "ready" | "cooldown" | "passed";
  attemptNumber: number;
  nextAttemptNumber: number | null;
  attemptsCount: number;
  failureStreak: number;
  cooldownSeconds: number;
  nextAttemptAvailableAt: string | null;
  highestScorePercent: number;
  unlockedNextChapter: boolean;
  latestAttemptAt?: string;
  questions: QuizQuestionView[];
  result: QuizAttemptSummaryView | null;
  history: QuizAttemptSummaryView[];
  /** True when scored locally because the API was unreachable */
  provisional?: boolean;
};

/** Shape of the bundled local quiz data passed for the offline/dev fallback. */
export type LocalQuizData = {
  chapterId: string;
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  passingScorePercent: number;
};

/** Build a fully-offline quiz session from the bundled local quiz, or `null` when
 *  there is no USABLE local quiz. A local quiz with ZERO questions is treated the
 *  same as no quiz at all: on the API (prod) content path the chapter adapter
 *  ships an EMPTY quiz (`{ questions: [] }`) because the real quiz is fetched
 *  separately — so a failed quiz fetch must fall through to a RETRYABLE error,
 *  not a 0-question "ready" session the reader renders as the terminal
 *  "No quiz questions available for this chapter." (RF-1) */
export function buildLocalQuizSession(
  quiz: LocalQuizData | undefined,
  chapterNumber: number
): QuizSessionView | null {
  if (!quiz || quiz.questions.length === 0) return null;
  return {
    chapterId: quiz.chapterId,
    chapterNumber,
    title: "",
    passingScorePercent: quiz.passingScorePercent,
    status: "ready",
    attemptNumber: 1,
    nextAttemptNumber: null,
    attemptsCount: 0,
    failureStreak: 0,
    cooldownSeconds: 0,
    nextAttemptAvailableAt: null,
    highestScorePercent: 0,
    unlockedNextChapter: false,
    questions: quiz.questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      choices: q.options.map((opt, idx) => ({
        choiceId: `${q.id}-choice-${idx}`,
        text: opt.replace(/^[A-Z]\)\s*/, ""),
      })),
      explanation: q.explanation,
      correctChoiceId: `${q.id}-choice-${q.correctIndex}`,
      correctIndex: q.correctIndex,
    })),
    result: null,
    history: [],
  };
}

function remainingCooldown(nextAttemptAvailableAt: string | null): number {
  if (!nextAttemptAvailableAt) return 0;
  const deltaMs = new Date(nextAttemptAvailableAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(deltaMs / 1000));
}

/** Extract the trailing canonical choice index from a server (`::choice::N`) or
 *  local (`-choice-N`) choiceId — used to resolve the offline answer key from
 *  the local quiz bundle when the server `/check` is unreachable. */
function trailingChoiceIndex(choiceId: string): number | null {
  const match = /(?:::choice::|-choice-)(\d+)$/.exec(choiceId);
  return match ? Number(match[1]) : null;
}

/** Build a captured-verdict map for carried-forward (previously-correct) answers
 *  on a retake, so an offline provisional score counts them correct without a
 *  re-grade. Keyed by questionId; the carried choice is recorded as the one
 *  graded so the verdict matches the committed answer. */
function seedCheckedFromCarry(carry: Record<string, string>): CheckedResults {
  const seeded: CheckedResults = {};
  for (const [questionId, choiceId] of Object.entries(carry)) {
    seeded[questionId] = { selectedChoiceId: choiceId, isCorrect: true, correctChoiceId: choiceId };
  }
  return seeded;
}

function draftAnswersKey(bookId: string, chapterNumber: number, difficulty: ReadingDepth): string {
  return `quiz-draft:${bookId}:${chapterNumber}:${difficulty}`;
}

function saveDraftAnswers(
  bookId: string,
  chapterNumber: number,
  difficulty: ReadingDepth,
  attemptNumber: number,
  answers: Record<string, string>
): void {
  try {
    window.localStorage.setItem(
      draftAnswersKey(bookId, chapterNumber, difficulty),
      JSON.stringify({ attemptNumber, answers })
    );
  } catch { /* ignore quota errors */ }
}

function loadDraftAnswers(
  bookId: string,
  chapterNumber: number,
  difficulty: ReadingDepth,
  attemptNumber: number
): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(draftAnswersKey(bookId, chapterNumber, difficulty));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed.attemptNumber !== attemptNumber) return {};
    return parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {};
  } catch {
    return {};
  }
}

function clearDraftAnswers(bookId: string, chapterNumber: number, difficulty: ReadingDepth): void {
  try {
    window.localStorage.removeItem(draftAnswersKey(bookId, chapterNumber, difficulty));
  } catch { /* ignore */ }
}

export function useQuizSession(params: {
  bookId: string;
  chapterNumber: number;
  difficulty: ReadingDepth;
  contentTone: ToneKey;
  enabled: boolean;
  /** Local quiz data from bookChapters for offline/dev fallback */
  localQuiz?: LocalQuizData;
  /** Whether the retake only re-shows previously-missed questions (the default).
   *  Only in this mode are previously-correct answers hidden and thus carried
   *  forward; a full retake re-asks everything and must start from a clean map. */
  retryIncorrectOnly?: boolean;
}) {
  const { bookId, chapterNumber, difficulty, contentTone, enabled, localQuiz, retryIncorrectOnly = false } = params;
  const localQuizRef = useRef(localQuiz);
  useEffect(() => {
    localQuizRef.current = localQuiz;
  });
  const [session, setSession] = useState<QuizSessionView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [explanationOpen, setExplanationOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [lastLoopPipeline, setLastLoopPipeline] = useState<LoopPipelineResult | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const trackedExplanationIds = useRef<Set<string>>(new Set());
  // Server /check verdicts captured while the user answers, keyed by questionId
  // (the verdict records the exact choice it graded). Lets an offline provisional
  // score (submit unreachable) grade WITHOUT the answer key — which the GET
  // payload no longer ships for a "ready" attempt (H3 / SEC-QUIZ-LEAK).
  const checkedResultsRef = useRef<CheckedResults>({});
  // Per-invocation request token. Each load() captures the current value and
  // only writes its response into state if the token still matches — so an
  // in-flight load() for a previous chapter/difficulty (or one that resolves
  // after unmount) can't clobber the current session. Mirrors the mounted-flag
  // guard in the sibling useChapterContent/useBookViewer hooks.
  const loadTokenRef = useRef(0);

  const syncFromSession = useCallback((nextSession: QuizSessionView | null) => {
    if (!nextSession) {
      setAnswers({});
      setExplanationOpen({});
      setCooldownSeconds(0);
      startedAtRef.current = null;
      return;
    }

    setCooldownSeconds(remainingCooldown(nextSession.nextAttemptAvailableAt));

    // Restore server-known answers first, then merge any locally saved drafts
    const serverAnswers = Object.fromEntries(
      nextSession.questions
        .map((question) => [question.questionId, question.selectedChoiceId ?? ""])
        .filter((entry) => entry[1])
    );
    if (!nextSession.result) {
      const draft = loadDraftAnswers(
        bookId,
        chapterNumber,
        difficulty,
        nextSession.attemptNumber
      );
      setAnswers({ ...draft, ...serverAnswers });
    } else {
      clearDraftAnswers(bookId, chapterNumber, difficulty);
      setAnswers(serverAnswers);
    }

    setExplanationOpen({});
    trackedExplanationIds.current = new Set();
    startedAtRef.current = nextSession.result ? null : Date.now();
  }, [bookId, chapterNumber, difficulty]);

  // Returns null when there is no usable local quiz — including a present-but-EMPTY
  // one (the API content path ships `{ questions: [] }` because the quiz loads
  // separately). That null makes the load() catch and retry() below fall through
  // to the retryable error state instead of a terminal 0-question session. (RF-1)
  const buildLocalSession = useCallback(
    (): QuizSessionView | null => buildLocalQuizSession(localQuizRef.current, chapterNumber),
    [chapterNumber]
  );

  const load = useCallback(async () => {
    if (!enabled) return null;
    const token = loadTokenRef.current;
    const isStale = () => token !== loadTokenRef.current;
    // Fall back to the local bundle when the server quiz is unusable — either the
    // fetch failed (catch) OR a 200 returned a question-less payload (PAR-3).
    // buildLocalSession() returns null for a missing/empty local quiz (RF-1), so
    // those surface a RETRYABLE error rather than the terminal 0-question
    // "No quiz questions available for this chapter." session.
    const fallbackToLocalOrError = (cause?: unknown): QuizSessionView | null => {
      const local = buildLocalSession();
      if (local) {
        setSession(local);
        syncFromSession(local);
        setError(null);
        return local;
      }
      setError(cause instanceof Error ? cause.message : "Unable to load quiz right now.");
      return null;
    };
    setLoading(true);
    try {
      const payload = await fetchBookJson<{
        quiz: QuizSessionView;
      }>(
        `/app/api/book/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/quiz?difficulty=${encodeURIComponent(difficulty)}&tone=${encodeURIComponent(contentTone)}`
      );
      // Ignore a response that resolved after the chapter/difficulty changed or
      // the hook unmounted — otherwise the prior chapter's quiz overwrites the
      // current one (and submits against the wrong attempt).
      if (isStale()) return null;
      // A 200 with a question-less quiz is as unusable as a failed fetch: the
      // quiz loads from a SEPARATE endpoint, so a question-less payload here is a
      // malformed/partial response, not a legitimately quiz-less chapter (passing
      // a quiz is the sole chapter-completion gate). Route it through the same
      // fallback rather than rendering the terminal "No quiz questions" dead-end.
      // (PAR-3)
      if (!payload.quiz || payload.quiz.questions.length === 0) {
        return fallbackToLocalOrError();
      }
      setSession(payload.quiz);
      syncFromSession(payload.quiz);
      setError(null);
      return payload.quiz;
    } catch (loadError: unknown) {
      if (isStale()) return null;
      // Fall back to local quiz data if API fails
      return fallbackToLocalOrError(loadError);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [bookId, chapterNumber, difficulty, contentTone, enabled, syncFromSession, buildLocalSession]);

  // Clear stale state immediately when the chapter (or difficulty) changes.
  // Without this, navigating from one chapter to another shows the previous
  // chapter's quiz for one render until `load()` resolves, which can briefly
  // flash a "passed"/"failed" results screen for the wrong chapter.
  useEffect(() => {
    // Invalidate any in-flight load() for the previous chapter/difficulty so it
    // can't write its (now stale) response after we've reset state. The load()
    // effect below runs after this one and captures the incremented token.
    loadTokenRef.current += 1;
    setSession(null);
    setAnswers({});
    setExplanationOpen({});
    setError(null);
    setCooldownSeconds(0);
    setLastLoopPipeline(null);
    startedAtRef.current = null;
    trackedExplanationIds.current = new Set();
    checkedResultsRef.current = {};
  }, [bookId, chapterNumber, difficulty, contentTone]);

  // Invalidate any in-flight load() on unmount so it can't setState afterward.
  useEffect(() => () => {
    loadTokenRef.current += 1;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!session?.nextAttemptAvailableAt) {
      setCooldownSeconds(0);
      return;
    }
    setCooldownSeconds(remainingCooldown(session.nextAttemptAvailableAt));
    const interval = window.setInterval(() => {
      const nextSeconds = remainingCooldown(session.nextAttemptAvailableAt);
      setCooldownSeconds(nextSeconds);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session?.nextAttemptAvailableAt]);

  const canSubmit = useMemo(() => {
    if (!session || session.result || submitting || cooldownSeconds > 0) return false;
    return session.questions.every((question) => Boolean(answers[question.questionId]));
  }, [answers, cooldownSeconds, session, submitting]);

  const answerQuestion = useCallback(
    (questionId: string, choiceId: string) => {
      if (!session || session.result) return;
      setAnswers((current) => {
        const next = { ...current, [questionId]: choiceId };
        saveDraftAnswers(bookId, chapterNumber, difficulty, session.attemptNumber, next);
        return next;
      });
    },
    [bookId, chapterNumber, difficulty, session]
  );

  // Resolve a question's correct choiceId from the offline local quiz bundle, in
  // the CURRENT session's choiceId scheme, by matching canonical index. Used only
  // when /check is unreachable AND the session itself has no key (a server "ready"
  // session post-H3). The local-fallback session built by buildLocalSession
  // already carries its own key, so this is the rarer server-then-offline path.
  const resolveLocalCorrectChoiceId = useCallback(
    (questionId: string, sessionChoices: ReadonlyArray<{ choiceId: string }>): string | undefined => {
      const bundle = localQuizRef.current?.questions.find((q) => q.id === questionId);
      if (!bundle) return undefined;
      const match = sessionChoices.find(
        (choice) => trailingChoiceIndex(choice.choiceId) === bundle.correctIndex
      );
      return match?.choiceId;
    },
    []
  );

  // Grade a single in-progress answer via the server, which returns ONLY
  // correctness — never the answer key (H3 / SEC-QUIZ-LEAK). The inline quiz UX
  // (QuizPanel) calls this instead of comparing against a shipped key. The
  // captured verdict also feeds offline provisional scoring. Falls back to a
  // local-key grade when the endpoint is unreachable so the inline UX and the
  // dev/offline local-bundle path keep working.
  const checkAnswer = useCallback(
    async (questionId: string, choiceId: string): Promise<{ isCorrect: boolean }> => {
      const current = session;
      const sessionQuestion = current?.questions.find((q) => q.questionId === questionId);
      const record = (isCorrect: boolean, correctChoiceId?: string) => {
        checkedResultsRef.current = {
          ...checkedResultsRef.current,
          [questionId]: { selectedChoiceId: choiceId, isCorrect, correctChoiceId },
        };
      };

      // If the displayed session already carries the answer key on the client, it
      // is a LOCAL/offline session (buildLocalSession) whose choiceIds use the
      // local `-choice-` scheme. The server /check rebuilds questions in the
      // `::choice::` scheme and would grade a CORRECT local pick as wrong, so
      // grade locally against the session's own key. /check is reserved for the
      // keyless server "ready" session (the H3 case) whose key is withheld.
      const sessionKey = sessionQuestion?.correctChoiceId;
      if (sessionKey != null) {
        const isCorrect = choiceId === sessionKey;
        record(isCorrect, sessionKey);
        return { isCorrect };
      }

      try {
        const payload = await fetchBookJson<{
          results: Array<{ questionId: string; isCorrect: boolean }>;
        }>(
          `/app/api/book/me/quiz/${encodeURIComponent(bookId)}/${chapterNumber}/check`,
          {
            method: "POST",
            body: JSON.stringify({
              attemptNumber: current?.attemptNumber ?? 1,
              difficulty,
              tone: contentTone,
              responses: [{ questionId, selectedChoiceId: choiceId }],
            }),
          }
        );
        const result =
          payload.results.find((r) => r.questionId === questionId) ?? payload.results[0];
        const isCorrect = Boolean(result?.isCorrect);
        // We only legitimately know the key when the user picked correctly
        // (it's their own choice). A wrong guess yields no key — by design.
        record(isCorrect, isCorrect ? choiceId : undefined);
        return { isCorrect };
      } catch {
        // Server "ready" session but /check unreachable: resolve the key from the
        // local quiz bundle by canonical index — which returns a choiceId in the
        // CURRENT (server) session's scheme — so the inline UX + offline scoring
        // keep working (RF-4: celebrate-then-reconcile).
        const localKey = resolveLocalCorrectChoiceId(questionId, sessionQuestion?.choices ?? []);
        if (localKey != null) {
          const isCorrect = choiceId === localKey;
          record(isCorrect, localKey);
          return { isCorrect };
        }
        // No key available at all — can't verify. Count it wrong; the
        // authoritative /submit reconciles the real score on reconnect.
        record(false, undefined);
        return { isCorrect: false };
      }
    },
    [bookId, chapterNumber, difficulty, contentTone, session, resolveLocalCorrectChoiceId]
  );

  const scoreLocally = useCallback((): QuizSessionView | null => {
    if (!session) return null;
    return scoreSessionLocally(session, answers, checkedResultsRef.current);
  }, [answers, session]);

  const submit = useCallback(async () => {
    if (!session) return null;
    setSubmitting(true);
    try {
      const payload = await fetchBookJson<QuizSubmitResponse>(
        `/app/api/book/me/quiz/${encodeURIComponent(bookId)}/${chapterNumber}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            attemptNumber: session.attemptNumber,
            responses: session.questions.map((question) => ({
              questionId: question.questionId,
              selectedChoiceId: answers[question.questionId] ?? null,
            })),
            difficulty,
            tone: contentTone,
            timeSpentSeconds: startedAtRef.current
              ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
              : undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );
      clearDraftAnswers(bookId, chapterNumber, difficulty);
      setSession(payload.quiz);
      syncFromSession(payload.quiz);
      if (payload.loopPipeline) {
        setLastLoopPipeline(payload.loopPipeline);
        emitBookStorageChanged("insight-points");
      }
      setError(null);
      return { session: payload.quiz, loopPipeline: payload.loopPipeline ?? null };
    } catch (submitError: unknown) {
      // Fall back to local scoring — mark as provisional so UI can indicate
      // this result is unverified and needs server re-validation
      const local = scoreLocally();
      if (local) {
        local.provisional = true;
        setSession(local);
        syncFromSession(local);
        setError(null);
        return { session: local, loopPipeline: null };
      }
      if (
        submitError instanceof BookClientError &&
        submitError.code === "attempt_cooldown"
      ) {
        await load();
      }
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  }, [answers, bookId, chapterNumber, difficulty, contentTone, load, session, syncFromSession, scoreLocally]);

  const retry = useCallback(async () => {
    // Whenever the current session already has a result attached (passed or
    // failed), the API would return that same result and the UI would stay
    // stuck on the results screen. Build a fresh local session immediately
    // so the user can retake the quiz, then refresh from the API in the
    // background to keep server-side attempt tracking honest.
    setLastLoopPipeline(null);
    setError(null);
    const graded = session;
    if (graded?.result) {
      const fresh = buildLocalSession();
      if (fresh) {
        const nextAttempt = (graded.attemptsCount ?? graded.attemptNumber ?? 0) + 1;
        fresh.attemptNumber = nextAttempt;
        // Carry forward the answers the user already got right — but ONLY in
        // retry-incorrect-only mode, where those questions are hidden on the
        // retake (a full retake re-asks everything and must start clean).
        // Without this they would submit as null — the server rejects null
        // answers and local scoring counts them wrong, making an improving score
        // paradoxically DROP. The seed is keyed to the DISPLAYED session's
        // choiceId scheme (here `fresh`), then re-seated against the server
        // session below, so it never crosses the server/local scheme boundary.
        const carriedAnswers = retryIncorrectOnly ? buildCarryForwardAnswers(graded, fresh) : {};
        const localCarryCount = Object.keys(carriedAnswers).length;
        if (localCarryCount > 0) {
          saveDraftAnswers(bookId, chapterNumber, difficulty, nextAttempt, carriedAnswers);
        }
        // Fresh attempt: start the captured-verdict map from the carried
        // (known-correct) answers; the newly-shown questions get graded via
        // checkAnswer as the user answers them.
        checkedResultsRef.current = seedCheckedFromCarry(carriedAnswers);
        setSession(fresh);
        syncFromSession(fresh);
        // Refresh from server in the background — if it succeeds and returns
        // a session without a result, we'll swap to that. If it returns the
        // old failed session (still has result), the local fresh session
        // wins because we don't overwrite once the user has started answering.
        void load().then((server) => {
          if (server && !server.result) {
            // Re-seat the carry-forward under the SERVER session's choiceId
            // scheme + attempt number so it keeps the previously-correct answers.
            const serverCarry = retryIncorrectOnly ? buildCarryForwardAnswers(graded, server) : {};
            // If swapping to the server session would DROP carried answers — the
            // prior attempt was graded in a different choiceId scheme (e.g. an
            // offline LOCAL session), so its correct answers can't be expressed in
            // the server scheme — keep the local `fresh` session instead. It holds
            // the complete carry and submits via the provisional/offline path
            // (RF-4 celebrate-then-reconcile); a later genuine load reconciles.
            // Without this guard the carried questions would submit unanswered and
            // an improving score would paradoxically DROP.
            if (
              retryIncorrectOnly &&
              localCarryCount > 0 &&
              Object.keys(serverCarry).length < localCarryCount
            ) {
              return;
            }
            if (Object.keys(serverCarry).length > 0) {
              saveDraftAnswers(bookId, chapterNumber, difficulty, server.attemptNumber, serverCarry);
            }
            checkedResultsRef.current = seedCheckedFromCarry(serverCarry);
            setSession(server);
            syncFromSession(server);
          }
        });
        return fresh;
      }
    }
    return load();
  }, [load, session, buildLocalSession, syncFromSession, bookId, chapterNumber, difficulty, retryIncorrectOnly]);

  const toggleExplanation = useCallback(
    (questionId: string) => {
      const shouldTrack = !explanationOpen[questionId];
      setExplanationOpen((current) => ({
        ...current,
        [questionId]: !current[questionId],
      }));

      if (!shouldTrack || trackedExplanationIds.current.has(questionId)) return;
      trackedExplanationIds.current.add(questionId);
      void fetch(`/app/api/book/me/quiz/${encodeURIComponent(bookId)}/${chapterNumber}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          eventType: "quiz_explanation_opened",
          questionId,
        }),
      }).catch(() => {});
    },
    [bookId, chapterNumber, explanationOpen]
  );

  const trackNextChapterClick = useCallback(() => {
    void fetch(`/app/api/book/me/quiz/${encodeURIComponent(bookId)}/${chapterNumber}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        eventType: "next_chapter_clicked",
      }),
    }).catch(() => {});
  }, [bookId, chapterNumber]);

  return {
    session,
    answers,
    explanationOpen,
    loading,
    submitting,
    error,
    cooldownSeconds,
    canSubmit,
    answerQuestion,
    checkAnswer,
    submit,
    retry,
    lastLoopPipeline,
    load,
    toggleExplanation,
    trackNextChapterClick,
  };
}
