/**
 * curve-geometry — pure SVG path math for the retention curve in the canonical
 * hero (RecallHeroSplit, "Editorial Split"). The curve appears EXACTLY ONCE on
 * the landing — in the hero plate — and this module is its only geometry source.
 *
 * Every value is derived from the PRODUCT'S REAL FSRS model imported from
 * retention-loop-phase.ts (`withRecall` / `Rf` / `T_MAX`) — the shape is never
 * invented. This module only maps those real R(t) values into the hero's SVG
 * viewBox (the framed product plate).
 *
 * Pure + dependency-free (only erasable type usage), so it carries no "use
 * client" cost and could be unit-tested in isolation.
 */

import {
  Rf,
  withRecall,
  withRecallPct,
  REVIEWS,
  T_MAX,
} from "@/components/sections/retention-loop-phase";

export type Pt = { x: number; y: number };

/**
 * Width (in days) of the eased recovery ramp that replaces each instantaneous
 * review jump. The raw FSRS model snaps R from its pre-review decayed value back
 * to 1.0 in zero time (a discontinuity → a near-vertical "sharp" segment). We
 * instead sweep that recovery up across a short window ENDING at the review day,
 * so the locked line reads as a graceful dip-and-recover (rolling hills) rather
 * than a sawtooth. The samples BETWEEN recoveries stay the real `withRecall(t)`;
 * only this small transition is rounded. ~0.6 days reads elegant at the hero
 * scale without visibly distorting the science.
 */
const RECOVERY_DAYS = 0.6;

/** Width (in days) of the eased SHOULDER after each review peak. The raw model
 *  leaves a peak at full recall and immediately decays at the interval's slope —
 *  a corner. Easing the first slice of decay (zero slope at the peak → matching
 *  the real decay by the window's end) rounds the crest into a graceful hilltop
 *  instead of a point. */
const PEAK_SHOULDER_DAYS = 0.45;

/** Classic Hermite smoothstep on [0,1] — eases in AND out (zero slope at both
 *  ends), which is what turns a sharp jump into an S-curve. */
function smoothstep(u: number): number {
  const c = u <= 0 ? 0 : u >= 1 ? 1 : u;
  return c * c * (3 - 2 * c);
}

/**
 * The SMOOTHED locked retention at day `t` — a graceful series of rolling hills.
 *
 * Outside the shaped windows this is exactly the real `withRecall(t)` (so every
 * between-review sample is the genuine FSRS value). Two small shapes round the
 * sharp bits of each review:
 *  - PRE (rise): across `[review.t - RECOVERY_DAYS, review.t]` (non-initial
 *    reviews) blend the natural decay up to 1.0 via smoothstep — the dip eases
 *    back to full recall at the review day.
 *  - POST (shoulder): across `[review.t, review.t + PEAK_SHOULDER_DAYS]` ease the
 *    departure from 1.0 INTO the real decay (zero slope at the crest) so the peak
 *    is a rounded hilltop, not a corner.
 */
export function lockedRecall(t: number): number {
  // PRE — eased rise into each non-initial review (dip → crest).
  for (let i = 1; i < REVIEWS.length; i++) {
    const rv = REVIEWS[i];
    const prev = REVIEWS[i - 1]; // real low point uses the PREVIOUS stability
    // Cap the rise so it can't reach back past the midpoint of the gap to the
    // previous review — otherwise (when reviews are close, e.g. day 0 → day 1)
    // it overlaps that review's POST shoulder and a value/slope kink appears
    // where the two windows meet. Capped at gap/2, PRE(i) and POST(i-1) tile the
    // gap without overlapping (gap/2 + gap/2 ≤ gap).
    const width = Math.min(RECOVERY_DAYS, (rv.t - prev.t) / 2);
    const start = rv.t - width;
    if (t >= start && t < rv.t) {
      const decayed = Rf(t - prev.t, prev.s);
      const u = (t - start) / width; // 0 at window start → 1 at review
      return decayed + (1 - decayed) * smoothstep(u);
    }
  }
  // POST — eased shoulder leaving each crest (crest → real decay).
  for (let i = 0; i < REVIEWS.length; i++) {
    const rv = REVIEWS[i];
    // Symmetric cap: the shoulder can't extend past the midpoint of the gap to
    // the NEXT review, so it never overlaps that review's PRE rise (see above).
    const next = REVIEWS[i + 1];
    const width = next
      ? Math.min(PEAK_SHOULDER_DAYS, (next.t - rv.t) / 2)
      : PEAK_SHOULDER_DAYS;
    if (t >= rv.t && t <= rv.t + width) {
      const decay = Rf(t - rv.t, rv.s); // real decay from this crest
      const u = (t - rv.t) / width; // 0 at crest → 1 at window end
      return 1 - (1 - decay) * smoothstep(u);
    }
  }
  return withRecall(t);
}

/** A real FSRS review event, mapped to the plate's pixel space. */
export type ReviewMark = { t: number; x: number; y: number };
/** A retention-axis gridline (value axis carries the gridlines, per ONS). */
export type GridLine = { r: number; y: number; label: string };
/** A time-axis tick (time axis carries ticks, not gridlines, per ONS). */
export type TimeTick = { t: number; x: number; label: string };

export type CurveBox = {
  /** viewBox width / height */
  vbW: number;
  vbH: number;
  /** inner padding (px in viewBox units) */
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  /** number of sample steps along the day axis (more = smoother bezier) */
  steps?: number;
  /** visible retention band [min,max]; trims dead space below the decay floor */
  rMin?: number;
  rMax?: number;
};

export type CurveGeometry = {
  /** the lit, retained (spaced-review) line path — the STAR */
  lockedD: string;
  /** the faint ghost decay line (no review) */
  fadeD: string;
  /** closed area under the locked line, for the gradient fill */
  areaD: string;
  /** the shaded band BETWEEN the two lines — the retention the product buys */
  gapD: string;
  /** the R = 0.9 reference guide y */
  y90: number;
  /** the glowing endpoint of the locked line */
  endX: number;
  endY: number;
  /** real FSRS review events, as on-curve markers (the chart's data points) */
  reviewMarks: ReviewMark[];
  /** horizontal retention gridlines + their % labels */
  gridLines: GridLine[];
  /** time-axis ticks at the review days + horizon */
  timeTicks: TimeTick[];
  /** end-of-window retention readouts (real FSRS), for the connected callouts */
  retainedEndPct: number;
  fadedEndPct: number;
  /** plotting bounds, for axes / framing */
  x0: number;
  x1: number;
  yTop: number;
  yBot: number;
  /** raw mappers, exposed so callers can place bespoke annotations */
  xOf: (t: number) => number;
  yOf: (r: number) => number;
};

/**
 * Build the locked + fading + area paths for a curve sized to `box`. Returned
 * coordinates are smooth (Catmull-Rom → cubic bezier) so the giant hero line
 * reads as a hand-drawn premium curve, not a polyline.
 */
export function buildCurveGeometry(box: CurveBox): CurveGeometry {
  const {
    vbW,
    vbH,
    padL,
    padR,
    padT,
    padB,
    steps = 120,
    rMin = 0.1,
    rMax = 1.0,
  } = box;

  const x0 = padL;
  const x1 = vbW - padR;
  const yTop = padT; // maps to rMax
  const yBot = vbH - padB; // maps to rMin

  // SQUARE-ROOT time axis. The real spaced-review intervals expand fast
  // (1 → 3 → 8 → 24 days), so on a linear axis the early reviews crush into the
  // left edge as sharp little spikes. Mapping x by √t spreads those early
  // recoveries out into EVEN, graceful rolling hills (the "elegant wave"), and —
  // as a bonus — the day ticks (0·1·4·12·36) then sit progressively farther
  // apart, so the axis itself visualizes the expanding-interval idea. Day labels
  // are the real values, so the axis stays honest.
  const xOf = (t: number): number =>
    x0 + (Math.sqrt(t) / Math.sqrt(T_MAX)) * (x1 - x0);
  const yOf = (r: number): number =>
    yTop + ((rMax - r) / (rMax - rMin)) * (yBot - yTop);

  // Sample EVENLY IN √-SPACE (t = u²·T_MAX) so points are evenly spaced along
  // the square-root x-axis — i.e. denser in early days where the hills live —
  // keeping the curve smooth there instead of angular from too-few points.
  const uniformDays = Array.from(
    { length: steps + 1 },
    (_, i) => Math.pow(i / steps, 2) * T_MAX,
  );

  // …PLUS extra samples packed into each recovery window so the eased S-curve
  // is described by enough points for Catmull-Rom to render it as a clean swell
  // (a uniform grid can stride right over a 0.6-day ramp and re-introduce a
  // kink). 14 extra points per window is plenty at hero scale.
  const RECOVERY_SUBSAMPLES = 14;
  const denseRecoveryDays: number[] = [];
  for (let i = 0; i < REVIEWS.length; i++) {
    // PRE rise window (non-initial reviews only).
    if (i >= 1) {
      const start = REVIEWS[i].t - RECOVERY_DAYS;
      for (let k = 0; k <= RECOVERY_SUBSAMPLES; k++) {
        denseRecoveryDays.push(start + (k / RECOVERY_SUBSAMPLES) * RECOVERY_DAYS);
      }
    }
    // POST shoulder window (every review crest).
    for (let k = 0; k <= RECOVERY_SUBSAMPLES; k++) {
      denseRecoveryDays.push(
        REVIEWS[i].t + (k / RECOVERY_SUBSAMPLES) * PEAK_SHOULDER_DAYS,
      );
    }
  }

  // Merge, clamp to [0, T_MAX], sort, and dedupe so the path stays monotonic in
  // x and Catmull-Rom never sees a zero-length segment.
  const days = Array.from(
    new Set(
      [...uniformDays, ...denseRecoveryDays]
        .filter((t) => t >= 0 && t <= T_MAX)
        .map((t) => Number(t.toFixed(4))),
    ),
  ).sort((a, b) => a - b);

  const lockedPts: Pt[] = days.map((t) => ({ x: xOf(t), y: yOf(lockedRecall(t)) }));
  const fadePts: Pt[] = uniformDays.map((t) => ({ x: xOf(t), y: yOf(Rf(t, 1)) }));

  const lockedD = smoothPath(lockedPts);
  const fadeD = smoothPath(fadePts);

  const last = lockedPts[lockedPts.length - 1];
  const first = lockedPts[0];
  const areaD = `${lockedD} L${last.x.toFixed(2)} ${yBot.toFixed(2)} L${first.x.toFixed(
    2,
  )} ${yBot.toFixed(2)} Z`;

  // The band between the two lines = the retention spaced review buys you. Top
  // boundary is the smooth locked line; bottom boundary is the fade line walked
  // back (a dense polyline — visually smooth at this sample count).
  const reversedFade = fadePts
    .slice()
    .reverse()
    .map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const gapD = `${lockedD} ${reversedFade} Z`;

  // Real FSRS review events become the chart's data points. Each recovery window
  // ENDS at the review day, so `lockedRecall(r.t)` is the crest of that hill
  // (R = 1.0) — the dots ride the wave at each peak / just-after the dip, exactly
  // on the now-smoothed locked line.
  const reviewMarks: ReviewMark[] = REVIEWS.map((r) => ({
    t: r.t,
    x: xOf(r.t),
    y: yOf(lockedRecall(r.t)),
  }));

  // Gridlines ride the VALUE (retention) axis; ticks ride the TIME axis (ONS).
  const gridLines: GridLine[] = [1, 0.75, 0.5, 0.25]
    .filter((r) => r >= rMin - 1e-6 && r <= rMax + 1e-6)
    .map((r) => ({ r, y: yOf(r), label: `${Math.round(r * 100)}` }));

  const tickDays = [...REVIEWS.map((r) => r.t), T_MAX];
  const timeTicks: TimeTick[] = tickDays.map((t) => ({
    t,
    x: xOf(t),
    label: `${t}`,
  }));

  return {
    lockedD,
    fadeD,
    areaD,
    gapD,
    y90: yOf(0.9),
    endX: last.x,
    endY: last.y,
    reviewMarks,
    gridLines,
    timeTicks,
    retainedEndPct: withRecallPct(T_MAX),
    fadedEndPct: Math.round(Rf(T_MAX, 1) * 100),
    x0,
    x1,
    yTop,
    yBot,
    xOf,
    yOf,
  };
}

/**
 * Catmull-Rom → cubic-bezier smoothing. Produces a single buttery curve through
 * all sample points. Combined with `lockedRecall`'s eased recovery windows and
 * the densified sampling around them, the once-sawtooth recoveries now read as a
 * series of rolling hills. Keeps the path one continuous `d` so stroke-dashoffset
 * draw-on works cleanly.
 */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;

  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];

    // Catmull-Rom tension 0.5 → cubic control points.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(
      2,
    )} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** The live retention readout for the locked endpoint (real FSRS value). */
export { T_MAX } from "@/components/sections/retention-loop-phase";

/**
 * Re-export the raw FSRS decay `Rf(t, s)` so the interactive playhead can compute
 * the "no review" line value at an ARBITRARY scrubbed `t` (the static geometry
 * above only samples it at fixed points). Paired with the exported `lockedRecall`
 * above, this lets the hero's scrubber read both series live without duplicating
 * any of the FSRS math here.
 */
export { Rf } from "@/components/sections/retention-loop-phase";
