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
import type { FilmManifest, Orientation, SegmentRegistration } from "./types";

export type ReelApi = {
  reel: FilmManifest[];
  orientation: Orientation;
  register: (reg: SegmentRegistration) => () => void;
  /** Subscribe to "a frame was drawn" ticks (for segments wanting to react). */
  subscribeDrawn: (fn: () => void) => () => void;
  /** Index of the segment currently drawn, -1 before first paint. */
  drawnSegment: () => number;
  drawnFrame: () => number;
};

export const ReelContext = createContext<ReelApi | null>(null);

export function useReel(): ReelApi {
  const ctx = useContext(ReelContext);
  if (!ctx) throw new Error("useReel must be used inside <FilmBackdrop>");
  return ctx;
}

export const PORTRAIT_QUERY = "(max-width: 63.99rem), (orientation: portrait)";

export function readOrientation(): Orientation {
  if (typeof window === "undefined") return "landscape";
  return window.matchMedia(PORTRAIT_QUERY).matches ? "portrait" : "landscape";
}

export function pickVariant(film: FilmManifest, orientation: Orientation) {
  return orientation === "portrait" && film.portrait ? film.portrait : film.landscape;
}
