import "server-only";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  getBookAnalyticsTableName,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { getUserSettingsItem } from "@/app/app/api/book/_lib/repo";
import { analyticsTrackBeacon } from "@/app/app/api/book/_lib/analytics-repo";
import { getUserAgentFromRequest } from "@/app/app/api/book/_lib/user-agent";

export const runtime = "nodejs";

const VALID_BEACON_TYPES = new Set(["session_context", "performance", "navigation"]);

/** Max payload fields to prevent abuse. */
const MAX_PAYLOAD_KEYS = 20;

/**
 * POST /app/api/book/me/analytics/beacon
 *
 * Accepts client-side telemetry events. Only processes data when the user
 * has opted in via the "Share Usage Analytics" setting.
 */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    // Server-side consent check — respect the user's privacy preference
    const settingsItem = await getUserSettingsItem(tableName, user.sub);
    const privacy = settingsItem?.settings?.privacy as
      | { analyticsParticipation?: boolean }
      | undefined;
    const analyticsParticipation = privacy?.analyticsParticipation ?? true;

    if (!analyticsParticipation) {
      // User has opted out — silently accept but don't store
      return bookOk({ accepted: false, reason: "analytics_disabled" });
    }

    const analyticsTable = await getBookAnalyticsTableName();
    if (!analyticsTable) {
      return bookOk({ accepted: false, reason: "analytics_not_configured" });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BookApiError(400, "invalid_body", "Expected an object.");
    }

    const { type, ...payload } = body as Record<string, unknown>;

    if (typeof type !== "string" || !VALID_BEACON_TYPES.has(type)) {
      throw new BookApiError(
        400,
        "invalid_beacon_type",
        `type must be one of: ${[...VALID_BEACON_TYPES].join(", ")}`
      );
    }

    // Sanitize: limit payload size and strip non-primitive values
    const sanitized: Record<string, unknown> = {};
    let keyCount = 0;
    for (const [k, v] of Object.entries(payload)) {
      if (keyCount >= MAX_PAYLOAD_KEYS) break;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        sanitized[k] = v;
        keyCount++;
      }
    }

    const ua = getUserAgentFromRequest(req);

    // Fire-and-forget
    analyticsTrackBeacon(analyticsTable, {
      userId: user.sub,
      beaconType: type as "session_context" | "performance" | "navigation",
      payload: sanitized,
      deviceType: ua.deviceType,
      browserName: ua.browserName,
      osName: ua.osName,
    }).catch(() => {});

    return bookOk({ accepted: true });
  });
}
