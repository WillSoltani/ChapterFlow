import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookErr,
  bookOk,
  requireBodyObject,
  requireInteger,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { IDEMPOTENCY_HEADER, runIdempotent } from "@/app/app/api/book/_lib/idempotency-core";
import { createDynamoIdempotencyStore } from "@/app/app/api/book/_lib/idempotency-repo";
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
import { resolveLocation } from "@/app/app/api/book/_lib/location";
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
    const user = await requireActiveBookUser();
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

    // Idempotent write: a retried reading-session POST carrying the same
    // client mutation id (Idempotency-Key) replays the first response instead
    // of accumulating the delta twice (double-counting reading time). All
    // durable writes below run INSIDE the idempotent block so a replay skips them.
    const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER);
    const store = createDynamoIdempotencyStore(tableName, "reading-sessions.post");
    const outcome = await runIdempotent({
      store,
      accountId: user.sub,
      key: idempotencyKey,
      execute: async () => {
        // Check the user's privacy preferences (server-side enforcement).
        // Reading progress (current chapter, lastActiveAt) is always updated since it's
        // essential for "continue reading". Reading-history records are gated behind
        // "Save Reading History"; usage analytics + approximate location are gated
        // behind "Share Usage Analytics" (opt-in: off unless the user enabled it).
        const settingsItem = await getUserSettingsItem(tableName, user.sub);
        const privacy = settingsItem?.settings?.privacy as
          | { saveReadingHistory?: boolean; analyticsParticipation?: boolean }
          | undefined;
        const saveReadingHistory = privacy?.saveReadingHistory ?? true;
        const analyticsParticipation = privacy?.analyticsParticipation ?? false;

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

        // Usage analytics (session stats + approximate location) — fire-and-forget,
        // and only when the user has opted in to "Share Usage Analytics". When opted
        // out we never resolve location or write to the analytics table.
        if (analyticsParticipation) {
          const ua = getUserAgentFromRequest(req);
          const acceptLanguage = req.headers.get("accept-language") ?? undefined;
          // Freeze the request headers for async use — Request.headers can't be
          // accessed after the handler returns if the stream has closed.
          const headersSnapshot = new Headers(req.headers);

          getBookAnalyticsTableName().then(async (analyticsTable) => {
            if (!analyticsTable) return;

            // Fire the session tracker immediately (non-blocking for geo).
            analyticsTrackReadingSession(analyticsTable, {
              userId: user.sub,
              bookId,
              deltaMs,
              dayKey,
              deviceType: ua.deviceType,
              browserName: ua.browserName,
              osName: ua.osName,
            }).catch(() => {});

            // Resolve location from headers (free) or IP lookup (external, cached)
            const loc = await resolveLocation(headersSnapshot).catch(() => null);
            if (loc) {
              await analyticsSetUserLocale(analyticsTable, {
                userId: user.sub,
                countryCode: loc.countryCode ?? undefined,
                countryName: loc.countryName ?? undefined,
                regionCode: loc.regionCode ?? undefined,
                regionName: loc.regionName ?? undefined,
                city: loc.city ?? undefined,
                viewerTimezone:
                  loc.timezone ??
                  headersSnapshot.get("cloudfront-viewer-time-zone") ??
                  undefined,
                // loc.latitude/longitude are already coarsened to ~city level in
                // location.ts. Do NOT fall back to the raw cloudfront-viewer-*
                // headers — those are precise and would defeat the coarsening.
                latitude: loc.latitude ?? undefined,
                longitude: loc.longitude ?? undefined,
                acceptLanguage,
              }).catch(() => {});
            }
          }).catch(() => {});
        }
        return {
          status: 200,
          body: {
            readingDay,
            trackedMinutesToday: Math.floor(readingDay.totalActiveMs / 60000),
          },
        };
      },
    });

    if (outcome.kind === "in_progress") {
      return bookErr(
        req,
        409,
        "idempotency_in_progress",
        "A prior identical request is still being processed. Please retry shortly.",
      );
    }
    return bookOk(outcome.body, outcome.status);
  });
}
