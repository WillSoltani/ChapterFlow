import { test } from "node:test";
import assert from "node:assert/strict";
// Pure helpers live next to their consumer (components/film/scrub.ts); `npm test`
// only globs app/ + lib/, so the test lives here (same pattern as
// lib/recall-book-filter.test.ts).
import {
  backingSize,
  breathAt,
  canvasHiddenFrom,
  clamp01,
  coverRect,
  frameAt,
  framePlacement,
  holdBreathClock,
  breathRestOffset,
  isScrollKey,
  parseSmoothParam,
  pickActive,
  quantise,
  reelEndScrollY,
  scrollInputAt,
  smoothFrameStep,
  smoothingMs,
  stageShift,
  variantPlacement,
  viewportRects,
} from "./scrub";
import { pinHiddenAtStart, pinOpacity } from "./FramePin";
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

test("breathRestOffset: the breath is at rest (0) at the first real paint and leaves it with zero speed", () => {
  // The HTML hero poster (Phase 6) is placed with no breath zoom; the canvas
  // takes over at its first real paint, so the breath must be 0 then and stay
  // within a tiny zoom for the next half second (no visible shift at takeover).
  const q = (b: number) => Math.round(b * 4000) / 4000;
  for (const t0 of [0, 812.5, 16_000, 123_456.7]) {
    const off = breathRestOffset(t0);
    assert.equal(q(breathAt(t0 - off, 0.012)), 0);
    assert.ok(breathAt(t0 + 500 - off, 0.012) < 0.012 * 0.01, "barely moved after 500 ms");
    assert.ok(breathAt(t0 + 8000 - off, 0.012) > 0.006, "and it does breathe");
  }
});

test("holdBreathClock: breath resumes where it froze after a loop stop (no zoom pop)", () => {
  // The loop ran until t = 41_300 (last ticked frame), stopped at the end of
  // the reel, and restarts at t = 47_900. The first tick after the restart
  // must draw the same breath the canvas froze on, quantised as the loop does.
  const q = (b: number) => Math.round(b * 4000) / 4000;
  for (const amp of [0.01, 0.012]) {
    for (const [off, lastTick, now] of [[0, 41_300, 47_900], [1234.5, 41_300, 41_316.7], [9_000, 100_000, 103_850]] as const) {
      const frozen = breathAt(lastTick - off, amp);
      const off2 = holdBreathClock(off, lastTick, now);
      assert.ok(Math.abs(breathAt(now - off2, amp) - frozen) < 1e-12);
      assert.equal(q(breathAt(now - off2, amp)), q(frozen));
      // Without the hold the breath would jump (this case is not a no-op).
      if (now - lastTick > 1000) assert.notEqual(q(breathAt(now - off, amp)), q(frozen));
    }
  }
  // No time passed (or a clock that went backwards): offset unchanged.
  assert.equal(holdBreathClock(5, 100, 100), 5);
  assert.equal(holdBreathClock(5, 100, 90), 5);
});

test("pinHiddenAtStart: a pin is 'later' (hidden before hydration) unless it shows at its chapter's first frame", () => {
  // The hero: the headline, lede and CTAs are on at frame 0 (key "book" = 0);
  // "No card ·" (doorway − 30) and the doorway line (push_in + 20) come later.
  const book = key("palace-00", "book");
  const doorway = key("palace-00", "doorway");
  const pushIn = key("palace-00", "push_in");
  const last = filmCount("palace-00") - 1;
  assert.equal(pinHiddenAtStart(book, pushIn, 10, false), false);
  assert.equal(pinHiddenAtStart(doorway - 30, pushIn, 10, false), true);
  assert.equal(pinHiddenAtStart(pushIn + 20, last, 12, true), true);
  // Any pin starting after frame 0 is later; one starting at 0 is not.
  assert.equal(pinHiddenAtStart(1, 50, 6, false), true);
  assert.equal(pinHiddenAtStart(0, 50, 6, true), false);
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

// --- Band tiers: the band is drawn where the full 1080×1920 frame put it. ---

const VFRAME = { w: 1080, h: 1920 };
const VBAND = { x: 0, y: 474, w: 1080, h: 972 };
const TIERS = [
  { width: 1080, height: 972, frame: VFRAME, band: VBAND },
  { width: 900, height: 810, frame: VFRAME, band: VBAND },
];

/**
 * Independent reference: place the legacy 1080×1920 frame with
 * framePlacement and read where its band rows / columns land (the rectangle
 * covered by source pixels band.x … band.x + band.w, band.y … band.y + band.h).
 */
function legacyBandRect(cw: number, ch: number, zoom: number, shift: number) {
  const r = framePlacement(cw, ch, 1080, 1920, zoom, shift);
  const px = (sx: number) => r.x + (sx / 1080) * r.w;
  const py = (sy: number) => r.y + (sy / 1920) * r.h;
  return { x: px(VBAND.x), y: py(VBAND.y), w: px(VBAND.x + VBAND.w) - px(VBAND.x), h: py(VBAND.y + VBAND.h) - py(VBAND.y) };
}

const close = (a: { x: number; y: number; w: number; h: number }, b: typeof a, msg: string) => {
  for (const k of ["x", "y", "w", "h"] as const) assert.ok(Math.abs(a[k] - b[k]) < 1e-6, `${msg}: ${k} ${a[k]} vs ${b[k]}`);
};

test("variantPlacement: a band tier lands on the rect the band has inside the placed 1080×1920 frame", () => {
  const phone = backingSize(390, 844, 2); // 780 × 1688
  const tablet = backingSize(820, 1180, 2); // 1640 × 2360 (under the 1920 cap)
  const tabletWide = backingSize(1200, 1600, 2); // capped to 1920 wide
  const landPhone = backingSize(844, 390, 2); // 1688 × 780
  assert.deepEqual(phone, { w: 780, h: 1688 });
  assert.deepEqual(tablet, { w: 1640, h: 2360 });
  assert.equal(tabletWide.w, 1920);
  assert.deepEqual(landPhone, { w: 1688, h: 780 });
  for (const [label, box] of [["phone", phone], ["tablet", tablet], ["tablet capped", tabletWide], ["landscape phone", landPhone]] as const) {
    for (const [zoom, shift] of [[0, 0], [0.012, -37.5], [0.01, 21]] as const) {
      const want = legacyBandRect(box.w, box.h, zoom, shift);
      for (const t of TIERS) {
        // The image size must not matter: only the virtual frame and band do.
        const got = variantPlacement(box.w, box.h, t, t.width, t.height, zoom, shift);
        close(got, want, `${label} ${t.width} tier zoom ${zoom} shift ${shift}`);
      }
    }
  }
});

test("variantPlacement: both tiers map a picture pixel to the same canvas point as the legacy frame", () => {
  const { w: cw, h: ch } = backingSize(390, 844, 2);
  const zoom = 0.012;
  const shift = -12;
  const legacy = framePlacement(cw, ch, 1080, 1920, zoom, shift);
  for (const t of TIERS) {
    const r = variantPlacement(cw, ch, t, t.width, t.height, zoom, shift);
    const k = 1080 / t.width; // tier px → virtual px
    for (const [tx, ty] of [[0, 0], [t.width / 2, t.height / 2], [t.width, t.height], [123, 456 * (t.height / 972)]] as const) {
      const fromTier = { x: r.x + (tx / t.width) * r.w, y: r.y + (ty / t.height) * r.h };
      const vx = VBAND.x + tx * k;
      const vy = VBAND.y + ty * k;
      const fromLegacy = { x: legacy.x + (vx / 1080) * legacy.w, y: legacy.y + (vy / 1920) * legacy.h };
      assert.ok(Math.abs(fromTier.x - fromLegacy.x) < 1e-6 && Math.abs(fromTier.y - fromLegacy.y) < 1e-6, `${t.width} tier pixel ${tx},${ty}`);
    }
  }
});

test("variantPlacement: a variant without a band is framePlacement of the image itself", () => {
  const landscape = { width: 1920, height: 1080 };
  for (const [cw, ch] of [[1440, 900], [1920, 1200], [780, 1688]] as const) {
    for (const [zoom, shift] of [[0, 0], [0.012, 9]] as const) {
      assert.deepEqual(
        variantPlacement(cw, ch, landscape, 1920, 1080, zoom, shift),
        framePlacement(cw, ch, 1920, 1080, zoom, shift),
      );
    }
  }
});

test("smoothingMs: wheel, key and other glide over 90 ms; touch is short", () => {
  assert.equal(smoothingMs("wheel"), 90);
  assert.equal(smoothingMs("key"), 90);
  assert.equal(smoothingMs("other"), 90);
  assert.equal(smoothingMs("touch"), 35);
});

test("smoothingMs: the ?smooth= override replaces the touch value only", () => {
  assert.equal(smoothingMs("touch", 0), 0);
  assert.equal(smoothingMs("touch", 120), 120);
  assert.equal(smoothingMs("wheel", 0), 90);
  assert.equal(smoothingMs("other", 120), 90);
});

test("parseSmoothParam: 0..200 ms, anything else is no override", () => {
  assert.equal(parseSmoothParam("?smooth=0"), 0);
  assert.equal(parseSmoothParam("?hud=1&smooth=50"), 50);
  assert.equal(parseSmoothParam("?smooth=200"), 200);
  assert.equal(parseSmoothParam("?smooth=201"), null);
  assert.equal(parseSmoothParam("?smooth=-1"), null);
  assert.equal(parseSmoothParam("?smooth=abc"), null);
  assert.equal(parseSmoothParam("?smooth="), null);
  assert.equal(parseSmoothParam(""), null);
});

test("smoothFrameStep: 0 ms snaps; otherwise an exponential approach that settles on the target", () => {
  assert.equal(smoothFrameStep(10, 40, 16, 0), 40);
  const a = smoothFrameStep(10, 40, 16, 90);
  assert.ok(a > 10 && a < 40);
  // a shorter time constant gets closer in the same time
  assert.ok(smoothFrameStep(10, 40, 16, 35) > a);
  // within half a frame of the target: settle on it (the idle rule needs equality)
  assert.equal(smoothFrameStep(39.6, 40, 16, 90), 40);
  // dt is capped at 50 ms (a stalled frame does not jump)
  assert.equal(smoothFrameStep(0, 100, 500, 90), smoothFrameStep(0, 100, 50, 90));
});

test("isScrollKey: the keys that scroll the page", () => {
  for (const k of ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"]) assert.equal(isScrollKey(k), true, k);
  for (const k of ["a", "Tab", "Enter", "Shift"]) assert.equal(isScrollKey(k), false, k);
});

test("scrollInputAt: a wheel or key input older than 400 ms at a scroll is 'other'; touch holds", () => {
  assert.equal(scrollInputAt("wheel", 1000, 1300), "wheel");
  assert.equal(scrollInputAt("wheel", 1000, 1500), "other");
  assert.equal(scrollInputAt("key", 1000, 1399), "key");
  assert.equal(scrollInputAt("key", 1000, 1401), "other");
  // a fling keeps scrolling long after the finger lifts
  assert.equal(scrollInputAt("touch", 1000, 4000), "touch");
  assert.equal(scrollInputAt("other", 1000, 1001), "other");
});

test("canvasHiddenFrom: the canvas may stop compositing once the body's translucent top has scrolled past", () => {
  // last segment at 9000, 2000 tall, stage 900: its stage leaves at 11000; the
  // body is opaque from 30 % of a stage height below its top.
  assert.equal(canvasHiddenFrom(9000, 2000, 900), 11000 + 270);
  assert.ok(canvasHiddenFrom(9000, 2000, 900) > reelEndScrollY(9000, 2000, 900));
});
