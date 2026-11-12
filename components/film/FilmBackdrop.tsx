"use client";

/**
 * FilmBackdrop — the one fixed <canvas> behind the whole landing.
 *
 * Owns:
 *   • a FrameCache per film variant (landscape/portrait picked by media query)
 *   • registration of FilmSegments (they report their DOM element + film)
 *   • the scrub loop (./use-scrub-loop.ts) that paints frames, dissolves
 *     between films, breathes while idle, quantises under reduced motion, and
 *     publishes <html data-reel-chrome="film|body" data-reel-section="…">
 *
 * Math lives in ./scrub.ts (pure, tested). Nothing here re-renders per frame.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { FrameBudget, FrameCache, pickFrameBudgetBytes, type FilmStats } from "./frame-cache";
import { ReelContext, PORTRAIT_QUERY, pickVariant, readOrientation, type ReelApi } from "./reel-context";
import { useScrubLoop } from "./use-scrub-loop";
import type { FilmManifest, Orientation, SegmentRegistration } from "./types";

export { REEL_CHROME_EVENT } from "./use-scrub-loop";

type Props = { reel: FilmManifest[]; children: ReactNode; className?: string };

export function FilmBackdrop({ reel, children, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // Set by the scrub loop: re-measure segment geometry (and wake the loop).
  const invalidateRef = useRef<() => void>(() => {});
  const segments = useRef(new Map<number, SegmentRegistration>());
  const caches = useRef(new Map<string, FrameCache>());
  // One decoded-pixel budget and load scheduler for every cache on the page
  // (see FrameBudget).
  const [budget] = useState(() => new FrameBudget(pickFrameBudgetBytes()));
  const drawnListeners = useRef(new Set<() => void>());
  const drawn = useRef({ segment: -1, frame: -1 });
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(false);
  // The RENDERED orientation starts as "landscape" on both server and client so
  // hydration matches; the media query is applied in the effect below. But the
  // caches must pick the right variant from the very first tick: child
  // segments register (and warm their caches) in their own effects, which run
  // before this component's, and the scrub loop's first frame follows at once.
  // So variant selection reads a ref that is filled synchronously during the
  // first client render — otherwise every phone downloaded the first frames of
  // all seven landscape variants (~5 MB) before switching to the portrait ones.
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const orientationRef = useRef<Orientation | null>(null);
  if (orientationRef.current === null) orientationRef.current = readOrientation();

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  // Load counters, always on (production too) so a real phone can be read:
  // window.__filmStats (fetches, refetches, draw accuracy; see FilmStats).
  // Dev-only introspection for probes: window.__filmCaches (name@v →
  // FrameCache) and window.__filmBudget.
  useEffect(() => {
    const w = window as unknown as {
      __filmStats?: FilmStats;
      __filmCaches?: Map<string, FrameCache>;
      __filmBudget?: FrameBudget;
    };
    w.__filmStats = budget.stats;
    const dev = process.env.NODE_ENV !== "production";
    if (dev) {
      w.__filmCaches = caches.current;
      w.__filmBudget = budget;
    }
    return () => {
      if (w.__filmStats === budget.stats) delete w.__filmStats;
      if (dev) {
        delete w.__filmCaches;
        delete w.__filmBudget;
      }
    };
  }, [budget]);

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY);
    const sync = () => {
      const o = readOrientation();
      orientationRef.current = o;
      setOrientation(o);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const cacheFor = useCallback(
    (film: FilmManifest): FrameCache => {
      const v = pickVariant(film, orientationRef.current ?? orientation);
      const key = `${v.name}@${v.v ?? "0"}`;
      let c = caches.current.get(key);
      if (!c) {
        c = new FrameCache(v, budget);
        caches.current.set(key, c);
        void c.loadPoster();
      }
      return c;
    },
    // `orientation` is in the deps so the callback (and everything keyed on it,
    // e.g. the scrub loop's effect) refreshes when the media query flips.
    [orientation, budget],
  );

  useEffect(() => {
    const map = caches.current;
    return () => {
      for (const c of map.values()) c.dispose();
      map.clear();
    };
  }, []);

  const api = useMemo<ReelApi>(
    () => ({
      reel,
      orientation,
      register: (reg) => {
        segments.current.set(reg.index, reg);
        invalidateRef.current();
        // Every film gets its cache (and so its poster, one small image) at
        // mount, so a chapter reached on a slow network draws its poster
        // instead of nothing. Only the first two films warm real frames here
        // (the first film's opening, the second's head): warming all seven
        // cost ~84 frame requests before the visitor had scrolled a pixel.
        // The plan is weak: once the scrub loop has decided, it is ignored.
        cacheFor(reg.film);
        const first = segments.current.get(0);
        if (reg.index < 2 && first) {
          const second = segments.current.get(1);
          budget.want(
            { active: { cache: cacheFor(first.film), center: 0, direction: 1 }, next: second ? cacheFor(second.film) : undefined },
            { weak: true },
          );
        }
        return () => {
          if (segments.current.get(reg.index) === reg) {
            segments.current.delete(reg.index);
            invalidateRef.current();
          }
        };
      },
      subscribeDrawn: (fn) => {
        drawnListeners.current.add(fn);
        return () => {
          drawnListeners.current.delete(fn);
        };
      },
      drawnSegment: () => drawn.current.segment,
      drawnFrame: () => drawn.current.frame,
      stats: budget.stats,
    }),
    [reel, orientation, cacheFor, budget],
  );

  useScrubLoop({ canvasRef, contentRef, invalidateRef, segments, drawn, drawnListeners, reducedRef, orientation, cacheFor, budget });

  return (
    <ReelContext.Provider value={api}>
      {/* The canvas is a fixed layer at z-0 INSIDE the page's stacking
          context; chapters/body sit above at z-10. (A -z-10 layer would fall
          behind the .landing-dark background and never show.)
          The box is the LARGE viewport (100lvh), pinned to the top: a phone's
          address bar showing or hiding never resizes it, so the backing store
          is not reallocated and the picture keeps its scale and place (the
          loop centres it on the 100svh stage). */}
      <div
        aria-hidden
        className={`film-canvas pointer-events-none fixed inset-x-0 top-0 z-0 h-lvh w-full ${className ?? ""}`}
        // Own compositor layer: scrolling the page must not re-rasterise the
        // canvas, and the canvas repaint must not invalidate the page.
        style={{ transform: "translateZ(0)", contain: "strict" }}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <div ref={contentRef} className="relative z-10">
        {children}
      </div>
    </ReelContext.Provider>
  );
}
