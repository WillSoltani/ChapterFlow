import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPack } from "../../scripts/film/pack-lib.mjs";
import { BEHIND_FRAMES, OPENING_LAST_FRAME, planPacks, type PlanInput, type PlanOutput } from "./pack-plan";
import { PackBytes } from "./pack-store";

// Scenario tests: the planner drives a simulated network. Each open stream
// delivers `rate` bytes per step (a Range response, or the whole file from
// byte 0 for a server that ignores Range), and the plan is re-run after every
// delivery, as the worker's controller does after every chunk.

type SimPack = { key: string; count: number; buf: Uint8Array; store: PackBytes; rangeless: boolean; serverIgnoresRange: boolean; order: number[] };
type SimStream = { id: number; key: string; pos: number; end: number };

function makePack(key: string, count: number): SimPack {
  const frames = Array.from({ length: count }, (_, k) => Uint8Array.from({ length: 60 + ((k * 37) % 80) }, (_, i) => (k + i) & 255));
  const p = buildPack(frames);
  const layout = { bytes: p.bytes, header: p.header, skeletonEnd: p.skeletonEnd, openingEnd: p.openingEnd, v: p.v };
  return { key, count, buf: new Uint8Array(p.buf), store: new PackBytes(key, layout, count), rangeless: false, serverIgnoresRange: false, order: [] };
}

class Sim {
  packs: SimPack[];
  streams: SimStream[] = [];
  requests: Array<{ key: string; start: number; end: number; step: string }> = [];
  maxOpen = 0;
  private nextId = 1;
  where: Omit<PlanInput, "packs" | "streams" | "maxStreams"> = {
    active: 0,
    frame: 0,
    direction: 1,
    lo: 0,
    hi: 40,
    scrolled: true,
    constrained: false,
    settled: false,
    jumped: false,
    hidden: false,
  };

  constructor(counts: number[]) {
    this.packs = counts.map((n, i) => makePack(`f${i}`, n));
  }

  pack(i: number) {
    return this.packs[i]!;
  }

  plan(): PlanOutput {
    const out = planPacks({
      ...this.where,
      packs: this.packs.map((p) => ({ key: p.key, count: p.count, layout: p.store.layout, bytes: p.store, rangeless: p.rangeless, blocked: false })),
      streams: this.streams.map((s) => ({ ...s })),
      maxStreams: 2,
    });
    this.streams = this.streams.filter((s) => out.keep.includes(s.id));
    for (const it of out.open) {
      const p = this.packs.find((q) => q.key === it.key)!;
      this.requests.push({ key: it.key, start: it.start, end: it.end, step: it.step });
      // A server that ignores Range answers 200 with the whole file.
      if (p.serverIgnoresRange) {
        p.rangeless = true;
        this.streams.push({ id: this.nextId++, key: it.key, pos: 0, end: p.store.layout.bytes });
      } else this.streams.push({ id: this.nextId++, key: it.key, pos: it.start, end: it.end });
    }
    this.maxOpen = Math.max(this.maxOpen, this.streams.length);
    return out;
  }

  /** One step: every open stream delivers up to `rate` bytes, then re-plan. */
  step(rate: number) {
    for (const s of [...this.streams]) {
      const p = this.packs.find((q) => q.key === s.key)!;
      const n = Math.min(rate, s.end - s.pos);
      const r = p.store.write(s.pos, p.buf.subarray(s.pos, s.pos + n));
      assert.equal(r.error, undefined);
      p.order.push(...r.completed);
      s.pos += n;
      if (s.pos >= s.end) this.streams = this.streams.filter((x) => x !== s);
    }
    this.plan();
  }

  requestsFor(key: string) {
    return this.requests.filter((r) => r.key === key);
  }

  slot(i: number, frame: number) {
    const h = this.pack(i).store.header!;
    return h.slots[h.slotOf[frame]!]!;
  }

  assertNoRepeats() {
    for (const p of this.packs) {
      if (!p.serverIgnoresRange) assert.equal(p.store.repeatedBytes, 0, `${p.key}: bytes read twice`);
      assert.equal(p.store.gapBytes, 0, `${p.key}: bytes dropped as a gap`);
    }
  }
}

const isSkeleton = (f: number) => f % 4 === 0;

test("steady forward pass over two films: skeleton first, one request per film, nothing twice", () => {
  const sim = new Sim([241, 241, 241]);
  sim.plan();
  assert.deepEqual(
    sim.requests.map((r) => `${r.key}:${r.step}:${r.start}`),
    ["f0:skeleton:0", "f1:neighbour-skeleton:0"],
    "the active skeleton and the neighbour's start together",
  );
  for (const film of [0, 1]) {
    for (let f = 0; f < 241; f++) {
      sim.where = { ...sim.where, active: film, frame: f, lo: f, hi: f + 30 };
      sim.step(400);
      if (film === 0) assert.equal(sim.requestsFor("f2").length, 0, "nothing for a film two away");
    }
  }
  while (sim.streams.length) sim.step(400);
  assert.equal(sim.requestsFor("f0").length, 1, "film 0: one request (skeleton then the rest)");
  assert.equal(sim.requestsFor("f1").length, 1, "film 1: one request");
  assert.equal(sim.requestsFor("f2").length, 1, "film 2 starts once film 1 is active");
  assert.ok(sim.maxOpen <= 2);
  // Coarse first: every skeleton frame of film 0 completed before its first other frame.
  const order = sim.pack(0).order;
  const firstRest = order.findIndex((f) => !isSkeleton(f));
  assert.ok(order.slice(0, firstRest).every(isSkeleton) && order.slice(firstRest).every((f) => !isSkeleton(f)));
  assert.equal(order.length, 241);
  sim.assertNoRepeats();
});

test("a network slower than the playhead: no re-aim while moving forward; a stop re-aims, then the skipped frames are filled", () => {
  const sim = new Sim([241, 241]);
  sim.plan();
  // ~12 KB in 200 steps: the skeleton (~8.9 KB) and a few remaining frames.
  for (let f = 0; f <= 200; f++) {
    sim.where = { ...sim.where, frame: f, lo: f, hi: f + 30 };
    sim.step(60);
  }
  assert.equal(sim.requestsFor("f0").length, 1, "moving forward: the stream keeps reading in order");
  assert.ok(sim.pack(0).store.firstMissing(0, sim.pack(0).store.layout.skeletonEnd) < 0, "skeleton complete");
  assert.ok(!sim.pack(0).store.held(201));
  // The visitor stops at 201: the stream is reopened at the playhead.
  sim.where = { ...sim.where, frame: 201, settled: true };
  sim.plan();
  const reaim = sim.requestsFor("f0")[1];
  assert.equal(reaim?.start, sim.slot(0, 201).offset, "reopened at the first missing frame at the playhead");
  for (let i = 0; i < 2000 && (sim.streams.length || !sim.pack(0).store.held(1)); i++) sim.step(40);
  for (let f = 0; f < 241; f++) assert.ok(sim.pack(0).store.held(f), `frame ${f} held`);
  const fill = sim.requestsFor("f0")[2];
  assert.ok(fill && fill.start < sim.slot(0, 201).offset && fill.end <= sim.slot(0, 201).offset, "the skipped frames, bounded before the held ones");
  sim.assertNoRepeats();
});

test("entering a film backwards: skeleton, then the frames just below the playhead; a stream elsewhere is re-aimed", () => {
  const sim = new Sim([241, 241]);
  sim.where = { ...sim.where, active: 1, frame: 240, direction: -1, lo: 200, hi: 240 };
  sim.plan();
  const sk = sim.requestsFor("f1")[0];
  assert.equal(sk?.step, "skeleton");
  assert.equal(sk?.end, sim.pack(1).store.layout.skeletonEnd, "bounded: the rest of the file is not where the visitor is");
  while (!sim.pack(1).store.held(240)) sim.step(300);
  const rest = sim.requestsFor("f1")[1];
  assert.equal(rest?.start, sim.slot(1, 239 - BEHIND_FRAMES).offset, "a run ending at the playhead, BEHIND_FRAMES below it");
  // Film 0 is the neighbour when scrolling up: its end is read first.
  const n = sim.requestsFor("f0").map((r) => r.step);
  assert.deepEqual(n.slice(0, 1), ["neighbour-skeleton"]);
  sim.assertNoRepeats();

  // Same film, but its stream was reading from frame 1 (it was the next film
  // while the visitor came down): scrolling up into its end re-aims it.
  const b = new Sim([241, 241]);
  b.plan();
  for (let i = 0; i < 400 && !b.pack(1).store.held(9); i++) b.step(60);
  const s = b.streams.find((x) => x.key === "f1");
  assert.ok(s, "film 1's stream is open");
  b.where = { ...b.where, active: 1, frame: 240, direction: -1 };
  b.plan();
  assert.ok(!b.streams.some((x) => x.id === s.id), "the stream at the film's start is stopped");
  const again = b.requestsFor("f1").at(-1);
  assert.equal(again?.start, b.slot(1, 239 - BEHIND_FRAMES).offset);
  b.assertNoRepeats();
});

test("a jump into the middle of a film: its skeleton, then from the playhead, then what was skipped", () => {
  const sim = new Sim([241, 241, 241, 241]);
  sim.where = { ...sim.where, active: 3, frame: 150, jumped: true, lo: 150, hi: 180 };
  sim.plan();
  assert.deepEqual(
    sim.requests.map((r) => `${r.key}:${r.step}`),
    ["f3:skeleton"],
  );
  assert.equal(sim.requests[0]?.end, sim.pack(3).store.layout.skeletonEnd, "skeleton bounded: the playhead is not at the film's start");
  sim.where = { ...sim.where, jumped: false };
  while (sim.streams.length) sim.step(500);
  const r = sim.requestsFor("f3");
  assert.equal(r[1]?.start, sim.slot(3, 150).offset, "then from the playhead");
  assert.equal(r[2]?.start, sim.slot(3, 1).offset, "then the skipped frames");
  assert.equal(r[2]?.end, sim.slot(3, 150).offset, "bounded before the held ones");
  assert.equal(r.length, 3);
  for (let f = 0; f < 241; f++) assert.ok(sim.pack(3).store.held(f));
  sim.assertNoRepeats();

  // A stream already reading the film near its start is re-aimed by the jump.
  const b = new Sim([241, 241]);
  b.plan();
  for (let i = 0; i < 400 && !b.pack(1).store.held(5); i++) b.step(60);
  b.where = { ...b.where, active: 1, frame: 150, jumped: true };
  b.plan();
  assert.equal(b.requestsFor("f1").at(-1)?.start, b.slot(1, 150).offset);
  b.assertNoRepeats();
});

test("before the first scroll: only the first film, stopped after the opening window; it continues on the first scroll", () => {
  const sim = new Sim([241, 241]);
  sim.where = { ...sim.where, scrolled: false };
  sim.plan();
  const openingEnd = sim.pack(0).store.layout.openingEnd!;
  assert.deepEqual(
    sim.requests.map((r) => `${r.key}:${r.step}:${r.start}:${r.end}`),
    [`f0:opening:0:${openingEnd}`],
    "one request, bounded at the window's end (known from the timeline)",
  );
  for (let i = 0; i < 1000 && sim.streams.length; i++) sim.step(97);
  assert.equal(sim.streams.length, 0, "stopped");
  const st = sim.pack(0).store;
  for (let f = 0; f <= OPENING_LAST_FRAME; f++) assert.ok(st.held(f), `frame ${f} held`);
  const windowEnd = sim.slot(0, OPENING_LAST_FRAME).offset + sim.slot(0, OPENING_LAST_FRAME).length;
  assert.equal(windowEnd, openingEnd);
  assert.equal(st.heldBytes, windowEnd, "not a byte past the window");
  assert.equal(sim.requests.length, 1, "nothing else");
  // First scroll.
  sim.where = { ...sim.where, scrolled: true, frame: 1 };
  sim.plan();
  const cont = sim.requestsFor("f0")[1];
  assert.equal(cont?.start, st.firstMissing(0, st.layout.bytes), "continues at the first byte not held");
  assert.equal(sim.requestsFor("f1")[0]?.step, "neighbour-skeleton");
  sim.assertNoRepeats();
});

test("constrained connection: skeletons only while moving, then the window around the playhead in one request", () => {
  const sim = new Sim([241, 241]);
  sim.where = { ...sim.where, constrained: true, frame: 100, lo: 90, hi: 130 };
  sim.plan();
  for (let i = 0; i < 400 && sim.streams.length; i++) sim.step(300);
  for (const r of sim.requests) assert.equal(r.end, sim.pack(Number(r.key.slice(1))).store.layout.skeletonEnd, "bounded at the skeleton");
  assert.equal(sim.requests.length, 2);
  assert.ok(!sim.pack(0).store.held(101), "no remaining frame while moving");
  sim.where = { ...sim.where, settled: true };
  sim.plan();
  const w = sim.requestsFor("f0")[1];
  assert.equal(w?.step, "window");
  assert.equal(w?.start, sim.slot(0, 90).offset);
  assert.equal(w?.end, sim.slot(0, 130).offset + sim.slot(0, 130).length);
  for (let i = 0; i < 400 && sim.streams.length; i++) sim.step(300);
  for (let f = 90; f <= 130; f++) assert.ok(sim.pack(0).store.held(f), `frame ${f}`);
  assert.equal(sim.requests.length, 3, "one request for the window, nothing after it");
  sim.assertNoRepeats();
});

test("eviction followed by a return: only the dropped bytes are read again", () => {
  const sim = new Sim([241, 241]);
  sim.plan();
  for (let i = 0; i < 2000 && sim.streams.length; i++) sim.step(500);
  sim.where = { ...sim.where, active: 1, frame: 120 };
  sim.plan();
  for (let i = 0; i < 2000 && sim.streams.length; i++) sim.step(500);
  const st = sim.pack(0).store;
  assert.equal(st.heldBytes, st.layout.bytes);
  // The byte cap dropped film 0's frames 100..200 (skeleton included).
  let dropped = 0;
  for (let f = 100; f <= 200; f++) dropped += st.dropFrame(f);
  const before = sim.requests.length;
  // The visitor scrolls back up into film 0.
  sim.where = { ...sim.where, active: 0, frame: 240, direction: -1 };
  sim.plan();
  for (let i = 0; i < 2000 && sim.streams.length; i++) sim.step(500);
  for (let f = 0; f < 241; f++) assert.ok(st.held(f), `frame ${f} back`);
  const again = sim.requests.slice(before).filter((r) => r.key === "f0");
  const read = again.reduce((n, r) => n + (r.end - r.start), 0);
  assert.equal(read, dropped, "exactly the dropped bytes");
  sim.assertNoRepeats();
});

test("a server that ignores Range (200 from byte 0): held bytes discarded, one whole-file stream, no second request", () => {
  const sim = new Sim([241, 241]);
  sim.where = { ...sim.where, scrolled: false };
  sim.plan();
  for (let i = 0; i < 1000 && sim.streams.length; i++) sim.step(97);
  const st = sim.pack(0).store;
  const held = st.heldBytes;
  sim.pack(0).serverIgnoresRange = true;
  sim.where = { ...sim.where, scrolled: true, frame: 1 };
  sim.plan();
  for (let i = 0; i < 2000 && sim.streams.some((s) => s.key === "f0"); i++) sim.step(200);
  assert.equal(st.repeatedBytes, held, "the bytes already held came again and were discarded");
  assert.equal(st.heldBytes, st.layout.bytes);
  assert.equal(sim.requestsFor("f0").length, 2, "the pre-scroll request and one whole-file stream");
  for (let f = 0; f < 241; f++) assert.ok(st.held(f));
});

test("hidden document: streams already open go on, no new one opens", () => {
  const sim = new Sim([241, 241]);
  sim.where = { ...sim.where, hidden: true };
  sim.plan();
  assert.equal(sim.requests.length, 0);
  sim.where = { ...sim.where, hidden: false };
  sim.plan();
  assert.equal(sim.requests.length, 2);
  sim.where = { ...sim.where, hidden: true };
  for (let i = 0; i < 2000 && sim.streams.length; i++) sim.step(500);
  assert.equal(sim.requests.length, 2, "the open streams finished; nothing new while hidden");
});

// ---- Regressions (review of Phase 4) ----

/** Hold a pack's header and skeleton, as if its skeleton stream had finished. */
function holdSkeleton(p: SimPack) {
  const end = p.store.layout.skeletonEnd;
  assert.equal(p.store.write(0, p.buf.subarray(0, end)).error, undefined);
}

test("constrained, settled: the window's missing frames are read even when the window ends on a skeleton frame", () => {
  for (const hi of [128, 130, 132, 240]) {
    const sim = new Sim([241, 241]);
    holdSkeleton(sim.pack(0));
    holdSkeleton(sim.pack(1));
    const lo = hi - 40;
    sim.where = { ...sim.where, constrained: true, settled: true, frame: hi - 10, lo, hi };
    sim.plan();
    const w = sim.requestsFor("f0");
    assert.equal(w.length, 1, `hi=${hi}: one window request`);
    assert.equal(w[0]?.step, "window", `hi=${hi}`);
    const lastRest = hi % 4 === 0 ? hi - 1 : hi;
    assert.equal(w[0]?.end, sim.slot(0, lastRest).offset + sim.slot(0, lastRest).length, `hi=${hi}: bounded after the window's last remaining frame`);
    for (let i = 0; i < 400 && sim.streams.length; i++) sim.step(300);
    for (let f = lo; f <= hi; f++) assert.ok(sim.pack(0).store.held(f), `hi=${hi}: frame ${f}`);
    assert.equal(sim.requestsFor("f0").length, 1, `hi=${hi}: nothing after the window`);
    sim.assertNoRepeats();
  }
});

test("scrolling up through frames that have not arrived: no request per frame", () => {
  const sim = new Sim([241, 241]);
  holdSkeleton(sim.pack(0));
  holdSkeleton(sim.pack(1));
  // The network is ~4x slower than the playhead (24 bytes a step, frames ~100 bytes).
  for (let f = 240; f >= 100; f--) {
    sim.where = { ...sim.where, active: 1, frame: f, direction: -1, lo: Math.max(0, f - 30), hi: f };
    sim.step(24);
  }
  const reqs = sim.requestsFor("f1");
  assert.ok(reqs.length <= Math.ceil(140 / BEHIND_FRAMES) + 2, `${reqs.length} requests for 140 frames scrolled up`);
  // Every request reads a useful run, not a frame or two.
  for (const r of reqs.slice(0, -1)) assert.ok(r.end - r.start > 1000, `a ${r.end - r.start}-byte request`);
  sim.assertNoRepeats();
});

test("the dissolve pin: the previous film's last frame is read when it is not held", () => {
  // An anchor lands at the start of film 1: film 0 was never read.
  const sim = new Sim([279, 241, 241]);
  sim.where = { ...sim.where, active: 1, frame: 0, jumped: true, lo: 0, hi: 30, pin: { pack: 0, frame: 278 } };
  sim.plan();
  assert.deepEqual(
    sim.requests.map((r) => `${r.key}:${r.step}`),
    ["f1:skeleton", "f0:pin"],
    "the active skeleton, then the pin (its header first: film 0 was never read)",
  );
  for (let i = 0; i < 400 && !sim.pack(0).store.held(278); i++) sim.step(200);
  assert.ok(sim.pack(0).store.held(278), "the pin arrived");
  const f0 = sim.requestsFor("f0");
  assert.equal(f0.length, 2, "the header, then the pin's slot");
  assert.equal(f0[0]?.end, sim.pack(0).store.layout.header);
  assert.equal(f0[1]?.start, sim.slot(0, 278).offset);
  assert.equal(f0[1]?.end, sim.slot(0, 278).offset + sim.slot(0, 278).length);
  assert.ok(sim.requestsFor("f2").length >= 1, "the neighbour follows");
  // Held: nothing more for film 0.
  for (let i = 0; i < 50; i++) sim.step(200);
  assert.equal(sim.requestsFor("f0").length, 2);
  sim.assertNoRepeats();

  // A forward pass: film 0's stream is a few frames short of its last frame
  // when the visitor enters film 1; it is left to reach the pin.
  const b = new Sim([279, 241, 241]);
  holdSkeleton(b.pack(0));
  const st = b.pack(0).store;
  assert.equal(st.write(st.layout.skeletonEnd, b.pack(0).buf.subarray(st.layout.skeletonEnd, b.slot(0, 270).offset)).error, undefined);
  b.where = { ...b.where, active: 0, frame: 270 };
  b.plan();
  assert.equal(b.requestsFor("f0").at(-1)?.start, b.slot(0, 270).offset);
  b.where = { ...b.where, frame: 276 };
  b.plan();
  b.where = { ...b.where, active: 1, frame: 0, pin: { pack: 0, frame: 278 } };
  b.plan();
  assert.equal(b.requestsFor("f0").length, 1, "the stream reaching the pin goes on");
  for (let i = 0; i < 400 && !st.held(278); i++) b.step(100);
  assert.ok(st.held(278));
  b.assertNoRepeats();

  // Scrolling up, the pin's film is the neighbour: its plan reaches the pin, no extra request.
  const c = new Sim([279, 241, 241]);
  holdSkeleton(c.pack(0));
  holdSkeleton(c.pack(1));
  c.where = { ...c.where, active: 1, frame: 200, direction: -1, pin: { pack: 0, frame: 278 } };
  c.plan();
  assert.ok(!c.requests.some((r) => r.step === "pin"));
  assert.ok(c.requestsFor("f0").some((r) => r.start <= c.slot(0, 278).offset && r.end >= c.slot(0, 278).offset + c.slot(0, 278).length));
});

test("no active film (its key is not in the reel): nothing is read", () => {
  const sim = new Sim([241, 241, 241]);
  sim.where = { ...sim.where, active: -1 };
  const out = sim.plan();
  assert.deepEqual(out.open, []);
  assert.deepEqual(out.items, []);
});
