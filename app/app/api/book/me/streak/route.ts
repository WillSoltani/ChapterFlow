import "server-only";

// Implements §2.2 Streak Shield purchase and §2.1 streak state read.

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, requireString, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getOrCreateStreak,
  purchaseStreakShield,
  STREAK_MILESTONES,
} from "@/app/app/api/book/_lib/streak-repo";

export const runtime = "nodejs";

/** GET — Read current streak state */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const streak = await getOrCreateStreak(tableName, user.sub);

    // Find next milestone
    const nextMilestone = STREAK_MILESTONES.find(
      (m) => m.days > streak.currentStreak
    );

    return bookOk({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      shieldsHeld: streak.streakShieldsHeld,
      consistencyScore: Math.min(100, Math.round((streak.consistencyLast30 / 30) * 100)),
      nextMilestone: nextMilestone
        ? {
            days: nextMilestone.days,
            ip: nextMilestone.ip,
            daysRemaining: nextMilestone.days - streak.currentStreak,
          }
        : null,
      milestonesReached: streak.milestonesReached,
    });
  });
}

/** POST — Purchase a Streak Shield (100 IP, max 3 held) */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();

    let action = "purchase_shield";
    try {
      const bodyRaw = await req.json();
      const body = requireBodyObject(bodyRaw);
      action = requireString(body.action, "action", { maxLength: 50 });
    } catch {
      // Default action
    }

    if (action !== "purchase_shield") {
      throw new BookApiError(400, "invalid_action", `Unknown action: ${action}`);
    }

    const tableName = await getBookTableName();
    const result = await purchaseStreakShield(tableName, user.sub);

    if (!result.purchased) {
      const message =
        result.error === "shields_full"
          ? "You already hold the maximum of 3 Streak Shields."
          : "Insufficient Insight Points balance.";
      throw new BookApiError(400, result.error ?? "purchase_failed", message);
    }

    return bookOk({
      ok: true,
      shieldsHeld: result.shieldsHeld,
      balance: result.balance,
      message: "Streak Shield purchased. It will automatically protect your streak if you miss a day.",
    });
  });
}
