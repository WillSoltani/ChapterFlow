"use client";

/**
 * RecallHeroSplit — the canonical RECALL hero (centered "editorial instrument").
 *
 * An oversized, bold headline ("Stop forgetting what you read.") sits centered
 * above the retention curve, which is rendered as a real, crafted instrument
 * readout on a lit "product plate" — Apple product-shot energy, where the chart
 * is the hero object. The headline's "forgetting" is a canvas DissolveWord that
 * literally blows apart and re-assembles; the rest of the line carries a slow
 * periwinkle sheen. Beneath: a specs row (derived catalog stats), then the chart
 * showcase.
 *
 * The chart is a crafted data-viz instrument (ONS axis conventions):
 *   • value (retention) axis carries faint GRIDLINES + % labels
 *   • time axis carries TICK MARKS + day labels (no vertical gridlines)
 *   • the four REAL FSRS review events (days 0·1·4·12) plot as data-point markers
 *   • the band BETWEEN the two lines is shaded — that gap is the whole product
 *   • a PLAYHEAD sweeps the timeline once (hover to scrub it), with a
 *     DAY chip, a dot riding each line, and live % readouts
 *
 * Materiality: the plate carries a top-left specular sheen, an edge vignette, a
 * whisper of film grain, a static HUD ("FIG.01 · RETENTION" + "FSRS-5 model"),
 * corner ticks, a one-time scan sweep, and a reflection. The
 * whole hero responds to the pointer with a subtle 3D tilt + parallax (driven by
 * --rl-px/--rl-py CSS vars set on a ref).
 *
 * Token-only color (the ONE periwinkle accent). Shape from the product's REAL
 * FSRS math (curve-geometry.ts). prefers-reduced-motion (OS or in-app) renders
 * the final lit state statically: no canvas, no parallax, no auto-sweep, no scan.
 * Client component (canvas + rAF + pointer + matchMedia).
 */

import { useEffect, useRef } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { FREE_OFFER_LABEL } from "@/lib/pricing";
import {
  CATALOG_BOOK_COUNT,
  CATALOG_MEDIAN_CHAPTER_MINUTES,
} from "@/lib/catalog-stats";
import {
  buildCurveGeometry,
  lockedRecall,
  Rf,
  T_MAX,
  type CurveGeometry,
} from "./curve-geometry";
import { DissolveWord } from "./DissolveWord";

// A landscape "product plate" viewBox — the chart is framed and centered within
// it, with comfortable gutters for the axis labels and the connected readout.
const VB_W = 780;
const VB_H = 560;
const G = buildCurveGeometry({
  vbW: VB_W,
  vbH: VB_H,
  padL: 58,
  padR: 92,
  padT: 64,
  padB: 70,
  rMin: 0.12,
});

/** Crisp 1px rendering for straight rules: snap to a half-pixel grid. */
const px = (n: number): number => Math.round(n) + 0.5;

export function RecallHeroSplit() {
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);

  // Mouse parallax + 3D tilt: pointer movement within the hero sets --rl-px / --rl-py
  // (normalized -0.5..0.5) on the head + showcase wrappers; CSS turns those into
  // a small translate on the head and a translate + rotateX/rotateY on the plate.
  // Reduced motion no-ops entirely (vars stay 0 → the static, untilted state).
  useEffect(() => {
    if (reduced) {
      headRef.current?.style.removeProperty("--rl-px");
      headRef.current?.style.removeProperty("--rl-py");
      showcaseRef.current?.style.removeProperty("--rl-px");
      showcaseRef.current?.style.removeProperty("--rl-py");
      return;
    }
    // Parallax + 3D tilt is a fine-pointer (mouse) affordance only. On touch
    // devices `pointermove` fires continuously through every scroll/drag, which
    // recomputes the tilt for no benefit (jank + battery). Skip coarse pointers.
    if (
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }
    let raf = 0;
    let px2 = 0;
    let py2 = 0;
    const apply = () => {
      raf = 0;
      const set = (el: HTMLElement | null) => {
        if (!el) return;
        el.style.setProperty("--rl-px", px2.toFixed(4));
        el.style.setProperty("--rl-py", py2.toFixed(4));
      };
      set(headRef.current);
      set(showcaseRef.current);
    };
    const section = sectionRef.current;
    if (!section) return;
    const onMove = (e: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      px2 = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
      py2 = Math.max(-0.5, Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5));
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const reset = () => {
      px2 = 0;
      py2 = 0;
      apply();
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    section.addEventListener("pointermove", onMove, { passive: true });
    section.addEventListener("pointerleave", reset, { passive: true });

    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="recall-split-headline"
      className="relative isolate flex min-h-[100svh] w-full flex-col items-center px-6 pb-20 pt-28 text-center sm:px-10 sm:pt-36 lg:px-16 lg:pt-44"
      style={{ background: "transparent" }}
    >
      {/* ── centered head: eyebrow → headline → sub → CTAs → specs ── */}
      <div ref={headRef} className="rl-hero-head relative z-[2] w-full max-w-[62rem]">
        <p
          className="cf-fade-up rl-hero-eyebrow font-(family-name:--font-mono)"
          style={{ animationDelay: "0ms" }}
        >
          For people who read to remember
        </p>

        <h1
          id="recall-split-headline"
          className="cf-fade-up mt-7 font-(family-name:--font-display) font-extrabold leading-[0.9] tracking-[-0.045em] text-balance"
          style={{
            color: "var(--cf-recall-ink)",
            // Lower the MIN only (keep 8vw + 7rem so tablet/desktop are
            // unchanged); at the old 3.25rem min, "Stop forgetting" couldn't fit
            // one line on phones, so the word wrapped/overflowed and the dust
            // canvas painted into the gap as a detached cloud.
            fontSize: "clamp(2.25rem, 8vw, 7rem)",
            animationDelay: "55ms",
          }}
        >
          Stop <DissolveWord text="forgetting" />{" "}
          <span className="rl-hero-sheen">what you read.</span>
        </h1>

        <p
          className="cf-fade-up mx-auto mt-7 max-w-[46ch] text-[1.25rem] leading-relaxed"
          style={{
            color: "var(--cf-recall-ink-soft)",
            animationDelay: "110ms",
          }}
        >
          ChapterFlow turns every book into a short guided loop — read it,
          recall it, and let spaced review bring the ideas back until
          they&apos;re yours for good.
        </p>

        <div
          className="cf-fade-up mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-7"
          style={{ animationDelay: "165ms" }}
        >
          <a
            href={AUTH_LOGIN_BOOK_URL}
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-[0.9375rem] font-semibold transition-[transform,filter,box-shadow] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "var(--cf-recall-accent)",
              color: "var(--cf-recall-bg)",
              boxShadow: "0 14px 40px -12px var(--cf-recall-glow)",
              // @ts-expect-error -- CSS custom property for the focus ring color
              "--tw-ring-color": "var(--cf-recall-accent)",
            }}
          >
            Start reading free
            <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex min-h-[44px] items-center gap-1 rounded text-[0.9375rem] font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              color: "var(--cf-recall-ink-soft)",
              // @ts-expect-error -- CSS custom property for the focus ring color
              "--tw-ring-color": "var(--cf-recall-accent-line)",
            }}
          >
            See how it works
            <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
          </a>
        </div>

        {/* risk-reversal microcopy — no card, free tier, free forever */}
        <p
          className="cf-fade-up mx-auto mt-4 text-[0.8125rem] font-(family-name:--font-mono)"
          style={{
            color: "var(--cf-recall-ink-faint)",
            animationDelay: "195ms",
          }}
        >
          No card needed · {FREE_OFFER_LABEL} · free forever
        </p>

        {/* specs row — derived catalog stats, not hardcoded */}
        <div
          className="cf-fade-up rl-hero-specs"
          style={{ animationDelay: "220ms" }}
        >
          <div className="rl-hero-spec">
            <span className="rl-hero-spec-num font-(family-name:--font-display)">
              {CATALOG_BOOK_COUNT}
            </span>
            <span className="rl-hero-spec-label font-(family-name:--font-mono)">
              books, all real
            </span>
          </div>
          <div className="rl-hero-spec">
            <span className="rl-hero-spec-num font-(family-name:--font-display)">
              {CATALOG_MEDIAN_CHAPTER_MINUTES} min
            </span>
            <span className="rl-hero-spec-label font-(family-name:--font-mono)">
              per chapter
            </span>
          </div>
          <div className="rl-hero-spec">
            <span className="rl-hero-spec-num font-(family-name:--font-display)">
              FSRS
            </span>
            <span className="rl-hero-spec-label font-(family-name:--font-mono)">
              spaced recall
            </span>
          </div>
        </div>
      </div>

      {/* ── chart showcase: the framed curve centerpiece (the hero object) ── */}
      <div
        ref={showcaseRef}
        className="cf-fade-up rl-hero-showcase"
        style={{ animationDelay: "300ms" }}
      >
        <div className="rl-plate-wrap">
          {/* ambient bloom seated behind the plate */}
          <div className="rl-plate-bloom" aria-hidden />

          {/* the plate — a lit, inset surface with one hairline frame */}
          <div className="rl-plate">
            <CinematicPlate G={G} reduced={reduced} />

            {/* HUD: figure tag (left) + static model label (right) */}
            <div className="rl-plate-hud font-(family-name:--font-mono)" aria-hidden>
              <span>FIG.01 · RETENTION</span>
              <span className="rl-plate-hud-live">
                <i />
                FSRS&#8209;5 model
              </span>
            </div>

            {/* corner ticks */}
            <div className="rl-plate-ticks" aria-hidden>
              <span className="rl-tick tl" />
              <span className="rl-tick tr" />
              <span className="rl-tick bl" />
              <span className="rl-tick br" />
            </div>

            {/* one-time scan sweep on first paint */}
            <div className="rl-plate-scan" aria-hidden />

            {/* material overlays — sheen, vignette, grain (pointer-events-none) */}
            <div className="rl-plate-sheen" aria-hidden />
            <div className="rl-plate-vig" aria-hidden />
            <svg className="rl-plate-grain" aria-hidden>
              <filter id="recall-grain">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.85"
                  numOctaves={2}
                  stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter="url(#recall-grain)" />
            </svg>
          </div>
        </div>
        {/* reflection beneath the plate */}
        <div className="rl-hero-reflection" aria-hidden />
      </div>
    </section>
  );
}

/* ── The crafted curve instrument, now LIVE. ─────────────────────────────────
   Layered back→front: gridlines + labels → baseline + ticks → shaded gap →
   decay line → lit line (draws on) → review dots → endpoint → playhead scrubber
   → legend → connected end readouts.

   The playhead auto-sweeps the timeline on a loop and can be scrubbed by hovering
   the SVG; it imperatively moves a vertical guide, a DAY chip, a dot riding each
   line, and the live % readouts (refs + setAttribute, so no per-frame React
   render). The authored entrance sweeps once and settles at the day-T_MAX
   endpoint; reduced motion renders that final state immediately. */
function CinematicPlate({
  G,
  reduced,
}: {
  G: CurveGeometry;
  reduced: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // playhead element refs (moved imperatively each frame)
  const phRef = useRef<SVGLineElement>(null);
  const gapRef = useRef<SVGLineElement>(null);
  const dayGRef = useRef<SVGGElement>(null);
  const dayTRef = useRef<SVGTextElement>(null);
  const dDotRef = useRef<SVGCircleElement>(null);
  const dTxtRef = useRef<SVGTextElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const rDotRef = useRef<SVGCircleElement>(null);
  const rTxtRef = useRef<SVGTextElement>(null);
  // scrub state (refs so the rAF loop reads them without re-subscribing)
  const hoverRef = useRef(false);
  const idleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const baseRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const tRef = useRef(0.08);
  // The single playhead-geometry writer, published by the effect so the
  // pointer-scrub handler (defined in the component body) reuses the EXACT same
  // DOM-write logic instead of duplicating it.
  const drawRef = useRef<(t: number) => void>(() => {});

  // Initial playhead position — ALWAYS the sweep start, so the SSR markup and the
  // client's first render are identical (no hydration mismatch). The effect below
  // then either runs the auto-sweep or, under reduced motion, pins it to T_MAX.
  const t0 = 0.08;
  const rT0 = Math.max(0, Math.min(1, lockedRecall(t0)));
  const dT0 = Math.max(0, Math.min(1, Rf(t0, 1)));
  const pX0 = G.xOf(t0);
  const rY0 = G.yOf(rT0);
  const dY0 = G.yOf(dT0);
  const dayCx0 = Math.max(G.x0 + 28, Math.min(G.x1 - 28, pX0));

  useEffect(() => {
    // Move the whole playhead group to time `t` (in days). Pure DOM writes.
    const draw = (t: number) => {
      const rT = Math.max(0, Math.min(1, lockedRecall(t)));
      const dT = Math.max(0, Math.min(1, Rf(t, 1)));
      const playX = G.xOf(t);
      const rY = G.yOf(rT);
      const dY = G.yOf(dT);
      const aPct = Math.round(rT * 100);
      const bPct = Math.round(dT * 100);
      const dayN = Math.round(t);
      // flip the % tags to the inside as the playhead nears the right edge
      const tagRight = playX < (G.x0 + G.x1) / 2;
      const tagDX = tagRight ? 13 : -13;
      const tagAnchor = tagRight ? "start" : "end";
      const dayCx = Math.max(G.x0 + 28, Math.min(G.x1 - 28, playX));

      const ph = phRef.current;
      if (ph) {
        ph.setAttribute("x1", String(playX));
        ph.setAttribute("x2", String(playX));
      }
      const gp = gapRef.current;
      if (gp) {
        gp.setAttribute("x1", String(playX));
        gp.setAttribute("x2", String(playX));
        gp.setAttribute("y1", String(rY));
        gp.setAttribute("y2", String(dY));
      }
      const dg = dayGRef.current;
      if (dg) dg.setAttribute("transform", `translate(${dayCx}, ${G.yTop - 12})`);
      const dtT = dayTRef.current;
      if (dtT) dtT.textContent = `DAY ${dayN}`;
      const dd = dDotRef.current;
      if (dd) {
        dd.setAttribute("cx", String(playX));
        dd.setAttribute("cy", String(dY));
      }
      const dtx = dTxtRef.current;
      if (dtx) {
        dtx.setAttribute("x", String(playX + tagDX));
        dtx.setAttribute("y", String(dY + 18));
        dtx.setAttribute("text-anchor", tagAnchor);
        dtx.textContent = `${bPct}%`;
      }
      const rg = ringRef.current;
      if (rg) {
        rg.setAttribute("cx", String(playX));
        rg.setAttribute("cy", String(rY));
      }
      const rd = rDotRef.current;
      if (rd) {
        rd.setAttribute("cx", String(playX));
        rd.setAttribute("cy", String(rY));
      }
      const rtx = rTxtRef.current;
      if (rtx) {
        rtx.setAttribute("x", String(playX + tagDX));
        rtx.setAttribute("y", String(rY - 11));
        rtx.setAttribute("text-anchor", tagAnchor);
        rtx.textContent = `${aPct}%`;
      }
    };
    // Publish for the pointer-scrub handler so it reuses this exact writer.
    drawRef.current = draw;

    draw(tRef.current);
    if (reduced) {
      // pin to the endpoint, statically — no sweep
      draw(T_MAX);
      return;
    }

    let raf = 0;
    const dur = 4200; // one restrained left→right entrance sweep
    const span = T_MAX - 0.08;
    const ease = (x: number) =>
      x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    const tick = (now: number) => {
      // While hovering, the pointer owns the playhead. Keep the finite entrance
      // clock paused until interaction ends; pointermove writes the live value.
      if (hoverRef.current) {
        baseRef.current = null;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (baseRef.current == null) {
        baseRef.current = now - progressRef.current * dur;
      }
      const frac = Math.min(1, (now - baseRef.current) / dur);
      progressRef.current = frac;
      const v = 0.08 + ease(frac) * span;
      tRef.current = v;
      draw(v);
      if (frac < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        progressRef.current = 1;
        tRef.current = T_MAX;
        draw(T_MAX);
      }
    };

    // The auto-sweep only needs to run while the plate is on-screen AND the tab is
    // visible. Off-screen / hidden, we cancel the rAF and stop rescheduling; on
    // re-entry we restart from the current tRef (forgetting the timeline base so
    // the sweep resumes smoothly from where it stopped, not where it left the
    // clock). Mirrors the IntersectionObserver pattern used in RecallReveal.
    let onScreen = true;
    const running = () => raf !== 0;
    const start = () => {
      if (running()) return;
      if (!onScreen || document.hidden) return;
      if (tRef.current >= T_MAX) return;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      baseRef.current = null;
    };

    let io: IntersectionObserver | null = null;
    const svgEl = svgRef.current;
    if (svgEl && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            onScreen = entry.isIntersecting;
            if (onScreen) start();
            else stop();
          }
        },
        { threshold: 0 },
      );
      io.observe(svgEl);
    } else {
      onScreen = true;
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
      if (idleRef.current) clearTimeout(idleRef.current);
    };
    // G is module-stable; reduced is the only reactive input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Hover-scrub: map the pointer's x into a day `t` (inverting the √-time axis),
  // drive the playhead there, and hand control back to the auto-sweep after a
  // short idle. No-op under reduced motion (the listeners simply do nothing).
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (reduced) return;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VB_W;
    const u = (x - G.x0) / (G.x1 - G.x0);
    const tt = Math.max(
      0,
      Math.min(T_MAX, Math.pow(Math.max(0, u) * Math.sqrt(T_MAX), 2)),
    );
    const pointerProgress = Math.max(0, Math.min(1, (tt - 0.08) / (T_MAX - 0.08)));
    const inverseSweepEase = (value: number) =>
      value < 0.5
        ? Math.sqrt(value / 2)
        : 1 - Math.sqrt((1 - value) / 2);
    hoverRef.current = true;
    progressRef.current = inverseSweepEase(pointerProgress);
    baseRef.current = null;
    tRef.current = tt;
    // draw immediately for snappy scrubbing — reuse the single playhead writer
    drawRef.current(tt);
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      hoverRef.current = false;
    }, 1400);
  };
  const onLeave = () => {
    hoverRef.current = false;
    if (idleRef.current) clearTimeout(idleRef.current);
  };

  return (
    <svg
      ref={svgRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="rl-plate-svg"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Retention over ${T_MAX} days. Without review, memory fades to about ${G.fadedEndPct} percent. With four spaced reviews on days 0, 1, 4 and 12, it holds at ${G.retainedEndPct} percent.`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="plate-gap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cf-recall-area-top)" />
          <stop offset="60%" stopColor="var(--cf-recall-area-mid)" />
          <stop offset="100%" stopColor="var(--cf-recall-area-bot)" />
        </linearGradient>
        <linearGradient id="plate-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--cf-recall-accent)" />
          <stop offset="78%" stopColor="var(--cf-recall-accent)" />
          <stop offset="100%" stopColor="var(--cf-recall-line-core)" />
        </linearGradient>
        <radialGradient id="plate-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--cf-recall-halo)" />
          <stop
            offset="100%"
            stopColor="var(--cf-recall-halo-soft)"
            stopOpacity="0"
          />
        </radialGradient>
      </defs>

      {/* ── structure: gridlines + axis labels (fade in just behind the draw) ── */}
      <g className="cf-curve-fade" shapeRendering="crispEdges">
        {G.gridLines.map((g) => (
          <g key={g.r}>
            <line
              x1={G.x0}
              x2={G.x1}
              y1={px(g.y)}
              y2={px(g.y)}
              stroke="var(--cf-recall-grid-line)"
              strokeWidth={1}
            />
            <text
              x={G.x0 - 12}
              y={g.y + 4}
              textAnchor="end"
              fontSize={12}
              fill="var(--cf-recall-ink-faint)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {g.label}
            </text>
          </g>
        ))}
        {/* y-axis unit */}
        <text
          x={G.x0 - 12}
          y={G.yTop - 16}
          textAnchor="end"
          fontSize={10}
          fill="var(--cf-recall-ink-faint)"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.16em" }}
        >
          % KEPT
        </text>

        {/* baseline + time ticks + day labels */}
        <line
          x1={G.x0}
          x2={G.x1}
          y1={px(G.yBot)}
          y2={px(G.yBot)}
          stroke="var(--cf-recall-tick)"
          strokeWidth={1}
        />
        {G.timeTicks.map((t) => (
          <g key={t.t}>
            <line
              x1={px(t.x)}
              x2={px(t.x)}
              y1={G.yBot}
              y2={G.yBot + 6}
              stroke="var(--cf-recall-tick)"
              strokeWidth={1}
            />
            <text
              x={t.x}
              y={G.yBot + 22}
              textAnchor="middle"
              fontSize={12}
              fill="var(--cf-recall-ink-faint)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {t.label}
            </text>
          </g>
        ))}
        <text
          x={G.x1}
          y={G.yBot + 40}
          textAnchor="end"
          fontSize={10}
          fill="var(--cf-recall-ink-faint)"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.16em" }}
        >
          DAYS →
        </text>
      </g>

      {/* ── the shaded gap = retention the product buys ── */}
      <path className="cf-curve-fade" d={G.gapD} fill="url(#plate-gap)" />

      {/* ── the "no review" decay line — distinct coral, drawn on just behind
          the lit line so the whole chart draws itself in on first paint ── */}
      <path
        className="cf-curve-line"
        pathLength={1}
        d={G.fadeD}
        fill="none"
        stroke="var(--cf-recall-decay)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animationDelay: "140ms" }}
      />

      {/* A brief light packet crosses the retained curve twice, then disappears. */}
      <path
        className="cf-curve-shimmer"
        pathLength={1}
        d={G.lockedD}
        fill="none"
        stroke="var(--cf-recall-line-core)"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── the lit retained line — drawn on (the STAR) ── */}
      <path
        className="cf-curve-line"
        pathLength={1}
        d={G.lockedD}
        fill="none"
        stroke="url(#plate-stroke)"
        strokeWidth={4.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter:
            "drop-shadow(0 0 6px var(--cf-recall-glow)) drop-shadow(0 8px 34px var(--cf-recall-glow))",
        }}
      />

      {/* ── review-event markers (the data points), popping in sequence ── */}
      {G.reviewMarks.map((m) => (
        <g
          key={m.t}
          className="cf-curve-dot"
          style={{ animationDelay: `${120 + (m.t / T_MAX) * 520}ms` }}
        >
          <circle cx={m.x} cy={m.y} r={9} fill="var(--cf-recall-halo)" opacity={0.5} />
          <circle
            cx={m.x}
            cy={m.y}
            r={4.5}
            fill="var(--cf-recall-dot-core)"
            stroke="var(--cf-recall-accent)"
            strokeWidth={1.5}
          />
        </g>
      ))}

      {/* ── glowing endpoint of the lit line ── */}
      <g className="cf-curve-head">
        <circle cx={G.endX} cy={G.endY} r={34} fill="url(#plate-halo)" />
        {/* two-cycle entrance pulse; the solid endpoint remains after it settles */}
        <circle
          className="cf-curve-pulse"
          cx={G.endX}
          cy={G.endY}
          r={10}
          fill="none"
          stroke="var(--cf-recall-accent)"
          strokeWidth={1.5}
        />
        <circle cx={G.endX} cy={G.endY} r={7} fill="var(--cf-recall-glow)" />
        <circle cx={G.endX} cy={G.endY} r={4} fill="var(--cf-recall-line-core)" />
      </g>

      {/* ── playhead scrubber — one entrance sweep, then pointer-scrubbable ── */}
      <g className="cf-curve-readout">
        {/* vertical guide spanning the plot */}
        <line
          ref={phRef}
          x1={pX0}
          x2={pX0}
          y1={G.yTop - 4}
          y2={G.yBot}
          stroke="var(--cf-recall-accent-line)"
          strokeWidth={1}
          strokeDasharray="3 5"
        />
        {/* the live gap between the two series at the playhead */}
        <line
          ref={gapRef}
          x1={pX0}
          y1={rY0}
          x2={pX0}
          y2={dY0}
          stroke="var(--cf-recall-decay-soft)"
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={0.7}
        />
        {/* DAY chip riding the top of the guide */}
        <g ref={dayGRef} transform={`translate(${dayCx0}, ${G.yTop - 12})`}>
          <rect
            x={-27}
            y={-13}
            width={54}
            height={20}
            rx={10}
            fill="var(--cf-recall-panel)"
            stroke="var(--cf-recall-accent-line)"
            strokeWidth={1}
          />
          <text
            ref={dayTRef}
            textAnchor="middle"
            y={1.5}
            fontSize={10.5}
            fill="var(--cf-recall-ink-soft)"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}
          >
            DAY {Math.round(t0)}
          </text>
        </g>
        {/* dot riding the decay (coral) line + its live % */}
        <circle
          ref={dDotRef}
          cx={pX0}
          cy={dY0}
          r={5}
          fill="var(--cf-recall-bg)"
          stroke="var(--cf-recall-decay)"
          strokeWidth={2}
        />
        <text
          ref={dTxtRef}
          x={pX0 + 13}
          y={dY0 + 18}
          textAnchor="start"
          fontSize={14}
          fontWeight={600}
          fill="var(--cf-recall-decay)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {Math.round(dT0 * 100)}%
        </text>
        {/* dot riding the retained (periwinkle) line + its live % */}
        <circle
          ref={ringRef}
          cx={pX0}
          cy={rY0}
          r={14}
          fill="none"
          stroke="var(--cf-recall-accent)"
          strokeWidth={1}
          opacity={0.3}
        />
        <circle
          ref={rDotRef}
          cx={pX0}
          cy={rY0}
          r={6.5}
          fill="var(--cf-recall-line-core)"
          stroke="var(--cf-recall-accent)"
          strokeWidth={2}
        />
        <text
          ref={rTxtRef}
          x={pX0 + 13}
          y={rY0 - 11}
          textAnchor="start"
          fontSize={15}
          fontWeight={700}
          fill="var(--cf-recall-accent-strong)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {Math.round(rT0 * 100)}%
        </text>
      </g>

      {/* ── legend (lower-left, where both series sit high so it never overlaps) ── */}
      <g
        className="cf-curve-readout"
        transform={`translate(${G.x0 + 14}, ${G.yBot - 46})`}
      >
        <line
          x1={0}
          x2={24}
          y1={0}
          y2={0}
          stroke="var(--cf-recall-accent)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <text
          x={32}
          y={4}
          fontSize={12.5}
          fontWeight={600}
          fill="var(--cf-recall-ink)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          With spaced review
        </text>
        <line
          x1={0}
          x2={24}
          y1={24}
          y2={24}
          stroke="var(--cf-recall-decay)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <text
          x={32}
          y={28}
          fontSize={12.5}
          fill="var(--cf-recall-ink-soft)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Without review
        </text>
      </g>

      {/* ── connected end readouts: tie each % to its day-T_MAX endpoint ── */}
      <g className="cf-curve-readout">
        <line
          x1={px(G.endX)}
          y1={G.endY}
          x2={px(G.endX)}
          y2={G.yOf(G.fadedEndPct / 100)}
          stroke="var(--cf-recall-decay-soft)"
          strokeWidth={1}
          strokeDasharray="2 5"
        />
        <text
          x={G.endX + 14}
          y={G.endY + 6}
          fontSize={22}
          fontWeight={700}
          fill="var(--cf-recall-accent-strong)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {G.retainedEndPct}%
        </text>
        <text
          x={G.endX + 14}
          y={G.yOf(G.fadedEndPct / 100) + 5}
          fontSize={15}
          fontWeight={600}
          fill="var(--cf-recall-decay)"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {G.fadedEndPct}%
        </text>
      </g>
    </svg>
  );
}
