/**
 * Push payload contract (B2) — the SINGLE source of truth for what the backend
 * emits to a device, for BOTH transports:
 *
 *   • iOS / APNs — the Apple `aps` dictionary plus a custom `{ type, route, data }`
 *     block. `route` is the `chapterflow://` deep link the native app opens on tap.
 *   • Web-Push — a small `{ title, body, url, type, route }` JSON the service
 *     worker (`public/sw.js`) reads. `url` is the in-app web path equivalent of
 *     `route`.
 *
 * This module is pure and dependency-free (no `server-only`, no AWS, no jose/
 * http2) so it can be unit-tested directly and reused by the send path
 * (push-service.ts) without pulling the transport clients. It mirrors — and
 * MUST stay in lockstep with — `docs/ios/PUSH-CONTRACT.md`.
 *
 * Badge semantics: the `badge` passed in is the user's UNREAD INBOX COUNT
 * (see notifications-repo `countUnreadNotifications`), never a per-type counter.
 */

/** Notification types the push contract documents a route/category for. */
export type PushNotificationType =
  | "badge_earned"
  | "tier_up"
  | "streak_milestone"
  | "insight_spark"
  | "reading_reminder"
  | "streak_at_risk"
  | "partner_nudge"
  | "commitment_followup"
  | "event_reminder"
  | "scenario_approved"
  | "scenario_rejected";

/** APNs delivery priority. 10 = deliver immediately; 5 = throttleable/eco. */
export type ApnsPriority = 5 | 10;

/**
 * Per-type routing/presentation spec resolved from a notification's type +
 * metadata. Both transports derive from this so a route can never diverge
 * between web and iOS.
 */
export type NotificationRouteSpec = {
  /** `chapterflow://` deep link the iOS app opens on tap. */
  route: string;
  /** In-app web path the service worker opens on tap (web-push equivalent). */
  webPath: string;
  /** APNs `category` — selects registered actions + on-device grouping. */
  category: string;
  /** APNs `thread-id` — groups related notifications in Notification Center. */
  threadId: string;
  /**
   * APNs `apns-collapse-id` (also reused as web-push `Topic`). When set, a newer
   * push with the same id REPLACES the older undelivered one on the device.
   * Undefined ⇒ every push is distinct (celebrations must not coalesce).
   * Apple caps this at 64 bytes.
   */
  collapseId?: string;
  /** Structured, per-type payload echoed under the custom `data` key. */
  data: Record<string, string | number | boolean>;
  /** APNs `apns-priority`. Time-sensitive nudges use 10; the rest use 5. */
  priority: ApnsPriority;
};

/** Max serialized push payload size. APNs hard-limits alert payloads to 4 KB. */
export const MAX_PUSH_PAYLOAD_BYTES = 4096;

/** Safe string coercion for a metadata field. Returns undefined when absent. */
function metaStr(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = meta?.[key];
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function metaNum(meta: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = meta?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

/** Drop undefined values so `data` only carries the fields that are present. */
function compact(obj: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Resolve the routing/presentation spec for a notification. Unknown/undocumented
 * types fall back to the notifications inbox so a new type can never produce a
 * dead deep link.
 */
export function routeSpecFor(
  type: string,
  metadata?: Record<string, unknown>,
): NotificationRouteSpec {
  switch (type) {
    case "badge_earned": {
      // One type, three destinations depending on which id the metadata carries:
      // a completed journey, a finished seasonal event, or a plain achievement.
      const journeyId = metaStr(metadata, "journeyId");
      const eventId = metaStr(metadata, "eventId");
      const achievementId = metaStr(metadata, "achievementId");
      const badgeId = metaStr(metadata, "badgeId");
      const ip = metaNum(metadata, "ip");
      if (journeyId) {
        return {
          route: `chapterflow://journeys/${journeyId}`,
          webPath: `/book/journeys`,
          category: "ACHIEVEMENT",
          threadId: "achievements",
          data: compact({ journeyId, ip }),
          priority: 5,
        };
      }
      if (eventId) {
        return {
          route: `chapterflow://events/${eventId}`,
          webPath: `/book/events`,
          category: "ACHIEVEMENT",
          threadId: "achievements",
          data: compact({ eventId, badgeId, ip }),
          priority: 5,
        };
      }
      return {
        route: "chapterflow://progress/achievements",
        webPath: "/book/progress",
        category: "ACHIEVEMENT",
        threadId: "achievements",
        data: compact({ achievementId, badgeId, ip }),
        priority: 5,
      };
    }

    case "tier_up":
      return {
        route: "chapterflow://progress/tier",
        webPath: "/book/progress",
        category: "TIER_UP",
        threadId: "progress",
        collapseId: "tier-up",
        data: compact({ tier: metaStr(metadata, "tier"), ip: metaNum(metadata, "ip") }),
        priority: 5,
      };

    case "streak_milestone":
      return {
        route: "chapterflow://progress/streak",
        webPath: "/book/progress",
        category: "STREAK",
        threadId: "streak",
        data: compact({ days: metaNum(metadata, "days"), ip: metaNum(metadata, "ip") }),
        priority: 5,
      };

    case "insight_spark":
      return {
        route: "chapterflow://progress",
        webPath: "/book/progress",
        category: "INSIGHT_SPARK",
        threadId: "insights",
        data: compact({ amount: metaNum(metadata, "amount") }),
        priority: 5,
      };

    case "reading_reminder":
      return {
        route: "chapterflow://home",
        webPath: "/book/library",
        category: "READING_REMINDER",
        threadId: "reminders",
        // Coalesce: a queued-but-undelivered reminder should be replaced by the
        // newest one rather than stacking.
        collapseId: "reading-reminder",
        data: {},
        priority: 5,
      };

    case "streak_at_risk":
      return {
        route: "chapterflow://progress/streak",
        webPath: "/book/progress",
        category: "STREAK_AT_RISK",
        threadId: "streak",
        collapseId: "streak-at-risk",
        data: {},
        // Time-sensitive — the streak lapses within hours, so deliver now.
        priority: 10,
      };

    case "partner_nudge":
      return {
        route: "chapterflow://partner",
        webPath: "/book/progress",
        category: "PARTNER_NUDGE",
        threadId: "partner",
        data: {},
        priority: 5,
      };

    case "commitment_followup": {
      const commitmentId = metaStr(metadata, "commitmentId");
      const bookId = metaStr(metadata, "bookId");
      return {
        route: commitmentId
          ? `chapterflow://commitments/${commitmentId}`
          : "chapterflow://commitments",
        webPath: "/book/progress",
        category: "COMMITMENT_FOLLOWUP",
        threadId: "commitments",
        data: compact({ commitmentId, bookId }),
        priority: 5,
      };
    }

    case "event_reminder": {
      const eventId = metaStr(metadata, "eventId");
      return {
        route: eventId ? `chapterflow://events/${eventId}` : "chapterflow://events",
        webPath: "/book/events",
        category: "EVENT_REMINDER",
        threadId: "events",
        collapseId: eventId ? `event-${eventId}` : "event",
        data: compact({ eventId }),
        priority: 5,
      };
    }

    case "scenario_approved":
    case "scenario_rejected": {
      const submissionId = metaStr(metadata, "submissionId");
      return {
        route: submissionId
          ? `chapterflow://scenarios/${submissionId}`
          : "chapterflow://scenarios",
        webPath: "/book/progress",
        category: "SCENARIO_REVIEW",
        threadId: "scenarios",
        data: compact({ submissionId, ip: metaNum(metadata, "ip") }),
        priority: 5,
      };
    }

    default:
      // Unknown / undocumented type — open the inbox rather than a dead link.
      return {
        route: "chapterflow://notifications",
        webPath: "/book/library",
        category: "GENERAL",
        threadId: "general",
        data: {},
        priority: 5,
      };
  }
}

/** Common input for building a payload of either transport. */
export type PushMessage = {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** Unread inbox count → APNs badge. Omitted ⇒ no badge mutation. */
  badge?: number;
};

/** The `aps` dictionary Apple interprets, plus our custom keys. */
export type ApnsPayload = {
  aps: {
    alert: { title: string; body: string };
    sound: "default";
    category: string;
    "thread-id": string;
    badge?: number;
    "mutable-content": 1;
  };
  type: string;
  route: string;
  data: Record<string, string | number | boolean>;
};

/** The JSON the web service worker (`public/sw.js`) consumes. */
export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
  type: string;
  route: string;
};

/**
 * Serialize a payload and, if it exceeds `MAX_PUSH_PAYLOAD_BYTES`, truncate the
 * alert body (the only unbounded field) until it fits — a body-length overflow
 * must never cause APNs to reject the whole push. Returns the possibly-shortened
 * body plus the final byte length.
 */
export function fitBody(
  makePayload: (body: string) => unknown,
  body: string,
): { body: string; bytes: number } {
  const bytesOf = (b: string) => Buffer.byteLength(JSON.stringify(makePayload(b)), "utf8");
  let current = body;
  let bytes = bytesOf(current);
  if (bytes <= MAX_PUSH_PAYLOAD_BYTES) return { body: current, bytes };

  // Binary-free greedy shrink with an ellipsis; loop is bounded by body length.
  const ELLIPSIS = "…";
  while (current.length > 0 && bytes > MAX_PUSH_PAYLOAD_BYTES) {
    // Drop ~ the overflow in characters (≥1) each pass.
    const overflowChars = Math.max(1, Math.ceil((bytes - MAX_PUSH_PAYLOAD_BYTES) / 2));
    const keep = Math.max(0, current.length - overflowChars - ELLIPSIS.length);
    current = keep > 0 ? current.slice(0, keep) + ELLIPSIS : "";
    bytes = bytesOf(current);
  }
  return { body: current, bytes };
}

/** Build the APNs payload (aps + custom keys) for a notification. */
export function buildApnsPayload(msg: PushMessage): ApnsPayload {
  const spec = routeSpecFor(msg.type, msg.metadata);
  const make = (body: string): ApnsPayload => ({
    aps: {
      alert: { title: msg.title, body },
      sound: "default",
      category: spec.category,
      "thread-id": spec.threadId,
      ...(typeof msg.badge === "number" && msg.badge >= 0 ? { badge: Math.floor(msg.badge) } : {}),
      "mutable-content": 1,
    },
    type: msg.type,
    route: spec.route,
    data: spec.data,
  });
  const { body } = fitBody(make, msg.body);
  return make(body);
}

/** Build the web-push payload consumed by `public/sw.js`. */
export function buildWebPushPayload(msg: PushMessage): WebPushPayload {
  const spec = routeSpecFor(msg.type, msg.metadata);
  const make = (body: string): WebPushPayload => ({
    title: msg.title,
    body,
    url: spec.webPath,
    type: msg.type,
    route: spec.route,
  });
  const { body } = fitBody(make, msg.body);
  return make(body);
}

/**
 * APNs request headers (minus `authorization`, which the sender injects with a
 * freshly-signed provider JWT). Pure so the header contract is unit-testable.
 * `apns-topic` MUST be the app's bundle id.
 */
export function apnsRequestHeaders(params: {
  bundleId: string;
  spec: NotificationRouteSpec;
}): Record<string, string> {
  const { bundleId, spec } = params;
  const headers: Record<string, string> = {
    "apns-topic": bundleId,
    "apns-push-type": "alert",
    "apns-priority": String(spec.priority),
  };
  if (spec.collapseId) {
    // APNs caps apns-collapse-id at 64 bytes.
    headers["apns-collapse-id"] = spec.collapseId.slice(0, 64);
  }
  return headers;
}

/**
 * Pure APNs provider-JWT claim set (header + payload). The signature is applied
 * by the sender via jose; this keeps the claim shape testable. `iat` is epoch
 * SECONDS; APNs rejects tokens older than 1h, so the sender refreshes well
 * inside that window.
 */
export function apnsJwtClaims(params: {
  keyId: string;
  teamId: string;
  iatSeconds: number;
}): { header: { alg: "ES256"; kid: string }; payload: { iss: string; iat: number } } {
  return {
    header: { alg: "ES256", kid: params.keyId },
    payload: { iss: params.teamId, iat: Math.floor(params.iatSeconds) },
  };
}
