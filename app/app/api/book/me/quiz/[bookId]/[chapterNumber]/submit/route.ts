import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  getBookAnalyticsTableName,
  getBookContentBucket,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getPublishedBookManifest,
  getUserAccessibleQuiz,
} from "@/app/app/api/book/_lib/content-service";
import {
  analyticsTrackBookCompleted,
  analyticsTrackFlowPointsTransaction,
  analyticsTrackQuizAttempt,
  analyticsTrackQuizInteraction,
} from "@/app/app/api/book/_lib/analytics-repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import {
  buildProgressAfterQuizPass,
  buildQuizAttemptQuestions,
  buildQuizClientSession,
  buildQuizStateFromAttempts,
  buildRetryPool,
  cooldownSecondsForFailureStreak,
  gradeQuizAttemptQuestions,
  remainingCooldownSeconds,
} from "@/app/app/api/book/_lib/quiz-session";
import {
  countRecentQuizAttempts,
  getUserQuizState,
  listRecentQuizAttempts,
  recordQuizAttemptOutcome,
} from "@/app/app/api/book/_lib/repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { scoreQuizResponsesByQuestionId } from "@/app/app/api/book/_lib/quiz-service";
import { FLOW_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_HOUR = 5;

type RequestResponse = {
  questionId: string;
  selectedChoiceId?: string | null;
  selectedIndex?: number | null;
};

function parseResponses(body: Record<string, unknown>): RequestResponse[] {
  const responsesRaw = body.responses;
  if (!Array.isArray(responsesRaw) || responsesRaw.length === 0) {
    throw new BookApiError(
      400,
      "invalid_answers",
      "responses must include one answer for every question."
    );
  }

  return responsesRaw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}] must be an object.`
      );
    }
    const record = entry as Record<string, unknown>;
    const questionId =
      typeof record.questionId === "string" ? record.questionId.trim().slice(0, 256) : "";
    const selectedChoiceId =
      typeof record.selectedChoiceId === "string"
        ? record.selectedChoiceId.trim().slice(0, 256)
        : null;
    const selectedIndexRaw =
      typeof record.selectedIndex === "number" && Number.isFinite(record.selectedIndex)
        ? Math.floor(record.selectedIndex)
        : null;

    if (!questionId) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}].questionId is required.`
      );
    }
    if (!selectedChoiceId && selectedIndexRaw === null) {
      throw new BookApiError(
        400,
        "invalid_answers",
        `responses[${index}] must include selectedChoiceId or selectedIndex.`
      );
    }
    return {
      questionId,
      selectedChoiceId,
      selectedIndex: selectedIndexRaw,
    };
  });
}

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
    const chapterNumberInt = Math.floor(chapterNum);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);
    const responses = parseResponses(body);
    const requestedAttemptNumber =
      typeof body.attemptNumber === "number" && Number.isFinite(body.attemptNumber)
        ? Math.max(1, Math.floor(body.attemptNumber))
        : 1;
    const timeSpentSeconds =
      typeof body.timeSpentSeconds === "number" && Number.isFinite(body.timeSpentSeconds)
        ? Math.max(0, Math.min(60 * 60, Math.floor(body.timeSpentSeconds)))
        : undefined;

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();
    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
      interactionChapterNumber: chapterNumberInt,
    });
    const [{ progress, quiz }, { manifest }, persistedQuizState, recentAttempts] = await Promise.all([
      getUserAccessibleQuiz({
        tableName,
        contentBucket,
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
      }),
      getPublishedBookManifest({
        tableName,
        contentBucket,
        bookId,
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
        attempts: recentAttempts,
      });

    if (quizState?.passed) {
      const response = bookOk({
        quiz: buildQuizClientSession({
          quiz,
          userId: user.sub,
          bookId,
          chapterNumber: chapterNumberInt,
          quizState,
          latestAttempt: recentAttempts[0] ?? null,
          history: recentAttempts,
        }),
        progress: {
          currentChapterNumber: progress.currentChapterNumber,
          unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
          completedChapters: progress.completedChapters,
        },
      });
      return applyStartDeviceCookie(response, started);
    }

    const retryAfterSeconds = remainingCooldownSeconds(quizState?.nextEligibleAttemptAt ?? null);
    if (retryAfterSeconds > 0) {
      throw new BookApiError(
        429,
        "attempt_cooldown",
        "Retake is temporarily locked after repeated failed attempts.",
        {
          retryAfterSeconds,
          failureStreak: quizState?.failureStreak ?? 1,
          nextAttemptAvailableAt: quizState?.nextEligibleAttemptAt ?? null,
        }
      );
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentAttemptsCount = await countRecentQuizAttempts(
      tableName,
      user.sub,
      bookId,
      chapterNumberInt,
      oneHourAgo
    );
    if (recentAttemptsCount >= MAX_ATTEMPTS_PER_HOUR) {
      throw new BookApiError(
        429,
        "attempt_rate_limited",
        "Too many quiz attempts. Please wait before trying again.",
        { retryAfterSeconds: 3600 }
      );
    }

    const passingScorePercent = Math.max(80, quiz.passingScorePercent || 80);
    const previousAttemptsCount = Math.max(0, quizState?.attemptsCount ?? 0);
    const expectedAttemptNumber = previousAttemptsCount + 1;
    if (requestedAttemptNumber !== expectedAttemptNumber) {
      throw new BookApiError(
        409,
        "quiz_session_stale",
        "This quiz session is out of date. Refresh and try again."
      );
    }

    const attemptQuestions = buildQuizAttemptQuestions({
      quiz: {
        ...quiz,
        passingScorePercent,
      },
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      attemptNumber: expectedAttemptNumber,
    });

    let graded;
    try {
      const hasChoiceIds = responses.some((response) => Boolean(response.selectedChoiceId));
      graded = hasChoiceIds
        ? gradeQuizAttemptQuestions(attemptQuestions, responses, passingScorePercent)
        : (() => {
            const legacy = scoreQuizResponsesByQuestionId(
              {
                ...quiz,
                passingScorePercent,
              },
              responses.map((response) => ({
                questionId: response.questionId,
                selectedIndex: response.selectedIndex ?? -1,
              })),
              {
                questionPool: [...quiz.questions, ...buildRetryPool(quiz)],
              }
            );
            return {
              total: legacy.total,
              correct: legacy.correct,
              scorePercent: legacy.scorePercent,
              passed: legacy.scorePercent >= passingScorePercent,
              questionResults: legacy.review.map((review) => ({
                questionId: review.questionId,
                selectedChoiceId:
                  review.selectedIndex >= 0
                    ? `${review.questionId}::choice::${review.selectedIndex}`
                    : null,
                selectedIndex: review.selectedIndex,
                correctChoiceId: `${review.questionId}::choice::${review.correctIndex}`,
                correctIndex: review.correctIndex,
                isCorrect: review.isCorrect,
              })),
            };
          })();
    } catch (error: unknown) {
      throw new BookApiError(
        400,
        "invalid_answers",
        error instanceof Error ? error.message : "Quiz answers are invalid."
      );
    }

    const ts = nowIso();
    const nextFailureStreak = graded.passed
      ? 0
      : Math.max(0, quizState?.failureStreak ?? 0) + 1;
    const cooldownSeconds = graded.passed
      ? 0
      : cooldownSecondsForFailureStreak(nextFailureStreak);
    const nextEligibleAttemptAt = graded.passed
      ? null
      : new Date(Date.now() + cooldownSeconds * 1000).toISOString();
    const nextProgress = graded.passed
      ? buildProgressAfterQuizPass(progress, {
          chapterNumber: chapterNumberInt,
          scorePercent: graded.scorePercent,
        })
      : undefined;
    const attempt = {
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      chapterId: quiz.chapterId,
      quizId: `${bookId}:${chapterNumberInt}`,
      attemptNumber: expectedAttemptNumber,
      passingScorePercent,
      scorePercent: graded.scorePercent,
      correctCount: graded.correct,
      totalQuestions: graded.total,
      passed: graded.passed,
      cooldownSeconds,
      nextEligibleAttemptAt,
      unlockedNextChapter: graded.passed,
      responses,
      questionResults: graded.questionResults,
      timeSpentSeconds,
      createdAt: ts,
      updatedAt: ts,
    };
    const nextQuizState = {
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
      chapterId: quiz.chapterId,
      quizId: `${bookId}:${chapterNumberInt}`,
      attemptsCount: expectedAttemptNumber,
      failureStreak: nextFailureStreak,
      passed: graded.passed,
      highestScorePercent: Math.max(
        graded.scorePercent,
        quizState?.highestScorePercent ?? 0
      ),
      lastScorePercent: graded.scorePercent,
      lastCorrectCount: graded.correct,
      lastTotalQuestions: graded.total,
      lastAttemptAt: ts,
      lastAttemptNumber: expectedAttemptNumber,
      nextEligibleAttemptAt,
      passedAt: graded.passed ? ts : quizState?.passedAt,
      unlockedNextChapter: graded.passed,
      createdAt: quizState?.createdAt ?? ts,
      updatedAt: ts,
    };

    await recordQuizAttemptOutcome(tableName, {
      previousAttemptsCount,
      attempt,
      nextQuizState,
      nextProgress,
    });

    const quizPassAward =
      graded.passed
        ? await awardFlowPoints(tableName, {
            userId: user.sub,
            amount: FLOW_POINTS_AMOUNTS.quizPass,
            sourceType: "quiz_pass",
            sourceId: `${bookId}:${chapterNumberInt}`,
            metadata: {
              bookId,
              chapterLabel: `Chapter ${chapterNumberInt}`,
              chapterNumber: chapterNumberInt,
            },
            createdAt: ts,
          })
        : { awarded: false as const };
    const completedChapterCount = nextProgress?.completedChapters.length ?? 0;
    const completedBookNow =
      graded.passed &&
      completedChapterCount > 0 &&
      manifest.chapterCount > 0 &&
      completedChapterCount >= manifest.chapterCount;
    const bookCompleteAward =
      completedBookNow
        ? await awardFlowPoints(tableName, {
            userId: user.sub,
            amount: FLOW_POINTS_AMOUNTS.bookComplete,
            sourceType: "book_complete",
            sourceId: bookId,
            metadata: {
              bookId,
              bookTitle: manifest.title,
            },
            createdAt: ts,
          })
        : { awarded: false as const };

    getBookAnalyticsTableName()
      .then((analyticsTable) => {
        if (!analyticsTable) return;
        return Promise.allSettled([
          analyticsTrackQuizAttempt(analyticsTable, {
            userId: user.sub,
            bookId,
            chapterNumber: chapterNumberInt,
            attemptNumber: expectedAttemptNumber,
            scorePercent: graded.scorePercent,
            correctCount: graded.correct,
            totalQuestions: graded.total,
            passed: graded.passed,
            cooldownSeconds,
            unlockedNextChapter: graded.passed,
          }),
          analyticsTrackQuizInteraction(analyticsTable, {
            userId: user.sub,
            eventType: graded.passed ? "quiz_passed" : "quiz_failed",
            bookId,
            chapterNumber: chapterNumberInt,
            attemptNumber: expectedAttemptNumber,
            scorePercent: graded.scorePercent,
            contextKey: `QUIZ#${bookId}#${String(chapterNumberInt).padStart(4, "0")}`,
          }),
          graded.passed
            ? analyticsTrackQuizInteraction(analyticsTable, {
                userId: user.sub,
                eventType: "chapter_unlocked",
                bookId,
                chapterNumber: chapterNumberInt + 1,
                attemptNumber: expectedAttemptNumber,
                contextKey: `QUIZ#${bookId}#${String(chapterNumberInt).padStart(4, "0")}`,
              })
            : Promise.resolve(),
          quizPassAward.awarded
            ? analyticsTrackFlowPointsTransaction(analyticsTable, {
                userId: user.sub,
                deltaPoints: FLOW_POINTS_AMOUNTS.quizPass,
                direction: "earn",
                sourceType: "quiz_pass",
                sourceId: `${bookId}:${chapterNumberInt}`,
                metadata: {
                  bookId,
                  chapterLabel: `Chapter ${chapterNumberInt}`,
                  chapterNumber: chapterNumberInt,
                },
              })
            : Promise.resolve(),
          completedBookNow
            ? analyticsTrackBookCompleted(analyticsTable, {
                userId: user.sub,
                bookId,
                totalChapterCount: manifest.chapterCount,
              })
            : Promise.resolve(),
          bookCompleteAward.awarded
            ? analyticsTrackFlowPointsTransaction(analyticsTable, {
                userId: user.sub,
                deltaPoints: FLOW_POINTS_AMOUNTS.bookComplete,
                direction: "earn",
                sourceType: "book_complete",
                sourceId: bookId,
                metadata: {
                  bookId,
                  bookTitle: manifest.title,
                },
              })
            : Promise.resolve(),
        ]);
      })
      .catch(() => {});

    const history = [attempt, ...recentAttempts].slice(0, 5);
    const response = bookOk({
      quiz: buildQuizClientSession({
        quiz: {
          ...quiz,
          passingScorePercent,
        },
        userId: user.sub,
        bookId,
        chapterNumber: chapterNumberInt,
        quizState: nextQuizState,
        latestAttempt: attempt,
        history,
      }),
      progress: {
        currentChapterNumber:
          nextProgress?.currentChapterNumber ?? progress.currentChapterNumber,
        unlockedThroughChapterNumber:
          nextProgress?.unlockedThroughChapterNumber ??
          progress.unlockedThroughChapterNumber,
        completedChapters:
          nextProgress?.completedChapters ?? progress.completedChapters,
      },
    });
    return applyStartDeviceCookie(response, started);
  });
}
