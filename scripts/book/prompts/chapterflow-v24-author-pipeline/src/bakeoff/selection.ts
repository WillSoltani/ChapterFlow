/**
 * Model bake-off — quality-first global selection. PURE — no IO, no spawns —
 * so every decision branch is unit-testable and the report can replay it.
 *
 * Decision hierarchy (fixed order; each step either decides or narrows):
 *   1. Hard eligibility — incomplete book / deterministic hard failures /
 *      review-invalidated correctness (a failed key derivation is a wrong key).
 *   2. Publishability — blinded book gate PASS beats FAIL.
 *   3. Instruction adherence — fewer deterministic retries burned per chapter
 *      is only a TIEBREAK; the binding adherence signal (gate blockers) already
 *      disqualified in step 1.
 *   4. Reader value — the blinded book composite (median), the primary score.
 *   5. Whole-book coherence — churn LOW < MEDIUM < HIGH as a within-band tilt.
 *   6. Reliability — mean/min chapter composite + chapter pass rate.
 *   7. Cost/latency/retries — ONLY inside the noise band (a tie), never to
 *      offset a real quality gap.
 *
 * "Within the noise band" means the two candidates' book composites differ by
 * at most BAKEOFF_NOISE_BAND (the acceptance panel's own noise width). Inside
 * it, quality is declared effectively tied and the operational tiebreak picks:
 * fewer retries, then lower wall-clock latency, then stable model-id order.
 */

import type {
  CandidateReviewV1,
  CandidateScorecardV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
  SelectionV1,
} from "./types.js";
import { BAKEOFF_NOISE_BAND } from "./review.js";

export type SelectionInputs = Array<{
  spec: CandidateSpec;
  label: string;
  generation: CandidateStateV1 | null;
  validation: CandidateValidationV1 | null;
  review: CandidateReviewV1 | null;
}>;

const CHURN_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, "?": 3 };

export function buildScorecard(input: SelectionInputs[number]): CandidateScorecardV1 {
  const disqualifications: string[] = [];
  const { generation, validation, review } = input;

  if (!generation || generation.status !== "complete") {
    disqualifications.push(`incomplete book (generation status: ${generation?.status ?? "missing"})`);
  }
  if (!validation) {
    disqualifications.push("deterministic validation never ran");
  } else {
    if (!validation.complete) disqualifications.push("incomplete book (validation)");
    for (const f of validation.hardFailures) disqualifications.push(f);
  }
  if (!review) {
    if (disqualifications.length === 0) disqualifications.push("blinded review never ran");
  } else {
    if (review.bookGate === "FAIL") disqualifications.push("blinded book gate FAIL (correctness veto by the fixed judge panel)");
    const badKeys = review.chapterReviews.filter((c) => c.valid && !c.keysClean);
    if (badKeys.length > 0) {
      disqualifications.push(`unsound quiz keys: blinded readers could not derive the stored key in ch ${badKeys.map((c) => c.chapterNumber).join(", ")}`);
    }
    if (review.bookComposite === null) disqualifications.push("no valid whole-book read (all panel reads invalid)");
  }

  return {
    model: input.spec.model,
    label: input.label as CandidateScorecardV1["label"],
    eligible: disqualifications.length === 0,
    disqualifications,
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

/** Compare OUTSIDE the tie band: returns the better candidate or null when the
 *  pair is quality-tied (inside the band on the primary score). */
function qualityCompare(a: CandidateScorecardV1, b: CandidateScorecardV1, band: number, reasons: string[]): CandidateScorecardV1 | null {
  const compA = a.bookComposite ?? -Infinity;
  const compB = b.bookComposite ?? -Infinity;
  if (Math.abs(compA - compB) > band) {
    const better = compA > compB ? a : b;
    reasons.push(`${better.model} beats ${(better === a ? b : a).model} on the blinded book composite (${compA} vs ${compB}, band ±${band}) — a real quality gap, so cost/latency never enters.`);
    return better;
  }
  // Inside the band: coherence (churn), then reliability, may still be a REAL
  // quality signal — but only a FULL-STEP churn difference decides; otherwise tie.
  const churnGap = (CHURN_RANK[b.churn] ?? 3) - (CHURN_RANK[a.churn] ?? 3);
  if (Math.abs(churnGap) >= 2) {
    const better = churnGap > 0 ? a : b;
    reasons.push(`${better.model} preferred within the band: whole-book churn ${better.churn} vs ${(better === a ? b : a).churn} (two-step coherence gap).`);
    return better;
  }
  const relA = a.minChapterComposite ?? -Infinity;
  const relB = b.minChapterComposite ?? -Infinity;
  if (Math.abs(relA - relB) > band) {
    const better = relA > relB ? a : b;
    reasons.push(`${better.model} preferred within the band: weakest-chapter composite ${relA} vs ${relB} (reliability gap wider than the band).`);
    return better;
  }
  return null;
}

/** The operational tiebreak — ONLY reached inside the quality tie band. */
function operationalTiebreak(tied: CandidateScorecardV1[], reasons: string[]): CandidateScorecardV1 {
  const ranked = [...tied].sort((a, b) =>
    (a.totalRetries - b.totalRetries) ||
    (a.totalDurationMs - b.totalDurationMs) ||
    a.model.localeCompare(b.model));
  const w = ranked[0];
  reasons.push(
    `Quality effectively TIED among ${tied.map((t) => `${t.model} (${t.bookComposite ?? "n/a"})`).join(", ")} — ` +
    `selected ${w.model} on the operational tiebreak: retries ${ranked.map((t) => `${t.model}=${t.totalRetries}`).join(", ")}; ` +
    `latency ${ranked.map((t) => `${t.model}=${Math.round(t.totalDurationMs / 60000)}min`).join(", ")}.`,
  );
  return w;
}

export function selectWinner(inputs: SelectionInputs, band = BAKEOFF_NOISE_BAND): SelectionV1 {
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
    // Publishability first: gate PASS beats everything else eligible.
    const gatePass = eligible.filter((s) => s.bookGate === "PASS");
    const pool = gatePass.length > 0 ? gatePass : eligible;
    if (gatePass.length > 0 && gatePass.length < eligible.length) {
      reasons.push(`Publishability: ${gatePass.map((s) => s.model).join(", ")} hold a blinded gate PASS; the rest are out of the running.`);
    }
    // Two-pass quality reduction: find the leader by iterative pairwise
    // comparison (leader may flip on a within-band churn/reliability gap),
    // then collect everyone quality-tied WITH that leader; the operational
    // tiebreak runs only over that tied set.
    const survivors = [...pool].sort((a, b) => (b.bookComposite ?? -Infinity) - (a.bookComposite ?? -Infinity));
    let leader = survivors[0];
    for (const other of survivors.slice(1)) {
      const better = qualityCompare(leader, other, band, reasons);
      if (better === other) leader = other;
    }
    const silent: string[] = [];
    const tied = survivors.filter((s) => s === leader || qualityCompare(leader, s, band, silent) === null);
    if (tied.length === 1) {
      winner = tied[0];
      if (!reasons.some((r) => r.startsWith(winner!.model))) {
        reasons.push(`${winner.model} wins on the blinded quality hierarchy.`);
      }
    } else {
      winner = operationalTiebreak(tied, reasons);
      decidedByTieBreak = true;
    }
  } else {
    reasons.push("NO candidate is eligible — nothing may be promoted or published from this run.");
  }

  const ranked = eligible
    .filter((s) => s !== winner)
    .sort((a, b) => (b.bookComposite ?? -Infinity) - (a.bookComposite ?? -Infinity));
  const runnerUp = ranked[0]?.model ?? null;

  // Per-chapter tendencies (analysis only — the promoted book is single-model).
  const chapterNumbers = new Set<number>();
  for (const i of inputs) for (const c of i.review?.chapterReviews ?? []) chapterNumbers.add(c.chapterNumber);
  const perChapterWinners = [...chapterNumbers].sort((a, b) => a - b).map((n) => {
    const composites: Record<string, number | null> = {};
    let best: { model: string; composite: number } | null = null;
    for (const i of inputs) {
      const cr = i.review?.chapterReviews.find((c) => c.chapterNumber === n && c.valid);
      composites[i.spec.model] = cr?.composite ?? null;
      if (cr && (!best || cr.composite > best.composite)) best = { model: i.spec.model, composite: cr.composite };
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
