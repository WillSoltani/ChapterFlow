// Which calendar day a reading session belongs to. Pure (no server-only / AWS
// imports) so it can be unit-tested.

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight (ms) of a real `YYYY-MM-DD` calendar date, or null. */
function dayKeyToUtcMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  // Rejects rollovers such as 2026-02-30 → March 2.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

export function isValidDayKey(value: unknown): value is string {
  return dayKeyToUtcMs(value) !== null;
}

/** The pre-localDay key: the date of `value` in the server process's zone (UTC on Lambda). */
function legacyDayKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The reader's local `YYYY-MM-DD` when the client sent one that is within one
 * day of the server's UTC date (every real time zone is); otherwise the legacy
 * server-clock key, so clients that don't send `localDay` behave as before.
 */
export function resolveReadingDayKey(input: {
  clientLocalDay: unknown;
  occurredAt: string;
  serverNow: string;
}): string {
  const clientMs = dayKeyToUtcMs(input.clientLocalDay);
  const serverDayMs = dayKeyToUtcMs(new Date(input.serverNow).toISOString().slice(0, 10));
  if (clientMs !== null && serverDayMs !== null && Math.abs(clientMs - serverDayMs) <= DAY_MS) {
    return input.clientLocalDay as string;
  }
  return legacyDayKey(input.occurredAt) || legacyDayKey(input.serverNow);
}
