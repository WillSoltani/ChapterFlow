"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  m,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useMotionTemplate,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { DUR, EASE, SPRING, SCROLL_OFFSET } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { DesktopReaderShell } from "@/components/landing/reader-demo/DesktopReaderShell";
import type { ChapterTab } from "@/app/book/library/[bookId]/chapter/[chapterId]/hooks/useChapterState";
import { ORDER, phaseForProgress } from "./retention-loop-phase";

const BEATS: Record<
  ChapterTab,
  { index: string; label: string; headline: string; line: string }
> = {
  summary: {
    index: "01",
    label: "Read",
    headline: "Read the idea, once.",
    line: "A tight, structured summary — the chapter's argument distilled to what's worth keeping.",
  },
  examples: {
    index: "02",
    label: "Apply",
    headline: "See it in the world.",
    line: "Worked examples turn the idea concrete, so it has somewhere to live in your memory.",
  },
  quiz: {
    index: "03",
    label: "Prove",
    headline: "Recall beats rereading.",
    line: "A short quiz pulls the idea back out. Retrieval is what makes it stick — not another pass.",
  },
  practice: {
    index: "04",
    label: "Unlock",
    headline: "Lock it in, move on.",
    line: "Pass the check and the next chapter opens. One loop done, the retention gap closed.",
  },
};

/* ------------------------------------------------------------------ */
/*  Forgetting-curve paths (reused shapes; viewBox 0 0 600 300,        */
/*  y=20 → 100% retention, y=240 → 0%)                                 */
/* ------------------------------------------------------------------ */

const RED_D =
  "M 0,20 C 60,40 100,120 160,170 C 220,210 300,230 400,236 C 480,239 540,240 580,240";
const TEAL_D =
  "M 0,20 C 20,20 40,22 70,42 C 85,28 100,24 130,26 C 160,28 195,48 220,55 C 240,38 260,34 300,36 C 340,38 395,52 420,58 C 445,44 465,42 520,48 C 550,50 570,55 580,60";
// Closed gap-fill: TEAL L→R, down the right edge to the red line, RED reversed R→L, close.
const GAP_FILL_D =
  "M 0,20 C 20,20 40,22 70,42 C 85,28 100,24 130,26 C 160,28 195,48 220,55 " +
  "C 240,38 260,34 300,36 C 340,38 395,52 420,58 C 445,44 465,42 520,48 C 550,50 570,55 580,60 " +
  "L 580,240 " +
  "C 540,240 480,239 400,236 C 300,230 220,210 160,170 C 100,120 60,40 0,20 Z";

const STATIONS: { phase: ChapterTab; x: number; y: number }[] = [
  { phase: "summary", x: 70, y: 42 },
  { phase: "examples", x: 220, y: 55 },
  { phase: "quiz", x: 420, y: 58 },
  { phase: "practice", x: 520, y: 48 },
];

/* ------------------------------------------------------------------ */
/*  Client-only signals (hydration-safe: server snapshot = false →     */
/*  SSR + first paint render the STATIC fallback)                      */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const DESKTOP_QUERY = "(min-width: 1024px) and (pointer: fine)";
function useDesktopFinePointer(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false, // server → STATIC (no pin)
  );
}

/* ------------------------------------------------------------------ */
/*  Forgetting curve (gap-fill clip-revealed when pinned, full static) */
/* ------------------------------------------------------------------ */

function ForgettingCurve({
  phase,
  clip,
  isStatic,
}: {
  phase: ChapterTab;
  clip: MotionValue<string> | string;
  isStatic: boolean;
}) {
  return (
    <svg
      viewBox="0 0 600 300"
      role="img"
      aria-label="Retention over time. Without active recall, memory decays steeply. With the ChapterFlow loop's active recall, retention stays high. The teal area between the two lines — the retention you would otherwise lose — fills in as you complete each loop."
      className="w-full h-auto"
      style={{ maxHeight: 180 }}
    >
      <defs>
        {/* Token-only gradient via stopColor var() + stopOpacity (broad SVG support). */}
        <linearGradient id="cf-gap-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cf-anchor-accent)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--cf-anchor-accent)" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* Gap fill — revealed left→right by the scroll-driven clip (static: full) */}
      <m.path d={GAP_FILL_D} fill="url(#cf-gap-fill)" style={{ clipPath: clip }} />

      {/* Red decay — the muted boundary (what you lose) */}
      <path
        d={RED_D}
        fill="none"
        stroke="var(--cf-anchor-text-muted)"
        strokeOpacity="0.55"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="2 7"
      />

      {/* Teal hold — the glowing boundary (what you keep) */}
      <path
        d={TEAL_D}
        fill="none"
        stroke="var(--cf-anchor-accent-strong)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter:
            "drop-shadow(0 0 6px color-mix(in srgb, var(--cf-anchor-accent) 40%, transparent))",
        }}
      />

      {/* Stations on the teal line — lit by the active phase (static: all lit) */}
      {STATIONS.map((s) => {
        const lit = isStatic || s.phase === phase;
        return (
          <circle
            key={s.phase}
            cx={s.x}
            cy={s.y}
            r={lit ? 5.5 : 4}
            fill={lit ? "var(--cf-anchor-accent-strong)" : "var(--cf-anchor-bg)"}
            stroke="var(--cf-anchor-accent)"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

function CurvePanel({
  phase,
  clip,
  isStatic,
}: {
  phase: ChapterTab;
  clip: MotionValue<string> | string;
  isStatic: boolean;
}) {
  return (
    <figure
      className="rounded-2xl border p-4"
      style={{
        background: "var(--cf-anchor-surface-strong)",
        borderColor: "var(--cf-anchor-border)",
        backdropFilter: "blur(12px) saturate(120%)",
        WebkitBackdropFilter: "blur(12px) saturate(120%)",
      }}
    >
      <figcaption className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-(--cf-anchor-text-muted)">
        <span>Retention</span>
        <span>The gap the loop closes</span>
      </figcaption>
      <ForgettingCurve phase={phase} clip={clip} isStatic={isStatic} />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Loop rail (4 nodes + scroll-filling connector)                     */
/* ------------------------------------------------------------------ */

function LoopRail({
  phase,
  fill,
}: {
  phase: ChapterTab;
  /** MotionValue 0..1 (pinned) or a static number (fallback). */
  fill: MotionValue<number> | number;
}) {
  const activeIndex = ORDER.indexOf(phase);
  return (
    <div className="flex items-center gap-3">
      {/* track + scroll-filled progress */}
      <div
        className="relative h-[2px] flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--cf-anchor-border)" }}
        aria-hidden
      >
        <m.div
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
          style={{ background: "var(--cf-anchor-accent)", scaleX: fill }}
        />
      </div>
      <ol className="flex shrink-0 items-center gap-2">
        {ORDER.map((p, i) => {
          const done = i <= activeIndex;
          return (
            <li
              key={p}
              className="text-[11px] font-semibold tracking-wide transition-colors"
              style={{
                color: done
                  ? "var(--cf-anchor-accent)"
                  : "var(--cf-anchor-text-muted)",
              }}
            >
              {BEATS[p].label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Beat narrative (cross-fades on phase; height reserved → no reflow) */
/* ------------------------------------------------------------------ */

function BeatNarrative({ phase }: { phase: ChapterTab }) {
  const beat = BEATS[phase];
  return (
    <div className="relative" style={{ minHeight: "9.5rem" }}>
      <AnimatePresence mode="wait">
        <m.div
          key={phase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: DUR.normal, ease: EASE.standard }}
        >
          <span className="text-xs font-semibold tracking-[0.16em] uppercase text-(--cf-anchor-accent)">
            {beat.index} · {beat.label}
          </span>
          <h3
            className="mt-2 font-bold leading-[1.08] text-(--cf-anchor-text)"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.9rem, 3.2vw, 3rem)",
              letterSpacing: "-0.02em",
            }}
          >
            {beat.headline}
          </h3>
          <p
            className="mt-3 max-w-[42ch] text-[15px] leading-[1.6] text-(--cf-anchor-text-muted)"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {beat.line}
          </p>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Aurora (decorative, token-only)                                    */
/* ------------------------------------------------------------------ */

function Aurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(60% 50% at 68% 42%, color-mix(in srgb, var(--cf-anchor-accent) 20%, transparent) 0%, color-mix(in srgb, var(--cf-anchor-accent) 7%, transparent) 38%, transparent 72%)",
        filter: "blur(48px)",
      }}
    />
  );
}

const EYEBROW = "Backed by memory science";

/* ------------------------------------------------------------------ */
/*  Static fallback (mobile + reduced motion): un-pinned, all 4 beats  */
/*  visible, curve fully filled (string clip, NOT a MotionValue)       */
/* ------------------------------------------------------------------ */

function StaticStack() {
  return (
    <div className="relative mx-auto flex max-w-[600px] flex-col gap-10 px-5 py-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-anchor-text-muted)">
          {EYEBROW}
        </p>
        <h2
          className="mt-3 font-bold leading-[1.1] text-(--cf-anchor-text)"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 7vw, 2.75rem)",
            letterSpacing: "-0.02em",
          }}
        >
          The loop is what makes it stick.
        </h2>
      </header>

      <ol className="flex flex-col gap-4">
        {ORDER.map((p) => (
          <li
            key={p}
            className="rounded-2xl border p-5"
            style={{
              background: "var(--cf-anchor-surface-strong)",
              borderColor: "var(--cf-anchor-border)",
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-anchor-accent)">
              {BEATS[p].index} · {BEATS[p].label}
            </span>
            <h3
              className="mt-1.5 text-lg font-bold text-(--cf-anchor-text)"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {BEATS[p].headline}
            </h3>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-(--cf-anchor-text-muted)">
              {BEATS[p].line}
            </p>
          </li>
        ))}
      </ol>

      <CurvePanel phase="practice" clip="inset(0% 0% 0% 0%)" isStatic />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pinned stage (desktop + motion)                                    */
/* ------------------------------------------------------------------ */

function PinnedStage({
  phase,
  fill,
  clip,
}: {
  phase: ChapterTab;
  fill: MotionValue<number>;
  clip: MotionValue<string>;
}) {
  return (
    <div className="sticky top-0 overflow-hidden" style={{ height: "100svh" }}>
      <Aurora />
      <div
        className="mx-auto grid h-full max-w-[1280px] items-center"
        style={{
          gridTemplateColumns: "minmax(0, 46fr) minmax(0, 54fr)",
          gap: "clamp(2rem, 5vw, 5rem)",
          paddingBlock: "clamp(3rem, 8vh, 6rem)",
          paddingInline: "clamp(1.5rem, 5vw, 4rem)",
        }}
      >
        {/* LEFT — story + proof */}
        <div className="flex flex-col" style={{ gap: "clamp(1.5rem, 4vh, 2.5rem)" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-anchor-text-muted)">
            {EYEBROW}
          </p>
          <BeatNarrative phase={phase} />
          <LoopRail phase={phase} fill={fill} />
          <CurvePanel phase={phase} clip={clip} isStatic={false} />
        </div>

        {/* RIGHT — the real product, scrubbed by scroll */}
        <figure
          className="relative w-full"
          style={{
            maxHeight: "min(720px, 78svh)",
            boxShadow: "var(--cf-anchor-shadow)",
            borderRadius: "1rem",
          }}
        >
          <DesktopReaderShell controlledPhase={phase} autoPlay={false} />
          <figcaption className="sr-only">
            Product preview of the ChapterFlow reader cycling through Read, Apply, Prove, and Unlock as you scroll.
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

export function RetentionLoopSection() {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  const desktop = useDesktopFinePointer();
  // STATIC until mounted; then static under reduced motion OR on a non-desktop /
  // touch viewport. (SSR + first paint are always static → hydration-safe.)
  const isStatic = !mounted || reduced || !desktop;

  // Hooks called unconditionally (rules of hooks); only meaningful when pinned.
  const outerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: [...SCROLL_OFFSET.pinnedSection],
  });
  const smooth = useSpring(scrollYProgress, SPRING.progress);

  // Continuous gap-fill: 0→100% across the middle of the scroll, revealed L→R.
  const fillPct = useTransform(smooth, [0.05, 0.95], [0, 100], { clamp: true });
  const rightInset = useTransform(fillPct, (v) => 100 - v);
  const clip = useMotionTemplate`inset(0% ${rightInset}% 0% 0%)`;
  // Rail connector wants a 0..1 scaleX.
  const railFill = useTransform(fillPct, (v) => v / 100);

  // Discrete phase: update React state ONLY on a band crossing (≤3 renders total).
  const [phase, setPhase] = useState<ChapterTab>("summary");
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (isStatic) return; // never drive phase in static mode
    const next = phaseForProgress(p);
    setPhase((prev) => (prev === next ? prev : next));
  });

  return (
    <section
      ref={outerRef}
      id="retention-loop"
      aria-label="How the retention loop works: read, apply, prove, unlock"
      className="relative isolate"
      style={{
        background: "var(--cf-anchor-bg)",
        // Height reserved on the same flag → no CLS; below the fold → swap unseen.
        height: isStatic ? "auto" : "300svh",
      }}
    >
      {/* sr-only full content so assistive tech gets every beat regardless of mode */}
      <ol className="sr-only">
        {ORDER.map((p) => (
          <li key={p}>
            {BEATS[p].label}: {BEATS[p].headline} {BEATS[p].line}
          </li>
        ))}
      </ol>

      {isStatic ? (
        <StaticStack />
      ) : (
        <PinnedStage phase={phase} fill={railFill} clip={clip} />
      )}
    </section>
  );
}
