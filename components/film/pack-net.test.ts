import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPack } from "../../scripts/film/pack-lib.mjs";
import { parsePackHeader } from "./pack-format";
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

test("re-aim: steady forward motion keeps the stream; a jump reopens it at the playhead", async () => {
  const a = film(241);
  const b = film(241, 2);
  const h = parsePackHeader(a.buf.subarray(0, a.layout.header));
  assert.ok(h && !("error" in h));
  const slotStart = (f: number) => h.slots[h.slotOf[f]!]!.offset;
  // A slow network: 12 bytes per chunk, one chunk per macrotask per stream.
  const t = setup([a, b], { chunk: 12 });
  t.where({ frame: 0 });
  await settle(1200);
  const f0 = () => t.srv.log.filter((l) => l.url.includes("/f0/"));
  assert.ok(t.net.frame("f0", 240), "skeleton complete");
  assert.ok(!t.net.frame("f0", 201), "frame 201 not there yet");
  // Steady forward motion faster than the stream: no new request.
  for (let f = 1; f <= 60; f++) {
    t.where({ frame: f });
    await settle(3);
  }
  assert.equal(f0().length, 1, "no re-aim while moving forward");
  // A jump (anchor, flick) to frame 200: reopened at the first missing frame
  // at the playhead (200 is a skeleton frame, held; 201 is the first missing).
  t.where({ frame: 200 });
  await settle(5);
  assert.equal(f0().length, 2, "one new request after the jump");
  assert.equal(f0()[1]!.range, `bytes=${slotStart(201)}-`);
  assert.equal(t.net.stats.packReaims, 1);
  await settle(400);
  assert.ok(t.net.frame("f0", 201), "the frames at the playhead arrive");
  assert.equal(t.net.stats.packBytesRepeated, 0);
});

test("re-aim on a stop: once the visitor has been still for 300 ms", async () => {
  const a = film(241);
  const h = parsePackHeader(a.buf.subarray(0, a.layout.header));
  assert.ok(h && !("error" in h));
  const t = setup([a], { chunk: 12 });
  t.where({ frame: 0 });
  await settle(1200);
  // Moving forward in small steps up to 150, then still.
  for (let f = 1; f <= 150; f += 5) {
    t.where({ frame: f });
    await settle(2);
  }
  const before = t.srv.log.length;
  await t.fc.advance(299);
  assert.equal(t.srv.log.length, before, "not before 300 ms");
  await t.fc.advance(1);
  assert.equal(t.srv.log.length, before + 1, "re-aimed once settled");
  assert.equal(t.srv.log.at(-1)!.range, `bytes=${h.slots[h.slotOf[146]!]!.offset}-`);
});

test("a small bounce does not swap the neighbour; a real reversal does", async () => {
  const films = [film(120), film(120, 1), film(120, 2)];
  const t = setup(films, { chunk: 30 });
  t.where({ key: "f1", frame: 60 });
  await settle(50);
  const requested = () => new Set(t.srv.log.map((l) => l.url.slice(7, 9)));
  assert.ok(requested().has("f2") && !requested().has("f0"), "scrolling down: the next film");
  // Bounce up 3 frames: still the next film.
  t.where({ key: "f1", frame: 57, direction: -1 });
  await settle(50);
  assert.ok(!requested().has("f0"));
  // Keep going up past the hysteresis: the previous film becomes the neighbour.
  t.where({ key: "f1", frame: 45, direction: -1 });
  await settle(50);
  assert.ok(requested().has("f0"), "scrolling up: the previous film");
});

// ---- Regressions (review of Phase 4) ----

test("a playhead bouncing across a film cut does not swap the films being read", async () => {
  const films = [film(241), film(241, 1), film(241, 2), film(241, 3)];
  const t = setup(films, { chunk: 30 });
  for (let f = 200; f <= 240; f += 4) {
    t.where({ key: "f1", frame: f });
    await settle(3);
  }
  t.where({ key: "f2", frame: 0 });
  await settle(3);
  const before = t.srv.log.length;
  for (let i = 0; i < 20; i++) {
    t.where({ key: "f1", frame: 240, direction: -1 });
    await settle(3);
    t.where({ key: "f2", frame: 0, direction: 1 });
    await settle(3);
  }
  const during = t.srv.log.slice(before);
  assert.ok(during.length <= 2, `${during.length} requests while bouncing: ${during.map((l) => `${l.url.slice(7, 9)} ${l.range}`).join(", ")}`);
  assert.ok(!during.some((l) => l.url.includes("/f0/")), "the film behind is not read");
  // Travelling on into film 2 makes it the active film: film 3 is read.
  for (let f = 1; f <= 20; f++) {
    t.where({ key: "f2", frame: f });
    await settle(3);
  }
  assert.ok(t.srv.log.some((l) => l.url.includes("/f3/")), "the next film once the visitor is in film 2");
  assert.equal(t.net.stats.packBytesRepeated, 0);
});

test("a failed pack stays in the reel: the visitor on that film prepares the next film, not the first", async () => {
  const films = [film(40), film(40, 1), film(40, 2), film(40, 3), film(40, 4)];
  const t = setup(films, { chunk: 50 });
  // The page re-sends the reel (another view, a new worker) with film 3's pack failed.
  t.net.setPacks(t.packs.map((p, i) => (i === 3 ? { ...p, failed: true } : p)));
  t.where({ key: "f3", frame: 5, direction: 1 });
  await settle(400);
  const read = new Set(t.srv.log.map((l) => l.url.slice(7, 9)));
  assert.ok(!read.has("f0"), `film 0 was read: ${[...read].join(",")}`);
  assert.ok(!read.has("f3"), "the failed pack is not read again");
  assert.ok(read.has("f4"), "the next film is prepared");
});

test("frames that will not decode from held bytes make the pack unusable (fall back), not a retry loop", async () => {
  const t = setup([film(20)]);
  t.where();
  await settle(400);
  assert.ok(t.net.frame("f0", 3));
  t.net.decodeFailed("f0");
  t.net.decodeFailed("f0");
  assert.equal(t.failed().length, 0, "two failures: still served");
  t.net.decodeFailed("f0");
  assert.equal(t.failed().length, 1, "the third failure: the pack is unusable");
  assert.match(t.failed()[0]!.reason, /decode/);
  assert.equal(t.net.frame("f0", 3), null, "its bytes are dropped");
  const n = t.srv.log.length;
  t.net.decodeFailed("f0");
  await t.fc.advance(10_000);
  assert.equal(t.failed().length, 1);
  assert.equal(t.srv.log.length, n, "nothing read again");
});

test("the dissolve pin: the previous film's last frame is read, and kept under the byte cap", async () => {
  const a = film(279);
  const b = film(241, 1);
  const c = film(241, 2);
  const t = setup([a, b, c], { chunk: 400 });
  // An anchor at the start of film 1: film 0 was never read.
  t.where({ key: "f1", frame: 0, pin: { key: "f0", frame: 278 } });
  await settle(600);
  assert.ok(t.net.frame("f0", 278), "the pin arrived");
  const f0 = t.srv.log.filter((l) => l.url.includes("/f0/"));
  assert.equal(f0.length, 2, "its header, then its slot");
  assert.equal(f0[0]!.range, `bytes=0-${a.layout.header - 1}`);
  assert.ok(!t.net.frame("f0", 100), "nothing else of film 0");

  // Under the byte cap the pin's frame is the last of its film to go.
  const films = [film(40), film(40, 1), film(40, 2), film(40, 3)];
  const size = films[0]!.layout.bytes;
  const u = setup(films, {}, Math.floor(size * 2.5));
  u.where({ key: "f0" });
  await settle(2000);
  u.where({ key: "f1", frame: 5 });
  await settle(2000);
  u.where({ key: "f2", frame: 5, pin: { key: "f1", frame: 39 } });
  await settle(2000);
  assert.ok(u.net.stats.packBytesHeld <= Math.floor(size * 2.5) + 200);
  assert.ok(u.net.frame("f1", 39), "the pin survived");
});

test("scrolling up through a film faster than the network: a few requests, not one per frame", async () => {
  const films = [film(241), film(241, 1), film(241, 2)];
  const t = setup(films, { chunk: 24 });
  // Coming up from film 2 into film 1's last frame; the skeletons arrive first.
  t.where({ key: "f1", frame: 240, direction: -1 });
  for (let i = 0; i < 400 && !(t.net.frame("f1", 0) && t.net.frame("f1", 236)); i++) await settle(5);
  assert.ok(t.net.frame("f1", 0) && t.net.frame("f1", 236), "film 1's skeleton");
  const before = t.srv.log.filter((l) => l.url.includes("/f1/")).length;
  for (let f = 239; f >= 100; f--) {
    t.where({ key: "f1", frame: f, direction: -1 });
    await settle(2);
  }
  const f1 = t.srv.log.filter((l) => l.url.includes("/f1/")).slice(before);
  assert.ok(f1.length <= 4, `${f1.length} requests for 140 frames: ${f1.map((l) => l.range).join(", ")}`);
  assert.equal(t.net.stats.packBytesRepeated, 0);
});
