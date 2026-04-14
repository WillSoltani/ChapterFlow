import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  requireInteger,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  addReadingDayActivity,
  getUserProgress,
  getUserSettingsItem,
  upsertUserProgress,
} from "@/app/app/api/book/_lib/repo";
import {
  analyticsTrackReadingSession,
  analyticsSetUserLocale,
} from "@/app/app/api/book/_lib/analytics-repo";
import { getUserAgentFromRequest } from "@/app/app/api/book/_lib/user-agent";
import { inferLocationFromHeaders } from "@/app/app/api/book/_lib/location";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

function toDayKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const body = requireBodyObject(bodyRaw);
    const bookId = requireString(body.bookId, "bookId", { maxLength: 120 });
    const deltaMs = requireInteger(body.deltaMs, "deltaMs", {
      min: 1,
      max: 60 * 60 * 1000,
    });
    const occurredAt =
      typeof body.occurredAt === "string" && body.occurredAt.trim()
        ? body.occurredAt
        : nowIso();
    const dayKey = toDayKey(occurredAt) || toDayKey(nowIso());

    // Check the user's "Save Reading History" preference (server-side enforcement).
    // Reading progress (current chapter, lastActiveAt) is always updated since it's
    // essential for "continue reading". Only readingDay records are gated.
    const settingsItem = await getUserSettingsItem(tableName, user.sub);
    const privacy = settingsItem?.settings?.privacy as
      | { saveReadingHistory?: boolean }
      | undefined;
    const saveReadingHistory = privacy?.saveReadingHistory ?? true;

    let readingDay = { totalActiveMs: 0 };

    if (saveReadingHistory) {
      const day = await addReadingDayActivity(tableName, {
        userId: user.sub,
        dayKey,
        deltaMs,
        occurredAt,
      });
      readingDay = day;
    }

    // Always update progress timestamps — this is app state, not history
    const progress = await getUserProgress(tableName, user.sub, bookId);
    if (progress) {
      await upsertUserProgress(tableName, {
        ...progress,
        lastActiveAt: occurredAt,
        updatedAt: occurredAt,
      });
    }

    // Analytics — fire-and-forget, includes device context from User-Agent
    const ua = getUserAgentFromRequest(req);
    const loc = inferLocationFromHeaders(req.headers);
    const acceptLanguage = req.headers.get("accept-language") ?? undefined;
    getBookAnalyticsTableName().then((analyticsTable) => {
      if (!analyticsTable) return;
      analyticsTrackReadingSession(analyticsTable, {
        userId: user.sub,
        bookId,
        deltaMs,
        dayKey,
        deviceType: ua.deviceType,
        browserName: ua.browserName,
        osName: ua.osName,
      }).catch(() => {});
      analyticsSetUserLocale(analyticsTable, {
        userId: user.sub,
        countryCode: loc?.countryCode ?? undefined,
        countryName: loc?.countryName ?? undefined,
        regionCode: loc?.regionCode ?? undefined,
        regionName: loc?.regionName ?? undefined,
        city: loc?.city ?? undefined,
        viewerTimezone: req.headers.get("cloudfront-viewer-time-zone") ?? undefined,
        latitude: req.headers.get("cloudfront-viewer-latitude") ?? undefined,
        longitude: req.headers.get("cloudfront-viewer-longitude") ?? undefined,
        acceptLanguage,
      }).catch(() => {});
    }).catch(() => {});

    return bookOk({
      readingDay,
      trackedMinutesToday: Math.floor(readingDay.totalActiveMs / 60000),
    });
  });
}
