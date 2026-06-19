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
import {
  awardFlowPoints,
  getUserFlowPointsState,
} from "@/app/app/api/book/_lib/flow-points-repo";
import {
  DEFAULT_STREAK_MODE,
  type StreakMode,
} from "@/app/app/api/book/_lib/streak-mode";
import { decideStreakOnActiveDay } from "@/app/app/api/book/_lib/streak-policy";

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
  /** True when flexible-mode skip tolerance forgave a gap (no shield consumed). */
  flexibleSkipApplied: boolean;
  /** Days since last active date (0 = same day, 1 = consecutive). Used for second-wind detection. */
  gapDays: number;
};

export async function updateStreakOnLoopComplete(
  tableName: string,
  userId: string,
  userTimezone: string,
  /**
   * SET-7 — streak-mode options, resolved server-side from stored settings
   * (streak-mode.ts) to keep the streak/IP economy un-gameable. Optional and
   * defaulting to `standard` with no skip tolerance, so existing callers and the
   * onboarding first-day path (mode-invariant — it is always day 1) keep their
   * exact prior behavior.
   */
  options?: { mode?: StreakMode; skipDays?: number },
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
    flexibleSkipApplied: false,
    gapDays: 0,
  };

  // Already counted today — no streak change needed
  if (streak.lastActiveDate === today) {
    return result;
  }

  // Pure decision (calendar math + state transition) — see streak-policy.ts.
  const decision = decideStreakOnActiveDay({
    lastActiveDate: streak.lastActiveDate,
    today,
    currentStreak: streak.currentStreak,
    shieldsHeld: streak.streakShieldsHeld,
    mode: options?.mode ?? DEFAULT_STREAK_MODE,
    // Fail SAFE when a caller omits skipDays: 0 = no tolerance (degrades to
    // standard reset), never inflates a streak. This is deliberately distinct
    // from streak-mode.ts DEFAULT_STREAK_SKIP_DAYS (the product default applied
    // by resolveStreakSkipDays when the *user setting* is absent); the engine
    // must not assume a tolerance the caller didn't resolve from settings.
    skipDays: options?.skipDays ?? 0,
  });

  const newCurrentStreak = decision.newCurrentStreak;
  const newShieldsHeld = decision.newShieldsHeld;
  const newShieldUsedDates = [...streak.shieldUsedDates, ...decision.appendedShieldDates];
  const gapDays = decision.gapDays;

  result.shieldsConsumed = decision.shieldsConsumed;
  result.streakReset = decision.streakReset;
  result.flexibleSkipApplied = decision.flexibleSkipApplied;
  result.gapDays = gapDays;

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

  // Compute consistency (§2.3). The query already includes today once the
  // reading-session beacon has written today's READINGDAY record, so no +1 is
  // added here — adding one double-counted today and let the score exceed 100%
  // (e.g. 31/30 -> 103% when the beacon already wrote today's READINGDAY).
  const consistencyLast30 = await computeConsistencyLast30(tableName, userId);

  // Track consistency above 80% for Steady State achievement.
  const consistencyPercent = Math.round((consistencyLast30 / 30) * 100);
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
        ":c30": consistencyLast30, // query already counts today's READINGDAY
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
    consistencyLast30,
    consistencyAbove80Since,
    updatedAt: now,
  };

  // §1.1 — Streak day bonus (15 IP, first loop of the day on active streak)
  // The grant is deduped per user-tz day (the same day the streak decision uses
  // above) rather than the UTC day. For negative UTC offsets two consecutive
  // local days can collapse onto a single UTC date, which would reject the
  // second day's bonus as a duplicate; keying by the local day prevents that
  // drift. Scoping the sourceId by userId keeps per-user-per-local-day
  // uniqueness, so timezone switching can shift the day boundary by at most one
  // award — it can never multiply the bonus.
  const streakDaySourceId = `${userId}:${today}`;
  if (newCurrentStreak >= 1) {
    const streakDayAward = await awardFlowPoints(tableName, {
      userId,
      amount: INSIGHT_POINTS_AMOUNTS.streakDayBonus,
      sourceType: "streak_day",
      sourceId: streakDaySourceId,
      metadata: { currentStreak: newCurrentStreak, date: today },
    });
    result.streakDayAwarded = streakDayAward.awarded;
  }

  // §1.1 — Welcome back bonus (30 IP, returning after 7+ inactive days)
  // Keyed by the same per-user local day as the streak decision (see above).
  if (gapDays >= 7) {
    const welcomeBackAward = await awardFlowPoints(tableName, {
      userId,
      amount: INSIGHT_POINTS_AMOUNTS.welcomeBack,
      sourceType: "welcome_back",
      sourceId: streakDaySourceId,
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
    // No points were touched — report the current balance so the caller can
    // surface an accurate figure instead of a stale 0.
    const state = await getUserFlowPointsState(tableName, userId);
    return {
      purchased: false,
      error: "shields_full",
      shieldsHeld: streak.streakShieldsHeld,
      balance: state.points,
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
      // The TransactWrite was rejected atomically, so no points were deducted —
      // report the real current balance rather than a stale 0.
      const state = await getUserFlowPointsState(tableName, userId);
      return {
        purchased: false,
        error: "insufficient_balance",
        shieldsHeld: streak.streakShieldsHeld,
        balance: state.points,
      };
    }
    throw error;
  }

  // Re-read the engagement balance after the atomic deduction so the caller can
  // surface an accurate post-purchase IP balance without a separate round-trip.
  const state = await getUserFlowPointsState(tableName, userId);
  return {
    purchased: true,
    shieldsHeld: streak.streakShieldsHeld + 1,
    balance: state.points,
  };
}
