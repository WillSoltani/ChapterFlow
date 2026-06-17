/**
 * diagnosePlan — the pure ordering behind `diagnose <book>`. It composes the existing
 * book-level diagnostics; this guards that the composition is stable: the three book-level
 * sections always run in order, and qc-diagnose is included iff a round exists (it needs a
 * --round), otherwise its absence is surfaced as a note rather than a crash.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { diagnosePlan, formatDiagnoseHeader, formatDiagnoseStep, formatDiagnoseNotes } from "../src/diagnose.js";

test("diagnosePlan always runs the three book-level diagnostics in order", () => {
  const { steps } = diagnosePlan("zz-book", null);
  assert.deepEqual(
    steps.map((s) => s.kind),
    ["book-status", "major-status", "source-verify-check"],
  );
});

test("diagnosePlan appends qc-diagnose (with the round) only when a round exists; else a note", () => {
  const withRound = diagnosePlan("zz-book", "r20260615194212-abc123");
  assert.deepEqual(
    withRound.steps.map((s) => s.kind),
    ["book-status", "major-status", "source-verify-check", "qc-diagnose"],
  );
  const qc = withRound.steps.find((s) => s.kind === "qc-diagnose")!;
  assert.match(qc.command, /qc-diagnose zz-book --round r20260615194212-abc123/);
  assert.equal(withRound.notes.length, 0);

  const noRound = diagnosePlan("zz-book", null);
  assert.ok(!noRound.steps.some((s) => s.kind === "qc-diagnose"), "no qc-diagnose step without a round");
  assert.equal(noRound.notes.length, 1);
  assert.match(noRound.notes[0], /No QC round on disk/);
  assert.match(noRound.notes[0], /qc-diagnose zz-book --round <roundId>/);
});

test("formatDiagnoseHeader reflects the resolved round state", () => {
  assert.match(formatDiagnoseHeader("zz-book", "r1"), /ChapterFlow Diagnose — zz-book/);
  assert.match(formatDiagnoseHeader("zz-book", "r1"), /latest QC round: r1/);
  assert.match(formatDiagnoseHeader("zz-book", null), /latest QC round: \(none on disk\)/);
});

test("formatDiagnoseStep shows the standalone command; notes are bulleted", () => {
  const step = diagnosePlan("zz-book", null).steps[0];
  const out = formatDiagnoseStep(step);
  assert.match(out, /Phase & gate status/);
  assert.match(out, /npx tsx src\/cli\.ts book-status "zz-book"/);
  assert.match(formatDiagnoseNotes(["hello"]), /notes:\n {2}hello/);
});
