import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  lastNDays,
  scanBookUserNotificationsPage,
  scanBookUserSettingsPage,
} from "@/app/app/api/book/_lib/admin-metrics";
import {
  aggregateNotificationMetrics,
  windowCutoff,
  type NotificationMetricRow,
} from "@/app/app/api/book/_lib/notifications-metrics-core";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";

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

    // Scan notifications WITHIN the metrics window only. Notifications live under
    // per-user partitions (PK BOOKUSER#<id>, SK NOTIF#<createdAt>#<id>) with no
    // cross-user GSI on createdAt, so there is no global recency-ordered Query.
    // A bare capped Scan returns items in DynamoDB hash order, so once the table
    // exceeds the cap the items examined are a non-recency-correlated SAMPLE and
    // the 7-day chart silently under/random-counts recent days (H14).
    //
    // Instead, bound the scan SERVER-SIDE to the window with `createdAt >= :cut`:
    // only in-window rows are ever returned, so every notification the chart
    // covers is counted (the cap now only bites on a genuinely huge RECENT volume,
    // and hitting it means we dropped RECENT items — a truthful "sampled" state).
    const cutoff = windowCutoff(days);
    const rows: NotificationMetricRow[] = [];
    let lastKey: Record<string, unknown> | undefined;
    let scanned = 0;
    const maxItems = 5000;

    try {
      do {
        const res = await scanBookUserNotificationsPage(tableName, cutoff, lastKey);
        for (const item of res.Items ?? []) {
          rows.push(item as NotificationMetricRow);
          scanned += 1;
          if (scanned >= maxItems) break;
        }
        lastKey = res.LastEvaluatedKey;
      } while (lastKey && scanned < maxItems);
    } catch (err) {
      logger.warn("admin_notifications_scan_failed", { err });
      warnings.push("Notification data unavailable (database scan failed).");
    }

    if (scanned >= maxItems) {
      // The cap was reached WITHIN the 7-day window — recent days are sampled,
      // not complete. (Pre-fix this warning was about "older items"; now the only
      // way to hit it is genuinely huge recent volume, so it errs by under-counting
      // the most recent days.)
      warnings.push(
        `Volume sampled from the first ${maxItems.toLocaleString()} notifications in the last 7 days; recent days may be under-counted.`,
      );
    }

    // Pure, unit-tested aggregation: per-day volume across `days` + per-type/channel
    // send/read rates, all over the SAME in-window population so the chart and the
    // engagement table describe the same data.
    const { dailyVolume, aggregates } = aggregateNotificationMetrics(rows, days);

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
        const res = await scanBookUserSettingsPage(tableName, settingsLastKey);
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
      logger.warn("admin_notifications_settings_scan_failed", { err });
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
