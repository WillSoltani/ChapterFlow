import "server-only";

// Implements §4.1 Mastery achievements and §4.2 Consistency achievements.
// Detection logic runs after relevant events (loop completion, quiz pass, streak update).
// Creates ACHIEVEMENT DynamoDB records and awards IP via awardFlowPoints().

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  achievementSk,
  bookUserPk,
  nowIso,
} from "@/app/app/api/book/_lib/keys";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { getAchievementById } from "@/app/book/badges/lib/achievement-definitions";
import type { BookUserTierItem, BookUserStreakItem } from "@/app/app/api/book/_lib/types";

// ── Types ───────────────────────────────────────────────────────────────────

export type AchievementCheckContext = {
  userId: string;
  tableName: string;
  // Current streak state (from streak update)
  streak?: BookUserStreakItem | undefined;
  // Current tier state (from tier update)
  tier?: BookUserTierItem | undefined;
  // Latest quiz result
  latestQuizScore?: number | undefined;
  latestLearningMode?: string | undefined;
  latestIsFirstAttempt?: boolean | undefined;
  // Book-level info
  bookId?: string | undefined;
  bookCompleted?: boolean | undefined;
  bookChapterCount?: number | undefined;
  // Loop completion context (for hidden achievements)
  loopCompletedAt?: string; // ISO timestamp | undefined
  userTimezone?: string | undefined;
  /** Number of books completed in distinct categories */
  completedBooksInDistinctCategories?: number | undefined;
  /** Date the current book was started (ISO) — for Full Circle detection */
  bookStartedAt?: string | undefined;
  /** Days of inactivity before this loop (for Second Wind detection) */
  inactiveDaysBeforeReturn?: number | undefined;
};

export type AchievementAwardResult = {
  achievementId: string;
  name: string;
  track: string;
  ipAwarded: number;
  celebrationCopy: string;
  isHidden: boolean;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException" ||
    rec.name === "TransactionCanceledException"
  );
}

async function hasAchievement(
  tableName: string,
  userId: string,
  achievementId: string
): Promise<boolean> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: achievementSk(achievementId) },
      ProjectionExpression: "PK",
    })
  );
  return !!res.Item;
}

async function awardAchievement(
  tableName: string,
  userId: string,
  achievementId: string
): Promise<AchievementAwardResult | null> {
  const def = getAchievementById(achievementId);
  if (!def) return null;

  // Check if already earned
  if (await hasAchievement(tableName, userId, achievementId)) return null;

  const now = nowIso();

  // Create ACHIEVEMENT record
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(userId),
          SK: achievementSk(achievementId),
          entity: "BOOK_USER_ACHIEVEMENT",
          userId,
          achievementId,
          track: def.track,
          earnedAt: now,
          ipAwarded: def.ipValue,
          metadata: { name: def.name, criteria: def.criteria },
          createdAt: now,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return null; // Already earned
    throw error;
  }

  // Award IP
  if (def.ipValue > 0) {
    await awardFlowPoints(tableName, {
      userId,
      amount: def.ipValue,
      sourceType: "achievement_earned",
      sourceId: achievementId,
      metadata: { achievementName: def.name, track: def.track },
    });
  }

  return {
    achievementId: def.id,
    name: def.name,
    track: def.track,
    ipAwarded: def.ipValue,
    celebrationCopy: def.celebrationCopy,
    isHidden: def.isHidden,
  };
}

// ── Mastery Track Detection (§4.1) ──────────────────────────────────────────

async function checkMasteryAchievements(
  ctx: AchievementCheckContext
): Promise<AchievementAwardResult[]> {
  const results: AchievementAwardResult[] = [];

  // Sharp Focus — Score 100% on any quiz
  if (ctx.latestQuizScore === 100) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "sharp-focus");
    if (r) results.push(r);
  }

  if (!ctx.tier) return results;

  // Precision Reader — Average ≥ 85% across 10 completed chapters
  if (ctx.tier.avgQuizScoreCount >= 10) {
    const avg = ctx.tier.avgQuizScoreSum / ctx.tier.avgQuizScoreCount;
    if (avg >= 85) {
      const r = await awardAchievement(ctx.tableName, ctx.userId, "precision-reader");
      if (r) results.push(r);
    }
  }

  // Challenge Accepted — Complete 10 loops in Challenge mode
  // We need to count challenge-mode loops from the LOOP records
  if (ctx.latestLearningMode === "challenge") {
    const challengeCount = await countLoopsByMode(ctx.tableName, ctx.userId, "challenge");
    if (challengeCount >= 10) {
      const r = await awardAchievement(ctx.tableName, ctx.userId, "challenge-accepted");
      if (r) results.push(r);
    }
  }

  // Flawless Run — Score 100% on 5 different chapter quizzes
  if (ctx.latestQuizScore === 100) {
    const perfectCount = await countPerfectScoreLoops(ctx.tableName, ctx.userId);
    if (perfectCount >= 5) {
      const r = await awardAchievement(ctx.tableName, ctx.userId, "flawless-run");
      if (r) results.push(r);
    }
  }

  // Challenge Mastery — Complete every chapter of a book in Challenge mode
  if (ctx.bookCompleted && ctx.latestLearningMode === "challenge" && ctx.bookId) {
    const allChallenge = await areAllBookLoopsChallenge(
      ctx.tableName,
      ctx.userId,
      ctx.bookId,
      ctx.bookChapterCount ?? 0
    );
    if (allChallenge) {
      const r = await awardAchievement(ctx.tableName, ctx.userId, "challenge-mastery");
      if (r) results.push(r);
    }
  }

  return results;
}

// ── Consistency Track Detection (§4.2) ──────────────────────────────────────

async function checkConsistencyAchievements(
  ctx: AchievementCheckContext
): Promise<AchievementAwardResult[]> {
  const results: AchievementAwardResult[] = [];

  if (!ctx.streak) return results;

  const streakDays = ctx.streak.currentStreak;

  // First Spark — 3-day streak
  if (streakDays >= 3) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "first-spark");
    if (r) results.push(r);
  }

  // Weekly Rhythm — 7-day streak
  if (streakDays >= 7) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "weekly-rhythm");
    if (r) results.push(r);
  }

  // Monthly Discipline — 30-day streak
  if (streakDays >= 30) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "monthly-discipline");
    if (r) results.push(r);
  }

  // Centurion — 100-day streak
  if (streakDays >= 100) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "centurion");
    if (r) results.push(r);
  }

  // Year of Insight — 365-day streak
  if (streakDays >= 365) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "year-of-insight");
    if (r) results.push(r);
  }

  // Steady State — Maintain 80%+ consistency score for 60 consecutive days (§4.2 + §2.3)
  if (ctx.streak.consistencyAbove80Since) {
    const since = new Date(ctx.streak.consistencyAbove80Since + "T00:00:00Z");
    const now = new Date();
    const daysSinceAbove80 = Math.floor(
      (now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysSinceAbove80 >= 60) {
      const r = await awardAchievement(ctx.tableName, ctx.userId, "steady-state");
      if (r) results.push(r);
    }
  }

  return results;
}

// ── Exploration Track Detection (§4.3) ──────────────────────────────────────

async function checkExplorationAchievements(
  ctx: AchievementCheckContext
): Promise<AchievementAwardResult[]> {
  const results: AchievementAwardResult[] = [];

  if (!ctx.tier) return results;

  const catCount = ctx.tier.categoriesExplored.length;

  // Curious Mind — 3 categories
  if (catCount >= 3) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "curious-mind");
    if (r) results.push(r);
  }

  // Cross-Disciplinary — 6 categories
  if (catCount >= 6) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "cross-disciplinary");
    if (r) results.push(r);
  }

  // Renaissance Reader — 8 categories
  if (catCount >= 8) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "renaissance-reader");
    if (r) results.push(r);
  }

  // Omnivore — 10+ categories (the catalog spans ~13 distinct categories, so
  // the prior 18 was unreachable; 10 keeps this aspirational but attainable).
  if (catCount >= 10) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "omnivore");
    if (r) results.push(r);
  }

  // Bridge Builder — Complete 3 entire books in 3 different categories
  if (ctx.bookCompleted && (ctx.completedBooksInDistinctCategories ?? 0) >= 3) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "bridge-builder");
    if (r) results.push(r);
  }

  return results;
}

// ── Hidden Track Detection (§4.4) ───────────────────────────────────────────

async function checkHiddenAchievements(
  ctx: AchievementCheckContext
): Promise<AchievementAwardResult[]> {
  const results: AchievementAwardResult[] = [];

  // Night Owl — 5 loops between 10pm and 5am
  // Dawn Reader — 5 loops between 5am and 7am
  if (ctx.loopCompletedAt && ctx.userTimezone) {
    const hour = getHourInTimezone(ctx.loopCompletedAt, ctx.userTimezone);

    if (hour >= 22 || hour < 5) {
      const nightCount = await countLoopsInTimeRange(ctx.tableName, ctx.userId, ctx.userTimezone, 22, 5);
      if (nightCount >= 5) {
        const r = await awardAchievement(ctx.tableName, ctx.userId, "night-owl");
        if (r) results.push(r);
      }
    }

    if (hour >= 5 && hour < 7) {
      const dawnCount = await countLoopsInTimeRange(ctx.tableName, ctx.userId, ctx.userTimezone, 5, 7);
      if (dawnCount >= 5) {
        const r = await awardAchievement(ctx.tableName, ctx.userId, "dawn-reader");
        if (r) results.push(r);
      }
    }
  }

  // Weekend Scholar — 8 consecutive weekend days
  // (checked via READINGDAY records — weekend = Sat/Sun)
  const weekendRun = await countConsecutiveWeekendDays(ctx.tableName, ctx.userId);
  if (weekendRun >= 8) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "weekend-scholar");
    if (r) results.push(r);
  }

  // Marathon Session — 5 loops in a single calendar day
  if (ctx.tier && ctx.userTimezone) {
    const today = getTodayStr(ctx.userTimezone);
    const todayLoops = await countLoopsOnDate(ctx.tableName, ctx.userId, today);
    if (todayLoops >= 5) {
      const r = await awardAchievement(ctx.tableName, ctx.userId, "marathon-session");
      if (r) results.push(r);
    }
  }

  // Full Circle — Finish a book started 90+ days ago
  if (ctx.bookCompleted && ctx.bookStartedAt) {
    const startDate = new Date(ctx.bookStartedAt);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceStart >= 90) {
      const r = await awardAchievement(ctx.tableName, ctx.userId, "full-circle");
      if (r) results.push(r);
    }
  }

  // Second Wind — Complete a loop after 14+ inactive days
  if (ctx.inactiveDaysBeforeReturn !== undefined && ctx.inactiveDaysBeforeReturn >= 14) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "second-wind");
    if (r) results.push(r);
  }

  // Century Loop — 100th learning loop
  if (ctx.tier && ctx.tier.totalLoopsCompleted >= 100) {
    const r = await awardAchievement(ctx.tableName, ctx.userId, "century-loop");
    if (r) results.push(r);
  }

  return results;
}

// ── Time-based query helpers for hidden achievements ────────────────────────

function getHourInTimezone(isoTimestamp: string, timezone: string): number {
  try {
    const date = new Date(isoTimestamp);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    return new Date(isoTimestamp).getUTCHours();
  }
}

function getTodayStr(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function countLoopsInTimeRange(
  tableName: string,
  userId: string,
  _timezone: string,
  startHour: number,
  endHour: number
): Promise<number> {
  // Query all LOOP records and filter by completion hour
  // Note: completedAt is stored as ISO timestamp; we filter server-side
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "LOOP#",
      },
      ProjectionExpression: "completedAt",
    })
  );

  if (!res.Items) return 0;

  let count = 0;
  for (const item of res.Items) {
    const completedAt = item.completedAt as string | undefined;
    if (!completedAt) continue;
    const hour = getHourInTimezone(completedAt, _timezone);
    if (startHour > endHour) {
      // Wraps midnight (e.g., 22-5)
      if (hour >= startHour || hour < endHour) count++;
    } else {
      if (hour >= startHour && hour < endHour) count++;
    }
  }
  return count;
}

async function countConsecutiveWeekendDays(
  tableName: string,
  userId: string
): Promise<number> {
  // Query READINGDAY records and check for consecutive Sat/Sun runs
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "READINGDAY#",
      },
      ProjectionExpression: "SK",
      ScanIndexForward: false, // Most recent first
      Limit: 60, // ~2 months of days
    })
  );

  if (!res.Items || res.Items.length === 0) return 0;

  // Extract day keys and filter to weekend days
  const dayKeys = res.Items
    .map((item) => {
      const sk = item.SK as string;
      return sk.replace("READINGDAY#", "");
    })
    .filter((dayKey) => {
      const d = new Date(dayKey + "T00:00:00Z");
      const dayOfWeek = d.getUTCDay();
      return dayOfWeek === 0 || dayOfWeek === 6; // Sun or Sat
    })
    .sort()
    .reverse();

  if (dayKeys.length === 0) return 0;

  // Count consecutive weekend days from most recent
  let consecutive = 1;
  for (let i = 1; i < dayKeys.length; i++) {
    const prev = new Date(dayKeys[i - 1] + "T00:00:00Z");
    const curr = new Date(dayKeys[i] + "T00:00:00Z");
    const gap = Math.round((prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000));
    // Weekend days can be 1 day apart (Sat→Sun) or 6 days apart (Sun→Sat next week)
    if (gap === 1 || gap === 6) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

async function countLoopsOnDate(
  tableName: string,
  userId: string,
  dateStr: string
): Promise<number> {
  // Count LOOP records completed on a specific date
  const dayStart = dateStr + "T00:00:00.000Z";
  const dayEnd = dateStr + "T23:59:59.999Z";

  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "completedAt BETWEEN :dayStart AND :dayEnd",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "LOOP#",
        ":dayStart": dayStart,
        ":dayEnd": dayEnd,
      },
      Select: "COUNT",
    })
  );

  return res.Count ?? 0;
}

// ── Query helpers ───────────────────────────────────────────────────────────

async function countLoopsByMode(
  tableName: string,
  userId: string,
  mode: string
): Promise<number> {
  // Query all LOOP records and filter by learningMode
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "learningMode = :mode",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "LOOP#",
        ":mode": mode,
      },
      Select: "COUNT",
    })
  );
  return res.Count ?? 0;
}

async function countPerfectScoreLoops(
  tableName: string,
  userId: string
): Promise<number> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "quizScore = :perfect",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "LOOP#",
        ":perfect": 100,
      },
      Select: "COUNT",
    })
  );
  return res.Count ?? 0;
}

async function areAllBookLoopsChallenge(
  tableName: string,
  userId: string,
  bookId: string,
  expectedChapters: number
): Promise<boolean> {
  if (expectedChapters <= 0) return false;

  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "learningMode = :challenge",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": `LOOP#${bookId}#`,
        ":challenge": "challenge",
      },
      Select: "COUNT",
    })
  );

  return (res.Count ?? 0) >= expectedChapters;
}

// ── Main entry point — check all applicable achievements ────────────────────

export async function checkAchievementsAfterLoopComplete(
  ctx: AchievementCheckContext
): Promise<AchievementAwardResult[]> {
  const [mastery, consistency, exploration, hidden] = await Promise.all([
    checkMasteryAchievements(ctx),
    checkConsistencyAchievements(ctx),
    checkExplorationAchievements(ctx),
    checkHiddenAchievements(ctx),
  ]);

  return [...mastery, ...consistency, ...exploration, ...hidden];
}
