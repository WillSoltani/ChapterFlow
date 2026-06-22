"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  m,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
  useMotionTemplate,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { DUR, EASE, SPRING, SCROLL_OFFSET } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import {
  // SINGLE SOURCE OF TRUTH for the §01 phase mapping AND curve geometry —
  // the unit test (lib/retention-loop-phase.test.ts) guards exactly these, so the
  // shipped chart/playhead/readout can't silently drift from the test.
  BEAT_BANDS,
  beatFor,
  REVIEWS,
  T_MAX,
  X0,
  X1,
  Y_TOP,
  Y_BOT,
  xOf,
  yOf,
  Rf,
  withRecall,
  withRecallPct,
  playheadYOf,
} from "@/components/sections/retention-loop-phase";

/**
 * THE signature moment — "Operate the loop."
 *
 * A pinned, scroll-SCRUBBED (never jacked) stage where ONE scroll position drives
 * TWO things in lockstep:
 *   1. the REAL in-app reader (DesktopReaderShell, controlled) walking its actual
 *      four phases — Summary → Examples → Quiz → Practice — so the visitor watches
 *      the product run, not a screenshot; and
 *   2. ChapterFlow's real memory model drawn beside it: recall decays (forgetting),
 *      a quiz snaps it back to 100% (active recall = the unlock), spaced reviews
 *      flatten it into a saw-tooth that holds above 90% (FSRS). The teal area
 *      between "with" and "without" fills in — the retention you'd otherwise lose.
 *
 * Built on the real FSRS forgetting curve R(t) = 1 / (1 + t/9S), where stability
 * S = the days for recall to fall to 90%. Token-only color; animates ONLY
 * clip-path / opacity / transform (off main thread, CLS-safe); degrades to a
 * static, fully-drawn diagram with a flat auto-playing reader under reduced-motion
 * AND touch. The one bespoke moment on the page.
 */

/* ---- curve geometry --------------------------------------------------------- */
// All pure curve math (T_MAX, X0/X1, xOf/yOf/Rf, REVIEWS, withRecall, playheadYOf,
// withRecallPct) is imported from @/components/sections/retention-loop-phase so the
// invariant test guards the SHIPPED geometry. This file only builds the SVG paths.

type Pt = [number, number];

function baselinePts(): Pt[] {
  const pts: Pt[] = [];
  for (let t = 0; t <= T_MAX + 1e-6; t += 0.5) pts.push([xOf(t), yOf(Rf(t, 1))]);
  return pts;
}
function sawtoothPts(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < REVIEWS.length; i++) {
    const { t: ts, s } = REVIEWS[i];
    const te = i + 1 < REVIEWS.length ? REVIEWS[i + 1].t : T_MAX;
    pts.push([xOf(ts), yOf(1)]); // recall spike → 100%
    for (let t = ts; t <= te + 1e-6; t += 0.5) pts.push([xOf(t), yOf(Rf(t - ts, s))]);
  }
  return pts;
}
const toLine = (pts: Pt[]) =>
  "M " + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");

const BASE = baselinePts();
const SAW = sawtoothPts();
const BASE_D = toLine(BASE);
const SAW_D = toLine(SAW);
// Gain area: with-ChapterFlow forward, without backward, closed.
const GAIN_D =
  "M " +
  SAW.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ") +
  " L " +
  [...BASE].reverse().map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ") +
  " Z";

const GRID = [
  { r: 1, label: "100%" },
  { r: 0.9, label: "90%", hot: true },
  { r: 0.5, label: "50%" },
  { r: 0, label: "0%" },
];
const XTICKS = [
  { t: 1, label: "Day 1" },
  { t: 4, label: "Day 4" },
  { t: 12, label: "Week 2" },
  { t: 33, label: "Month 1" },
];

/* ---- beats (synced to the reader's phases) --------------------------------- */
type Beat = {
  phase: ChapterTab;
  kicker: string;
  headline: string;
  body: string;
  cite: string;
};
const BEATS: Beat[] = [
  {
    phase: "summary",
    kicker: "01 · Read it",
    headline: "You forget most of it within days.",
    body: "Read a chapter and do nothing, and recall falls off a cliff — the curve Ebbinghaus mapped in 1885, confirmed for a century since.",
    cite: "Ebbinghaus, 1885",
  },
  {
    phase: "examples",
    kicker: "02 · See it",
    headline: "Worked examples make the idea concrete.",
    body: "Before you're tested, the idea is shown in the wild — real scenarios that turn an abstract rule into something you can actually use.",
    cite: "Worked-example effect · Sweller & Cooper, 1985",
  },
  {
    phase: "quiz",
    kicker: "03 · Prove it",
    headline: "Prove it once — and it snaps back.",
    body: "A short scenario quiz makes you retrieve the idea. Retrieval, not rereading, is what cements it. Passing is also what unlocks the next chapter.",
    cite: "Karpicke & Roediger, Science, 2008",
  },
  {
    phase: "practice",
    kicker: "04 · Keep it",
    headline: "Then it returns, right before you'd forget.",
    body: "Each idea comes back on a widening schedule set by FSRS-5, the open spaced-repetition scheduler. Retention holds around 90%. That shaded gap is everything you'd have lost.",
    cite: "FSRS-5 spaced repetition · R(t) = 1 / (1 + t ⁄ 9S)",
  },
];
// Upper bound of each beat by scroll progress (also drives the reader's phase) —
// BEAT_BANDS / beatFor are imported from retention-loop-phase (single SoT).
// Lower/upper scroll-progress edge of each beat band (last beat closes at 1).
const BEAT_EDGES: [number, number][] = BEAT_BANDS.map((hi, i) => [
  i === 0 ? 0 : BEAT_BANDS[i - 1],
  hi === Infinity ? 1 : hi,
]);
// Convert a raw scrollYProgress value to the `draw` (0–100) scale that the curve,
// playhead and clip all run on — draw = (smooth − 0.06) / (0.94 − 0.06) · 100,
// clamped — so the per-word caption reveal shares the SAME single scroll source.
function drawOf(p: number): number {
  return Math.min(100, Math.max(0, ((p - 0.06) / (0.94 - 0.06)) * 100));
}

/* ---- the live reader (lazy; heavy) ----------------------------------------- */
function ReaderConsoleSkeleton() {
  return (
    <div
      aria-hidden
      className="w-full animate-pulse rounded-2xl border"
      style={{
        height: 540,
        background: "var(--cr-bg-surface-1, var(--bg-surface-1))",
        borderColor: "var(--cf-console-rim)",
        boxShadow: "var(--shadow-hero)",
      }}
    />
  );
}
const DesktopReaderShell = dynamic(
  () =>
    import("@/components/landing/reader-demo/DesktopReaderShell").then(
      (mod) => mod.DesktopReaderShell
    ),
  { ssr: false, loading: () => <ReaderConsoleSkeleton /> }
);

/* ---- client signals (hydration-safe: server → static) ---------------------- */
const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
const DESKTOP_Q = "(min-width: 1024px) and (pointer: fine)";
function useDesktopFinePointer() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_Q);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP_Q).matches,
    () => false,
  );
}

/* ---- the chart ------------------------------------------------------------- */
function RetentionChart({
  clip,
  playheadX,
  playheadY,
  readout,
  isStatic,
}: {
  clip: string | MotionValue<string>;
  playheadX: number | MotionValue<number>;
  playheadY?: MotionValue<number>;
  readout?: MotionValue<string>;
  isStatic: boolean;
}) {
  return (
    <svg
      viewBox="0 0 640 332"
      role="img"
      aria-label="Recall probability (y-axis, 0 to 100 percent) over time (x-axis, Day 1 through Month 1). Without review, memory decays steeply toward zero. With ChapterFlow, a quiz snaps recall back to 100% and spaced reviews keep it around 90%. A cyan playhead rides the with-review line and prints the live recall value. The shaded area between the two lines is the retention otherwise lost."
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id="cf-engine-gain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* instrument-frame axis rails — the bezel's measured edges */}
      <line x1={X0} x2={X0} y1={Y_TOP - 6} y2={Y_BOT} stroke="var(--cf-axis-tint)" strokeWidth={1} />
      <line x1={X0} x2={X1} y1={Y_BOT} y2={Y_BOT} stroke="var(--cf-axis-tint)" strokeWidth={1} />

      {/* gridlines + y labels (static) — each tick re-derived from yOf, never hardcoded */}
      {GRID.map((g) => (
        <g key={g.label}>
          <line
            x1={X0}
            x2={X1}
            y1={yOf(g.r)}
            y2={yOf(g.r)}
            stroke={g.hot ? "var(--accent-cyan)" : "var(--cf-grid-line)"}
            strokeOpacity={g.hot ? 0.45 : 1}
            strokeDasharray={g.hot ? "2 6" : "0"}
            strokeWidth={1}
          />
          {/* left axis tick mark */}
          <line
            x1={X0 - 4}
            x2={X0}
            y1={yOf(g.r)}
            y2={yOf(g.r)}
            stroke={g.hot ? "var(--accent-cyan)" : "var(--cf-axis-tint)"}
            strokeWidth={1}
          />
          <text
            x={X0 - 10}
            y={yOf(g.r) + 4}
            textAnchor="end"
            fontSize="11"
            fontFamily="var(--font-mono)"
            style={{ fontVariantNumeric: "tabular-nums" }}
            fill={g.hot ? "var(--accent-cyan)" : "var(--cf-axis-tint)"}
          >
            {g.label}
          </text>
        </g>
      ))}
      {/* y-axis caption */}
      <text
        x={X0 - 10}
        y={Y_TOP - 16}
        textAnchor="end"
        fontSize="9"
        fontFamily="var(--font-mono)"
        letterSpacing="0.08em"
        fill="var(--cf-axis-tint)"
      >
        RECALL
      </text>

      {/* x ticks — re-derived from xOf, with tick marks on the bottom rail */}
      {XTICKS.map((x) => (
        <g key={x.label}>
          <line
            x1={xOf(x.t)}
            x2={xOf(x.t)}
            y1={Y_BOT}
            y2={Y_BOT + 4}
            stroke="var(--cf-axis-tint)"
            strokeWidth={1}
          />
          <text
            x={xOf(x.t)}
            y={Y_BOT + 20}
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            style={{ fontVariantNumeric: "tabular-nums" }}
            fill="var(--cf-axis-tint)"
          >
            {x.label}
          </text>
        </g>
      ))}
      {/* x-axis caption */}
      <text
        x={X1}
        y={Y_BOT + 20}
        textAnchor="end"
        fontSize="9"
        fontFamily="var(--font-mono)"
        letterSpacing="0.08em"
        fill="var(--cf-axis-tint)"
      >
        FSRS INTERVAL →
      </text>

      {/* revealed content (clip wipes L→R with scroll; static = fully shown) */}
      <m.g style={isStatic ? undefined : { clipPath: clip }}>
        <path d={GAIN_D} fill="url(#cf-engine-gain)" />
        {/* without ChapterFlow — muted decay */}
        <path
          d={BASE_D}
          fill="none"
          stroke="var(--cf-spine-decay)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="2 7"
        />
        {/* with ChapterFlow — glowing saw-tooth */}
        <path
          d={SAW_D}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth={3.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter:
              "drop-shadow(0 0 8px color-mix(in srgb, var(--accent-cyan) 55%, transparent))",
          }}
        />
        {/* recall markers at each review spike */}
        {REVIEWS.map((rv) => (
          <circle
            key={rv.t}
            cx={xOf(rv.t)}
            cy={yOf(1)}
            r={5}
            fill="var(--accent-cyan)"
            stroke="var(--cf-page-bg)"
            strokeWidth={2}
          />
        ))}
      </m.g>

      {/* scrubbing playhead + live readout chip (motion only). The chip rides
          playheadY — derived from the SAME withRecall geometry the readout text
          prints — so the printed value is always the cyan line height here. */}
      {!isStatic && (
        <>
          <m.line
            x1={playheadX}
            x2={playheadX}
            y1={Y_TOP - 6}
            y2={Y_BOT}
            stroke="var(--accent-cyan)"
            strokeOpacity="0.35"
            strokeWidth={1.5}
          />
          {playheadY && (
            <m.circle
              cx={playheadX}
              cy={playheadY}
              r={4}
              fill="var(--cf-playhead-readout)"
              stroke="var(--cf-page-bg)"
              strokeWidth={2}
            />
          )}
          {readout && (
            <m.text
              x={playheadX}
              y={Y_TOP - 10}
              dx={8}
              fontSize="12"
              fontFamily="var(--font-mono)"
              fontWeight={700}
              style={{ fontVariantNumeric: "tabular-nums" }}
              fill="var(--cf-playhead-readout)"
            >
              {readout}
            </m.text>
          )}
        </>
      )}

      {/* legend */}
      <g>
        <circle cx={X0 + 6} cy={Y_TOP - 14} r={4} fill="var(--accent-cyan)" />
        <text x={X0 + 16} y={Y_TOP - 10} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-secondary)">
          With ChapterFlow
        </text>
        <line x1={X0 + 150} x2={X0 + 168} y1={Y_TOP - 14} y2={Y_TOP - 14} stroke="var(--cf-spine-decay)" strokeWidth={2} strokeDasharray="2 4" />
        <text x={X0 + 176} y={Y_TOP - 10} fontSize="11" fontFamily="var(--font-mono)" fill="var(--text-tertiary)">
          Without
        </text>
      </g>
    </svg>
  );
}

/* ---- TextRevealByWord — per-word scrub on the active beat caption ----------- */
// Each word's opacity is driven by the SAME `draw` (0–100) MotionValue that powers
// the reader, curve, playhead and clip — no second useScroll. As the visitor scrubs
// through the active beat's band, words light dim→lit left-to-right (off-main-thread
// opacity only). The text stays one natural reading order for AT; the sr-only BEATS
// list in <ScrollStory> is the canonical narrative for screen readers, so the live
// words are aria-hidden to avoid a stuttering double-read on partial reveal.
function TextRevealWords({
  text,
  draw,
  band,
  className,
  style,
}: {
  text: string;
  draw: MotionValue<number>;
  band: [number, number];
  className?: string;
  style?: CSSProperties;
}) {
  const words = text.split(" ");
  // Reveal across the FIRST ~62% of the beat band so the caption is fully lit a
  // beat before the band ends (the reader/curve keep moving for the remainder).
  const [bStart, bEnd] = band;
  const revealEnd = bStart + (bEnd - bStart) * 0.62;
  const span = Math.max(revealEnd - bStart, 1e-3);
  // Each word lights over a short window; windows overlap (0.55× step) for a smooth
  // rolling sweep rather than a hard one-at-a-time cut.
  const step = words.length > 1 ? span / words.length : span;
  const win = step * 1.8;
  return (
    <p className={className} style={style} aria-hidden>
      {words.map((w, i) => {
        const lo = bStart + i * step;
        const hi = lo + win;
        return (
          <WordSpan key={`${w}-${i}`} draw={draw} lo={lo} hi={hi}>
            {w}
          </WordSpan>
        );
      })}
    </p>
  );
}
function WordSpan({
  draw,
  lo,
  hi,
  children,
}: {
  draw: MotionValue<number>;
  lo: number;
  hi: number;
  children: string;
}) {
  const opacity = useTransform(draw, [lo, hi], [0.22, 1], { clamp: true });
  return (
    <>
      <m.span style={{ opacity, willChange: "opacity" }}>{children}</m.span>{" "}
    </>
  );
}

function BeatCopy({
  beat,
  draw,
  beatIndex,
}: {
  beat: Beat;
  draw: MotionValue<number>;
  beatIndex: number;
}) {
  // Active beat's scroll-progress band → draw (0–100) scale, so the per-word reveal
  // runs on the exact range the playhead crosses this beat.
  const [pLo, pHi] = BEAT_EDGES[beatIndex];
  const band: [number, number] = [drawOf(pLo), drawOf(pHi)];
  return (
    <div className="relative" style={{ minHeight: "12.5rem" }}>
      <AnimatePresence mode="wait">
        <m.div
          key={beat.kicker}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: DUR.normal, ease: EASE.standard }}
        >
          <p className="cf-folio" style={{ color: "var(--accent-cyan)" }}>
            {beat.kicker}
          </p>
          <h3
            className="mt-3 font-bold leading-[1.08]"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.6rem, 2.4vw, 2.3rem)",
              letterSpacing: "-0.03em",
              color: "var(--text-heading)",
            }}
          >
            {beat.headline}
          </h3>
          <TextRevealWords
            text={beat.body}
            draw={draw}
            band={band}
            className="mt-3 max-w-[46ch] text-[14.5px] leading-[1.6]"
            style={{ color: "var(--text-secondary)" }}
          />
          <p className="cf-folio mt-3">{beat.cite}</p>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

const SECTION_INTRO = "How the science works · The retention engine";

/* ---- phase progress rail (the loop-node motif) ----------------------------- */
const PHASE_LABELS: { phase: ChapterTab; label: string }[] = [
  { phase: "summary", label: "Read" },
  { phase: "examples", label: "See" },
  { phase: "quiz", label: "Prove" },
  { phase: "practice", label: "Keep" },
];
// Four-segment phase rail: each segment fills cyan as its phase is reached, so the
// loop's four stages read as a calibrated progress bar, not just a label row.
function PhaseRail({ active }: { active: number }) {
  return (
    <div className="flex items-stretch gap-1.5" aria-hidden>
      {PHASE_LABELS.map((p, i) => {
        const reached = i <= active;
        const current = i === active;
        return (
          <div key={p.phase} className="flex min-w-[3.25rem] flex-col gap-1.5">
            <span
              className="h-[3px] w-full rounded-full transition-colors duration-300"
              style={{
                background: reached ? "var(--accent-cyan)" : "var(--cf-grid-line)",
                opacity: reached ? (current ? 1 : 0.55) : 1,
              }}
            />
            <span
              className="cf-folio leading-none transition-colors duration-300"
              style={{
                color: current
                  ? "var(--accent-cyan)"
                  : reached
                    ? "var(--text-secondary)"
                    : "var(--text-tertiary)",
              }}
            >
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- static fallback (reduced-motion + touch) ------------------------------ */
function StaticStack() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-16">
      <p className="cf-folio" style={{ color: "var(--accent-cyan)" }}>{SECTION_INTRO}</p>
      <h2
        className="mt-3 font-bold leading-[1.08]"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 7vw, 2.75rem)",
          letterSpacing: "-0.03em",
          color: "var(--text-heading)",
        }}
      >
        Read it. Prove it. Keep it.
      </h2>
      <p className="mt-4 max-w-[52ch] text-[15px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        Every chapter runs the same loop — and the loop is built on the memory
        science below.
      </p>

      {/* Controlled + autoPlay=false → the reader's isControlled branch disables
          its inner overflow scroll, so PAGE scroll is the only scroll on touch
          (no nested-scroll trap) and no phase auto-cycles under the user's thumb. */}
      {/* min-height matches ReaderConsoleSkeleton (540) so the lazy skeleton→reader
          swap reserves space and CLS stays 0 on the calm static fallback path. */}
      <div className="mt-8 overflow-hidden rounded-2xl" style={{ minHeight: 540, border: "1px solid var(--cf-console-rim)", boxShadow: "var(--shadow-hero)" }}>
        <DesktopReaderShell controlledPhase="summary" autoPlay={false} />
      </div>

      <div
        className="mt-8 rounded-2xl border p-4"
        style={{ background: "var(--bg-glass)", borderColor: "var(--border-subtle)" }}
      >
        <RetentionChart clip="inset(0 0 0 0)" playheadX={0} isStatic />
      </div>
      <ol className="mt-8 flex flex-col gap-6">
        {BEATS.map((b) => (
          <li key={b.kicker}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="cf-folio" style={{ color: "var(--accent-cyan)" }}>{b.kicker}</p>
              {b.phase === "quiz" && (
                <span className="cf-folio" style={{ color: "var(--accent-cyan)" }}>
                  · ACTIVE RECALL — unlock
                </span>
              )}
            </div>
            <h3 className="mt-1.5 text-[18px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}>
              {b.headline}
            </h3>
            <p className="mt-1.5 text-[14px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>{b.body}</p>
            <p className="cf-folio mt-2">{b.cite}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---- pinned, scroll-scrubbed stage ----------------------------------------- */
function PinnedStage({
  clip,
  playheadX,
  playheadY,
  retained,
  readoutChip,
  draw,
  beatIndex,
}: {
  clip: MotionValue<string>;
  playheadX: MotionValue<number>;
  playheadY: MotionValue<number>;
  retained: MotionValue<string>;
  readoutChip: MotionValue<string>;
  draw: MotionValue<number>;
  beatIndex: number;
}) {
  const beat = BEATS[beatIndex];
  // ACTIVE RECALL — unlock: at the quiz beat, retrieval snaps recall back up and
  // passing is the gate. We flip the readout LABEL only (never the number — the
  // number stays bound to the playhead's line height, preserving the invariant).
  const isRecall = beatIndex === 2;
  return (
    <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
      <div className="mx-auto w-full max-w-[1320px] px-8">
        {/* header rail — SECTION_INTRO is the section's real <h2> (heading
            hierarchy: Hero <h1> → this <h2> → per-beat <h3>), visually styled as
            the folio so it reads as a running head, not a banner heading. */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="cf-folio" style={{ color: "var(--text-tertiary)" }}>{SECTION_INTRO}</h2>
          <PhaseRail active={beatIndex} />
        </div>

        <div
          className="grid w-full items-center gap-10"
          style={{ gridTemplateColumns: "minmax(0, 46fr) minmax(0, 54fr)" }}
        >
          {/* LEFT — the real reader, scroll-walked through its phases. Fixed-height
              console window (overflow clipped) so it reads as a live screen showing
              the top of each phase, not a floating card bleeding off the stage. */}
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              height: "min(560px, 70svh)",
              border: "1px solid var(--cf-console-rim)",
              boxShadow: "var(--shadow-hero)",
            }}
          >
            <DesktopReaderShell controlledPhase={beat.phase} autoPlay={false} />
          </div>

          {/* RIGHT — the engine */}
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p
                  className="leading-none"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "clamp(2.6rem, 4.4vw, 3.6rem)",
                    fontWeight: 700,
                    color: "var(--cf-engine-readout)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span style={{ color: "var(--text-tertiary)" }}>R = </span>
                  <m.span>{retained}</m.span>
                </p>
                <p
                  className="cf-folio mt-1 transition-colors duration-200"
                  style={{ color: isRecall ? "var(--accent-cyan)" : "var(--text-tertiary)" }}
                >
                  {isRecall ? "ACTIVE RECALL — unlock" : "recall, with review · FSRS target 90%"}
                </p>
              </div>
            </div>

            {/* instrument bezel: mono spec stamp + the calibrated chart. Depth
                comes from a FLAT surface fill + hairline rule (matching the
                Ledger/Science panels), NOT backdrop-blur glass — the Field Manual
                direction rejects glassmorphism. */}
            <div
              className="mt-4 rounded-2xl border"
              style={{
                background: "var(--cf-surface)",
                borderColor: "var(--cf-console-rim)",
                boxShadow: "var(--shadow-elevated)",
              }}
            >
              <div
                className="flex items-center justify-between gap-3 border-b px-5 py-2.5"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span className="cf-folio" style={{ color: "var(--cf-axis-tint)" }}>
                  RETENTION INSTRUMENT · R(t) = 1 ⁄ (1 + t ⁄ 9S)
                </span>
                <span className="cf-folio" style={{ color: "var(--cf-axis-tint)" }}>
                  CALIBRATED
                </span>
              </div>
              <div className="p-5">
                <RetentionChart
                  clip={clip}
                  playheadX={playheadX}
                  playheadY={playheadY}
                  readout={readoutChip}
                  isStatic={false}
                />
              </div>
            </div>

            <div className="mt-5">
              <BeatCopy beat={beat} draw={draw} beatIndex={beatIndex} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScrollStory() {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  const desktop = useDesktopFinePointer();
  const isStatic = !mounted || reduced || !desktop;

  const outerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: [...SCROLL_OFFSET.pinnedSection],
  });
  const smooth = useSpring(scrollYProgress, SPRING.progress);
  const draw = useTransform(smooth, [0.06, 0.94], [0, 100], { clamp: true });
  const rightInset = useTransform(draw, (v) => 100 - v);
  const clip = useMotionTemplate`inset(0% ${rightInset}% 0% 0%)`;
  const playheadX = useTransform(draw, (v) => X0 + (v / 100) * (X1 - X0));
  // The playhead dot/chip y-pixel — same withRecall geometry as the printed value,
  // so the chip provably rides the cyan line (readout == line height at playhead).
  const playheadY = useTransform(draw, (v) => playheadYOf((v / 100) * T_MAX));
  // Readout = the with-review recall AT the playhead, so the number can never
  // disagree with the cyan line beside it (100% fresh → holding near the 90% floor).
  const retained = useTransform(draw, (v) => `${withRecallPct((v / 100) * T_MAX)}%`);
  // The in-chart playhead chip prints the SAME value as the big readout, prefixed.
  const readoutChip = useTransform(draw, (v) => `R = ${withRecallPct((v / 100) * T_MAX)}%`);

  const [beatIndex, setBeatIndex] = useState(0);
  // Drive the reader phase off the SAME spring-smoothed value the chart playhead
  // uses (not raw scrollYProgress), so the left reader phase and the right curve
  // scrub advance together instead of the phase leading the lagging curve.
  useMotionValueEvent(smooth, "change", (p) => {
    if (isStatic) return;
    const next = beatFor(p);
    setBeatIndex((prev) => (prev === next ? prev : next));
  });

  return (
    <section
      ref={outerRef}
      id="retention-engine"
      aria-label="Operate the loop: read, prove, keep — and the forgetting, recall, and spaced-repetition science behind it"
      // The .cf-pin-track 420svh height applies ONLY when the pinned stage
      // actually renders (!isStatic). Pre-hydration / reduced-motion / non-desktop
      // render the compact StaticStack, so applying the tall track unconditionally
      // (the CSS media query fires before JS) left a large empty scroll gap.
      className={isStatic ? "relative" : "cf-pin-track relative"}
    >
      {/* sr-only narrative for assistive tech regardless of mode */}
      <ol className="sr-only">
        {BEATS.map((b) => (
          <li key={b.kicker}>{b.headline} {b.body} {b.cite}</li>
        ))}
      </ol>
      {isStatic ? (
        <StaticStack />
      ) : (
        <PinnedStage
          clip={clip}
          playheadX={playheadX}
          playheadY={playheadY}
          retained={retained}
          readoutChip={readoutChip}
          draw={draw}
          beatIndex={beatIndex}
        />
      )}
    </section>
  );
}
