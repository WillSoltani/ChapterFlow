/**
 * PackBytes — the compressed bytes the film worker holds for ONE pack, and
 * the incremental frame cutter: bytes arrive in chunks of any size at any
 * absolute offset (a Range response), the header is parsed as soon as it is
 * complete, and every frame whose bytes are all held is complete.
 *
 * Bookkeeping is per frame slot (file order): the bytes held of a slot are a
 * PREFIX of it (a stream always starts at the first byte not held and reads
 * forward), so a stream stopped mid-frame resumes at that frame's first
 * missing byte and nothing is read twice. Bytes written over a held range are
 * counted (`repeatedBytes`) and ignored; bytes that would leave a hole are
 * dropped (`gapBytes`, a planner bug if ever non-zero).
 */

import { packLayoutProblem, parsePackHeader, type PackHeader, type PackLayout } from "./pack-format";

export type WriteResult = {
  /** Frame indices that became complete with this write. */
  completed: number[];
  /** Set when the pack turned out unusable (bad header, disagrees with the timeline). */
  error?: string;
};

export class PackBytes {
  header: PackHeader | null = null;
  heldBytes = 0;
  repeatedBytes = 0;
  gapBytes = 0;

  private readonly head: Uint8Array;
  private headFilled = 0;
  private bufs: Array<Uint8Array | null> = [];
  private filled = new Int32Array(0);

  constructor(
    readonly key: string,
    readonly layout: PackLayout,
    readonly count: number,
  ) {
    this.head = new Uint8Array(layout.header);
  }

  /** Bytes held of file slot `slot` (a prefix of it). */
  slotFilled(slot: number): number {
    return this.filled[slot] ?? 0;
  }

  get headerFilled(): number {
    return this.headFilled;
  }

  /** The frame's bytes are all held. */
  held(index: number): boolean {
    const h = this.header;
    if (!h) return false;
    const s = h.slotOf[index] ?? -1;
    return s >= 0 && this.filled[s] === h.slots[s]!.length;
  }

  /** A complete frame's bytes (a view, not a copy), else null. */
  frame(index: number): Uint8Array | null {
    if (!this.held(index)) return null;
    const s = this.header!.slotOf[index]!;
    return this.bufs[s] ?? null;
  }

  /** Complete frame indices. */
  heldFrames(): number[] {
    const h = this.header;
    if (!h) return [];
    const out: number[] = [];
    for (let s = 0; s < h.slots.length; s++) if (this.filled[s] === h.slots[s]!.length) out.push(h.slots[s]!.index);
    return out;
  }

  /** Bytes [pos, pos + chunk.length) of the pack arrived. */
  write(pos: number, chunk: Uint8Array): WriteResult {
    const completed: number[] = [];
    const H = this.layout.header;
    let at = pos;
    let data = chunk;
    if (at < H && data.length) {
      const n = Math.min(data.length, H - at);
      this.headFilled = this.writePrefix(this.head, this.headFilled, at, data.subarray(0, n));
      at += n;
      data = data.subarray(n);
      if (!this.header && this.headFilled === H) {
        const h = parsePackHeader(this.head);
        if (!h) return { completed, error: "pack: header incomplete at its full length" };
        if ("error" in h) return { completed, error: h.error };
        const problem = packLayoutProblem(h, this.layout, this.count);
        if (problem) return { completed, error: problem };
        this.header = h;
        this.bufs = new Array<Uint8Array | null>(h.slots.length).fill(null);
        this.filled = new Int32Array(h.slots.length);
      }
    }
    if (!data.length) return { completed };
    const h = this.header;
    if (!h) return { completed, error: "pack: frame bytes before the header" };
    for (let si = this.slotEndingAfter(at); si < h.slots.length && data.length; si++) {
      const s = h.slots[si]!;
      const rel = at - s.offset;
      const n = Math.min(data.length, s.length - rel);
      if (n <= 0) continue;
      const before = this.filled[si]!;
      let buf = this.bufs[si];
      if (!buf) buf = this.bufs[si] = new Uint8Array(s.length);
      this.filled[si] = this.writePrefix(buf, before, rel, data.subarray(0, n));
      if (this.filled[si] === 0) this.bufs[si] = null;
      if (before < s.length && this.filled[si] === s.length) completed.push(s.index);
      at += n;
      data = data.subarray(n);
    }
    if (data.length) this.gapBytes += data.length; // past the end of the file
    return { completed };
  }

  /** The first slot that ends after byte `pos` (slots are in offset order). */
  private slotEndingAfter(pos: number): number {
    const slots = this.header!.slots;
    let lo = 0;
    let hi = slots.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const s = slots[mid]!;
      if (s.offset + s.length <= pos) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Write `data` at `rel` into a prefix-filled buffer; returns the new fill. */
  private writePrefix(buf: Uint8Array, filled: number, rel: number, data: Uint8Array): number {
    const end = rel + data.length;
    const overlap = Math.max(0, Math.min(end, filled) - rel);
    this.repeatedBytes += overlap;
    if (end <= filled) return filled;
    if (rel > filled) {
      this.gapBytes += data.length;
      return filled;
    }
    buf.set(data.subarray(filled - rel), filled);
    this.heldBytes += end - filled;
    return end;
  }

  /** First byte in [from, to) not held, or -1. Unknown layout past the header counts as not held. */
  firstMissing(from: number, to: number): number {
    const H = this.layout.header;
    if (from < H) {
      if (this.headFilled < H) {
        const m = Math.max(from, this.headFilled);
        return m < to ? m : -1;
      }
      from = H;
    }
    if (from >= to) return -1;
    const h = this.header;
    if (!h) return from;
    for (let si = this.slotEndingAfter(from); si < h.slots.length; si++) {
      const s = h.slots[si]!;
      if (s.offset >= to) break;
      const m = Math.max(from, s.offset + this.filled[si]!);
      if (m < s.offset + s.length) return m < to ? m : -1;
    }
    return -1;
  }

  /** First held byte at or after `from` (below `to`), else `to`. */
  nextHeld(from: number, to: number): number {
    const H = this.layout.header;
    if (from < H && from < this.headFilled) return from;
    const h = this.header;
    if (!h) return to;
    for (let si = this.slotEndingAfter(Math.max(from, H)); si < h.slots.length; si++) {
      const s = h.slots[si]!;
      if (s.offset >= to) break;
      const f = this.filled[si]!;
      if (f > 0 && s.offset + f > from) return Math.min(to, Math.max(from, s.offset));
    }
    return to;
  }

  /** Drop one frame's bytes (eviction). Returns the bytes freed. */
  dropFrame(index: number): number {
    const h = this.header;
    if (!h) return 0;
    const s = h.slotOf[index] ?? -1;
    return s >= 0 ? this.dropSlot(s) : 0;
  }

  /** Drop the bytes of file slot `slot` (complete or partial). */
  dropSlot(slot: number): number {
    const f = this.filled[slot] ?? 0;
    if (!f) return 0;
    this.filled[slot] = 0;
    this.bufs[slot] = null;
    this.heldBytes -= f;
    return f;
  }
}
