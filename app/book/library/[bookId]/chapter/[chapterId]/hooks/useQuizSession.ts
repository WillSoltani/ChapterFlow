"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { ToneKey } from "@/app/book/data/bookPackages";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import type { LoopPipelineResult } from "@/app/book/_lib/flow-points-economy";
import { buildCarryForwardAnswers, scoreSessionLocally } from "../lib/quizScoring";

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

function remainingCooldown(nextAttemptAvailableAt: string | null): number {
  if (!nextAttemptAvailableAt) return 0;
  const deltaMs = new Date(nextAttemptAvailableAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(deltaMs / 1000));
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
  localQuiz?: {
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
  /** Whether the retake only re-shows previously-missed questions (the default).
   *  Only in this mode are previously-correct answers hidden and thus carried
   *  forward; a full retake re-asks everything and must start from a clean map. */
  retryIncorrectOnly?: boolean;
}) {
  const { bookId, chapterNumber, difficulty, contentTone, enabled, localQuiz, retryIncorrectOnly = false } = params;
  const localQuizRef = useRef(localQuiz);
  localQuizRef.current = localQuiz;
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

  const buildLocalSession = useCallback((): QuizSessionView | null => {
    const quiz = localQuizRef.current;
    if (!quiz) return null;
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
  }, [chapterNumber]);

  const load = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    try {
      const payload = await fetchBookJson<{
        quiz: QuizSessionView;
      }>(
        `/app/api/book/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/quiz?difficulty=${encodeURIComponent(difficulty)}&tone=${encodeURIComponent(contentTone)}`
      );
      setSession(payload.quiz);
      syncFromSession(payload.quiz);
      setError(null);
      return payload.quiz;
    } catch (loadError: unknown) {
      // Fall back to local quiz data if API fails
      const local = buildLocalSession();
      if (local) {
        setSession(local);
        syncFromSession(local);
        setError(null);
        return local;
      }
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load quiz right now.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterNumber, difficulty, contentTone, enabled, syncFromSession, buildLocalSession]);

  // Clear stale state immediately when the chapter (or difficulty) changes.
  // Without this, navigating from one chapter to another shows the previous
  // chapter's quiz for one render until `load()` resolves, which can briefly
  // flash a "passed"/"failed" results screen for the wrong chapter.
  useEffect(() => {
    setSession(null);
    setAnswers({});
    setExplanationOpen({});
    setError(null);
    setCooldownSeconds(0);
    setLastLoopPipeline(null);
    startedAtRef.current = null;
    trackedExplanationIds.current = new Set();
  }, [bookId, chapterNumber, difficulty, contentTone]);

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

  const scoreLocally = useCallback((): QuizSessionView | null => {
    if (!session) return null;
    return scoreSessionLocally(session, answers);
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
        const hasCarry = Object.keys(carriedAnswers).length > 0;
        if (hasCarry) {
          saveDraftAnswers(bookId, chapterNumber, difficulty, nextAttempt, carriedAnswers);
        }
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
            if (retryIncorrectOnly) {
              const serverCarry = buildCarryForwardAnswers(graded, server);
              if (Object.keys(serverCarry).length > 0) {
                saveDraftAnswers(bookId, chapterNumber, difficulty, server.attemptNumber, serverCarry);
              }
            }
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
    submit,
    retry,
    lastLoopPipeline,
    load,
    toggleExplanation,
    trackNextChapterClick,
  };
}
