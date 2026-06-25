/**
 * Admin notifications metrics — pure, AWS-free aggregation core (H14).
 *
 * The admin notifications route used to bucket `dailyVolume` (and the per-type
 * read-rate aggregates) from a Scan of `entity = BOOK_USER_NOTIFICATION` capped
 * at a fixed item count in DynamoDB's internal HASH order — NOT recency order.
 * Once the table grew past that cap, the items examined were a non-recency-
 * correlated SAMPLE, so the "last 7 days" chart silently under/random-counted
 * recent days. Notifications live under per-user partitions (PK BOOKUSER#<id>,
 * SK NOTIF#<createdAt>#<id>) with no cross-user GSI on createdAt, so there is no
 * single Query that returns them globally recency-ordered.
 *
 * The fix is to bound the SCAN ITSELF to the metrics window with a server-side
 * `createdAt >= :cutoff` FilterExpression (see route), so only in-window items
 * are ever returned. Within a 7-day window the matched count is vastly smaller
 * and the cap only bites on a genuinely huge recent volume — and crucially, hitting
 * the cap means we dropped RECENT items (not arbitrary old ones), which is a
 * truthful "sampled" condition the caller can surface as a warning.
 *
 * This module owns the pure counting: given the in-window notification rows the
 * route scanned, bucket per-day volume across the requested days and compute the
 * per-type/channel send + read aggregates. No `server-only` / AWS imports on
 * purpose — the route does the I/O and hands the raw rows here so the math stays
 * unit-testable (the route file imports `server-only` and can't be unit-imported).
 */

/** Minimal shape of a notification row this core reads. */
export type NotificationMetricRow = {
  type?: unknown;
  channel?: unknown;
  readAt?: unknown;
  createdAt?: unknown;
};

export type NotifTypeAggregate = {
  type: string;
  channel: string;
  sent: number;
  read: number;
  readRate: number;
};

export type NotificationMetrics = {
  /** One entry per requested day, in the SAME order as `days`. */
  dailyVolume: Array<{ date: string; value: number }>;
  /** Per type+channel send/read aggregates, sorted most-sent first. */
  aggregates: NotifTypeAggregate[];
};

/**
 * The lexicographic cutoff string for a `createdAt >= :cutoff` DynamoDB filter
 * that captures every notification on or after the FIRST day in `days`.
 *
 * `createdAt` is a full ISO-8601 UTC timestamp (e.g. "2026-06-24T12:34:56.789Z")
 * and the day keys are its YYYY-MM-DD prefix, so the earliest day string itself
 * is a valid lower bound: "2026-06-18" <= "2026-06-18T00:00:00.000Z" and below
 * every later timestamp, lexicographically === chronologically for ISO UTC.
 *
 * Returns "" for an empty window (caller should treat that as "no bound").
 */
export function windowCutoff(days: string[]): string {
  if (days.length === 0) return "";
  // `days` is produced by lastNDays() in ascending order, but don't trust that —
  // take the min so the bound is correct regardless of input ordering.
  let min = days[0];
  for (const d of days) {
    if (d < min) min = d;
  }
  return min;
}

/** Extract the YYYY-MM-DD day key from a row's createdAt (""/invalid → ""). */
export function rowDay(row: NotificationMetricRow): string {
  return String(row.createdAt ?? "").slice(0, 10);
}

/**
 * Aggregate in-window notification rows into the daily-volume series and the
 * per-type/channel send/read table.
 *
 * - `days` is the exact ordered list of day keys the series must contain; days
 *   with no rows report 0 (never omitted), so the chart never has gaps.
 * - A row whose day is outside `days` contributes to NOTHING (defensive: the
 *   route already filters server-side, but a stale boundary item can't skew a day
 *   that isn't shown). Read-rate aggregates also only count in-window rows so the
 *   table and the chart describe the same population.
 */
export function aggregateNotificationMetrics(
  rows: Iterable<NotificationMetricRow>,
  days: string[],
): NotificationMetrics {
  const dayBudget = new Set(days);
  const dayVolume = new Map<string, number>();
  const aggMap = new Map<string, NotifTypeAggregate>();

  for (const row of rows) {
    const day = rowDay(row);
    if (!day || !dayBudget.has(day)) continue;

    dayVolume.set(day, (dayVolume.get(day) ?? 0) + 1);

    const type = String(row.type ?? "unknown");
    const channel = String(row.channel ?? "in_app");
    const key = `${type}::${channel}`;
    const agg = aggMap.get(key) ?? { type, channel, sent: 0, read: 0, readRate: 0 };
    agg.sent += 1;
    if (row.readAt) agg.read += 1;
    aggMap.set(key, agg);
  }

  const dailyVolume = days.map((d) => ({ date: d, value: dayVolume.get(d) ?? 0 }));

  const aggregates = Array.from(aggMap.values())
    .map((a) => ({
      ...a,
      readRate: a.sent > 0 ? Math.round((a.read / a.sent) * 100) : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  return { dailyVolume, aggregates };
}
