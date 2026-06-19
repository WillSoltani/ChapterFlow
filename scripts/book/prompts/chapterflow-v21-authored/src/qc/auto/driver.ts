/**
 * The shared QC round-driver — the ONE definition of the post-create QC sequence
 * that both `qc-auto` (human/operator-driven) and the Book Autopilot conductor run:
 *
 *   spawn first-wave reviewers → collect → confirm-candidates → spawn confirm
 *   reviewers → finalize → (narrow retry on INCOMPLETE) → metrics → verdict
 *   (+ full-book qc-status verification on a clean pass).
 *
 * WHY A SHARED DRIVER.  qc-auto and autopilot used to reconstruct this sequence
 * independently — the same ordered steps, written twice, free to drift (autopilot
 * lacked the metrics + qc-status verification + incremental/tiebreak wiring qc-auto
 * had). The deterministic GATE/finalize LEAF functions were already single-defined,
 * so they could not drift; the SEQUENCING around them could. This module is that
 * sequencing, once.
 *
 * The two callers differ ONLY in HOW each step is invoked, so the step invocation is
 * injected via `QcDriveSteps`:
 *  - qc-auto injects IN-PROCESS calls (orch.collectQcRound, finalizeQcRound, …) — its
 *    long-standing behavior and exact console output are preserved by the caller.
 *  - autopilot injects `runVerb` (CLI subprocess) adapters, so the strict-env
 *    invariants stay FORCE-SET on every gate subprocess (the PR1 fail-closed fix) and
 *    each reviewer is a fenced `codex exec` session.
 *
 * The driver itself is PURE over its injected steps (no fs / orchestrator imports), so
 * it is exhaustively unit-testable without a real book, round, or codex.
 */

import type { FinalizeQcRoundResult } from "../orchestrator/finalize.js";

type MaybePromise<T> = T | Promise<T>;

export type ReviewerWave = "first" | "dynamic" | "retry";

/** The driver's terminal classification of one round pass. Callers format/route it:
 *  PASS / PASS_SUBSET (clean), REPAIR (REVISE/CORRUPTION), INCOMPLETE (missing
 *  evidence), INTEGRITY (a reviewer mutated a chapter → round void), QC_STATUS_FAIL
 *  (finalize said all-publishable but the full-book qc-status check disagreed), INFRA
 *  (a tool/config error — a missing role token, or a finalize that returned no
 *  actionable verdict; NEVER routed to a content edit). */
export type QcDriveOutcome = "PASS" | "PASS_SUBSET" | "REPAIR" | "INCOMPLETE" | "INTEGRITY" | "QC_STATUS_FAIL" | "INFRA";

/** A reviewer wave's outcome. `integrityViolation` = a reviewer mutated chapter content
 *  (round void). `infraError` = the wave couldn't even be brokered (e.g. a role token is
 *  missing from the review packet) — a config/tool failure, not a content problem. */
export type ReviewerWaveResult = { integrityViolation?: string; infraError?: string };

/** The behavior-divergent steps, injected so qc-auto (in-process) and autopilot
 *  (runVerb subprocess + codex reviewers) share the SEQUENCE but not the mechanism. */
export type QcDriveSteps = {
  /** Run a reviewer wave. qc-auto: no-op (submissions are already on disk, filled by
   *  the human/agent between runs). autopilot: spawn a fenced `codex exec` reviewer per
   *  card. Returns integrityViolation iff a reviewer mutated a chapter, infraError iff
   *  the wave couldn't be brokered. */
  spawnReviewers: (cards: string[], wave: ReviewerWave) => Promise<ReviewerWaveResult>;
  firstWaveCards: () => string[];
  /** The review work GENERATED during the round: confirm cards (for chapters at a
   *  publishable verdict) AND bar-tiebreak t2/t3 cards (for borderline ones). The
   *  dynamic-wave loop drives these to a fixpoint. For qc-auto this is moot — its
   *  submissionPresent stub returns true, so the loop never spawns. */
  pendingReviewCards: () => string[];
  /** Count reviewer submissions on disk (0 ⇒ INCOMPLETE, still awaiting reviewers). */
  countSubmissions: () => number;
  /** Is this card's submission present? MUST be variant-aware for bar-tiebreak t2/t3
   *  cards (check the variant-specific derived artifact), else the loop never converges. */
  submissionPresent: (card: string) => boolean;
  // These three differ by invocation model — qc-auto returns in-process results
  // synchronously; autopilot returns Promises (CLI subprocess via runVerb). The
  // driver awaits, so both work.
  collect: () => MaybePromise<{ ok: boolean; errors: string[] }>;
  generateConfirmCandidates: () => MaybePromise<{ ok: boolean; errors: string[] }>;
  finalize: () => MaybePromise<FinalizeQcRoundResult>;
  ledgerOpenCount: () => number;
  /** Best-effort telemetry append (one row per finalization). Must not throw. */
  recordMetrics: (finalized: FinalizeQcRoundResult) => void;
  /** Verify the WHOLE book passes (qc-status parity) after an all-publishable
   *  finalize. Omit to skip (e.g. a `--chapters` subset is never a book-level pass). */
  verifyFullBook?: () => Promise<boolean>;
  log?: (m: string) => void;
};

export type QcDriveOptions = {
  /** A `--chapters` subset run is never a book-level PASS. */
  isSubset: boolean;
  /** Re-spawn ONLY the cards still missing a submission once before giving up
   *  (autopilot). Off for qc-auto (a no-op spawner can't supply the missing ones). */
  narrowRetryOnIncomplete: boolean;
  /** Cap on the generate→spawn→collect→regenerate loop that drives dynamically-created
   *  confirm + tiebreak cards to a fixpoint. Default 4 (t2+t3 in one wave, then confirm =
   *  2 waves worst case; the cap is a backstop). */
  maxDynamicWaves?: number;
};

export type QcDriveResult = {
  outcome: QcDriveOutcome;
  /** Set for INCOMPLETE/INTEGRITY/QC_STATUS_FAIL/INFRA — a short machine token or message. */
  reason?: string;
  finalized?: FinalizeQcRoundResult;
  counts: { publishable: number; revise: number; corruption: number; incomplete: number };
  openRepairFindings: number;
  collectErrors: string[];
};

const ZERO = { publishable: 0, revise: 0, corruption: 0, incomplete: 0 };
const MAX_DYNAMIC_WAVES_DEFAULT = 4;

/** Drive ONE QC round pass over the injected steps. Pure: no fs, no orchestrator —
 *  every effect is a step. Never throws on a step's negative result; it classifies. */
export async function driveQcRoundCore(steps: QcDriveSteps, opts: QcDriveOptions): Promise<QcDriveResult> {
  const log = steps.log ?? (() => {});
  const maxWaves = opts.maxDynamicWaves ?? MAX_DYNAMIC_WAVES_DEFAULT;
  const fail = (outcome: QcDriveOutcome, reason: string, collectErrors: string[] = []): QcDriveResult =>
    ({ outcome, reason, counts: ZERO, openRepairFindings: 0, collectErrors });

  // 1. First-wave reviewers (no-op for qc-auto; fenced codex for autopilot).
  const v1 = await steps.spawnReviewers(steps.firstWaveCards(), "first");
  if (v1.integrityViolation) return fail("INTEGRITY", v1.integrityViolation);
  if (v1.infraError) return fail("INFRA", v1.infraError);

  // 2. Submissions must exist before collect (qc-auto: human fills between runs).
  if (steps.countSubmissions() === 0) return fail("INCOMPLETE", "no-submissions");

  // 3. Collect + validate stored submissions.
  const collected = await steps.collect();
  if (!collected.ok) return fail("INCOMPLETE", "collect-failed", collected.errors);

  // 4. Generate confirm-candidate (+ bar-tiebreak) cards.
  const confirm = await steps.generateConfirmCandidates();
  if (!confirm.ok) return fail("INCOMPLETE", "confirm-failed", confirm.errors);

  // 5. Dynamic-wave loop. confirm-candidates GENERATES new review work: confirm cards
  //    (publishable chapters) and bar-tiebreak t2/t3 cards (borderline chapters, which
  //    confirm-candidates BLOCKS until the extra reads land). A FIRST-WAVE card can also
  //    still be missing (a flaky reviewer), and its absence gates the confirm card for its
  //    chapter — so the pending set is EVERY still-missing card (first-wave + generated).
  //    Spawn them, re-collect, regenerate — to a fixpoint. Stop when no work remains OR a
  //    wave makes ZERO progress (a no-op spawner, i.e. qc-auto; or a genuinely stuck
  //    reviewer). qc-auto's submissionPresent:()=>true ⇒ `pending` is empty ⇒ 0 waves ⇒
  //    byte-identical single-pass behavior (it relies on the human re-running instead).
  for (let wave = 0; wave < maxWaves; wave++) {
    const pending = [...steps.firstWaveCards(), ...steps.pendingReviewCards()].filter((c) => !steps.submissionPresent(c));
    if (pending.length === 0) break;
    const vd = await steps.spawnReviewers(pending, "dynamic");
    if (vd.integrityViolation) return fail("INTEGRITY", vd.integrityViolation, collected.errors);
    if (vd.infraError) return fail("INFRA", vd.infraError, collected.errors);
    // Zero-progress guard: break if THIS wave filled nothing in the current pending set
    // (a no-op spawner, or a genuinely stuck reviewer). The loop only continues while a
    // wave makes progress (≥1 card fills), and `pending` is rebuilt each iteration from
    // ALL still-missing cards — so it converges (≤3 waves for the worst chapter: bar →
    // t2+t3 → confirm) and can NEVER spin; maxWaves is the backstop, not the terminator.
    if (pending.every((c) => !steps.submissionPresent(c))) break;
    const c2 = await steps.collect();
    if (!c2.ok) return fail("INCOMPLETE", "collect-failed", c2.errors);
    const cc2 = await steps.generateConfirmCandidates();
    if (!cc2.ok) return fail("INCOMPLETE", "confirm-failed", cc2.errors);
  }

  // 6. Finalize (writes attestations + evidence matrix + repair brief unless attest off).
  let finalized = await steps.finalize();

  // 7. Narrow retry: a submission can be present-but-INVALID (the file exists so the
  //    pre-finalize loop counts it, but it FAILS validation in collect/finalize) → finalize
  //    INCOMPLETE even though every card was spawned. Re-spawn ONLY the still-missing cards
  //    once, then re-finalize (finalize re-collects). Covers the flaky-reviewer case the
  //    presence-gated loop above cannot see — a DISJOINT failure mode, so both are kept.
  if (finalized.incomplete && opts.narrowRetryOnIncomplete) {
    const allCards = [...steps.firstWaveCards(), ...steps.pendingReviewCards()];
    const missing = allCards.filter((c) => !steps.submissionPresent(c));
    if (missing.length > 0 && missing.length < allCards.length) {
      log(`[qc-driver] INCOMPLETE — narrow retry of ${missing.length}/${allCards.length} missing reviewer card(s)`);
      const v3 = await steps.spawnReviewers(missing, "retry");
      if (v3.integrityViolation) return fail("INTEGRITY", v3.integrityViolation, collected.errors);
      if (v3.infraError) return fail("INFRA", v3.infraError, collected.errors);
      finalized = await steps.finalize();
    }
  }

  const counts = {
    publishable: finalized.chapters.filter((d) => d.finalVerdict === "PUBLISHABLE").length,
    revise: finalized.chapters.filter((d) => d.finalVerdict === "REVISE").length,
    corruption: finalized.chapters.filter((d) => d.finalVerdict === "CORRUPTION").length,
    incomplete: finalized.chapters.filter((d) => d.finalVerdict === "NEEDS_MORE_QC").length,
  };
  steps.recordMetrics(finalized);
  const base = { finalized, counts, openRepairFindings: steps.ledgerOpenCount(), collectErrors: collected.errors };

  // 8. Verdict.
  if (finalized.allPublishable) {
    if (opts.isSubset) return { outcome: "PASS_SUBSET", ...base };
    if (steps.verifyFullBook) {
      const ok = await steps.verifyFullBook();
      if (!ok) return { outcome: "QC_STATUS_FAIL", reason: "qc-status-not-all-pass", ...base };
    }
    return { outcome: "PASS", ...base };
  }
  if (finalized.incomplete) return { outcome: "INCOMPLETE", reason: "needs-more-qc", ...base };
  if (finalized.repairRequired || counts.revise > 0 || counts.corruption > 0) return { outcome: "REPAIR", ...base };
  // Neither publishable, incomplete, nor repair-required: finalize returned no actionable
  // verdict. A well-formed finalize is always one of those three — this only arises from
  // the autopilot adapter's exit-code fallback on an UNEXPECTED finalize exit (a tool/infra
  // error). Classify it INFRA, never REPAIR — don't send a writer to edit content on an
  // infra failure.
  return { outcome: "INFRA", reason: "finalize returned no actionable verdict (likely a tool error)", ...base };
}
