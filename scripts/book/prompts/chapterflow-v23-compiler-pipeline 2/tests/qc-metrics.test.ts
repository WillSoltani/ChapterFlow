/**
 * Quality telemetry — the pure derivation + aggregation behind `qc-metrics`, plus the
 * idempotent best-effort append. Guards: a finalization metric counts verdicts and only
 * counts a deterministic block on NON-publishable chapters; the aggregator computes
 * first-pass rate / rounds-to-pass / top axis / top blocker over the last N books; and a
 * byte-identical re-run of the same round does NOT double-count.
 */

import assert from "node:assert/strict";
import { rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { test } from "./harness.js";
import {
  buildQcFinalizationMetric,
  aggregateQcMetrics,
  appendQcFinalizationMetric,
  loadQcFinalizationMetrics,
  type QcFinalizationMetric,
} from "../src/qc/metrics.js";

const PASS_CHECKS = {
  sourceV2: "PASS", shipGate: "PASS", authorCheck: "PASS", intraBook: "PASS", bookGate: "PASS",
  sweep: "PASS", manualKeyJudge: "PASS", barRead: "GREEN", confirmRead: "PUBLISHABLE",
  repairLedger: "NO_OPEN_BLOCKERS", majors: "PASS", planEnforcement: "PASS",
};

function decision(finalVerdict: string, checksOverride: Record<string, string> = {}): any {
  return { finalVerdict, checks: { ...PASS_CHECKS, ...checksOverride } };
}

function metric(over: Partial<QcFinalizationMetric>): QcFinalizationMetric {
  return {
    schemaVersion: "qc-finalization-v1", bookId: "b", roundId: "r1", timestamp: "2026-06-17T00:00:00Z",
    mode: "full", incremental: false, tiebreak: false,
    chapters: 7, publishable: 7, revise: 0, corruption: 0, needsMoreQc: 0,
    topFailedChecks: {}, topBarAxes: {}, ...over,
  };
}

test("buildQcFinalizationMetric counts verdicts and only counts blocks on non-publishable chapters", () => {
  const m = buildQcFinalizationMetric({
    bookId: "zz", roundId: "r1", timestamp: "t", mode: "full", incremental: false, tiebreak: false,
    decisions: [
      decision("PUBLISHABLE"),
      decision("PUBLISHABLE", { confirmRead: "MISSING" }), // publishable ⇒ its MISSING is NOT counted
      decision("REVISE", { barRead: "YELLOW", planEnforcement: "FAIL" }),
      decision("REVISE", { planEnforcement: "FAIL", sourceV2: "NOT_APPLICABLE" }), // NOT_APPLICABLE never a block
    ],
    failingBarAxes: ["quiz_distractor_quality", "plan_actionability", "quiz_distractor_quality"],
  });
  assert.equal(m.chapters, 4);
  assert.equal(m.publishable, 2);
  assert.equal(m.revise, 2);
  assert.equal(m.topFailedChecks["planEnforcement"], 2, "two REVISE chapters failed planEnforcement");
  assert.equal(m.topFailedChecks["barRead"], 1, "one YELLOW bar on a non-publishable chapter");
  assert.equal(m.topFailedChecks["confirmRead"], undefined, "publishable chapter's MISSING confirm not counted");
  assert.equal(m.topFailedChecks["sourceV2"], undefined, "NOT_APPLICABLE is never a block");
  assert.equal(m.topBarAxes["quiz_distractor_quality"], 2);
});

test("aggregateQcMetrics computes first-pass rate, rounds-to-pass, top axis + blocker over last N books", () => {
  const records: QcFinalizationMetric[] = [
    // book A: passed on round 1
    metric({ bookId: "A", roundId: "rA1", timestamp: "2026-06-10T00:00:00Z" }),
    // book B: round 1 REVISE (axis + blocker), round 2 PASS ⇒ 2 rounds to pass
    metric({ bookId: "B", roundId: "rB1", timestamp: "2026-06-11T00:00:00Z", publishable: 5, revise: 2, topBarAxes: { quiz_distractor_quality: 2 }, topFailedChecks: { planEnforcement: 2 } }),
    metric({ bookId: "B", roundId: "rB2", timestamp: "2026-06-11T01:00:00Z" }),
  ];
  const s = aggregateQcMetrics(records, 10);
  assert.equal(s.books, 2);
  assert.equal(s.finalizations, 3);
  assert.equal(s.firstPass.passed, 1, "only A passed on its first round");
  assert.equal(s.firstPass.rate, 0.5);
  assert.equal(s.avgRoundsToPass, 1.5, "A=1 round, B=2 rounds ⇒ avg 1.5");
  assert.deepEqual(s.topRevisedAxis, { axis: "quiz_distractor_quality", count: 2 });
  assert.deepEqual(s.topBlocker, { check: "planEnforcement", count: 2 });
});

test("aggregateQcMetrics keeps only the most recent N books", () => {
  const records = ["A", "B", "C"].map((b, i) =>
    metric({ bookId: b, roundId: `r${b}`, timestamp: `2026-06-1${i}T00:00:00Z` }),
  );
  const s = aggregateQcMetrics(records, 2);
  assert.equal(s.books, 2, "window capped at 2 books (drops the oldest, A)");
});

test("appendQcFinalizationMetric is idempotent for an unchanged re-run; a changed outcome appends", () => {
  const path = resolve(tmpdir(), `qc-metrics-test-${process.pid}.jsonl`);
  try {
    const m = metric({ bookId: "Z", roundId: "rZ" });
    appendQcFinalizationMetric(m, path);
    appendQcFinalizationMetric({ ...m, timestamp: "2026-06-17T09:00:00Z" }, path); // same outcome, later time
    assert.equal(loadQcFinalizationMetrics(path).length, 1, "byte-identical re-run not double-counted");
    appendQcFinalizationMetric({ ...m, revise: 1, publishable: 6 }, path); // changed outcome ⇒ appends
    assert.equal(loadQcFinalizationMetrics(path).length, 2);
  } finally {
    rmSync(path, { force: true });
  }
});
