"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useSyncExternalStore } from "react";
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

/* ---- curve geometry (pure, deterministic) ---------------------------------- */
const T_MAX = 36; // days
const X0 = 60;
const X1 = 624;
const Y_TOP = 34; // 100% retention
const Y_BOT = 286; // 0% retention
const xOf = (t: number) => X0 + (t / T_MAX) * (X1 - X0);
const yOf = (r: number) => Y_TOP + (1 - r) * (Y_BOT - Y_TOP);
const Rf = (t: number, s: number) => 1 / (1 + t / (9 * s)); // R(S) = 0.9 exactly

// Spaced reviews: stability grows each time, so each interval ends right at R=0.9.
const REVIEWS = [
  { t: 0, s: 1 },
  { t: 1, s: 3 },
  { t: 4, s: 8 },
  { t: 12, s: 21 },
];

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
// With-ChapterFlow recall at day t (the cyan saw-tooth's value): find the active
// review interval, then evaluate the same Rf the curve is drawn from — so the big
// readout ALWAYS agrees with the line height at the playhead (never a number that
// contradicts the chart). Sits in [~0.89, 1.0]: 100% fresh, holding near the 90%
// FSRS floor between reviews.
function withRecallPct(t: number): number {
  let iv = REVIEWS[0];
  for (const r of REVIEWS) if (t >= r.t) iv = r;
  return Math.round(Rf(t - iv.t, iv.s) * 100);
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
    body: "Each idea comes back on a widening schedule set by FSRS — the algorithm behind Anki. Retention holds above 90%. That shaded gap is everything you'd have lost.",
    cite: "FSRS · Anki 23.10 · R(t) = 1 / (1 + t ⁄ 9S)",
  },
];
// Upper bound of each beat by scroll progress (also drives the reader's phase).
const BEAT_BANDS = [0.27, 0.5, 0.78, Infinity];
function beatFor(p: number): number {
  for (let i = 0; i < BEAT_BANDS.length; i++) if (p < BEAT_BANDS[i]) return i;
  return BEAT_BANDS.length - 1;
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
  isStatic,
}: {
  clip: string | MotionValue<string>;
  playheadX: number | MotionValue<number>;
  isStatic: boolean;
}) {
  return (
    <svg
      viewBox="0 0 640 320"
      role="img"
      aria-label="Recall probability over time. Without review, memory decays steeply toward zero. With ChapterFlow, a quiz snaps recall back to 100% and spaced reviews keep it above 90%. The shaded area between the two lines is the retention otherwise lost."
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id="cf-engine-gain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* gridlines + y labels (static) */}
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
          <text
            x={X0 - 10}
            y={yOf(g.r) + 4}
            textAnchor="end"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fill={g.hot ? "var(--accent-cyan)" : "var(--text-tertiary)"}
          >
            {g.label}
          </text>
        </g>
      ))}
      {/* x ticks */}
      {XTICKS.map((x) => (
        <text
          key={x.label}
          x={xOf(x.t)}
          y={Y_BOT + 20}
          textAnchor="middle"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fill="var(--text-tertiary)"
        >
          {x.label}
        </text>
      ))}

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

      {/* scrubbing playhead (motion only) */}
      {!isStatic && (
        <m.line
          x1={playheadX}
          x2={playheadX}
          y1={Y_TOP - 6}
          y2={Y_BOT + 6}
          stroke="var(--accent-cyan)"
          strokeOpacity="0.35"
          strokeWidth={1.5}
        />
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

function BeatCopy({ beat }: { beat: Beat }) {
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
          <p className="mt-3 max-w-[46ch] text-[14.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
            {beat.body}
          </p>
          <p className="cf-folio mt-3">{beat.cite}</p>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

function Aurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(60% 55% at 72% 42%, color-mix(in srgb, var(--accent-cyan) 15%, transparent) 0%, color-mix(in srgb, var(--accent-cyan) 5%, transparent) 38%, transparent 74%)",
        filter: "blur(46px)",
      }}
    />
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
function PhaseRail({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {PHASE_LABELS.map((p, i) => {
        const on = i <= active;
        return (
          <div key={p.phase} className="flex items-center gap-2">
            <span
              className="cf-folio transition-colors duration-300"
              style={{ color: i === active ? "var(--accent-cyan)" : on ? "var(--text-secondary)" : "var(--text-tertiary)" }}
            >
              {p.label}
            </span>
            {i < PHASE_LABELS.length - 1 && (
              <span
                className="h-px w-6 transition-colors duration-300"
                style={{ background: on ? "var(--accent-cyan)" : "var(--cf-grid-line)" }}
              />
            )}
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
      <div className="mt-8 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--cf-console-rim)", boxShadow: "var(--shadow-hero)" }}>
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
            <p className="cf-folio" style={{ color: "var(--accent-cyan)" }}>{b.kicker}</p>
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
  retained,
  beatIndex,
}: {
  clip: MotionValue<string>;
  playheadX: MotionValue<number>;
  retained: MotionValue<string>;
  beatIndex: number;
}) {
  const beat = BEATS[beatIndex];
  return (
    <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
      <Aurora />
      <div className="mx-auto w-full max-w-[1320px] px-8">
        {/* header rail */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="cf-folio" style={{ color: "var(--text-tertiary)" }}>{SECTION_INTRO}</p>
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
                <m.p
                  className="leading-none"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "clamp(2.6rem, 4.4vw, 3.6rem)",
                    fontWeight: 700,
                    color: "var(--cf-engine-readout)",
                  }}
                >
                  {retained}
                </m.p>
                <p className="cf-folio mt-1">recall, with review · FSRS target 90%</p>
              </div>
            </div>

            <div
              className="mt-4 rounded-2xl border p-5"
              style={{
                background: "color-mix(in srgb, var(--cf-surface) 55%, transparent)",
                borderColor: "var(--border-subtle)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "var(--shadow-elevated)",
              }}
            >
              <RetentionChart clip={clip} playheadX={playheadX} isStatic={false} />
            </div>

            <div className="mt-5">
              <BeatCopy beat={beat} />
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
  // Readout = the with-review recall AT the playhead, so the number can never
  // disagree with the cyan line beside it (100% fresh → holding near the 90% floor).
  const retained = useTransform(draw, (v) => `${withRecallPct((v / 100) * T_MAX)}%`);

  const [beatIndex, setBeatIndex] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (isStatic) return;
    const next = beatFor(p);
    setBeatIndex((prev) => (prev === next ? prev : next));
  });

  return (
    <section
      ref={outerRef}
      id="retention-engine"
      aria-label="Operate the loop: read, prove, keep — and the forgetting, recall, and spaced-repetition science behind it"
      // Height is CSS-media-query driven (.cf-pin-track) to match isStatic from
      // first paint — no auto→420svh post-hydration jump on desktop.
      className="cf-pin-track relative"
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
        <PinnedStage clip={clip} playheadX={playheadX} retained={retained} beatIndex={beatIndex} />
      )}
    </section>
  );
}
