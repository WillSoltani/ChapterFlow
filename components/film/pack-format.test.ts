import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPack } from "../../scripts/film/pack-lib.mjs";
import { PACK_FIXED_BYTES, parsePackHeader, packLayoutProblem } from "./pack-format";
import { PackBytes } from "./pack-store";

/** Frames with distinct sizes and contents (byte i of frame k = (k * 31 + i) & 255). */
function frames(n: number, size = (k: number) => 40 + ((k * 37) % 90)): Uint8Array[] {
  return Array.from({ length: n }, (_, k) => Uint8Array.from({ length: size(k) }, (_, i) => (k * 31 + i) & 255));
}

function pack(n: number, size?: (k: number) => number) {
  const f = frames(n, size);
  const p = buildPack(f);
  const layout = { bytes: p.bytes, header: p.header, skeletonEnd: p.skeletonEnd, v: p.v };
  return { f, buf: new Uint8Array(p.buf.buffer, p.buf.byteOffset, p.buf.byteLength), layout };
}

/** Deterministic PRNG so a failure reproduces. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Feed `buf[from, to)` to the store in chunks ending at the given cut points. */
function feed(store: PackBytes, buf: Uint8Array, cuts: number[], from = 0, to = buf.length) {
  const done: number[] = [];
  let at = from;
  for (const c of [...cuts.filter((c) => c > from && c < to).sort((a, b) => a - b), to]) {
    if (c <= at) continue;
    const r = store.write(at, buf.subarray(at, c));
    assert.equal(r.error, undefined, r.error);
    done.push(...r.completed);
    at = c;
  }
  return done;
}

function assertAllFrames(store: PackBytes, f: Uint8Array[]) {
  for (let i = 0; i < f.length; i++) {
    const got = store.frame(i);
    assert.ok(got, `frame ${i} complete`);
    assert.deepEqual(Buffer.from(got), Buffer.from(f[i]!), `frame ${i} bytes`);
  }
}

test("parsePackHeader reads what pack-lib.mjs writes, in file order", () => {
  const { buf, layout } = pack(10);
  assert.equal(parsePackHeader(buf.subarray(0, PACK_FIXED_BYTES - 1)), null, "too short: not yet");
  assert.equal(parsePackHeader(buf.subarray(0, layout.header - 1)), null, "table incomplete: not yet");
  const h = parsePackHeader(buf.subarray(0, layout.header));
  assert.ok(h && !("error" in h));
  assert.equal(h.count, 10);
  assert.equal(h.header, layout.header);
  assert.equal(h.skeletonEnd, layout.skeletonEnd);
  assert.equal(h.bytes, layout.bytes);
  assert.deepEqual(
    h.slots.map((s) => s.index),
    [0, 4, 8, 1, 2, 3, 5, 6, 7, 9],
  );
  assert.equal(h.slotOf[4], 1);
  assert.equal(packLayoutProblem(h, layout, 10), null);
  assert.match(packLayoutProblem(h, { ...layout, bytes: layout.bytes + 1 }, 10) ?? "", /bytes/);
  assert.match(packLayoutProblem(h, layout, 11) ?? "", /frames/);
  const bad = buf.slice(0, layout.header);
  bad[0] = 0x58;
  const e = parsePackHeader(bad);
  assert.ok(e && "error" in e && /magic/.test(e.error));
});

test("the cutter rebuilds every frame from the pack split one byte at a time", () => {
  const { f, buf, layout } = pack(9);
  const store = new PackBytes("p", layout, 9);
  const cuts = Array.from({ length: buf.length }, (_, i) => i);
  const done = feed(store, buf, cuts);
  assert.equal(new Set(done).size, 9);
  assertAllFrames(store, f);
  assert.equal(store.heldBytes, layout.bytes);
  assert.equal(store.repeatedBytes, 0);
});

test("the cutter rebuilds every frame across random and adversarial chunk boundaries", () => {
  const { f, buf, layout } = pack(41);
  const h = parsePackHeader(buf.subarray(0, layout.header));
  assert.ok(h && !("error" in h));
  const edges = h.slots.flatMap((s) => [s.offset - 1, s.offset, s.offset + 1, s.offset + s.length - 1]);
  const adversarial: number[][] = [
    // Inside the fixed header, inside the table, at its end.
    [1, 3, 4, 23, 24, 25, layout.header - 1, layout.header, layout.header + 1],
    // Every slot edge, one byte either side.
    edges,
    // The skeleton boundary.
    [layout.skeletonEnd - 1, layout.skeletonEnd, layout.skeletonEnd + 1],
    // One chunk for everything.
    [],
  ];
  const r = rng(7);
  for (let k = 0; k < 40; k++) {
    const n = 1 + Math.floor(r() * 60);
    adversarial.push(Array.from({ length: n }, () => Math.floor(r() * buf.length)));
  }
  for (const cuts of adversarial) {
    const store = new PackBytes("p", layout, 41);
    feed(store, buf, cuts);
    assertAllFrames(store, f);
    assert.equal(store.repeatedBytes, 0);
  }
});

test("a stream stopped mid-frame resumes at the first byte not held, nothing read twice", () => {
  const { f, buf, layout } = pack(23);
  const store = new PackBytes("p", layout, 23);
  const r = rng(11);
  let at = 0;
  // Stop and resume at random points: each resume starts where the store says.
  while (at < buf.length) {
    const stop = Math.min(buf.length, at + 1 + Math.floor(r() * 300));
    feed(store, buf, [at + Math.floor((stop - at) / 2)], at, stop);
    at = store.firstMissing(0, buf.length);
    assert.equal(at === -1 ? buf.length : at, stop, "resume point = first byte not held");
    if (at === -1) break;
  }
  assertAllFrames(store, f);
  assert.equal(store.repeatedBytes, 0);
});

test("bytes written over a held range are counted as repeated and leave the frame intact", () => {
  const { f, buf, layout } = pack(8);
  const store = new PackBytes("p", layout, 8);
  feed(store, buf, [100, 200], 0, 400);
  // A server that ignored Range: the whole file again from byte 0.
  const r = store.write(0, buf);
  assert.equal(r.error, undefined);
  assert.equal(store.repeatedBytes, 400);
  assertAllFrames(store, f);
  assert.equal(store.heldBytes, buf.length);
});

test("a header that disagrees with the timeline makes the pack unusable", () => {
  const { buf, layout } = pack(8);
  const store = new PackBytes("p", { ...layout, skeletonEnd: layout.skeletonEnd + 4 }, 8);
  const r = store.write(0, buf.subarray(0, layout.header + 10));
  assert.match(r.error ?? "", /skeleton/);
});

test("dropping a frame's bytes frees them; held() and firstMissing follow", () => {
  const { buf, layout } = pack(12);
  const store = new PackBytes("p", layout, 12);
  feed(store, buf, [], 0, buf.length);
  const h = store.header!;
  assert.ok(store.held(5));
  const s5 = h.slots[h.slotOf[5]!]!;
  const freed = store.dropFrame(5);
  assert.equal(freed, s5.length);
  assert.ok(!store.held(5));
  assert.equal(store.heldBytes, layout.bytes - s5.length);
  assert.equal(store.firstMissing(0, buf.length), s5.offset);
  // Writing it again is not a repeat.
  store.write(s5.offset, buf.subarray(s5.offset, s5.offset + s5.length));
  assert.ok(store.held(5));
  assert.equal(store.repeatedBytes, 0);
});
