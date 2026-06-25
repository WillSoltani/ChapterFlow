// Pure, DynamoDB-free decision seam for the first-book-start progress-init path.
// This is the *-core seam so the init logic can be unit-tested without reaching real
// DynamoDB (ensure-book-started.ts imports `server-only` + the AWS client at module
// load and can't be imported under `tsx --test`).
//
// THE PROBLEM these guard (A10): ensureUserBookStarted seeds a missing BOOK_PROGRESS
// row via createProgressIfMissing (a PutCommand), then immediately re-reads it via
// getUserProgress to obtain the authoritative row. That re-read was an *eventually
// consistent* GetCommand, so DynamoDB can legitimately return null for the item we
// just wrote. The caller then threw `BookApiError(500, "progress_init_failed")` — a
// hard 500 on the very first book-start (and every quiz-submit calls
// ensureUserBookStarted first, so the failure window also bites mid-read).
//
// FIX (two layers, both represented here):
//  1. The re-read is made STRONGLY consistent (ConsistentRead) so a successful create
//     is guaranteed to be visible — see getUserProgress(..., { consistentRead }).
//  2. Even if the read still comes back null (e.g. createProgressIfMissing swallowed a
//     ConditionalCheckFailed because a *concurrent* writer created the row, or a read
//     blip), we already hold a fully-valid in-memory seed for the row that now exists.
//     resolveSeededProgress prefers the freshly-read authoritative row when present and
//     otherwise falls back to the seed — it NEVER returns null, so the 500 is gone.

import type { BookUserProgress } from "./types";

/**
 * Decide the authoritative progress row after a seed write + (post-create) re-read.
 *
 * `readBack` is the result of the strongly-consistent getUserProgress issued right
 * after createProgressIfMissing. `seed` is the in-memory row that was just written
 * (or that a concurrent writer's create made exist). Because createProgressIfMissing
 * only ever no-ops on an already-existing row, the row is guaranteed to exist after
 * the call regardless of whether the read surfaced it — so we can always return a
 * non-null row and must never throw progress_init_failed here.
 *
 * Preference order:
 *  - `readBack` when present: it's the authoritative stored row (and, on a concurrent
 *    create, it may already carry real progress the seed doesn't have).
 *  - otherwise `seed`: the exact item we attempted to write; safe to use because the
 *    downstream interaction "touch" is a field-scoped conditional Update keyed only by
 *    PK/SK, not a full-object Put, so it won't clobber a concurrent row.
 */
export function resolveSeededProgress(
  readBack: BookUserProgress | null,
  seed: BookUserProgress
): BookUserProgress {
  return readBack ?? seed;
}
