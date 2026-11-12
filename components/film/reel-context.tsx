"use client";

/**
 * ReelContext — shared state between FilmBackdrop (the fixed canvas) and the
 * FilmSegment sections that drive it.
 *
 * Segments register themselves with their DOM element + film; the backdrop
 * runs one rAF scroll loop, computes which segment is active and its progress,
 * and draws the matching frame. Keeping one loop (not one per segment) is what
 * makes scrubbing smooth.
 */

import { createContext, useContext } from "react";
import type { FilmStats } from "./frame-cache";
import type { ScrubFeel } from "./use-scrub-loop";
import type { FilmManifest, FilmVariant, Orientation, SegmentRegistration } from "./types";

export type ReelApi = {
  reel: FilmManifest[];
  orientation: Orientation;
  register: (reg: SegmentRegistration) => () => void;
  /** Subscribe to "a frame was drawn" ticks (for segments wanting to react). */
  subscribeDrawn: (fn: () => void) => () => void;
  /** Index of the segment currently drawn, -1 before first paint. */
  drawnSegment: () => number;
  drawnFrame: () => number;
  /** Input kind, smoothing in effect and target frame of the last worked tick. */
  feel: () => ScrubFeel;
  /** Live load + draw counters (also window.__filmStats). */
  stats: FilmStats;
};

export const ReelContext = createContext<ReelApi | null>(null);

export function useReel(): ReelApi {
  const ctx = useContext(ReelContext);
  if (!ctx) throw new Error("useReel must be used inside <FilmBackdrop>");
  return ctx;
}

export const PORTRAIT_QUERY = "(max-width: 63.99rem), (orientation: portrait)";

/**
 * What the variant pick depends on: the orientation (PORTRAIT_QUERY) and,
 * within portrait, the canvas backing width (viewBackingWidth). Width only, so
 * a phone address bar showing or hiding never changes it.
 */
export type ReelView = { orientation: Orientation; backingWidth: number };

/** Canvas backing width for a window `innerWidth` CSS px wide (backingSize's rule). */
export function viewBackingWidth(innerWidth: number, dpr: number, maxW = 1920): number {
  if (!(innerWidth > 0)) return 0;
  return Math.min(innerWidth * Math.min(dpr || 1, 2), maxW);
}

export function readOrientation(): Orientation {
  if (typeof window === "undefined") return "landscape";
  return window.matchMedia(PORTRAIT_QUERY).matches ? "portrait" : "landscape";
}

export function readView(): ReelView {
  if (typeof window === "undefined") return { orientation: "landscape", backingWidth: 1920 };
  return { orientation: readOrientation(), backingWidth: viewBackingWidth(window.innerWidth, window.devicePixelRatio) };
}

/**
 * The variant a film is drawn from. Landscape: the landscape variant.
 * Portrait: the narrowest band tier at least as wide as the canvas backing
 * store (900 tier up to 900 px, 1080 tier above), else the widest; landscape
 * when the film has no band tiers.
 */
export function pickVariant(film: FilmManifest, view: ReelView): FilmVariant {
  if (view.orientation !== "portrait" || film.bands.length === 0) return film.landscape;
  let best: FilmVariant | null = null;
  let widest: FilmVariant | null = null;
  for (const t of film.bands) {
    if (!widest || t.width > widest.width) widest = t;
    if (t.width >= view.backingWidth && (!best || t.width < best.width)) best = t;
  }
  return best ?? widest ?? film.landscape;
}

/** Identity of a view's picks for the whole reel: changes only when a pick does. */
export function viewKey(reel: readonly FilmManifest[], view: ReelView): string {
  return reel.map((f) => pickVariant(f, view).name).join("|");
}
