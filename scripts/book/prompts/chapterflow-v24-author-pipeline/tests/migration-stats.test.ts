/**
 * IMP-11 — clustered statistics against known distributions: cluster-driven
 * bootstrap width, rule-of-three exactness, precision honesty, frozen
 * stopping-rule vocabulary, paired deltas, and effect estimation.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import type { ChapterStratumV1, MigrationSampleRecordV1 } from "../src/bakeoff/migration/experimentTypes.js";
import {
  assessPrecision,
  blockKeyOf,
  clusterBootstrapCI,
  effectiveSample,
  effectsReport,
  evaluateStopping,
  METRIC_ACCEPTANCE,
  METRIC_FIRST_WRITE_PASS,
  pairedBlockDeltas,
  PRECISION_STATEMENT,
  ruleOfThreeUpperBoundPct,
  valuesByBlock,
} from "../src/bakeoff/migration/stats.js";

function mkRec(over: {
  cellId: string;
  bookId?: string;
  ch: number;
  idx?: number;
  pass?: boolean;
  reviewPass?: boolean | null;
  composite?: number;
}): MigrationSampleRecordV1 {
  const pass = over.pass ?? true;
  const reviewPass = over.reviewPass === undefined ? true : over.reviewPass;
  return {
    schema: "migration-sample-record-v1",
    experimentId: "exp-stats",
    stage: "confirmatory",
    blindSampleId: `${over.cellId}-${over.bookId ?? "book-a"}-${over.ch}-${over.idx ?? 1}`,
    cellId: over.cellId,
    bookId: over.bookId ?? "book-a",
    chapterNumber: over.ch,
    stratum: "example-heavy" as ChapterStratumV1,
    sampleIndex: over.idx ?? 1,
    executionOrder: 0,
    outcome: {
      providerOutcome: "content_completed",
      replayed: false,
      firstWriteDeterministicPass: pass,
      durationMs: 1000,
      writerSessionIds: ["s1"],
    },
    artifact: { contentSha256: pass ? `hash-${over.cellId}-${over.ch}-${over.idx ?? 1}` : null, chapterRelPath: pass ? "x" : null },
    critics: null,
    review: reviewPass === null ? null : {
      composite: over.composite ?? 85,
      ship: reviewPass,
      keysClean: true,
      valid: true,
      pass: reviewPass,
      quizAdjudicationStatus: "adjudicated",
      complaintsMustFix: 0,
      reviewerSessionId: "r1",
      judgeModel: "gpt-5.5",
      judgeEffort: "high",
    },
    tokens: null,
    unavailableFields: ["tokens"],
    recordedAt: "2026-07-10T00:00:00.000Z",
  };
}

test("rule of three: the mandated precision numbers are exact", () => {
  assert.ok(Math.abs(ruleOfThreeUpperBoundPct(36)! - 8.333333333333334) < 1e-9, "0/36 → ~8.3%");
  assert.equal(ruleOfThreeUpperBoundPct(150), 2, "0/150 → 2%");
  assert.equal(ruleOfThreeUpperBoundPct(300), 1, "0/300 → 1%");
  assert.equal(ruleOfThreeUpperBoundPct(0), null);
  assert.ok(PRECISION_STATEMENT.includes("8.3%") && PRECISION_STATEMENT.includes("150") && PRECISION_STATEMENT.includes("300"));
});

test("precision assessment: zero-event supported only at the planned unit count; observed events are never a rare-event bound", () => {
  const endpoint = { id: "sourced-fabrication", targetUpperBoundPct: 1, minIndependentUnits: 300 };
  assert.equal(assessPrecision(endpoint, 0, 300).supported, true);
  const small = assessPrecision(endpoint, 0, 36);
  assert.equal(small.supported, false);
  assert.equal(small.classification, "inconclusive", "a small zero-event sample never supports a 1% claim");
  const withEvents = assessPrecision(endpoint, 2, 300);
  assert.equal(withEvents.classification, "not-rare-event");
  assert.equal(withEvents.supported, false);
});

test("cluster bootstrap: uncertainty is driven by BLOCK count, not raw sample count, and is seed-deterministic", () => {
  // 2 blocks, perfectly homogeneous within: 10 raw samples carry only 2
  // independent observations — the CI must stay wide (cluster-aware).
  const blocks = new Map([
    ["book-a::ch01", [1, 1, 1, 1, 1]],
    ["book-a::ch02", [0, 0, 0, 0, 0]],
  ]);
  const ci = clusterBootstrapCI({ blocks, seed: "s1", iterations: 500 })!;
  assert.equal(ci.point, 0.5);
  assert.equal(ci.clusters.blocks, 2);
  assert.equal(ci.clusters.samples, 10);
  assert.ok(ci.upper - ci.lower >= 0.5, `2-cluster CI stays wide (got ${ci.lower}..${ci.upper})`);
  const again = clusterBootstrapCI({ blocks, seed: "s1", iterations: 500 })!;
  assert.deepEqual({ l: again.lower, u: again.upper }, { l: ci.lower, u: ci.upper }, "same seed → same CI");
  // Many blocks with continuous values → the interval tightens, and distinct
  // seeds resample distinct quantiles.
  const many = new Map<string, number[]>();
  for (let i = 0; i < 40; i++) many.set(`b::ch${i}`, [((i * 1.37) % 7) / 7]);
  const tight = clusterBootstrapCI({ blocks: many, seed: "s1", iterations: 500 })!;
  assert.ok(tight.upper - tight.lower < ci.upper - ci.lower, "40 clusters beat 2 clusters");
  const otherSeed = clusterBootstrapCI({ blocks: many, seed: "s2", iterations: 500 })!;
  assert.ok(otherSeed.lower !== tight.lower || otherSeed.upper !== tight.upper, "a different seed resamples differently");
});

test("paired block deltas pair by (book, chapter) and surface missing blocks instead of dropping them silently", () => {
  const records = [
    mkRec({ cellId: "56S-H", ch: 1, reviewPass: true }),
    mkRec({ cellId: "56S-H", ch: 2, reviewPass: false }),
    mkRec({ cellId: "55-XH", ch: 1, reviewPass: false }),
    // ch2 has no 55-XH sample → missing block, not a fabricated pair.
  ];
  const { deltas, missingBlocks } = pairedBlockDeltas(records, "56S-H", "55-XH", METRIC_ACCEPTANCE);
  assert.equal(deltas.size, 1);
  assert.equal(deltas.get("book-a::ch01"), 1, "accept(1) − accept(0) = +1 on the shared block");
  assert.deepEqual(missingBlocks, ["book-a::ch02"]);
});

test("stopping rules: frozen vocabulary only — expansion fires on a clean SOL screen, futility overrides, unknown ids throw", () => {
  const interim = {
    solCells: [
      { cellId: "56S-H", upheldHighSeverity: 0, acceptancePct: 90, screened: 4 },
      { cellId: "56S-XH", upheldHighSeverity: 2, acceptancePct: 60, screened: 4 },
    ],
    minPooledAcceptancePct: 75,
  };
  const expand = evaluateStopping(["expand-if-any-sol-cell-screens-clean"], interim);
  assert.equal(expand.decision, "expand");
  const futile = evaluateStopping(
    ["expand-if-any-sol-cell-screens-clean", "stop-if-every-sol-cell-fails-screening"],
    { ...interim, solCells: interim.solCells.map((c) => ({ ...c, upheldHighSeverity: 1 })) },
  );
  assert.equal(futile.decision, "stop", "futility beats expansion");
  assert.equal(evaluateStopping(["never-expand"], interim).decision, "stop");
  assert.throws(() => evaluateStopping(["p-hack-my-way-out"], interim), /unknown stopping rule/, "rules are frozen at seal");
});

test("effects report: the model effect on shared blocks recovers the designed delta; absent pairs are not invented", () => {
  const cells = [
    { cellId: "55-XH", model: "gpt-5.5", effort: "xhigh", stackId: "sol" },
    { cellId: "56S-XH", model: "gpt-5.6-sol", effort: "xhigh", stackId: "sol" },
  ];
  const records: MigrationSampleRecordV1[] = [];
  for (const ch of [1, 2, 3, 4]) {
    for (const idx of [1, 2]) {
      records.push(mkRec({ cellId: "55-XH", ch, idx, reviewPass: false })); // baseline accepts 0%
      records.push(mkRec({ cellId: "56S-XH", ch, idx, reviewPass: true })); // sol accepts 100%
    }
  }
  const effects = effectsReport(records, cells, "seed-e");
  const model = effects.find((e) => e.effect === "model" && e.metric === "acceptance");
  assert.ok(model, "model effect estimated");
  assert.equal(model!.point, 1, "sol − baseline acceptance = +1.0");
  assert.equal(model!.blocks, 4);
  assert.ok(!effects.some((e) => e.effect.startsWith("effort")), "no effort pair in this design → no invented effort effect");
});

test("effective sample + valuesByBlock accounting: blocks, books, dropped nulls, and visible missing cells", () => {
  const records = [
    mkRec({ cellId: "56S-H", ch: 1 }),
    mkRec({ cellId: "56S-H", ch: 2, bookId: "book-b" }),
    mkRec({ cellId: "56S-H", ch: 1, idx: 2, pass: false, reviewPass: null }),
  ];
  const { blocks, dropped } = valuesByBlock(records, "56S-H", METRIC_ACCEPTANCE);
  assert.equal(blocks.size, 2);
  assert.equal(dropped, 0, "a deterministic fail is acceptance 0, not a dropped null");
  const { dropped: droppedComposite } = valuesByBlock(records, "56S-H", (r) => r.review?.valid ? r.review.composite : null);
  assert.equal(droppedComposite, 1, "an unreviewed sample has no composite — visibly dropped");
  assert.equal(METRIC_FIRST_WRITE_PASS(records[2]), 0);
  const sample = effectiveSample(records, ["56S-H", "55-XH"], 4);
  assert.equal(sample.blocks, 2);
  assert.equal(sample.books, 2);
  assert.deepEqual(sample.missingCells, [{ cellId: "56S-H", planned: 4, got: 3 }, { cellId: "55-XH", planned: 4, got: 0 }]);
  assert.equal(blockKeyOf(records[1]), "book-b::ch02");
});
