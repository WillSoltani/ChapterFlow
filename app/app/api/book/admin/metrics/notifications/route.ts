import "server-only";

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { lastNDays, queryEventsForDay } from "@/app/app/api/book/_lib/admin-metrics";

export const runtime = "nodejs";

type NotifAgg = {
  type: string;
  channel: string;
  sent: number;
  read: number;
  readRate: number;
};

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookErr(req, 503, "analytics_unavailable", "Analytics table not configured.");
    }

    const warnings: string[] = [];
    const days = lastNDays(7);

    // Scan recent notifications from main table (capped)
    const aggMap = new Map<string, NotifAgg>();
    let lastKey: Record<string, unknown> | undefined;
    let scanned = 0;
    const maxItems = 5000;

    try {
      do {
        const res = await ddbDoc.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: "entity = :e",
            ExpressionAttributeValues: { ":e": "BOOK_USER_NOTIFICATION" },
            ProjectionExpression: "#t, channel, readAt, createdAt",
            ExpressionAttributeNames: { "#t": "type" },
            ExclusiveStartKey: lastKey,
            Limit: 1000,
          }),
        );
        for (const item of res.Items ?? []) {
          const type = String(item.type ?? "unknown");
          const channel = String(item.channel ?? "in_app");
          const key = `${type}::${channel}`;
          const agg =
            aggMap.get(key) ?? { type, channel, sent: 0, read: 0, readRate: 0 };
          agg.sent += 1;
          if (item.readAt) agg.read += 1;
          aggMap.set(key, agg);
          scanned += 1;
          if (scanned >= maxItems) break;
        }
        lastKey = res.LastEvaluatedKey;
      } while (lastKey && scanned < maxItems);
    } catch (err) {
      console.warn("[admin-notifications] scan failed:", err);
      warnings.push("Notification data unavailable (database scan failed).");
    }

    if (scanned >= maxItems) {
      warnings.push(`Showing first ${maxItems} notifications. Older items not included.`);
    }

    const aggregates = Array.from(aggMap.values()).map((a) => ({
      ...a,
      readRate: a.sent > 0 ? Math.round((a.read / a.sent) * 100) : 0,
    }));
    aggregates.sort((a, b) => b.sent - a.sent);

    // Daily send volume (from analytics events that mirror notification creates,
    // if instrumented) — fallback: estimate from scan
    const dailyVolume = days.map((d) => ({ date: d, value: 0 }));

    // Try to get a per-day estimate from notifications themselves by createdAt slicing
    if (scanned > 0) {
      // We don't have full data — leave dailyVolume zero for now,
      // future improvement: query GSI on createdAt or use analytics events.
    }

    // Channel preference distribution from settings — count NotificationPreferences
    let emailEnabled = 0;
    let pushEnabled = 0;
    let inAppEnabled = 0;
    let totalSettings = 0;
    let settingsLastKey: Record<string, unknown> | undefined;
    try {
      do {
        const res = await ddbDoc.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: "entity = :e",
            ExpressionAttributeValues: { ":e": "BOOK_USER_SETTINGS" },
            ProjectionExpression: "settings",
            ExclusiveStartKey: settingsLastKey,
            Limit: 1000,
          }),
        );
        for (const item of res.Items ?? []) {
          totalSettings += 1;
          const settings = item.settings as Record<string, unknown> | undefined;
          const notif = settings?.notifications as Record<string, unknown> | undefined;
          const channels = notif?.channels as Record<string, unknown> | undefined;
          if (channels?.inApp !== false) inAppEnabled += 1;
          if (channels?.email === true) emailEnabled += 1;
          if (channels?.push === true) pushEnabled += 1;
        }
        settingsLastKey = res.LastEvaluatedKey;
      } while (settingsLastKey);
    } catch (err) {
      console.warn("[admin-notifications] settings scan failed:", err);
    }

    void queryEventsForDay; // reserved for future event-log driven volume

    return bookOk({
      generatedAt: new Date().toISOString(),
      aggregates,
      dailyVolume,
      preferences: {
        total: totalSettings,
        inAppEnabled,
        emailEnabled,
        pushEnabled,
      },
      warnings,
    });
  });
}
