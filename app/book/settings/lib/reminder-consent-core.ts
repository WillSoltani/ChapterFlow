/**
 * Pure builders for the reading-reminder settings PATCH payloads.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The reading-reminder cron (infra/lambda/reading-reminder-cron.ts) sends the
 * reminder EMAIL only when the user has opted into the email channel — its gate
 * is `emailChannelConsented(...)` → `settings.notifications.channels.email ===
 * true` (the canonical opt-IN model shared by every infra/lambda email sender,
 * matching app notifications-repo.ts and PR 309). Before this fix the settings
 * UI never wrote `channels.email` anywhere, so the gate was unsatisfiable and
 * the reminder email NEVER sent — users got the in-app notification only.
 *
 * Enabling reading reminders (and picking a reminder time) is an explicit,
 * unambiguous request to be reminded — by email as well as in-app — so it is the
 * correct opt-IN moment. These builders attach `channels.email: true` to the
 * dedicated reminder PATCH that already rides outside the preferences
 * full-state sync (the H26 reminderTimeLocal/reminderTimezone PATCH).
 *
 * Opt-OUT is intentionally NOT modelled here. Disabling reading reminders only
 * stops the reminder cron (it gates on `readingReminderEnabled`); it must NOT
 * silently clear `channels.email`, which is the MASTER email toggle also
 * governing the weekly digest, welcome-back, and notification emails. The sole
 * email opt-out path is the one-click unsubscribe route (writes
 * `channels.email: false`), so opt-in and opt-out stay symmetric there.
 *
 * Kept as a server-only-free pure module so it is unit-testable via node:test
 * (the BookSettingsClient component cannot be imported under the test runner).
 */

export type NotificationChannelsPatch = {
  channels: { email: true };
};

export type ReminderSchedulePatch = {
  settings: {
    notifications: {
      reminderTimeLocal: string;
      reminderTimezone: string;
    } & NotificationChannelsPatch;
  };
};

/**
 * The PATCH body sent when a user sets/changes their reminder time. Persists the
 * canonical send-time fields the cron reads AND the email opt-in, so a reminder
 * time without an email channel can never exist (the bug this fixes).
 *
 * mergeSettings on the server deep-merges, so emitting `channels: { email: true }`
 * only ADDS the email opt-in; it never disturbs sibling channel keys
 * (`inApp`/`push`) the user may already have.
 */
export function buildReminderSchedulePatch(
  timeLocal: string,
  timezone: string,
): ReminderSchedulePatch {
  return {
    settings: {
      notifications: {
        reminderTimeLocal: timeLocal,
        reminderTimezone: timezone,
        channels: { email: true },
      },
    },
  };
}

/**
 * The PATCH body for the reading-reminder ON/OFF toggle.
 *
 * Enabling → record the email opt-in (so the cron gate becomes satisfiable) and,
 * when we have a concrete time, also seed the canonical send-time fields so the
 * very first enable is immediately deliverable rather than waiting on the
 * deferred backfill.
 *
 * Disabling → no email-consent mutation (see module header): returns `null` so
 * the caller skips the dedicated PATCH entirely and lets the preferences
 * full-state sync persist `readingReminderEnabled: false` on its own.
 */
export function buildReadingReminderTogglePatch(
  enabled: boolean,
  timezone: string,
  timeLocal?: string,
): ReminderSchedulePatch | { settings: { notifications: NotificationChannelsPatch } } | null {
  if (!enabled) return null;

  if (typeof timeLocal === "string" && timeLocal.length > 0) {
    return buildReminderSchedulePatch(timeLocal, timezone);
  }

  return {
    settings: {
      notifications: {
        channels: { email: true },
      },
    },
  };
}
