import { test } from "node:test";
import assert from "node:assert/strict";
// Pure helpers live next to their consumer (components/film/scrub.ts); `npm test`
// only globs app/ + lib/, so the test lives here (same pattern as
// lib/recall-book-filter.test.ts).
import {
  breathAt,
  clamp01,
  coverRect,
  frameAt,
  pickActive,
  quantise,
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
