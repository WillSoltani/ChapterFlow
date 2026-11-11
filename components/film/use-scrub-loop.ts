"use client";

/**
 * useScrubLoop — the single rAF loop that reads segment rects and paints the
 * backdrop canvas. All hot-path state is in refs; no React re-renders per frame.
 */

import { useEffect, type MutableRefObject } from "react";
import type { FrameBudget, FrameCache } from "./frame-cache";
import { pickVariant } from "./reel-context";
import { breathAt, coverRect, frameAt, pickActive, quantise } from "./scrub";
import type { FilmManifest, Orientation, ReelChrome, SegmentRegistration } from "./types";

export const REEL_CHROME_EVENT = "cf-reel-chrome";

/** Canvas clear colour = the landing's page token, read once from the DOM. */
function readCanvasBg(canvas: HTMLCanvasElement): string {
  const v = getComputedStyle(canvas).getPropertyValue("--cf-page-bg").trim();
  return v || "black";
}

type Drawable = ImageBitmap | HTMLImageElement;

type Args = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  segments: MutableRefObject<Map<number, SegmentRegistration>>;
  drawn: MutableRefObject<{ segment: number; frame: number }>;
  drawnListeners: MutableRefObject<Set<() => void>>;
  reducedRef: MutableRefObject<boolean>;
  orientation: Orientation;
  cacheFor: (film: FilmManifest) => FrameCache;
  budget: FrameBudget;
};

export function useScrubLoop({
  canvasRef,
  segments,
  drawn,
  drawnListeners,
  reducedRef,
  orientation,
  cacheFor,
  budget,
}: Args) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    let raf = 0;
    let alive = true;
    let lastKey = "";
    let lastFetchKey = "";
    let lastChrome = "";
    let smoothFrame = 0;
    let smoothSeg = -1;
    let lastT = performance.now();
    let lastScroll = window.scrollY;
    const canvasBg = readCanvasBg(canvas);
    // Late-frame repaint: what the canvas shows, and how far it is from the
    // wanted frame. A frame landing nearer (or the dissolve's underlay) clears
    // the paint key so the next tick redraws, even with no scroll or breath.
    let shown: { cache: FrameCache | null; want: number; dist: number; under: FrameCache | null } = { cache: null, want: 0, dist: Infinity, under: null };
    const offLoad = budget.subscribe((c, i) => {
      if ((c === shown.cache && Math.abs(i - shown.want) < shown.dist) || c === shown.under) lastKey = "";
    });

    const resize = () => {
      // Backing store: never larger than the source frames (1920 wide) — a
      // Retina 2880px canvas just upsamples 1920px WebP and costs 2.25× fill.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const maxW = 1920;
      const scale = Math.min(dpr, maxW / window.innerWidth);
      canvas.width = Math.round(window.innerWidth * scale);
      canvas.height = Math.round(window.innerHeight * scale);
      lastKey = "";
    };
    resize();
    window.addEventListener("resize", resize);

    const setChrome = (chrome: ReelChrome, section: string, soft: boolean) => {
      const key = `${chrome}|${section}|${soft ? 1 : 0}`;
      if (key === lastChrome) return;
      lastChrome = key;
      const root = document.documentElement;
      root.dataset.reelChrome = chrome;
      root.dataset.reelSection = section;
      if (soft) root.dataset.reelSoft = "";
      else delete root.dataset.reelSoft;
      window.dispatchEvent(new CustomEvent(REEL_CHROME_EVENT, { detail: { chrome, section } }));
    };

    const draw = (img: Drawable, alpha: number, zoom: number) => {
      const iw = img.width;
      const ih = img.height;
      if (!iw || !ih) return;
      const r = coverRect(canvas.width, canvas.height, iw, ih);
      const w = r.w * (1 + zoom);
      const h = r.h * (1 + zoom);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, r.x - (w - r.w) * 0.5, r.y - (h - r.h) * 0.45, w, h);
      ctx.globalAlpha = 1;
    };

    const tick = (t: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);

      const scrollY = window.scrollY;
      const direction: 1 | -1 = scrollY >= lastScroll ? 1 : -1;
      lastScroll = scrollY;

      const segs = [...segments.current.values()].sort((a, b) => a.index - b.index);
      if (segs.length === 0) return;
      const rects = segs.map((s) => {
        const r = s.el.getBoundingClientRect();
        return { top: r.top, height: r.height };
      });
      const pick = pickActive(segs, rects, window.innerHeight);
      if (!pick) return;
      const { seg } = pick;

      const variant = pickVariant(seg.film, orientation);
      const cache = cacheFor(seg.film);
      const p = reducedRef.current ? quantise(pick.progress, seg.reducedSteps) : pick.progress;
      const target = frameAt(p, variant.count);

      // Smooth the scrub: a wheel tick jumps the target 10–30 frames; chasing
      // it with an exponential lerp (~90 ms time constant) turns that into a
      // short glide instead of a cut. Segment change or reduced motion = snap.
      if (smoothSeg !== seg.index || reducedRef.current) {
        smoothFrame = target;
        smoothSeg = seg.index;
      } else {
        const dt = Math.min(50, t - lastT);
        const k = 1 - Math.exp(-dt / 90);
        smoothFrame += (target - smoothFrame) * k;
        if (Math.abs(target - smoothFrame) < 0.5) smoothFrame = target;
      }
      lastT = t;
      const frame = Math.round(smoothFrame);

      // One wanted set per decision, only when the target frame moved (not
      // 60×/s while idle): the window around the playhead, the previous film's
      // last frame for the dissolve, and the next film's opening once past 60 %
      // (its box enters the viewport at p = 1, see pickActive) or from the hero.
      const warmNext = p > 0.6 || seg.index === 0;
      const fetchKey = `${seg.index}:${target}:${direction}:${warmNext}`;
      if (fetchKey !== lastFetchKey) {
        lastFetchKey = fetchKey;
        const before = segments.current.get(seg.index - 1);
        const next = warmNext ? segments.current.get(seg.index + 1) : undefined;
        budget.want({
          active: { cache, center: target, direction },
          pin: before && seg.dissolveIn > 0 ? { cache: cacheFor(before.film), index: pickVariant(before.film, orientation).count - 1, until: seg.dissolveIn } : undefined,
          next: next ? cacheFor(next.film) : undefined,
        });
      }

      // Breath is quantised to 1/4000 so an idle hold repaints a few times a
      // second, not 60× (each repaint is a full-canvas drawImage).
      const breath = reducedRef.current ? 0 : Math.round(breathAt(t, seg.breath) * 4000) / 4000;
      const key = `${seg.index}:${frame}:${breath}:${canvas.width}`;
      if (key !== lastKey) {
        lastKey = key;
        const img = cache.nearest(frame, true);
        shown = { cache, want: frame, dist: cache.lastServed < 0 ? Infinity : Math.abs(cache.lastServed - frame), under: null };
        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (img) {
          const prev = segments.current.get(seg.index - 1);
          if (seg.dissolveIn > 0 && frame < seg.dissolveIn && prev) {
            const prevVar = pickVariant(prev.film, orientation);
            const prevCache = cacheFor(prev.film);
            const prevImg = prevCache.nearest(prevVar.count - 1);
            if (prevCache.lastServed !== prevVar.count - 1) shown.under = prevCache;
            if (prevImg) draw(prevImg, 1, breath);
            const u = frame / seg.dissolveIn;
            draw(img, u * u * (3 - 2 * u), breath); // smoothstep cross-fade
          } else {
            draw(img, 1, breath);
          }
        }
        drawn.current = { segment: seg.index, frame };
        for (const fn of drawnListeners.current) fn();
      }

      seg.onProgress(p, frame);
      // "body" chrome means the reel is over. Gate the flip on the LAST
      // segment (the only one that stays active at p = 1 while its stage
      // slides out): otherwise the <html> attribute toggles at every boundary,
      // the nav scrim pulses, and the document-wide style recalc costs a
      // ~120–250 ms hitch mid-scrub.
      const isLast = seg.index === segs[segs.length - 1]?.index;
      setChrome(isLast && p >= 1 ? "body" : "film", seg.section ?? "", seg.el.hasAttribute("data-soft-focus") && p < 1);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      offLoad();
    };
  }, [canvasRef, segments, drawn, drawnListeners, reducedRef, orientation, cacheFor, budget]);
}
