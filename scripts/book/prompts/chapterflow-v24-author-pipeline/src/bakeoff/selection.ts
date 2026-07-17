/**
 * Model bake-off — quality-first global selection (WP-702). PURE — no IO, no
 * spawns — so every decision branch is unit-testable and the report can replay it.
 *
 * PRIMARY metric = the Claude-side D7 rubric-audit chapter-diagnostic composite
 * (CandidateD7JudgmentV1.d7Composite), NEVER a codex model read. The codex
 * whole-book panel (CandidateReviewV1) is a NON-BLOCKING ADVISORY signal only —
 * it is recorded but never changes eligibility or ranking.
 *
 * Decision hierarchy (fixed order; each step either decides or narrows):
 *   1. Deterministic floor (HARD VETO) — an incomplete book or ANY deterministic
 *      hard failure (book-gate FAIL, ship-gate blocker, unsound quiz key,
 *      reader-budget breach, rubric-metrics FAIL) makes a candidate INELIGIBLE
 *      regardless of its D7 score.
 *   2. D7 eligibility — a null D7 composite (audit package could not fail-closed-
 *      assemble, or the audit could not be driven) DISQUALIFIES (never a codex
 *      fallback); a D7-gate failure (required base gates, core-domain floor, or
 *      layer independence) DISQUALIFIES.
 *   3. D7 ranking — the higher D7 composite wins OUTSIDE the pinned ±2.0 selection
 *      band. Inside the band the pair is a TIE deferred to the WP-705 tie-break
 *      ladder (interim stand-in below: worst-chapter D7 min, then retries, then
 *      latency, then stable model-id order).
 *
 * The ±2.0 D7 selection band is DISTINCT from the codex advisory panel's ±3.7
 * noise band and from the D7 instrument's ±3.0 calibration tolerance.
 */

import type {
  CandidateD7JudgmentV1,
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
  /** PRIMARY: the Claude-side D7 rubric-audit judgment. */
  d7: CandidateD7JudgmentV1 | null;
}>;

export function buildScorecard(input: SelectionInputs[number]): CandidateScorecardV1 {
  const disqualifications: string[] = [];
  const { generation, validation, review, d7 } = input;

  // ── 1. Deterministic floor — HARD VETO (independent of D7). ──────────────────
  if (!generation || generation.status !== "complete") {
    disqualifications.push(`incomplete book (generation status: ${generation?.status ?? "missing"})`);
  }
  if (!validation) {
    disqualifications.push("deterministic validation never ran");
  } else {
    if (!validation.complete) disqualifications.push("incomplete book (validation)");
    for (const f of validation.hardFailures) disqualifications.push(f);
  }

  // ── 2. D7 eligibility — the PRIMARY judge. A null composite DISQUALIFIES; it
  //       never silently falls back to the codex advisory composite. ───────────
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

  return {
    model: input.spec.model,
    label: input.label as CandidateScorecardV1["label"],
    eligible: disqualifications.length === 0,
    disqualifications,
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

/** Compare OUTSIDE the D7 selection band: returns the better candidate or null
 *  when the pair is quality-tied (inside the band on the D7 composite). */
function d7Compare(a: CandidateScorecardV1, b: CandidateScorecardV1, band: number, reasons: string[]): CandidateScorecardV1 | null {
  const compA = a.d7Composite ?? -Infinity;
  const compB = b.d7Composite ?? -Infinity;
  if (Math.abs(compA - compB) > band) {
    const better = compA > compB ? a : b;
    reasons.push(`${better.model} beats ${(better === a ? b : a).model} on the D7 chapter-diagnostic composite (${compA.toFixed(2)} vs ${compB.toFixed(2)}, band ±${band}) — a real quality gap on the primary judge.`);
    return better;
  }
  return null;
}

/** The tie-break — ONLY reached inside the ±2.0 D7 band. INTERIM stand-in for the
 *  WP-705 ladder: worst-chapter D7 min, then retries, then latency, then stable
 *  model order. */
function tieBreak(tied: CandidateScorecardV1[], reasons: string[]): CandidateScorecardV1 {
  const ranked = [...tied].sort((a, b) =>
    ((b.d7Min ?? -Infinity) - (a.d7Min ?? -Infinity)) ||
    (a.totalRetries - b.totalRetries) ||
    (a.totalDurationMs - b.totalDurationMs) ||
    a.model.localeCompare(b.model));
  const w = ranked[0];
  reasons.push(
    `D7 composites effectively TIED (±${D7_SELECTION_BAND}) among ${tied.map((t) => `${t.model} (${t.d7Composite?.toFixed(2) ?? "n/a"})`).join(", ")} — ` +
    "deferred to the tie-break ladder (worst-chapter D7 min, then retries, then latency; WP-705 owns the full ladder): " +
    `selected ${w.model} (worst-chapter D7 min ${ranked.map((t) => `${t.model}=${t.d7Min?.toFixed(2) ?? "n/a"}`).join(", ")}; ` +
    `retries ${ranked.map((t) => `${t.model}=${t.totalRetries}`).join(", ")}).`,
  );
  return w;
}

export function selectWinner(inputs: SelectionInputs, band = D7_SELECTION_BAND): SelectionV1 {
  const reasons: string[] = [];
  const scorecards = inputs.map(buildScorecard);

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
    // Two-pass D7 reduction: find the leader by iterative pairwise comparison on
    // the D7 composite, then collect everyone tied WITH that leader inside the
    // ±2.0 band; the tie-break runs only over that tied set.
    const survivors = [...eligible].sort((a, b) => (b.d7Composite ?? -Infinity) - (a.d7Composite ?? -Infinity));
    let leader = survivors[0];
    for (const other of survivors.slice(1)) {
      const better = d7Compare(leader, other, band, reasons);
      if (better === other) leader = other;
    }
    const silent: string[] = [];
    const tied = survivors.filter((s) => s === leader || d7Compare(leader, s, band, silent) === null);
    if (tied.length === 1) {
      winner = tied[0];
      if (!reasons.some((r) => r.startsWith(winner!.model))) {
        reasons.push(`${winner.model} wins on the D7 chapter-diagnostic composite (${winner.d7Composite?.toFixed(2) ?? "n/a"}).`);
      }
    } else {
      winner = tieBreak(tied, reasons);
      decidedByTieBreak = true;
    }
  } else {
    reasons.push("NO candidate is eligible — nothing may be promoted or published from this run.");
  }

  const ranked = eligible
    .filter((s) => s !== winner)
    .sort((a, b) => (b.d7Composite ?? -Infinity) - (a.d7Composite ?? -Infinity));
  const runnerUp = ranked[0]?.model ?? null;

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
