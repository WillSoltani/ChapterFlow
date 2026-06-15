import "server-only";

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import { lastNDays } from "@/app/app/api/book/_lib/admin-metrics";

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
    // Per-day send counts, bucketed by createdAt (YYYY-MM-DD). Populated from the
    // same scan so the daily-volume chart needs no extra reads.
    const dayVolume = new Map<string, number>();
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
          const day = String(item.createdAt ?? "").slice(0, 10);
          if (day) dayVolume.set(day, (dayVolume.get(day) ?? 0) + 1);
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

    // Daily send volume, bucketed from the notifications scanned above by their
    // createdAt date. Bounded by the same `maxItems` scan cap as the aggregates
    // (the warning above already surfaces when that cap is hit), so on a very
    // large table recent days may be under-counted — a createdAt GSI would lift
    // that, but this is real data rather than a permanently-zero placeholder.
    const dailyVolume = days.map((d) => ({ date: d, value: dayVolume.get(d) ?? 0 }));

    // Channel preference distribution from settings — count NotificationPreferences.
    // Capped at the same `maxItems` budget as the notifications scan above so a
    // growing user table can't drive an unbounded full-table scan on every
    // dashboard open; the cap is surfaced as a warning when hit.
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
          if (totalSettings >= maxItems) break;
        }
        settingsLastKey = res.LastEvaluatedKey;
      } while (settingsLastKey && totalSettings < maxItems);
    } catch (err) {
      console.warn("[admin-notifications] settings scan failed:", err);
    }

    if (totalSettings >= maxItems) {
      warnings.push(
        `Channel preferences sampled from first ${maxItems} users. Older items not included.`,
      );
    }


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
