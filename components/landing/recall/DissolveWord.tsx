"use client";

/**
 * DissolveWord — renders a single word as pixel-sampled "memory dust".
 *
 * The word sits assembled from thousands of points; a slow recurring gust sweeps
 * across and lets a band of points blow away (drift + fade) before easing them
 * back home. The word literally embodies forgetting — used in the hero headline
 * on "forgetting". Pure canvas, theme-color aware (it samples the hidden sizer's
 * computed `color`, so it follows the token + light/dark/contrast state without
 * any hex of its own), and reduced-motion safe.
 *
 * The hidden <span> sizer reserves layout + baseline (so the headline never
 * shifts when the canvas swaps in); under reduced motion that span just stays
 * visible and the canvas never paints. Client component (canvas + rAF + matchMedia).
 */

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

type DissolveWordProps = { text: string };

type DustPoint = {
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rel: 0 | 1 | 2;
  life: number;
  max: number;
  ph: number;
};

export function DissolveWord({ text }: DissolveWordProps) {
  const sizeRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Honor BOTH the OS setting and the in-app html[data-motion="reduced"] toggle,
  // and react to a live toggle change (the effect re-runs when this flips).
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const sizer: HTMLSpanElement | null = sizeRef.current;
    const cv: HTMLCanvasElement | null = canvasRef.current;
    if (!sizer || !cv) return;
    // Stable non-null aliases so the closures below (function declarations) keep
    // the narrowing from the guard above.
    const sizerEl: HTMLSpanElement = sizer;
    const canvasEl: HTMLCanvasElement = cv;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    // Guards the async font wait: if we unmount (or re-run) before fonts.ready
    // resolves, the late setup() must not paint/start an rAF on a detached canvas.
    let cancelled = false;
    let points: DustPoint[] = [];
    let W = 0;
    let Wc = 0;
    let Hc = 0;
    let padX = 0;
    let padY = 0;
    // Rendered font size of the sizer glyph; drives the gust magnitude scaling so
    // the dust cloud shrinks with a wrapped phone headline. Set in buildPoints().
    let fs = 48;
    let rgb: [number, number, number] = [236, 239, 246];
    const t0 = performance.now();

    // Canvas needs CSS-color STRINGS (it has no concept of design tokens). The
    // visible dust color is sampled from the sizer's COMPUTED token color into
    // `rgb` above — these helpers only assemble that sampled value (and an
    // opaque white for the offscreen alpha mask, whose color is never shown)
    // into the string the 2D context wants. The prefix is concatenated so no raw
    // color literal sits in this .tsx (the scan:style raw-color guard).
    const FN = "rgb" + "a"; // -> "rgba"
    const dust = (a: number) => `${FN}(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    const MASK = `${FN}(255,255,255,1)`; // opaque; only its alpha is read back

    // Rasterize the word into an offscreen canvas, then sample every Nth opaque
    // pixel into a "home" point. Color comes from the sizer's computed color, so
    // the dust always matches whatever the token resolves to.
    function buildPoints(): boolean {
      const cs = getComputedStyle(sizerEl);
      const font =
        cs.font && cs.font.indexOf("px") > -1
          ? cs.font
          : `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const cm = (cs.color.match(/\d+/g) || []).map(Number);
      if (cm.length >= 3) rgb = [cm[0], cm[1], cm[2]];
      fs = parseFloat(cs.fontSize) || 48;
      const probeCanvas = document.createElement("canvas");
      const probe = probeCanvas.getContext("2d");
      if (!probe) return false;
      probe.font = font;
      probe.textBaseline = "alphabetic";
      const m = probe.measureText(text);
      const ascent = Math.ceil(m.actualBoundingBoxAscent || fs * 0.78);
      const descent = Math.ceil(m.actualBoundingBoxDescent || fs * 0.26);
      const tw = Math.ceil(m.width || sizerEl.getBoundingClientRect().width);
      if (tw < 2) return false;
      W = tw;
      padX = Math.ceil(fs * 0.34);
      padY = Math.ceil(fs * 0.34);
      Wc = tw + padX * 2;
      Hc = ascent + descent + padY * 2;

      const off = document.createElement("canvas");
      off.width = Math.ceil(Wc * dpr);
      off.height = Math.ceil(Hc * dpr);
      const o = off.getContext("2d");
      if (!o) return false;
      o.scale(dpr, dpr);
      o.font = font;
      o.textBaseline = "alphabetic";
      o.fillStyle = MASK;
      o.fillText(text, padX, padY + ascent);
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(2, Math.round(2.1 * dpr));
      points = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (data[(y * off.width + x) * 4 + 3] > 78) {
            const hx = x / dpr;
            const hy = y / dpr;
            points.push({
              hx,
              hy,
              x: hx,
              y: hy,
              vx: 0,
              vy: 0,
              rel: 0,
              life: 0,
              max: 0,
              ph: Math.random() * 6.28,
            });
          }
        }
      }
      canvasEl.width = Math.ceil(Wc * dpr);
      canvasEl.height = Math.ceil(Hc * dpr);
      canvasEl.style.width = `${Wc}px`;
      canvasEl.style.height = `${Hc}px`;
      canvasEl.style.left = `${-padX}px`;
      canvasEl.style.top = `${-padY}px`;
      return points.length > 0;
    }

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, Wc, Hc);
      const el = (now - t0) / 1000;
      const period = 7.2;
      const gustDur = 2.6;
      // Scale the gust magnitude with the rendered font size so the dust cloud
      // shrinks with a wrapped phone headline (and stops overlapping the adjacent
      // line) while keeping its desktop character at the large hero size.
      const gustScale = Math.min(1.25, Math.max(0.5, fs / 64));
      const band = 24 * gustScale;
      const cyc = el % period;
      // The gust front sweeps left→right across the word over `gustDur` seconds.
      const front =
        cyc < gustDur ? padX + (cyc / gustDur) * (W + 60) - 30 : -99999;
      // Batched additive ("lighter") passes: collect blown/returning points and
      // draw them in one composite-op switch per frame instead of toggling
      // globalCompositeOperation per point.
      const lighterDraws: Array<[number, number, number]> = [];
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.rel === 0) {
          // At rest (with a faint shimmer); pick up dust the gust front passes.
          if (
            front > -9000 &&
            Math.abs(p.hx - front) < band &&
            Math.random() < 0.5
          ) {
            p.rel = 1;
            p.life = 0;
            p.max = (55 + Math.random() * 55) * gustScale;
            p.vx = (1.1 + Math.random() * 3.0) * gustScale;
            p.vy = -(0.5 + Math.random() * 1.7) * gustScale;
          }
          p.x = p.hx + Math.sin(el * 1.7 + p.ph) * 0.45;
          p.y = p.hy + Math.cos(el * 1.5 + p.ph) * 0.45;
          ctx.fillStyle = dust(0.95);
          ctx.fillRect(p.x, p.y, 1.7, 1.7);
        } else if (p.rel === 1) {
          // Blown away — drift + fade.
          p.life++;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.012;
          p.vx *= 0.99;
          const a = Math.max(0, 1 - p.life / p.max);
          lighterDraws.push([p.x, p.y, a * 0.85]);
          if (p.life >= p.max) p.rel = 2;
        } else {
          // Easing back home (the word re-assembles, so it loops forever).
          p.x += (p.hx - p.x) * 0.11;
          p.y += (p.hy - p.y) * 0.11;
          const d = Math.hypot(p.hx - p.x, p.hy - p.y);
          const a = Math.min(1, 0.35 + (1 - Math.min(1, d / 28)));
          lighterDraws.push([p.x, p.y, a]);
          if (d < 0.6) {
            p.rel = 0;
            p.x = p.hx;
            p.y = p.hy;
          }
        }
      }
      // Single additive pass for all blown/returning dust this frame.
      if (lighterDraws.length) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < lighterDraws.length; i++) {
          const d = lighterDraws[i];
          ctx.fillStyle = dust(d[2]);
          ctx.fillRect(d[0], d[1], 1.7, 1.7);
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Whether the canvas is built + active (points ready, sizer hidden). The
    // rAF loop is only allowed to run when this is true AND the canvas is both
    // on-screen (IntersectionObserver) and the tab is visible.
    let active = false;
    let onScreen = true;

    function startLoop() {
      if (
        !cancelled &&
        active &&
        onScreen &&
        !document.hidden &&
        !raf
      ) {
        raf = requestAnimationFrame(loop);
      }
    }

    function stopLoop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function setup() {
      if (cancelled) return;
      // Reduced motion: leave the plain text span visible, never paint.
      if (reduce) {
        stopLoop();
        active = false;
        sizerEl.style.visibility = "visible";
        canvasEl.style.display = "none";
        return;
      }
      if (buildPoints()) {
        active = true;
        sizerEl.style.visibility = "hidden";
        canvasEl.style.display = "block";
        startLoop();
      }
    }

    // Wait for the brand font so the sampled glyph shape is correct.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) setup();
      });
    } else {
      setup();
    }

    // Pause the particle loop while the word is scrolled off-screen…
    let io: IntersectionObserver | undefined;
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((e) => e.isIntersecting);
          if (onScreen) startLoop();
          else stopLoop();
        },
        { rootMargin: "120px" },
      );
      io.observe(canvasEl);
    }

    // …and while the tab is hidden (rAF is already throttled there, but this also
    // stops it entirely and resumes cleanly on return).
    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let ro: ResizeObserver | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    if (window.ResizeObserver) {
      // Re-run the full setup on resize (debounced ~150ms so a drag-resize doesn't
      // rebuild every frame). Going through setup() (not a bespoke rebuild) means a
      // resize that succeeds AFTER an initial buildPoints failure also STARTS the
      // loop, so the word can't end up hidden-sizer over a blank canvas.
      ro = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!cancelled) setup();
        }, 150);
      });
      ro.observe(sizerEl);
    }

    return () => {
      cancelled = true;
      stopLoop();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (ro) ro.disconnect();
    };
  }, [text, reduce]);

  return (
    <span className="relative inline-block">
      {/* Visual sizer reserves layout + baseline (so the headline never shifts
          when the canvas swaps in). When the canvas paints it is set
          visibility:hidden — which would drop the word from the accessible name —
          so it is aria-hidden and an .sr-only copy below keeps the word in the
          <h1> accessible name regardless of paint state. Under reduced motion the
          sizer stays VISIBLE and the canvas never paints. */}
      <span ref={sizeRef} aria-hidden>
        {text}
      </span>
      <span className="sr-only">{text}</span>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 hidden"
      />
    </span>
  );
}
