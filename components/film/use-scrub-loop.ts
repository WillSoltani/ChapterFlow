"use client";

/**
 * useScrubLoop — the single rAF loop that maps scroll to the active segment
 * and paints the backdrop canvas. All hot-path state is in refs; no React
 * re-renders per frame.
 *
 * Viewport rules (phones: the address bar must not move the film):
 *   • Progress is measured against the sticky STAGE height (100svh), the unit
 *     the segments are sized in, never window.innerHeight (which grows and
 *     shrinks with the iOS address bar).
 *   • The canvas box is the large viewport (100lvh, see FilmBackdrop). Its
 *     backing store is reallocated only when that box changes (ResizeObserver
 *     on the wrapper: width, orientation, zoom) or the DPR does, never on an
 *     address-bar resize. The picture is cover-fitted to the box and centred
 *     on the stage centre, so neither its scale nor its place moves.
 *   • Segment geometry (document tops, heights, stage height) is cached and
 *     re-measured on register, window resize, a ResizeObserver on the reel
 *     content and on <body>, fonts ready, and at most every 500 ms while the
 *     loop works. A tick does no layout reads.
 *   • A tick works only when something changed (scroll, box, geometry,
 *     smoothing, a late frame, breath, reduced motion); otherwise it returns.
 *     The loop stops while the tab is hidden and once the reel has ended; a
 *     scroll back above the end, a resize, a late frame or the tab coming
 *     back restarts it, and the first tick after a restart snaps to the
 *     scroll position.
 * Counters: window.__filmStats canvasResizes, geometryMeasures, ticksWorked,
 * ticksSkipped.
 */

import { useEffect, type MutableRefObject } from "react";
import type { FrameBudget, FrameCache } from "./frame-cache";
import { pickVariant } from "./reel-context";
import {
  backingSize,
  breathAt,
  frameAt,
  framePlacement,
  pickActive,
  quantise,
  reelEndScrollY,
  stageShift,
  viewportRects,
} from "./scrub";
import type { FilmManifest, Orientation, ReelChrome, SegmentRegistration } from "./types";

export const REEL_CHROME_EVENT = "cf-reel-chrome";

/** Re-measure segment geometry at most this often while the loop works. */
const GEOMETRY_SAFETY_MS = 500;

/**
 * Canvas clear colour = the landing colour the portrait frames' baked bars
 * are encoded in, so canvas area the picture does not cover shows no seam.
 */
function readCanvasBg(canvas: HTMLCanvasElement): string {
  const v = getComputedStyle(canvas).getPropertyValue("--cf-recall-bg").trim();
  return v || "#06070A";
}

type Drawable = ImageBitmap | HTMLImageElement;

type Args = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  /** The reel's content wrapper (all segments + body); observed for size changes. */
  contentRef: MutableRefObject<HTMLElement | null>;
  /** Filled by the loop: call when segments register or unregister. */
  invalidateRef: MutableRefObject<() => void>;
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
  contentRef,
  invalidateRef,
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
    const box = canvas?.parentElement;
    if (!canvas || !ctx || !box) return;
    const stats = budget.stats;

    let raf = 0;
    let alive = true;
    let lastKey = "";
    let lastFetchKey = "";
    let lastChrome = "";
    let smoothFrame = 0;
    let smoothSeg = -1;
    let target = 0;
    let lastT = performance.now();
    let lastScroll = window.scrollY;
    // Set by wake(): the loop had stopped, so the next tick works and snaps.
    let resumed = false;
    // Inputs of the last worked tick, compared by the idle check.
    let lastSeg: SegmentRegistration | null = null;
    let lastBreath = Number.NaN;
    let lastReduced = reducedRef.current;
    // While stopped at the end of the reel: a scroll above this restarts it.
    let endY = Number.POSITIVE_INFINITY;
    const canvasBg = readCanvasBg(canvas);
    // Late-frame repaint: what the canvas shows, and how far it is from the
    // wanted frame. A frame landing nearer (or the dissolve's underlay) clears
    // the paint key so the next tick redraws, even with no scroll or breath.
    let shown: { cache: FrameCache | null; want: number; dist: number; under: FrameCache | null } = { cache: null, want: 0, dist: Infinity, under: null };

    // Cached geometry: segments in index order, document tops and heights,
    // and the sticky stage height (CSS px).
    let geomDirty = true;
    let lastMeasure = Number.NEGATIVE_INFINITY;
    let segs: SegmentRegistration[] = [];
    const tops: number[] = [];
    const heights: number[] = [];
    const rects: Array<{ top: number; height: number }> = [];
    let stageH = window.innerHeight;
    const measure = (t: number) => {
      geomDirty = false;
      lastMeasure = t;
      stats.geometryMeasures++;
      segs = [...segments.current.values()].sort((a, b) => a.index - b.index);
      const sy = window.scrollY;
      tops.length = heights.length = segs.length;
      segs.forEach((s, i) => {
        const r = s.el.getBoundingClientRect();
        tops[i] = r.top + sy;
        heights[i] = r.height;
      });
      const stage = segs[0]?.el.querySelector<HTMLElement>("[data-film-stage]");
      const h = stage?.getBoundingClientRect().height ?? 0;
      stageH = h > 0 ? h : window.innerHeight;
    };

    // Canvas box (CSS px of the 100lvh wrapper) and the DPR it was sized for.
    const boxRect = box.getBoundingClientRect();
    let boxW = boxRect.width;
    let boxH = boxRect.height;
    let dpr = window.devicePixelRatio || 1;
    let boxDirty = true;
    const fitCanvas = () => {
      boxDirty = false;
      const { w, h } = backingSize(boxW, boxH, dpr);
      if (!w || !h || (w === canvas.width && h === canvas.height)) return;
      canvas.width = w;
      canvas.height = h;
      stats.canvasResizes++;
      lastKey = "";
    };

    const offLoad = budget.subscribe((c, i) => {
      if ((c === shown.cache && Math.abs(i - shown.want) < shown.dist) || c === shown.under) {
        lastKey = "";
        wake();
      }
    });

    // A wake() from inside a tick (a load landing synchronously) only asks
    // that tick to keep the loop running; it is not a restart.
    let stepping = false;
    let poked = false;
    const tick = (t: number) => {
      raf = 0;
      if (!alive || document.hidden) return;
      stepping = true;
      poked = false;
      const keep = step(t);
      stepping = false;
      if ((keep || poked) && alive && !raf) raf = requestAnimationFrame(tick);
    };
    /** Restart a stopped loop (no-op while it runs or the tab is hidden). */
    const wake = () => {
      if (stepping) {
        poked = true;
        return;
      }
      if (!alive || raf || document.hidden) return;
      resumed = true;
      raf = requestAnimationFrame(tick);
    };

    const onResize = () => {
      geomDirty = true;
      wake();
    };
    window.addEventListener("resize", onResize);
    const onScroll = () => {
      if (!raf && window.scrollY < endY) wake();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    const boxObserver = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1]?.contentRect;
      if (!r || (r.width === boxW && r.height === boxH)) return;
      boxW = r.width;
      boxH = r.height;
      boxDirty = true;
      geomDirty = true;
      wake();
    });
    boxObserver.observe(box);
    const contentObserver = new ResizeObserver(onResize);
    if (contentRef.current) contentObserver.observe(contentRef.current);
    contentObserver.observe(document.body);
    void document.fonts?.ready.then(() => {
      if (alive) onResize();
    });
    invalidateRef.current = onResize;

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

    // Shift (backing px) that centres the picture on the stage; set per paint.
    let shiftY = 0;
    const draw = (img: Drawable, alpha: number, zoom: number) => {
      const iw = img.width;
      const ih = img.height;
      if (!iw || !ih) return;
      const r = framePlacement(canvas.width, canvas.height, iw, ih, zoom, shiftY);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
    };

    /** One animation frame. Returns false to stop the loop (reel ended). */
    const step = (t: number): boolean => {
      const scrollY = window.scrollY;
      const ratio = window.devicePixelRatio || 1;
      if (ratio !== dpr) {
        dpr = ratio;
        boxDirty = true;
      }
      const reduced = reducedRef.current;

      // Idle check: a few comparisons, no layout reads. Breath is quantised to
      // 1/4000 so a hold repaints a few times a second, not 60×.
      const breathNow = lastSeg && !reduced ? Math.round(breathAt(t, lastSeg.breath) * 4000) / 4000 : 0;
      if (
        !resumed &&
        !geomDirty &&
        !boxDirty &&
        lastKey !== "" &&
        scrollY === lastScroll &&
        smoothFrame === target &&
        reduced === lastReduced &&
        breathNow === lastBreath
      ) {
        lastT = t;
        stats.ticksSkipped++;
        return true;
      }
      stats.ticksWorked++;
      const snap = resumed;
      resumed = false;

      if (boxDirty) fitCanvas();
      if (geomDirty || t - lastMeasure >= GEOMETRY_SAFETY_MS) measure(t);

      const direction: 1 | -1 = scrollY >= lastScroll ? 1 : -1;
      lastScroll = scrollY;

      const lastIdx = segs.length - 1;
      if (lastIdx < 0) {
        // Nothing registered: stop; register or any scroll restarts the loop.
        endY = Number.POSITIVE_INFINITY;
        return false;
      }
      const pick = pickActive(segs, viewportRects(tops, heights, scrollY, rects), stageH);
      if (!pick) return true;
      const { seg } = pick;

      const variant = pickVariant(seg.film, orientation);
      const cache = cacheFor(seg.film);
      const p = reduced ? quantise(pick.progress, seg.reducedSteps) : pick.progress;
      target = frameAt(p, variant.count);

      // Smooth the scrub: a wheel tick jumps the target 10–30 frames; chasing
      // it with an exponential lerp (~90 ms time constant) turns that into a
      // short glide instead of a cut. Segment change, reduced motion or a
      // restart (anchor jump, back/forward, tab shown) = snap.
      if (smoothSeg !== seg.index || reduced || snap) {
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

      const breath = reduced ? 0 : Math.round(breathAt(t, seg.breath) * 4000) / 4000;
      shiftY = stageShift(stageH, boxH, canvas.height);
      const key = `${seg.index}:${frame}:${breath}:${canvas.width}:${canvas.height}:${shiftY}`;
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
      lastSeg = seg;
      lastBreath = breath;
      lastReduced = reduced;

      seg.onProgress(p, frame);
      // "body" chrome means the reel is over. Gate the flip on the LAST
      // segment (the only one that stays active at p = 1 while its stage
      // slides out): otherwise the <html> attribute toggles at every boundary,
      // the nav scrim pulses, and the document-wide style recalc costs a
      // ~120–250 ms hitch mid-scrub.
      const ended = seg.index === segs[lastIdx]?.index && p >= 1;
      setChrome(ended ? "body" : "film", seg.section ?? "", seg.el.hasAttribute("data-soft-focus") && p < 1);

      // Reel over and its last frame settled: stop until the visitor scrolls
      // back above the end (or a resize / late frame / tab switch wakes it).
      if (ended && smoothFrame === target) {
        endY = reelEndScrollY(tops[lastIdx] ?? 0, heights[lastIdx] ?? 0, stageH);
        return false;
      }
      return true;
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      boxObserver.disconnect();
      contentObserver.disconnect();
      if (invalidateRef.current === onResize) invalidateRef.current = () => {};
      offLoad();
    };
  }, [canvasRef, contentRef, invalidateRef, segments, drawn, drawnListeners, reducedRef, orientation, cacheFor, budget]);
}
