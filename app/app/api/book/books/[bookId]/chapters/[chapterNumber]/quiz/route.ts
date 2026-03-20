import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getUserAccessibleQuiz } from "@/app/app/api/book/_lib/content-service";
import {
  buildQuizClientSession,
  buildQuizStateFromAttempts,
} from "@/app/app/api/book/_lib/quiz-session";
import {
  getUserQuizState,
  listRecentQuizAttempts,
} from "@/app/app/api/book/_lib/repo";

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

    const [{ progress, quiz }, persistedQuizState, history] = await Promise.all([
      getUserAccessibleQuiz({
        tableName,
        contentBucket,
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
      }),
      getUserQuizState(tableName, user.sub, bookId, chapterNumberInt),
      listRecentQuizAttempts(tableName, user.sub, bookId, chapterNumberInt, 20),
    ]);

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
      }),
      progress: {
        currentChapterNumber: progress.currentChapterNumber,
        unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
        completedChapters: progress.completedChapters,
      },
    });

    return applyStartDeviceCookie(response, started);
  });
}
