/**
 * WS-1 — self-consistency tiebreak combine (combineBarAxes). For a borderline chapter
 * the orchestrator gathers extra independent bar reads; the CLI folds them by per-axis
 * MEDIAN. These tests pin the two load-bearing properties: (1) the median smooths a
 * single noisy sample (the the-daily-stoic ch3 0.6→0.58 flap) WITHOUT bias, and (2) a
 * cited CORRUPTION on any read is NEVER medianed away (the RED veto survives). With one
 * read the combine is the identity. [[gpt-pipeline-run-daily-stoic-2026-06-16]]
 */

import assert from "node:assert/strict";
import { rmSync } from "fs";

import { test } from "./harness.js";
import { combineBarAxes, computeVerdict, type AxisScore, type AxisId } from "../src/critics/semantic/publishableBar.js";
import { writeBarReadArtifact, loadBarReadArtifact, loadAllBarReads } from "../src/qc/orchestrator/artifacts.js";
import { orchestratorRoundDir } from "../src/qc/orchestrator/artifacts.js";
import type { ValidatedBarReadSubmission } from "../src/qc/orchestrator/schemas.js";

const ALL_AXES: AxisId[] = [
  "quiz_key_correctness", "example_coherence", "prose_coherence", "quiz_distractor_quality",
  "card_learning_value", "plan_actionability", "factual_accuracy", "memorable_line_quality",
];

/** A full 8-axis read at a uniform score, then per-axis overrides. */
function read(base: number, overrides: Partial<Record<AxisId, Partial<AxisScore>>> = {}): AxisScore[] {
  return ALL_AXES.map((axis) => ({
    axis,
    score: overrides[axis]?.score ?? base,
    tier: overrides[axis]?.tier ?? "PUBLISHABLE",
    hits: overrides[axis]?.hits ?? [],
  }));
}

const scoreOf = (axes: AxisScore[], a: AxisId) => axes.find((x) => x.axis === a)!.score;

test("one read → combine is the identity", () => {
  const r = read(0.9, { plan_actionability: { score: 0.72 } });
  const combined = combineBarAxes([r]);
  assert.equal(scoreOf(combined, "plan_actionability"), 0.72);
  assert.equal(scoreOf(combined, "example_coherence"), 0.9);
});

test("median of 3 smooths a single noisy LOW sample (the 84/85 flap)", () => {
  // quiz_distractor_quality read as 0.58 / 0.62 / 0.61 → median 0.61 (≥ 0.6 floor).
  const reads = [
    read(0.9, { quiz_distractor_quality: { score: 0.58 } }),
    read(0.9, { quiz_distractor_quality: { score: 0.62 } }),
    read(0.9, { quiz_distractor_quality: { score: 0.61 } }),
  ];
  const combined = combineBarAxes(reads);
  assert.equal(scoreOf(combined, "quiz_distractor_quality"), 0.61, "median of 3 = middle value");
  // The whole-chapter verdict no longer flaps to YELLOW on the lone 0.58.
  assert.equal(computeVerdict("ch", combined, true).gate, "GREEN");
  // And the lone 0.58 read ALONE would have floored it (proving the tiebreak mattered).
  assert.equal(computeVerdict("ch", reads[0], true).gate, "YELLOW");
});

test("median of 3 keeps a GENUINELY low axis low (no false-PASS)", () => {
  // A real defect: all three reads score the axis low → median stays < 0.6 → YELLOW.
  const reads = [
    read(0.9, { plan_actionability: { score: 0.45 } }),
    read(0.9, { plan_actionability: { score: 0.5 } }),
    read(0.9, { plan_actionability: { score: 0.48 } }),
  ];
  const combined = combineBarAxes(reads);
  assert.equal(scoreOf(combined, "plan_actionability"), 0.48);
  assert.equal(computeVerdict("ch", combined, true).gate, "YELLOW");
});

test("a cited CORRUPTION on ANY read SURVIVES the combine (RED veto never medianed away)", () => {
  const hit = { unitId: "examples.ex01.scenario", quote: "Cleo lifts a folder labeled vulnerability", defect: "concept-label is the subject" };
  const reads = [
    read(0.95),
    read(0.95),
    read(0.95, { example_coherence: { score: 0.2, tier: "CORRUPTION", hits: [hit] } }),
  ];
  const combined = combineBarAxes(reads);
  const ec = combined.find((a) => a.axis === "example_coherence")!;
  assert.equal(ec.tier, "CORRUPTION", "corruption tier preserved even though median score is high");
  assert.deepEqual(ec.hits, [hit], "the cited hit is carried through");
  assert.equal(computeVerdict("ch", combined, true).gate, "RED", "one cited corruption RED-gates the combined verdict");
});

test("variant bar reads are stored alongside the primary (no overwrite) and loadAllBarReads gathers them", () => {
  const BOOK = "zz-fixture-tiebreak";
  const ROUND = "r-tiebreak";
  const NON_KEY: AxisId[] = ["example_coherence", "prose_coherence", "quiz_distractor_quality", "card_learning_value", "plan_actionability", "factual_accuracy", "memorable_line_quality"];
  // Realistic flap shape: every axis strong (0.9) except quiz_distractor_quality, which the
  // three reads score 0.58 / 0.62 / 0.61 (the the-daily-stoic ch3 case). v2 reads carry the
  // 7 non-key axes; the key axis is injected (score 1) for the verdict, as the round does.
  const KEY: AxisScore = { axis: "quiz_key_correctness", score: 1, tier: "PUBLISHABLE", hits: [] };
  const sub = (reviewer: string, qdq: number): ValidatedBarReadSubmission => {
    const axes: AxisScore[] = NON_KEY.map((axis) => ({ axis, score: axis === "quiz_distractor_quality" ? qdq : 0.9, tier: "PUBLISHABLE", hits: [] }));
    return { schemaVersion: "qc-bar-read-v2", bookId: BOOK, roundId: ROUND, role: "bar", reviewer,
      chapterNumber: 1, chapterId: `${BOOK}-ch01`, contentHash: "h", axes,
      verdict: computeVerdict(`${BOOK}-ch01`, [KEY, ...axes], true) };
  };
  try {
    rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
    writeBarReadArtifact(sub("codex-qc:r:bar:ch01", 0.58));         // primary
    writeBarReadArtifact(sub("codex-qc:r:bar:ch01:t2", 0.62), "t2"); // tiebreak 2 — must NOT overwrite the primary
    writeBarReadArtifact(sub("codex-qc:r:bar:ch01:t3", 0.61), "t3"); // tiebreak 3
    // The primary is intact and the variants load separately.
    assert.equal(loadBarReadArtifact(BOOK, ROUND, 1)?.reviewer, "codex-qc:r:bar:ch01");
    assert.equal(loadBarReadArtifact(BOOK, ROUND, 1, "t2")?.reviewer, "codex-qc:r:bar:ch01:t2");
    const all = loadAllBarReads(BOOK, ROUND, 1);
    assert.equal(all.length, 3, "primary + t2 + t3");
    // End to end: median of {0.58, 0.62, 0.61} → 0.61 lifts the chapter over the 0.6 floor.
    const combined = combineBarAxes(all.map((r) => r.axes));
    assert.equal(combined.find((a) => a.axis === "quiz_distractor_quality")!.score, 0.61);
    assert.equal(computeVerdict("ch", [KEY, ...combined], true).gate, "GREEN", "median clears the floor → GREEN");
    // The primary read ALONE (0.58 < 0.6) would have floored it to YELLOW.
    assert.equal(computeVerdict("ch", [KEY, ...all[0].axes], true).gate, "YELLOW");
  } finally {
    rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  }
});

test("hits are unioned and de-duplicated across reads", () => {
  const h1 = { unitId: "u1", quote: "q1", defect: "d1" };
  const h2 = { unitId: "u2", quote: "q2", defect: "d2" };
  const reads = [
    read(0.5, { prose_coherence: { score: 0.5, hits: [h1] } }),
    read(0.5, { prose_coherence: { score: 0.5, hits: [h1, h2] } }),
  ];
  const combined = combineBarAxes(reads);
  const pc = combined.find((a) => a.axis === "prose_coherence")!;
  assert.equal(pc.hits.length, 2, "h1 appears once despite being in both reads");
});
