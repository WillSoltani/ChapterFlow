import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameBudget, FrameCache, frameUrl, type FrameIO } from "./frame-cache";
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
  for (const c of caches) {
    const orig = c.evict.bind(c);
    c.evict = (i: number) => {
      assert.ok(!budget.isWanted(c, i), `evicted wanted frame ${c.variant.name}#${i}`);
      orig(i);
    };
  }
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

test("a failed fetch leaves a hole and is not retried while it stays wanted", async () => {
  const network: string[] = [];
  const io: FrameIO = {
    fetchBlob: async (url) => {
      network.push(url);
      if (url.includes("f_0006")) throw new Error("404");
      return fakeBlob(url);
    },
    decode: async () => fakeBitmap(),
  };
  const budget = new FrameBudget(19 * FRAME, io);
  const a = new FrameCache(variant("a"), budget);
  budget.want({ active: { cache: a, center: 4, direction: 1 } });
  await settle();
  budget.want({ active: { cache: a, center: 5, direction: 1 } });
  await settle();
  assert.equal(network.filter((u) => u.includes("f_0006")).length, 1);
  assert.ok(!a.has(5));
  assert.ok(a.has(6));
  // nearest covers the hole with a neighbour.
  assert.ok(a.nearest(5));
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
