import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { resolveLearningMode } from "@/app/app/api/book/_lib/learning-mode";
import {
  getLocalQuizQuestions,
  getUserAccessibleQuiz,
  isLocalV12Package,
} from "@/app/app/api/book/_lib/content-service";
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
import type { ReadingDepth } from "@/app/book/data/bookChapters";
import type { ToneKey } from "@/app/book/data/bookPackages";

export const runtime = "nodejs";

const QUIZ_QUESTION_COUNTS_BY_DIFFICULTY: Record<ReadingDepth, number> = {
  simple: 5,
  standard: 7,
  deeper: 10,
};

function parseDifficulty(value: string | null): ReadingDepth {
  if (value === "simple" || value === "standard" || value === "deeper") {
    return value;
  }
  return "standard";
}

function parseTone(value: string | null): ToneKey {
  if (value === "gentle" || value === "direct" || value === "competitive") {
    return value;
  }
  return "direct";
}

function readSavedTone(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const extended = (settings as { extended?: unknown }).extended;
  if (!extended || typeof extended !== "object" || Array.isArray(extended)) return null;
  return typeof (extended as { contentTone?: unknown }).contentTone === "string"
    ? ((extended as { contentTone?: string }).contentTone ?? null)
    : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const searchParams = new URL(req.url).searchParams;
    const difficulty = parseDifficulty(searchParams.get("difficulty"));
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

    // SET-1: resolve through the shared core so the question set + choiceId
    // scheme stay identical to the /check and submit routes (a divergence here
    // silently mis-grades). The resolver reads canonical top-level
    // settings.learningMode and self-heals users whose mode lives only under
    // settings.extended. See docs/audit-fixes/SET-1.md.
    const learningMode = resolveLearningMode(userSettings?.settings);
    const tone = parseTone(searchParams.get("tone") ?? readSavedTone(userSettings?.settings));
    // Prefer quiz questions from the local book-package JSON over stale S3 data.
    const localQuestions = getLocalQuizQuestions(bookId, chapterNumberInt, tone);
    const quiz = localQuestions
      ? { ...s3Quiz, questions: localQuestions }
      : s3Quiz;
    const strictV12 = isLocalV12Package(bookId);
    const maxQuestions = strictV12
      ? QUIZ_QUESTION_COUNTS_BY_DIFFICULTY[difficulty]
      : QUIZ_QUESTION_COUNTS[learningMode];

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
        passingScorePercent: strictV12 ? quiz.passingScorePercent : undefined,
        maxQuestions,
        preserveAuthoredOrder: strictV12,
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
