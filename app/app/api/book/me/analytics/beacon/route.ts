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

// ─── In-memory consent cache ────────────────────────────────────────────────
// The beacon endpoint is high-frequency: the client hook fires a beacon on
// every route change plus session_context/performance per page load. The
// consent flag (privacy.analyticsParticipation) changes rarely, yet each
// beacon previously did a fresh getUserSettingsItem GetItem to re-verify it.
// Cache the resolved flag per user in the warm container (like location.ts's
// IP_CACHE) with a short TTL so a flurry of beacons collapses to (at most) one
// settings read per user per TTL window. The flag stays server-authoritative:
// we still read DynamoDB on a cold start or once the TTL lapses, so a privacy
// toggle takes effect within CONSENT_CACHE_TTL_MS even though we can't
// invalidate from the settings PATCH route here. On cold start the map is
// empty (safe — we re-resolve).
type ConsentCacheEntry = { optedIn: boolean; expiresAt: number };
const CONSENT_CACHE = new Map<string, ConsentCacheEntry>();
const CONSENT_CACHE_TTL_MS = 60 * 1000;
const CONSENT_CACHE_MAX = 5000;

async function isAnalyticsOptedIn(tableName: string, userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = CONSENT_CACHE.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.optedIn;
  }

  const settingsItem = await getUserSettingsItem(tableName, userId);
  const privacy = settingsItem?.settings?.privacy as
    | { analyticsParticipation?: boolean }
    | undefined;
  const optedIn = privacy?.analyticsParticipation ?? false;

  // Trim cache if bloated (drop the oldest insertion).
  if (CONSENT_CACHE.size >= CONSENT_CACHE_MAX) {
    const firstKey = CONSENT_CACHE.keys().next().value;
    if (firstKey) CONSENT_CACHE.delete(firstKey);
  }
  CONSENT_CACHE.set(userId, { optedIn, expiresAt: now + CONSENT_CACHE_TTL_MS });
  return optedIn;
}

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

    // Server-side consent check — respect the user's privacy preference.
    // Usage analytics is opt-in: off unless the user explicitly enabled it.
    // Resolved via a short-TTL warm-container cache to avoid a DynamoDB read
    // on every high-frequency beacon; still server-authoritative (see above).
    const analyticsParticipation = await isAnalyticsOptedIn(tableName, user.sub);

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
