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

export {
  DPR_STEPS,
  PORTRAIT_QUERY,
  pickVariant,
  quantDpr,
  readOrientation,
  readView,
  viewBackingWidth,
  viewKey,
  type ReelView,
} from "./view";
