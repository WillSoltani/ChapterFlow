/**
 * The writer-facing publishable-bar rubric must surface the SAME standard the QC
 * bar reviewer scores against (single source of truth: AXIS_RUBRIC / AXIS_WEIGHTS
 * / thresholds), so a writer self-scores against the reviewer's actual rubric
 * before submitting. Guards drift: every axis the reviewer scores must appear in
 * the writer rubric, with the pass thresholds.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  formatWriterRubric,
  AXIS_RUBRIC,
  AXIS_WEIGHTS,
  CORRUPTION_AXES,
  PUBLISHABLE_FLOOR,
  AXIS_FLOOR,
  type AxisId,
} from "../src/critics/semantic/publishableBar.js";

test("writer rubric surfaces every bar axis the reviewer scores (no drift)", () => {
  const out = formatWriterRubric();
  for (const axis of Object.keys(AXIS_WEIGHTS) as AxisId[]) {
    assert.match(out, new RegExp(axis), `writer rubric must name axis ${axis}`);
    assert.ok(out.includes(`weight ${AXIS_WEIGHTS[axis]}`), `writer rubric must show ${axis}'s weight`);
    // The actual reviewer rubric text must be present verbatim — same source.
    assert.ok(out.includes(AXIS_RUBRIC[axis]), `writer rubric must carry the reviewer's verbatim ${axis} rubric`);
  }
});

test("AXIS_WEIGHTS pins the axis count (9) and sums to EXACTLY 100", () => {
  // Pin the count so a missing OR extra axis fails CI (Plan A added the 9th,
  // behavioral_naturalness). The sum MUST stay 100: PUBLISHABLE_FLOOR=85 and
  // computeVerdict assume a 0–100 scale, so 99/101 silently breaks the floor.
  assert.strictEqual(Object.keys(AXIS_WEIGHTS).length, 9, "expected exactly 9 bar axes");
  const sum = Object.values(AXIS_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.strictEqual(sum, 100, `AXIS_WEIGHTS must sum to exactly 100, got ${sum}`);
  // behavioral_naturalness is a quality axis, NOT a corruption veto.
  assert.ok(AXIS_WEIGHTS.behavioral_naturalness >= 1, "behavioral_naturalness must carry a weight");
  assert.ok(!CORRUPTION_AXES.has("behavioral_naturalness"), "behavioral_naturalness must NOT be a corruption axis");
  // Its rubric encodes the FP-guard band so a clean structural action never false-floors.
  assert.match(AXIS_RUBRIC.behavioral_naturalness, />=\s*0\.85/, "rubric must state the >=0.85 clean band");
  assert.match(AXIS_RUBRIC.behavioral_naturalness, /NEVER score a clean/i, "rubric must state the never-floor-clean FP-guard");
});

test("writer rubric states the pass thresholds and corruption axes", () => {
  const out = formatWriterRubric();
  assert.ok(out.includes(String(PUBLISHABLE_FLOOR)), "must state the overall floor (85)");
  assert.ok(out.includes(AXIS_FLOOR.toFixed(2)), "must state the per-axis floor (0.60)");
  for (const axis of CORRUPTION_AXES) {
    assert.match(out, new RegExp(axis), `corruption axis ${axis} must be named`);
  }
  assert.match(out, /self-score/i, "must instruct the writer to self-score");
});
