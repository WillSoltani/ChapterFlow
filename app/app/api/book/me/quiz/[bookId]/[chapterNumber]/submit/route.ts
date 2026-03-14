import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserAccessibleQuiz } from "@/app/app/api/book/_lib/content-service";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { scoreQuizSubmission } from "@/app/app/api/book/_lib/quiz-service";
import {
  countRecentQuizAttempts,
  updateProgressAfterQuizPass,
  writeQuizAttempt,
} from "@/app/app/api/book/_lib/repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_HOUR = 5;

export async function POST(
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

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    const answers = body.answers;
    if (!Array.isArray(answers)) {
      throw new BookApiError(400, "invalid_answers", "answers must be an array of indexes.");
    }
    const normalizedAnswers = answers.map((value, idx) => {
      if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value) {
        throw new BookApiError(400, "invalid_answers", `answers[${idx}] must be an integer.`);
      }
      return value;
    });

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();
    const chapterNumberInt = Math.floor(chapterNum);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentAttempts = await countRecentQuizAttempts(
      tableName,
      user.sub,
      bookId,
      chapterNumberInt,
      oneHourAgo
    );
    if (recentAttempts >= MAX_ATTEMPTS_PER_HOUR) {
      throw new BookApiError(
        429,
        "attempt_rate_limited",
        "Too many quiz attempts. Please wait before trying again.",
        { retryAfterSeconds: 3600 }
      );
    }

    const { quiz } = await getUserAccessibleQuiz({
      tableName,
      contentBucket,
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
    });

    const result = scoreQuizSubmission(quiz, normalizedAnswers);
    const ts = nowIso();
    await writeQuizAttempt(tableName, {
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      scorePercent: result.scorePercent,
      passed: result.passed,
      createdAt: ts,
    });

    if (result.passed) {
      await updateProgressAfterQuizPass(tableName, {
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        scorePercent: result.scorePercent,
      });
    }

    return bookOk({
      scorePercent: result.scorePercent,
      passed: result.passed,
      passingScorePercent: quiz.passingScorePercent,
      totalQuestions: result.total,
      correctAnswers: result.correct,
      unlockedNextChapter: result.passed,
      review: result.review,
    });
  });
}
