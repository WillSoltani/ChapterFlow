import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPack } from "../../scripts/film/pack-lib.mjs";
import { PackNet, type NetClock, type NetEvent, type NetPack } from "./pack-net";

// The worker's network controller with a fake server: real Response and
// ReadableStream objects (Node 20), bodies delivered in chunks on separate
// macrotasks, Range honoured unless the test says otherwise.

const tick = () => new Promise<void>((r) => setImmediate(r));
async function settle(n = 200) {
  for (let i = 0; i < n; i++) await tick();
}

function film(count: number, seed = 0) {
  const frames = Array.from({ length: count }, (_, k) => Uint8Array.from({ length: 60 + ((k * 37 + seed) % 80) }, (_, i) => (k + i + seed) & 255));
  const p = buildPack(frames);
  return { frames, buf: new Uint8Array(p.buf), layout: { bytes: p.bytes, header: p.header, skeletonEnd: p.skeletonEnd, v: p.v } };
}

type ServerOpts = {
  chunk?: number;
  ignoreRange?: boolean;
  status?: (url: string, n: number) => number | "throw" | undefined;
  /** End this many bytes early (a dropped connection). */
  truncate?: (url: string, n: number) => number;
  total?: (url: string) => number;
};

function server(files: Record<string, Uint8Array>, opts: ServerOpts = {}) {
  const log: Array<{ url: string; range: string; status: number }> = [];
  const counts: Record<string, number> = {};
  const fetch = async (url: string, init: { headers: Record<string, string>; signal: AbortSignal }): Promise<Response> => {
    await tick();
    counts[url] = (counts[url] ?? 0) + 1;
    const n = counts[url];
    const forced = opts.status?.(url, n);
    if (forced === "throw") {
      log.push({ url, range: init.headers.Range ?? "", status: 0 });
      throw new TypeError("network down");
    }
    const buf = files[url];
    if (!buf || forced === 404) {
      log.push({ url, range: init.headers.Range ?? "", status: 404 });
      return new Response("missing", { status: 404 });
    }
    if (forced) {
      log.push({ url, range: init.headers.Range ?? "", status: forced });
      return new Response("nope", { status: forced });
    }
    const m = /^bytes=(\d+)-(\d*)$/.exec(init.headers.Range ?? "");
    const ranged = !!m && !opts.ignoreRange;
    const start = ranged ? Number(m![1]) : 0;
    const end = ranged && m![2] ? Number(m![2]) + 1 : buf.length;
    const cut = end - (opts.truncate?.(url, n) ?? 0);
    const chunk = opts.chunk ?? 100;
    let at = start;
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        await tick();
        if (init.signal.aborted) return c.error(new DOMException("aborted", "AbortError"));
        if (at >= cut) return c.close();
        const next = Math.min(cut, at + chunk);
        c.enqueue(buf.slice(at, next));
        at = next;
      },
    });
    const total = opts.total?.(url) ?? buf.length;
    const status = ranged ? 206 : 200;
    log.push({ url, range: init.headers.Range ?? "", status });
    const headers: Record<string, string> = { "content-length": String(end - start) };
    if (ranged) headers["content-range"] = `bytes ${start}-${end - 1}/${total}`;
    return new Response(body, { status, headers });
  };
  return { fetch, log };
}

function fakeClock() {
  let t = 0;
  const timers: Array<{ at: number; fn: () => void; dead: boolean }> = [];
  const clock: NetClock = {
    now: () => t,
    later(fn, ms) {
      const timer = { at: t + ms, fn, dead: false };
      timers.push(timer);
      return () => {
        timer.dead = true;
      };
    },
  };
  return {
    clock,
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const i = timers.findIndex((x) => !x.dead && x.at <= end);
        if (i < 0) break;
        const [timer] = timers.splice(i, 1);
        t = timer!.at;
        timer!.fn();
        await settle(50);
      }
      t = end;
      await settle(50);
    },
  };
}

function setup(films: Array<ReturnType<typeof film>>, opts: ServerOpts = {}, cap = 1e9) {
  const files: Record<string, Uint8Array> = {};
  const packs: NetPack[] = films.map((f, i) => {
    const url = `/films/f${i}/pack.bin?v=${f.layout.v}`;
    files[url] = f.buf;
    return { key: `f${i}`, url, layout: f.layout, count: f.frames.length, film: i };
  });
  const srv = server(files, opts);
  const events: NetEvent[] = [];
  const fc = fakeClock();
  const net = new PackNet({ fetch: srv.fetch, clock: fc.clock, emit: (e) => events.push(e) }, cap);
  net.setPacks(packs);
  const failed = () => events.filter((e): e is Extract<NetEvent, { t: "failed" }> => e.t === "failed");
  const where = (o: Partial<Parameters<PackNet["setWhere"]>[0]> = {}) =>
    net.setWhere({ key: "f0", frame: 0, direction: 1, lo: 0, hi: 30, scrolled: true, hidden: false, constrained: false, ...o });
  return { net, srv, events, failed, where, fc, packs, files };
}

test("a pack is read in chunks of any size: every frame arrives byte-identical, each byte once", async () => {
  const a = film(41);
  const b = film(41, 5);
  const { net, srv, events, where } = setup([a, b], { chunk: 77 });
  where();
  await settle(2000);
  for (let i = 0; i < 41; i++) assert.deepEqual(Buffer.from(net.frame("f0", i)!), Buffer.from(a.frames[i]!), `f0 frame ${i}`);
  for (let i = 0; i < 41; i++) assert.ok(net.frame("f1", i), `f1 frame ${i}`);
  assert.deepEqual(
    srv.log.map((l) => `${l.url.slice(7, 9)} ${l.range} ${l.status}`),
    ["f0 bytes=0- 206", "f1 bytes=0- 206"],
  );
  const s = net.stats;
  assert.equal(s.packRequests, 2);
  assert.equal(s.packBytes, a.layout.bytes + b.layout.bytes);
  assert.equal(s.packBytesRepeated, 0);
  assert.equal(s.packBytesHeld, a.layout.bytes + b.layout.bytes);
  const arrived = events.flatMap((e) => (e.t === "frames" && e.key === "f0" ? e.added : []));
  assert.equal(new Set(arrived).size, 41);
  assert.deepEqual(arrived.slice(0, 11), [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40], "skeleton frames first");
});

test("404: the pack fails at once (the page falls back to frames), no retry", async () => {
  const { srv, failed, where, fc } = setup([film(20)], { status: () => 404 });
  where();
  await settle();
  assert.equal(failed().length, 1);
  assert.match(failed()[0]!.reason, /404/);
  await fc.advance(10_000);
  assert.equal(srv.log.length, 1);
});

test("a network error is retried with a growing backoff, a few times, then the pack fails", async () => {
  const { srv, failed, where, fc } = setup([film(20)], { status: () => "throw" });
  where();
  await settle();
  assert.equal(srv.log.length, 1);
  await fc.advance(399);
  assert.equal(srv.log.length, 1, "no retry before the backoff");
  await fc.advance(1);
  assert.equal(srv.log.length, 2);
  await fc.advance(800);
  assert.equal(srv.log.length, 3);
  await fc.advance(1600);
  assert.equal(srv.log.length, 4);
  assert.equal(failed().length, 1, "after 3 retries the pack fails");
  await fc.advance(60_000);
  assert.equal(srv.log.length, 4, "no error loop");
});

test("a dropped connection resumes at the first byte not held", async () => {
  const a = film(30);
  const { net, srv, failed, where, fc } = setup([a], { truncate: (_, n) => (n === 1 ? 900 : 0) });
  where();
  await settle(2000);
  await fc.advance(400);
  await settle(2000);
  assert.equal(failed().length, 0);
  for (let i = 0; i < 30; i++) assert.ok(net.frame("f0", i));
  const m = /bytes=(\d+)-/.exec(srv.log[1]?.range ?? "");
  assert.equal(Number(m?.[1]), a.layout.bytes - 900, "resumed where the first response stopped");
  assert.equal(net.stats.packBytesRepeated, 0);
});

test("a response whose length disagrees with the timeline makes the pack unusable", async () => {
  const { failed, where } = setup([film(20)], { total: () => 12345 });
  where();
  await settle();
  assert.equal(failed().length, 1);
  assert.match(failed()[0]!.reason, /12345/);
});

test("a header that disagrees with the timeline makes the pack unusable", async () => {
  const a = film(20);
  const t = setup([a]);
  // Same length, but the header's skeleton end is not the timeline's.
  const bad = a.buf.slice();
  new DataView(bad.buffer).setUint32(16, a.layout.skeletonEnd + 1, true);
  t.files[t.packs[0]!.url] = bad;
  t.where();
  await settle(1000);
  assert.equal(t.failed().length, 1, "unusable");
  assert.match(t.failed()[0]!.reason, /skeleton/);
});

test("a server that ignores Range: the 200 body is read from byte 0, held bytes discarded and counted", async () => {
  const a = film(60);
  const { net, srv, where } = setup([a], { ignoreRange: true });
  where({ scrolled: false });
  await settle(3000);
  const heldBefore = net.stats.packBytesHeld;
  assert.ok(heldBefore > 0 && heldBefore < a.layout.bytes, "stopped after the opening window");
  where({ scrolled: true, frame: 1 });
  await settle(3000);
  for (let i = 0; i < 60; i++) assert.ok(net.frame("f0", i));
  assert.equal(srv.log.length, 2);
  assert.equal(net.stats.packBytesRepeated, heldBefore, "the held prefix came again and was discarded");
});

test("before the first scroll one request, stopped after the opening window; the first scroll continues it", async () => {
  const a = film(120);
  const b = film(120, 3);
  const { net, srv, where } = setup([a, b], { chunk: 64 });
  where({ scrolled: false });
  await settle(3000);
  assert.equal(srv.log.length, 1);
  for (let i = 0; i <= 47; i++) assert.ok(net.frame("f0", i), `opening frame ${i}`);
  assert.ok(!net.frame("f0", 49), "stopped");
  assert.ok(net.stats.packBytes < a.layout.bytes);
  where({ scrolled: true, frame: 2 });
  await settle(5000);
  assert.equal(srv.log.length, 3, "the continuation and the next film");
  const cont = /bytes=(\d+)-/.exec(srv.log.slice(1).find((l) => l.url.includes("/f0/"))!.range);
  assert.ok(Number(cont?.[1]) > a.layout.skeletonEnd, "continues after what is held");
  assert.equal(net.stats.packBytesRepeated, 0);
});

test("the byte cap drops the variant farthest from the active film first, never the active film or the neighbour", async () => {
  const films = [film(40), film(40, 1), film(40, 2), film(40, 3)];
  const size = films[0]!.layout.bytes;
  const { net, events, where } = setup(films, {}, Math.floor(size * 3.5));
  where({ key: "f0" });
  await settle(2000);
  where({ key: "f1", frame: 5 });
  await settle(2000);
  where({ key: "f2", frame: 5 });
  await settle(2000);
  // f0, f1, f2 were complete; reading f3 (neighbour of f2) passes the cap.
  assert.ok(net.stats.packBytesHeld <= Math.floor(size * 3.5));
  const removed = events.flatMap((e) => (e.t === "frames" ? e.removed.map((i) => `${e.key}#${i}`) : []));
  assert.ok(removed.length > 0, "something was dropped");
  assert.ok(removed.every((r) => r.startsWith("f0#")), `only the farthest film lost bytes: ${removed.slice(0, 5).join(",")}`);
  for (let i = 0; i < 40; i++) assert.ok(net.frame("f2", i) && net.frame("f3", i), "active and neighbour intact");
});

test("hidden document: no stream opens until it is shown", async () => {
  const { srv, where } = setup([film(20)]);
  where({ hidden: true });
  await settle();
  assert.equal(srv.log.length, 0);
  where({ hidden: false });
  await settle();
  assert.equal(srv.log.length, 1);
});
