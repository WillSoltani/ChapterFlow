import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookErr,
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserProfileItem,
  putUserProfileItem,
} from "@/app/app/api/book/_lib/repo";
import { analyticsTrackOnboarding } from "@/app/app/api/book/_lib/analytics-repo";
import { resolveBookIdentity } from "@/app/app/api/book/_lib/identity";
import { inferLocationFromHeaders } from "@/app/app/api/book/_lib/location";
import { applyDeviceIdCookie, getOrCreateDeviceId, recordRiskSignals } from "@/app/app/api/book/_lib/abuse";
import {
  CHAPTER_START_MODE_VALUES,
  PREFERRED_EXAMPLE_CONTEXT_VALUES,
} from "@/app/book/_lib/onboarding-personalization";

const AVATAR_ACCENTS = new Set(["sky", "emerald", "amber", "rose"]);
const PROFILE_VISIBILITY = new Set(["private", "friends", "public"]);
const READING_GOALS = new Set(["career", "decisions", "skills", "personal", "curiosity"]);
const REFERRAL_SOURCES = new Set([
  "Social media",
  "Word of mouth",
  "Search engine",
  "Newsletter",
  "Other",
]);
const LEARNING_STYLES = new Set(["concise", "balanced", "deep"]);
const QUIZ_INTENSITIES = new Set(["easy", "standard", "challenging"]);
const MOTIVATION_STYLES = new Set(["gentle", "direct", "competitive"]);
const REFERRAL_OTHER_TEXT_MAX_LENGTH = 120;
const CHAPTER_START_MODES = new Set(CHAPTER_START_MODE_VALUES);
const PREFERRED_EXAMPLE_CONTEXTS = new Set(PREFERRED_EXAMPLE_CONTEXT_VALUES);

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function hasOwnField(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function cleanNullableString(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === null) return null;
  return cleanString(value, maxLength);
}

function cleanBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function cleanEnum<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : undefined;
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((entry) => entry.slice(0, maxLength));
}

function cleanDisplayName(value: unknown): string | undefined {
  return cleanString(value, 80);
}

function cleanUsername(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
  return normalized || undefined;
}

function cleanMinutes(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(240, Math.max(10, Math.round(value)));
}

function cleanReminderTime(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : undefined;
}

function cleanNullableReminderTime(value: unknown): string | null | undefined {
  if (value === null) return null;
  return cleanReminderTime(value);
}

function cleanAvatarDataUrl(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 400_000) : null;
}

function sanitizeProfile(profile: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const raw = parseRecord(profile);
  const next: Record<string, unknown> = {};

  const displayName = cleanDisplayName(raw.displayName);
  if (displayName) next.displayName = displayName;

  const username = cleanUsername(raw.username);
  if (username) next.username = username;

  const tagline = cleanString(raw.tagline, 160);
  if (tagline) next.tagline = tagline;

  const bio = cleanString(raw.bio, 1_200);
  if (bio) next.bio = bio;

  const timezone = cleanString(raw.timezone, 80);
  if (timezone) next.timezone = timezone;

  const country = cleanString(raw.country, 80);
  if (country) next.country = country;

  const occupation = cleanString(raw.occupation, 80);
  if (occupation) next.occupation = occupation;

  const pronouns = cleanString(raw.pronouns, 80);
  if (pronouns) next.pronouns = pronouns;

  const readingGoal = cleanEnum(raw.readingGoal, READING_GOALS);
  if (readingGoal) next.readingGoal = readingGoal;

  const hasReferralSource = hasOwnField(raw, "referralSource");
  const referralSource = cleanEnum(raw.referralSource, REFERRAL_SOURCES);
  if (referralSource) next.referralSource = referralSource;
  else if (hasReferralSource && raw.referralSource === null) next.referralSource = null;

  const referralSourceOtherText = cleanNullableString(
    raw.referralSourceOtherText,
    REFERRAL_OTHER_TEXT_MAX_LENGTH
  );
  if (referralSource === "Other") {
    if (typeof referralSourceOtherText === "string") {
      next.referralSourceOtherText = referralSourceOtherText;
    } else if (referralSourceOtherText === null || hasReferralSource) {
      next.referralSourceOtherText = null;
    }
  } else if (referralSource && referralSource !== "Other") {
    next.referralSourceOtherText = null;
  } else if (referralSourceOtherText === null) {
    next.referralSourceOtherText = null;
  }

  const learningStyle = cleanEnum(raw.learningStyle, LEARNING_STYLES);
  if (learningStyle) next.learningStyle = learningStyle;

  const chapterStartMode = cleanEnum(raw.chapterStartMode, CHAPTER_START_MODES);
  if (chapterStartMode) next.chapterStartMode = chapterStartMode;

  const preferredExampleContext = cleanEnum(
    raw.preferredExampleContext,
    PREFERRED_EXAMPLE_CONTEXTS
  );
  if (preferredExampleContext) next.preferredExampleContext = preferredExampleContext;

  const quizIntensity = cleanEnum(raw.quizIntensity, QUIZ_INTENSITIES);
  if (quizIntensity) next.quizIntensity = quizIntensity;

  const motivationStyle = cleanEnum(raw.motivationStyle, MOTIVATION_STYLES);
  if (motivationStyle) next.motivationStyle = motivationStyle;

  const hasReminderTime = hasOwnField(raw, "reminderTime");
  const reminderTime = cleanNullableReminderTime(raw.reminderTime);
  if (typeof reminderTime === "string") next.reminderTime = reminderTime;
  else if (hasReminderTime && reminderTime === null) next.reminderTime = null;

  const avatarAccent = cleanEnum(raw.avatarAccent, AVATAR_ACCENTS);
  if (avatarAccent) next.avatarAccent = avatarAccent;

  const avatarDataUrl = cleanAvatarDataUrl(raw.avatarDataUrl);
  if (avatarDataUrl !== undefined) next.avatarDataUrl = avatarDataUrl;

  const createdAt = cleanString(raw.createdAt, 64);
  if (createdAt) next.createdAt = createdAt;

  const profileVisibility = cleanEnum(raw.profileVisibility, PROFILE_VISIBILITY);
  if (profileVisibility) next.profileVisibility = profileVisibility;

  const selectedCategories = cleanStringArray(raw.selectedCategories, 3, 48);
  if (selectedCategories) next.selectedCategories = selectedCategories;

  const selectedBookIds = cleanStringArray(raw.selectedBookIds, 3, 80);
  if (selectedBookIds) next.selectedBookIds = selectedBookIds;

  const dailyGoalMinutes = cleanMinutes(raw.dailyGoalMinutes);
  if (dailyGoalMinutes !== undefined) next.dailyGoalMinutes = dailyGoalMinutes;

  const onboardingCompleted = cleanBoolean(raw.onboardingCompleted);
  if (onboardingCompleted === true) next.onboardingCompleted = true;

  const streakMode = cleanBoolean(raw.streakMode);
  if (streakMode !== undefined) next.streakMode = streakMode;

  const showReadingStatsPublic = cleanBoolean(raw.showReadingStatsPublic);
  if (showReadingStatsPublic !== undefined) next.showReadingStatsPublic = showReadingStatsPublic;

  const showBadgesPublic = cleanBoolean(raw.showBadgesPublic);
  if (showBadgesPublic !== undefined) next.showBadgesPublic = showBadgesPublic;

  const showReadingHistoryPublic = cleanBoolean(raw.showReadingHistoryPublic);
  if (showReadingHistoryPublic !== undefined) {
    next.showReadingHistoryPublic = showReadingHistoryPublic;
  }

  return next;
}

function sanitizeProfileForResponse(
  profile: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const sanitized = sanitizeProfile(profile);
  return Object.fromEntries(
    Object.entries(sanitized).filter(
      ([key, value]) => value !== null || key === "avatarDataUrl"
    )
  );
}

function buildProfileResponse(
  req: Request,
  user: Awaited<ReturnType<typeof requireUser>>,
  profile: Record<string, unknown> | null,
  updatedAt: string | null,
  options?: { deviceId?: string; issuedDeviceId?: boolean }
) {
  const sanitizedProfile = sanitizeProfileForResponse(profile);
  const response = bookOk({
    profile: Object.keys(sanitizedProfile).length ? sanitizedProfile : null,
    identity: resolveBookIdentity(user, sanitizedProfile),
    inferredLocation: inferLocationFromHeaders(req.headers),
    updatedAt,
  });
  const existingDevice = getOrCreateDeviceId(req);
  const deviceId = options?.deviceId ?? existingDevice.deviceId;
  const issued = options?.issuedDeviceId ?? existingDevice.issued;
  if (issued && deviceId) {
    applyDeviceIdCookie(response, deviceId, true);
  }
  return response;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const item = await getUserProfileItem(tableName, user.sub);
    return buildProfileResponse(req, user, item?.profile ?? null, item?.updatedAt ?? null);
  });
}

export async function PATCH(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const existing = await getUserProfileItem(tableName, user.sub);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const body = requireBodyObject(bodyRaw);
    const incomingProfile =
      body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)
        ? (body.profile as Record<string, unknown>)
        : body;
    const incomingReferralSource = cleanEnum(
      incomingProfile.referralSource,
      REFERRAL_SOURCES
    );
    const incomingReferralSourceOtherText = cleanString(
      incomingProfile.referralSourceOtherText,
      REFERRAL_OTHER_TEXT_MAX_LENGTH
    );
    const touchesReferralSource =
      hasOwnField(incomingProfile, "referralSource") ||
      hasOwnField(incomingProfile, "referralSourceOtherText");
    if (
      touchesReferralSource &&
      incomingReferralSource === "Other" &&
      !incomingReferralSourceOtherText
    ) {
      return bookErr(
        req,
        400,
        "invalid_input",
        "Tell us where you found ChapterFlow when you choose Other.",
        { field: "referralSourceOtherText" }
      );
    }

    const previousProfile = sanitizeProfile(existing?.profile ?? null);
    const sanitizedIncoming = sanitizeProfile(incomingProfile);
    const profile = {
      ...previousProfile,
      ...sanitizedIncoming,
    };

    const saved = await putUserProfileItem(tableName, {
      userId: user.sub,
      profile,
      createdAt: existing?.createdAt,
    });

    const completedOnboardingNow =
      previousProfile.onboardingCompleted !== true && profile.onboardingCompleted === true;
    let riskDevice: Awaited<ReturnType<typeof recordRiskSignals>> | null = null;

    if (completedOnboardingNow) {
      riskDevice = await recordRiskSignals(tableName, req, user, "onboarding_completed").catch(
        () => null
      );
      getBookAnalyticsTableName().then((analyticsTable) => {
        if (!analyticsTable) return;
        analyticsTrackOnboarding(analyticsTable, {
          userId: user.sub,
          email: user.email,
          goal:
            typeof profile.readingGoal === "string"
              ? profile.readingGoal
              : typeof profile.goal === "string"
                ? profile.goal
                : undefined,
          dailyGoalMinutes:
            typeof profile.dailyGoalMinutes === "number" ? profile.dailyGoalMinutes : undefined,
          selectedCategories: Array.isArray(profile.selectedCategories)
            ? (profile.selectedCategories as unknown[]).filter(
                (c): c is string => typeof c === "string"
              )
            : undefined,
          selectedBookIds: Array.isArray(profile.selectedBookIds)
            ? (profile.selectedBookIds as unknown[]).filter(
                (id): id is string => typeof id === "string"
              )
            : undefined,
        }).catch(() => {});
      }).catch(() => {});
    }

    return buildProfileResponse(req, user, saved.profile, saved.updatedAt, {
      deviceId: riskDevice?.deviceId,
      issuedDeviceId: riskDevice?.issuedDeviceId,
    });
  });
}
