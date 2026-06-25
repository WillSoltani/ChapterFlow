// Bounded-concurrency fan-out helper for the reading-reminder cron and its nudge
// sub-handlers.
//
// The hourly cron's reminder pass and the four nudge sub-handlers (weekly-digest,
// welcome-back, streak-at-risk, commitment-followup) each do several DynamoDB
// round-trips PER USER. Iterating users in a strict serial await-chain makes the
// pass O(users) deep in round-trips, so a large fan-out (a Sunday weekly-digest
// run is ~5 serial DynamoDB calls per user) can exceed the Lambda timeout and
// silently drop whichever users the loop reached last.
//
// `runWithConcurrency` runs the per-user task with at most `limit` promises in
// flight at once: deep enough to fit a big fan-out inside the timeout, bounded so
// a large active-user base doesn't open thousands of concurrent DynamoDB/SES
// calls. On-demand (PAY_PER_REQUEST) tables absorb the burst comfortably.
//
// Bounded concurrency does NOT change per-item ordering or idempotency: each task
// still issues its own writes in its own order (e.g. the commitment-followup
// conditional-claim-then-notify sequence). Only the *outer* per-user iteration is
// parallelized, so the dedup markers that make every nudge exactly-once are
// untouched.

/** Default max concurrent per-user tasks. Mirrors the reminder pass's fan-out. */
export const REMINDER_CONCURRENCY = 8;

/**
 * Run `task` over `items` with at most `limit` promises in flight at once.
 *
 * Workers pull from a shared cursor; because the increment is synchronous (no
 * await between read and bump) no two workers ever take the same index, so each
 * item runs exactly once. `results[i]` holds `task(items[i])`'s resolution, in the
 * original item order regardless of completion order.
 *
 * `task` is expected to be failure-isolating (catch its own errors and return a
 * sentinel) — a rejection here propagates out of `Promise.all` and aborts the run,
 * which is the opposite of what the per-user handlers want.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
