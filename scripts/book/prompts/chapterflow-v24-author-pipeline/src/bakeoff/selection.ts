/**
 * Model bake-off — quality-first global selection (WP-702, evaluator-primary
 * ranking WP-E32). PURE — no IO, no spawns — so every decision branch is
 * unit-testable and the report can replay it.
 *
 * TWO modes, chosen once per call from the input shape (never mixed within one
 * selection):
 *
 *   D7-PRIMARY (legacy, pre-WP-E32; the default when ANY candidate's
 *   `evalDiagnostic` input is absent/null) — PRIMARY metric = the Claude-side D7
 *   rubric-audit chapter-diagnostic composite (CandidateD7JudgmentV1.d7Composite),
 *   NEVER a codex model read. The codex whole-book panel (CandidateReviewV1) is a
 *   NON-BLOCKING ADVISORY signal only. Decision hierarchy:
 *     1. Deterministic floor (HARD VETO) — an incomplete book or ANY deterministic
 *        hard failure makes a candidate INELIGIBLE regardless of its D7 score.
 *     2. D7 eligibility — a null D7 composite DISQUALIFIES (never a codex
 *        fallback); a D7-gate failure (base gates, core-domain floor, layer
 *        independence, calibration) DISQUALIFIES.
 *     3. D7 ranking — the higher D7 composite wins OUTSIDE the pinned ±2.0
 *        selection band; inside the band the pair is a TIE deferred to the
 *        WP-705 tie-break ladder (worst-chapter D7 min, then retries, then
 *        latency, then stable model-id order).
 *
 *   EVALUATOR-PRIMARY (WP-E32, owner policy §5.7/§10.5; active only when EVERY
 *   candidate carries a non-null `evalDiagnostic` input record) — PRIMARY metric
 *   = the adjudicated canonical-evaluator chapter diagnostic
 *   (CandidateEvalDiagnosticV1.chapterDiagnostic). The D7 record becomes
 *   SECONDARY, downgrade-only: it can add a disqualification-REVIEW flag (a
 *   recorded string in `reasons`) but can NEVER disqualify or re-rank a
 *   candidate by itself. Decision hierarchy:
 *     1. Deterministic floor — unchanged, same HARD VETO.
 *     2. Evaluator eligibility — a null chapter diagnostic DISQUALIFIES (never a
 *        D7 fallback); `gatesPass === false` DISQUALIFIES.
 *     3. Evaluator ranking — same band mechanism as D7-primary, applied to the
 *        evaluator composite.
 *     4. D7 review flags — recorded AFTER the winner is decided; never revisited.
 *
 * The ±2.0 selection band is DISTINCT from the codex advisory panel's ±3.7 noise
 * band and from the D7 instrument's ±3.0 calibration tolerance.
 */

import type {
  CandidateD7JudgmentV1,
  CandidateEvalDiagnosticV1,
  CandidateReviewV1,
  CandidateScorecardV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
  SelectionV1,
} from "./types.js";
import { D7_SELECTION_BAND } from "./d7Judge.js";

export type SelectionInputs = Array<{
  spec: CandidateSpec;
  label: string;
  generation: CandidateStateV1 | null;
  validation: CandidateValidationV1 | null;
  /** ADVISORY (non-blocking): the codex whole-book panel read. */
  review: CandidateReviewV1 | null;
  /** PRIMARY under D7-primary mode; SECONDARY (downgrade-only) under
   *  evaluator-primary mode: the Claude-side D7 rubric-audit judgment. */
  d7: CandidateD7JudgmentV1 | null;
  /** WP-E32: the canonical-evaluator chapter diagnostic. Present (non-null) on
   *  EVERY candidate ⇒ evaluator-primary mode; absent/null on ANY candidate ⇒
   *  legacy D7-primary mode (backward compat — omit this field entirely to get
   *  byte-stable pre-WP-E32 behavior). */
  evalDiagnostic?: CandidateEvalDiagnosticV1 | null;
}>;

export function buildScorecard(input: SelectionInputs[number], evalPrimary = false): CandidateScorecardV1 {
  const disqualifications: string[] = [];
  const { generation, validation, review, d7, evalDiagnostic } = input;

  // ── 1. Deterministic floor — HARD VETO (independent of the judge). ───────────
  if (!generation || generation.status !== "complete") {
    disqualifications.push(`incomplete book (generation status: ${generation?.status ?? "missing"})`);
  }
  if (!validation) {
    disqualifications.push("deterministic validation never ran");
  } else {
    if (!validation.complete) disqualifications.push("incomplete book (validation)");
    for (const f of validation.hardFailures) disqualifications.push(f);
  }

  if (evalPrimary) {
    // ── 2e. Evaluator eligibility — PRIMARY since WP-E32. A null chapter
    //        diagnostic DISQUALIFIES; it never falls back to D7. D7 gate/layer/
    //        calibration issues are NOT checked here — they become review flags
    //        (collectD7ReviewFlags), never eligibility. ─────────────────────────
    if (!evalDiagnostic || evalDiagnostic.chapterDiagnostic === null) {
      disqualifications.push(
        evalDiagnostic?.ineligibleReason
          ? `no evaluator chapter diagnostic (INELIGIBLE): ${evalDiagnostic.ineligibleReason}`
          : "no evaluator chapter diagnostic — the canonical evaluator did not produce a score (never a D7 fallback)",
      );
    } else if (evalDiagnostic.gatesPass === false) {
      disqualifications.push("evaluator gate FAIL: one or more of gates 1-4 did not pass");
    }
  } else {
    // ── 2. D7 eligibility — legacy PRIMARY judge. A null composite DISQUALIFIES;
    //       it never silently falls back to the codex advisory composite. ───────
    if (!d7 || d7.d7Composite === null) {
      disqualifications.push(
        d7?.ineligibleReason
          ? `no D7 composite (INELIGIBLE): ${d7.ineligibleReason}`
          : "no D7 composite — the Claude-side rubric-audit judge did not produce a score (never a codex fallback)",
      );
    } else {
      if (!d7.d7LayerIndependencePass) {
        disqualifications.push("D7 gate FAIL: a read layer is not self-contained (layer-independence)");
      }
      if (!d7.allCoreDomainsPass) {
        disqualifications.push("D7 gate FAIL: a chapter is below the core-domain floor");
      }
      if (!d7.d7GatesPass) {
        disqualifications.push("D7 gate FAIL: a required base gate did not pass");
      }
      if (!d7.calibrationPass) {
        disqualifications.push("D7 calibration VOID: the hidden calibration item drifted beyond tolerance");
      }
    }
  }

  return {
    model: input.spec.model,
    label: input.label as CandidateScorecardV1["label"],
    eligible: disqualifications.length === 0,
    disqualifications,
    // Inserted ONLY in evaluator-primary mode: an empty spread here in D7-primary
    // mode adds zero keys, so the object below is byte-identical to pre-WP-E32
    // output (same fields, same order) whenever evalPrimary is false.
    ...(evalPrimary
      ? {
          evalDiagnostic: evalDiagnostic?.chapterDiagnostic ?? null,
          evalGatesPass: evalDiagnostic?.gatesPass ?? null,
          evalConfidence: evalDiagnostic?.confidence ?? null,
          evalTerminalState: evalDiagnostic?.terminalState,
        }
      : {}),
    d7Composite: d7?.d7Composite ?? null,
    d7CoreDomainMins: d7?.d7CoreDomainMins ?? null,
    d7GatesPass: d7?.d7GatesPass ?? null,
    d7LayerIndependencePass: d7?.d7LayerIndependencePass ?? null,
    d7Min: d7?.min ?? null,
    d7Verdict: d7?.verdict ?? null,
    bookComposite: review?.bookComposite ?? null,
    bookGate: review?.bookGate ?? null,
    churn: review?.bookChurn ?? "?",
    meanChapterComposite: review?.meanChapterComposite ?? null,
    minChapterComposite: review?.minChapterComposite ?? null,
    chapterPassRate: review?.chapterPassRate ?? null,
    firstAttemptPasses: generation?.firstAttemptPasses ?? 0,
    totalRetries: generation?.totalRetries ?? 0,
    totalDurationMs: generation?.totalDurationMs ?? 0,
  };
}

/**
 * WP-E32 (§5.7): under evaluator-primary mode, the D7 record is SECONDARY —
 * downgrade-only. It never disqualifies or re-ranks; it can only add a
 * disqualification-REVIEW flag (a recorded string) for a human to weigh. Two
 * flag classes:
 *   (a) the D7 record itself carries a fail signal on an evaluator-eligible
 *       candidate (owner policy: "D7 alone never disqualifies" — it triggers
 *       inspection, nothing more here);
 *   (b) the D7 composite would have ranked a DIFFERENT candidate ahead of the
 *       evaluator's winner by a REAL margin (>band, i.e. not noise by D7's own
 *       tie rule) — a genuine disagreement between the two judges.
 * Called AFTER the winner is decided; never influences the decision it reports on.
 */
function collectD7ReviewFlags(
  inputs: SelectionInputs,
  scorecards: CandidateScorecardV1[],
  winner: CandidateScorecardV1 | null,
  band: number,
): string[] {
  const flags: string[] = [];
  const d7Of = (model: string): CandidateD7JudgmentV1 | null => inputs.find((i) => i.spec.model === model)?.d7 ?? null;

  for (const sc of scorecards.filter((s) => s.eligible)) {
    const d7 = d7Of(sc.model);
    const issues: string[] = [];
    if (!d7 || d7.d7Composite === null) {
      issues.push(d7?.ineligibleReason ? `no D7 composite (${d7.ineligibleReason})` : "no D7 composite");
    } else {
      if (!d7.d7LayerIndependencePass) issues.push("D7 layer-independence FAIL");
      if (!d7.allCoreDomainsPass) issues.push("D7 core-domain floor FAIL");
      if (!d7.d7GatesPass) issues.push("D7 required-gate FAIL");
      if (!d7.calibrationPass) issues.push("D7 calibration VOID");
    }
    for (const issue of issues) {
      flags.push(
        `disqualification-review flag (D7 secondary, NOT disqualifying under evaluator-primary ranking): ${sc.model} — ${issue}.`,
      );
    }
  }

  if (winner) {
    const winnerD7 = d7Of(winner.model)?.d7Composite;
    if (winnerD7 != null) {
      for (const other of scorecards.filter((s) => s.eligible && s !== winner)) {
        const otherD7 = d7Of(other.model)?.d7Composite;
        if (otherD7 == null || Math.abs(winnerD7 - otherD7) <= band) continue; // absent, or D7 itself calls it noise
        if (otherD7 > winnerD7) {
          flags.push(
            `disqualification-review flag (D7 secondary, NOT re-ranking under evaluator-primary ranking): the ` +
              `evaluator diagnostic selected ${winner.model} over ${other.model}, but the D7 secondary read disagrees ` +
              `by a real margin (${otherD7.toFixed(2)} vs ${winnerD7.toFixed(2)}, band ±${band}) favoring ${other.model} ` +
              `— the evaluator diagnostic remains authoritative.`,
          );
        }
      }
    }
  }
  return flags;
}

/** Compare OUTSIDE the selection band: returns the better candidate or null when
 *  the pair is quality-tied (inside the band on the PRIMARY composite —
 *  `primaryOf`, the evaluator chapter diagnostic under evaluator-primary mode,
 *  else the D7 composite). */
function primaryCompare(
  a: CandidateScorecardV1,
  b: CandidateScorecardV1,
  band: number,
  reasons: string[],
  primaryOf: (s: CandidateScorecardV1) => number,
  metricLabel: string,
): CandidateScorecardV1 | null {
  const compA = primaryOf(a);
  const compB = primaryOf(b);
  if (Math.abs(compA - compB) > band) {
    const better = compA > compB ? a : b;
    reasons.push(`${better.model} beats ${(better === a ? b : a).model} on the ${metricLabel} (${compA.toFixed(2)} vs ${compB.toFixed(2)}, band ±${band}) — a real quality gap on the primary judge.`);
    return better;
  }
  return null;
}

/** The tie-break — ONLY reached inside the ±2.0 primary-metric band. INTERIM
 *  stand-in for the WP-705 ladder: worst-chapter D7 min, then retries, then
 *  latency, then stable model order. Unchanged by WP-E32 — the ladder stays
 *  D7-sourced (per-chapter granularity) in BOTH modes; WP-705 owns any redesign. */
function tieBreak(tied: CandidateScorecardV1[], reasons: string[], primaryOf: (s: CandidateScorecardV1) => number, metricLabel: string): CandidateScorecardV1 {
  const ranked = [...tied].sort((a, b) =>
    ((b.d7Min ?? -Infinity) - (a.d7Min ?? -Infinity)) ||
    (a.totalRetries - b.totalRetries) ||
    (a.totalDurationMs - b.totalDurationMs) ||
    a.model.localeCompare(b.model));
  const w = ranked[0];
  reasons.push(
    `${metricLabel} effectively TIED (±${D7_SELECTION_BAND}) among ${tied.map((t) => `${t.model} (${primaryOf(t).toFixed(2)})`).join(", ")} — ` +
    "deferred to the tie-break ladder (worst-chapter D7 min, then retries, then latency; WP-705 owns the full ladder): " +
    `selected ${w.model} (worst-chapter D7 min ${ranked.map((t) => `${t.model}=${t.d7Min?.toFixed(2) ?? "n/a"}`).join(", ")}; ` +
    `retries ${ranked.map((t) => `${t.model}=${t.totalRetries}`).join(", ")}).`,
  );
  return w;
}

export function selectWinner(inputs: SelectionInputs, band = D7_SELECTION_BAND): SelectionV1 {
  const reasons: string[] = [];
  // WP-E32 (§5.7): evaluator-primary mode activates ONLY when every candidate in
  // THIS selection carries a non-null evaluator-diagnostic input (the record may
  // still have null/false internal fields — that is handled by eligibility, not
  // the mode switch). Absent on ANY candidate (the default today — no evaluator
  // writer wired yet) ⇒ legacy D7-primary mode, byte-identical to pre-WP-E32.
  const evalPrimary = inputs.length > 0 && inputs.every((i) => i.evalDiagnostic != null);
  const scorecards = inputs.map((i) => buildScorecard(i, evalPrimary));
  const primaryOf = (s: CandidateScorecardV1): number => (evalPrimary ? (s.evalDiagnostic ?? -Infinity) : (s.d7Composite ?? -Infinity));
  const metricLabel = evalPrimary ? "evaluator chapter-diagnostic composite" : "D7 chapter-diagnostic composite";

  for (const sc of scorecards.filter((s) => !s.eligible)) {
    reasons.push(`${sc.model} is INELIGIBLE: ${sc.disqualifications[0]}${sc.disqualifications.length > 1 ? ` (+${sc.disqualifications.length - 1} more)` : ""}`);
  }
  const eligible = scorecards.filter((s) => s.eligible);

  let winner: CandidateScorecardV1 | null = null;
  let decidedByTieBreak = false;
  if (eligible.length === 1) {
    winner = eligible[0];
    reasons.push(`${winner.model} is the only eligible candidate.`);
  } else if (eligible.length > 1) {
    // Two-pass reduction: find the leader by iterative pairwise comparison on the
    // primary composite, then collect everyone tied WITH that leader inside the
    // ±2.0 band; the tie-break runs only over that tied set.
    const survivors = [...eligible].sort((a, b) => primaryOf(b) - primaryOf(a));
    let leader = survivors[0];
    for (const other of survivors.slice(1)) {
      const better = primaryCompare(leader, other, band, reasons, primaryOf, metricLabel);
      if (better === other) leader = other;
    }
    const silent: string[] = [];
    const tied = survivors.filter((s) => s === leader || primaryCompare(leader, s, band, silent, primaryOf, metricLabel) === null);
    if (tied.length === 1) {
      winner = tied[0];
      if (!reasons.some((r) => r.startsWith(winner!.model))) {
        reasons.push(`${winner.model} wins on the ${metricLabel} (${primaryOf(winner).toFixed(2)}).`);
      }
    } else {
      winner = tieBreak(tied, reasons, primaryOf, metricLabel);
      decidedByTieBreak = true;
    }
  } else {
    reasons.push("NO candidate is eligible — nothing may be promoted or published from this run.");
  }

  const ranked = eligible
    .filter((s) => s !== winner)
    .sort((a, b) => primaryOf(b) - primaryOf(a));
  const runnerUp = ranked[0]?.model ?? null;

  // WP-E32 (§5.7): under evaluator-primary mode, record D7 review flags AFTER
  // the winner is decided — they document disagreement, they never cause it.
  if (evalPrimary) {
    for (const flag of collectD7ReviewFlags(inputs, scorecards, winner, band)) reasons.push(flag);
  }

  // Per-chapter D7 tendencies (analysis only — the promoted book is single-model).
  const chapterNumbers = new Set<number>();
  for (const i of inputs) for (const c of i.d7?.chapters ?? []) chapterNumbers.add(c.chapterNumber);
  const perChapterWinners = [...chapterNumbers].sort((a, b) => a - b).map((n) => {
    const composites: Record<string, number | null> = {};
    let best: { model: string; composite: number } | null = null;
    for (const i of inputs) {
      const cr = i.d7?.chapters.find((c) => c.chapterNumber === n);
      composites[i.spec.model] = cr?.chapterDiagnostic ?? null;
      if (cr && (!best || cr.chapterDiagnostic > best.composite)) best = { model: i.spec.model, composite: cr.chapterDiagnostic };
    }
    return { chapterNumber: n, model: best?.model ?? null, composites };
  });

  return {
    schemaVersion: "model-bakeoff-selection-v1",
    selectedAt: new Date().toISOString(),
    winner: winner?.model ?? null,
    runnerUp,
    decidedByTieBreak,
    tieBand: band,
    scorecards,
    reasons,
    perChapterWinners,
  };
}
