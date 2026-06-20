import { test } from "node:test";
import assert from "node:assert/strict";
import {
  phaseForProgress,
  PHASE_BANDS,
  ORDER,
} from "@/components/sections/retention-loop-phase";

// The signature RetentionLoopSection's pure scroll-progress→phase mapping.
// (Lives in components/, but the unit gate only globs app/ + lib/, so the test
// lives here and imports the runtime-dependency-free module.)

test("phaseForProgress maps each band to the right phase", () => {
  assert.equal(phaseForProgress(0), "summary");
  assert.equal(phaseForProgress(0.1), "summary");
  assert.equal(phaseForProgress(0.26), "summary");
  assert.equal(phaseForProgress(0.27), "examples"); // band edge is exclusive upper
  assert.equal(phaseForProgress(0.4), "examples");
  assert.equal(phaseForProgress(0.49), "examples");
  assert.equal(phaseForProgress(0.5), "quiz");
  assert.equal(phaseForProgress(0.73), "quiz");
  assert.equal(phaseForProgress(0.74), "practice");
  assert.equal(phaseForProgress(0.9), "practice");
  assert.equal(phaseForProgress(1), "practice");
});

test("phaseForProgress clamps out-of-range progress (scroll overshoot)", () => {
  assert.equal(phaseForProgress(-0.2), "summary"); // negative → first band
  assert.equal(phaseForProgress(1.5), "practice"); // overshoot → last band
});

test("phase bands are monotonic, cover [0,1], and match ORDER", () => {
  for (let i = 1; i < PHASE_BANDS.length; i++) {
    assert.ok(
      PHASE_BANDS[i].max > PHASE_BANDS[i - 1].max,
      "band maxima must strictly increase",
    );
  }
  assert.equal(PHASE_BANDS[PHASE_BANDS.length - 1].max, Infinity);
  assert.deepEqual(
    PHASE_BANDS.map((b) => b.phase),
    ORDER,
  );
});
