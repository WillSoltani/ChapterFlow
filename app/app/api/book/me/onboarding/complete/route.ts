import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  bookErr,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserSettingsItem,
  putUserSettingsItem,
  getUserProfileItem,
  putUserProfileItem,
} from "@/app/app/api/book/_lib/repo";
import { generateStarterPrescription } from "@/app/app/api/book/_lib/starter-prescription";
import {
  awardFlowPoints,
  createReferralClaimFromCode,
} from "@/app/app/api/book/_lib/flow-points-repo";
import { updateStreakOnLoopComplete } from "@/app/app/api/book/_lib/streak-repo";
import {
  analyticsTrackOnboarding,
  analyticsTrackFlowPointsTransaction,
  analyticsTrackReferral,
} from "@/app/app/api/book/_lib/analytics-repo";
import { recordRiskSignals } from "@/app/app/api/book/_lib/abuse";
import { getAuthCookieBase } from "@/app/auth/_lib/auth-cookie";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import { LEGAL_TERMS_VERSION } from "@/lib/legal-entity";
import {
  INSIGHT_POINTS_AMOUNTS,
  REFERRAL_ATTRIBUTION_COOKIE_NAME,
} from "@/app/book/_lib/flow-points-economy";

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

/** Read a single cookie value off the request header (mirrors profile/route.ts). */
function readCookieValue(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const value = decodeURIComponent(trimmed.slice(prefix.length)).trim();
    return value || null;
  }
  return null;
}

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
    const user = await requireActiveBookUser();
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

    // IANA timezone for streak day-boundary math; safe default if absent.
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "UTC";

    /* ── Build the onboarding profile ── */

    const scenarioFocus = MOTIVATION_TO_SCENARIO_FOCUS[motivation] || "mixed";

    const cleanInterests = interests.filter((i: unknown): i is string => typeof i === "string");
    const cleanShelf = starterShelf.filter((id: unknown): id is string => typeof id === "string");
    const starterPrescription = generateStarterPrescription(motivation, cleanInterests, cleanShelf);

    const onboardingProfile = {
      motivation,
      interests: cleanInterests,
      tone,
      dailyGoal,
      chapterOrder,
      scenarioFocus,
      starterShelf: cleanShelf,
      firstQuizScore,
      firstChapterCompleted: true,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString(),
      onboardingVersion: "v2",
      starterPrescription,
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

    /* ── Grant the rewards the unlock celebration promises ──
     *
     * The celebration shows "120 Insight Points" and "1 Day streak"; previously
     * the new /onboarding flow wrote settings only and granted neither, so the
     * dashboard the user landed on contradicted the celebration. Both grants
     * here are idempotent and must never fail onboarding completion (the
     * profile is already saved):
     *   • awardFlowPoints is keyed on the shared grant
     *     POINTSGRANT#onboarding_complete#primary, so a refresh, a double-submit,
     *     or the legacy profile-PATCH path can't double-award the 120 IP.
     *   • updateStreakOnLoopComplete counts onboarding's first learning loop as
     *     the user's first active day (currentStreak → 1); it's a no-op once
     *     today is already counted, so it can't inflate an existing streak.
     */
    let points: number | undefined;
    let currentStreak: number | undefined;
    // True only on the first real completion (the idempotent award actually
    // credited points). Gates the one-time first-completion side-effects below
    // so a refresh / double-submit / legacy profile-PATCH can't re-fire them.
    let firstCompletion = false;
    try {
      const award = await awardFlowPoints(tableName, {
        userId: user.sub,
        amount: INSIGHT_POINTS_AMOUNTS.onboardingComplete,
        sourceType: "onboarding_complete",
        sourceId: "primary",
        metadata: { readingGoal: motivation },
      });
      points = award.state?.points;
      firstCompletion = award.awarded;
    } catch {
      /* non-fatal — onboarding is already saved */
    }
    try {
      const streakResult = await updateStreakOnLoopComplete(tableName, user.sub, timezone);
      currentStreak = streakResult.streak.currentStreak;
    } catch {
      /* non-fatal */
    }

    /* ── First-completion side-effects ──
     *
     * The legacy completion path lived in PATCH /me/profile (the
     * `completedOnboardingNow` block). The new /onboarding flow posts here
     * instead, so without these the route silently dropped referral
     * attribution, onboarding analytics, the flow-points transaction event, and
     * risk signals. All are gated by `firstCompletion` (the award's `awarded`
     * flag) so they run exactly once, and each is best-effort — never failing a
     * completion whose profile is already saved.
     */
    let clearReferralCookie = false;
    if (firstCompletion) {
      // Referral attribution — consume the invite cookie and credit the inviter.
      const pendingReferralCode = readCookieValue(req, REFERRAL_ATTRIBUTION_COOKIE_NAME);
      if (pendingReferralCode) {
        clearReferralCookie = true;
        try {
          const referralClaim = await createReferralClaimFromCode(tableName, {
            invitedUserId: user.sub,
            inviteCode: pendingReferralCode,
          });
          if (referralClaim.created) {
            getBookAnalyticsTableName()
              .then((analyticsTable) => {
                if (!analyticsTable) return;
                return analyticsTrackReferral(analyticsTable, {
                  userId: referralClaim.claim.inviterUserId,
                  eventType: "referral_claimed",
                  inviteCode: referralClaim.claim.inviteCode,
                  referredUserId: user.sub,
                });
              })
              .catch(() => {});
          }
        } catch {
          /* non-fatal */
        }
      }

      // Risk signals — same event name the legacy path recorded.
      await recordRiskSignals(tableName, req, user, "onboarding_completed").catch(() => null);

      // Analytics — onboardingCompletedAt + the earn transaction. segment-engine
      // and admin-metrics read the analytics table (NOT settings.onboarding.*),
      // so this is what actually marks the user as onboarded.
      getBookAnalyticsTableName()
        .then(async (analyticsTable) => {
          if (!analyticsTable) return;
          await Promise.allSettled([
            analyticsTrackOnboarding(analyticsTable, {
              userId: user.sub,
              email: user.email,
              goal: motivation,
              dailyGoalMinutes: dailyGoal,
              selectedCategories: cleanInterests.length ? cleanInterests : undefined,
              selectedBookIds: cleanShelf.length ? cleanShelf : undefined,
            }),
            analyticsTrackFlowPointsTransaction(analyticsTable, {
              userId: user.sub,
              deltaPoints: INSIGHT_POINTS_AMOUNTS.onboardingComplete,
              direction: "earn",
              sourceType: "onboarding_complete",
              sourceId: "primary",
              metadata: { readingGoal: motivation },
            }),
          ]);
        })
        .catch(() => {});

      // Terms/Privacy acceptance stamp — server-authoritative, recorded on the
      // profile item (where the legacy path and the profile reader expect it).
      // Only stamp if not already present, so a prior acceptance is preserved.
      try {
        const profileItem = await getUserProfileItem(tableName, user.sub);
        const existingProfile = (profileItem?.profile ?? {}) as Record<string, unknown>;
        if (typeof existingProfile.termsAcceptedAt !== "string") {
          await putUserProfileItem(tableName, {
            userId: user.sub,
            profile: {
              ...existingProfile,
              termsAcceptedAt: nowIso(),
              termsVersion: LEGAL_TERMS_VERSION,
            },
            createdAt: profileItem?.createdAt,
          });
        }
      } catch {
        /* non-fatal */
      }
    }

    const response = bookOk({
      success: true,
      settings: saved.settings,
      updatedAt: saved.updatedAt,
      points,
      currentStreak,
    });
    if (clearReferralCookie) {
      response.cookies.set(REFERRAL_ATTRIBUTION_COOKIE_NAME, "", {
        ...getAuthCookieBase(),
        maxAge: 0,
      });
    }
    return response;
  });
}
