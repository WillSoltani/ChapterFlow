import type { QuizSessionView } from "../hooks/useQuizSession";

/**
 * RF-4 (decision D5 — celebrate-then-reconcile). When a quiz pass is graded
 * OFFLINE (the `/submit` POST is unreachable) the reader scores it locally,
 * marks the session `provisional`, and OPTIMISTICALLY completes + unlocks +
 * celebrates the chapter. The server never recorded that pass, so no Insight
 * Points, streak, tier, achievements, or entitlement advance. Decision D5 keeps
 * the optimistic celebrate/unlock but adds the reconciliation it was always
 * missing: while the reader is open, re-submit the provisional pass as soon as
 * connectivity returns so the server records it and the awards land.
 *
 * SCOPE (important): this reconciles a provisional pass that is still LIVE in the
 * in-memory reader session — driven by the `online` event (plus one eager
 * attempt) in ChapterReaderClient. The `provisional` flag is React state only;
 * a pass whose tab is closed/reloaded BEFORE reconnecting loses that flag and is
 * NOT auto-reconciled here. Closing that residual window needs an app-level
 * pending-pass reconciler (resubmit from anywhere on the next online app load),
 * tracked as a follow-up and deliberately kept out of this reader-scoped fix.
 * The common case — pass offline, stay in the reader, reconnect — is fully
 * reconciled.
 *
 * Kept pure so the predicate + the ordered submit→unlock sequence can be
 * unit-tested without a DOM (the reader effect that drives them — connectivity
 * listeners, toast — cannot be).
 */

/**
 * A provisional PASS that the server has not yet confirmed — the only state that
 * needs reconciling. A provisional FAIL records nothing optimistic (no
 * completion/unlock/celebration) so it is intentionally left to a normal online
 * retry rather than being force-submitted (which could surprise the user with a
 * cooldown for an attempt they never knowingly committed).
 */
export function needsReconcile(session: QuizSessionView | null | undefined): boolean {
  return session?.provisional === true && session.result?.passed === true;
}

/** The shape the reader's `quiz.submit()` resolves to (only the session matters
 *  here). `submit()` falls back to a fresh provisional score when `/submit` is
 *  STILL unreachable, so a non-null session with `provisional !== true` is the
 *  signal that the server actually accepted the pass. */
type SubmitResult = { session: QuizSessionView | null } | null;

export type ReconcileOutcome =
  /** Server accepted the pass: streak/tier/achievements/spark awarded + the
   *  deferred loop-complete IP claimed; entitlement advanced. */
  | "confirmed"
  /** Still offline, or `/submit` fell back to a provisional score again — leave
   *  the optimistic state in place and retry on the next reconnect. */
  | "offline"
  /** `/submit` threw a non-fallback error — retry on a later reconcile pass. */
  | "failed"
  /** Server graded the resubmission as NOT passed (rare — local scoring uses real
   *  captured `/check` verdicts). We claim no IP and the server records no pass,
   *  unlock, or points (the `/state` re-derive ignores the client body and
   *  `/unlock` 400s without a real pass). The authoritative session replaces the
   *  provisional one in the reader; only the optimistic LOCAL completion flag is
   *  left in place — bounded, since it grants nothing server-side and cannot
   *  escalate access. */
  | "rejected";

export type ReconcileDeps = {
  /** True when the browser believes it is online. */
  isOnline: () => boolean;
  /** Re-POST the provisional pass (the reader's `quiz.submit`). */
  submit: () => Promise<SubmitResult>;
  /** Claim the deferred loop-complete Insight Points (the `/unlock` POST).
   *  Idempotent server-side (grant key), so re-firing is safe. */
  claimLoopCompleteIP: () => Promise<unknown>;
};

/**
 * Re-submit a provisional pass and, on confirmation, claim the deferred
 * loop-complete IP. The order is submit→unlock because `/unlock` requires the
 * server to have recorded the pass first (it 400s with `not_eligible` /
 * `no_loop_record` otherwise). Never throws — returns an outcome the caller acts
 * on (confirm toast / silent retry).
 */
export async function reconcileProvisionalPass(deps: ReconcileDeps): Promise<ReconcileOutcome> {
  if (!deps.isOnline()) return "offline";

  let result: SubmitResult;
  try {
    result = await deps.submit();
  } catch {
    return "failed";
  }

  const session = result?.session ?? null;
  if (!session) return "failed";
  // submit() re-marks `provisional` when `/submit` is still unreachable.
  if (session.provisional === true) return "offline";
  if (session.result?.passed !== true) return "rejected";

  // Pass is server-recorded (entitlement advanced + loop pipeline awarded). Claim
  // the deferred loop-complete IP; a failure here is non-fatal — the core
  // reconcile already succeeded and the idempotent claim is retried by a later
  // reconcile pass — so we keep the confirmation.
  try {
    await deps.claimLoopCompleteIP();
  } catch {
    /* idempotent + retryable; the confirmation still stands */
  }
  return "confirmed";
}
