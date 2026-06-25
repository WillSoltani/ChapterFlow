import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReminderSchedulePatch,
  buildReadingReminderTogglePatch,
} from "./reminder-consent-core";

// ── F4 regression ──────────────────────────────────────────────────────────
// The reading-reminder cron sends the reminder EMAIL only when
// `settings.notifications.channels.email === true` (emailChannelConsented, the
// canonical opt-IN gate). Before this fix the settings UI never wrote that flag,
// so the gate was unsatisfiable and the email NEVER sent. These tests pin that
// BOTH reminder PATCH builders now carry the email opt-in, so the gate is
// reachable. They FAIL on the pre-fix payloads (which omitted channels).

test("buildReminderSchedulePatch carries the canonical send-time fields", () => {
  const patch = buildReminderSchedulePatch("07:30", "America/Toronto");
  assert.equal(patch.settings.notifications.reminderTimeLocal, "07:30");
  assert.equal(patch.settings.notifications.reminderTimezone, "America/Toronto");
});

test("buildReminderSchedulePatch opts the user into the email channel (F4)", () => {
  const patch = buildReminderSchedulePatch("07:30", "America/Toronto");
  // This is exactly the condition emailChannelConsented() checks in the cron.
  assert.equal(patch.settings.notifications.channels.email, true);
});

test("enabling reading reminders with a time persists schedule + email opt-in", () => {
  const patch = buildReadingReminderTogglePatch(true, "Europe/London", "21:00");
  assert.ok(patch, "enabling must produce a PATCH body");
  const notif = (patch as ReturnType<typeof buildReminderSchedulePatch>).settings
    .notifications;
  assert.equal(notif.reminderTimeLocal, "21:00");
  assert.equal(notif.reminderTimezone, "Europe/London");
  assert.equal(notif.channels.email, true);
});

test("enabling reading reminders without a known time still records the email opt-in", () => {
  const patch = buildReadingReminderTogglePatch(true, "Europe/London");
  assert.ok(patch);
  const notif = patch!.settings.notifications as { channels: { email: boolean } };
  // The cron's gate only needs channels.email === true to become satisfiable;
  // the send-time fields default to 20:00/UTC server-side until set explicitly.
  assert.equal(notif.channels.email, true);
});

test("enabling with an empty-string time is treated as no-time (opt-in only)", () => {
  const patch = buildReadingReminderTogglePatch(true, "Europe/London", "");
  assert.ok(patch);
  const notif = patch!.settings.notifications as Record<string, unknown>;
  assert.equal((notif.channels as { email: boolean }).email, true);
  // No schedule fields seeded from an empty time string.
  assert.equal("reminderTimeLocal" in notif, false);
});

test("disabling reading reminders does NOT mutate email consent", () => {
  // Opt-OUT is owned solely by the one-click unsubscribe route. Disabling
  // reminders must not silently clear channels.email (the master toggle also
  // governing weekly digest / welcome-back / notification emails), so the
  // builder returns null and the caller skips the dedicated PATCH entirely.
  assert.equal(buildReadingReminderTogglePatch(false, "Europe/London", "21:00"), null);
  assert.equal(buildReadingReminderTogglePatch(false, "Europe/London"), null);
});
