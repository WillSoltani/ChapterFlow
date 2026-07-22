import { test } from "node:test";
import assert from "node:assert/strict";
import {
  phaseForProgress,
  beatFor,
  PHASE_BANDS,
  BEAT_BANDS,
  ORDER,
  REVIEWS,
  T_MAX,
  X0,
  X1,
  xOf,
  yOf,
  withRecall,
  withRecallPct,
  playheadYOf,
} from "./retention-loop-phase";

// The signature ScrollStory §01 pure scroll-progress→phase mapping AND the
// load-bearing curve-geometry invariant. Colocated with its only consumer
// (WS3-007: the unit gate now globs app/ + lib/ + components/ + tests/, so the
// test no longer needs to live under lib/ to run — moved out of lib/ to keep
// lib/ from importing upward into components/) — so this test guards exactly
// what ships, with no risk of a divergent in-component copy.

test("phaseForProgress maps each band to the right phase", () => {
  assert.equal(phaseForProgress(0), "summary");
  assert.equal(phaseForProgress(0.1), "summary");
  assert.equal(phaseForProgress(0.26), "summary");
  assert.equal(phaseForProgress(0.27), "examples"); // band edge is exclusive upper
  assert.equal(phaseForProgress(0.4), "examples");
  assert.equal(phaseForProgress(0.49), "examples");
  assert.equal(phaseForProgress(0.5), "quiz");
  assert.equal(phaseForProgress(0.77), "quiz");
  assert.equal(phaseForProgress(0.78), "practice"); // quiz band closes at 0.78
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
      PHASE_BANDS[i]!.max > PHASE_BANDS[i - 1]!.max,
      "band maxima must strictly increase",
    );
  }
  assert.equal(PHASE_BANDS[PHASE_BANDS.length - 1]!.max, Infinity);
  assert.deepEqual(
    PHASE_BANDS.map((b) => b.phase),
    ORDER,
  );
});

test("beatFor (the live ScrollStory mapping) tracks the same bands as phaseForProgress", () => {
  // beatFor is what ScrollStory actually calls — assert it agrees with the band
  // table index-for-index so the two can never silently drift again.
  assert.deepEqual(BEAT_BANDS, PHASE_BANDS.map((b) => b.max));
  assert.equal(beatFor(0), 0); // summary
  assert.equal(beatFor(0.26), 0);
  assert.equal(beatFor(0.27), 1); // examples
  assert.equal(beatFor(0.5), 2); // quiz
  assert.equal(beatFor(0.77), 2);
  assert.equal(beatFor(0.78), 3); // practice
  assert.equal(beatFor(2), 3); // overshoot → last beat
});

/* ---- §01 LOAD-BEARING INVARIANT: readout == curve height at the playhead ---- */
// ScrollStory derives the playhead dot y (playheadYOf), the big readout
// (withRecallPct) and the in-chart chip from the SAME withRecall(t). This test
// proves, across many draw values, that the PRINTED integer % equals the recall at
// that t AND that the dot y equals the saw-tooth height yOf(withRecall(t)) — so a
// future edit that desyncs any of the three transforms fails the gate.
test("§01 invariant: printed readout integer == round(withRecall(t)*100) for all draw values", () => {
  for (let v = 0; v <= 100; v += 1) {
    const t = (v / 100) * T_MAX;
    assert.equal(withRecallPct(t), Math.round(withRecall(t) * 100));
  }
});

test("§01 invariant: playhead dot y == saw-tooth height yOf(withRecall(t))", () => {
  for (let v = 0; v <= 100; v += 1) {
    const t = (v / 100) * T_MAX;
    // The dot rides exactly on the cyan line at the playhead x.
    assert.equal(playheadYOf(t), yOf(withRecall(t)));
  }
});

test("§01 invariant: recall holds in [~0.89, 1.0] and snaps to 100% at each review", () => {
  // Fresh / at every review spike → exactly 100%.
  for (const rv of REVIEWS) {
    assert.equal(withRecall(rv.t), 1);
    assert.equal(withRecallPct(rv.t), 100);
  }
  // Between reviews it decays but holds near the FSRS ~90% design floor — it never
  // collapses toward the decay baseline. The printed integer never drops below 89%.
  for (let v = 0; v <= 100; v += 1) {
    const t = (v / 100) * T_MAX;
    const r = withRecall(t);
    assert.ok(r <= 1 + 1e-9, `recall must not exceed 1 (t=${t})`);
    assert.ok(r >= 0.88, `recall must hold near the ~90% floor (t=${t}, r=${r})`);
    assert.ok(withRecallPct(t) >= 89, `printed recall must read ≥89% (t=${t})`);
  }
});

test("§01 geometry: playhead x spans the chart rails left→right as draw goes 0→100", () => {
  // The component computes playheadX = X0 + (v/100)*(X1-X0); xOf(t) with
  // t=(v/100)*T_MAX is the identical expression, so the dot's x is on the time axis.
  assert.equal(xOf(0), X0);
  assert.equal(xOf(T_MAX), X1);
});
