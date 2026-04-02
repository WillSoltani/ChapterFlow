import "server-only";

// Implements §1.1 Loop Complete earning, §1.3 Loop Complete endpoint,
// §2.1 streak update, §1.1 streak_day + welcome_back bonuses.
//
// Called when the Unlock step (step 4 of the learning loop) completes on the client.
// The quiz pass is the trust anchor — this endpoint verifies it before awarding IP.

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  getBookAnalyticsTableName,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { bookUserPk, loopSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { getUserQuizState } from "@/app/app/api/book/_lib/repo";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { updateStreakOnLoopComplete } from "@/app/app/api/book/_lib/streak-repo";
import { updateTierOnLoopComplete } from "@/app/app/api/book/_lib/tier-repo";
import { checkAchievementsAfterLoopComplete } from "@/app/app/api/book/_lib/achievement-repo";
import { maybeAwardInsightSpark } from "@/app/app/api/book/_lib/insight-spark";
import { analyticsTrackFlowPointsTransaction } from "@/app/app/api/book/_lib/analytics-repo";
import { INSIGHT_POINTS_AMOUNTS, LOOP_COMPLETE_IP } from "@/app/book/_lib/flow-points-economy";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import type { LearningMode } from "@/app/book/settings/types/settings";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId, chapterNumber: chapterNumberRaw } = await params;

    const chapterNumberInt = Number(chapterNumberRaw);
    if (!Number.isFinite(chapterNumberInt) || chapterNumberInt < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }

    // Parse optional body for timezone and book metadata
    let timezone = "UTC";
    let bookCategory = "";
    let bookTitle = "";
    try {
      const bodyRaw = await req.json();
      const body = requireBodyObject(bodyRaw);
      if (typeof body.timezone === "string" && body.timezone.trim()) {
        timezone = body.timezone.trim();
      }
      if (typeof body.category === "string") {
        bookCategory = body.category;
      }
      if (typeof body.bookTitle === "string") {
        bookTitle = body.bookTitle;
      }
    } catch {
      // Body is optional — timezone defaults to UTC
    }

    const tableName = await getBookTableName();

    // Step 1: Verify quiz pass exists — the quiz pass is the trust anchor (§1.3)
    const quizState = await getUserQuizState(tableName, user.sub, bookId, chapterNumberInt);
    if (!quizState || !quizState.passed) {
      throw new BookApiError(
        400,
        "quiz_not_passed",
        "Quiz must be passed before completing the learning loop."
      );
    }

    // Determine IP amount based on learning mode and attempt number
    const learningMode = (
      typeof quizState.lastAttemptNumber === "number" ? "standard" : "standard"
    ) as LearningMode;

    // We need the learning mode from quiz state metadata.
    // The quiz state stores attemptsCount — first attempt is when attemptsCount was 1 at pass time.
    // For now, read from the body if provided, or default to standard.
    let mode: LearningMode = "standard";
    try {
      const bodyRaw = await req.clone().json().catch(() => null);
      if (bodyRaw && typeof bodyRaw === "object" && typeof (bodyRaw as Record<string, unknown>).learningMode === "string") {
        const m = (bodyRaw as Record<string, unknown>).learningMode as string;
        if (m === "guided" || m === "standard" || m === "challenge") {
          mode = m;
        }
      }
    } catch {
      // Use default
    }

    const isFirstAttempt = quizState.attemptsCount <= 1;
    const loopCompleteIP = isFirstAttempt
      ? LOOP_COMPLETE_IP[mode].firstAttempt
      : LOOP_COMPLETE_IP[mode].retry;

    const ts = nowIso();

    // Step 2: Award loop completion IP (§1.1)
    const loopAward = await awardFlowPoints(tableName, {
      userId: user.sub,
      amount: loopCompleteIP,
      sourceType: "loop_complete",
      sourceId: `${bookId}:${chapterNumberInt}`,
      metadata: {
        bookId,
        bookTitle,
        chapterLabel: `Chapter ${chapterNumberInt}`,
        chapterNumber: chapterNumberInt,
        learningMode: mode,
        isFirstAttempt,
      },
      createdAt: ts,
    });

    // Step 3: Create LOOP DynamoDB record (§10.1)
    if (loopAward.awarded) {
      try {
        await ddbDoc.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: bookUserPk(user.sub),
              SK: loopSk(bookId, chapterNumberInt),
              entity: "BOOK_USER_LOOP",
              userId: user.sub,
              bookId,
              chapterNumber: chapterNumberInt,
              completedAt: ts,
              quizScore: quizState.highestScorePercent,
              learningMode: mode,
              isFirstAttempt,
              category: bookCategory,
              createdAt: ts,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          })
        );
      } catch {
        // Idempotent — LOOP record already exists, which is fine
      }
    }

    // Step 4: Update streak (§2.1) and award streak_day + welcome_back (§1.1)
    const streakResult = await updateStreakOnLoopComplete(tableName, user.sub, timezone);

    // Step 5: Update tier progress (§3.2) — check for tier advancement
    const tierResult = await updateTierOnLoopComplete(
      tableName,
      user.sub,
      quizState.highestScorePercent,
      bookCategory
    );

    // Step 6: Check achievements (§4.1, §4.2)
    const achievementResults = await checkAchievementsAfterLoopComplete({
      userId: user.sub,
      tableName,
      streak: streakResult.streak,
      tier: tierResult.tier,
      latestQuizScore: quizState.highestScorePercent,
      latestLearningMode: mode,
      latestIsFirstAttempt: isFirstAttempt,
      bookId,
    });

    // Step 7: Insight Spark (§7.1) — 12% chance variable reward
    const today = streakResult.streak.lastActiveDate ?? new Date().toISOString().slice(0, 10);
    const sparkResult = await maybeAwardInsightSpark(
      tableName,
      user.sub,
      today,
      tierResult.tier.totalLoopsCompleted
    );

    // Step 8: Fire-and-forget analytics
    getBookAnalyticsTableName()
      .then((analyticsTable) => {
        if (!analyticsTable) return;
        const events: Promise<unknown>[] = [];
        if (loopAward.awarded) {
          events.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: loopCompleteIP,
              direction: "earn",
              sourceType: "loop_complete",
              sourceId: `${bookId}:${chapterNumberInt}`,
              metadata: { learningMode: mode, isFirstAttempt },
            })
          );
        }
        if (streakResult.streakDayAwarded) {
          events.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: INSIGHT_POINTS_AMOUNTS.streakDayBonus,
              direction: "earn",
              sourceType: "streak_day",
              sourceId: streakResult.streak.lastActiveDate ?? ts,
            })
          );
        }
        if (streakResult.welcomeBackAwarded) {
          events.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: INSIGHT_POINTS_AMOUNTS.welcomeBack,
              direction: "earn",
              sourceType: "welcome_back",
              sourceId: streakResult.streak.lastActiveDate ?? ts,
            })
          );
        }
        for (const milestone of streakResult.milestonesAwarded) {
          events.push(
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: milestone.ip,
              direction: "earn",
              sourceType: "streak_milestone",
              sourceId: `streak-${milestone.days}`,
            })
          );
        }
        return Promise.allSettled(events);
      })
      .catch(() => {});

    return bookOk({
      success: true,
      ipAwarded: {
        loopComplete: loopAward.awarded ? loopCompleteIP : 0,
        streakDay: streakResult.streakDayAwarded ? INSIGHT_POINTS_AMOUNTS.streakDayBonus : 0,
        welcomeBack: streakResult.welcomeBackAwarded ? INSIGHT_POINTS_AMOUNTS.welcomeBack : 0,
        milestones: streakResult.milestonesAwarded.map((m) => ({
          days: m.days,
          ip: m.ip,
        })),
      },
      streak: {
        currentStreak: streakResult.streak.currentStreak,
        longestStreak: streakResult.streak.longestStreak,
        shieldsHeld: streakResult.streak.streakShieldsHeld,
        streakReset: streakResult.streakReset,
        shieldsConsumed: streakResult.shieldsConsumed,
      },
      tier: tierResult.advanced
        ? {
            advanced: true,
            newTier: tierResult.newTier,
            displayName: tierResult.definition?.displayName ?? null,
            advancementIP: tierResult.advancementIP,
            identityStatement: tierResult.definition?.identityStatement ?? null,
          }
        : { advanced: false },
      insightSpark: sparkResult.triggered
        ? { triggered: true, amount: sparkResult.amount }
        : { triggered: false },
      achievements: achievementResults.map((a) => ({
        id: a.achievementId,
        name: a.name,
        track: a.track,
        ip: a.ipAwarded,
        celebrationCopy: a.celebrationCopy,
        isHidden: a.isHidden,
      })),
    });
  });
}
