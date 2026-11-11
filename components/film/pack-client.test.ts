import { test } from "node:test";
import assert from "node:assert/strict";
import type { FromWorker, ToWorker } from "./film-worker-protocol";
import { newFilmStats } from "./frame-cache";
import { PackClient, packUrl, type WorkerLike } from "./pack-client";
import type { FilmVariant } from "./types";

const LAYOUT = { bytes: 1000, header: 120, skeletonEnd: 400, v: "pk1" };
const variant = (name: string, pack = true): FilmVariant => ({
  name,
  count: 8,
  pad: 4,
  ext: "webp",
  width: 900,
  height: 810,
  poster: `/films/${name}/poster.webp`,
  base: `/films/${name}`,
  v: "fv",
  ...(pack ? { pack: { ...LAYOUT } } : {}),
});

function fakeWorker() {
  const sent: ToWorker[] = [];
  const w: WorkerLike & { sent: ToWorker[]; reply: (m: FromWorker) => void; terminated: boolean } = {
    sent,
    terminated: false,
    postMessage: (m) => sent.push(m),
    terminate() {
      this.terminated = true;
    },
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    reply(m) {
      this.onmessage?.({ data: m } as MessageEvent<FromWorker>);
    },
  };
  return w;
}

function setup(o: { scrollY?: number | (() => number); hash?: string; start?: () => WorkerLike } = {}) {
  const reel = [variant("a"), variant("b"), variant("c", false)];
  const stats = newFilmStats();
  const w = fakeWorker();
  let starts = 0;
  let onScroll = () => {};
  const client = new PackClient({
    stats,
    capBytes: 48,
    reel: () => reel,
    start:
      o.start ??
      (() => {
        starts++;
        return w;
      }),
    env: {
      scrollY: () => (typeof o.scrollY === "function" ? o.scrollY() : (o.scrollY ?? 0)),
      hash: () => o.hash ?? "",
      hidden: () => false,
      constrained: () => false,
      listen: (s) => {
        onScroll = s;
        return () => {};
      },
    },
  });
  return { client, reel, stats, w, starts: () => starts, scroll: () => onScroll() };
}

const at = (v: FilmVariant, frame = 0) => ({ variant: v, frame, direction: 1 as const, lo: 0, hi: 7 });

test("the worker starts on the first scroll decision, not before; the reel's packs and the position follow", () => {
  const { client, reel, w, starts } = setup();
  assert.equal(starts(), 0, "constructing starts nothing");
  client.where(at(reel[0]!));
  client.where(at(reel[0]!, 1));
  assert.equal(starts(), 1);
  assert.deepEqual(
    w.sent.map((m) => m.t),
    ["init", "packs", "where", "where"],
  );
  const packs = w.sent[1] as Extract<ToWorker, { t: "packs" }>;
  assert.deepEqual(
    packs.packs.map((p) => [p.key, p.url, p.film]),
    [
      ["a@pk1", "/films/a/pack.bin?v=pk1", 0],
      ["b@pk1", "/films/b/pack.bin?v=pk1", 1],
    ],
    "variants without a pack are left out",
  );
  assert.equal(packUrl(reel[1]!), "/films/b/pack.bin?v=pk1");
  const where = w.sent[2] as Extract<ToWorker, { t: "where" }>;
  assert.equal(where.where.scrolled, false);
});

test("a scroll position above 0 or an anchor at load counts as scrolled; otherwise the first scroll does", () => {
  for (const [o, want] of [
    [{ scrollY: 300 }, true],
    [{ hash: "#pricing" }, true],
    [{}, false],
  ] as const) {
    const { client, reel, w } = setup(o);
    client.where(at(reel[0]!));
    assert.equal((w.sent[2] as Extract<ToWorker, { t: "where" }>).where.scrolled, want);
  }
  const { client, reel, w, scroll } = setup();
  client.where(at(reel[0]!));
  scroll();
  const last = w.sent.at(-1) as Extract<ToWorker, { t: "where" }>;
  assert.equal(last.where.scrolled, true, "the first scroll tells the worker");
});

test("arrivals update the mirror and notify; a decoded bitmap resolves its request", async () => {
  const { client, reel, w, stats } = setup();
  const seen: string[] = [];
  client.subscribe((v, added) => seen.push(`${v.name}:${added ? added.join(",") : "null"}`));
  client.where(at(reel[0]!));
  assert.ok(!client.holds(reel[0]!, 4));
  w.reply({ t: "frames", key: "a@pk1", added: [0, 4], removed: [] });
  assert.ok(client.holds(reel[0]!, 4));
  assert.deepEqual(seen, ["a:0,4"]);
  w.reply({ t: "frames", key: "a@pk1", added: [], removed: [4] });
  assert.ok(!client.holds(reel[0]!, 4), "a dropped frame is no longer held");
  const p = client.decode(reel[0]!, 0);
  const req = w.sent.at(-1) as Extract<ToWorker, { t: "decode" }>;
  const bmp = { width: 1, height: 1, close() {} } as unknown as ImageBitmap;
  w.reply({ t: "decoded", id: req.id, ok: true, bitmap: bmp, ms: 7 });
  assert.equal((await p).bitmap, bmp);
  assert.equal(stats.workerDecodes, 1);
  assert.equal(stats.workerDecodeMeanMs, 7);
});

test("a failed pack falls back for that variant only", () => {
  const { client, reel, w, stats } = setup();
  const seen: string[] = [];
  client.subscribe((v, added) => seen.push(`${v.name}:${added ? "frames" : "null"}`));
  client.where(at(reel[0]!));
  w.reply({ t: "frames", key: "b@pk1", added: [1], removed: [] });
  w.reply({ t: "failed", key: "b@pk1", reason: "pack answered 404" });
  assert.ok(!client.serves(reel[1]!));
  assert.ok(client.serves(reel[0]!));
  assert.ok(!client.holds(reel[1]!, 1));
  assert.deepEqual(seen, ["b:frames", "b:null"]);
  assert.equal(stats.packFallbacks, 1);
});

test("a worker that crashes, lacks a feature or cannot start: every variant falls back, pending decodes reject", async () => {
  {
    const { client, reel, w } = setup();
    const seen: string[] = [];
    client.subscribe((v, added) => seen.push(`${v.name}:${added ? "frames" : "null"}`));
    client.where(at(reel[0]!));
    w.reply({ t: "frames", key: "a@pk1", added: [0], removed: [] });
    const p = client.decode(reel[0]!, 0);
    w.onerror?.({ preventDefault() {} } as ErrorEvent);
    await assert.rejects(p);
    assert.ok(!client.serves(reel[0]!) && !client.serves(reel[1]!));
    assert.ok(w.terminated);
    assert.ok(seen.includes("a:null") && seen.includes("b:null"));
    await assert.rejects(client.decode(reel[0]!, 0));
    client.where(at(reel[0]!, 3)); // no throw, nothing sent
  }
  {
    const { client, reel, w } = setup();
    client.where(at(reel[0]!));
    w.reply({ t: "ready", ok: false, missing: "createImageBitmap" });
    assert.ok(!client.serves(reel[0]!));
    assert.match(client.deadReason ?? "", /createImageBitmap/);
  }
  {
    const { client, reel } = setup({
      start: () => {
        throw new Error("blocked");
      },
    });
    client.where(at(reel[0]!));
    assert.ok(!client.serves(reel[0]!));
  }
});

test("a decode that lands after the client was reset is closed, not leaked", () => {
  const { client, reel, w } = setup();
  client.where(at(reel[0]!));
  void client.decode(reel[0]!, 0).catch(() => {});
  const req = w.sent.at(-1) as Extract<ToWorker, { t: "decode" }>;
  const onmessage = w.onmessage;
  client.dispose();
  let closed = 0;
  onmessage?.({ data: { t: "decoded", id: req.id, ok: true, bitmap: { close: () => closed++ } as unknown as ImageBitmap, ms: 1 } } as MessageEvent<FromWorker>);
  assert.equal(closed, 1);
});

// ---- Regressions (review of Phase 4) ----

test("whether the visitor has scrolled is read when the reel starts, not during render; a film past the first counts", () => {
  // A client-side link from a scrolled page: scrollY still holds the old
  // page's offset while the new route renders, then the router resets it.
  let y = 1800;
  const a = setup({ scrollY: () => y });
  y = 0;
  a.client.where(at(a.reel[0]!));
  assert.equal((a.w.sent[2] as Extract<ToWorker, { t: "where" }>).where.scrolled, false, "scrollY at render time is not a scroll");
  // Scroll restoration after the worker started, with no scroll event yet: the next decision sees it.
  y = 2400;
  a.client.where(at(a.reel[0]!, 2));
  assert.equal((a.w.sent.at(-1) as Extract<ToWorker, { t: "where" }>).where.scrolled, true);
  // The active film is not the first: the visitor has scrolled.
  const b = setup();
  b.client.where(at(b.reel[1]!));
  assert.equal((b.w.sent[2] as Extract<ToWorker, { t: "where" }>).where.scrolled, true);
});

test("a re-sent reel keeps a failed pack in its place, marked failed", () => {
  const { client, reel, w } = setup();
  client.where(at(reel[0]!));
  w.reply({ t: "failed", key: "b@pk1", reason: "pack answered 404" });
  client.dispose();
  client.where(at(reel[1]!));
  const packs = w.sent.filter((m): m is Extract<ToWorker, { t: "packs" }> => m.t === "packs").at(-1)!;
  assert.deepEqual(
    packs.packs.map((p) => [p.key, p.film, !!p.failed]),
    [
      ["a@pk1", 0, false],
      ["b@pk1", 1, true],
    ],
  );
  const where = w.sent.at(-1) as Extract<ToWorker, { t: "where" }>;
  assert.equal(where.where.key, "b@pk1", "the worker finds the visitor's film in the reel");
});

test("the dissolve pin goes to the worker with the position", () => {
  const { client, reel, w } = setup();
  client.where({ ...at(reel[1]!), pin: { variant: reel[0]!, frame: 7 } });
  assert.deepEqual((w.sent.at(-1) as Extract<ToWorker, { t: "where" }>).where.pin, { key: "a@pk1", frame: 7 });
  client.where(at(reel[1]!, 3));
  assert.equal((w.sent.at(-1) as Extract<ToWorker, { t: "where" }>).where.pin, null);
});

test("stop(): every pack is marked failed in the worker, nothing is read again; the worker stays (idle, not crashed)", () => {
  const { client, reel, w, starts } = setup();
  client.where(at(reel[0]!));
  assert.equal(starts(), 1);
  const sent = w.sent.length;
  client.stop();
  assert.equal(w.terminated, false);
  const last = w.sent.at(-1);
  assert.equal(last?.t, "packs");
  if (last?.t === "packs") {
    assert.ok(last.packs.length > 0);
    assert.ok(last.packs.every((p) => p.failed === true), "every pack failed: the worker never reads one again");
  }
  assert.equal(client.serves(reel[0]!), false, "a stopped client serves no variant");
  const afterStop = w.sent.length;
  assert.ok(afterStop > sent);
  client.where(at(reel[0]!, 3));
  client.where(at(reel[1]!, 0));
  assert.equal(w.sent.length, afterStop, "no message after stop");
  assert.equal(starts(), 1, "no new worker after stop");
});

test("stop() before the worker started: it never starts", () => {
  const { client, reel, starts } = setup();
  client.stop();
  client.where(at(reel[0]!));
  assert.equal(starts(), 0);
});

// ── Recovery after a network drop (Phase 6b) ───────────────────────────────

const recovers = (w: ReturnType<typeof fakeWorker>) =>
  w.sent.filter((m): m is Extract<ToWorker, { t: "recover" }> => m.t === "recover").map((m) => m.keys);

test("recovery: resume() makes a transiently failed pack readable again; a pack that answered 404 stays failed", () => {
  const { client, reel, w } = setup();
  client.where(at(reel[0]!));
  assert.equal(client.hasTransient(), false);
  w.reply({ t: "failed", key: "a@pk1", reason: "network error, 4 times", permanent: false });
  w.reply({ t: "failed", key: "b@pk1", reason: "pack answered 404", permanent: true });
  assert.equal(client.hasTransient(), true);
  client.resume();
  assert.ok(client.serves(reel[0]!));
  assert.ok(!client.serves(reel[1]!));
  assert.deepEqual(recovers(w), [["a@pk1"]]);
  assert.equal(client.hasTransient(), false);
  client.resume();
  assert.deepEqual(recovers(w), [["a@pk1"]], "nothing left to recover: no message");
});

test("recovery: a failure without a kind (an older worker) counts as permanent", () => {
  const { client, reel, w } = setup();
  client.where(at(reel[0]!));
  w.reply({ t: "failed", key: "a@pk1", reason: "pack answered 404" });
  assert.equal(client.hasTransient(), false);
  client.resume();
  assert.ok(!client.serves(reel[0]!));
  assert.deepEqual(recovers(w), []);
});

test("recovery: stop() then resume(): the packs are read again and the worker hears positions again", () => {
  const { client, reel, w, starts } = setup();
  client.where(at(reel[0]!));
  w.reply({ t: "failed", key: "b@pk1", reason: "pack answered 404", permanent: true });
  client.stop();
  assert.ok(!client.serves(reel[0]!));
  client.resume();
  assert.ok(client.serves(reel[0]!), "the stopped pack is served again");
  assert.ok(!client.serves(reel[1]!), "the 404 pack is not");
  assert.deepEqual(recovers(w), [["a@pk1"]]);
  const n = w.sent.length;
  client.where(at(reel[0]!, 3));
  assert.ok(w.sent.length > n);
  assert.equal(w.sent.at(-1)?.t, "where");
  assert.equal(starts(), 1, "the same worker");
});

test("recovery: a failure reported for a pack stop() had marked takes the reported kind", () => {
  const { client, reel, w } = setup();
  client.where(at(reel[0]!));
  client.stop();
  w.reply({ t: "failed", key: "a@pk1", reason: "pack answered 404", permanent: true });
  client.resume();
  assert.ok(!client.serves(reel[0]!));
  assert.ok(client.serves(reel[1]!));
  assert.deepEqual(recovers(w), [["b@pk1"]]);
});

test("recovery: stop() before the worker started, then resume(): the worker starts on the next decision", () => {
  const { client, reel, w, starts } = setup();
  client.stop();
  client.resume();
  client.where(at(reel[0]!));
  assert.equal(starts(), 1);
  const packs = w.sent.filter((m): m is Extract<ToWorker, { t: "packs" }> => m.t === "packs").at(-1)!;
  assert.ok(packs.packs.every((p) => !p.failed), "no pack is sent failed");
});
