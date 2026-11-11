import { test } from "node:test";
import assert from "node:assert/strict";
// Pure helpers live next to their consumer (components/film/scrub.ts); `npm test`
// only globs app/ + lib/, so the test lives here (same pattern as
// lib/recall-book-filter.test.ts).
import {
  backingSize,
  breathAt,
  clamp01,
  coverRect,
  frameAt,
  framePlacement,
  pickActive,
  quantise,
  reelEndScrollY,
  stageShift,
  viewportRects,
} from "./scrub";
import { pinOpacity } from "./FramePin";
import { filmCount, key, range } from "./timeline";
import type { SegmentRegistration } from "./types";

const seg = (index: number): SegmentRegistration =>
  ({ index, el: {} as HTMLElement, film: { name: `f${index}` } } as unknown as SegmentRegistration);

const VH = 800;

test("pickActive: before first segment holds frame 0", () => {
  const r = pickActive([seg(0), seg(1)], [{ top: 300, height: 2400 }, { top: 2700, height: 2400 }], VH);
  assert.equal(r?.seg.index, 0);
  assert.equal(r?.progress, 0);
});

test("pickActive: inside a segment reports travel progress", () => {
  // height 2400, vh 800 → travel 1600; top -800 → 0.5
  const r = pickActive([seg(0), seg(1)], [{ top: -800, height: 2400 }, { top: 1600, height: 2400 }], VH);
  assert.equal(r?.seg.index, 0);
  assert.equal(r?.progress, 0.5);
});

test("pickActive: a gap between segments holds last frame of previous", () => {
  // Next box has not entered the viewport yet (top ≥ vh).
  const r = pickActive([seg(0), seg(1)], [{ top: -3000, height: 2400 }, { top: 900, height: 2400 }], VH);
  assert.equal(r?.seg.index, 0);
  assert.equal(r?.progress, 1);
});

test("pickActive: a later segment starts scrubbing as its box enters from the bottom", () => {
  // Seg 1 (height 2400, travel 1600) scrubs over travel + vh = 2400 px, starting
  // when its top crosses the viewport bottom — while seg 0's stage slides out.
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const enter = pickActive([seg(0), seg(1)], [{ top: -2000, height: 2400 }, { top: 400, height: 2400 }], VH);
  assert.equal(enter?.seg.index, 1);
  assert.ok(near(enter!.progress, 400 / 2400));
  // Continuous through the moment the stage pins (top = 0) …
  const pin = pickActive([seg(0), seg(1)], [{ top: -2400, height: 2400 }, { top: 0, height: 2400 }], VH);
  assert.equal(pin?.seg.index, 1);
  assert.ok(near(pin!.progress, 800 / 2400));
  // … and reaches 1 exactly when its own sticky travel is spent.
  const end = pickActive([seg(0), seg(1)], [{ top: -4000, height: 2400 }, { top: -1600, height: 2400 }], VH);
  assert.equal(end?.seg.index, 1);
  assert.equal(end?.progress, 1);
});

test("pickActive: the first segment never has a lead-in", () => {
  const r = pickActive([seg(0), seg(1)], [{ top: 0, height: 2400 }, { top: 2400, height: 2400 }], VH);
  assert.equal(r?.seg.index, 0);
  assert.equal(r?.progress, 0);
});

test("pickActive: past all segments holds last", () => {
  const r = pickActive([seg(0), seg(1)], [{ top: -5000, height: 2400 }, { top: -2600, height: 2400 }], VH);
  assert.equal(r?.seg.index, 1);
  assert.equal(r?.progress, 1);
});

test("pickActive: segment shorter than viewport is progress 1 when pinned", () => {
  const r = pickActive([seg(0)], [{ top: -10, height: 600 }], VH);
  assert.equal(r?.progress, 1);
});

test("pickActive: empty → null", () => {
  assert.equal(pickActive([], [], VH), null);
});

test("clamp01 / quantise / frameAt", () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(quantise(0.49, 5), 0.4);
  assert.equal(quantise(0.51, 5), 0.6);
  assert.equal(quantise(0.3, 0), 0.3);
  assert.equal(frameAt(0, 240), 0);
  assert.equal(frameAt(1, 240), 239);
  assert.equal(frameAt(0.5, 240), 120);
  assert.equal(frameAt(0.7, 1), 0);
});

test("coverRect fills canvas on the larger axis and centres", () => {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const r = coverRect(1000, 500, 1920, 1080);
  assert.ok(near(r.w, 1000));
  assert.ok(near(r.h, 562.5));
  assert.ok(near(r.x, 0));
  assert.ok(r.y < 0);
  const tall = coverRect(500, 1000, 1920, 1080);
  assert.ok(near(tall.h, 1000));
  assert.ok(tall.x < 0);
});

test("backingSize: DPR capped at 2, width capped at 1920, rounded", () => {
  assert.deepEqual(backingSize(1440, 900, 2), { w: 1920, h: 1200 });
  assert.deepEqual(backingSize(390, 844, 3), { w: 780, h: 1688 });
  assert.deepEqual(backingSize(390, 844, 1), { w: 390, h: 844 });
  assert.deepEqual(backingSize(1280, 720, 1), { w: 1280, h: 720 });
  // The old formula: scale = min(dpr, 1920 / innerWidth) on innerWidth × innerHeight.
  const old = (w: number, h: number, dpr: number) => {
    const s = Math.min(Math.min(dpr || 1, 2), 1920 / w);
    return { w: Math.round(w * s), h: Math.round(h * s) };
  };
  for (const [w, h, d] of [[1440, 900, 1], [1440, 900, 2], [2560, 1440, 2], [390, 844, 3], [1309.09, 818.18, 1.1]] as const) {
    assert.deepEqual(backingSize(w, h, d), old(w, h, d));
  }
  assert.deepEqual(backingSize(0, 844, 2), { w: 0, h: 0 });
  assert.deepEqual(backingSize(390, 844, 0), { w: 390, h: 844 });
});

test("stageShift: 0 when the stage fills the box, half the gap (in backing px) otherwise", () => {
  assert.equal(stageShift(900, 900, 1800), 0);
  assert.equal(stageShift(800, 900, 1800), -100); // (800 − 900) / 2 css px × 2
  assert.equal(stageShift(700, 0, 1800), 0);
});

test("framePlacement with no shift is exactly the rectangle drawn before (breath origin 0.5 / 0.45)", () => {
  const before = (cw: number, ch: number, iw: number, ih: number, zoom: number) => {
    const r = coverRect(cw, ch, iw, ih);
    const w = r.w * (1 + zoom);
    const h = r.h * (1 + zoom);
    return { x: r.x - (w - r.w) * 0.5, y: r.y - (h - r.h) * 0.45, w, h };
  };
  for (const [cw, ch, iw, ih] of [[1440, 900, 1920, 1080], [1920, 1200, 1920, 1080], [780, 1688, 1080, 1920], [1366, 768, 1920, 1080]] as const) {
    for (const zoom of [0, 0.004, 0.0117, 0.012]) {
      assert.deepEqual(framePlacement(cw, ch, iw, ih, zoom), before(cw, ch, iw, ih, zoom));
      assert.deepEqual(framePlacement(cw, ch, iw, ih, zoom, stageShift(ch, ch, ch)), before(cw, ch, iw, ih, zoom));
    }
  }
});

test("framePlacement: scale is fixed by the box, centre follows the stage", () => {
  // Phone: box 390 × 844 css (lvh) at DPR 2; the stage (svh) is 100 px shorter.
  const { w: cw, h: ch } = backingSize(390, 844, 2);
  const full = framePlacement(cw, ch, 1080, 1920, 0);
  const shifted = framePlacement(cw, ch, 1080, 1920, 0, stageShift(744, 844, ch));
  assert.equal(shifted.w, full.w);
  assert.equal(shifted.h, full.h);
  assert.equal(shifted.x, full.x);
  // Centred on the stage centre: 372 css px = 744 backing px from the top.
  assert.ok(Math.abs(shifted.y + shifted.h / 2 - 744) < 1e-9);
  // Cover of the box: the picture spans the box's full width or height.
  assert.ok(full.w >= cw - 1e-9 && full.h >= ch - 1e-9);
});

test("viewportRects: cached document tops minus scrollY, in place", () => {
  const out: Array<{ top: number; height: number }> = [];
  const r = viewportRects([0, 3200, 6000], [3200, 2800, 2400], 1000, out);
  assert.equal(r, out);
  assert.deepEqual(out, [
    { top: -1000, height: 3200 },
    { top: 2200, height: 2800 },
    { top: 5000, height: 2400 },
  ]);
  const first = out[0];
  viewportRects([0], [3200], 10, out);
  assert.equal(out.length, 1);
  assert.equal(out[0], first);
  assert.deepEqual(out[0], { top: -10, height: 3200 });
});

test("reelEndScrollY: the scroll position where the last segment reaches progress 1", () => {
  const tops = [0, 3200];
  const heights = [3200, 2400];
  const end = reelEndScrollY(tops[1]!, heights[1]!, VH);
  const at = (y: number) => pickActive([seg(0), seg(1)], viewportRects(tops, heights, y, []), VH);
  assert.equal(at(end)?.seg.index, 1);
  assert.equal(at(end)?.progress, 1);
  assert.equal(at(end + 500)?.progress, 1);
  assert.ok((at(end - 1)?.progress ?? 1) < 1);
});

test("breathAt stays within [0, amp] and is 0 when amp is 0", () => {
  assert.equal(breathAt(1234, 0), 0);
  for (let t = 0; t < 20000; t += 500) {
    const b = breathAt(t, 0.01);
    assert.ok(b >= 0 && b <= 0.01);
  }
});

test("pinOpacity ramps in, holds, ramps out", () => {
  assert.equal(pinOpacity(0, 10, 50, 5, false), 0);
  assert.equal(pinOpacity(10, 10, 50, 5, false), 0);
  assert.equal(pinOpacity(12.5, 10, 50, 5, false), 0.5);
  assert.equal(pinOpacity(30, 10, 50, 5, false), 1);
  assert.equal(pinOpacity(47.5, 10, 50, 5, false), 0.5);
  assert.equal(pinOpacity(51, 10, 50, 5, false), 0);
  assert.equal(pinOpacity(999, 10, 50, 5, true), 1);
});

test("pinOpacity: a from=0 pin is fully visible at frame 0 (first paint)", () => {
  assert.equal(pinOpacity(0, 0, 50, 8, true), 1);
  assert.equal(pinOpacity(1, 0, 50, 8, true), 1);
  assert.equal(pinOpacity(0, 0, 50, 8, false), 1);
});

test("timeline resolves named keys and clamps ranges", () => {
  assert.equal(key("palace-00", "book"), 0);
  assert.equal(key("palace-00", "doorway"), 156);
  assert.deepEqual(range("palace-00", "book", 10, 20), [0, 20]);
  const last = filmCount("palace-00") - 1;
  assert.equal(key("palace-00", "through"), last);
  assert.deepEqual(range("palace-00", "through", 5, 100), [last - 5, last]);
  assert.throws(() => key("nope", "x"));
  assert.throws(() => key("palace-00", "nope"));
});

test("timeline: every film's keys are within [0, count-1] and ascending", async () => {
  const { films } = (await import("./book.timeline.json")).default as {
    films: Record<string, { count: number; keys: Record<string, number> }>;
  };
  for (const [name, f] of Object.entries(films)) {
    const vals = Object.values(f.keys);
    assert.ok(vals.length >= 3, `${name}: needs ≥3 keys`);
    assert.equal(vals[0], 0, `${name}: first key must be frame 0`);
    assert.equal(vals[vals.length - 1], f.count - 1, `${name}: last key must be the last frame`);
    for (let i = 1; i < vals.length; i++) {
      const prev = vals[i - 1];
      const cur = vals[i];
      assert.ok(prev !== undefined && cur !== undefined && cur > prev, `${name}: keys must ascend`);
    }
  }
});
