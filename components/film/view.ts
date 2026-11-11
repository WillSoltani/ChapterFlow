/**
 * The variant pick (pure, no React, no "use client"): which film variant a
 * window draws. Shared by the film code (reel-context.tsx re-exports it) and
 * the server-rendered hero poster (first-paint.ts, imported by app/page.tsx,
 * a server component that cannot read values out of a client module).
 */

import type { FilmManifest, FilmVariant, Orientation } from "./types";

export const PORTRAIT_QUERY = "(max-width: 63.99rem), (orientation: portrait)";

/**
 * What the variant pick depends on: the orientation (PORTRAIT_QUERY) and,
 * within portrait, the canvas backing width (viewBackingWidth). Width only, so
 * a phone address bar showing or hiding never changes it.
 */
export type ReelView = { orientation: Orientation; backingWidth: number };

/**
 * DPR steps for the tier pick. A media query cannot multiply width by DPR,
 * so the hero poster's <picture> (first-paint.ts) reads the DPR in these
 * steps, and so does the film code: the two picks agree on every window.
 * Rounding UP means an in-between DPR (browser zoom: 1.1, 1.33) reads as the
 * next step: a borderline window gets the wider tier, never an upscaled
 * narrower one.
 */
export const DPR_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** The DPR the tier pick uses: the next step at or above `dpr` (no DPR = 1), at most 2. */
export function quantDpr(dpr: number): number {
  const r = dpr > 0 ? dpr : 1;
  for (const s of DPR_STEPS) if (r <= s) return s;
  return DPR_STEPS[DPR_STEPS.length - 1]!;
}

/**
 * Canvas backing width the tier pick assumes for a window `innerWidth` CSS px
 * wide: backingSize's rule (DPR capped at 2, at most 1920 px) with the DPR
 * read in DPR_STEPS (quantDpr).
 */
export function viewBackingWidth(innerWidth: number, dpr: number, maxW = 1920): number {
  if (!(innerWidth > 0)) return 0;
  return Math.min(innerWidth * quantDpr(dpr), maxW);
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
