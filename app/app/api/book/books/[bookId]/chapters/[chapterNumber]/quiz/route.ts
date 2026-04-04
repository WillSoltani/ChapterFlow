import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getLocalQuizQuestions, getUserAccessibleQuiz } from "@/app/app/api/book/_lib/content-service";
import {
  buildQuizClientSession,
  buildQuizStateFromAttempts,
} from "@/app/app/api/book/_lib/quiz-session";
import {
  getUserQuizState,
  getUserSettingsItem,
  listRecentQuizAttempts,
} from "@/app/app/api/book/_lib/repo";
import { QUIZ_QUESTION_COUNTS } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId, chapterNumber } = await params;
    const chapterNum = Number(chapterNumber);
    if (!bookId || !Number.isFinite(chapterNum) || chapterNum < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();
    const chapterNumberInt = Math.floor(chapterNum);
    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
      interactionChapterNumber: chapterNumberInt,
    });

    const [{ progress, quiz: s3Quiz }, persistedQuizState, history, userSettings] = await Promise.all([
      getUserAccessibleQuiz({
        tableName,
        contentBucket,
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
      }),
      getUserQuizState(tableName, user.sub, bookId, chapterNumberInt),
      listRecentQuizAttempts(tableName, user.sub, bookId, chapterNumberInt, 20),
      getUserSettingsItem(tableName, user.sub),
    ]);

    // Prefer quiz questions from the local book-package JSON over stale S3 data.
    const localQuestions = getLocalQuizQuestions(bookId, chapterNumberInt);
    const quiz = localQuestions
      ? { ...s3Quiz, questions: localQuestions }
      : s3Quiz;

    const rawMode = userSettings?.settings?.learningMode;
    type LearningMode = "guided" | "standard" | "challenge";
    const learningMode: LearningMode =
      rawMode === "guided" || rawMode === "standard" || rawMode === "challenge"
        ? rawMode
        : "standard";
    const maxQuestions = QUIZ_QUESTION_COUNTS[learningMode];

    const quizState =
      persistedQuizState ??
      buildQuizStateFromAttempts({
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        chapterId: quiz.chapterId,
        attempts: history,
      });
    const latestAttempt = history[0] ?? null;

    const response = bookOk({
      quiz: buildQuizClientSession({
        quiz,
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        quizState,
        latestAttempt,
        history: history.slice(0, 5),
        maxQuestions,
      }),
      progress: {
        currentChapterNumber: progress.currentChapterNumber,
        unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
        completedChapters: progress.completedChapters,
      },
    });

    // Quiz session state is user-specific and changes on each attempt.
    // Short private cache to avoid redundant refetches during the same session.
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");

    return applyStartDeviceCookie(response, started);
  });
}
