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

export type ReviewerWave = "first" | "confirm" | "retry";

/** The driver's terminal classification of one round pass. Callers format/route it:
 *  PASS / PASS_SUBSET (clean), REPAIR (REVISE/CORRUPTION), INCOMPLETE (missing
 *  evidence), INTEGRITY (a reviewer mutated a chapter → round void), QC_STATUS_FAIL
 *  (finalize said all-publishable but the full-book qc-status check disagreed). */
export type QcDriveOutcome = "PASS" | "PASS_SUBSET" | "REPAIR" | "INCOMPLETE" | "INTEGRITY" | "QC_STATUS_FAIL";

/** The behavior-divergent steps, injected so qc-auto (in-process) and autopilot
 *  (runVerb subprocess + codex reviewers) share the SEQUENCE but not the mechanism. */
export type QcDriveSteps = {
  /** Run a reviewer wave. qc-auto: no-op (submissions are already on disk, filled by
   *  the human/agent between runs). autopilot: spawn a fenced `codex exec` reviewer per
   *  card. Returns `integrityViolation` iff a reviewer mutated chapter content. */
  spawnReviewers: (cards: string[], wave: ReviewerWave) => Promise<{ integrityViolation?: string }>;
  firstWaveCards: () => string[];
  confirmCards: () => string[];
  /** Count reviewer submissions on disk (0 ⇒ INCOMPLETE, still awaiting reviewers). */
  countSubmissions: () => number;
  /** Is this card's submission present? (for the narrow per-card retry). */
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
};

export type QcDriveResult = {
  outcome: QcDriveOutcome;
  /** Set for INCOMPLETE/INTEGRITY/QC_STATUS_FAIL — a short machine token or message. */
  reason?: string;
  finalized?: FinalizeQcRoundResult;
  counts: { publishable: number; revise: number; corruption: number; incomplete: number };
  openRepairFindings: number;
  collectErrors: string[];
};

const ZERO = { publishable: 0, revise: 0, corruption: 0, incomplete: 0 };

/** Drive ONE QC round pass over the injected steps. Pure: no fs, no orchestrator —
 *  every effect is a step. Never throws on a step's negative result; it classifies. */
export async function driveQcRoundCore(steps: QcDriveSteps, opts: QcDriveOptions): Promise<QcDriveResult> {
  const log = steps.log ?? (() => {});

  // 1. First-wave reviewers (no-op for qc-auto; fenced codex for autopilot).
  const v1 = await steps.spawnReviewers(steps.firstWaveCards(), "first");
  if (v1.integrityViolation) return { outcome: "INTEGRITY", reason: v1.integrityViolation, counts: ZERO, openRepairFindings: 0, collectErrors: [] };

  // 2. Submissions must exist before collect (qc-auto: human fills between runs).
  if (steps.countSubmissions() === 0) return { outcome: "INCOMPLETE", reason: "no-submissions", counts: ZERO, openRepairFindings: 0, collectErrors: [] };

  // 3. Collect + validate stored submissions.
  const collected = await steps.collect();
  if (!collected.ok) return { outcome: "INCOMPLETE", reason: "collect-failed", counts: ZERO, openRepairFindings: 0, collectErrors: collected.errors };

  // 4. Generate confirm-candidate cards for chapters at a publishable verdict.
  const confirm = await steps.generateConfirmCandidates();
  if (!confirm.ok) return { outcome: "INCOMPLETE", reason: "confirm-failed", counts: ZERO, openRepairFindings: 0, collectErrors: confirm.errors };

  // 5. Confirm-wave reviewers (no-op for qc-auto; fenced codex for autopilot).
  const confCards = steps.confirmCards();
  if (confCards.length) {
    const v2 = await steps.spawnReviewers(confCards, "confirm");
    if (v2.integrityViolation) return { outcome: "INTEGRITY", reason: v2.integrityViolation, counts: ZERO, openRepairFindings: 0, collectErrors: collected.errors };
  }

  // 6. Finalize (writes attestations + evidence matrix + repair brief unless attest off).
  let finalized = await steps.finalize();

  // 7. Narrow retry: one flaky reviewer ⇒ re-spawn ONLY the missing cards, then
  //    re-finalize (finalize re-collects) — never a whole-book halt.
  if (finalized.incomplete && opts.narrowRetryOnIncomplete) {
    const allCards = [...steps.firstWaveCards(), ...confCards];
    const missing = allCards.filter((c) => !steps.submissionPresent(c));
    if (missing.length > 0 && missing.length < allCards.length) {
      log(`[qc-driver] INCOMPLETE — narrow retry of ${missing.length}/${allCards.length} missing reviewer card(s)`);
      const v3 = await steps.spawnReviewers(missing, "retry");
      if (v3.integrityViolation) return { outcome: "INTEGRITY", reason: v3.integrityViolation, counts: ZERO, openRepairFindings: 0, collectErrors: collected.errors };
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
  return { outcome: "REPAIR", ...base };
}
