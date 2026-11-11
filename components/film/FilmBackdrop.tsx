"use client";

/**
 * FilmBackdrop — the one fixed <canvas> behind the whole landing.
 *
 * Owns:
 *   • a FrameCache per film variant: landscape, or on portrait screens the
 *     band tier that fits the canvas backing width (pickVariant)
 *   • the pack client (pack-client.ts): variants with a pack load through the
 *     film worker, one stream per film, decoded off the main thread; the
 *     worker starts with the first scroll decision; ?pack=0 (or no Worker)
 *     keeps every variant on the per-frame path
 *   • registration of FilmSegments (they report their DOM element + film)
 *   • the scrub loop (./use-scrub-loop.ts) that paints frames, dissolves
 *     between films, breathes while idle, quantises under reduced motion, and
 *     publishes <html data-reel-chrome="film|body" data-reel-section="…">,
 *     and hides the canvas wrapper below the reel (not composited under the
 *     body sections)
 *   • first paint (Phase 6): the first film's poster as a server-rendered
 *     <picture> over the canvas (sources from first-paint.ts, placed by CSS
 *     exactly where the canvas draws it), removed in the frame the canvas
 *     first draws a picture; the reel's armed marker (data-film-armed, after
 *     every pin has written its state); the <noscript> layout; static mode
 *     (data-film-static: no 2D context, or the film is unreachable and the
 *     budget halted) where the poster stays and the loop runs without
 *     painting
 *   • recovery (Phase 6b): the browser's `online` event and the document's
 *     visibility go to the budget (recovery signals, frame-cache.ts); when a
 *     probe un-halts it, data-film-static goes, the posters the halt skipped
 *     load, and the canvas draws again as frames land
 *
 * Math lives in ./scrub.ts (pure, tested). Nothing here re-renders per frame.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { FrameBudget, FrameCache, pickFrameBudgetBytes, type FilmStats } from "./frame-cache";
import { heroPoster } from "./first-paint";
import { failsafeCss, noscriptCss } from "./readable-layout";
import { PACK_CAP_LARGE, PACK_CAP_SMALL, PackClient, packModeAllowed } from "./pack-client";
import { ReelContext, PORTRAIT_QUERY, pickVariant, readView, viewKey, type ReelApi, type ReelView } from "./reel-context";
import { useScrubLoop, type ScrubFeel } from "./use-scrub-loop";
import type { FilmManifest, Orientation, SegmentRegistration } from "./types";

export { REEL_CHROME_EVENT } from "./use-scrub-loop";

type Props = {
  reel: FilmManifest[];
  children: ReactNode;
  className?: string;
};

/** The view the server renders (and the client hydrates) with. */
const SERVER_VIEW: ReelView = { orientation: "landscape", backingWidth: 1920 };

/**
 * The readable-page rules (readable-layout.ts), rendered once per page: the
 * failsafe sheet before the reel (parsed before any pin, so later pins never
 * flash), the <noscript> sheet after it. Inline <style> is allowed by the CSP
 * (style-src 'unsafe-inline', lib/csp.ts), so neither needs the nonce.
 */
const FAILSAFE_CSS = failsafeCss();
const NOSCRIPT_CSS = noscriptCss();

export function FilmBackdrop({ reel, children, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const posterRef = useRef<HTMLDivElement | null>(null);
  // The canvas's 2D context, asked for once (null = static mode). Read lazily:
  // segments register (and create caches) in their effects, before ours.
  const ctxRef = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  // Set by the scrub loop: re-measure segment geometry (and wake the loop).
  const invalidateRef = useRef<() => void>(() => {});
  const segments = useRef(new Map<number, SegmentRegistration>());
  const caches = useRef(new Map<string, FrameCache>());
  // One decoded-pixel budget and load scheduler for every cache on the page
  // (see FrameBudget), and the film worker's client when packs may be used.
  // Neither starts any work here: the worker starts with the first scroll
  // decision (never during server render: packModeAllowed is false there).
  const [{ budget, packs }] = useState(() => {
    const b = new FrameBudget(pickFrameBudgetBytes());
    const client = packModeAllowed() ? new PackClient({ stats: b.stats, capBytes: b.small ? PACK_CAP_SMALL : PACK_CAP_LARGE }) : null;
    if (client) b.attachPacks(client);
    return { budget: b, packs: client };
  });
  const drawnListeners = useRef(new Set<() => void>());
  const drawn = useRef({ segment: -1, frame: -1 });
  const feel = useRef<ScrubFeel>({ input: "other", smoothing: 90, target: -1 });
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(false);
  // The RENDERED view starts as landscape on both server and client so
  // hydration matches; the media query and window width are applied in the
  // effect below. But the caches must pick the right variant from the very
  // first tick: child segments register (and warm their caches) in their own
  // effects, which run before this component's, and the scrub loop's first
  // frame follows at once. So variant selection reads a ref that is filled
  // synchronously during the first client render — otherwise every phone
  // downloaded the first frames (and posters) of another variant before
  // switching. The view = orientation + canvas backing width (width only: a
  // phone address bar never changes it). The `view` state is replaced only
  // when a film's pick changes (rotation, a resize across a tier threshold,
  // viewKey); that refreshes the caches and the scrub loop (cacheFor's
  // identity), as an orientation flip always did.
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [view, setView] = useState<ReelView>(SERVER_VIEW);
  const viewRef = useRef<ReelView | null>(null);
  if (viewRef.current === null) viewRef.current = readView();

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
      const v = readView();
      viewRef.current = v;
      setOrientation(v.orientation);
      setView((prev) => (viewKey(reel, prev) === viewKey(reel, v) ? prev : v));
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [reel]);

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    if (ctxRef.current === undefined) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = canvas.getContext("2d", { alpha: false });
      } catch {
        ctx = null;
      }
      ctxRef.current = ctx;
      // No canvas to draw on: static mode, nothing is ever loaded.
      if (!ctx) budget.halt();
    }
    return ctxRef.current;
  }, [budget]);

  const cacheFor = useCallback(
    (film: FilmManifest): FrameCache => {
      const v = pickVariant(film, viewRef.current ?? view);
      const key = `${v.name}@${v.v ?? "0"}`;
      let c = caches.current.get(key);
      if (!c) {
        c = new FrameCache(v, budget);
        caches.current.set(key, c);
        // Static mode (no canvas, or the film is unreachable): no posters.
        if (getCtx() && !budget.halted) void c.loadPoster();
      }
      return c;
    },
    // `view` is in the deps so the callback (and everything keyed on it, e.g.
    // the scrub loop's effect) refreshes when a film's variant changes.
    [view, budget, getCtx],
  );

  // Armed: every pin below has written its own state (child effects run
  // first), so the CSS that hides later pins before hydration can let go.
  // Static mode is published on the same element when the budget halts.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.dataset.filmArmed = "";
    const markStatic = () => {
      el.dataset.filmStatic = "";
    };
    if (budget.halted) markStatic();
    const offHalt = budget.onHalt(markStatic);
    const offResume = budget.onResume(() => {
      delete el.dataset.filmStatic;
      // Posters of films whose cache was made while halted were skipped.
      if (getCtx()) for (const c of caches.current.values()) void c.loadPoster();
    });
    return () => {
      offHalt();
      offResume();
    };
  }, [budget, getCtx]);

  // Recovery signals (frame-cache.ts): back online, or shown again after a
  // while hidden.
  useEffect(() => {
    const onOnline = () => budget.noteOnline();
    const onVisibility = () => budget.noteVisibility(document.visibilityState === "hidden");
    onVisibility();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [budget]);

  const onFirstPaint = useCallback(() => {
    const p = posterRef.current;
    if (p) p.style.display = "none";
  }, []);

  // The worker reads the reel's variants for the current view (the same pick
  // as cacheFor) when the scroll loop first tells it where the visitor is.
  useEffect(() => {
    packs?.setReel(() => reel.map((f) => pickVariant(f, viewRef.current ?? SERVER_VIEW)));
  }, [packs, reel]);

  useEffect(() => {
    const map = caches.current;
    budget.revive();
    return () => {
      for (const c of map.values()) c.dispose();
      map.clear();
      packs?.dispose();
      // Stops the budget's probe timers (frame-cache.ts dispose).
      budget.dispose();
    };
  }, [packs, budget]);

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
        // In pack mode there is no warm-up: before the first scroll the
        // worker reads only the first film's opening (pack-plan.ts).
        cacheFor(reg.film);
        const first = segments.current.get(0);
        if (reg.index < 2 && first && !(packs && budget.packMode(cacheFor(first.film)))) {
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
      feel: () => feel.current,
      stats: budget.stats,
    }),
    [reel, orientation, cacheFor, budget, packs],
  );

  useScrubLoop({ canvasRef, contentRef, invalidateRef, segments, drawn, drawnListeners, reducedRef, cacheFor, budget, feel, getCtx, onFirstPaint });

  const first = reel[0];
  const poster = first ? heroPoster(first) : null;

  return (
    <ReelContext.Provider value={api}>
      <style dangerouslySetInnerHTML={{ __html: FAILSAFE_CSS }} />
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
        {/* The first film's poster, in the server HTML so it paints before
            any script (preloaded by the <link>s below, same media). The
            <picture> picks the variant the film code will draw (first-
            paint.ts); globals.css (.film-poster) places it exactly where the
            canvas draws that variant's first picture. Over the canvas, with
            the page colour behind it, until the canvas's first real paint
            (onFirstPaint); in static mode it stays. */}
        {poster ? (
          <div
            ref={posterRef}
            data-film-poster=""
            // Band placement (globals.css) only for a band tier: a first film
            // without tiers draws its landscape poster cover-fitted everywhere.
            data-film-band={poster.band ? "" : undefined}
            className="film-poster"
            style={
              poster.band
                ? ({
                    "--film-band-left": `${poster.band.left}%`,
                    "--film-band-top": `${poster.band.top}%`,
                    "--film-band-width": `${poster.band.width}%`,
                    "--film-band-height": `${poster.band.height}%`,
                    "--film-frame-aspect": poster.band.aspect,
                    "--film-frame-ratio": String(poster.band.ratio),
                  } as CSSProperties)
                : undefined
            }
          >
            <picture>
              {poster.sources.map((s) => (
                <source key={s.variant.name} media={s.media} srcSet={s.src} />
              ))}
              <img
                src={poster.img.poster}
                alt=""
                fetchPriority="high"
                loading="eager"
                decoding="async"
                {...({ elementtiming: "film-poster" } as Record<string, string>)}
              />
            </picture>
          </div>
        ) : null}
      </div>
      {/* The poster's preloads, one per variant, with mutually exclusive
          media that select the same file as the <picture> (first-paint.ts):
          the browser starts exactly one poster, at high priority, from
          <head> (React hoists these <link>s there), before any script.
          Rendered here, not from a server component: a <link rel=preload>
          or preload() there also becomes a Link response header, where
          React percent-encodes the commas of the media list. */}
      {poster?.preloads.map((p) => (
        <link key={p.href} rel="preload" as="image" href={p.href} media={p.media} fetchPriority="high" />
      ))}
      <div ref={contentRef} data-film-reel="" className="relative z-10">
        {children}
      </div>
      <noscript dangerouslySetInnerHTML={{ __html: `<style>${NOSCRIPT_CSS}</style>` }} />
    </ReelContext.Provider>
  );
}
