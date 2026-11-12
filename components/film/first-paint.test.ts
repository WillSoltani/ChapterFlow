import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DPR_STEPS, heroPoster, htmlPosterStands, quantDpr } from "./first-paint";
import { PORTRAIT_QUERY, SHORT_LANDSCAPE_QUERY, pickVariant, viewBackingWidth, viewOrientation } from "./view";
import { manifest } from "./timeline";
import type { BandTier, FilmManifest, FilmVariant } from "./types";

/**
 * A tiny media-query evaluator: just the features the poster media use
 * (width in px or rem at 16 px, orientation, resolution in dppx), comma lists
 * and `and`. Enough to ask "which <source> would the browser pick?".
 */
type Env = { width: number; height: number; dpr: number };
function feature(f: string, env: Env): boolean {
  const m = /^\(\s*(min-|max-)?([a-z-]+)\s*:\s*([^)]+?)\s*\)$/.exec(f.trim());
  if (!m) throw new Error(`unparsed media feature: ${f}`);
  const [, prefix, name, raw] = m as unknown as [string, string | undefined, string, string];
  if (name === "orientation") return (env.height >= env.width ? "portrait" : "landscape") === raw;
  let actual: number;
  let want: number;
  if (name === "width" || name === "height") {
    actual = name === "width" ? env.width : env.height;
    const v = /^([\d.]+)(px|rem)$/.exec(raw);
    if (!v) throw new Error(`unparsed length: ${raw}`);
    want = Number(v[1]) * (v[2] === "rem" ? 16 : 1);
  } else if (name === "resolution") {
    actual = env.dpr;
    const v = /^([\d.]+)dppx$/.exec(raw);
    if (!v) throw new Error(`unparsed resolution: ${raw}`);
    want = Number(v[1]);
  } else throw new Error(`unknown feature ${name}`);
  if (prefix === "min-") return actual >= want;
  if (prefix === "max-") return actual <= want;
  return actual === want;
}
function matches(query: string, env: Env): boolean {
  return query.split(",").some((q) => q.split(/\s+and\s+/).every((f) => feature(f, env)));
}

const WIDTHS: number[] = [];
for (let w = 240; w <= 2600; w += 1) WIDTHS.push(w);
const DPRS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.333, 1.5, 1.75, 1.8, 2, 2.25, 2.5, 2.625, 2.75, 3, 3.5, 4];

/**
 * Short landscape windows (a phone held sideways, a short browser window):
 * heights around the 500 px line, used wherever the window is landscape.
 */
const SHORT_HEIGHTS = [320, 375, 390, 430, 499, 500, 500.5, 501];

function grid(fn: (env: Env) => void) {
  for (const width of WIDTHS)
    for (const dpr of DPRS) {
      for (const height of [Math.round(width * 0.56), Math.round(width * 2.1)]) fn({ width, height, dpr });
      for (const height of SHORT_HEIGHTS) if (width > height) fn({ width, height, dpr });
    }
}

/** What the film code draws for this window (readView + pickVariant). */
function filmPick(film: FilmManifest, env: Env): FilmVariant {
  const orientation = matches(PORTRAIT_QUERY, env) ? "portrait" : "landscape";
  return pickVariant(film, { orientation, backingWidth: viewBackingWidth(env.width, env.dpr) });
}

test("PORTRAIT_QUERY is the pick rule (viewOrientation) on every window of the grid", () => {
  grid((env) => {
    const q = matches(PORTRAIT_QUERY, env) ? "portrait" : "landscape";
    if (q !== viewOrientation(env.width, env.height)) assert.fail(`${env.width}x${env.height}: query ${q}, rule ${viewOrientation(env.width, env.height)}`);
  });
});

/** What the browser shows: the first <source> whose media matches, else the <img>. */
function pictureChoice(film: FilmManifest, env: Env): FilmVariant {
  const p = heroPoster(film);
  return p.sources.find((s) => matches(s.media, env))?.variant ?? p.img;
}

const HERO = manifest("palace-00");

test("quantDpr rounds the DPR UP to the next 1/4 step, capped at 2", () => {
  assert.deepEqual(DPR_STEPS, [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  assert.equal(quantDpr(1), 1);
  assert.equal(quantDpr(1.25), 1.25);
  assert.equal(quantDpr(1.1), 1.25);
  assert.equal(quantDpr(1.333), 1.5);
  assert.equal(quantDpr(2), 2);
  assert.equal(quantDpr(3), 2);
  assert.equal(quantDpr(0.3), 0.5);
  assert.equal(quantDpr(0), 1, "no DPR reported = 1");
});

test("the <picture> source the browser picks is the variant pickVariant draws, on every width and DPR", () => {
  let n = 0;
  grid((env) => {
    n++;
    const want = filmPick(HERO, env).name;
    const got = pictureChoice(HERO, env).name;
    if (got !== want) assert.fail(`${env.width}x${env.height} @${env.dpr}: picture ${got}, film ${want}`);
  });
  assert.ok(n > 400_000, `grid of ${n}`);
});

test("exactly one poster preload matches, the same file the <picture> shows", () => {
  const p = heroPoster(HERO);
  grid((env) => {
    const hits = p.preloads.filter((l) => matches(l.media, env));
    assert.equal(hits.length, 1, `${env.width}x${env.height} @${env.dpr}: ${hits.length} preloads`);
    assert.equal(hits[0]?.href, pictureChoice(HERO, env).poster);
  });
});

test("the known viewports: the browser's poster is the film's variant", () => {
  const cases: Array<[number, number, number, string]> = [
    [390, 844, 3, "palace-00-b900"],
    [430, 932, 3, "palace-00-b900"],
    [820, 1180, 2, "palace-00-b1080"],
    [1440, 900, 1, "palace-00"],
    [1280, 720, 2, "palace-00"],
    [900, 1600, 1, "palace-00-b900"],
    [901, 1600, 1, "palace-00-b1080"],
    [451, 900, 2, "palace-00-b1080"],
    // Phones held sideways and short windows: the landscape frames.
    [844, 390, 3, "palace-00"],
    [667, 375, 2, "palace-00"],
    [932, 430, 3, "palace-00"],
    [568, 320, 2, "palace-00"],
    [900, 500, 1, "palace-00"],
    [900, 501, 1, "palace-00-b900"],
  ];
  for (const [width, height, dpr, name] of cases) {
    const env = { width, height, dpr };
    assert.equal(filmPick(HERO, env).name, name, `film ${width}x${height}@${dpr}`);
    assert.equal(pictureChoice(HERO, env).name, name, `picture ${width}x${height}@${dpr}`);
  }
});

test("poster URLs are the variants' own posters (with ?v=), the URL the film code loads", () => {
  const p = heroPoster(HERO);
  assert.equal(p.img.poster, HERO.landscape.poster);
  assert.match(p.img.poster, /\?v=/);
  const all = [p.img, ...p.sources.map((s) => s.variant)].map((v) => v.name).sort();
  assert.deepEqual(all, ["palace-00", "palace-00-b1080", "palace-00-b900"]);
  for (const s of p.sources) assert.equal(s.src, s.variant.poster);
  assert.deepEqual(p.preloads.map((l) => l.href).sort(), [HERO.landscape.poster, ...HERO.bands.map((b) => b.poster)].sort());
});

test("band placement: the rectangle of the band inside the virtual frame, in percent", () => {
  const p = heroPoster(HERO);
  assert.deepEqual(p.band, { left: 0, top: (474 / 1920) * 100, width: 100, height: (972 / 1920) * 100, aspect: "1080 / 1920", ratio: 1080 / 1920, framePerBand: 1 });
});

test("a film without band tiers: no sources, only the landscape poster", () => {
  const v = (name: string): FilmVariant => ({ name, count: 2, pad: 4, ext: "webp", width: 1920, height: 1080, poster: `/f/${name}/poster.webp`, base: `/f/${name}` });
  const film: FilmManifest = { name: "x", landscape: v("x"), bands: [] as BandTier[] };
  const p = heroPoster(film);
  assert.deepEqual(p.sources, []);
  assert.equal(p.band, null);
  assert.deepEqual(p.preloads, [{ href: "/f/x/poster.webp", media: "all" }]);
});

test("the HTML poster stands only over the first chapter, until the canvas draws there", () => {
  assert.equal(htmlPosterStands(0, false), true);
  assert.equal(htmlPosterStands(0, true), false);
  // A page restored into a later chapter: the first film's frame 0 is the wrong picture.
  for (const seg of [1, 2, 3, 6]) assert.equal(htmlPosterStands(seg, false), false, `segment ${seg}`);
});

test("globals.css: the band placement of the poster applies only to a band poster (data-film-band)", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const start = css.indexOf(`@media ${PORTRAIT_QUERY} {\n  .film-poster`);
  assert.ok(start > 0, "the portrait poster block");
  const block = css.slice(start, css.indexOf("\n}\n", start));
  const selectors = [...block.matchAll(/^\s*([^{}\n]+)\{/gm)].map((m) => m[1]!.trim()).filter((s) => s.startsWith(".film-poster"));
  assert.ok(selectors.length >= 2);
  for (const s of selectors) assert.ok(s.startsWith(".film-poster[data-film-band]"), s);
});

test("globals.css: the compact stage is keyed on SHORT_LANDSCAPE_QUERY, the same windows the pick sends to the landscape frames", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.ok(css.includes(`@media ${SHORT_LANDSCAPE_QUERY} {`), "a compact-stage block");
  // Every short landscape window of the grid is NOT a band window.
  grid((env) => {
    if (matches(SHORT_LANDSCAPE_QUERY, env) && matches(PORTRAIT_QUERY, env)) assert.fail(`${env.width}x${env.height}: short landscape and band`);
  });
});
