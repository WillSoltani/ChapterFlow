"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BookChapter, ReadingDepth } from "@/app/book/data/bookChapters";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import { getMotivationMessage } from "@/app/book/_lib/motivation-messages";
import type { BookPreferencesState } from "@/app/book/hooks/useBookPreferences";
import { createFlashcardReviewItem, createReviewItem } from "@/app/book/_lib/spaced-repetition";
import type { ContentTone } from "@/app/book/settings/types/settings";
import { needsReconcile, reconcileProvisionalPass } from "../lib/quizReconcile";
import {
  classifyQuizSubmission,
  completionScore,
  projectIncorrectQuestionReviews,
  shouldEnrollFlashcards,
} from "../lib/reader-quiz-flow-core";
import { useQuizSession } from "./useQuizSession";

export function useChapterQuiz({
  bookId,
  chapterId,
  chapter,
  chapterNumber,
  activeDepth,
  contentTone,
  enabled,
  showQuiz,
  retryIncorrectOnly,
  motivationPersona,
  bookTitle,
  onToast,
}: {
  bookId: string;
  chapterId: string;
  chapter?: BookChapter;
  chapterNumber: number;
  activeDepth: ReadingDepth;
  contentTone: ContentTone;
  enabled: boolean;
  showQuiz: boolean;
  retryIncorrectOnly: boolean;
  motivationPersona: BookPreferencesState["extended"]["motivationPersona"];
  bookTitle: string;
  onToast: (message: string) => void;
}) {
  const [justPassedThisSession, setJustPassedThisSession] = useState(false);
  const quiz = useQuizSession({
    bookId,
    chapterNumber,
    difficulty: activeDepth,
    contentTone,
    enabled: enabled && showQuiz,
    localQuiz: chapter
      ? {
          chapterId: chapter.id,
          questions: chapter.quizByDepth[activeDepth] ?? chapter.quiz,
          passingScorePercent: chapter.quizPassingScorePercent,
        }
      : undefined,
    retryIncorrectOnly,
  });

  const claimLoopCompleteIP = useCallback(() => {
    if (!enabled || !chapter) return Promise.resolve();
    return fetchBookJson(
      `/app/api/book/me/chapters/${encodeURIComponent(bookId)}/${chapter.order}/unlock`,
      { method: "POST" },
    );
  }, [bookId, chapter, enabled]);

  const reconcileInFlightRef = useRef(false);
  const reconcileKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !needsReconcile(quiz.session)) return;
    const attemptKey = `${chapterId}:${quiz.session?.attemptNumber}`;
    let active = true;
    const run = async () => {
      if (reconcileInFlightRef.current) return;
      reconcileInFlightRef.current = true;
      try {
        const outcome = await reconcileProvisionalPass({
          isOnline: () => typeof navigator === "undefined" || navigator.onLine,
          submit: quiz.submit,
          claimLoopCompleteIP,
        });
        if (outcome === "confirmed") {
          emitBookStorageChanged("insight-points");
          if (active) onToast("Back online — your results synced and your points were awarded.");
        }
      } finally {
        reconcileInFlightRef.current = false;
      }
    };
    if (reconcileKeyRef.current !== attemptKey) {
      reconcileKeyRef.current = attemptKey;
      void run();
    }
    const onOnline = () => {
      reconcileKeyRef.current = attemptKey;
      void run();
    };
    window.addEventListener("online", onOnline);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
    };
  }, [chapterId, claimLoopCompleteIP, enabled, onToast, quiz.session, quiz.submit]);

  useEffect(() => {
    setJustPassedThisSession(false);
  }, [chapterId]);

  const submitQuiz = useCallback(async () => {
    if (!enabled) return classifyQuizSubmission(null);
    try {
      const submitResult = await quiz.submit();
      const outcome = classifyQuizSubmission(submitResult);
      if (outcome.celebrateFreshPass) {
        setJustPassedThisSession(true);
      } else if (outcome.kind === "failed") {
        onToast(
          getMotivationMessage(motivationPersona || "coach", "quiz_fail", {
            score: outcome.scorePercent,
          }),
        );
      }

      try {
        const nextSession = submitResult?.session;
        for (const question of projectIncorrectQuestionReviews(nextSession?.questions)) {
          createReviewItem({
            chapterId,
            bookId,
            bookTitle,
            chapterTitle: chapter?.title ?? "",
            questionId: question.questionId,
            questionText: question.prompt,
            choices: question.choices,
            correctChoiceId: question.correctChoiceId!,
            explanation: question.explanation ?? "",
          });
        }
        if (shouldEnrollFlashcards(nextSession?.result) && chapter?.reviewCards) {
          for (const card of chapter.reviewCards) {
            createFlashcardReviewItem({
              chapterId,
              bookId,
              bookTitle,
              chapterTitle: chapter.title,
              cardId: card.id,
              front: card.front,
              back: card.back,
              difficulty: card.difficulty,
            });
          }
        }
      } catch (enrollError) {
        console.warn("Failed to enroll items into spaced-repetition review:", enrollError);
      }
      return outcome;
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : "Unable to submit quiz right now.");
      return classifyQuizSubmission(null);
    }
  }, [bookId, bookTitle, chapter, chapterId, enabled, motivationPersona, onToast, quiz]);

  return {
    quiz,
    quizPassed: quiz.session?.result?.passed === true,
    justPassedThisSession,
    submitQuiz,
    retryQuiz: quiz.retry,
    claimLoopCompleteIP,
    completionScore: completionScore(quiz.session),
  };
}
