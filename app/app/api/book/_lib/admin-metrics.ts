import "server-only";

import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";

export type EntitlementSnapshot = {
  userId: string;
  plan: "FREE" | "PRO";
  proStatus?: string;
  proSource?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionInterval?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  licenseKey?: string;
  licenseExpiresAt?: string;
  // Billing intelligence — written by the Stripe webhook (absent for
  // license / flow_points / gift sources). These MUST stay in lockstep with
  // the ProjectionExpression AND the item mapping in scanAllEntitlements
  // below: a field listed here but not projected reads back `undefined` at
  // runtime, which is exactly how the admin billing dashboard silently
  // reported $0 MRR while the data sat in DynamoDB.
  billingCountry?: string;
  billingCurrency?: string;
  subscriptionAmountCents?: number;
  cardBrand?: string;
  cardCountry?: string;
  lastInvoiceAmountCents?: number;
  lastInvoiceCurrency?: string;
  lastInvoicePaidAt?: string;
  failedPaymentLastReason?: string;
  updatedAt?: string;
};

/**
 * Helpers for the admin dashboard. All queries target the analytics table
 * (BOOK_ANALYTICS_TABLE_NAME). The schema is documented in analytics-repo.ts.
 *
 * Key patterns:
 *   USER#<userId>         SNAPSHOT
 *   USER#<userId>         EVENT#<isoTs>#<eventType>
 *
 * GSI1 "eventDate-eventType-index"  PK=eventDate (YYYY-MM-DD), SK=eventType
 * GSI2 "plan-updatedAt-index"       PK=plan, SK=updatedAt
 */

export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function lastNDays(n: number, end: Date = new Date()): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(dayKey(shiftDays(end, -i)));
  }
  return days;
}

/**
 * Count events of a given type on a given day. Returns event count and
 * unique user count (Set of userIds).
 */
export async function queryEventsForDay(
  analyticsTable: string,
  eventDateKey: string,
  eventType?: string,
): Promise<{ events: Record<string, unknown>[]; uniqueUsers: Set<string> }> {
  const events: Record<string, unknown>[] = [];
  const uniqueUsers = new Set<string>();
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: analyticsTable,
        IndexName: "eventDate-eventType-index",
        KeyConditionExpression: eventType
          ? "eventDate = :d AND eventType = :t"
          : "eventDate = :d",
        ExpressionAttributeValues: eventType
          ? { ":d": eventDateKey, ":t": eventType }
          : { ":d": eventDateKey },
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of res.Items ?? []) {
      events.push(item);
      const userId = typeof item.userId === "string" ? item.userId : null;
      if (userId) uniqueUsers.add(userId);
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return { events, uniqueUsers };
}

/**
 * For each day in `days`, return both event count and unique user count
 * for the given event type. Used for time-series KPI sparklines.
 */
export async function dailySeries(
  analyticsTable: string,
  days: string[],
  eventType: string,
): Promise<{ date: string; events: number; uniqueUsers: number }[]> {
  const results = await Promise.all(
    days.map(async (d) => {
      const { events, uniqueUsers } = await queryEventsForDay(analyticsTable, d, eventType);
      return { date: d, events: events.length, uniqueUsers: uniqueUsers.size };
    }),
  );
  return results;
}

/**
 * Compute DAU for a single day. Scans all events on that day (across all
 * event types) and returns unique userId count.
 */
export async function dauForDay(analyticsTable: string, dayKey: string): Promise<number> {
  const { uniqueUsers } = await queryEventsForDay(analyticsTable, dayKey);
  return uniqueUsers.size;
}

/**
 * Sum a numeric field across all events of a type on a given day.
 */
export async function sumFieldOnDay(
  analyticsTable: string,
  dayKey: string,
  eventType: string,
  field: string,
): Promise<number> {
  const { events } = await queryEventsForDay(analyticsTable, dayKey, eventType);
  let sum = 0;
  for (const e of events) {
    const v = e[field];
    if (typeof v === "number") sum += v;
  }
  return sum;
}

/**
 * Count active users by plan within the last N days. Uses GSI2.
 */
export async function activeUsersByPlan(
  analyticsTable: string,
  plan: "FREE" | "PRO",
  sinceIso: string,
): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: analyticsTable,
        IndexName: "plan-updatedAt-index",
        KeyConditionExpression: "#p = :p AND updatedAt >= :since",
        ExpressionAttributeNames: { "#p": "plan" },
        ExpressionAttributeValues: { ":p": plan, ":since": sinceIso },
        Select: "COUNT",
        ExclusiveStartKey: lastKey,
      }),
    );
    count += res.Count ?? 0;
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

/**
 * Total user count by plan (no time filter).
 */
export async function totalUsersByPlan(
  analyticsTable: string,
  plan: "FREE" | "PRO",
): Promise<number> {
  let count = 0;
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: analyticsTable,
        IndexName: "plan-updatedAt-index",
        KeyConditionExpression: "#p = :p",
        ExpressionAttributeNames: { "#p": "plan" },
        ExpressionAttributeValues: { ":p": plan },
        Select: "COUNT",
        ExclusiveStartKey: lastKey,
      }),
    );
    count += res.Count ?? 0;
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return count;
}

/**
 * Get user snapshot from analytics table.
 */
export async function getUserSnapshot(
  analyticsTable: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: analyticsTable,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "SNAPSHOT",
      },
    }),
  );
  return res.Items?.[0] ?? null;
}

/**
 * Get last N events for a specific user.
 */
export async function getUserEvents(
  analyticsTable: string,
  userId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: analyticsTable,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":prefix": "EVENT#",
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return res.Items ?? [];
}

/**
 * Exhaustively read ALL of a user's analytics EVENT# rows by paginating on
 * LastEvaluatedKey until the partition is drained (mirrors the queryAll* loops
 * in the export route / account-erasure). Used by the GDPR/CCPA data export,
 * where the bounded `getUserEvents` would silently truncate a heavy user.
 *
 * A `maxPages` hard cap bounds a pathological/runaway partition; when hit,
 * `truncated` is true so the export can flag the artifact as incomplete rather
 * than silently dropping the tail.
 */
export async function getAllUserEvents(
  analyticsTable: string,
  userId: string,
  maxPages = 200,
): Promise<{ items: Record<string, unknown>[]; truncated: boolean }> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  let pages = 0;
  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: analyticsTable,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":prefix": "EVENT#",
        },
        ScanIndexForward: false,
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) items.push(item);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages += 1;
    if (pages >= maxPages) {
      return { items, truncated: ExclusiveStartKey != null };
    }
  } while (ExclusiveStartKey);
  return { items, truncated: false };
}

/**
 * Search users by email substring. Scans the analytics table snapshot rows.
 * Cheap at solo-founder scale; bounded by `limit`.
 *
 * DynamoDB `contains` is byte-exact / case-sensitive and stored emails come
 * verbatim from Cognito (e.g. "John.Doe@Gmail.com"), so we match against the
 * persisted lowercased `emailLower` field (written in analytics-repo.ts). For
 * snapshots written before that field existed, `emailLower` is absent, so we
 * also project `email` and apply a case-insensitive JS fallback filter — this
 * keeps search working through the backfill window without an extra round-trip.
 */
export async function searchUsersByEmail(
  analyticsTable: string,
  query: string,
  limit = 25,
): Promise<Record<string, unknown>[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  // Hard cap so a search miss can't paginate the entire table.
  let scanned = 0;
  const maxScan = 5000;

  do {
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: analyticsTable,
        // Match the lowercased index field when present, OR fall back to the
        // raw email so legacy snapshots without emailLower still surface; the
        // raw-email branch is case-sensitive at the DB level and re-checked in
        // JS below for case-insensitivity.
        FilterExpression:
          "SK = :sk AND (contains(#el, :q) OR contains(#e, :q))",
        ExpressionAttributeNames: { "#el": "emailLower", "#e": "email" },
        ExpressionAttributeValues: { ":sk": "SNAPSHOT", ":q": q },
        ExclusiveStartKey: lastKey,
        Limit: 200,
      }),
    );
    for (const item of res.Items ?? []) {
      const emailLower =
        typeof item.emailLower === "string"
          ? item.emailLower
          : typeof item.email === "string"
            ? item.email.toLowerCase()
            : "";
      // Guard the legacy fallback branch: contains(#e, :q) can match on case
      // by accident, so re-verify case-insensitively before returning.
      if (!emailLower.includes(q)) continue;
      results.push(item);
      if (results.length >= limit) return results;
    }
    scanned += res.ScannedCount ?? res.Items?.length ?? 0;
    lastKey = res.LastEvaluatedKey;
  } while (lastKey && scanned < maxScan);

  return results;
}

/**
 * Build a unified SegmentUser array by merging entitlements and analytics
 * snapshots. Used by the segment builder to run predicates against.
 */
export async function buildSegmentUsers(
  mainTableName: string,
  analyticsTable: string,
): Promise<
  Array<{
    userId: string;
    email: string | null;
    plan: "FREE" | "PRO";
    proSource: string | null;
    countryCode: string | null;
    lastActiveAt: string | null;
    firstSeenAt: string | null;
    booksCompleted: number;
    flowPoints: number;
    tier: string | null;
    badgeCount: number;
    onboardingCompletedAt: string | null;
  }>
> {
  const [ents, snaps] = await Promise.all([
    scanAllEntitlements(mainTableName).catch(() => []),
    scanAllUserSnapshots(
      analyticsTable,
      "userId, email, plan, countryCode, lastActiveAt, firstSeenAt, booksCompleted, flowPoints, badgeCount, onboardingCompletedAt",
    ).catch(() => []),
  ]);

  const snapMap = new Map<string, Record<string, unknown>>();
  for (const s of snaps) {
    const userId = typeof s.userId === "string" ? s.userId : null;
    if (userId) snapMap.set(userId, s);
  }

  // Start with entitlements (source of truth for plan)
  const byUser = new Map<string, ReturnType<typeof toSegUser>>();
  for (const e of ents) {
    const snap = snapMap.get(e.userId) ?? {};
    byUser.set(e.userId, toSegUser(e.userId, e, snap));
  }

  // Include snapshot-only users (no entitlement yet)
  for (const [userId, snap] of snapMap.entries()) {
    if (byUser.has(userId)) continue;
    byUser.set(
      userId,
      toSegUser(
        userId,
        { plan: "FREE", proSource: undefined } as EntitlementSnapshot,
        snap,
      ),
    );
  }

  return Array.from(byUser.values());
}

function toSegUser(
  userId: string,
  ent: EntitlementSnapshot,
  snap: Record<string, unknown>,
) {
  return {
    userId,
    email: typeof snap.email === "string" ? snap.email : null,
    plan: (ent.plan === "PRO" ? "PRO" : "FREE") as "FREE" | "PRO",
    proSource: ent.proSource ?? null,
    countryCode: typeof snap.countryCode === "string" ? snap.countryCode : null,
    lastActiveAt: typeof snap.lastActiveAt === "string" ? snap.lastActiveAt : null,
    firstSeenAt: typeof snap.firstSeenAt === "string" ? snap.firstSeenAt : null,
    booksCompleted: typeof snap.booksCompleted === "number" ? snap.booksCompleted : 0,
    flowPoints: typeof snap.flowPoints === "number" ? snap.flowPoints : 0,
    tier: null,
    badgeCount: typeof snap.badgeCount === "number" ? snap.badgeCount : 0,
    onboardingCompletedAt:
      typeof snap.onboardingCompletedAt === "string"
        ? snap.onboardingCompletedAt
        : null,
  };
}

/**
 * Scan the main DynamoDB table for all entitlement records.
 * Entitlements are the source of truth for plan / proSource — the
 * analytics snapshot's `plan` field is only updated on Stripe
 * webhook events, so it can be stale for license-granted PRO users.
 */
/**
 * Defensive ceiling for the cross-cutting table scans below. These scans have
 * no GSI (the code flags "this should use a GSI or materialized view"); the cap
 * stops a single admin dashboard open from paginating an arbitrarily large
 * table. It is well above current scale, so behaviour is unchanged today — it
 * exists purely to bound the blast radius until a rollup/GSI lands.
 */
export const ADMIN_SCAN_MAX_ITEMS = 50000;

export async function scanAllEntitlements(
  bookTableName: string,
): Promise<EntitlementSnapshot[]> {
  const out: EntitlementSnapshot[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: bookTableName,
        FilterExpression: "entity = :e",
        ExpressionAttributeValues: { ":e": "BOOK_USER_ENTITLEMENT" },
        ProjectionExpression:
          "userId, #p, proStatus, proSource, stripeCustomerId, stripeSubscriptionId, stripePriceId, subscriptionInterval, currentPeriodEnd, cancelAtPeriodEnd, licenseKey, licenseExpiresAt, updatedAt, billingCountry, billingCurrency, subscriptionAmountCents, cardBrand, cardCountry, lastInvoiceAmountCents, lastInvoiceCurrency, lastInvoicePaidAt, failedPaymentLastReason",
        ExpressionAttributeNames: { "#p": "plan" },
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const userId = typeof item.userId === "string" ? item.userId : null;
      if (!userId) continue;
      const plan = item.plan === "PRO" ? "PRO" : "FREE";
      out.push({
        userId,
        plan,
        proStatus: typeof item.proStatus === "string" ? item.proStatus : undefined,
        proSource: typeof item.proSource === "string" ? item.proSource : undefined,
        stripeCustomerId:
          typeof item.stripeCustomerId === "string" ? item.stripeCustomerId : undefined,
        stripeSubscriptionId:
          typeof item.stripeSubscriptionId === "string"
            ? item.stripeSubscriptionId
            : undefined,
        stripePriceId:
          typeof item.stripePriceId === "string" ? item.stripePriceId : undefined,
        subscriptionInterval:
          typeof item.subscriptionInterval === "string"
            ? item.subscriptionInterval
            : undefined,
        currentPeriodEnd:
          typeof item.currentPeriodEnd === "string" ? item.currentPeriodEnd : undefined,
        cancelAtPeriodEnd:
          typeof item.cancelAtPeriodEnd === "boolean" ? item.cancelAtPeriodEnd : undefined,
        licenseKey: typeof item.licenseKey === "string" ? item.licenseKey : undefined,
        licenseExpiresAt:
          typeof item.licenseExpiresAt === "string" ? item.licenseExpiresAt : undefined,
        billingCountry:
          typeof item.billingCountry === "string" ? item.billingCountry : undefined,
        billingCurrency:
          typeof item.billingCurrency === "string" ? item.billingCurrency : undefined,
        subscriptionAmountCents:
          typeof item.subscriptionAmountCents === "number"
            ? item.subscriptionAmountCents
            : undefined,
        cardBrand: typeof item.cardBrand === "string" ? item.cardBrand : undefined,
        cardCountry: typeof item.cardCountry === "string" ? item.cardCountry : undefined,
        lastInvoiceAmountCents:
          typeof item.lastInvoiceAmountCents === "number"
            ? item.lastInvoiceAmountCents
            : undefined,
        lastInvoiceCurrency:
          typeof item.lastInvoiceCurrency === "string" ? item.lastInvoiceCurrency : undefined,
        lastInvoicePaidAt:
          typeof item.lastInvoicePaidAt === "string" ? item.lastInvoicePaidAt : undefined,
        failedPaymentLastReason:
          typeof item.failedPaymentLastReason === "string"
            ? item.failedPaymentLastReason
            : undefined,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
      });
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey && out.length < ADMIN_SCAN_MAX_ITEMS);

  return out;
}

/**
 * Get analytics snapshots for a list of userIds in batches.
 * Used to enrich entitlement data with lastActiveAt etc.
 */
export async function batchGetUserSnapshots(
  analyticsTable: string,
  userIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>();
  // Fetch sequentially to keep things simple at solo-founder scale.
  // For larger user counts, switch to BatchGetItem (max 100/call) or
  // a precomputed snapshot.
  await Promise.all(
    userIds.map(async (userId) => {
      const snap = await getUserSnapshot(analyticsTable, userId).catch(() => null);
      if (snap) result.set(userId, snap);
    }),
  );
  return result;
}

/**
 * Scan all user snapshots from the analytics table.
 * Used for cross-cutting aggregations (device mix, geo, retention cohorts).
 * At solo-founder scale this is ~tens of KB. For larger scale, replace
 * with precomputed daily snapshots.
 */
export async function scanAllUserSnapshots(
  analyticsTable: string,
  projection?: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: analyticsTable,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "SNAPSHOT" },
        ProjectionExpression: projection,
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of res.Items ?? []) out.push(item);
    lastKey = res.LastEvaluatedKey;
  } while (lastKey && out.length < ADMIN_SCAN_MAX_ITEMS);

  return out;
}

/**
 * Bucket reading-day Sets across users into a weekly cohort retention matrix.
 * Returns: cohort week (YYYY-Www) -> { size, weeks: number[] }
 * where weeks[N] = % of cohort that read in week N after signup.
 */
export type CohortRetentionRow = {
  cohort: string; // YYYY-Www
  size: number;
  weeks: number[]; // index 0 = signup week itself
};

export function buildCohortRetention(
  snapshots: Array<{ firstSeenAt?: string; readingDays?: Set<string> | string[] }>,
  weeksToShow = 8,
): CohortRetentionRow[] {
  const cohorts = new Map<string, { size: number; activeByWeek: number[] }>();

  for (const s of snapshots) {
    if (typeof s.firstSeenAt !== "string") continue;
    const firstDate = new Date(s.firstSeenAt);
    if (Number.isNaN(firstDate.getTime())) continue;

    const cohortKey = isoWeekKey(firstDate);
    const cohort =
      cohorts.get(cohortKey) ??
      { size: 0, activeByWeek: Array(weeksToShow).fill(0) };

    cohort.size += 1;

    const days =
      s.readingDays instanceof Set
        ? Array.from(s.readingDays as Set<string>)
        : Array.isArray(s.readingDays)
        ? (s.readingDays as string[])
        : [];

    // Mark weeks where the user was active relative to signup
    const seenWeeks = new Set<number>();
    for (const dayStr of days) {
      const d = new Date(dayStr);
      if (Number.isNaN(d.getTime())) continue;
      const diffDays = Math.floor((d.getTime() - firstDate.getTime()) / 86_400_000);
      if (diffDays < 0) continue;
      const weekIdx = Math.floor(diffDays / 7);
      if (weekIdx < weeksToShow) seenWeeks.add(weekIdx);
    }
    for (const w of seenWeeks) cohort.activeByWeek[w] += 1;

    cohorts.set(cohortKey, cohort);
  }

  return Array.from(cohorts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cohort, c]) => ({
      cohort,
      size: c.size,
      weeks: c.activeByWeek.map((n) => (c.size > 0 ? Math.round((n / c.size) * 100) : 0)),
    }));
}

function isoWeekKey(date: Date): string {
  // ISO week key YYYY-Www
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Bucket a list of users by reading frequency (last 30 days).
 * - dormant: 0 days
 * - monthly: 1-2 days
 * - weekly: 3-15 days
 * - daily: 16-30 days
 */
export function bucketReadingFrequency(
  snapshots: Array<{ readingDays?: Set<string> | string[] }>,
): { daily: number; weekly: number; monthly: number; dormant: number } {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 86_400_000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const buckets = { daily: 0, weekly: 0, monthly: 0, dormant: 0 };

  for (const s of snapshots) {
    const days =
      s.readingDays instanceof Set
        ? Array.from(s.readingDays as Set<string>)
        : Array.isArray(s.readingDays)
        ? (s.readingDays as string[])
        : [];
    const recent = days.filter((d) => d >= cutoffStr).length;
    if (recent === 0) buckets.dormant += 1;
    else if (recent <= 2) buckets.monthly += 1;
    else if (recent <= 15) buckets.weekly += 1;
    else buckets.daily += 1;
  }

  return buckets;
}

/**
 * Bucket beacon session_context events into device/browser/OS/timezone/lang
 * counts. Pulls from snapshot-side fields (deviceType, browserName, osName)
 * which are denormalized on every reading_session event write.
 */
export function bucketDeviceFields(
  snapshots: Array<{
    deviceType?: string;
    browserName?: string;
    osName?: string;
  }>,
): {
  deviceType: Array<{ key: string; count: number }>;
  browser: Array<{ key: string; count: number }>;
  os: Array<{ key: string; count: number }>;
} {
  const dt = new Map<string, number>();
  const br = new Map<string, number>();
  const os = new Map<string, number>();

  for (const s of snapshots) {
    inc(dt, s.deviceType ?? "unknown");
    inc(br, s.browserName ?? "unknown");
    inc(os, s.osName ?? "unknown");
  }

  return {
    deviceType: toSortedList(dt, 10),
    browser: toSortedList(br, 12),
    os: toSortedList(os, 8),
  };
}

function inc(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) ?? 0) + 1);
}
function toSortedList(m: Map<string, number>, limit: number) {
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

/**
 * Quantile helper for performance percentiles.
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((p / 100) * sortedValues.length)),
  );
  return sortedValues[idx];
}

/**
 * For each user, count distinct active dates using a rolling window.
 * Used for activity-frequency computation.
 */
export function countActiveDays(
  readingDays: Set<string> | string[] | undefined,
  withinDays: number,
): number {
  if (!readingDays) return 0;
  const days = readingDays instanceof Set ? Array.from(readingDays) : readingDays;
  const cutoff = new Date(Date.now() - withinDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return days.filter((d) => d >= cutoff).length;
}

/**
 * List most recently active users by plan, capped to `limit`.
 */
export async function listRecentUsersByPlan(
  analyticsTable: string,
  plan: "FREE" | "PRO",
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: analyticsTable,
      IndexName: "plan-updatedAt-index",
      KeyConditionExpression: "#p = :p",
      ExpressionAttributeNames: { "#p": "plan" },
      ExpressionAttributeValues: { ":p": plan },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return res.Items ?? [];
}
