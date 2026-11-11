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
 *     backing store is reallocated only when that box changes (width,
 *     orientation, zoom: a ResizeObserver on the wrapper, and every geometry
 *     measure re-reads it) or the DPR does, never on an address-bar resize. The picture is cover-fitted to the box and centred
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
 *     scroll position. Breath holds still while the loop is stopped.
 *   • Smoothing follows the input (smoothingMs in scrub.ts): passive wheel,
 *     touch, key, pointer and hashchange listeners record the kind of the last
 *     scroll input; the tick reads it. ?smooth=<ms> (read once) replaces the
 *     touch value.
 *   • Below the reel the canvas wrapper is hidden (visibility, so it is not
 *     composited under the body; the backing store keeps its picture). The
 *     scroll handler shows it again, before the frame paints, as soon as the
 *     scroll is above canvasHiddenFrom (cached geometry, no layout read).
 * Counters: window.__filmStats canvasResizes, geometryMeasures, ticksWorked,
 * ticksSkipped.
 */

import { useEffect, type MutableRefObject } from "react";
import type { FrameBudget, FrameCache } from "./frame-cache";
import {
  backingSize,
  breathAt,
  canvasHiddenFrom,
  frameAt,
  holdBreathClock,
  isScrollKey,
  parseSmoothParam,
  pickActive,
  quantise,
  reelEndScrollY,
  scrollInputAt,
  smoothFrameStep,
  smoothingMs,
  stageShift,
  TOUCH_SMOOTHING_MS,
  type ScrollInput,
  variantPlacement,
  viewportRects,
} from "./scrub";
import type { FilmManifest, FilmVariant, ReelChrome, SegmentRegistration } from "./types";

export const REEL_CHROME_EVENT = "cf-reel-chrome";

/** Re-measure segment geometry at most this often while the loop works. */
const GEOMETRY_SAFETY_MS = 500;

/**
 * Canvas clear colour = the landing colour (#06070A). It is everything outside
 * a band tier's band, and the colour the hero's ramp bars inside the band are
 * encoded in, so canvas area the picture does not cover shows no seam.
 */
function readCanvasBg(canvas: HTMLCanvasElement): string {
  const v = getComputedStyle(canvas).getPropertyValue("--cf-recall-bg").trim();
  return v || "#06070A";
}

type Drawable = ImageBitmap | HTMLImageElement;

/** What the scrub feels like right now (the ?hud=1 overlay reads it). */
export type ScrubFeel = { input: ScrollInput; smoothing: number; target: number };

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
  /**
   * The film's cache for the current view (variant picked by pickVariant).
   * Its identity changes when the pick does (rotation, a resize across a tier
   * threshold), which restarts this loop on the new caches.
   */
  cacheFor: (film: FilmManifest) => FrameCache;
  budget: FrameBudget;
  /** Written by every worked tick: input kind, smoothing in effect, target frame. */
  feel: MutableRefObject<ScrubFeel>;
};

export function useScrubLoop({
  canvasRef,
  contentRef,
  invalidateRef,
  segments,
  drawn,
  drawnListeners,
  reducedRef,
  cacheFor,
  budget,
  feel,
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
    // Breath runs on its own clock (t − breathOffset) that holds still while
    // the loop is stopped, so a restart does not pop the zoom.
    let breathOffset = 0;
    let lastReduced = reducedRef.current;
    // While stopped at the end of the reel: a scroll above this restarts it.
    let endY = Number.POSITIVE_INFINITY;
    const canvasBg = readCanvasBg(canvas);
    // Late-frame repaint: what the canvas shows, and how far it is from the
    // wanted frame. A frame landing nearer (or the dissolve's underlay) clears
    // the paint key so the next tick redraws, even with no scroll or breath.
    let shown: { cache: FrameCache | null; want: number; dist: number; under: FrameCache | null } = { cache: null, want: 0, dist: Infinity, under: null };

    // Canvas box (CSS px of the 100lvh wrapper) and the DPR it was sized for.
    // Read on every geometry measure as well as by the wrapper's
    // ResizeObserver: the observer is delivered AFTER the rAF callbacks of
    // the frame a resize lands in, so the tick that handles the resize must
    // see the new box itself, or it paints a frame into the old backing store
    // with a shift computed from the new stage.
    let boxW = 0;
    let boxH = 0;
    let dpr = window.devicePixelRatio || 1;
    let boxDirty = true;
    const readBox = () => {
      const r = box.getBoundingClientRect();
      if (r.width === boxW && r.height === boxH) return false;
      boxW = r.width;
      boxH = r.height;
      boxDirty = true;
      return true;
    };
    readBox();
    const fitCanvas = () => {
      boxDirty = false;
      const { w, h } = backingSize(boxW, boxH, dpr);
      if (!w || !h || (w === canvas.width && h === canvas.height)) return;
      canvas.width = w;
      canvas.height = h;
      stats.canvasResizes++;
      lastKey = "";
    };

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
      const li = segs.length - 1;
      hiddenFrom = li < 0 ? Number.POSITIVE_INFINITY : canvasHiddenFrom(tops[li] ?? 0, heights[li] ?? 0, stageH);
      readBox();
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
    // Below the reel the canvas wrapper is not composited. Shown again from
    // the scroll handler (it runs before the frame's rAF callbacks and paint)
    // as soon as the scroll is above hiddenFrom; written only on change.
    let hiddenFrom = Number.POSITIVE_INFINITY;
    let boxHidden = false;
    const applyVisibility = (scrollY: number) => {
      const hide = scrollY >= hiddenFrom;
      if (hide === boxHidden) return;
      boxHidden = hide;
      box.style.visibility = hide ? "hidden" : "";
    };

    // Kind of the last scroll input (passive listeners, no per-frame cost).
    const touchMs = parseSmoothParam(window.location.search) ?? TOUCH_SMOOTHING_MS;
    let input: ScrollInput = "other";
    let inputAt = Number.NEGATIVE_INFINITY;
    const mark = (kind: ScrollInput) => (e: Event) => {
      input = kind;
      inputAt = e.timeStamp;
    };
    const onWheel = mark("wheel");
    const onTouch = mark("touch");
    const onOther = mark("other");
    const onKey = (e: KeyboardEvent) => {
      if (isScrollKey(e.key)) mark("key")(e);
    };
    // A press on the scrollbar (outside the document's client box) drags it.
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.clientX >= document.documentElement.clientWidth) onOther(e);
    };
    // A click or tap on a link starts a programmatic scroll (a Next <Link
    // href="#…"> jumps with history.pushState, which fires no hashchange), so
    // the jump is "other", not the tap's "touch".
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest("a[href]")) onOther(e);
    };
    const passive = { passive: true } as const;
    window.addEventListener("wheel", onWheel, passive);
    window.addEventListener("touchstart", onTouch, passive);
    window.addEventListener("touchmove", onTouch, passive);
    window.addEventListener("keydown", onKey, passive);
    window.addEventListener("pointerdown", onPointer, passive);
    window.addEventListener("hashchange", onOther, passive);
    window.addEventListener("click", onClick, { passive: true, capture: true });

    const onScroll = (e: Event) => {
      input = scrollInputAt(input, inputAt, e.timeStamp);
      const y = window.scrollY;
      applyVisibility(y);
      if (!raf && y < endY) wake();
    };
    window.addEventListener("scroll", onScroll, passive);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    const boxObserver = new ResizeObserver(() => {
      if (!readBox()) return;
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

    const setChrome = (chrome: ReelChrome, section: string) => {
      const key = `${chrome}|${section}`;
      if (key === lastChrome) return;
      lastChrome = key;
      const root = document.documentElement;
      root.dataset.reelChrome = chrome;
      root.dataset.reelSection = section;
      window.dispatchEvent(new CustomEvent(REEL_CHROME_EVENT, { detail: { chrome, section } }));
    };

    // Shift (backing px) that centres the picture on the stage; set per paint.
    let shiftY = 0;
    // A band tier is placed through its virtual 1080×1920 frame (frames,
    // posters and the dissolve underlay alike), a landscape frame by itself.
    const draw = (img: Drawable, variant: FilmVariant, alpha: number, zoom: number) => {
      const iw = img.width;
      const ih = img.height;
      if (!iw || !ih) return;
      const r = variantPlacement(canvas.width, canvas.height, variant, iw, ih, zoom, shiftY);
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
      // Restart after a stop: hold the breath clock over the stopped time.
      if (resumed) breathOffset = holdBreathClock(breathOffset, lastT, t);
      const bt = t - breathOffset;

      // Idle check: a few comparisons, no layout reads. Breath is quantised to
      // 1/4000 so a hold repaints a few times a second, not 60×.
      const breathNow = lastSeg && !reduced ? Math.round(breathAt(bt, lastSeg.breath) * 4000) / 4000 : 0;
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

      // Measure first: it re-reads the box too, so a resize handled by this
      // tick refits the canvas before the stage shift is computed from it.
      if (geomDirty || t - lastMeasure >= GEOMETRY_SAFETY_MS) measure(t);
      if (boxDirty) fitCanvas();
      applyVisibility(scrollY);

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

      const cache = cacheFor(seg.film);
      const variant = cache.variant;
      const p = reduced ? quantise(pick.progress, seg.reducedSteps) : pick.progress;
      target = frameAt(p, variant.count);

      // Smooth the scrub: a wheel tick jumps the target 10–30 frames; chasing
      // it with an exponential lerp turns that into a short glide instead of
      // a cut. The time constant follows the input (smoothingMs: a finger
      // gets a short one so the film stays under it). Segment change, reduced
      // motion or a restart (anchor jump, back/forward, tab shown) = snap.
      const snapped = smoothSeg !== seg.index || reduced || snap;
      // The smoothing in effect: 0 on a snap (the HUD reports what was applied).
      const smoothing = snapped ? 0 : smoothingMs(input, touchMs);
      if (snapped) {
        smoothFrame = target;
        smoothSeg = seg.index;
      } else {
        smoothFrame = smoothFrameStep(smoothFrame, target, t - lastT, smoothing);
      }
      const f = feel.current;
      f.input = input;
      f.smoothing = smoothing;
      f.target = target;
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
        const beforeCache = before && seg.dissolveIn > 0 ? cacheFor(before.film) : undefined;
        budget.want({
          active: { cache, center: target, direction },
          pin: beforeCache ? { cache: beforeCache, index: beforeCache.variant.count - 1, until: seg.dissolveIn } : undefined,
          next: next ? cacheFor(next.film) : undefined,
        });
      }

      const breath = reduced ? 0 : Math.round(breathAt(bt, seg.breath) * 4000) / 4000;
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
            const prevCache = cacheFor(prev.film);
            const prevVar = prevCache.variant;
            const prevImg = prevCache.nearest(prevVar.count - 1);
            if (prevCache.lastServed !== prevVar.count - 1) shown.under = prevCache;
            if (prevImg) draw(prevImg, prevVar, 1, breath);
            const u = frame / seg.dissolveIn;
            draw(img, variant, u * u * (3 - 2 * u), breath); // smoothstep cross-fade
          } else {
            draw(img, variant, 1, breath);
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
      setChrome(ended ? "body" : "film", seg.section ?? "");

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
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("hashchange", onOther);
      window.removeEventListener("click", onClick, { capture: true });
      box.style.visibility = "";
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      boxObserver.disconnect();
      contentObserver.disconnect();
      if (invalidateRef.current === onResize) invalidateRef.current = () => {};
      offLoad();
    };
  }, [canvasRef, contentRef, invalidateRef, segments, drawn, drawnListeners, reducedRef, cacheFor, budget, feel]);
}
