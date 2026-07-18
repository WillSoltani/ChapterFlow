/**
 * Model bake-off — selection hierarchy: hard-failure disqualification, global
 * winner, quality-first tie-breaking, cost/latency only inside the tie band.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { selectWinner, type SelectionInputs } from "../src/bakeoff/selection.js";
import type { CandidateReviewV1, CandidateSpec, CandidateStateV1, CandidateValidationV1 } from "../src/bakeoff/types.js";

function spec(model: string, slot: string): CandidateSpec {
  return { model, slug: model.replace(/[^a-z0-9]+/gi, "-"), slot, effort: "xhigh" };
}

function generation(over?: Partial<CandidateStateV1>): CandidateStateV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-v1",
    spec: spec("m", "w"),
    status: "complete",
    chapters: [],
    totalDurationMs: 60_000,
    totalRetries: 0,
    firstAttemptPasses: 9,
    ...over,
  };
}

function validation(over?: Partial<CandidateValidationV1>): CandidateValidationV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-validation-v1",
    model: "m",
    validatedAt: "t",
    complete: true,
    hardFailures: [],
    advisories: [],
    bookGatePassed: true,
    rubricVerdict: "pass",
    readerBudgetBlockers: 0,
    shipGateBlockers: 0,
    ...over,
  };
}

function review(label: string, composite: number, over?: Partial<CandidateReviewV1>): CandidateReviewV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-review-v1",
    label: label as CandidateReviewV1["label"],
    contentSha256: "x",
    chapterReviews: [
      { chapterNumber: 1, composite, ship: true, keysClean: true, valid: true, pass: true, reviewerSessionId: "r1" },
      { chapterNumber: 2, composite: composite - 1, ship: true, keysClean: true, valid: true, pass: true, reviewerSessionId: "r2" },
    ],
    bookReads: [],
    bookComposite: composite,
    bookGate: "PASS",
    bookChurn: "LOW",
    meanChapterComposite: composite,
    minChapterComposite: composite - 1,
    chapterPassRate: 1,
    sampledChapterNumbers: [1, 2],
    reviewedAt: "t",
    ...over,
  };
}

function input(model: string, slot: string, label: string, composite: number, over?: {
  generation?: Partial<CandidateStateV1> | null;
  validation?: Partial<CandidateValidationV1> | null;
  review?: Partial<CandidateReviewV1> | null;
}): SelectionInputs[number] {
  return {
    spec: spec(model, slot),
    label,
    generation: over?.generation === null ? null : generation({ spec: spec(model, slot), ...(over?.generation ?? {}) }),
    validation: over?.validation === null ? null : validation({ model, ...(over?.validation ?? {}) }),
    review: over?.review === null ? null : review(label, composite, over?.review ?? {}),
  };
}

// ── 9. hard-failure disqualification ──────────────────────────────────────────

test("a candidate with deterministic hard failures can never win, regardless of review score", () => {
  const sel = selectWinner([
    input("gpt-5.6-sol", "w1", "A", 95, { validation: { hardFailures: ["book-gate: [AS5] templated quiz"] } }),
    input("gpt-5.6-terra", "w2", "B", 70),
  ]);
  assert.equal(sel.winner, "gpt-5.6-terra");
  const solCard = sel.scorecards.find((s) => s.model === "gpt-5.6-sol")!;
  assert.equal(solCard.eligible, false);
  assert.ok(solCard.disqualifications.some((d) => d.includes("AS5")));
});

test("incomplete book, unsound quiz keys (blinded derivation), and blinded gate FAIL each disqualify", () => {
  const sel = selectWinner([
    input("a-model", "w1", "A", 90, { generation: { status: "failed" } }),
    input("b-model", "w2", "B", 90, { review: { chapterReviews: [{ chapterNumber: 1, composite: 90, ship: true, keysClean: false, valid: true, pass: false, reviewerSessionId: "r" }] } }),
    input("c-model", "w3", "C", 90, { review: { bookGate: "FAIL" } }),
  ]);
  assert.equal(sel.winner, null, "no eligible candidate → no winner, nothing publishable");
  const [a, b, c] = ["a-model", "b-model", "c-model"].map((m) => sel.scorecards.find((s) => s.model === m)!);
  assert.ok(a.disqualifications.some((d) => /incomplete/.test(d)));
  assert.ok(b.disqualifications.some((d) => /unsound quiz keys/.test(d)));
  assert.ok(c.disqualifications.some((d) => /gate FAIL/.test(d)));
});

// ── 10. global winner ─────────────────────────────────────────────────────────

test("outside the noise band the higher blinded composite wins — cost and latency never enter", () => {
  const sel = selectWinner([
    input("gpt-5.6-sol", "w1", "A", 84, { generation: { totalRetries: 6, totalDurationMs: 400 * 60_000 } }),
    input("gpt-5.6-terra", "w2", "B", 78, { generation: { totalRetries: 0, totalDurationMs: 30 * 60_000 } }),
    input("gpt-5.6-luna", "w3", "C", 74, { generation: { totalRetries: 0, totalDurationMs: 20 * 60_000 } }),
  ]);
  assert.equal(sel.winner, "gpt-5.6-sol", "quality wins despite worst retries/latency");
  assert.equal(sel.decidedByTieBreak, false);
  assert.equal(sel.runnerUp, "gpt-5.6-terra");
  assert.ok(sel.reasons.some((r) => /quality gap, so cost\/latency never enters/.test(r)));
});

// ── 11 + 12. tie band: quality-first, cost only inside the band ───────────────

test("inside the noise band the tie is declared and the cheaper/lower-latency candidate wins", () => {
  const sel = selectWinner([
    input("gpt-5.6-sol", "w1", "A", 80.5, { generation: { totalRetries: 4, totalDurationMs: 300 * 60_000 } }),
    input("gpt-5.6-terra", "w2", "B", 79.9, { generation: { totalRetries: 1, totalDurationMs: 90 * 60_000 } }),
  ]);
  assert.equal(sel.decidedByTieBreak, true, "tie declared inside the band");
  assert.equal(sel.winner, "gpt-5.6-terra", "operational tiebreak picks fewer retries / lower latency");
  assert.ok(sel.reasons.some((r) => /effectively TIED/.test(r)));
});

test("a sub-band composite edge does NOT beat the tiebreak (cost cannot offset a REAL gap, but noise is noise)", () => {
  // 2.0 apart (< 3.7 band): tied → retries decide even though A scored higher.
  const sel = selectWinner([
    input("x-model", "w1", "A", 81, { generation: { totalRetries: 3, totalDurationMs: 100 * 60_000 } }),
    input("y-model", "w2", "B", 79, { generation: { totalRetries: 0, totalDurationMs: 100 * 60_000 } }),
  ]);
  assert.equal(sel.winner, "y-model");
  assert.equal(sel.decidedByTieBreak, true);
});

test("within the band a two-step churn gap (LOW vs HIGH) is a real quality signal, not a tie", () => {
  const sel = selectWinner([
    input("x-model", "w1", "A", 80, { review: { bookChurn: "HIGH" }, generation: { totalRetries: 0 } }),
    input("y-model", "w2", "B", 79, { review: { bookChurn: "LOW" }, generation: { totalRetries: 5 } }),
  ]);
  assert.equal(sel.winner, "y-model", "coherence gap decides inside the band");
  assert.equal(sel.decidedByTieBreak, false);
});

test("per-chapter winners are recorded for analysis while the global winner stays single-model", () => {
  const sel = selectWinner([
    input("x-model", "w1", "A", 84),
    input("y-model", "w2", "B", 76),
  ]);
  assert.equal(sel.winner, "x-model");
  assert.equal(sel.perChapterWinners.length, 2);
  for (const row of sel.perChapterWinners) {
    assert.ok(row.composites["x-model"] !== undefined && row.composites["y-model"] !== undefined);
    assert.equal(row.model, "x-model");
  }
});
