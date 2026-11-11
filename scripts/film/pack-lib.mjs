/**
 * pack-lib.mjs — the film pack format (layout v1), shared by pack.mjs,
 * encode.mjs and placeholder.mjs. Pure apart from writePack / readDirFrames.
 *
 * One pack per variant directory (pack.bin next to the frames), built from
 * the existing frame files byte for byte. Little-endian u32 fields:
 *
 *   0   magic "CFPK"
 *   4   layout version (1)
 *   8   frame count N
 *   12  header length H = 24 + 12·N (the frame bytes start here)
 *   16  skeleton end: the byte offset where the skeleton layer ends
 *   20  total length of the file
 *   24  N entries in FILE order: frame index (0-based), byte offset
 *       (absolute, from the start of the file), byte length
 *   H   frame bytes, in file order, no padding
 *
 * File order: the skeleton layer first (every 4th frame: 0, 4, 8, … in frame
 * order), then every other frame in frame order. Readers take the order from
 * the table (components/film/pack-format.ts never assumes it). Output is
 * deterministic: the same frame files give the same bytes, and the version
 * is a hash of those bytes.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const PACK_MAGIC = "CFPK";
export const PACK_LAYOUT_VERSION = 1;
export const PACK_FILE = "pack.bin";
export const PACK_FIXED_BYTES = 24;
export const PACK_ENTRY_BYTES = 12;
/** Every SKELETON_STRIDE-th frame (0, 4, 8, …) is in the skeleton layer. */
export const SKELETON_STRIDE = 4;

/** Frame indices in file order for `count` frames: skeleton (stride) first, then the rest. */
export function packOrder(count, stride = SKELETON_STRIDE) {
  const order = [];
  for (let i = 0; i < count; i += stride) order.push(i);
  for (let i = 0; i < count; i++) if (i % stride !== 0) order.push(i);
  return order;
}

/**
 * Build a pack from frame bytes (`frames[i]` = frame i's file bytes).
 * @param {Uint8Array[]} frames
 * @returns {{ buf: Buffer, header: number, skeletonEnd: number, bytes: number, v: string }}
 */
export function buildPack(frames, stride = SKELETON_STRIDE) {
  const n = frames.length;
  if (n === 0) throw new Error("pack: no frames");
  const order = packOrder(n, stride);
  const header = PACK_FIXED_BYTES + PACK_ENTRY_BYTES * n;
  let total = header;
  for (const f of frames) total += f.length;
  if (total > 0xffffffff) throw new Error("pack: larger than 4 GiB");
  const buf = Buffer.alloc(total);
  buf.write(PACK_MAGIC, 0, "ascii");
  buf.writeUInt32LE(PACK_LAYOUT_VERSION, 4);
  buf.writeUInt32LE(n, 8);
  buf.writeUInt32LE(header, 12);
  buf.writeUInt32LE(total, 20);
  let at = header;
  let skeletonEnd = header;
  order.forEach((index, slot) => {
    const f = frames[index];
    const e = PACK_FIXED_BYTES + PACK_ENTRY_BYTES * slot;
    buf.writeUInt32LE(index, e);
    buf.writeUInt32LE(at, e + 4);
    buf.writeUInt32LE(f.length, e + 8);
    buf.set(f, at);
    at += f.length;
    if (index % stride === 0) skeletonEnd = at;
  });
  buf.writeUInt32LE(skeletonEnd, 16);
  const v = createHash("sha256").update(buf).digest("hex").slice(0, 12);
  return { buf, header, skeletonEnd, bytes: total, v };
}

/**
 * Parse a pack header from the first bytes of a pack.
 * @param {Uint8Array} bytes  at least the whole header
 * @returns {{ version: number, count: number, header: number, skeletonEnd: number, bytes: number, entries: Array<{ index: number, offset: number, length: number }> }}
 */
export function parsePack(bytes) {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length < PACK_FIXED_BYTES) throw new Error("pack: shorter than the fixed header");
  if (b.toString("ascii", 0, 4) !== PACK_MAGIC) throw new Error("pack: bad magic");
  const version = b.readUInt32LE(4);
  if (version !== PACK_LAYOUT_VERSION) throw new Error(`pack: layout version ${version}, expected ${PACK_LAYOUT_VERSION}`);
  const count = b.readUInt32LE(8);
  const header = b.readUInt32LE(12);
  if (header !== PACK_FIXED_BYTES + PACK_ENTRY_BYTES * count) throw new Error("pack: header length disagrees with the frame count");
  if (b.length < header) throw new Error("pack: shorter than its header");
  const entries = [];
  for (let slot = 0; slot < count; slot++) {
    const e = PACK_FIXED_BYTES + PACK_ENTRY_BYTES * slot;
    entries.push({ index: b.readUInt32LE(e), offset: b.readUInt32LE(e + 4), length: b.readUInt32LE(e + 8) });
  }
  return { version, count, header, skeletonEnd: b.readUInt32LE(16), bytes: b.readUInt32LE(20), entries };
}

/** The frame files of a variant directory, in frame order: f_0001.webp … */
export async function listFrames(dir) {
  const names = (await fs.readdir(dir)).filter((f) => /^f_\d+\.(webp|avif|jpg)$/.test(f));
  names.sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]));
  names.forEach((n, i) => {
    if (Number(/\d+/.exec(n)[0]) !== i + 1) throw new Error(`${dir}: frame files are not f_0001 … contiguous (${n} at position ${i + 1})`);
  });
  return names;
}

/** The manifest's `pack` field for a built pack. */
export function packField(p) {
  return { bytes: p.bytes, header: p.header, skeletonEnd: p.skeletonEnd, v: p.v };
}

/**
 * Write pack.bin for a variant directory from its frame files and record it
 * in the directory's manifest.json (field `pack`). Never touches a frame or
 * the poster. Returns the manifest field.
 */
export async function writePack(dir) {
  const names = await listFrames(dir);
  const frames = await Promise.all(names.map((n) => fs.readFile(path.join(dir, n))));
  const p = buildPack(frames);
  const mPath = path.join(dir, "manifest.json");
  const m = JSON.parse(await fs.readFile(mPath, "utf8"));
  if (m.count !== names.length) throw new Error(`${dir}: manifest count ${m.count} but ${names.length} frame files`);
  const tmp = path.join(dir, `${PACK_FILE}.tmp`);
  await fs.writeFile(tmp, p.buf);
  await fs.rename(tmp, path.join(dir, PACK_FILE));
  m.pack = packField(p);
  await fs.writeFile(mPath, JSON.stringify(m, null, 2) + "\n");
  return m.pack;
}

/**
 * Prove a directory's pack: every frame slice byte-identical to its file,
 * the frame count equal to the directory's, the header self-consistent and
 * equal to the manifest's `pack` field. Returns a list of problems (empty =
 * verified).
 */
export async function verifyPack(dir) {
  const problems = [];
  let buf;
  try {
    buf = await fs.readFile(path.join(dir, PACK_FILE));
  } catch {
    return [`${dir}: no ${PACK_FILE}`];
  }
  let h;
  try {
    h = parsePack(buf);
  } catch (e) {
    return [`${dir}: ${e.message}`];
  }
  const names = await listFrames(dir);
  if (h.count !== names.length) problems.push(`${dir}: pack holds ${h.count} frames, directory ${names.length}`);
  if (h.bytes !== buf.length) problems.push(`${dir}: header says ${h.bytes} bytes, file is ${buf.length}`);
  const seen = new Set();
  let at = h.header;
  let skeletonEnd = h.header;
  for (const e of h.entries) {
    if (seen.has(e.index)) problems.push(`${dir}: frame ${e.index} twice in the table`);
    seen.add(e.index);
    if (e.offset !== at) problems.push(`${dir}: frame ${e.index} at ${e.offset}, expected ${at} (slices must be contiguous)`);
    at = e.offset + e.length;
    if (e.index % SKELETON_STRIDE === 0) skeletonEnd = at;
    const name = names[e.index];
    if (!name) {
      problems.push(`${dir}: frame ${e.index} has no file`);
      continue;
    }
    const file = await fs.readFile(path.join(dir, name));
    const slice = buf.subarray(e.offset, e.offset + e.length);
    if (!file.equals(slice)) problems.push(`${dir}: frame ${e.index} slice differs from ${name}`);
  }
  if (at !== buf.length) problems.push(`${dir}: slices end at ${at}, file is ${buf.length}`);
  if (skeletonEnd !== h.skeletonEnd) problems.push(`${dir}: skeleton ends at ${skeletonEnd}, header says ${h.skeletonEnd}`);
  const order = packOrder(h.count);
  if (h.entries.some((e, i) => e.index !== order[i])) problems.push(`${dir}: file order is not skeleton-first`);
  try {
    const m = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
    const want = { bytes: buf.length, header: h.header, skeletonEnd: h.skeletonEnd };
    if (!m.pack) problems.push(`${dir}: manifest.json has no pack field`);
    else for (const k of Object.keys(want)) if (m.pack[k] !== want[k]) problems.push(`${dir}: manifest pack.${k} ${m.pack[k]}, pack says ${want[k]}`);
    if (m.pack && m.pack.v !== createHash("sha256").update(buf).digest("hex").slice(0, 12)) problems.push(`${dir}: manifest pack.v does not match the pack's hash`);
  } catch {
    problems.push(`${dir}: no readable manifest.json`);
  }
  return problems;
}

/**
 * What the timeline sync needs to know about a directory's pack, cheaply:
 * its header (or null when there is no pack.bin) and the sizes of the frame
 * files (stat, no reads).
 */
export async function inspectPackDir(dir) {
  let header = null;
  let fileBytes = 0;
  try {
    const fh = await fs.open(path.join(dir, PACK_FILE), "r");
    try {
      fileBytes = (await fh.stat()).size;
      const fixed = Buffer.alloc(PACK_FIXED_BYTES);
      await fh.read(fixed, 0, PACK_FIXED_BYTES, 0);
      const count = fixed.readUInt32LE(8);
      const len = Math.min(fileBytes, PACK_FIXED_BYTES + PACK_ENTRY_BYTES * count);
      const all = Buffer.alloc(len);
      await fh.read(all, 0, len, 0);
      try {
        header = parsePack(all);
      } catch (e) {
        header = { error: e.message };
      }
    } finally {
      await fh.close();
    }
  } catch {
    return { header: null, fileBytes: 0, sizes: [] };
  }
  const names = await listFrames(dir).catch(() => []);
  const sizes = await Promise.all(names.map(async (n) => (await fs.stat(path.join(dir, n))).size));
  return { header, fileBytes, sizes };
}
