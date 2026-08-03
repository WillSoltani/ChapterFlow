import type { ChapterTab } from "@/lib/reader-state-types";

/**
 * Pure scroll-progress → loop-phase mapping AND the §01 retention-curve geometry
 * for the signature ScrollStory section. Kept in a runtime-dependency-free module
 * (only a type-only import, erased at compile time) so it can be unit-tested
 * without loading the "use client" + framer-motion component tree.
 *
 * This is the SINGLE SOURCE OF TRUTH: ScrollStory.tsx imports `beatFor` /
 * `BEAT_BANDS` (phase mapping) and `withRecall` / `playheadYOf` / `withRecallPct`
 * (curve geometry) from here, so the unit test guards what actually ships — the
 * test can never go stale against a divergent in-component copy.
 */

export const ORDER: ChapterTab[] = ["summary", "examples", "quiz", "practice"];

// Upper bound (exclusive) of each phase's scroll band, also the §01 beat bands.
// The quiz band is widest: it has the most to read and carries the "prove it →
// unlock" beat. These ARE the live bands ScrollStory scrubs against.
export const PHASE_BANDS: { max: number; phase: ChapterTab }[] = [
  { max: 0.27, phase: "summary" }, // Read
  { max: 0.5, phase: "examples" }, // See
  { max: 0.78, phase: "quiz" }, // Prove
  { max: Infinity, phase: "practice" }, // Keep
];

// Numeric beat-band thresholds (the .max column) — the form ScrollStory consumes.
export const BEAT_BANDS: number[] = PHASE_BANDS.map((b) => b.max);

/** Map continuous scroll progress (0..1, may overshoot) to a discrete loop phase. */
export function phaseForProgress(p: number): ChapterTab {
  for (const band of PHASE_BANDS) {
    if (p < band.max) return band.phase;
  }
  return "practice";
}

/** Map scroll progress to the active beat INDEX (0..3) — the value ScrollStory uses. */
export function beatFor(p: number): number {
  for (let i = 0; i < BEAT_BANDS.length; i++) {
    const band = BEAT_BANDS[i];
    if (band !== undefined && p < band) return i;
  }
  return BEAT_BANDS.length - 1;
}

/* ---- §01 retention-curve geometry (pure, deterministic) -------------------- */
// Shared with ScrollStory.tsx so the load-bearing invariant — the cyan playhead
// readout MUST equal the retention-curve height at the playhead x — is provable
// in a unit test instead of only by eyeballing the live chart.

export const T_MAX = 36; // days
export const X0 = 60;
export const X1 = 624;
export const Y_TOP = 34; // 100% retention
export const Y_BOT = 286; // 0% retention

export const xOf = (t: number): number => X0 + (t / T_MAX) * (X1 - X0);
export const yOf = (r: number): number => Y_TOP + (1 - r) * (Y_BOT - Y_TOP);
export const Rf = (t: number, s: number): number => 1 / (1 + t / (9 * s)); // R(S)=0.9 exactly

// Spaced reviews: stability grows each time, so each interval ends right at R=0.9.
export const REVIEWS = [
  { t: 0, s: 1 },
  { t: 1, s: 3 },
  { t: 4, s: 8 },
  { t: 12, s: 21 },
];

// With-ChapterFlow recall at day t (the cyan saw-tooth's value): find the active
// review interval, then evaluate the same Rf the curve is drawn from — so the big
// readout ALWAYS agrees with the line height at the playhead.
export function withRecall(t: number): number {
  let iv = REVIEWS[0];
  if (iv === undefined) return 1; // REVIEWS is non-empty; full recall as a defensive default
  for (const r of REVIEWS) if (t >= r.t) iv = r;
  return Rf(t - iv.t, iv.s);
}

export function withRecallPct(t: number): number {
  return Math.round(withRecall(t) * 100);
}

// The y pixel of the saw-tooth AT the playhead — derived from the SAME withRecall
// geometry the readout prints, so the playhead chip rides exactly on the cyan line.
export function playheadYOf(t: number): number {
  return yOf(withRecall(t));
}
