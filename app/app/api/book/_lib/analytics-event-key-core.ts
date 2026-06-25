// Pure sort-key builder for the append-only analytics EVENT# stream.
//
// Every `putEvent` in analytics-repo.ts writes an item under the user partition
// with SK `EVENT#<iso>#<eventType>`. That SK historically carried NO uniqueness
// discriminant, and the write is a plain `PutCommand` with no ConditionExpression
// — so two events of the SAME eventType for the SAME user that resolve to the
// SAME millisecond (`nowIso()` is `Date.toISOString()`, ms resolution) produce a
// BYTE-IDENTICAL SK and the second Put SILENTLY OVERWRITES the first (DynamoDB
// Put is a full-item replace). This is a real collision path: batched client
// beacons, a double-fired `quiz_explanation_opened`, two reading-session
// heartbeats, or any caller that fires the same event type twice in a tight loop
// all lose an event. Append-only is the documented contract for this stream
// (admin event feeds, GDPR export, GSI date-range analytics all read it back),
// so a lost event is silent data corruption.
//
// Fix: append a high-entropy uniqueness suffix so two distinct events can never
// collide, WITHOUT disturbing the prefix any consumer relies on. Consumers query
// the stream with `begins_with(SK, "EVENT#")` and sort/group on the `occurredAt`
// / `eventDate` / `eventType` ATTRIBUTES (never by parsing the SK), and the `iso`
// stays the leading segment so lexicographic SK order is still chronological.
//
// This module is pure (only `node:crypto`) so it can be unit-tested via
// `tsx --test`: analytics-repo.ts pulls in `server-only` (via aws.ts) and cannot
// be imported by the node:test runner directly — the repo's documented *-core
// seam pattern (see license-redaction-core.ts).
import { randomUUID } from "node:crypto";

/** The leading SK segment that marks the append-only analytics event stream. */
export const EVENT_SK_PREFIX = "EVENT#";

/**
 * Build the SK for one analytics event row.
 *
 * Shape: `EVENT#<iso>#<eventType>#<uniqueId>`
 *
 * - `iso` stays first so a `Query`/scan over the partition still sorts events
 *   chronologically and `begins_with(SK, "EVENT#")` still selects the whole
 *   stream.
 * - `<uniqueId>` is the uniqueness discriminant that makes two same-millisecond,
 *   same-type events for one user distinct rows instead of an overwrite. Caller
 *   may inject one (e.g. a domain id) for determinism; otherwise a random id is
 *   generated so the default is collision-free.
 */
export function eventSk(iso: string, eventType: string, uniqueId?: string): string {
  const suffix = uniqueId && uniqueId.length > 0 ? uniqueId : newEventUniqueId();
  return `${EVENT_SK_PREFIX}${iso}#${eventType}#${suffix}`;
}

/**
 * Generate a fresh uniqueness discriminant for an event SK. A full UUIDv4 (122
 * bits of entropy) makes a same-instant collision astronomically unlikely even
 * under high write fan-out; the hyphens are SK-safe but stripped to keep the SK
 * compact and free of a delimiter that could be confused with the `#` separator.
 */
export function newEventUniqueId(): string {
  return randomUUID().replace(/-/g, "");
}
