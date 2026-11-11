import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVariant, viewBackingWidth, viewKey, type ReelView } from "./reel-context";
import { frameUrl } from "./frame-cache";
import { manifest } from "./timeline";
import type { BandTier, FilmManifest, FilmVariant } from "./types";

const FRAME = { w: 1080, h: 1920 };
const BAND = { x: 0, y: 474, w: 1080, h: 972 };

function v(name: string, width: number, height: number): FilmVariant {
  return { name, count: 10, pad: 4, ext: "webp", width, height, poster: `/films/${name}/poster.webp`, base: `/films/${name}` };
}
function tier(name: string, width: number, height: number): BandTier {
  return { ...v(name, width, height), frame: FRAME, band: BAND };
}
const film = (name: string, bands = true): FilmManifest => ({
  name,
  landscape: v(name, 1920, 1080),
  bands: bands ? [tier(`${name}-b900`, 900, 810), tier(`${name}-b1080`, 1080, 972)] : [],
});

const portrait = (backingWidth: number): ReelView => ({ orientation: "portrait", backingWidth });

test("viewBackingWidth: CSS width × DPR capped at 2, never wider than 1920", () => {
  assert.equal(viewBackingWidth(390, 2), 780); // iPhone 14
  assert.equal(viewBackingWidth(390, 3), 780); // DPR 3 is capped at 2
  assert.equal(viewBackingWidth(430, 3), 860); // iPhone Pro Max
  assert.equal(viewBackingWidth(450, 2), 900);
  assert.equal(viewBackingWidth(451, 2), 902);
  assert.equal(viewBackingWidth(820, 2), 1640); // iPad Air portrait
  assert.equal(viewBackingWidth(1024, 2), 1920); // capped like backingSize
  assert.equal(viewBackingWidth(390, 0), 390); // no DPR reported = 1
  assert.equal(viewBackingWidth(0, 2), 0);
});

test("pickVariant: landscape view draws the landscape variant", () => {
  assert.equal(pickVariant(film("a"), { orientation: "landscape", backingWidth: 780 }).name, "a");
  assert.equal(pickVariant(film("a"), { orientation: "landscape", backingWidth: 1920 }).name, "a");
});

test("pickVariant: portrait picks the 900 tier up to 900 backing px, the 1080 tier above", () => {
  assert.equal(pickVariant(film("a"), portrait(390)).name, "a-b900");
  assert.equal(pickVariant(film("a"), portrait(780)).name, "a-b900");
  assert.equal(pickVariant(film("a"), portrait(900)).name, "a-b900");
  assert.equal(pickVariant(film("a"), portrait(901)).name, "a-b1080");
  assert.equal(pickVariant(film("a"), portrait(1640)).name, "a-b1080");
  assert.equal(pickVariant(film("a"), portrait(1920)).name, "a-b1080");
});

test("pickVariant: tier order in the manifest does not matter", () => {
  const f = film("a");
  const reversed = { ...f, bands: [...f.bands].reverse() };
  assert.equal(pickVariant(reversed, portrait(780)).name, "a-b900");
  assert.equal(pickVariant(reversed, portrait(1640)).name, "a-b1080");
});

test("pickVariant: portrait without band tiers falls back to landscape", () => {
  assert.equal(pickVariant(film("a", false), portrait(780)).name, "a");
});

test("viewKey changes only when a pick changes, not with every width", () => {
  const reel = [film("a"), film("b")];
  assert.equal(viewKey(reel, portrait(780)), viewKey(reel, portrait(860)));
  assert.equal(viewKey(reel, portrait(1180)), viewKey(reel, portrait(1640)));
  assert.notEqual(viewKey(reel, portrait(900)), viewKey(reel, portrait(901)));
  assert.notEqual(viewKey(reel, portrait(780)), viewKey(reel, { orientation: "landscape", backingWidth: 780 }));
  assert.equal(viewKey(reel, { orientation: "landscape", backingWidth: 780 }), viewKey(reel, { orientation: "landscape", backingWidth: 1920 }));
});

test("manifest: landscape URLs are the film folder with the film's version; tiers have their own", () => {
  const m = manifest("palace-00");
  assert.equal(m.landscape.name, "palace-00");
  assert.equal(m.landscape.base, "/films/palace-00");
  assert.equal(m.landscape.width, 1920);
  assert.equal(m.landscape.height, 1080);
  assert.match(m.landscape.poster, /^\/films\/palace-00\/poster\.webp\?v=[a-z0-9]+$/);
  assert.equal(frameUrl(m.landscape, 0), `/films/palace-00/f_0001.webp?v=${m.landscape.v}`);
  assert.deepEqual(
    m.bands.map((b) => [b.name, b.width, b.height]),
    [
      ["palace-00-b900", 900, 810],
      ["palace-00-b1080", 1080, 972],
    ],
  );
  for (const b of m.bands) {
    assert.deepEqual(b.frame, FRAME);
    assert.deepEqual(b.band, BAND);
    assert.ok(b.v && b.v !== m.landscape.v, `${b.name} carries its own version`);
    assert.equal(b.poster, `/films/${b.name}/poster.webp?v=${b.v}`);
    assert.equal(b.count, m.landscape.count);
  }
});

test("no runtime variant points at a legacy '-p' folder", () => {
  for (const n of ["palace-00", "palace-01", "palace-02", "palace-03", "palace-04", "palace-05", "palace-06"]) {
    const m = manifest(n);
    for (const x of [m.landscape, ...m.bands]) assert.doesNotMatch(x.base, /-p$/);
    assert.equal(m.bands.length, 2, `${n} has both band tiers`);
  }
});
