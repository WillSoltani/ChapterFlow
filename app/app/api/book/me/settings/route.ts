import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
  assertWithinSizeLimits,
  SETTINGS_VALUE_MAX_CHARS,
} from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { isValidLearningMode } from "@/app/app/api/book/_lib/learning-mode";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserSettingsItem,
  updateUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

const ALLOWED_SETTINGS_KEYS = new Set([
  "reading",
  "learning",
  "goals",
  "notifications",
  "library",
  "appearance",
  "accessibility",
  "privacy",
  "extended",
  "whatsNewSeenAt",
  // SET-1: canonical top-level mirror of settings.extended.learningMode. The
  // IP-economy reads (quiz/check/submit/audio) read this key; the PATCH handler
  // mirrors extended.learningMode → here on every save. See docs/audit-fixes/SET-1.md.
  "learningMode",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const VALID_NOTIFICATION_KEYS = new Set([
  // Server-canonical keys (read by Lambda nudge handlers)
  "channels", "readingReminderEnabled", "reminderTimeLocal", "reminderTimezone",
  "streakReminderEnabled", "badgeCelebrationEnabled", "achievementAlertsEnabled",
  "weeklyDigestEnabled", "welcomeBackEnabled",
  // Client preference keys (not read by Lambda, but legitimate user prefs)
  "notificationsEnabled", "reminderSchedule", "customReminderDays",
  "quietHoursStart", "quietHoursEnd", "chapterUnlockedNotification",
  "reminderToneStyle", "productUpdates", "promotionalEmail",
]);

function validateNotificationPreferences(value: unknown): void {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!VALID_NOTIFICATION_KEYS.has(key)) {
      throw new BookApiError(400, "invalid_notification_prefs", `Unknown notification preference key: ${key}`);
    }
  }
}

function mergeSettings(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    if (isRecord(value) && isRecord(existing[key])) {
      next[key] = mergeSettings(existing[key] as Record<string, unknown>, value);
      continue;
    }
    next[key] = value;
  }

  return next;
}

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const item = await getUserSettingsItem(tableName, user.sub);
    return bookOk({
      settings: item?.settings ?? null,
      updatedAt: item?.updatedAt ?? null,
    });
  });
}

export async function PATCH(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const body = requireBodyObject(bodyRaw);
    const settings =
      body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)
        ? (body.settings as Record<string, unknown>)
        : body;

    // Reject unknown top-level keys to prevent arbitrary data injection
    for (const key of Object.keys(settings)) {
      if (!ALLOWED_SETTINGS_KEYS.has(key)) {
        throw new BookApiError(
          400,
          "invalid_settings_key",
          `Unknown settings key: ${key}`,
        );
      }
    }

    // Cap every string VALUE anywhere in the settings tree. The key allowlist
    // above bounds the shape but not the size — without this, a caller could
    // Put an arbitrarily large string under a legitimate key (e.g.
    // reading.* / appearance.*) and blow the DynamoDB item. (#8)
    assertWithinSizeLimits(settings, SETTINGS_VALUE_MAX_CHARS, "settings");

    if (settings.notifications !== undefined) {
      validateNotificationPreferences(settings.notifications);
    }

    // SET-1: learningMode drives the Insight-Point economy (CHAPTER_FP /
    // LOOP_COMPLETE_IP) and the quiz depth/threshold, read server-side from
    // canonical top-level settings.learningMode. The reader/settings UI persist
    // it under settings.extended.learningMode (the client's source of truth), so
    // mirror extended → top-level on every save so a non-Standard reader is paid
    // and graded on the mode they actually picked. See docs/audit-fixes/SET-1.md.
    const incomingExtended = isRecord(settings.extended) ? settings.extended : undefined;
    const extendedMode = incomingExtended?.learningMode;
    if (isValidLearningMode(extendedMode)) {
      settings.learningMode = extendedMode;
    }
    if (settings.learningMode !== undefined && !isValidLearningMode(settings.learningMode)) {
      throw new BookApiError(
        400,
        "invalid_learning_mode",
        `Unknown learning mode: ${String(settings.learningMode)}`,
      );
    }

    // Read-modify-write under optimistic concurrency so a concurrent write
    // (e.g. a one-click email unsubscribe) cannot be silently clobbered.
    const saved = await updateUserSettingsItem(tableName, user.sub, (current) =>
      mergeSettings(current, settings),
    );

    return bookOk({
      settings: saved.settings,
      updatedAt: saved.updatedAt,
    });
  });
}
