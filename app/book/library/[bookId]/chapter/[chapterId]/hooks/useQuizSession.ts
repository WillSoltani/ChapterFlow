"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";

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
};

function remainingCooldown(nextAttemptAvailableAt: string | null): number {
  if (!nextAttemptAvailableAt) return 0;
  const deltaMs = new Date(nextAttemptAvailableAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(deltaMs / 1000));
}

export function useQuizSession(params: {
  bookId: string;
  chapterNumber: number;
  enabled: boolean;
}) {
  const { bookId, chapterNumber, enabled } = params;
  const [session, setSession] = useState<QuizSessionView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [explanationOpen, setExplanationOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
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
    setAnswers(
      Object.fromEntries(
        nextSession.questions
          .map((question) => [question.questionId, question.selectedChoiceId ?? ""])
          .filter((entry) => entry[1])
      )
    );
    setExplanationOpen({});
    trackedExplanationIds.current = new Set();
    startedAtRef.current = nextSession.result ? null : Date.now();
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    try {
      const payload = await fetchBookJson<{
        quiz: QuizSessionView;
      }>(
        `/app/api/book/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/quiz`
      );
      setSession(payload.quiz);
      syncFromSession(payload.quiz);
      setError(null);
      return payload.quiz;
    } catch (loadError: unknown) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load quiz right now.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterNumber, enabled, syncFromSession]);

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
      setAnswers((current) => ({
        ...current,
        [questionId]: choiceId,
      }));
    },
    [session]
  );

  const submit = useCallback(async () => {
    if (!session) return null;
    setSubmitting(true);
    try {
      const payload = await fetchBookJson<{
        quiz: QuizSessionView;
      }>(
        `/app/api/book/me/quiz/${encodeURIComponent(bookId)}/${chapterNumber}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            attemptNumber: session.attemptNumber,
            responses: session.questions.map((question) => ({
              questionId: question.questionId,
              selectedChoiceId: answers[question.questionId] ?? null,
            })),
            timeSpentSeconds: startedAtRef.current
              ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
              : undefined,
          }),
        }
      );
      setSession(payload.quiz);
      syncFromSession(payload.quiz);
      setError(null);
      return payload.quiz;
    } catch (submitError: unknown) {
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
  }, [answers, bookId, chapterNumber, load, session, syncFromSession]);

  const retry = useCallback(async () => {
    if (cooldownSeconds > 0) return null;
    return load();
  }, [cooldownSeconds, load]);

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
    load,
    toggleExplanation,
    trackNextChapterClick,
  };
}
