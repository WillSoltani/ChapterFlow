/**
 * Timeline + manifest helpers.
 *
 * `key(film, name)` resolves a named keyframe from book.timeline.json so copy
 * is pinned to *what the object is doing* ("cover_lift") rather than to a
 * magic frame number. Re-rendering the film only requires editing the JSON.
 *
 * `manifest(name, opts)` builds a FilmManifest for a film folder served from
 * NEXT_PUBLIC_FILM_BASE (CloudFront) or /films (public/) in dev.
 */

import timelineJson from "./book.timeline.json";
import type { FilmManifest, FilmTimeline, FilmVariant } from "./types";

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
};

function variant(name: string, o: VariantOpts): FilmVariant {
  const base = `${FILM_BASE}/${name}`;
  const film = name.replace(/-p$/, "");
  const v = filmVersion(film);
  return {
    name,
    count: o.count ?? filmCount(film),
    pad: o.pad ?? 4,
    ext: o.ext ?? "webp",
    width: o.width,
    height: o.height,
    poster: `${base}/poster.webp${v ? `?v=${v}` : ""}`,
    base,
    ...(v ? { v } : {}),
  };
}

export function manifest(
  name: string,
  opts: { landscape?: Partial<VariantOpts>; portrait?: Partial<VariantOpts> | false } = {},
): FilmManifest {
  const land = variant(name, { width: 1920, height: 1080, ...opts.landscape });
  const port =
    opts.portrait === false
      ? undefined
      : variant(`${name}-p`, { width: 1080, height: 1920, ...opts.portrait });
  return { name, landscape: land, ...(port ? { portrait: port } : {}) };
}
