/**
 * Timeline + manifest helpers.
 *
 * `key(film, name)` resolves a named keyframe from book.timeline.json so copy
 * is pinned to *what the object is doing* ("cover_lift") rather than to a
 * magic frame number. Re-rendering the film only requires editing the JSON.
 *
 * `manifest(name, opts)` builds a FilmManifest for a film folder served from
 * NEXT_PUBLIC_FILM_BASE (CloudFront) or /films (public/) in dev: the
 * landscape variant ("<name>", the film's `v`) and the band-only portrait
 * tiers ("<name>-b900", "<name>-b1080", each with its own `v`); each variant
 * carries its pack layout when the timeline records one.
 */

import timelineJson from "./book.timeline.json";
import type { PackLayout } from "./pack-format";
import type { BandTier, FilmManifest, FilmTimeline, FilmVariant } from "./types";

const timeline = timelineJson as unknown as FilmTimeline;

export const FILM_BASE = (process.env.NEXT_PUBLIC_FILM_BASE ?? "/films").replace(/\/+$/, "");

export function filmCount(name: string): number {
  const f = timeline.films[name];
  if (!f) throw new Error(`timeline: unknown film "${name}"`);
  return f.count;
}

export function filmVersion(name: string): string | undefined {
  return timeline.films[name]?.v;
}

export function key(film: string, name: string): number {
  const f = timeline.films[film];
  if (!f) throw new Error(`timeline: unknown film "${film}"`);
  const k = f.keys[name];
  if (k === undefined) throw new Error(`timeline: film "${film}" has no key "${name}"`);
  return k;
}

/** Frame range [from, to] relative to a key, clamped to the film. */
export function range(film: string, name: string, before = 0, after = 24): [number, number] {
  const k = key(film, name);
  const n = filmCount(film);
  return [Math.max(0, k - before), Math.min(n - 1, k + after)];
}

type VariantOpts = {
  width: number;
  height: number;
  ext?: FilmVariant["ext"];
  pad?: number;
  count?: number;
  pack?: PackLayout | undefined;
};

/** A variant of `film` served from the folder `dir`, versioned `v`. */
function variant(film: string, dir: string, v: string | undefined, o: VariantOpts): FilmVariant {
  const base = `${FILM_BASE}/${dir}`;
  return {
    name: dir,
    count: o.count ?? filmCount(film),
    pad: o.pad ?? 4,
    ext: o.ext ?? "webp",
    width: o.width,
    height: o.height,
    poster: `${base}/poster.webp${v ? `?v=${v}` : ""}`,
    base,
    ...(v ? { v } : {}),
    ...(o.pack ? { pack: { ...o.pack } } : {}),
  };
}

/**
 * Band tiers of `film` from book.timeline.json (films.<film>.bands, synced by
 * encode.mjs --bands), narrowest first. Folder "<film>-<tier>", own version.
 */
export function bandTiers(film: string): BandTier[] {
  const bands = timeline.films[film]?.bands ?? {};
  return Object.entries(bands)
    .map(([tier, b]) => ({
      ...variant(film, `${film}-${tier}`, b.v, { width: b.width, height: b.height, pack: b.pack }),
      frame: { w: b.frame.w, h: b.frame.h },
      band: { x: b.band.x, y: b.band.y, w: b.band.w, h: b.band.h },
    }))
    .sort((a, b) => a.width - b.width);
}

export function manifest(
  name: string,
  opts: { landscape?: Partial<VariantOpts>; bands?: false } = {},
): FilmManifest {
  const land = variant(name, name, filmVersion(name), { width: 1920, height: 1080, pack: timeline.films[name]?.pack, ...opts.landscape });
  return { name, landscape: land, bands: opts.bands === false ? [] : bandTiers(name) };
}
