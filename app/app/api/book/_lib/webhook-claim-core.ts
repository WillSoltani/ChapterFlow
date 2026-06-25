/**
 * Pure decision logic for the Stripe-webhook claim-the-event lease (#10).
 *
 * The webhook handler must run its side effects AT MOST ONCE even when Stripe
 * redelivers the same event in parallel. We model this as a lease over a marker
 * item keyed by the event id:
 *
 *   - no marker            → the caller may CLAIM (it is the first/only worker)
 *   - marker status=DONE    → the event already fully processed → DONE (ack 2xx)
 *   - marker status=PROCESSING, lease NOT expired → another worker holds it →
 *                            IN_PROGRESS (do NOT ack 2xx; let Stripe retry so the
 *                            event is not dropped if that worker fails)
 *   - marker status=PROCESSING, lease EXPIRED → a prior worker crashed/timed out
 *                            before completing → the caller may RECLAIM it
 *
 * This module is dependency-free (no AWS, no server-only) so it can be unit
 * tested. The actual conditional Put/Update lives in repo.ts.
 */

export type WebhookClaimDecision = "claim" | "done" | "in_progress" | "reclaim";

/** The shape of an existing webhook marker as read from DynamoDB. */
export type ExistingWebhookMarker = {
  status?: unknown;
  /** Epoch milliseconds at which the PROCESSING lease expires. */
  leaseExpiresAt?: unknown;
};

/**
 * Decide what a worker should do given the (possibly absent) existing marker.
 *
 * `nowMs` is the current wall clock in epoch milliseconds; `leaseMs` is the
 * lease duration used to interpret a malformed/missing `leaseExpiresAt` (a
 * PROCESSING marker with no usable expiry is treated as freshly held, i.e. NOT
 * reclaimable, so two racing first-writers can't both reclaim — fail safe to
 * duplicate).
 *
 * Lease-expiry boundary uses a strict `<`: the lease is considered expired only
 * once `leaseExpiresAt < nowMs` (exactly-at-expiry still belongs to the holder).
 */
export function classifyWebhookClaim(
  existing: ExistingWebhookMarker | null | undefined,
  nowMs: number,
  leaseMs: number,
): WebhookClaimDecision {
  if (!existing) return "claim";

  // A completed event is permanently idempotent — safe to acknowledge (2xx).
  if (existing.status === "DONE") return "done";

  if (existing.status === "PROCESSING") {
    const expiresAt =
      typeof existing.leaseExpiresAt === "number" && Number.isFinite(existing.leaseExpiresAt)
        ? existing.leaseExpiresAt
        : // No parseable expiry: assume the holder just took it (now + leaseMs),
          // so we do NOT reclaim. Fail safe to "someone else is working on it".
          nowMs + leaseMs;
    // Expired lease → a prior worker died → reclaim. Otherwise another worker
    // still holds it → "in_progress": the caller must NOT acknowledge (2xx), or
    // Stripe would stop retrying an event whose processing has not finished.
    return expiresAt < nowMs ? "reclaim" : "in_progress";
  }

  // Unknown/legacy marker status (e.g. an old BOOK_STRIPE_WEBHOOK_EVENT row with
  // no `status`): under the old "record-last" scheme its mere existence proves
  // the event was already processed — done, never reprocess.
  return "done";
}

/**
 * Epoch-ms expiry for a fresh PROCESSING lease taken at `nowMs`.
 */
export function leaseExpiryMs(nowMs: number, leaseSeconds: number): number {
  return nowMs + leaseSeconds * 1000;
}

/**
 * DynamoDB TTL value (epoch SECONDS) for a PROCESSING marker. The TTL is set a
 * safe margin beyond the lease so DynamoDB's (eventually-consistent, up to ~48h)
 * TTL sweep can never delete a marker that a worker still holds or that is still
 * inside a legitimate Stripe-retry window. On success the marker is flipped to
 * DONE and the ttl REMOVEd, so DONE markers are kept forever for idempotency.
 */
export function leaseTtlEpochSeconds(nowMs: number, leaseSeconds: number): number {
  // Keep the marker for at least 24h past the lease (Stripe retries an event
  // for up to ~3 days; the DONE flip removes the ttl entirely, so this only
  // governs how long a crashed/never-completed PROCESSING marker lingers).
  const lingerSeconds = leaseSeconds + 24 * 60 * 60;
  return Math.floor(nowMs / 1000) + lingerSeconds;
}
