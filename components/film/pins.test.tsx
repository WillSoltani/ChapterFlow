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
  reducedStopTarget,
  REDUCED_STEP_SVH,
  STOP_EDGE_PX,
  type PinRange,
} from "./pins";
import { anchorScroll, frameAt, pageStop, pickActive, reelAnchor, reelStopYs, shownStop, viewportRects } from "./scrub";
import { filmCount, filmKeys } from "./timeline";
import type { FilmManifest, SegmentRegistration } from "./types";

/**
 * Reduced-motion stops (Phase 8): derived from a chapter's pins and named
 * keyframes, checked here against the REAL reel (every FramePin the landing
 * renders, with the scrims it sits in, collected at render time).
 */

type Seg = { id: string; film: string; stops: readonly number[]; dissolveIn: number };
const segs = new Map<string, Seg>();
const collected: Array<{ seg: string; chain: readonly PinRange[]; text: string }> = [];
const collector: PinCollector = {
  segment: (id, film, stops, dissolveIn) => segs.set(id, { id, film, stops, dissolveIn }),
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
    const spans = beatSpans(count, filmKeys(s.film), s.dissolveIn);
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

test("REAL reel: no stop falls inside a chapter's dissolve (there the canvas shows the previous film)", () => {
  for (const s of segs.values()) {
    if (s.id !== "hero") assert.ok(s.dissolveIn > 0, `${s.id} dissolves in`);
    for (const f of s.stops) assert.ok(f >= s.dissolveIn, `${s.id}: stop ${f} inside its ${s.dissolveIn}-frame dissolve`);
  }
});

test("reducedStops: `start` keeps the stops at or after it (a chapter's dissolve)", () => {
  const p = pin(0, 90, { ease: 4 });
  const stops = reducedStops(101, [0, 50, 100], [p], { start: 14 });
  assert.equal(stops[0], 14);
  assert.ok(stops.every((f) => f >= 14));
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

// ── The real reel laid out in px (reduced or normal heights), for the
// paging and mode-switch checks below. ─────────────────────────────────────

/** Chapter registrations of the REAL reel (only what the scrub math reads). */
function realRegs(): SegmentRegistration[] {
  return [...segs.values()].map(
    (s, index) =>
      ({
        index,
        stops: s.stops,
        dissolveIn: s.dissolveIn,
        film: { name: s.film, landscape: { count: filmCount(s.film) } } as unknown as FilmManifest,
      }) as SegmentRegistration,
  );
}
function layout(heightsPx: number[]) {
  const tops: number[] = [];
  let y = 0;
  for (const h of heightsPx) {
    tops.push(y);
    y += h;
  }
  return { tops, heights: heightsPx };
}
/** The stop drawn at scroll `y` (use-scrub-loop's reduced path). */
function stopAt(regs: SegmentRegistration[], g: { tops: number[]; heights: number[] }, stage: number, y: number) {
  const pick = pickActive(regs, viewportRects(g.tops, g.heights, y, []), stage)!;
  const n = pick.seg.stops.length;
  return `${pick.slot}:${pick.seg.stops[reducedStopIndex(pick.progress, g.heights[pick.slot]!, stage, pick.slot === 0, n)]}`;
}

for (const stage of [844, 900, 390])
  test(`REAL reel, reduced motion, keyboard paging (stage ${stage}px): every stop shown, in order, both ways`, () => {
    const regs = realRegs();
    const g = layout(regs.map((r) => (reducedHeightSvh(r.stops.length) * stage) / 100));
    const want = regs.flatMap((r, i) => r.stops.map((f) => `${i}:${f}`));
    const end = g.tops.at(-1)! + g.heights.at(-1)!;
    const ys = reelStopYs(g.tops, g.heights, stage, regs.map((r) => r.stops.length));
    const PAGE = 0.875 * stage; // Chromium's page step
    const walk = (dir: 1 | -1, from: number, stop: (y: number) => boolean, snap: boolean) => {
      const out: string[] = [stopAt(regs, g, stage, from)];
      let y = from;
      for (let i = 0; i < 400 && !stop(y); i++) {
        y = (snap ? pageStop(ys, shownStop(regs, g.tops, g.heights, stage, y), y, dir, stage) : null) ?? Math.max(0, y + dir * PAGE);
        if (y > end) break;
        const k = stopAt(regs, g, stage, y);
        if (out.at(-1) !== k) out.push(k);
      }
      return out;
    };
    assert.deepEqual(walk(1, 0, (y) => y > end, true), want, "PageDown / Space");
    assert.deepEqual(walk(-1, end + stage * 0.3, (y) => y <= 0, true), [...want].reverse(), "PageUp / Shift+Space");
    // The defect fixed: the browser's own page passes stops.
    const native = walk(1, 0, (y) => y > end, false);
    assert.ok(native.length < want.length, `native paging shows ${native.length} of ${want.length} stops`);
    // Wherever the visitor stands (a wheel scroll between stops), PageDown
    // shows the next stop, never one past it. In a chapter's slide-in (its
    // first stop already drawn, the stage still coming up) it pins that stop.
    for (let y = 0; y < ys.at(-1)! - stage * 0.2; y += stage / 7) {
      const cur = shownStop(regs, g.tops, g.heights, stage, y);
      assert.equal(want[cur], stopAt(regs, g, stage, y), "shownStop names the stop drawn");
      const next = pageStop(ys, cur, y, 1, stage);
      assert.ok(next !== null, `a next stop from ${y}`);
      const b = want.indexOf(stopAt(regs, g, stage, next!));
      const slideIn = g.tops.some((t) => t > y && t < y + stage && Math.abs(t - next!) < 1);
      assert.equal(b, slideIn ? cur : cur + 1, `from ${y.toFixed(0)}: ${want[cur]} → ${want[b]}`);
      // And back up: the stop before (or the one on screen, pinned, from a slide-in).
      if (cur > 0) {
        const prev = pageStop(ys, cur, y, -1, stage)!;
        const c = want.indexOf(stopAt(regs, g, stage, prev));
        assert.ok(c === cur - 1 || c === cur, `up from ${y.toFixed(0)}: ${want[cur]} → ${want[c]}`);
      }
    }
  });

test("REAL reel, reduced motion: a stop's scroll target (focus, paging) keeps its own chapter active, even rounded up a pixel", () => {
  const regs = realRegs();
  const stage = 844; // 40svh = 337.6px: fractional tops
  const g = layout(regs.map((r) => (reducedHeightSvh(r.stops.length) * stage) / 100));
  regs.forEach((r, i) => {
    const n = r.stops.length;
    for (let j = 0; j < n; j++) {
      const y = g.tops[i]! + reducedStopTarget(j, g.heights[i]!, stage, n);
      for (const dy of [0, 0.5, 1, -1])
        assert.equal(stopAt(regs, g, stage, Math.round(y + dy)), `${i}:${r.stops[j]}`, `${i}#${j} at ${y}+${dy}`);
    }
    // The last stop sits STOP_EDGE_PX inside the travel's end.
    assert.equal(reducedStopTarget(n - 1, g.heights[i]!, stage, n), g.heights[i]! - stage - STOP_EDGE_PX);
  });
});

test("REAL reel: switching the motion mode keeps the visitor's chapter and frame, and the body's place", () => {
  const regs = realRegs();
  const counts = regs.map((r) => filmCount(r.film.name));
  const stage = 900;
  const paces = [4, 3.5, 3.5, 3, 3, 3, 3];
  const normal = layout(regs.map((_, i) => (paces[i] ?? 3) * stage));
  const reduced = layout(regs.map((r) => (reducedHeightSvh(r.stops.length) * stage) / 100));
  const frameAtY = (g: typeof normal, y: number) => {
    const p = pickActive(regs, viewportRects(g.tops, g.heights, y, []), stage)!;
    return { slot: p.slot, frame: frameAt(p.progress, counts[p.slot]!) };
  };
  for (let i = 0; i < regs.length; i++)
    for (const share of [0.05, 0.45, 0.9]) {
      // Normal → reduced: same chapter, the stop nearest the frame shown.
      const y = normal.tops[i]! + share * (normal.heights[i]! - stage);
      const was = frameAtY(normal, y);
      const a = reelAnchor(y, regs, normal.tops, normal.heights, stage, counts, false)!;
      const y2 = anchorScroll(a, regs, reduced.tops, reduced.heights, stage, counts, true);
      const stops = regs[was.slot]!.stops;
      const nearest = stops.reduce((b, f) => (Math.abs(f - was.frame) < Math.abs(b - was.frame) ? f : b), stops[0]!);
      assert.equal(stopAt(regs, reduced, stage, y2), `${was.slot}:${nearest}`, `chapter ${i} at ${share}: f${was.frame} → stop ${nearest}`);
      // And back: the same chapter at that stop's frame (one frame either side).
      const b = reelAnchor(y2, regs, reduced.tops, reduced.heights, stage, counts, true)!;
      const y3 = anchorScroll(b, regs, normal.tops, normal.heights, stage, counts, false);
      const back = frameAtY(normal, y3);
      assert.equal(back.slot, was.slot, `chapter ${i} at ${share}: back in its chapter`);
      assert.ok(Math.abs(back.frame - nearest) <= 1, `chapter ${i} at ${share}: back at f${back.frame}, want f${nearest}`);
    }
  // Below the reel: the same distance past its end.
  const endN = normal.tops.at(-1)! + normal.heights.at(-1)!;
  const endR = reduced.tops.at(-1)! + reduced.heights.at(-1)!;
  const a = reelAnchor(endN + 1234, regs, normal.tops, normal.heights, stage, counts, false)!;
  assert.equal(anchorScroll(a, regs, reduced.tops, reduced.heights, stage, counts, true), endR + 1234);
  // Above the reel: unchanged.
  const shifted = { tops: normal.tops.map((t) => t + 500), heights: normal.heights };
  const up = reelAnchor(200, regs, shifted.tops, shifted.heights, stage, counts, false)!;
  assert.equal(anchorScroll(up, regs, reduced.tops, reduced.heights, stage, counts, true), 200);
});
