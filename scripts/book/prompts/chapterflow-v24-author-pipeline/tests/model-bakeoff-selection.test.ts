/**
 * Model bake-off — selection hierarchy (WP-702).
 *
 * PRIMARY metric = the Claude-side D7 chapter-diagnostic composite. Proves:
 *   - ranking is on d7Composite (never the codex advisory bookComposite);
 *   - the deterministic floor is a HARD VETO regardless of a stellar D7 score;
 *   - a D7-gate failure (layer-independence / core-domain floor / required gates /
 *     calibration) DISQUALIFIES;
 *   - a NULL d7Composite DISQUALIFIES — it never falls back to the codex composite;
 *   - a ±2.0-band tie defers to the tie-break ladder.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { selectWinner, type SelectionInputs } from "../src/bakeoff/selection.js";
import { D7_SELECTION_BAND } from "../src/bakeoff/d7Judge.js";
import type {
  CandidateD7JudgmentV1,
  CandidateReviewV1,
  CandidateSpec,
  CandidateStateV1,
  CandidateValidationV1,
} from "../src/bakeoff/types.js";

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

/** ADVISORY codex read (non-blocking) — present to prove it never drives selection. */
function review(label: string, composite: number, over?: Partial<CandidateReviewV1>): CandidateReviewV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-review-v1",
    label: label as CandidateReviewV1["label"],
    contentSha256: "x",
    chapterReviews: [{ chapterNumber: 1, composite, ship: true, keysClean: true, valid: true, pass: true, reviewerSessionId: "r1" }],
    bookReads: [],
    bookComposite: composite,
    bookGate: "PASS",
    bookChurn: "LOW",
    meanChapterComposite: composite,
    minChapterComposite: composite,
    chapterPassRate: 1,
    sampledChapterNumbers: [1],
    reviewedAt: "t",
    ...over,
  };
}

/** PRIMARY D7 judgment. */
function d7(label: string, composite: number | null, over?: Partial<CandidateD7JudgmentV1>): CandidateD7JudgmentV1 {
  return {
    schemaVersion: "model-bakeoff-candidate-d7-v1",
    label: label as CandidateD7JudgmentV1["label"],
    contentSha256: "x",
    auditId: `bakeoff-t-${label.toLowerCase()}`,
    d7Composite: composite,
    d7CoreDomainMins: [3.4],
    d7GatesPass: true,
    d7LayerIndependencePass: true,
    allCoreDomainsPass: true,
    min: composite,
    meanPass: composite !== null && composite >= 85,
    minPass: composite !== null && composite >= 80,
    calibrationPass: true,
    verdict: composite === null ? null : "PASS",
    chapters: [{ unit: `book-ch01`, chapterNumber: 1, chapterDiagnostic: composite ?? 0, coreDomainMin: 3.4, coreDomainsPass: true, gatesPass: true, layerIndependencePass: true, pass: composite !== null && composite >= 80 }],
    judgedAt: "t",
    ...over,
  };
}

function input(model: string, slot: string, label: string, d7Composite: number | null, over?: {
  generation?: Partial<CandidateStateV1> | null;
  validation?: Partial<CandidateValidationV1> | null;
  review?: Partial<CandidateReviewV1> | null;
  d7?: Partial<CandidateD7JudgmentV1> | null;
  /** ADVISORY codex composite — deliberately CONTRARY to d7 in some tests. */
  advisoryComposite?: number;
}): SelectionInputs[number] {
  return {
    spec: spec(model, slot),
    label,
    generation: over?.generation === null ? null : generation({ spec: spec(model, slot), ...(over?.generation ?? {}) }),
    validation: over?.validation === null ? null : validation({ model, ...(over?.validation ?? {}) }),
    review: over?.review === null ? null : review(label, over?.advisoryComposite ?? d7Composite ?? 0, over?.review ?? {}),
    d7: over?.d7 === null ? null : d7(label, d7Composite, over?.d7 ?? {}),
  };
}

// ── Primary ranking is d7Composite (never the codex advisory) ─────────────────

test("selection ranks on the D7 composite — the codex advisory composite never decides", () => {
  // sol has the LOWER advisory book composite but the HIGHER D7 composite → sol wins.
  const sel = selectWinner([
    input("gpt-5.6-sol", "w1", "A", 92, { advisoryComposite: 60 }),
    input("gpt-5.6-terra", "w2", "B", 82, { advisoryComposite: 99 }),
  ]);
  assert.equal(sel.winner, "gpt-5.6-sol", "the higher D7 composite wins even though its advisory codex read is far lower");
  assert.equal(sel.decidedByTieBreak, false);
  assert.ok(sel.reasons.some((r) => /D7 chapter-diagnostic composite/.test(r)));
  const solCard = sel.scorecards.find((s) => s.model === "gpt-5.6-sol")!;
  assert.equal(solCard.d7Composite, 92);
});

// ── The deterministic floor is a HARD VETO regardless of D7 ───────────────────

test("a deterministic floor failure vetoes a candidate with a stellar D7 score", () => {
  const sel = selectWinner([
    input("gpt-5.6-sol", "w1", "A", 98, { validation: { hardFailures: ["book-gate: [AS5] templated quiz"] } }),
    input("gpt-5.6-terra", "w2", "B", 86),
  ]);
  assert.equal(sel.winner, "gpt-5.6-terra", "the floor veto beats a higher D7 score");
  const solCard = sel.scorecards.find((s) => s.model === "gpt-5.6-sol")!;
  assert.equal(solCard.eligible, false);
  assert.ok(solCard.disqualifications.some((d) => d.includes("AS5")));
});

test("an incomplete book is INELIGIBLE regardless of D7", () => {
  const sel = selectWinner([
    input("a-model", "w1", "A", 95, { generation: { status: "failed" } }),
    input("b-model", "w2", "B", 88),
  ]);
  assert.equal(sel.winner, "b-model");
  const a = sel.scorecards.find((s) => s.model === "a-model")!;
  assert.ok(a.disqualifications.some((d) => /incomplete/.test(d)));
});

// ── D7-gate failures disqualify ───────────────────────────────────────────────

test("D7-gate failures (layer-independence, core-domain floor, required gates, calibration) each DISQUALIFY", () => {
  const sel = selectWinner([
    input("layer", "w1", "A", 96, { d7: { d7LayerIndependencePass: false } }),
    input("core", "w2", "B", 95, { d7: { allCoreDomainsPass: false } }),
    input("gates", "w3", "C", 94, { d7: { d7GatesPass: false } }),
    input("calib", "w4", "D", 93, { d7: { calibrationPass: false } }),
    input("clean", "w5", "E", 86),
  ]);
  assert.equal(sel.winner, "clean", "only the candidate that clears every D7 gate is eligible");
  const [layer, core, gates, calib] = ["layer", "core", "gates", "calib"].map((m) => sel.scorecards.find((s) => s.model === m)!);
  assert.ok(layer.disqualifications.some((d) => /layer-independence/.test(d)));
  assert.ok(core.disqualifications.some((d) => /core-domain floor/.test(d)));
  assert.ok(gates.disqualifications.some((d) => /required base gate/.test(d)));
  assert.ok(calib.disqualifications.some((d) => /calibration/i.test(d)));
});

// ── A NULL d7Composite DISQUALIFIES — no codex fallback ───────────────────────

test("a NULL D7 composite DISQUALIFIES and never silently falls back to the codex advisory composite", () => {
  // The candidate has a floor pass AND a great advisory codex composite (99), but a
  // null D7 composite (audit could not assemble/drive) → INELIGIBLE.
  const sel = selectWinner([
    input("nulld7", "w1", "A", null, { advisoryComposite: 99, d7: { d7Composite: null, ineligibleReason: "audit package assembly refused: missing explanation", verdict: null } }),
    input("real", "w2", "B", 86, { advisoryComposite: 70 }),
  ]);
  assert.equal(sel.winner, "real", "a null D7 candidate cannot win on its codex composite");
  const nullCard = sel.scorecards.find((s) => s.model === "nulld7")!;
  assert.equal(nullCard.eligible, false);
  assert.equal(nullCard.d7Composite, null);
  assert.ok(nullCard.disqualifications.some((d) => /no D7 composite/.test(d)));
  assert.ok(nullCard.disqualifications.some((d) => /missing explanation/.test(d)));
});

test("a MISSING D7 judgment (null input) DISQUALIFIES — never a codex fallback", () => {
  const sel = selectWinner([
    input("nod7", "w1", "A", 90, { d7: null, advisoryComposite: 99 }),
    input("real", "w2", "B", 86),
  ]);
  assert.equal(sel.winner, "real");
  const card = sel.scorecards.find((s) => s.model === "nod7")!;
  assert.equal(card.eligible, false);
  assert.ok(card.disqualifications.some((d) => /no D7 composite/.test(d)));
});

test("if EVERY candidate has a null D7 composite, there is NO winner (nothing promotable)", () => {
  const sel = selectWinner([
    input("a", "w1", "A", null, { d7: { d7Composite: null, verdict: null } }),
    input("b", "w2", "B", null, { d7: { d7Composite: null, verdict: null } }),
  ]);
  assert.equal(sel.winner, null);
  assert.ok(sel.reasons.some((r) => /NO candidate is eligible/.test(r)));
});

// ── Outside vs inside the ±2.0 D7 band ────────────────────────────────────────

test("outside the ±2.0 D7 band the higher composite wins outright (no tie-break)", () => {
  const sel = selectWinner([
    input("gpt-5.6-sol", "w1", "A", 90, { generation: { totalRetries: 6, totalDurationMs: 400 * 60_000 } }),
    input("gpt-5.6-terra", "w2", "B", 86, { generation: { totalRetries: 0, totalDurationMs: 30 * 60_000 } }),
  ]);
  assert.equal(sel.winner, "gpt-5.6-sol", "a >2.0 D7 gap decides — retries/latency never enter");
  assert.equal(sel.decidedByTieBreak, false);
  assert.equal(sel.tieBand, D7_SELECTION_BAND);
});

test("inside the ±2.0 D7 band the pair is a TIE deferred to the tie-break ladder", () => {
  // 1.5 apart (< 2.0 band) → tie; worst-chapter D7 min then retries decide.
  const sel = selectWinner([
    input("gpt-5.6-sol", "w1", "A", 87.0, { generation: { totalRetries: 4 }, d7: { min: 85.0 } }),
    input("gpt-5.6-terra", "w2", "B", 85.5, { generation: { totalRetries: 1 }, d7: { min: 86.0 } }),
  ]);
  assert.equal(sel.decidedByTieBreak, true, "tie declared inside the ±2.0 band");
  assert.equal(sel.winner, "gpt-5.6-terra", "tie-break picks the higher worst-chapter D7 min");
  assert.ok(sel.reasons.some((r) => /effectively TIED/.test(r)));
});

test("a 3.0-apart D7 gap is OUTSIDE the 2.0 band — the higher composite wins, not a tie", () => {
  const sel = selectWinner([
    input("x", "w1", "A", 89, { generation: { totalRetries: 5 } }),
    input("y", "w2", "B", 86, { generation: { totalRetries: 0 } }),
  ]);
  assert.equal(sel.winner, "x", "3.0 > 2.0 band → real gap, retries never enter");
  assert.equal(sel.decidedByTieBreak, false);
});

// ── Per-chapter D7 tendencies (analysis only) ─────────────────────────────────

test("per-chapter D7 tendencies are recorded from the D7 judgment while the global winner stays single-model", () => {
  const sel = selectWinner([
    input("x-model", "w1", "A", 90),
    input("y-model", "w2", "B", 84),
  ]);
  assert.equal(sel.winner, "x-model");
  assert.equal(sel.perChapterWinners.length, 1);
  const row = sel.perChapterWinners[0];
  assert.ok(row.composites["x-model"] !== undefined && row.composites["y-model"] !== undefined);
  assert.equal(row.model, "x-model");
});
