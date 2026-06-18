/**
 * Behavior-loop funnel TAIL — pure, AWS-free counting + scaling core (feedback #8).
 *
 * The admin activation funnel historically stopped at "first commitment" and never
 * reported what happened AFTER the user committed, even though `followup_completed`
 * (carrying its `helped` outcome) and `application_complete` are already in the event
 * log. This module derives the three behavior-loop tail steps:
 *
 *   returned          — the user came back and reported on their commitment at all
 *                       (any `followup_completed`, regardless of `helped`).
 *   reported_helped   — the user reported the commitment HELPED.
 *                       ONLY `helped === "helped"` counts; absent / undefined / null /
 *                       "partly" / "didnt" are RETURNED-BUT-NOT-HELPED.
 *   applied           — the user's chapter became "applied" (`application_complete`).
 *                       Defensive: if that event type is absent from the scan the count
 *                       is simply 0 (this module never emits the event).
 *
 * All three are PER-USER PRESENCE (breadth) counters: a unique user with >= 1 matching
 * event counts exactly ONCE, no matter how many such events they have. They are then
 * scaled to the full population with the SAME single scale factor the head-of-funnel
 * commitment step uses, so the whole funnel reads on one consistent estimate basis.
 *
 * No `server-only` / AWS imports on purpose: the route does the I/O (sample the recent
 * users, fetch each user's events) and hands the raw per-user event arrays here so the
 * counting/scaling stays pure and unit-testable.
 */

/** Minimal shape of an analytics event item this core reads. */
export type FunnelTailEvent = {
  eventType?: unknown;
  helped?: unknown;
};

export type FunnelTailCounts = {
  /** Unique users with any `followup_completed` event. */
  returned: number;
  /** Unique users with a `followup_completed` where `helped === "helped"`. */
  reportedHelped: number;
  /** Unique users with an `application_complete` event (0 if the type is absent). */
  applied: number;
};

/**
 * Count the three tail steps over the SAMPLED set of per-user event arrays. Each entry
 * of `usersEvents` is one user's events (newest-first, already bounded by the caller's
 * per-user scan cap). Per-user dedup is intrinsic: we test each user's array once and
 * increment by at most 1.
 */
export function countFunnelTail(
  usersEvents: ReadonlyArray<ReadonlyArray<FunnelTailEvent>>,
): FunnelTailCounts {
  let returned = 0;
  let reportedHelped = 0;
  let applied = 0;

  for (const events of usersEvents) {
    let userReturned = false;
    let userReportedHelped = false;
    let userApplied = false;

    for (const e of events) {
      const type = String(e?.eventType ?? "");
      if (type === "followup_completed") {
        userReturned = true;
        // Only "helped"==="helped" counts as reported-helped; absent/partly/didnt
        // are returned-but-not-helped (the `helped` field is optional on the event).
        if (e?.helped === "helped") userReportedHelped = true;
      } else if (type === "application_complete") {
        // Defensive: this event type may not be present in the scan at all — then
        // `applied` simply never increments and stays 0. We never emit it here.
        userApplied = true;
      }
    }

    if (userReturned) returned += 1;
    if (userReportedHelped) reportedHelped += 1;
    if (userApplied) applied += 1;
  }

  return { returned, reportedHelped, applied };
}

/**
 * Scale a sampled per-user count up to the estimated full population using the SAME
 * single factor the commitment head-step uses: `factor = total / sampleSize`, applied
 * only when the sample is smaller than the population. Rounds to a whole user count.
 */
export function scaleFunnelCount(sampleCount: number, sampleSize: number, total: number): number {
  if (sampleSize <= 0) return 0;
  if (sampleSize >= total) return sampleCount;
  return Math.round(sampleCount * (total / sampleSize));
}
