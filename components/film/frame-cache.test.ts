import { test } from "node:test";
import assert from "node:assert/strict";
import { FRAME_TRIES, FrameBudget, FrameCache, filmError, frameUrl, type FrameClock, type FrameIO, type PackSource } from "./frame-cache";
import type { FilmVariant } from "./types";

// The cache's scheduling logic runs under node with injected fetch + decode
// fakes. Portrait frames: 1080 × 1920 × 4 bytes decoded.
const W = 1080;
const H = 1920;
const FRAME = W * H * 4;
const MB = 1024 * 1024;

function variant(name: string, count = 241): FilmVariant {
  return { name, count, pad: 4, ext: "webp", width: W, height: H, poster: `/films/${name}/poster.webp`, base: `/films/${name}`, v: "t" };
}

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fakeBitmap = () => ({ width: W, height: H, close() {} }) as unknown as ImageBitmap;
const fakeBlob = (url: string) => ({ size: 40_000, url }) as unknown as Blob;

const tick = () => new Promise<void>((r) => setImmediate(r));
async function settle(n = 40) {
  for (let i = 0; i < n; i++) await tick();
}

/** IO whose fetches and decodes settle on the next macrotask. */
function autoIO() {
  const network: string[] = [];
  let fetchInFlight = 0;
  let decodeInFlight = 0;
  let maxFetch = 0;
  let maxDecode = 0;
  const io: FrameIO = {
    fetchBlob: async (url) => {
      network.push(url);
      fetchInFlight++;
      maxFetch = Math.max(maxFetch, fetchInFlight);
      await tick();
      fetchInFlight--;
      return fakeBlob(url);
    },
    decode: async () => {
      decodeInFlight++;
      maxDecode = Math.max(maxDecode, decodeInFlight);
      await tick();
      decodeInFlight--;
      return fakeBitmap();
    },
  };
  return { io, network, peaks: () => ({ maxFetch, maxDecode }) };
}

/** IO whose fetches and decodes settle only when the test says so. */
function manualIO() {
  const fetches: Array<{ url: string } & Deferred<Blob>> = [];
  const decodes: Array<Deferred<ImageBitmap>> = [];
  const io: FrameIO = {
    fetchBlob: (url) => {
      const d = deferred<Blob>();
      fetches.push({ url, ...d });
      return d.promise;
    },
    decode: () => {
      const d = deferred<ImageBitmap>();
      decodes.push(d);
      return d.promise;
    },
  };
  return { io, fetches, decodes };
}

/** Fail the test the moment a frame inside the wanted set is evicted. */
function guardEvictions(budget: FrameBudget, ...caches: FrameCache[]) {
  const restore: Array<() => void> = [];
  for (const c of caches) {
    const orig = c.evict.bind(c);
    c.evict = (i: number) => {
      assert.ok(!budget.isWanted(c, i), `evicted wanted frame ${c.variant.name}#${i}`);
      orig(i);
    };
    restore.push(() => {
      c.evict = orig;
    });
  }
  /** Stop guarding (dispose() evicts everything, wanted or not). */
  return () => restore.forEach((r) => r());
}

function assertWithinBudget(budget: FrameBudget) {
  const wantedBytes = budget.wanted().length * FRAME;
  assert.ok(wantedBytes <= budget.limitBytes, `wanted ${wantedBytes} > limit ${budget.limitBytes}`);
  assert.ok(
    budget.usedBytes + budget.reservedBytes <= budget.limitBytes + FRAME,
    `decoded+decoding ${budget.usedBytes + budget.reservedBytes} > limit + 1 frame`,
  );
}

test("frame URLs are 1-based, padded and versioned", () => {
  assert.equal(frameUrl(variant("palace-00-p"), 0), "/films/palace-00-p/f_0001.webp?v=t");
});

test("the wanted set fits the budget: ~80% of capacity, biased toward the scroll direction", () => {
  const { io } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  const idx = budget.wanted().map((w) => w.index);
  assert.equal(idx[0], 100, "the playhead frame comes first");
  assert.equal(idx.length, Math.floor(19 * 0.8));
  const ahead = idx.filter((i) => i > 100).length;
  const behind = idx.filter((i) => i < 100).length;
  assert.ok(ahead > behind * 2, `ahead ${ahead} vs behind ${behind}`);
  // Backward: the bias flips.
  budget.want({ active: { cache: a, center: 100, direction: -1 } });
  const back = budget.wanted().map((w) => w.index);
  assert.ok(back.filter((i) => i < 100).length > back.filter((i) => i > 100).length * 2);
  // Nearest-first in the scroll direction.
  assert.equal(back[1], 99);
  // At the start of a film the unused "behind" share moves ahead.
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  assert.deepEqual(
    budget.wanted().map((w) => w.index).sort((x, y) => x - y),
    Array.from({ length: 15 }, (_, i) => i),
  );
});

test("forward, backward and jumping scrubs never exceed the budget", async () => {
  const { io } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  const b = new FrameCache(variant("b"), budget);
  guardEvictions(budget, a, b);
  const centers = [
    ...Array.from({ length: 120 }, (_, i) => i * 2),
    ...Array.from({ length: 120 }, (_, i) => 240 - i * 2),
    ...[200, 3, 150, 77, 239, 0, 120, 60, 180, 10],
  ];
  let prev = 0;
  for (const c of centers) {
    const dir = c >= prev ? 1 : -1;
    prev = c;
    budget.want({ active: { cache: a, center: c, direction: dir }, next: c > 140 ? b : undefined });
    assertWithinBudget(budget);
    await tick();
    assertWithinBudget(budget);
    await tick();
    assertWithinBudget(budget);
  }
  await settle();
  assertWithinBudget(budget);
});

test("a one-direction scrub through 241 frames with room for 19 fetches every frame once", async () => {
  const { io, network } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  guardEvictions(budget, a);
  for (let c = 0; c <= 240; c++) {
    budget.want({ active: { cache: a, center: c, direction: 1 } });
    await tick();
    await tick();
  }
  await settle();
  assert.equal(budget.stats.refetches, 0);
  assert.equal(new Set(network).size, network.length, "no URL requested twice");
  assert.equal(network.length, 241, "every frame fetched");
  assert.equal(budget.stats.fetches, 241);
  assert.ok(a.has(240));
});

test("a backward scrub over frames already fetched decodes from held bytes, no network", async () => {
  const { io, network } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  for (let c = 0; c <= 240; c++) {
    budget.want({ active: { cache: a, center: c, direction: 1 } });
    await tick();
    await tick();
  }
  await settle();
  const before = network.length;
  const decodesBefore = budget.stats.decodes;
  for (let c = 240; c >= 0; c--) {
    budget.want({ active: { cache: a, center: c, direction: -1 } });
    await tick();
    await tick();
  }
  await settle();
  assert.equal(network.length, before, "no network fetch on the way back");
  assert.equal(budget.stats.refetches, 0);
  assert.ok(budget.stats.decodes > decodesBefore, "frames re-decoded from held blobs");
  assert.ok(budget.stats.redecodes > 0);
  assert.ok(a.has(0));
});

test("near frames are never evicted when far frames arrive", async () => {
  const { io } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  const b = new FrameCache(variant("b"), budget);
  guardEvictions(budget, a, b);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  await settle();
  const near = budget.wanted().map((w) => w.index);
  for (const i of near) assert.ok(a.has(i), `frame ${i} decoded`);
  // The next film's head now joins the wanted set and arrives; the active
  // window shrinks to make room, and only frames that LEFT it may go.
  budget.want({ active: { cache: a, center: 101, direction: 1 }, next: b });
  await settle();
  for (const w of budget.wanted()) assert.ok(w.cache.has(w.index), `${w.cache.variant.name}#${w.index} decoded`);
  assert.ok(b.has(0));
  assert.ok(a.has(101) && a.has(102));
  assertWithinBudget(budget);
});

test("the previous film's last frame survives while it is pinned", async () => {
  const { io } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const prev = new FrameCache(variant("prev", 241), budget);
  const a = new FrameCache(variant("a"), budget);
  guardEvictions(budget, prev, a);
  budget.want({ active: { cache: prev, center: 240, direction: 1 } });
  await settle();
  assert.ok(prev.has(240));
  let pinnedThrough = -1;
  for (let c = 0; c <= 40; c++) {
    budget.want({ active: { cache: a, center: c, direction: 1 }, pin: { cache: prev, index: 240, until: 14 } });
    if (budget.isWanted(prev, 240)) pinnedThrough = c;
    await settle(4);
    if (budget.isWanted(prev, 240)) assert.ok(prev.has(240), `prev last frame present at a#${c}`);
    assertWithinBudget(budget);
    // The other frames of the previous film go first.
    if (c === 14) assert.ok(!prev.has(230) && prev.has(240));
  }
  // Pinned for the whole dissolve (frames < 14) plus the window's reach.
  assert.ok(pinnedThrough >= 14 && pinnedThrough < 40, `pinned through a#${pinnedThrough}`);
  assert.ok(!budget.isWanted(prev, 240));
});

test("when the network falls behind the playhead, late frames still reach the canvas", async () => {
  // Each fetch lands only after the playhead has moved on ~20 frames, so it
  // is no longer in the window. Its bytes are held; the wanted set takes the
  // nearest held frame at or below the playhead as the fallback to decode.
  const { io, fetches, decodes } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  guardEvictions(budget, a);
  let resolved = 0;
  for (let c = 0; c <= 200; c++) {
    budget.want({ active: { cache: a, center: c, direction: 1 } });
    if (c % 5 === 0 && resolved < fetches.length) {
      const f = fetches[resolved++];
      f?.resolve(fakeBlob(f.url));
    }
    for (const d of decodes) d.resolve(fakeBitmap());
    await tick();
    assertWithinBudget(budget);
  }
  for (const d of decodes) d.resolve(fakeBitmap());
  await settle(4);
  a.nearest(200);
  assert.ok(a.lastServed >= 150, `canvas fell back to #${a.lastServed} at #200`);
  assert.equal(budget.stats.refetches, 0);
});

test("mount warm-up: a weak plan never overrides the scroll loop's plan", () => {
  const { io } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  const b = new FrameCache(variant("b"), budget);
  budget.want({ active: { cache: a, center: 0, direction: 1 } }, { weak: true });
  budget.want({ active: { cache: a, center: 0, direction: 1 }, next: b }, { weak: true });
  assert.ok(budget.isWanted(b, 0), "second film's head warmed at mount");
  budget.want({ active: { cache: a, center: 120, direction: 1 } });
  budget.want({ active: { cache: a, center: 0, direction: 1 } }, { weak: true });
  assert.ok(budget.isWanted(a, 120), "strong plan kept");
  assert.ok(!budget.isWanted(b, 0));
});

test("fetches in flight never exceed 4; decodes never exceed 2 on the small budget, 4 otherwise", async () => {
  for (const [limit, maxDecodes] of [
    [160 * MB, 2],
    [384 * MB, 4],
  ] as const) {
    const { io, peaks } = autoIO();
    const budget = new FrameBudget(limit, io);
    const a = new FrameCache(variant("a"), budget);
    const b = new FrameCache(variant("b"), budget);
    for (let c = 0; c <= 240; c += 3) {
      budget.want({ active: { cache: a, center: c, direction: 1 }, next: b });
      await tick();
      assert.ok(budget.stats.fetchInFlight <= 4);
      assert.ok(budget.stats.decodeInFlight <= maxDecodes);
    }
    await settle();
    assert.ok(peaks().maxFetch <= 4, `fetch peak ${peaks().maxFetch}`);
    assert.ok(peaks().maxDecode <= maxDecodes, `decode peak ${peaks().maxDecode}`);
    assert.equal(budget.stats.maxFetchInFlight, 4);
    assert.equal(budget.stats.maxDecodeInFlight, maxDecodes);
  }
});

test("a queued request that leaves the wanted set is dropped; a started one completes and keeps its bytes", async () => {
  const { io, fetches, decodes } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  assert.equal(fetches.length, 4, "only 4 fetches start");
  assert.equal(fetches[0]?.url, frameUrl(a.variant, 100));
  // Jump far away: the 4 started fetches keep running, the queue is redone.
  budget.want({ active: { cache: a, center: 200, direction: 1 } });
  assert.equal(fetches.length, 4, "no new fetch while all 4 slots are busy");
  for (const f of fetches.slice(0, 4)) f.resolve(fakeBlob(f.url));
  await settle(4);
  // Their bytes are held, not decoded (no longer wanted)…
  assert.ok(budget.hasBlob(a, 100));
  assert.ok(!a.has(100));
  assert.equal(decodes.length, 0);
  // …and the next fetches are for the new window, nearest first.
  assert.equal(fetches.length, 8);
  assert.equal(fetches[4]?.url, frameUrl(a.variant, 200));
  const requested = new Set(fetches.map((f) => f.url));
  for (const i of [104, 105, 106, 110]) assert.ok(!requested.has(frameUrl(a.variant, i)), `queued #${i} dropped`);
  // Back at 100: frame 100 decodes from its held bytes, no new fetch for it.
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  assert.equal(decodes.length, 2, "two held blobs decode at once (small budget)");
  assert.equal(fetches.filter((f) => f.url === frameUrl(a.variant, 100)).length, 1);
  assert.equal(budget.stats.refetches, 0);
});

test("a decode reserves its bytes when it starts", async () => {
  const { io, fetches, decodes } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  fetches[0]?.resolve(fakeBlob("x"));
  await settle(4);
  assert.equal(decodes.length, 1);
  assert.equal(budget.reservedBytes, FRAME);
  assert.equal(budget.usedBytes, 0);
  decodes[0]?.resolve(fakeBitmap());
  await settle(4);
  assert.equal(budget.reservedBytes, 0);
  assert.equal(budget.usedBytes, FRAME);
  assert.ok(a.has(0));
});

test("load notifications carry the frame index", async () => {
  const { io } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  const seen: number[] = [];
  const fromBudget: string[] = [];
  a.subscribe((i) => seen.push(i));
  budget.subscribe((c, i) => fromBudget.push(`${c.variant.name}#${i}`));
  budget.want({ active: { cache: a, center: 50, direction: 1 } });
  await settle();
  assert.equal(seen[0], 50);
  assert.equal(fromBudget[0], "a#50");
});

test("draw counters: exact draws, fallback draws and their distance", async () => {
  const { io } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 10, direction: 1 } });
  await settle();
  assert.ok(a.nearest(10, true));
  assert.equal(a.lastServed, 10);
  assert.equal(budget.stats.exactDraws, 1);
  // Frame 40 is not loaded: falls back to the nearest frame at or below it.
  const top = Math.max(...budget.wanted().map((w) => w.index));
  assert.ok(a.nearest(40, true));
  assert.equal(a.lastServed, top);
  assert.equal(budget.stats.fallbackDraws, 1);
  assert.equal(budget.stats.fallbackDistanceSum, 40 - top);
  // Unrecorded lookups (the dissolve's underlay) do not count.
  a.nearest(40);
  assert.equal(budget.stats.fallbackDraws, 1);
});

/** A clock the test advances by hand; `later` callbacks run when their time comes. */
function fakeClock() {
  let t = 0;
  const timers: Array<{ at: number; fn: () => void }> = [];
  return {
    clock: {
      now: () => t,
      later: (fn: () => void, ms: number) => {
        timers.push({ at: t + ms, fn });
      },
    } satisfies FrameClock,
    now: () => t,
    /** Timers armed and not fired yet. */
    pending: () => timers.length,
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
        await settle();
      }
      t = end;
      await settle();
    },
  };
}

test("a failed fetch leaves a hole that nearest() covers, and is retried after a backoff while still wanted", async () => {
  const network: string[] = [];
  let failNext = true;
  const io: FrameIO = {
    fetchBlob: async (url) => {
      network.push(url);
      if (url.includes("f_0001") && failNext) {
        failNext = false;
        throw new Error("403");
      }
      return fakeBlob(url);
    },
    decode: async () => fakeBitmap(),
  };
  const fc = fakeClock();
  const budget = new FrameBudget(19 * FRAME, io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  // The visitor parks near frame 0; frame 0 stays wanted the whole time.
  for (const center of [0, 1, 2, 3, 0, 1]) {
    budget.want({ active: { cache: a, center, direction: 1 } });
    await settle();
  }
  assert.ok(!a.has(0), "the hole is there before the backoff runs out");
  assert.ok(a.nearest(0), "nearest covers the hole with a neighbour");
  assert.equal(network.filter((u) => u.includes("f_0001")).length, 1, "no retry before the backoff");
  // No further scroll: the retry fires on its own once due.
  await fc.advance(400);
  assert.equal(network.filter((u) => u.includes("f_0001")).length, 2);
  assert.ok(a.has(0), "the parked visitor gets the exact frame back");
  assert.equal(budget.stats.refetches, 0, "a retry of a failed fetch is not a refetch");
});

test("after a network blip, every frame still wanted loads once the network is back", async () => {
  let offline = true;
  const network: string[] = [];
  const io: FrameIO = {
    fetchBlob: async (url) => {
      network.push(url);
      await tick();
      if (offline) throw new Error("offline");
      return fakeBlob(url);
    },
    decode: async () => {
      await tick();
      return fakeBitmap();
    },
  };
  const fc = fakeClock();
  const budget = new FrameBudget(19 * FRAME, io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 50, direction: 1 } });
  await settle();
  const wantedAt50 = budget.wanted().map((w) => w.index);
  assert.equal(network.length, wantedAt50.length, "every wanted frame failed once");
  assert.ok(wantedAt50.every((i) => !a.has(i)));
  offline = false;
  // The visitor creeps forward; 50..60 stay inside the window at center 53.
  for (let c = 51; c <= 53; c++) {
    budget.want({ active: { cache: a, center: c, direction: 1 } });
    await settle();
  }
  await fc.advance(4000);
  for (const w of budget.wanted()) assert.ok(a.has(w.index), `frame ${w.index} loaded after the blip`);
  for (let i = 50; i <= 60; i++) assert.ok(a.has(i), `frame ${i} loaded after the blip`);
});

test("a frame that keeps failing is tried 3 times (two retries with backoff), then never again", async () => {
  const network: string[] = [];
  const io: FrameIO = {
    fetchBlob: async (url) => {
      network.push(url);
      if (url.includes("f_0006")) throw new Error("404");
      return fakeBlob(url);
    },
    decode: async () => fakeBitmap(),
  };
  const fc = fakeClock();
  const budget = new FrameBudget(19 * FRAME, io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 4, direction: 1 } });
  await settle();
  // 10 s parked on the failing frame's window, with scroll decisions too.
  for (let i = 0; i < 20; i++) {
    budget.want({ active: { cache: a, center: 5, direction: 1 } });
    await fc.advance(500);
  }
  const tries = () => network.filter((u) => u.includes("f_0006")).length;
  assert.equal(tries(), 3, "the first try and two retries");
  assert.equal(budget.stats.framesFailed, 1);
  assert.ok(!a.has(5));
  assert.ok(a.has(4) && a.has(6), "its neighbours load");
  assert.equal(a.nearest(5), a.get(4), "a neighbour serves the failed frame");
  // Leaving the wanted set and coming back does not earn new tries.
  budget.want({ active: { cache: a, center: 200, direction: 1 } });
  await fc.advance(5000);
  budget.want({ active: { cache: a, center: 5, direction: -1 } });
  await fc.advance(10_000);
  assert.equal(tries(), 3, "failed for the rest of the page view");
  assert.equal(budget.stats.fetchInFlight, 0);
});

test("tries are counted across leaving the wanted set: two failures, away, back = one more try", async () => {
  const network: string[] = [];
  const io: FrameIO = {
    fetchBlob: async (url) => {
      network.push(url);
      if (url.includes("f_0101")) throw new Error("503");
      return fakeBlob(url);
    },
    decode: async () => fakeBitmap(),
  };
  const fc = fakeClock();
  const budget = new FrameBudget(19 * FRAME, io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  await settle();
  await fc.advance(500);
  const tries = () => network.filter((u) => u.includes("f_0101")).length;
  assert.equal(tries(), 2);
  budget.want({ active: { cache: a, center: 10, direction: -1 } });
  await fc.advance(3000);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  await fc.advance(10_000);
  assert.equal(tries(), 3);
  assert.equal(budget.stats.framesFailed, 1);
});

test("a decode that fails counts as a try too", async () => {
  let decodes = 0;
  const io: FrameIO = {
    fetchBlob: async (url) => fakeBlob(url),
    decode: async (blob) => {
      if ((blob as unknown as { url: string }).url.includes("f_0001")) {
        decodes++;
        throw new Error("bad bytes");
      }
      return fakeBitmap();
    },
  };
  const fc = fakeClock();
  const budget = new FrameBudget(19 * FRAME, io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  for (let i = 0; i < 10; i++) {
    budget.want({ active: { cache: a, center: 0, direction: 1 } });
    await fc.advance(1000);
  }
  assert.equal(decodes, 3);
  assert.equal(budget.stats.framesFailed, 1);
});

test("the film is unreachable when nothing ever loaded, a poster failed and 3 frames failed for good; then it halts", async () => {
  const network: string[] = [];
  const io: FrameIO = {
    // Every file answers 404 (permanent: no probe follows the halt; the
    // transient case is in the recovery tests below).
    fetchBlob: async (url) => {
      network.push(url);
      throw filmError(`${url} 404`, true);
    },
    decode: async () => fakeBitmap(),
  };
  const fc = fakeClock();
  const budget = new FrameBudget(19 * FRAME, io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  const halts: number[] = [];
  budget.onHalt(() => halts.push(1));
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await settle();
  await fc.advance(5000);
  assert.ok(budget.stats.framesFailed >= 3);
  assert.equal(budget.halted, false, "frames alone do not decide it: the poster may still come");
  budget.notePoster(a, false);
  assert.equal(budget.halted, true);
  assert.deepEqual(halts, [1]);
  const before = network.length;
  budget.want({ active: { cache: a, center: 120, direction: 1 } });
  await fc.advance(20_000);
  assert.equal(network.length, before, "a halted budget requests nothing");
  assert.equal(budget.stats.fetchInFlight, 0);
});

test("not unreachable once anything loaded: a poster, or a single frame", async () => {
  for (const what of ["poster", "frame"] as const) {
    const io: FrameIO = {
      fetchBlob: async (url) => {
        if (what === "frame" && url.includes("f_0001")) return fakeBlob(url);
        throw new Error("blocked");
      },
      decode: async () => fakeBitmap(),
    };
    const fc = fakeClock();
    const budget = new FrameBudget(19 * FRAME, io, fc.clock);
    const a = new FrameCache(variant("a"), budget);
    const b = new FrameCache(variant("b"), budget);
    if (what === "poster") budget.notePoster(b, true);
    budget.want({ active: { cache: a, center: 0, direction: 1 } });
    await settle();
    await fc.advance(10_000);
    budget.notePoster(a, false);
    assert.ok(budget.stats.framesFailed >= 3, what);
    assert.equal(budget.halted, false, `${what}: something loaded, so the film is reachable`);
  }
});

test("halt() stops loading and tells the pack source to stop", async () => {
  const { io, fetches } = manualIO();
  const packs = fakePacks();
  let stopped = 0;
  const budget = new FrameBudget(19 * FRAME, io);
  budget.attachPacks({ ...packs.source, stop: () => void stopped++ });
  const a = new FrameCache(variant("a"), budget);
  budget.halt();
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  assert.equal(fetches.length, 0);
  assert.equal(stopped, 1);
  assert.equal(packs.wheres.length, 0);
});

test("reserve and release accounting returns to zero after dispose()", async () => {
  const { io, fetches, decodes } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  const b = new FrameCache(variant("b"), budget);
  budget.want({ active: { cache: a, center: 0, direction: 1 }, next: b });
  // Four fetches land; one decode finishes, one is still decoding at dispose.
  for (const f of fetches.slice(0, 4)) f.resolve(fakeBlob(f.url));
  await settle(4);
  decodes[0]?.resolve(fakeBitmap());
  await settle(4);
  assert.ok(budget.usedBytes > 0);
  assert.ok(budget.reservedBytes > 0);
  a.dispose();
  b.dispose();
  for (let round = 0; round < 3; round++) {
    for (const d of decodes) d.resolve(fakeBitmap());
    for (const f of fetches) f.resolve(fakeBlob(f.url));
    await settle();
  }
  assert.equal(budget.usedBytes, 0);
  assert.equal(budget.reservedBytes, 0);
  assert.equal(budget.stats.fetchInFlight, 0);
  assert.equal(budget.stats.decodeInFlight, 0);
  assert.equal(budget.wanted().length, 0);
  assert.equal(budget.count, 0);
  assert.ok(!a.has(0));
});

test("a cache re-created for the same film (StrictMode remount) reuses bytes and fetches in flight", async () => {
  const { io, fetches, decodes } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  assert.equal(fetches.length, 4);
  fetches[0]?.resolve(fakeBlob("0"));
  await settle(4);
  a.dispose();
  const again = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: again, center: 0, direction: 1 } });
  // Frame 0's bytes are held; frames 1–3 are still on the wire: no new fetch
  // for any of them, only for frames not yet requested.
  const urls = fetches.map((f) => f.url);
  assert.equal(new Set(urls).size, urls.length, "no URL requested twice");
  for (const f of fetches) f.resolve(fakeBlob(f.url));
  await settle(4);
  for (let round = 0; round < 10; round++) {
    for (const d of decodes) d.resolve(fakeBitmap());
    for (const f of fetches) f.resolve(fakeBlob(f.url));
    await settle(4);
  }
  assert.ok(again.has(0) && again.has(1) && again.has(3));
  assert.equal(budget.stats.refetches, 0);
  const all = fetches.map((f) => f.url);
  assert.equal(new Set(all).size, all.length, "no URL requested twice");
  assert.equal(budget.usedBytes, again.size * FRAME);
});

test("the blob store is byte-capped, least recently used out", async () => {
  const io: FrameIO = {
    fetchBlob: async (url) => ({ size: 1 * MB, url }) as unknown as Blob,
    decode: async () => fakeBitmap(),
  };
  // Small budget → 24 MB of compressed bytes.
  const budget = new FrameBudget(160 * MB, io);
  const a = new FrameCache(variant("a"), budget);
  for (let c = 0; c <= 240; c++) {
    budget.want({ active: { cache: a, center: c, direction: 1 } });
    await tick();
    await tick();
  }
  await settle();
  assert.ok(budget.blobBytes <= 24 * MB, `blob bytes ${budget.blobBytes}`);
  assert.ok(budget.hasBlob(a, 240));
  assert.ok(!budget.hasBlob(a, 0));
});

// ── Pack mode (the film worker holds the bytes; pack-client.ts) ────────────

const PACK = { bytes: 1, header: 1, skeletonEnd: 1, v: "pk" };
const packVariant = (name: string, count = 241): FilmVariant => ({ ...variant(name, count), pack: { ...PACK } });

/** A PackSource fake: the test says which frames are held; decodes settle when told (or at once). */
function fakePacks(opts: { auto?: boolean } = {}) {
  const held = new Map<string, Set<number>>();
  const failed = new Set<string>();
  const listeners = new Set<(v: FilmVariant, added: readonly number[] | null) => void>();
  const decodes: Array<{ name: string; index: number } & Deferred<{ bitmap: ImageBitmap; ms: number }>> = [];
  const wheres: Array<{ name: string; frame: number; lo: number; hi: number; pin: string | null }> = [];
  const bitmaps: Array<{ closed: number }> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const bitmap = () => {
    const b = { closed: 0 };
    bitmaps.push(b);
    return { width: W, height: H, close: () => b.closed++ } as unknown as ImageBitmap;
  };
  const source: PackSource = {
    serves: (v) => !!v.pack && !failed.has(v.name),
    holds: (v, i) => held.get(v.name)?.has(i) ?? false,
    decode: (v, i) => {
      const d = deferred<{ bitmap: ImageBitmap; ms: number }>();
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const done = d.promise.then(
        (r) => {
          inFlight--;
          return r;
        },
        (e) => {
          inFlight--;
          throw e;
        },
      );
      decodes.push({ name: v.name, index: i, ...d });
      if (opts.auto) void tick().then(() => d.resolve({ bitmap: bitmap(), ms: 3 }));
      return done;
    },
    where: (at) => wheres.push({ name: at.variant.name, frame: at.frame, lo: at.lo, hi: at.hi, pin: at.pin ? `${at.pin.variant.name}#${at.pin.frame}` : null }),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return {
    source,
    decodes,
    wheres,
    bitmaps,
    peak: () => maxInFlight,
    arrive(v: FilmVariant, indices: number[]) {
      let s = held.get(v.name);
      if (!s) held.set(v.name, (s = new Set()));
      for (const i of indices) s.add(i);
      for (const fn of listeners) fn(v, indices);
    },
    drop(v: FilmVariant, indices: number[]) {
      for (const i of indices) held.get(v.name)?.delete(i);
    },
    fail(v: FilmVariant) {
      failed.add(v.name);
      held.delete(v.name);
      for (const fn of listeners) fn(v, null);
    },
    bitmap,
  };
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("pack mode: a frame whose bytes are not held takes no slot; it decodes when they arrive while it is wanted", async () => {
  const { io, network } = autoIO();
  const packs = fakePacks();
  const budget = new FrameBudget(19 * FRAME, io);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  await settle(4);
  assert.equal(network.length, 0, "no per-frame request in pack mode");
  assert.equal(packs.decodes.length, 0, "nothing held, nothing decoded, no slot taken");
  assert.equal(budget.stats.mode, "pack");
  // A frame outside the wanted set arrives: not decoded.
  packs.arrive(a.variant, [5]);
  assert.equal(packs.decodes.length, 0);
  // Two wanted frames arrive: decoded (small budget: 2 at once).
  packs.arrive(a.variant, [104, 101]);
  assert.deepEqual(
    packs.decodes.map((d) => d.index).sort((x, y) => x - y),
    [101, 104],
  );
  assert.equal(budget.reservedBytes, 2 * FRAME, "a decode reserves its bytes when it starts");
  for (const d of packs.decodes) d.resolve({ bitmap: packs.bitmap(), ms: 4 });
  await settle(4);
  assert.ok(a.has(101) && a.has(104));
  assert.equal(budget.reservedBytes, 0);
  assert.equal(budget.stats.fetches, 0);
});

test("pack mode: decode order is coarse first, every 4th frame nearest the playhead, then the in-betweens", () => {
  const packs = fakePacks();
  const budget = new FrameBudget(19 * FRAME, manualIO().io);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  budget.want({ active: { cache: a, center: 101, direction: 1 } });
  const idx = budget.wanted().map((w) => w.index);
  assert.equal(idx[0], 101, "the playhead frame first");
  const rest = idx.slice(1);
  const firstFine = rest.findIndex((i) => i % 4 !== 0);
  assert.ok(firstFine > 0, "stride frames come first");
  assert.ok(rest.slice(0, firstFine).every((i) => i % 4 === 0));
  assert.ok(rest.slice(firstFine).every((i) => i % 4 !== 0), "then only in-between frames");
  // Cost = distance / 0.7 ahead, / 0.3 behind: 100 (3.3) before 104 (4.3) before 108 (10).
  assert.deepEqual(rest.slice(0, 3), [100, 104, 108], "stride frames nearest first, by the biased cost");
  // The same set as the per-frame path, only reordered.
  const plain = new FrameBudget(19 * FRAME, manualIO().io);
  const p = new FrameCache(variant("a"), plain);
  plain.want({ active: { cache: p, center: 101, direction: 1 } });
  assert.deepEqual(
    [...idx].sort((x, y) => x - y),
    plain.wanted().map((w) => w.index).sort((x, y) => x - y),
  );
  // The worker hears where the visitor is, with the window's bounds.
  const w = packs.wheres.at(-1);
  assert.equal(w?.frame, 101);
  assert.equal(w?.lo, Math.min(...idx));
  assert.equal(w?.hi, Math.max(...idx));
});

test("pack mode keeps the Phase 1 guarantees on forward, backward and jumping scrubs", async () => {
  for (const limit of [19 * FRAME, 384 * MB]) {
    const packs = fakePacks({ auto: true });
    const budget = new FrameBudget(limit, manualIO().io);
    budget.attachPacks(packs.source);
    const prev = new FrameCache(packVariant("prev"), budget);
    const a = new FrameCache(packVariant("a"), budget);
    const b = new FrameCache(packVariant("b"), budget);
    const unguard = guardEvictions(budget, prev, a, b);
    for (const c of [prev, a, b]) packs.arrive(c.variant, range(0, 240));
    budget.want({ active: { cache: prev, center: 240, direction: 1 } });
    await settle();
    const centers = [...range(0, 120).map((i) => i * 2), ...range(0, 120).map((i) => 240 - i * 2), 200, 3, 150, 77, 239, 0, 120];
    let last = 0;
    for (const [k, c] of centers.entries()) {
      const direction = c >= last ? 1 : -1;
      last = c;
      budget.want({ active: { cache: a, center: c, direction }, pin: { cache: prev, index: 240, until: 14 }, next: c > 140 ? b : undefined });
      // First (forward) sweep: the pinned frame, decoded before it, survives.
      if (k <= 120 && budget.isWanted(prev, 240)) assert.ok(prev.has(240), `pinned dissolve frame present at a#${c}`);
      assertWithinBudget(budget);
      assert.ok(budget.stats.decodeInFlight <= budget.maxDecodes);
      await tick();
      assertWithinBudget(budget);
    }
    await settle();
    assert.ok(packs.peak() <= budget.maxDecodes, `decodes in flight ${packs.peak()} ≤ ${budget.maxDecodes}`);
    assert.equal(budget.stats.fetches, 0);
    // No frame decoded twice while it was held: every redecode followed an eviction.
    assert.ok(budget.stats.redecodes <= budget.stats.evictions, `redecodes ${budget.stats.redecodes} ≤ evictions ${budget.stats.evictions}`);
    unguard();
    for (const c of [prev, a, b]) c.dispose();
    await settle();
    assert.equal(budget.usedBytes, 0);
    assert.equal(budget.reservedBytes, 0);
    assert.ok(
      packs.bitmaps.every((x) => x.closed === 1),
      `every bitmap closed once (${packs.bitmaps.filter((x) => x.closed !== 1).length} not)`,
    );
  }
});

test("pack mode: a bitmap that lands for a frame no longer wanted or a disposed cache is closed", async () => {
  const packs = fakePacks();
  const budget = new FrameBudget(19 * FRAME, manualIO().io);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  packs.arrive(a.variant, range(0, 240));
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  const first = packs.decodes.slice();
  assert.equal(first.length, 2);
  // The visitor jumps away; the two decodes land late.
  budget.want({ active: { cache: a, center: 200, direction: 1 } });
  for (const d of first) d.resolve({ bitmap: packs.bitmap(), ms: 1 });
  await settle(4);
  // Kept while they fit (useful as fallbacks), closed when evicted or disposed.
  const late = packs.decodes.slice(2);
  a.dispose();
  for (const d of late) d.resolve({ bitmap: packs.bitmap(), ms: 1 });
  await settle(4);
  assert.ok(packs.bitmaps.length >= 4);
  assert.ok(packs.bitmaps.every((x) => x.closed === 1), "every bitmap closed exactly once");
  assert.equal(budget.usedBytes, 0);
  assert.equal(budget.reservedBytes, 0);
});

test("pack fallback: decoded frames stay, the rest load per frame, pending decodes reject quietly", async () => {
  const { io, network } = autoIO();
  const packs = fakePacks();
  const budget = new FrameBudget(19 * FRAME, io);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  packs.arrive(a.variant, [100, 101, 102]);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  const [d0] = packs.decodes;
  d0!.resolve({ bitmap: packs.bitmap(), ms: 1 });
  await settle(4);
  assert.ok(a.has(100));
  // The pack fails (404) with decodes still in flight: the worker has
  // dropped its bytes, so they come back "missing".
  packs.fail(a.variant);
  for (const d of packs.decodes.slice(1)) d.reject(new Error("pack: decode missing"));
  await settle();
  assert.ok(a.has(100), "a decoded frame stays");
  assert.equal(budget.stats.mode, "frames", "the mode follows at once");
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  await settle();
  assert.equal(budget.stats.mode, "frames");
  assert.ok(network.length > 0, "the rest load per frame");
  assert.ok(!network.includes(frameUrl(a.variant, 100)), "not the frame already decoded");
  for (const w of budget.wanted()) assert.ok(a.has(w.index), `#${w.index} loaded after the fallback`);
});

test("pack mode: bytes dropped in the worker before a decode: no backoff, decoded when they return", async () => {
  const packs = fakePacks();
  const budget = new FrameBudget(19 * FRAME, manualIO().io);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  packs.arrive(a.variant, [50]);
  budget.want({ active: { cache: a, center: 50, direction: 1 } });
  packs.drop(a.variant, [50]);
  packs.decodes[0]!.reject(new Error("pack: decode missing"));
  await settle(4);
  assert.ok(!a.has(50));
  packs.arrive(a.variant, [50]);
  assert.equal(packs.decodes.length, 2, "decoded again at once when the bytes return");
  packs.decodes[1]!.resolve({ bitmap: packs.bitmap(), ms: 1 });
  await settle(4);
  assert.ok(a.has(50));
});

test("pack mode: a weak plan (mount warm-up) does not tell the worker anything", () => {
  const packs = fakePacks();
  const budget = new FrameBudget(19 * FRAME, manualIO().io);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  budget.want({ active: { cache: a, center: 0, direction: 1 } }, { weak: true });
  assert.equal(packs.wheres.length, 0);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  assert.equal(packs.wheres.length, 1);
});

test("draw gauges: the last paint's wanted and drawn frames", async () => {
  const { io } = autoIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 10, direction: 1 } });
  await settle();
  a.nearest(10, true);
  assert.deepEqual([budget.stats.drawWant, budget.stats.drawAt], [10, 10]);
  a.nearest(200, true);
  assert.equal(budget.stats.drawWant, 200);
  assert.ok(budget.stats.drawAt < 200);
  assert.ok(budget.stats.mainThreadDecodes > 0, "per-frame decodes run on the page");
});

test("pack mode: the dissolve pin is asked of the worker while wanted and not decoded; it decodes when it arrives", async () => {
  const packs = fakePacks({ auto: true });
  const budget = new FrameBudget(19 * FRAME, manualIO().io);
  budget.attachPacks(packs.source);
  const prev = new FrameCache(packVariant("prev"), budget);
  const a = new FrameCache(packVariant("a"), budget);
  // An anchor at the start of film a: nothing of the previous film is held.
  budget.want({ active: { cache: a, center: 0, direction: 1 }, pin: { cache: prev, index: 240, until: 14 } });
  assert.equal(packs.wheres.at(-1)?.pin, "prev#240", "the worker is asked for the pin");
  await settle(4);
  assert.ok(!prev.has(240));
  packs.arrive(prev.variant, [240]);
  await settle(4);
  assert.ok(prev.has(240), "decoded when its bytes arrive");
  budget.want({ active: { cache: a, center: 1, direction: 1 }, pin: { cache: prev, index: 240, until: 14 } });
  assert.equal(packs.wheres.at(-1)?.pin, null, "decoded: no longer asked");
  // Far past the dissolve the pin is not wanted, so not asked.
  prev.evict(240);
  budget.want({ active: { cache: a, center: 200, direction: 1 }, pin: { cache: prev, index: 240, until: 14 } });
  assert.equal(packs.wheres.at(-1)?.pin, null);
});

/** A stand-in for the DOM Image (node has none): decode() settles when the test says. */
function fakeImages() {
  const pending: Array<{ ok: (v: boolean) => void }> = [];
  class FakeImage {
    decoding = "";
    src = "";
    width = W;
    height = H;
    naturalWidth = 0;
    decode() {
      return new Promise<void>((resolve, reject) => {
        pending.push({
          ok: (v) => {
            if (v) {
              this.naturalWidth = W;
              resolve();
            } else reject(new Error("poster failed"));
          },
        });
      });
    }
  }
  const g = globalThis as unknown as { Image?: unknown };
  const prev = g.Image;
  g.Image = FakeImage;
  return { pending, restore: () => (g.Image = prev) };
}

test("handover (the paint that replaces the HTML poster): the poster beats a farther frame; nothing while it loads", async () => {
  const imgs = fakeImages();
  try {
    const { io } = manualIO();
    const budget = new FrameBudget(19 * FRAME, io);
    const a = new FrameCache(variant("a"), budget);
    const poster = a.loadPoster();
    assert.equal(a.posterPending, true);
    // Frame 4 (a skeleton frame, or a parallel decode that won) is decoded; frame 0 is not.
    const four = fakeBitmap();
    a.put(4, four, FRAME);
    assert.equal(a.nearest(0, true, true), null, "poster still loading: keep the HTML poster, draw nothing");
    assert.equal(a.lastServed, -1);
    assert.equal(a.nearest(0), four, "an ordinary paint still takes the neighbour");
    imgs.pending[0]!.ok(true);
    const p = await poster;
    assert.ok(p);
    assert.equal(a.posterPending, false);
    assert.equal(a.nearest(0, true, true), p, "frame 0 wanted: the poster IS frame 0");
    assert.equal(a.lastServed, -1);
    // Wanted frame 6: frame 4 (2 away) is closer than the poster (6 away).
    assert.equal(a.nearest(6, true, true), four);
    // Wanted frame 2: the poster (2 away) ties frame 4 (2 away): the poster.
    assert.equal(a.nearest(2, true, true), p);
    // The exact frame always wins.
    const zero = fakeBitmap();
    a.put(0, zero, FRAME);
    assert.equal(a.nearest(0, true, true), zero);
    assert.equal(a.lastServed, 0);
    a.dispose();
  } finally {
    imgs.restore();
  }
});

test("handover with a failed poster draws the neighbour (the canvas still takes over)", async () => {
  const imgs = fakeImages();
  try {
    const { io } = manualIO();
    const budget = new FrameBudget(19 * FRAME, io);
    const a = new FrameCache(variant("a"), budget);
    const poster = a.loadPoster();
    const four = fakeBitmap();
    a.put(4, four, FRAME);
    imgs.pending[0]!.ok(false);
    assert.equal(await poster, null);
    assert.equal(a.posterPending, false);
    assert.equal(a.nearest(0, true, true), four);
    a.dispose();
  } finally {
    imgs.restore();
  }
});

test("handover before any poster load started (static budget) is an ordinary nearest", () => {
  const { io } = manualIO();
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  const four = fakeBitmap();
  a.put(4, four, FRAME);
  assert.equal(a.posterPending, false);
  assert.equal(a.nearest(0, true, true), four);
  a.dispose();
});

// ── Recovery after a network drop (Phase 6b) ───────────────────────────────

/**
 * IO for the recovery tests, timed by the fake clock. `down(url)`: the
 * request fails with a network error (transient); `gone(url)`: the server
 * answers 404 (permanent). Probes have no IO of their own here, so they go
 * through fetchBlob (the poster's URL).
 */
/** Let what is in flight now settle at the current time, then advance the clock. */
async function go(fc: ReturnType<typeof fakeClock>, ms: number) {
  await settle();
  await fc.advance(ms);
}

function netIO(fc: ReturnType<typeof fakeClock>) {
  const log: Array<{ url: string; t: number }> = [];
  const state = { down: (_url: string) => true, gone: (_url: string) => false };
  const io: FrameIO = {
    fetchBlob: async (url) => {
      log.push({ url, t: fc.now() });
      await tick();
      if (state.gone(url)) throw filmError(`${url} 404`, true);
      if (state.down(url)) throw new TypeError("Failed to fetch");
      return fakeBlob(url);
    },
    decode: async () => fakeBitmap(),
  };
  const tries = (url: string) => log.filter((l) => l.url === url).length;
  return { io, log, state, tries };
}

test("recovery: frames failed in a network drop load again on 'online', each with a fresh set of tries", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  // The poster came before the drop: the film is reachable, nothing halts.
  budget.notePoster(a, true);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await go(fc, 10_000);
  const wanted = budget.wanted().map((w) => frameUrl(a.variant, w.index));
  for (const u of wanted) assert.equal(n.tries(u), FRAME_TRIES, `${u}: ${FRAME_TRIES} tries in the drop`);
  assert.equal(budget.stats.framesFailed, wanted.length);
  const quiet = n.log.length;
  await go(fc, 60_000);
  assert.equal(n.log.length, quiet, "no request without a recovery signal");
  // The browser reports online while the network is still down: one fresh
  // set of tries each, then quiet again.
  budget.noteOnline();
  await go(fc, 10_000);
  for (const u of wanted) assert.equal(n.tries(u), 2 * FRAME_TRIES, `${u}: a fresh set of tries`);
  const after = n.log.length;
  await go(fc, 60_000);
  assert.equal(n.log.length, after, "spent again: no retry loop");
  // Back for real.
  n.state.down = () => false;
  budget.noteOnline();
  await go(fc, 5_000);
  for (const w of budget.wanted()) assert.ok(a.has(w.index), `frame ${w.index} loaded`);
  assert.equal(budget.stats.framesFailed, 0);
  assert.equal(budget.stats.recoveries, 2);
  assert.equal(budget.halted, false);
});

test("recovery: a film response that succeeds after a drop forgives what failed in it", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.notePoster(a, true);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await go(fc, 10_000);
  assert.ok(budget.stats.framesFailed >= 10);
  n.state.down = () => false;
  // No 'online' event (a flaky cell, a tunnel): the visitor moves on, new
  // frames load, and that success forgives the drop.
  budget.want({ active: { cache: a, center: 30, direction: -1 } });
  await go(fc, 1_000);
  assert.equal(budget.stats.recoveries, 1);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await go(fc, 2_000);
  for (const w of budget.wanted()) assert.ok(a.has(w.index), `frame ${w.index} loaded`);
  assert.equal(budget.stats.framesFailed, 0);
});

test("recovery: a permanent failure (404) is never retried on any signal", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const gone = frameUrl(variant("a"), 5);
  const flaky = frameUrl(variant("a"), 2);
  n.state.gone = (u) => u === gone;
  n.state.down = (u) => u === flaky;
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 4, direction: 1 } });
  await go(fc, 10_000);
  assert.equal(n.tries(gone), FRAME_TRIES);
  assert.equal(n.tries(flaky), FRAME_TRIES);
  n.state.down = () => false;
  // Every kind of signal, each honoured (more than 5 s apart).
  budget.noteOnline();
  await go(fc, 10_000);
  assert.ok(a.has(2), "the transiently failed frame loads on the first signal");
  budget.noteVisibility(true);
  await go(fc, 12_000);
  budget.noteVisibility(false);
  await go(fc, 10_000);
  budget.noteOnline();
  await go(fc, 60_000);
  assert.equal(n.tries(gone), FRAME_TRIES, "the 404 frame: never requested again");
  assert.equal(n.tries(flaky), FRAME_TRIES + 1);
  assert.ok(!a.has(5));
  assert.equal(budget.stats.framesFailed, 1);
});

test("recovery: with every film file missing (404) nothing is retried or probed, on any signal", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  n.state.down = () => false;
  n.state.gone = () => true;
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.notePoster(a, false);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await go(fc, 10_000);
  assert.equal(budget.halted, true, "static mode, as before");
  const total = n.log.length;
  budget.noteOnline();
  budget.noteVisibility(true);
  await go(fc, 30_000);
  budget.noteVisibility(false);
  budget.want({ active: { cache: a, center: 100, direction: 1 } });
  await go(fc, 30 * 60_000);
  assert.equal(n.log.length, total, "not one more request");
  assert.equal(budget.stats.probes, 0);
  assert.equal(budget.stats.recoveries, 0);
  assert.equal(budget.halted, true);
});

/** Halt a budget the way an unreachable film does: a poster failed, frames failing transiently. */
async function haltedBudget() {
  const fc = fakeClock();
  const n = netIO(fc);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  let haltAt = -1;
  budget.onHalt(() => (haltAt = fc.now()));
  budget.notePoster(a, false);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await go(fc, 3_000);
  assert.equal(budget.halted, true);
  return { fc, n, budget, a, haltAt, probes: () => n.log.filter((l) => l.t > haltAt) };
}

test("recovery: halted for unreachability, the page probes 5 s, 15 s and 45 s after the halt, then every 60 s, 10 at most", async () => {
  const { fc, budget, a, haltAt, probes } = await haltedBudget();
  await go(fc, 30 * 60_000);
  assert.ok(probes().every((p) => p.url === a.variant.poster), "nothing but probes after the halt");
  assert.deepEqual(
    probes().map((p) => (p.t - haltAt) / 1000),
    [5, 15, 45, 105, 165, 225, 285, 345, 405, 465],
  );
  assert.equal(budget.stats.probes, 10);
  assert.equal(budget.halted, true);
});

test("recovery: no probe while the document is hidden; one that came due runs when it is shown", async () => {
  const { fc, budget, haltAt, probes } = await haltedBudget();
  await go(fc, haltAt + 4_000 - fc.now());
  budget.noteVisibility(true);
  await go(fc, 8_000);
  assert.equal(probes().length, 0, "the 5 s probe waits while hidden");
  // Hidden 8 s: not a recovery signal, but the due probe runs now.
  budget.noteVisibility(false);
  await go(fc, 4_000);
  assert.deepEqual(
    probes().map((p) => (p.t - haltAt) / 1000),
    [12, 15],
  );
});

test("recovery: a probe that succeeds un-halts; the plan made while halted loads, packs resume", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const packs = fakePacks();
  let resumed = 0;
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  budget.attachPacks({ ...packs.source, resume: () => void resumed++ });
  const a = new FrameCache(variant("a"), budget);
  const events: string[] = [];
  budget.onHalt(() => events.push("halt"));
  budget.onResume(() => events.push("resume"));
  budget.notePoster(a, false);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await go(fc, 3_000);
  assert.equal(budget.halted, true);
  // The visitor scrolls while halted: nothing is requested, the plan is kept.
  const before = n.log.length;
  budget.want({ active: { cache: a, center: 120, direction: 1 } });
  await settle();
  assert.equal(n.log.length, before);
  n.state.down = () => false;
  await go(fc, 5_000);
  assert.deepEqual(events, ["halt", "resume"]);
  assert.equal(budget.halted, false);
  assert.equal(resumed, 1, "the pack source is told to read again");
  assert.equal(budget.stats.probes, 1);
  assert.equal(budget.stats.recoveries, 1);
  await go(fc, 2_000);
  assert.equal(budget.wanted()[0]?.index, 120, "the plan made while halted");
  for (const w of budget.wanted()) assert.ok(a.has(w.index), `frame ${w.index} loaded`);
  await go(fc, 10 * 60_000);
  assert.equal(budget.stats.probes, 1, "no probe once running again");
});

test("recovery: a halt by the page (no 2D context) never probes or resumes", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.halt();
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  budget.noteOnline();
  budget.noteVisibility(true);
  await go(fc, 20_000);
  budget.noteVisibility(false);
  await go(fc, 30 * 60_000);
  assert.equal(n.log.length, 0);
  assert.equal(budget.halted, true);
});

test("recovery: signals closer together than 5 s are coalesced into one at the 5 s mark", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  budget.notePoster(a, true);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  await go(fc, 10_000);
  const first = frameUrl(a.variant, 0);
  assert.equal(n.tries(first), FRAME_TRIES);
  budget.noteOnline();
  await go(fc, 1_000);
  assert.equal(budget.stats.recoveries, 1, "the first signal is honoured at once");
  budget.noteOnline();
  await go(fc, 1_000);
  budget.noteOnline();
  budget.noteVisibility(true);
  budget.noteVisibility(false);
  await go(fc, 2_000);
  assert.equal(budget.stats.recoveries, 1, "signals within 5 s wait");
  await go(fc, 1_000);
  assert.equal(budget.stats.recoveries, 2, "and are honoured once, 5 s after the last");
  await go(fc, 60_000);
  assert.equal(budget.stats.recoveries, 2);
  assert.equal(n.tries(first), 3 * FRAME_TRIES, "a fresh set of tries per honoured signal, no more");
});

test("recovery: with the network down for good, requests are bounded: the halt's count, then at most 10 probes", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  const b = new FrameCache(variant("b"), budget);
  let haltAt = -1;
  budget.onHalt(() => (haltAt = fc.now()));
  budget.notePoster(a, false);
  budget.notePoster(b, false);
  budget.want({ active: { cache: a, center: 0, direction: 1 }, next: b });
  await go(fc, 5_000);
  assert.equal(budget.halted, true);
  const atHalt = n.log.filter((l) => l.t <= haltAt).length;
  // An hour: the visitor scrolls every second, the browser says 'online'
  // every 3 s, the tab is hidden for 30 s of every minute.
  for (let s = 0; s < 3600; s++) {
    budget.want({ active: { cache: s % 2 ? a : b, center: (s * 7) % 240, direction: 1 } });
    if (s % 3 === 0) budget.noteOnline();
    if (s % 60 === 10) budget.noteVisibility(true);
    if (s % 60 === 40) budget.noteVisibility(false);
    await go(fc, 1_000);
  }
  const after = n.log.filter((l) => l.t > haltAt);
  assert.equal(n.log.length, atHalt + after.length);
  assert.ok(after.length <= 10, `${after.length} requests after the halt`);
  assert.equal(after.length, budget.stats.probes, "every request after the halt is a probe");
  assert.ok(after.every((l) => l.url.endsWith("/poster.webp")));
  assert.equal(budget.halted, true);
});

// ── Review fixes: bounded forgiveness, poster classification, probe timers ──

/** A pack source whose one pack (or several) fails transiently `failAfter` ms after it is served again; frames are never held. */
function flakyPacks(fc: ReturnType<typeof fakeClock>, failAfter: number) {
  const failed = new Set<string>();
  const known = new Map<string, FilmVariant>();
  const listeners = new Set<(v: FilmVariant, added: readonly number[] | null) => void>();
  let resumes = 0;
  const fail = (v: FilmVariant) => {
    if (failed.has(v.name)) return;
    failed.add(v.name);
    for (const fn of listeners) fn(v, null);
  };
  const source: PackSource = {
    serves: (v) => {
      if (v.pack) known.set(v.name, v);
      return !!v.pack && !failed.has(v.name);
    },
    holds: () => false,
    decode: () => Promise.reject(new Error("pack: decode missing")),
    where: () => {},
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    stop: () => {},
    resume: () => {
      for (const name of [...failed]) {
        failed.delete(name);
        resumes++;
        const v = known.get(name)!;
        fc.clock.later(() => fail(v), failAfter);
      }
    },
    hasTransient: () => failed.size > 0,
    transient: (v) => failed.has(v.name),
  };
  return { source, fail, resumes: () => resumes };
}

test("recovery: one pack that keeps failing transiently while its frames load is not forgiven over and over", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  n.state.down = () => false;
  const packs = flakyPacks(fc, 3_000);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  budget.notePoster(a, true);
  budget.want({ active: { cache: a, center: 0, direction: 1 } });
  packs.fail(a.variant);
  // Two minutes of a visitor moving 2 frames a second: per-frame loads succeed.
  for (let s = 0; s < 120; s++) {
    budget.want({ active: { cache: a, center: s * 2, direction: 1 } });
    await go(fc, 1_000);
  }
  assert.equal(budget.stats.recoveries, 0, "one pack alone is that file's problem, not a drop");
  assert.equal(packs.resumes(), 0);
});

test("recovery: packs forgiven by a success fail again: not forgiven again by the next success", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  n.state.down = () => false;
  const packs = flakyPacks(fc, 3_000);
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  budget.attachPacks(packs.source);
  const a = new FrameCache(packVariant("a"), budget);
  const b = new FrameCache(packVariant("b"), budget);
  budget.notePoster(a, true);
  budget.want({ active: { cache: a, center: 0, direction: 1 }, next: b });
  packs.fail(a.variant);
  packs.fail(b.variant);
  for (let s = 0; s < 120; s++) {
    budget.want({ active: { cache: a, center: s * 2, direction: 1 }, next: b });
    await go(fc, 1_000);
  }
  assert.ok(budget.stats.recoveries <= 1, `${budget.stats.recoveries} recoveries`);
  assert.ok(packs.resumes() <= 2, `${packs.resumes()} pack resumes`);
});

test("recovery: frames that keep failing transiently while others load get a fresh set of tries once, not every 5 s", async () => {
  const fc = fakeClock();
  const n = netIO(fc);
  const b = variant("b");
  const x = frameUrl(b, 1);
  const y = frameUrl(b, 2);
  n.state.down = (u) => u === x || u === y;
  const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
  const a = new FrameCache(variant("a"), budget);
  const bc = new FrameCache(b, budget);
  budget.notePoster(a, true);
  // The next film's opening (x, y) stays wanted while the visitor walks the active film.
  for (let s = 0; s < 120; s++) {
    budget.want({ active: { cache: a, center: s * 2, direction: 1 }, next: bc });
    await go(fc, 1_000);
  }
  assert.ok(budget.stats.recoveries <= 1, `${budget.stats.recoveries} recoveries`);
  assert.ok(n.tries(x) <= 2 * FRAME_TRIES, `${n.tries(x)} tries of one failing frame`);
  assert.ok(n.tries(y) <= 2 * FRAME_TRIES, `${n.tries(y)} tries of one failing frame`);
});

test("recovery: a poster that is missing (404) is asked for at most once more, whatever the signals", async () => {
  const imgs = fakeImages();
  try {
    const fc = fakeClock();
    const n = netIO(fc);
    const v = variant("a");
    n.state.gone = (u) => u === v.poster;
    const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
    const a = new FrameCache(v, budget);
    const b = new FrameCache(variant("b"), budget);
    void b.loadPoster();
    imgs.pending[0]!.ok(true);
    void a.loadPoster();
    imgs.pending[1]!.ok(false);
    await settle();
    let settled = imgs.pending.length;
    // Frames fail transiently (the network is down), so each 'online' is honoured.
    budget.want({ active: { cache: a, center: 0, direction: 1 } });
    await go(fc, 10_000);
    for (let i = 0; i < 5; i++) {
      budget.noteOnline();
      await go(fc, 10_000);
      // A poster asked for again through an <img> gets the same 404.
      for (const p of imgs.pending.slice(settled)) p.ok(false);
      settled = imgs.pending.length;
      await go(fc, 1_000);
    }
    assert.equal(budget.stats.recoveries, 5);
    const asked = imgs.pending.length - 1 + n.tries(v.poster);
    assert.ok(asked <= 2, `the missing poster was asked for ${asked} times`);
  } finally {
    imgs.restore();
  }
});

test("recovery: a poster that failed in a drop loads on the next recovery signal", async () => {
  const imgs = fakeImages();
  try {
    const fc = fakeClock();
    const n = netIO(fc);
    const v = variant("a");
    const budget = new FrameBudget(19 * FRAME, n.io, fc.clock);
    const a = new FrameCache(v, budget);
    const b = new FrameCache(variant("b"), budget);
    void b.loadPoster();
    imgs.pending[0]!.ok(true);
    void a.loadPoster();
    imgs.pending[1]!.ok(false);
    await settle();
    const landed: number[] = [];
    a.subscribe((i) => landed.push(i));
    budget.want({ active: { cache: a, center: 0, direction: 1 } });
    await go(fc, 10_000);
    n.state.down = () => false;
    budget.noteOnline();
    await go(fc, 1_000);
    // A poster asked for again through an <img> loads now.
    for (const p of imgs.pending.slice(2)) p.ok(true);
    await go(fc, 4_000);
    assert.ok(landed.includes(-1), "the poster landed");
    assert.equal(a.posterPending, false);
    a.dispose();
    assert.ok(a.nearest(0) !== null);
  } finally {
    imgs.restore();
  }
});

test("recovery: probing stops arming timers when every cache is disposed, and starts again with a new one", async () => {
  const { fc, n, budget, a, haltAt } = await haltedBudget();
  a.dispose();
  await go(fc, 6 * 3600_000);
  assert.equal(fc.pending(), 0, "no timer chain left behind");
  assert.equal(budget.stats.probes, 0);
  const c = new FrameCache(variant("a"), budget);
  await go(fc, 1_000);
  const probes = n.log.filter((l) => l.t > haltAt);
  assert.equal(probes.length, 1, "the probe that came due runs when a film is back");
  assert.equal(probes[0]!.url, c.variant.poster);
  await go(fc, 10_000);
  assert.equal(budget.stats.probes, 2, "and the schedule goes on");
});
