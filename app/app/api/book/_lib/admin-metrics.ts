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
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  licenseKey?: string;
  licenseExpiresAt?: string;
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
 * Search users by email substring. Scans the analytics table snapshot rows.
 * Cheap at solo-founder scale; bounded by `limit`.
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

  do {
    const res = await ddbDoc.send(
      new ScanCommand({
        TableName: analyticsTable,
        FilterExpression: "SK = :sk AND contains(#e, :q)",
        ExpressionAttributeNames: { "#e": "email" },
        ExpressionAttributeValues: { ":sk": "SNAPSHOT", ":q": q },
        ExclusiveStartKey: lastKey,
        Limit: 200,
      }),
    );
    for (const item of res.Items ?? []) {
      results.push(item);
      if (results.length >= limit) return results;
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return results;
}

/**
 * Scan the main DynamoDB table for all entitlement records.
 * Entitlements are the source of truth for plan / proSource — the
 * analytics snapshot's `plan` field is only updated on Stripe
 * webhook events, so it can be stale for license-granted PRO users.
 */
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
          "userId, #p, proStatus, proSource, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd, licenseKey, licenseExpiresAt, updatedAt",
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
        currentPeriodEnd:
          typeof item.currentPeriodEnd === "string" ? item.currentPeriodEnd : undefined,
        cancelAtPeriodEnd:
          typeof item.cancelAtPeriodEnd === "boolean" ? item.cancelAtPeriodEnd : undefined,
        licenseKey: typeof item.licenseKey === "string" ? item.licenseKey : undefined,
        licenseExpiresAt:
          typeof item.licenseExpiresAt === "string" ? item.licenseExpiresAt : undefined,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
      });
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

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
