/**
 * Per-user device-token cap (E4) — pure eviction decision, no I/O.
 *
 * `POST /me/devices/register` Puts one DEVICE# row per distinct push endpoint
 * (the SK is a sha256 of the endpoint), and `createNotification`'s push branch
 * queries ALL DEVICE# rows and POSTs to each one. With no cap, a client could
 * register an unbounded number of endpoints, growing the per-notification push
 * fan-out (and the partition) without limit.
 *
 * This module owns the decision of which existing device rows to evict so a
 * user keeps at most `MAX_DEVICES_PER_USER` rows. It is dependency-free (no AWS,
 * no `keys.ts` I/O) so the register route can unit-test the eviction without the
 * server-only DynamoDB seam. The route applies the returned deletes.
 */

/**
 * Maximum DEVICE# rows retained per user. Registering an (N+1)-th distinct
 * endpoint evicts the oldest by `lastSeenAt` so the row count — and therefore
 * the bounded push fan-out — never exceeds this. A typical user has 1–3 devices;
 * the cap leaves generous headroom while killing the unbounded-growth abuse.
 */
export const MAX_DEVICES_PER_USER = 10;

/**
 * Hard ceiling on how many device rows `createNotification` will fan out to in a
 * single push send, independent of the register-time cap. This bounds the loop
 * even for legacy partitions that accumulated rows before the cap existed (a
 * register only evicts down to the cap on its own write). Equal to the cap so a
 * fully-capped user still reaches every one of their devices.
 */
export const MAX_PUSH_FANOUT = MAX_DEVICES_PER_USER;

/** Minimal shape of a persisted device row this module reasons about. */
export type DeviceRowRef = {
  /** DynamoDB sort key of the device row (`DEVICE#<hash>`). */
  SK: string;
  /** ISO timestamp the device was last seen (register/refresh). May be absent on legacy rows. */
  lastSeenAt?: unknown;
};

/** A device row identified for deletion, keyed by its sort key. */
export type DeviceEviction = { SK: string };

/**
 * Parse a `lastSeenAt`-like field into a sortable epoch-ms recency. Missing or
 * unparseable values sort as the OLDEST (`-Infinity`) so legacy rows without a
 * timestamp are the first to be evicted.
 */
function recencyMs(value: unknown): number {
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return -Infinity;
}

/**
 * Given the user's CURRENT device rows and the SK of the row about to be written
 * (the row being registered/refreshed this request — it must always survive),
 * return the set of existing rows to delete so the post-write count is at most
 * `maxDevices`.
 *
 * Rows are ranked newest-first by `lastSeenAt`; the incoming SK is pinned to the
 * front so a re-register of an existing device never evicts itself, and a brand
 * new device always keeps its slot (evicting the oldest OTHER row when full).
 * Ties break by SK descending for determinism. Pure: callers apply the deletes.
 */
export function selectDevicesToEvict(
  currentRows: DeviceRowRef[],
  incomingSk: string,
  maxDevices: number = MAX_DEVICES_PER_USER,
): DeviceEviction[] {
  const cap = Math.max(1, Math.floor(maxDevices));

  // De-dupe by SK (defensive against a paginated/duplicated read), and ensure the
  // incoming row is represented even if it is brand new (not yet in currentRows).
  const bySk = new Map<string, DeviceRowRef>();
  for (const row of currentRows) {
    if (typeof row?.SK === "string" && row.SK.length > 0) bySk.set(row.SK, row);
  }
  // The incoming write always counts as the most-recent row regardless of the
  // stored value, so synthesize/override it with a max recency.
  bySk.set(incomingSk, { SK: incomingSk, lastSeenAt: undefined });

  const ranked = [...bySk.values()].sort((a, b) => {
    if (a.SK === incomingSk) return -1; // incoming row is always kept (front)
    if (b.SK === incomingSk) return 1;
    const byRecency = recencyMs(b.lastSeenAt) - recencyMs(a.lastSeenAt);
    if (byRecency !== 0) return byRecency;
    return a.SK < b.SK ? 1 : a.SK > b.SK ? -1 : 0; // SK desc for stable ordering
  });

  // Everything past the cap is evicted. The incoming SK is at index 0 so it is
  // never in this slice.
  return ranked.slice(cap).map((row) => ({ SK: row.SK }));
}
