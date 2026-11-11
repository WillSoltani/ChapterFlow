import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPack, packOrder, parsePack, staleFrameFiles, verifyPack, writePack } from "../../scripts/film/pack-lib.mjs";
import { packTimelineEntry } from "../../scripts/film/band-sync.mjs";

/** Fake frames: distinct sizes and contents. */
const frames = (n: number) => Array.from({ length: n }, (_, i) => Buffer.from(`frame-${i}-`.repeat(1 + (i % 5))));

test("packOrder: the skeleton layer (every 4th frame) first, then the rest in frame order", () => {
  assert.deepEqual(packOrder(10), [0, 4, 8, 1, 2, 3, 5, 6, 7, 9]);
  assert.deepEqual(packOrder(1), [0]);
});

test("buildPack: the opening window ends after frame 47's slot", () => {
  const p = buildPack(frames(100));
  const h = parsePack(p.buf);
  const slot47 = h.entries.find((e: { index: number }) => e.index === 47)!;
  assert.equal(p.openingEnd, slot47.offset + slot47.length);
  assert.ok(p.openingEnd > p.skeletonEnd);
  assert.equal(buildPack(frames(10)).openingEnd, buildPack(frames(10)).bytes, "a short film: the whole file");
});

test("buildPack: header, table and slices; output is deterministic", () => {
  const f = frames(13);
  const a = buildPack(f);
  const b = buildPack(frames(13));
  assert.ok(a.buf.equals(b.buf), "same frames, same bytes");
  assert.equal(a.v, b.v);
  const h = parsePack(a.buf);
  assert.equal(h.count, 13);
  assert.equal(h.header, 24 + 12 * 13);
  assert.equal(h.bytes, a.buf.length);
  assert.deepEqual(
    h.entries.map((e: { index: number }) => e.index),
    packOrder(13),
  );
  let at = h.header;
  for (const e of h.entries) {
    assert.equal(e.offset, at);
    assert.ok(a.buf.subarray(e.offset, e.offset + e.length).equals(f[e.index]!));
    at += e.length;
    if (e.index === 12) assert.equal(h.skeletonEnd, at, "the skeleton ends after the last stride frame");
  }
  // Another frame set changes the version.
  const c = buildPack([...frames(12), Buffer.from("other")]);
  assert.notEqual(c.v, a.v);
});

async function tmpVariant(n: number) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-pack-"));
  const f = frames(n);
  for (let i = 0; i < n; i++) await fs.writeFile(path.join(dir, `f_${String(i + 1).padStart(4, "0")}.webp`), f[i]!);
  await fs.writeFile(path.join(dir, "poster.webp"), f[0]!);
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ name: "x", count: n, pad: 4, ext: "webp", width: 9, height: 9 }));
  return dir;
}

test("writePack + verifyPack: verified, frames untouched; a changed frame or count fails", async () => {
  const dir = await tmpVariant(9);
  const before = await fs.readFile(path.join(dir, "f_0003.webp"));
  const field = await writePack(dir);
  const m = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  assert.deepEqual(m.pack, field);
  assert.equal(m.count, 9);
  assert.ok((await fs.readFile(path.join(dir, "f_0003.webp"))).equals(before));
  assert.deepEqual(await verifyPack(dir), []);
  // A frame re-encoded after the pack was built.
  await fs.writeFile(path.join(dir, "f_0003.webp"), Buffer.from("re-encoded"));
  assert.ok((await verifyPack(dir)).some((p: string) => /frame 2 slice differs/.test(p)));
  // A frame added.
  await fs.writeFile(path.join(dir, "f_0010.webp"), Buffer.from("extra"));
  assert.ok((await verifyPack(dir)).some((p: string) => /pack holds 9 frames, directory 10/.test(p)));
  await fs.rm(dir, { recursive: true });
});

const LAYOUT = { bytes: 1000, header: 132, skeletonEnd: 400, openingEnd: 1000, v: "abc" };
const inspected = (over: Partial<{ count: number; bytes: number; header: number; skeletonEnd: number; lengths: number[]; sizes: number[] }> = {}) => {
  const lengths = over.lengths ?? [10, 20, 30];
  return {
    header: {
      count: over.count ?? 3,
      bytes: over.bytes ?? 1000,
      header: over.header ?? 132,
      skeletonEnd: over.skeletonEnd ?? 400,
      entries: lengths.map((length, i) => ({ index: i, offset: 132 + lengths.slice(0, i).reduce((a, b) => a + b, 0), length })),
    },
    fileBytes: over.bytes ?? 1000,
    sizes: over.sizes ?? [10, 20, 30],
  };
};
// The fake pack's three frames end at 132 + 60 (all inside the opening window).
LAYOUT.openingEnd = 192;

test("packTimelineEntry: a matching pack is recorded with the manifest's version", () => {
  const { entry, stale } = packTimelineEntry(undefined, LAYOUT, inspected(), 3, "palace-00");
  assert.deepEqual(entry, LAYOUT);
  assert.equal(stale, null);
});

test("packTimelineEntry: a manifest pack with no version keeps the timeline's version", () => {
  const { bytes, header, skeletonEnd } = LAYOUT;
  const { entry } = packTimelineEntry({ ...LAYOUT, v: "kept" }, { bytes, header, skeletonEnd }, inspected(), 3, "palace-00");
  assert.equal(entry?.v, "kept");
});

test("packTimelineEntry: no pack anywhere records nothing and is not stale", () => {
  const { entry, stale } = packTimelineEntry(undefined, undefined, { header: null, fileBytes: 0, sizes: [10, 20, 30] }, 3, "palace-00");
  assert.equal(entry, null);
  assert.equal(stale, null);
});

test("packTimelineEntry: a pack that no longer matches its directory is stale and dropped", () => {
  const cases: Array<[string, ReturnType<typeof inspected>, number, RegExp]> = [
    ["a frame re-encoded", inspected({ sizes: [10, 21, 30] }), 3, /frame 1 is 21 bytes on disk, 20 in the pack/],
    ["a frame added", inspected({ sizes: [10, 20, 30, 40] }), 4, /holds 3 frames but the directory has 4/],
    ["the film's count changed", inspected(), 4, /holds 3 frames but the film has 4/],
    ["manifest disagrees with the file", inspected({ bytes: 999 }), 3, /manifest says 1000 bytes, pack.bin is 999/],
  ];
  for (const [label, insp, filmCount, msg] of cases) {
    const { entry, stale } = packTimelineEntry({ ...LAYOUT }, LAYOUT, insp, filmCount, "palace-00");
    assert.equal(entry, null, label);
    assert.match(stale ?? "", msg, label);
    assert.match(stale ?? "", /film:pack/, label);
  }
  // pack.bin present but the manifest has no pack field (encode.mjs rewrote it).
  const r = packTimelineEntry({ ...LAYOUT }, undefined, inspected(), 3, "palace-00");
  assert.equal(r.entry, null);
  assert.match(r.stale ?? "", /not recorded in its manifest/);
  // Manifest says there is a pack, but pack.bin is gone.
  const g = packTimelineEntry({ ...LAYOUT }, LAYOUT, { header: null, fileBytes: 0, sizes: [10, 20, 30] }, 3, "palace-00");
  assert.equal(g.entry, null);
  assert.match(g.stale ?? "", /no pack.bin/);
});

// ---- Regressions (review of Phase 4) ----

test("packTimelineEntry: no pack.bin here but one in the timeline keeps the entry and says so (never a silent delete)", () => {
  const { entry, stale } = packTimelineEntry({ ...LAYOUT }, undefined, { header: null, fileBytes: 0, sizes: [10, 20, 30] }, 3, "palace-00");
  assert.deepEqual(entry, LAYOUT, "the timeline's pack is kept");
  assert.match(stale ?? "", /palace-00/);
  assert.match(stale ?? "", /no pack.bin/);
  assert.match(stale ?? "", /film:pack/);
});

test("verifyPack: a frame missing from the middle of the directory is reported, not thrown", async () => {
  const dir = await tmpVariant(9);
  await writePack(dir);
  await fs.rm(path.join(dir, "f_0004.webp"));
  const problems: string[] = await verifyPack(dir);
  assert.ok(problems.some((p) => /contiguous/.test(p)), problems.join("; "));
  await fs.rm(dir, { recursive: true });
});

test("staleFrameFiles: frames past the count, or with another padding, are stale", () => {
  const names = ["f_0001.webp", "f_0002.webp", "f_0003.webp", "f_0004.webp", "f_00002.webp", "poster.webp", "f_0003.avif"];
  assert.deepEqual(staleFrameFiles(names, 3, 4, "webp"), ["f_0004.webp", "f_00002.webp", "f_0003.avif"]);
  assert.deepEqual(staleFrameFiles(["f_0001.webp", "f_0002.webp"], 2, 4, "webp"), []);
});
