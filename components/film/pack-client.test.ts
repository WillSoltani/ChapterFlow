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

function setup(o: { scrollY?: number; hash?: string; start?: () => WorkerLike } = {}) {
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
      scrollY: () => o.scrollY ?? 0,
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
