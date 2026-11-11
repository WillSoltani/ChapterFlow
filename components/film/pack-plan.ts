/**
 * The film worker's network plan: which byte ranges of which packs to read
 * now. Pure: the worker's controller (pack-net.ts) calls it whenever
 * something changed (the visitor moved, a chunk landed, a stream ended) and
 * opens or stops streams to match.
 *
 * Objective: coarse motion everywhere as early as possible, exact frames
 * near the playhead next, never a byte twice.
 *
 * Order of work once the visitor has scrolled:
 *   1. the active film's skeleton (every 4th frame; it is the start of the file),
 *   2. the skeleton of the film the visitor travels towards (next when
 *      scrolling down, previous when scrolling up),
 *   3. the active film's remaining frames, from the playhead,
 *   4. that neighbour's remaining frames, from where the visitor will enter it.
 * Nothing else: a stream on any other pack is stopped (its bytes stay).
 * One stream per pack, at most `maxStreams` (2) at once, none opened while the
 * document is hidden. A skeleton range directly followed by the remaining
 * frames it is about to need is read by ONE stream (one request), so a
 * steady pass costs about one request per film.
 *
 * Ranges: a stream starts at the first byte not held and ends before the
 * next held byte; it is open-ended (`bytes=N-`) when that is the end of the
 * file. So no range is read twice while its bytes are held.
 *
 * Before the first scroll only the first film's pack is read: its skeleton
 * and the rest of the opening window (frames 0–47), then the stream stops;
 * it continues from the first missing byte on the first scroll.
 *
 * Re-aim: the remaining frames are in frame order in the file, so one stream
 * reading forward serves a visitor moving forward. When the playhead is where
 * the stream is not, the stream is stopped and reopened at the first missing
 * frame at the playhead (a little behind it when scrolling up), only when:
 * the visitor scrolls up, has just jumped (anchor, flick), or has stopped. A
 * stream a few frames short of the playhead is left to reach it. While the
 * visitor moves forward steadily faster than the network, the stream keeps
 * reading in order (re-aiming would cost a request every second and win
 * frames the visitor passes at once; the skeleton covers the motion).
 *
 * Constrained connections (Save-Data, 2g, 3g): skeletons only (1, 2) while
 * the visitor moves; once settled, the missing frames of the wanted window
 * around the playhead in one bounded request.
 */

import type { PackHeader, PackLayout } from "./pack-format";

/** The last frame of the opening window read before the first scroll. */
export const OPENING_LAST_FRAME = 47;
/** A stream at most this many frames short of where it should be is left to reach it. */
export const REACH_FRAMES = 16;
/** Scrolling up, a re-aimed stream starts this many frames below the playhead. */
export const BEHIND_FRAMES = 64;

/** What the planner reads of a pack's held bytes (PackBytes). */
export type PackView = {
  readonly header: PackHeader | null;
  firstMissing(from: number, to: number): number;
  nextHeld(from: number, to: number): number;
};

export type PlanPack = {
  key: string;
  count: number;
  layout: PackLayout;
  bytes: PackView;
  /** The server ignored Range for this pack (200 from byte 0): read it whole, from 0. */
  rangeless: boolean;
  /** Unusable, failed, or waiting out a retry backoff: no stream. */
  blocked: boolean;
};

export type PlanStream = { id: number; key: string; pos: number; end: number };

export type PlanInput = {
  /** The reel's packs for the current view, in film order (null = no pack). */
  packs: Array<PlanPack | null>;
  active: number;
  frame: number;
  direction: 1 | -1;
  /** The wanted window in the active film (frames), for constrained mode. */
  lo: number;
  hi: number;
  scrolled: boolean;
  constrained: boolean;
  /** No playhead change for ~300 ms. */
  settled: boolean;
  /** The playhead just jumped (anchor, flick, a film entered out of order). */
  jumped: boolean;
  hidden: boolean;
  streams: PlanStream[];
  maxStreams: number;
};

export type PlanStep = "opening" | "skeleton" | "neighbour-skeleton" | "rest" | "neighbour-rest" | "window";

/** A range to read: [start, end). `end === layout.bytes` is an open-ended request. */
export type PlanItem = { key: string; start: number; end: number; step: PlanStep };

export type PlanOutput = {
  /** Streams that go on as they are. */
  keep: number[];
  stop: number[];
  open: PlanItem[];
  /** The work list in priority order (for tests and the HUD). */
  items: PlanItem[];
};

function slotAt(h: PackHeader, pos: number): number {
  let lo = 0;
  let hi = h.slots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const s = h.slots[mid]!;
    if (s.offset + s.length <= pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First missing byte of the remaining (non-skeleton) frames from..to, in frame order; -1 if none. */
function firstMissingRest(p: PlanPack, h: PackHeader, from: number, to: number): number {
  for (let f = Math.max(0, from); f <= Math.min(p.count - 1, to); f++) {
    const si = h.slotOf[f] ?? -1;
    if (si < 0) continue;
    const s = h.slots[si]!;
    if (s.offset < h.skeletonEnd) continue;
    const m = p.bytes.firstMissing(s.offset, s.offset + s.length);
    if (m >= 0) return m;
  }
  return -1;
}

/** End of frame `f`'s slot (bytes), or the end of the file. */
function frameEnd(p: PlanPack, h: PackHeader, f: number): number {
  const si = h.slotOf[Math.min(p.count - 1, Math.max(0, f))] ?? -1;
  const s = si >= 0 ? h.slots[si] : undefined;
  return s ? s.offset + s.length : p.layout.bytes;
}

function item(p: PlanPack, start: number, limit: number, step: PlanStep): PlanItem | null {
  if (start < 0 || start >= limit) return null;
  return { key: p.key, start, end: p.bytes.nextHeld(start, limit), step };
}

/** The opening window: header, skeleton and remaining frames through OPENING_LAST_FRAME. */
function openingItem(p: PlanPack): PlanItem | null {
  const h = p.bytes.header;
  // Before the header arrives the window's end is unknown: read on (the
  // stream is stopped as soon as the header shows the window is complete).
  const limit = h ? Math.max(h.skeletonEnd, frameEnd(p, h, OPENING_LAST_FRAME)) : p.layout.bytes;
  const start = p.bytes.firstMissing(0, limit);
  return item(p, start, limit, "opening");
}

/** Highest missing frame of the remaining frames in [from, to] (frame index), -1 if none. */
function lastMissingRestFrame(p: PlanPack, h: PackHeader, from: number, to: number): number {
  for (let f = Math.min(p.count - 1, to); f >= Math.max(0, from); f--) {
    const si = h.slotOf[f] ?? -1;
    if (si < 0) continue;
    const s = h.slots[si]!;
    if (s.offset < h.skeletonEnd) continue;
    if (p.bytes.firstMissing(s.offset, s.offset + s.length) >= 0) return f;
  }
  return -1;
}

/**
 * Where the remaining frames of a film should be read from next, for a
 * visitor at `at` moving in `dir`: forward, the first missing frame at or
 * after `at` (else the skipped ones before it); backward, a run ending at the
 * highest missing frame at or below `at`, starting BEHIND_FRAMES below it
 * (else the ones above).
 */
function restStart(p: PlanPack, h: PackHeader, at: number, dir: 1 | -1): number {
  if (dir > 0) {
    const m = firstMissingRest(p, h, at, p.count - 1);
    return m >= 0 ? m : firstMissingRest(p, h, 0, at - 1);
  }
  const top = lastMissingRestFrame(p, h, 0, at);
  if (top >= 0) return firstMissingRest(p, h, Math.max(0, top - BEHIND_FRAMES), top);
  return firstMissingRest(p, h, at + 1, p.count - 1);
}

/** The remaining frames from `at`, honouring an existing stream unless a re-aim is due. */
function restItem(p: PlanPack, h: PackHeader, at: number, dir: 1 | -1, step: PlanStep, stream: PlanStream | undefined, mayReaim: boolean): PlanItem | null {
  const start = restStart(p, h, at, dir);
  if (start < 0) return null;
  if (stream && stream.pos >= h.skeletonEnd && stream.pos < stream.end) {
    // A stream short of `start` by a few frames, with nothing held in
    // between, reaches it anyway.
    const short = stream.pos <= start && slotAt(h, start) - slotAt(h, stream.pos) <= REACH_FRAMES && p.bytes.nextHeld(stream.pos, start) === start;
    if (short || !mayReaim) return item(p, stream.pos, p.layout.bytes, step);
  }
  return item(p, start, p.layout.bytes, step);
}

/** A skeleton range, merged with the remaining-frames range when that directly follows it. */
function skeletonItem(p: PlanPack, step: PlanStep, then: PlanItem | null, headerless: boolean): PlanItem | null {
  const sk = item(p, p.bytes.firstMissing(0, p.layout.skeletonEnd), p.layout.skeletonEnd, step);
  if (!sk) return null;
  if (sk.end === p.layout.skeletonEnd && then && then.start === p.layout.skeletonEnd) return { ...sk, end: then.end };
  // No header yet: nothing past the skeleton can be held, so whether the
  // rest follows on is the caller's call (`headerless`).
  if (headerless && sk.end === p.layout.skeletonEnd) return { ...sk, end: p.layout.bytes };
  return sk;
}

export function planPacks(input: PlanInput): PlanOutput {
  const { packs, direction: dir, frame } = input;
  const items: PlanItem[] = [];
  const streamOf = (key: string) => input.streams.find((s) => s.key === key);
  const usable = (i: number): PlanPack | null => {
    const p = packs[i];
    return p && !p.blocked ? p : null;
  };

  if (!input.scrolled) {
    const p = usable(0);
    const it = p ? (p.rangeless ? wholeItem(p, "opening") : openingItem(p)) : null;
    if (it) items.push(it);
  } else {
    const A = usable(input.active);
    const N = usable(input.active + dir);
    const first: PlanItem[] = [];
    const later: PlanItem[] = [];
    for (const [p, role] of [
      [A, "active"],
      [N, "neighbour"],
    ] as const) {
      if (!p) continue;
      if (p.rangeless) {
        const w = wholeItem(p, role === "active" ? "skeleton" : "neighbour-skeleton");
        if (w) first.push(w);
        continue;
      }
      const h = p.bytes.header;
      const active = role === "active";
      const skelStep: PlanStep = active ? "skeleton" : "neighbour-skeleton";
      if (input.constrained) {
        const sk = item(p, p.bytes.firstMissing(0, p.layout.skeletonEnd), p.layout.skeletonEnd, skelStep);
        if (sk) first.push(sk);
        else if (active && input.settled && h) {
          // One bounded request for the missing frames of the wanted window.
          const lo = Math.max(0, Math.min(input.lo, frame));
          const hi = Math.min(p.count - 1, Math.max(input.hi, frame));
          const w = item(p, firstMissingRest(p, h, lo, hi), frameEnd(p, h, hi), "window");
          if (w) first.push(w);
        }
        continue;
      }
      // Where the visitor needs the remaining frames first: from the playhead
      // (active), from the entry point (neighbour: its start when scrolling
      // down, its end when scrolling up); a little behind when scrolling up.
      const entry = active ? frame : dir > 0 ? 0 : p.count - 1;
      const mayReaim = active ? dir < 0 || input.jumped || input.settled : dir < 0;
      const rest = h ? restItem(p, h, entry, dir, active ? "rest" : "neighbour-rest", streamOf(p.key), mayReaim) : null;
      // No header yet: the rest follows the skeleton only for a visitor at the film's start.
      const sk = skeletonItem(p, skelStep, rest, !h && dir > 0 && entry <= REACH_FRAMES);
      if (sk) first.push(sk);
      else if (rest) later.push(rest);
    }
    items.push(...first, ...later);
  }

  // One stream per pack, in priority order, at most maxStreams.
  const keep: number[] = [];
  const open: PlanItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.key)) continue;
    seen.add(it.key);
    if (keep.length + open.length >= input.maxStreams) break;
    const s = streamOf(it.key);
    const p = packs.find((q) => q?.key === it.key);
    // A stream already reading this range goes on (a whole-file stream on a
    // server that ignores Range goes on wherever it is).
    if (s && s.pos < s.end && (s.pos === it.start || p?.rangeless)) {
      keep.push(s.id);
      continue;
    }
    if (input.hidden) continue;
    open.push(it);
  }
  const stop = input.streams.filter((s) => !keep.includes(s.id)).map((s) => s.id);
  return { keep, stop, open, items };
}

/** A pack whose server ignores Range: one stream for the whole file, from 0. */
function wholeItem(p: PlanPack, step: PlanStep): PlanItem | null {
  if (p.bytes.firstMissing(0, p.layout.bytes) < 0) return null;
  return { key: p.key, start: 0, end: p.layout.bytes, step };
}
