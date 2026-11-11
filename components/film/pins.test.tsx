import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BookReelLanding } from "./BookReelLanding";
import { PinCollectContext, type PinCollector } from "./pin-registry";
import {
  beatSpans,
  chainOpacity,
  focusFrame,
  frameScroll,
  fullyOnRange,
  minPinnedFrame,
  pin,
  pinChains,
  reducedHeightSvh,
  reducedStopIndex,
  reducedStopScroll,
  reducedStops,
  REDUCED_STEP_SVH,
  type PinRange,
} from "./pins";
import { filmCount, filmKeys } from "./timeline";

/**
 * Reduced-motion stops (Phase 8): derived from a chapter's pins and named
 * keyframes, checked here against the REAL reel (every FramePin the landing
 * renders, with the scrims it sits in, collected at render time).
 */

type Seg = { id: string; film: string; stops: readonly number[] };
const segs = new Map<string, Seg>();
const collected: Array<{ seg: string; chain: readonly PinRange[]; text: string }> = [];
const collector: PinCollector = {
  segment: (id, film, stops) => segs.set(id, { id, film, stops }),
  pin: (seg, chain, text) => collected.push({ seg, chain, text }),
};
renderToStaticMarkup(
  <PinCollectContext.Provider value={collector}>
    <BookReelLanding />
  </PinCollectContext.Provider>,
);

test("the collector saw the whole reel: seven chapters, every pin", () => {
  assert.equal(segs.size, 7);
  // 7 chapters' copy: scrims and pins (the landing had 45 FramePins at Phase 7).
  assert.ok(collected.length >= 40, `collected ${collected.length} pins`);
  for (const p of collected) assert.ok(segs.has(p.seg), `pin "${p.text}" in an unknown chapter ${p.seg}`);
});

test("REAL reel: every pin of every chapter is fully on at one of its chapter's stops", () => {
  for (const s of segs.values()) console.log(`${s.id} (${s.film}): stops ${s.stops.join(", ")}`);
  for (const p of collected) {
    const s = segs.get(p.seg)!;
    const hit = s.stops.filter((f) => chainOpacity(f, p.chain) === 1);
    assert.ok(hit.length > 0, `${p.seg}: "${p.text}" is never fully on at a stop (stops ${s.stops.join(", ")})`);
  }
});

test("REAL reel: stops end on the chapter's last frame, ascend, show each named beat once, and none is spare; the hero starts on frame 0", () => {
  // The hero's first stop is its poster frame (the HTML poster, Phase 6).
  assert.equal(segs.get("hero")?.stops[0], 0);
  for (const s of segs.values()) {
    const count = filmCount(s.film);
    assert.equal(s.stops.at(-1), count - 1, `${s.id} ends on its last frame`);
    for (let i = 1; i < s.stops.length; i++) assert.ok(s.stops[i]! > s.stops[i - 1]!, `${s.id} stops ascend`);
    const spans = beatSpans(count, filmKeys(s.film));
    const chains = collected.filter((p) => p.seg === s.id).map((p) => p.chain);
    const covered = (stops: readonly number[]) => chains.every((c) => stops.some((f) => chainOpacity(f, c) === 1));
    for (const [a, b] of spans) {
      const inSpan = s.stops.filter((f) => f >= a && f <= b);
      assert.ok(inSpan.length >= 1, `${s.id}: the beat at frame ${a} has a stop`);
    }
    // No spare stop: dropping one either leaves its beat without a stop or a pin never fully on.
    for (const f of s.stops) {
      const rest = s.stops.filter((x) => x !== f);
      const span = spans.find(([a, b]) => f >= a && f <= b);
      const beatAlone = span ? !rest.some((x) => x >= span[0] && x <= span[1]) : false;
      assert.ok(beatAlone || !covered(rest), `${s.id}: stop ${f} is spare`);
    }
  }
});

test("REAL reel: the reduced reel is shorter than the normal one", () => {
  // Normal: pace × 100svh per chapter (FilmSegment). Reduced: reducedHeightSvh.
  const reduced = [...segs.values()].reduce((n, s) => n + reducedHeightSvh(s.stops.length), 0);
  assert.ok(reduced < 2320, `reduced reel ${reduced}svh is shorter than 2320svh`);
});

test("reducedStops: one stop per beat, placed where its beat's pins are fully on", () => {
  // Beats at 0, 50, 100 (last frame). One pin fully on only late in the second beat.
  const late = pin(80, 95, { ease: 4 });
  const stops = reducedStops(101, [0, 50, 100], [late]);
  assert.equal(stops.length, 3);
  assert.equal(stops[0], 0);
  assert.equal(stops[2], 100);
  assert.ok(stops[1]! >= 84 && stops[1]! <= 91, `second stop ${stops[1]} where the pin is on`);
});

test("reducedStops: a beat with two pins that are never on together gets one more stop, no more", () => {
  const a = pin(55, 65, { ease: 2 });
  const b = pin(75, 90, { ease: 2 });
  const stops = reducedStops(101, [0, 50, 100], [a, b]);
  assert.equal(stops.length, 4, `stops ${stops.join(", ")}`);
  for (const p of [a, b]) assert.ok(stops.some((f) => chainOpacity(f, [p]) === 1));
});

test("reducedStops: a pin inside a scrim needs the scrim fully on too", () => {
  const scrim = pin(10, 60, { ease: 20 });
  const inner = pin(10, 60, { ease: 2 });
  const stops = reducedStops(101, [0, 100], [{ scrim, pins: [inner] }]);
  const chains = pinChains([{ scrim, pins: [inner] }]);
  assert.equal(chains.length, 2);
  for (const c of chains) assert.ok(stops.some((f) => chainOpacity(f, c) === 1), `stops ${stops.join(", ")}`);
});

test("reducedStops: a pin never fully on is an authoring error", () => {
  assert.throws(() => reducedStops(101, [0, 100], [pin(40, 42, { ease: 6 })]), /never fully on/);
});

test("fullyOnRange follows pinOpacity (ease in after from, out before to; hold keeps it)", () => {
  assert.deepEqual(fullyOnRange([pin(10, 50, { ease: 5 })], 101), [15, 45]);
  assert.deepEqual(fullyOnRange([pin(0, 50, { ease: 5 })], 101), [0, 45]);
  assert.deepEqual(fullyOnRange([pin(10, 50, { ease: 5, hold: true })], 101), [15, 100]);
  assert.equal(fullyOnRange([pin(10, 12, { ease: 5 })], 101), null);
});

test("reduced scroll zones: equal steps over the pinned travel; the slide-in belongs to the first stop", () => {
  const stage = 800;
  const n = 5;
  const height = stage + (n - 1) * stage * (REDUCED_STEP_SVH / 100);
  // First chapter: scroll offset = p × travel.
  for (let j = 0; j < n; j++) {
    const y = reducedStopScroll(j, height, stage, n);
    const p = y / (height - stage);
    assert.equal(reducedStopIndex(p, height, stage, true, n), j);
  }
  // Later chapter: p runs over travel + stage from the moment its box enters.
  assert.equal(reducedStopIndex(0, height, stage, false, n), 0);
  assert.equal(reducedStopIndex(stage / height / 2, height, stage, false, n), 0);
  for (let j = 0; j < n; j++) {
    const y = reducedStopScroll(j, height, stage, n);
    const p = (y + stage) / height;
    assert.equal(reducedStopIndex(p, height, stage, false, n), j);
  }
  assert.equal(reducedStopIndex(1, height, stage, false, n), n - 1);
  // One stop: always 0; a chapter with no travel: the ends.
  assert.equal(reducedStopIndex(0.7, height, stage, false, 1), 0);
  assert.equal(reducedStopIndex(0.5, stage, stage, true, n), 0);
  assert.equal(reducedStopIndex(1, stage, stage, true, n), n - 1);
});

test("reducedHeightSvh: one stage plus one step per stop after the first", () => {
  assert.equal(reducedHeightSvh(1), 100);
  assert.equal(reducedHeightSvh(6), 100 + 5 * REDUCED_STEP_SVH);
});

test("focus: the frame a focused pin is brought to, and its scroll offset", () => {
  // Nearest fully-on frame to the current one, one frame inside the range.
  assert.equal(focusFrame([100, 160], 40, 0, 240), 101);
  assert.equal(focusFrame([100, 160], 200, 0, 240), 159);
  assert.equal(focusFrame([100, 160], 130, 0, 240), 130);
  // Only frames where the stage is pinned count.
  assert.equal(focusFrame([0, 160], 0, 80, 240), 81);
  assert.equal(focusFrame([0, 60], 0, 80, 240), null);
  // A later chapter's stage is pinned from offset 0: minPinnedFrame.
  const count = 241;
  const stage = 800;
  const height = 3 * stage;
  const fmin = minPinnedFrame(count, height, stage, false);
  assert.ok(frameScroll(fmin, count, height, stage, false) >= 0);
  assert.ok(frameScroll(fmin - 1, count, height, stage, false) < 0);
  assert.equal(minPinnedFrame(count, height, stage, true), 0);
  assert.equal(frameScroll(240, count, height, stage, true), height - stage);
  assert.equal(frameScroll(240, count, height, stage, false), height - stage);
});
