/**
 * First paint: the hero poster in the server HTML (Phase 6).
 *
 * The server does not know the viewport, so the poster the browser loads is
 * chosen by <picture> media queries that reproduce the film code's own pick
 * (reel-context.ts pickVariant on readView): landscape views draw the
 * landscape variant; portrait views (PORTRAIT_QUERY) draw the narrowest band
 * tier at least as wide as the canvas backing store, backing = innerWidth ×
 * quantDpr(devicePixelRatio). A media query cannot multiply width by DPR, so
 * the DPR is read in steps (DPR_STEPS, rounded UP, capped at 2) on BOTH sides:
 * one `(resolution range) and (max-width: T / step)` clause per step. The
 * film code quantises the same way (viewBackingWidth), so the two picks agree
 * on every width and DPR (first-paint.test.ts walks the grid), and the
 * browser downloads exactly one poster: the file the film code then loads.
 *
 * Pure: no DOM, no React. Media strings, poster URLs and the band rectangle
 * all come from here; FilmBackdrop renders them and app/page.tsx preloads
 * them.
 */

import { DPR_STEPS, PORTRAIT_QUERY } from "./view";
import type { BandTier, FilmManifest, FilmVariant } from "./types";

export { DPR_STEPS, quantDpr } from "./view";

/** Canvas backing widths are capped here (backingSize / viewBackingWidth). */
const MAX_BACKING = 1920;
/** Exclusive lower bounds in legacy media syntax (min-* is inclusive). */
const EPS = 1e-4;

const num = (n: number) => String(Math.round(n * 1e4) / 1e4);
const floor4 = (n: number) => Math.floor(n * 1e4) / 1e4;

/** The resolution range of each step: (previous step, step]. */
function resolutionRanges(): Array<{ step: number; media: string }> {
  return DPR_STEPS.map((step, i) => {
    const prev = DPR_STEPS[i - 1];
    if (prev === undefined) return { step, media: `(max-resolution: ${num(step)}dppx)` };
    if (i === DPR_STEPS.length - 1) return { step, media: `(min-resolution: ${num(prev + EPS)}dppx)` };
    return { step, media: `(min-resolution: ${num(prev + EPS)}dppx) and (max-resolution: ${num(step)}dppx)` };
  });
}

const PORTRAIT_PARTS = PORTRAIT_QUERY.split(",").map((s) => s.trim());
/** Not PORTRAIT_QUERY: wider than 63.99rem AND landscape. */
const LANDSCAPE_MEDIA = "(min-width: 63.9901rem) and (orientation: landscape)";

/**
 * Portrait AND canvas backing width in (lo, hi] (lo/hi in backing px; null =
 * unbounded). A media query list, or null when no window can match.
 */
function portraitBacking(lo: number | null, hi: number | null): string | null {
  if (lo === null && hi === null) return PORTRAIT_QUERY;
  const clauses: string[] = [];
  for (const { step, media } of resolutionRanges()) {
    // backing = min(width × step, MAX_BACKING)
    if (lo !== null && lo >= MAX_BACKING) continue;
    const parts = [media];
    if (lo !== null) parts.push(`(min-width: ${num(floor4(lo / step) + EPS)}px)`);
    if (hi !== null && hi < MAX_BACKING) parts.push(`(max-width: ${num(floor4(hi / step))}px)`);
    for (const p of PORTRAIT_PARTS) clauses.push([p, ...parts].join(" and "));
  }
  return clauses.length ? clauses.join(", ") : null;
}

export type HeroPoster = {
  /** The <img> (landscape views). */
  img: FilmVariant;
  /** <source>s in order: the browser takes the first whose media matches. */
  sources: Array<{ media: string; src: string; variant: BandTier }>;
  /** One <link rel=preload as=image> per poster; the media are mutually exclusive. */
  preloads: Array<{ href: string; media: string }>;
  /**
   * Where a band tier's poster sits inside the virtual frame (percent of its
   * width / height), and that frame's aspect ratio; null without tiers.
   */
  band: { left: number; top: number; width: number; height: number; aspect: string; ratio: number } | null;
};

/** The hero poster of `film`: sources, preloads and band placement. */
export function heroPoster(film: FilmManifest): HeroPoster {
  const tiers = [...film.bands].sort((a, b) => a.width - b.width);
  const img = film.landscape;
  if (tiers.length === 0) return { img, sources: [], preloads: [{ href: img.poster, media: "all" }], band: null };

  const first = tiers[0]!;
  for (const t of tiers) {
    const same = t.frame.w === first.frame.w && t.frame.h === first.frame.h && t.band.x === first.band.x && t.band.y === first.band.y && t.band.w === first.band.w && t.band.h === first.band.h;
    if (!same) throw new Error(`heroPoster: band tiers of ${film.name} differ in frame or band; the poster CSS places them alike`);
  }

  const sources: HeroPoster["sources"] = [];
  const preloads: HeroPoster["preloads"] = [];
  tiers.forEach((t, i) => {
    const widest = i === tiers.length - 1;
    const prev = tiers[i - 1];
    // <source>: first match wins, so a tier only needs "backing ≤ its width".
    const media = widest ? PORTRAIT_QUERY : portraitBacking(null, t.width);
    if (media) sources.push({ media, src: t.poster, variant: t });
    // Preloads are independent: each takes its own exclusive range.
    const range = portraitBacking(prev ? prev.width : null, widest ? null : t.width);
    if (range) preloads.push({ href: t.poster, media: range });
  });
  preloads.push({ href: img.poster, media: LANDSCAPE_MEDIA });

  const { frame, band } = first;
  return {
    img,
    sources,
    preloads,
    band: {
      left: (band.x / frame.w) * 100,
      top: (band.y / frame.h) * 100,
      width: (band.w / frame.w) * 100,
      height: (band.h / frame.h) * 100,
      aspect: `${frame.w} / ${frame.h}`,
      ratio: frame.w / frame.h,
    },
  };
}

/**
 * Whether the HTML poster (the first film's frame 0) still stands in for the
 * canvas: only over the first chapter, and only until the canvas has drawn
 * its own picture there. Over any later chapter (a reload restored further
 * down, a link to #quiz) it would show the wrong picture behind that
 * chapter's copy, so it goes at once and the page colour shows until that
 * chapter's own poster or frame lands. Static mode never asks: no canvas, the
 * poster stays.
 */
export function htmlPosterStands(activeSegment: number, canvasDrew: boolean): boolean {
  return activeSegment === 0 && !canvasDrew;
}
