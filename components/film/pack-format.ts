/**
 * Film pack format, layout v1 (written by scripts/film/pack-lib.mjs, read in
 * the film worker). Little-endian u32 fields:
 *
 *   0   magic "CFPK"
 *   4   layout version (1)
 *   8   frame count N
 *   12  header length H = 24 + 12·N
 *   16  skeleton end: byte offset where the skeleton layer ends
 *   20  total length of the file
 *   24  N entries in FILE order: frame index, byte offset (absolute), byte length
 *   H   frame bytes in file order
 *
 * The reader takes the order from the table and assumes nothing about it.
 * What the runtime needs before the first byte (bytes, header length,
 * skeleton end, version) is in book.timeline.json (FilmVariant.pack).
 */

export const PACK_MAGIC = "CFPK";
export const PACK_LAYOUT_VERSION = 1;
export const PACK_FIXED_BYTES = 24;
export const PACK_ENTRY_BYTES = 12;
export const PACK_FILE = "pack.bin";
/**
 * The pack builder puts every 4th frame in the skeleton layer. The page uses
 * this only to ORDER decodes (coarse first); byte positions always come from
 * the header.
 */
export const SKELETON_STRIDE = 4;

/**
 * What book.timeline.json records about a variant's pack, known before its
 * first byte arrives: total bytes, header length, where the skeleton layer
 * ends, where the opening window (frames 0–47, read before the first scroll)
 * ends, and the version (?v= on the pack URL).
 */
export type PackLayout = { bytes: number; header: number; skeletonEnd: number; openingEnd?: number; v?: string };

/** Frames 0 … OPENING_FRAMES − 1 are the opening window (scripts/film/pack-lib.mjs). */
export const OPENING_FRAMES = 48;

/** The byte where frames 0 … OPENING_FRAMES − 1 are all complete. */
export function openingEnd(h: PackHeader): number {
  let end = h.header;
  for (const s of h.slots) if (s.index < OPENING_FRAMES) end = Math.max(end, s.offset + s.length);
  return end;
}

export type PackSlot = { index: number; offset: number; length: number };

export type PackHeader = {
  version: number;
  count: number;
  header: number;
  skeletonEnd: number;
  bytes: number;
  /** Frames in file order. */
  slots: PackSlot[];
  /** Frame index → slot (-1 when the table has no such frame). */
  slotOf: Int32Array;
};

/**
 * Parse a pack header from the first bytes of a pack. Null while `bytes` is
 * too short to hold the whole header; `{ error }` when it is not a pack this
 * reader understands or is not self-consistent.
 */
export function parsePackHeader(bytes: Uint8Array): PackHeader | { error: string } | null {
  if (bytes.length < PACK_FIXED_BYTES) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (magic !== PACK_MAGIC) return { error: `pack: bad magic "${magic}"` };
  const version = dv.getUint32(4, true);
  if (version !== PACK_LAYOUT_VERSION) return { error: `pack: layout version ${version}, this reader reads ${PACK_LAYOUT_VERSION}` };
  const count = dv.getUint32(8, true);
  const header = dv.getUint32(12, true);
  if (header !== PACK_FIXED_BYTES + PACK_ENTRY_BYTES * count) return { error: "pack: header length disagrees with the frame count" };
  if (bytes.length < header) return null;
  const skeletonEnd = dv.getUint32(16, true);
  const total = dv.getUint32(20, true);
  const slots: PackSlot[] = [];
  const slotOf = new Int32Array(count).fill(-1);
  let at = header;
  for (let s = 0; s < count; s++) {
    const e = PACK_FIXED_BYTES + PACK_ENTRY_BYTES * s;
    const index = dv.getUint32(e, true);
    const offset = dv.getUint32(e + 4, true);
    const length = dv.getUint32(e + 8, true);
    if (index >= count || slotOf[index] !== -1) return { error: `pack: frame ${index} out of range or listed twice` };
    if (offset !== at) return { error: `pack: frame ${index} is not contiguous (offset ${offset}, expected ${at})` };
    slotOf[index] = s;
    slots.push({ index, offset, length });
    at = offset + length;
  }
  if (at !== total) return { error: `pack: frames end at ${at}, header says ${total}` };
  if (skeletonEnd < header || skeletonEnd > total) return { error: "pack: skeleton end outside the file" };
  return { version, count, header, skeletonEnd, bytes: total, slots, slotOf };
}

/** Null when the header agrees with the timeline's layout and frame count, else why not. */
export function packLayoutProblem(h: PackHeader, layout: PackLayout, count: number): string | null {
  if (h.count !== count) return `pack holds ${h.count} frames, the timeline says ${count}`;
  if (h.bytes !== layout.bytes) return `pack is ${h.bytes} bytes, the timeline says ${layout.bytes}`;
  if (h.header !== layout.header) return `pack header is ${h.header} bytes, the timeline says ${layout.header}`;
  if (h.skeletonEnd !== layout.skeletonEnd) return `pack skeleton ends at ${h.skeletonEnd}, the timeline says ${layout.skeletonEnd}`;
  if (layout.openingEnd !== undefined && openingEnd(h) !== layout.openingEnd) {
    return `pack opening window ends at ${openingEnd(h)}, the timeline says ${layout.openingEnd}`;
  }
  return null;
}
