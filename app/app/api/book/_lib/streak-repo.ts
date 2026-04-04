import "server-only";

// Implements §2.1 Streak Mechanics, §2.2 Streak Shield, §2.4 Milestones, §1.1 streak_day + welcome_back

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  engagementSk,
  nowIso,
  readingDaySk,
  streakSk,
} from "@/app/app/api/book/_lib/keys";
import type { BookUserStreakItem } from "@/app/app/api/book/_lib/types";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";

// ── Streak milestone thresholds and IP awards (§2.4) ────────────────────────

export const STREAK_MILESTONES: ReadonlyArray<{ days: number; ip: number }> = [
  { days: 3, ip: 25 },
  { days: 7, ip: 50 },
  { days: 14, ip: 100 },
  { days: 30, ip: 200 },
  { days: 60, ip: 350 },
  { days: 100, ip: 500 },
  { days: 200, ip: 750 },
  { days: 365, ip: 1500 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function readNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readStrArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function readNumArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException" ||
    rec.name === "TransactionCanceledException"
  );
}

/** Get today's date string in a given IANA timezone */
export function getTodayInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date()); // returns YYYY-MM-DD
  } catch {
    // Fallback to UTC if invalid timezone
    return new Date().toISOString().slice(0, 10);
  }
}

/** Count calendar days between two YYYY-MM-DD date strings */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00Z");
  const b = new Date(dateB + "T00:00:00Z");
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function parseStreakItem(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserStreakItem {
  return {
    userId,
    currentStreak: Math.max(0, readNum(item?.currentStreak) ?? 0),
    longestStreak: Math.max(0, readNum(item?.longestStreak) ?? 0),
    lastActiveDate: readStr(item?.lastActiveDate) ?? null,
    lastActiveTimezone: readStr(item?.lastActiveTimezone) ?? null,
    streakShieldsHeld: Math.max(0, readNum(item?.streakShieldsHeld) ?? 0),
    shieldUsedDates: readStrArray(item?.shieldUsedDates),
    consistencyLast30: Math.max(0, readNum(item?.consistencyLast30) ?? 0),
    consistencyAbove80Since: readStr(item?.consistencyAbove80Since) ?? null,
    milestonesReached: readNumArray(item?.milestonesReached),
    createdAt: readStr(item?.createdAt) ?? "",
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

// ── Read / Create ───────────────────────────────────────────────────────────

export async function getOrCreateStreak(
  tableName: string,
  userId: string
): Promise<BookUserStreakItem> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: streakSk() },
    })
  );
  if (res.Item) return parseStreakItem(res.Item, userId);

  const now = nowIso();
  const initial: BookUserStreakItem = {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    lastActiveTimezone: null,
    streakShieldsHeld: 0,
    shieldUsedDates: [],
    consistencyLast30: 0,
    consistencyAbove80Since: null,
    milestonesReached: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(userId),
          SK: streakSk(),
          entity: "BOOK_USER_STREAK",
          ...initial,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      // Race condition — another request created it, fetch again
      const retry = await ddbDoc.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(userId), SK: streakSk() },
        })
      );
      return parseStreakItem(retry.Item as Record<string, unknown>, userId);
    }
    throw error;
  }

  return initial;
}

// ── Consistency Score computation (§2.3) ────────────────────────────────────

async function computeConsistencyLast30(
  tableName: string,
  userId: string
): Promise<number> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDayKey = thirtyDaysAgo.toISOString().slice(0, 10);

  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":start": readingDaySk(startDayKey),
        ":end": readingDaySk("9999-99-99"),
      },
      Select: "COUNT",
    })
  );

  return res.Count ?? 0;
}

// ── Core streak update on loop completion (§2.1) ────────────────────────────

export type StreakUpdateResult = {
  streak: BookUserStreakItem;
  streakDayAwarded: boolean;
  welcomeBackAwarded: boolean;
  milestonesAwarded: Array<{ days: number; ip: number }>;
  shieldsConsumed: number;
  streakReset: boolean;
  /** Days since last active date (0 = same day, 1 = consecutive). Used for second-wind detection. */
  gapDays: number;
};

export async function updateStreakOnLoopComplete(
  tableName: string,
  userId: string,
  userTimezone: string
): Promise<StreakUpdateResult> {
  const streak = await getOrCreateStreak(tableName, userId);
  const today = getTodayInTimezone(userTimezone);
  const now = nowIso();

  const result: StreakUpdateResult = {
    streak,
    streakDayAwarded: false,
    welcomeBackAwarded: false,
    milestonesAwarded: [],
    shieldsConsumed: 0,
    streakReset: false,
    gapDays: 0,
  };

  // Already counted today — no streak change needed
  if (streak.lastActiveDate === today) {
    return result;
  }

  let newCurrentStreak = streak.currentStreak;
  let newShieldsHeld = streak.streakShieldsHeld;
  const newShieldUsedDates = [...streak.shieldUsedDates];
  let gapDays = 0;

  if (streak.lastActiveDate) {
    gapDays = daysBetween(streak.lastActiveDate, today);

    if (gapDays === 1) {
      // Consecutive day — streak continues
      newCurrentStreak += 1;
    } else if (gapDays > 1) {
      const missedDays = gapDays - 1;

      // §2.2 — Auto-activate shields
      if (missedDays <= newShieldsHeld) {
        // Shields cover the gap
        result.shieldsConsumed = missedDays;
        newShieldsHeld -= missedDays;
        newCurrentStreak += gapDays; // streak continues through shielded days + today
        // Record shield used dates
        for (let i = 1; i <= missedDays; i++) {
          const shieldDate = new Date(
            new Date(streak.lastActiveDate + "T00:00:00Z").getTime() + i * 24 * 60 * 60 * 1000
          );
          newShieldUsedDates.push(shieldDate.toISOString().slice(0, 10));
        }
      } else {
        // Shields don't cover the gap — streak resets
        result.streakReset = true;
        result.shieldsConsumed = newShieldsHeld;
        newShieldsHeld = 0;
        newCurrentStreak = 1; // Today counts as day 1 of new streak
      }
    }
  } else {
    // First ever active day
    newCurrentStreak = 1;
  }

  result.gapDays = gapDays;

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

  // Compute consistency (§2.3)
  const consistencyLast30 = await computeConsistencyLast30(tableName, userId);

  // Track consistency above 80% for Steady State achievement
  const consistencyPercent = Math.round(((consistencyLast30 + 1) / 30) * 100); // +1 for today
  let consistencyAbove80Since = streak.consistencyAbove80Since;
  if (consistencyPercent >= 80) {
    if (!consistencyAbove80Since) {
      consistencyAbove80Since = today;
    }
  } else {
    consistencyAbove80Since = null;
  }

  // Write updated streak
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: streakSk() },
      UpdateExpression:
        "SET currentStreak = :cs, longestStreak = :ls, lastActiveDate = :lad, lastActiveTimezone = :lat, streakShieldsHeld = :ssh, shieldUsedDates = :sud, consistencyLast30 = :c30, consistencyAbove80Since = :ca80, updatedAt = :now",
      ExpressionAttributeValues: {
        ":cs": newCurrentStreak,
        ":ls": newLongestStreak,
        ":lad": today,
        ":lat": userTimezone,
        ":ssh": newShieldsHeld,
        ":sud": newShieldUsedDates,
        ":c30": consistencyLast30 + 1, // today's activity counted
        ":ca80": consistencyAbove80Since,
        ":now": now,
      },
    })
  );

  result.streak = {
    ...streak,
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastActiveDate: today,
    lastActiveTimezone: userTimezone,
    streakShieldsHeld: newShieldsHeld,
    shieldUsedDates: newShieldUsedDates,
    consistencyLast30: consistencyLast30 + 1,
    consistencyAbove80Since,
    updatedAt: now,
  };

  // §1.1 — Streak day bonus (15 IP, first loop of the day on active streak)
  if (newCurrentStreak >= 1) {
    const streakDayAward = await awardFlowPoints(tableName, {
      userId,
      amount: INSIGHT_POINTS_AMOUNTS.streakDayBonus,
      sourceType: "streak_day",
      sourceId: today,
      metadata: { currentStreak: newCurrentStreak, date: today },
    });
    result.streakDayAwarded = streakDayAward.awarded;
  }

  // §1.1 — Welcome back bonus (30 IP, returning after 7+ inactive days)
  if (gapDays >= 7) {
    const welcomeBackAward = await awardFlowPoints(tableName, {
      userId,
      amount: INSIGHT_POINTS_AMOUNTS.welcomeBack,
      sourceType: "welcome_back",
      sourceId: today,
      metadata: { inactiveDays: gapDays, returnDate: today },
    });
    result.welcomeBackAwarded = welcomeBackAward.awarded;
  }

  // §2.4 — Streak milestone awards
  const newMilestones: number[] = [];
  for (const milestone of STREAK_MILESTONES) {
    if (
      newCurrentStreak >= milestone.days &&
      !streak.milestonesReached.includes(milestone.days)
    ) {
      const milestoneAward = await awardFlowPoints(tableName, {
        userId,
        amount: milestone.ip,
        sourceType: "streak_milestone",
        sourceId: `streak-${milestone.days}`,
        metadata: { days: milestone.days, currentStreak: newCurrentStreak },
      });
      if (milestoneAward.awarded) {
        newMilestones.push(milestone.days);
        result.milestonesAwarded.push(milestone);
      }
    }
  }

  // Persist newly reached milestones
  if (newMilestones.length > 0) {
    const allMilestones = [...streak.milestonesReached, ...newMilestones];
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: streakSk() },
        UpdateExpression: "SET milestonesReached = :mr, updatedAt = :now",
        ExpressionAttributeValues: {
          ":mr": allMilestones,
          ":now": nowIso(),
        },
      })
    );
    result.streak.milestonesReached = allMilestones;
  }

  return result;
}

// ── Streak Shield purchase (§2.2) ───────────────────────────────────────────

export type ShieldPurchaseResult = {
  purchased: boolean;
  error?: "insufficient_balance" | "shields_full";
  shieldsHeld: number;
  balance: number;
};

export async function purchaseStreakShield(
  tableName: string,
  userId: string
): Promise<ShieldPurchaseResult> {
  const streak = await getOrCreateStreak(tableName, userId);

  if (streak.streakShieldsHeld >= 3) {
    return {
      purchased: false,
      error: "shields_full",
      shieldsHeld: streak.streakShieldsHeld,
      balance: 0,
    };
  }

  const cost = 100; // §2.2 — 100 IP per shield
  const now = nowIso();
  const transactionId = crypto.randomUUID();

  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          // Deduct IP from engagement balance
          {
            Update: {
              TableName: tableName,
              Key: { PK: bookUserPk(userId), SK: engagementSk() },
              UpdateExpression:
                "SET updatedAt = :now ADD points :negativeCost, lifetimeSpent :cost, totalSpendEvents :one",
              ConditionExpression: "attribute_exists(points) AND points >= :cost",
              ExpressionAttributeValues: {
                ":now": now,
                ":negativeCost": -cost,
                ":cost": cost,
                ":one": 1,
              },
            },
          },
          // Increment shield count
          {
            Update: {
              TableName: tableName,
              Key: { PK: bookUserPk(userId), SK: streakSk() },
              UpdateExpression: "SET updatedAt = :now ADD streakShieldsHeld :one",
              ConditionExpression: "streakShieldsHeld < :max",
              ExpressionAttributeValues: {
                ":now": now,
                ":one": 1,
                ":max": 3,
              },
            },
          },
          // Ledger entry
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: bookUserPk(userId),
                SK: `FLOWPOINTS#${now}#${transactionId}`,
                entity: "BOOK_USER_FLOW_POINTS_LEDGER",
                userId,
                transactionId,
                direction: "spend",
                amount: cost,
                sourceType: "reward_redemption",
                sourceId: "streak_shield",
                metadata: { rewardName: "Streak Shield" },
                createdAt: now,
                updatedAt: now,
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
        ],
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      return {
        purchased: false,
        error: "insufficient_balance",
        shieldsHeld: streak.streakShieldsHeld,
        balance: 0,
      };
    }
    throw error;
  }

  return {
    purchased: true,
    shieldsHeld: streak.streakShieldsHeld + 1,
    balance: 0, // Caller should re-fetch if needed
  };
}
