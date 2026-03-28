import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  bookErr,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserSettingsItem,
  putUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/* ── Validation helpers ── */

const VALID_MOTIVATIONS = ["career", "academic", "personal", "curiosity"] as const;
const VALID_TONES = ["gentle", "direct", "competitive"] as const;
const VALID_DAILY_GOALS = [10, 20, 30] as const;
const VALID_CHAPTER_ORDERS = ["summary_first", "scenarios_first"] as const;

const MOTIVATION_TO_SCENARIO_FOCUS: Record<string, string> = {
  career: "work",
  academic: "school",
  personal: "personal",
  curiosity: "mixed",
};

/**
 * POST /api/book/me/onboarding/complete
 *
 * Saves the full onboarding profile into the user's settings item.
 * Uses the existing SETTINGS item (BOOKUSER#{userId} / SETTINGS) so
 * all user preferences live in one place.
 *
 * The onboarding data is stored under a top-level `onboarding` key
 * within the settings object.
 */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const body = requireBodyObject(await req.json());

    /* ── Extract & coerce (lenient — never reject onboarding completion) ── */

    const rawMotivation = body.motivation as string;
    const motivation = VALID_MOTIVATIONS.includes(rawMotivation as typeof VALID_MOTIVATIONS[number])
      ? rawMotivation
      : "curiosity";

    const rawInterests = body.interests;
    const interests = Array.isArray(rawInterests) && rawInterests.length > 0
      ? rawInterests
      : ["general"];

    const rawTone = body.tone as string;
    const tone = VALID_TONES.includes(rawTone as typeof VALID_TONES[number])
      ? rawTone
      : "direct";

    const rawDailyGoal = Number(body.dailyGoal);
    const dailyGoal = VALID_DAILY_GOALS.includes(rawDailyGoal as typeof VALID_DAILY_GOALS[number])
      ? rawDailyGoal
      : 20;

    const rawChapterOrder = body.chapterOrder as string;
    const chapterOrder = VALID_CHAPTER_ORDERS.includes(rawChapterOrder as typeof VALID_CHAPTER_ORDERS[number])
      ? rawChapterOrder
      : "summary_first";

    const rawStarterShelf = body.starterShelf;
    const starterShelf = Array.isArray(rawStarterShelf) && rawStarterShelf.length > 0
      ? rawStarterShelf
      : [];

    const firstQuizScore = typeof body.firstQuizScore === "number" ? body.firstQuizScore : 0;

    /* ── Build the onboarding profile ── */

    const scenarioFocus = MOTIVATION_TO_SCENARIO_FOCUS[motivation] || "mixed";

    const onboardingProfile = {
      motivation,
      interests: interests.filter((i: unknown): i is string => typeof i === "string"),
      tone,
      dailyGoal,
      chapterOrder,
      scenarioFocus,
      starterShelf: starterShelf.filter((id: unknown): id is string => typeof id === "string"),
      firstQuizScore,
      firstChapterCompleted: true,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString(),
      onboardingVersion: "v2",
    };

    /* ── Merge into existing settings ── */

    const existing = await getUserSettingsItem(tableName, user.sub);
    const currentSettings = existing?.settings ?? {};

    const mergedSettings: Record<string, unknown> = {
      ...currentSettings,
      onboarding: onboardingProfile,
      // Also hoist key preferences to top-level for easy access
      tone,
      dailyGoal,
      chapterOrder,
      scenarioFocus,
    };

    const saved = await putUserSettingsItem(tableName, {
      userId: user.sub,
      settings: mergedSettings,
      createdAt: existing?.createdAt,
    });

    return bookOk({
      success: true,
      settings: saved.settings,
      updatedAt: saved.updatedAt,
    });
  });
}
