/**
 * SET-7 — streak-mode resolution (single source of truth).
 *
 * Streak mode (off / standard / flexible) is the per-reader streak-tolerance
 * lever. Server-side it drives `updateStreakOnLoopComplete` (streak-repo.ts):
 * a `flexible` reader with `skipDays` set keeps their streak across short gaps
 * (see streak-policy.ts for the exact rule), while `standard`/`off` reset on the
 * first un-shielded missed day exactly as before.
 *
 * Storage: the settings UI persists the chosen mode + skip-day count under
 * `settings.extended.streakMode` / `settings.extended.streakSkipDays` (the
 * client's source of truth, and the same key the reading-reminder Lambda reads
 * via `item.settings?.extended?.streakMode`). There is no top-level mirror — the
 * onboarding flow's boolean `settings.onboarding.streakMode` is a separate,
 * coarse on/off field and is intentionally ignored here.
 *
 * Resolving server-side (rather than trusting the request body) keeps the streak
 * — and therefore the IP economy it feeds (streak_day / welcome_back /
 * streak_milestone) — un-gameable: a reader cannot claim `flexible` per-request
 * to dodge a reset. Kept free of `server-only` / AWS imports so it can be
 * unit-tested directly. See docs/audit-fixes/SET-7.md.
 */

export type StreakMode = "off" | "standard" | "flexible";

export const DEFAULT_STREAK_MODE: StreakMode = "standard";

/** Clamp bounds for the skip-day stepper (mirrors the Settings UI: 1..3). */
export const MAX_STREAK_SKIP_DAYS = 3;
export const DEFAULT_STREAK_SKIP_DAYS = 1;

export function isValidStreakMode(value: unknown): value is StreakMode {
  return value === "off" || value === "standard" || value === "flexible";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolve the effective streak mode from a stored settings object. Reads
 * `settings.extended.streakMode` (the client source of truth + the key the
 * reminder Lambda reads). Anything unknown / absent → DEFAULT_STREAK_MODE.
 */
export function resolveStreakMode(
  settings: Record<string, unknown> | null | undefined,
): StreakMode {
  const extended = settings?.extended;
  const mode = isRecord(extended) ? extended.streakMode : undefined;
  if (isValidStreakMode(mode)) return mode;
  return DEFAULT_STREAK_MODE;
}

/**
 * Resolve the flexible-mode skip-day allowance from a stored settings object.
 * Reads `settings.extended.streakSkipDays`, clamped to [0, MAX_STREAK_SKIP_DAYS]
 * and truncated to a whole number. Absent / malformed → DEFAULT_STREAK_SKIP_DAYS.
 * (Only consulted when the mode is `flexible`.)
 */
export function resolveStreakSkipDays(
  settings: Record<string, unknown> | null | undefined,
): number {
  const extended = settings?.extended;
  const raw = isRecord(extended) ? extended.streakSkipDays : undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(MAX_STREAK_SKIP_DAYS, Math.max(0, Math.trunc(raw)));
  }
  return DEFAULT_STREAK_SKIP_DAYS;
}
