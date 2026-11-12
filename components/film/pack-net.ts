/**
 * PackNet — the film worker's network controller. It holds every pack's
 * bytes (PackBytes), runs the plan (pack-plan.ts) whenever something changes
 * (the visitor moved, a chunk landed, a stream ended, a backoff ran out) and
 * opens or stops Range streams to match. Environment-free (fetch, clock and
 * the event sink are injected) so it runs under tsx with a fake server.
 *
 * Streams: `fetch` with `Range: bytes=N-` (open-ended) or `bytes=N-M`, read
 * through the body's ReadableStream; every chunk is cut into frames as it
 * lands (any chunk boundary). A stream can be stopped at any byte; the next
 * one starts at the first byte not held.
 *
 * Responses: 206 must start where asked and carry the timeline's total; a
 * 200 (server ignores Range) is read from byte 0, its bytes already held are
 * discarded (and counted as repeated) and the pack is read whole from then
 * on; a length or header that disagrees with the timeline, a 404/410 or a 416
 * makes the pack unusable at once. Any other failure (network error, 403,
 * 429, 5xx, a body that ends early) is retried after 400 ms, 800 ms, 1.6 s;
 * a fourth failure in a row makes the pack unusable. Unusable = `failed`
 * event: the page loads that variant frame by frame for the rest of the
 * page view.
 *
 * Frames whose bytes are held but will not decode (`decodeFailed`, from the
 * worker's createImageBitmap) count against their pack: the third failure
 * makes it unusable the same way, instead of retrying the same bytes.
 *
 * Bytes are capped (`capBytes`: 48 MB on phones, 160 MB otherwise). Over the
 * cap, the variant farthest from the active film loses frames first (from
 * the end of its file); the active film, the neighbour being prepared, any
 * pack with an open stream and the dissolve pin's frame never do.
 *
 * Position. The playhead's film and frame come with every `where`. The
 * direction flips only after DIRECTION_FRAMES of travel against it, counted
 * across film cuts too (a cut is one frame of travel). Crossing a cut (not a
 * jump) holds the two films at that cut while the playhead stays fewer than
 * DIRECTION_FRAMES frames from it on either side, however long it pauses and
 * whichever way it goes: the film the plan works from (`active`) stays the
 * one the playhead came from and the neighbour is the other film at the cut.
 * So a playhead wobbling across a cut, with pauses or not, keeps the same two
 * films and the same streams instead of swapping them on every crossing or
 * stop. Past that zone, or on a jump, `active` is the playhead's film again.
 * One exception on constrained connections: a stop in the other film makes
 * it `active` (still paired with the film across the cut), since only the
 * active film's wanted window is read there.
 */

import type { PackLayout } from "./pack-format";
import { planPacks, type PlanPack, type PlanStream } from "./pack-plan";
import { PackBytes } from "./pack-store";

export type NetClock = {
  now: () => number;
  /** Run `fn` once after `ms`; returns a cancel function. */
  later: (fn: () => void, ms: number) => () => void;
};

export type NetFetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

export type NetPack = {
  key: string;
  url: string;
  layout: PackLayout;
  count: number;
  film: number;
  /** The pack failed earlier in this page view (the page loads it frame by frame): never read. */
  failed?: boolean;
};

export type NetWhere = {
  /** Key of the active film's pack in the current view (null: not a pack variant). */
  key: string | null;
  frame: number;
  direction: 1 | -1;
  lo: number;
  hi: number;
  scrolled: boolean;
  hidden: boolean;
  constrained: boolean;
  /** The dissolve pin (the previous film's last frame) while its bytes are wanted; null = none. */
  pin?: { key: string; frame: number } | null;
};

export type PackProgress = { held: number; total: number; skeleton: boolean };

export type NetStats = {
  packRequests: number;
  packBytes: number;
  packBytesRepeated: number;
  packBytesHeld: number;
  packReaims: number;
  progress: Record<string, PackProgress>;
};

export type NetEvent =
  | { t: "frames"; key: string; added: number[]; removed: number[] }
  | { t: "failed"; key: string; reason: string }
  | { t: "stats"; stats: NetStats };

/** No playhead change for this long = settled (constrained window, re-aim on stop). */
export const SETTLE_MS = 300;
/** A playhead step this large in one decision is a jump (anchor, flick). */
export const JUMP_FRAMES = 24;
/** The neighbour flips with the scroll direction only after this many frames of travel. */
export const DIRECTION_FRAMES = 8;
const RETRY_MS = [400, 800, 1600];
/** Frames of a pack that would not decode from held bytes before the pack is unusable. */
export const DECODE_FAILURES_MAX = 3;
const STATS_EVERY_MS = 250;

type Entry = {
  pack: NetPack;
  store: PackBytes;
  rangeless: boolean;
  failed: string | null;
  attempts: number;
  retryAt: number;
  decodeFailures: number;
};

type Stream = PlanStream & { ctrl: AbortController; stopped: boolean };

export class PackNet {
  readonly stats: NetStats = { packRequests: 0, packBytes: 0, packBytesRepeated: 0, packBytesHeld: 0, packReaims: 0, progress: {} };
  private readonly entries = new Map<string, Entry>();
  private reel: string[] = [];
  private readonly streams = new Map<number, Stream>();
  private nextId = 1;
  private where: NetWhere | null = null;
  /** The playhead's film (reel index; -1 = not a pack film of this reel). */
  private film = -1;
  /** The film the plan works from: the playhead's, or the one it just left (see the file header). */
  private active = -1;
  private dir: 1 | -1 = 1;
  /** The cut held after a crossing (between films `cut` and `cut + 1`); -1 = none (see the file header). */
  private cut = -1;
  /** Travel (frames), continuous across adjacent films; `anchor` = where the direction was last confirmed. */
  private pos = 0;
  private anchor = 0;
  private lastMove = 0;
  private jumped = false;
  private cancelSettle: (() => void) | null = null;
  private cancelRetry: (() => void) | null = null;
  private cancelStats: (() => void) | null = null;
  private retryAt = Infinity;
  private statsAt = -Infinity;
  private planning = false;
  private replan = false;
  private disposed = false;

  constructor(
    private readonly io: { fetch: NetFetch; clock: NetClock; emit: (e: NetEvent) => void },
    private readonly capBytes: number,
    private readonly maxStreams = 2,
  ) {}

  /** The reel's packs for the current view, in film order. Bytes of other packs stay (subject to the cap). */
  setPacks(list: NetPack[]) {
    this.reel = [];
    for (const p of list) {
      // A failed pack keeps its place in the reel (the visitor on that film
      // still has a neighbour) but is never read.
      this.reel[p.film] = p.key;
      let e = this.entries.get(p.key);
      if (!e) {
        e = { pack: p, store: new PackBytes(p.key, p.layout, p.count), rangeless: false, failed: null, attempts: 0, retryAt: 0, decodeFailures: 0 };
        this.entries.set(p.key, e);
      }
      if (p.failed && !e.failed) this.markUnusable(e, "failed earlier in this page view", false);
    }
    this.plan();
  }

  /**
   * A held frame of `key` would not decode. The DECODE_FAILURES_MAX-th makes
   * the pack unusable (the page loads that variant frame by frame).
   */
  decodeFailed(key: string) {
    const e = this.entries.get(key);
    if (!e || e.failed) return;
    e.decodeFailures++;
    if (e.decodeFailures >= DECODE_FAILURES_MAX) this.markUnusable(e, `${e.decodeFailures} frames would not decode`, true);
  }

  setWhere(w: NetWhere) {
    const now = this.io.clock.now();
    const idx = w.key ? this.reel.indexOf(w.key) : -1;
    const prev = this.where;
    const delta = prev && idx >= 0 && this.film >= 0 ? this.travel(this.film, prev.frame, idx, w.frame) : null;
    if (delta === null) {
      // The first position, a film without a pack, or more than one film
      // away: start over from the visitor's own direction.
      if (!prev || idx !== this.film || prev.frame !== w.frame) this.lastMove = now;
      if (prev && this.film >= 0 && idx >= 0) this.jumped = true;
      this.pos = 0;
      this.anchor = 0;
      this.dir = w.direction;
      this.active = idx;
      this.cut = -1;
    } else if (delta !== 0) {
      // Direction with hysteresis: a small bounce (within a film or across
      // a cut) does not swap the neighbour.
      this.pos += delta;
      const d = this.pos - this.anchor;
      if (Math.sign(d) === this.dir) this.anchor = this.pos;
      else if (Math.abs(d) >= DIRECTION_FRAMES) {
        this.dir = d > 0 ? 1 : -1;
        this.anchor = this.pos;
      }
      if (Math.abs(delta) >= JUMP_FRAMES) this.jumped = true;
      // A crossing (not a jump) from the film the plan works from holds that cut.
      else if (idx !== this.film && (this.active === idx || this.active === this.film)) this.cut = Math.min(idx, this.film);
      this.lastMove = now;
    }
    this.film = idx;
    this.where = w;
    this.cancelSettle?.();
    this.cancelSettle = this.io.clock.later(() => {
      this.cancelSettle = null;
      this.plan();
    }, SETTLE_MS);
    this.plan();
  }

  /** A complete frame's bytes, else null. */
  frame(key: string, index: number): Uint8Array | null {
    return this.entries.get(key)?.store.frame(index) ?? null;
  }

  dispose() {
    this.disposed = true;
    for (const s of this.streams.values()) this.stopStream(s);
    this.cancelSettle?.();
    this.cancelRetry?.();
    this.cancelStats?.();
  }

  private plan() {
    if (this.disposed || !this.where) return;
    // A plan triggered from inside a plan (a stream stopping synchronously)
    // runs once the current one is done.
    if (this.planning) {
      this.replan = true;
      return;
    }
    this.planning = true;
    try {
      do {
        this.replan = false;
        this.planOnce();
      } while (this.replan);
    } finally {
      this.planning = false;
    }
  }

  /** Frames of travel from (film fa, frame a) to (film fb, frame b); null when not the same or adjacent films. */
  private travel(fa: number, a: number, fb: number, b: number): number | null {
    if (fa === fb) return b - a;
    if (Math.abs(fb - fa) !== 1) return null;
    const ca = this.countOf(fa);
    const cb = this.countOf(fb);
    if (!ca || !cb) return null;
    // Crossing a cut is one frame of travel: last frame → first frame.
    return fb > fa ? ca - a + b : -(a + (cb - b));
  }

  private countOf(film: number): number {
    const key = this.reel[film];
    return key ? (this.entries.get(key)?.pack.count ?? 0) : 0;
  }

  /**
   * The film the plan works from: the playhead's, except while a crossed cut
   * is held (the playhead fewer than DIRECTION_FRAMES frames from it on
   * either side, no jump since): then the film it came from, whatever the
   * direction and however long it pauses (see the file header).
   */
  private followFilm(now: number) {
    const f = this.film;
    const c = this.cut;
    if (c >= 0) {
      const w = this.where!;
      const depth = f === c ? this.countOf(c) - 1 - w.frame : f === c + 1 ? w.frame : Infinity;
      if (this.jumped || depth >= DIRECTION_FRAMES || (this.active !== c && this.active !== c + 1)) this.cut = -1;
      else {
        // Constrained: only the active film's window is read on a stop, so
        // a stop in the other film of the pair makes it the active one.
        if (w.constrained && now - this.lastMove >= SETTLE_MS) this.active = f;
        return;
      }
    }
    this.active = f;
  }

  /** The plan's direction: towards the other film of a held cut, else the visitor's (with hysteresis). */
  private planDir(): 1 | -1 {
    if (this.cut >= 0 && (this.active === this.cut || this.active === this.cut + 1)) return this.active === this.cut ? 1 : -1;
    return this.dir;
  }

  private planOnce() {
    const w = this.where!;
    const now = this.io.clock.now();
    this.followFilm(now);
    const packs: Array<PlanPack | null> = this.reel.map((key) => {
      const e = key ? this.entries.get(key) : undefined;
      if (!e) return null;
      return { key, count: e.pack.count, layout: e.pack.layout, bytes: e.store, rangeless: e.rangeless, blocked: !!e.failed || e.retryAt > now };
    });
    // The playhead in the film the plan works from, or (just past a cut) that
    // film's edge towards it.
    const inActive = this.film === this.active;
    const frame = inActive ? w.frame : this.film > this.active ? Math.max(0, this.countOf(this.active) - 1) : 0;
    const pinFilm = w.pin ? this.reel.indexOf(w.pin.key) : -1;
    const out = planPacks({
      packs,
      active: this.active,
      frame,
      direction: this.planDir(),
      lo: inActive ? w.lo : frame,
      hi: inActive ? w.hi : frame,
      scrolled: w.scrolled,
      constrained: w.constrained,
      settled: now - this.lastMove >= SETTLE_MS,
      jumped: this.jumped,
      hidden: w.hidden,
      streams: [...this.streams.values()].map(({ id, key, pos, end }) => ({ id, key, pos, end })),
      maxStreams: this.maxStreams,
      pin: w.pin && pinFilm >= 0 ? { pack: pinFilm, frame: w.pin.frame } : null,
    });
    for (const id of out.stop) {
      const s = this.streams.get(id);
      if (s) this.stopStream(s);
    }
    const activeKey = this.reel[this.active];
    for (const it of out.open) {
      if (it.key === activeKey && it.step === "rest" && out.stop.length) this.stats.packReaims++;
      this.openStream(it.key, it.start, it.end);
    }
    // The jump is handled once the active film's remaining frames were planned.
    if (this.jumped && !out.items.some((it) => it.key === activeKey && (it.step === "skeleton" || it.step === "opening"))) this.jumped = false;
    this.scheduleRetry(now);
  }

  private scheduleRetry(now: number) {
    let next = Infinity;
    for (const e of this.entries.values()) if (!e.failed && e.retryAt > now) next = Math.min(next, e.retryAt);
    if (next === this.retryAt) return;
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.retryAt = next;
    if (next < Infinity) {
      this.cancelRetry = this.io.clock.later(() => {
        this.cancelRetry = null;
        this.retryAt = Infinity;
        this.plan();
      }, next - now);
    }
  }

  private stopStream(s: Stream) {
    if (s.stopped) return;
    s.stopped = true;
    this.streams.delete(s.id);
    s.ctrl.abort();
    this.emitStats(false);
  }

  private openStream(key: string, start: number, end: number) {
    const e = this.entries.get(key);
    if (!e) return;
    const s: Stream = { id: this.nextId++, key, pos: start, end, ctrl: new AbortController(), stopped: false };
    this.streams.set(s.id, s);
    this.stats.packRequests++;
    void this.run(s, e).catch(() => {
      // run() handles its own failures; this only keeps a bug from becoming
      // an unhandled rejection.
      this.stopStream(s);
    });
  }

  private async run(s: Stream, e: Entry) {
    const total = e.pack.layout.bytes;
    const range = s.end >= total ? `bytes=${s.pos}-` : `bytes=${s.pos}-${s.end - 1}`;
    let res: Response;
    try {
      res = await this.io.fetch(e.pack.url, { headers: { Range: range }, signal: s.ctrl.signal });
    } catch {
      if (!s.stopped) this.retry(s, e, "network error");
      return;
    }
    if (s.stopped) return void res.body?.cancel().catch(() => {});
    if (res.status === 404 || res.status === 410 || res.status === 416) return this.fail(s, e, `pack answered ${res.status}`);
    if (res.status === 206) {
      const m = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(res.headers.get("content-range") ?? "");
      if (!m || Number(m[1]) !== s.pos) return this.fail(s, e, `206 for ${range} came back as "${res.headers.get("content-range")}"`);
      if (m[3] !== "*" && Number(m[3]) !== total) return this.fail(s, e, `pack is ${m[3]} bytes, the timeline says ${total}`);
    } else if (res.status === 200) {
      const len = res.headers.get("content-length");
      if (len !== null && Number(len) !== total) return this.fail(s, e, `pack is ${len} bytes, the timeline says ${total}`);
      // The body starts at byte 0. Asked for a later byte, the server
      // ignored Range: from now on this pack is read whole, from 0.
      if (s.pos > 0) e.rangeless = true;
      s.pos = 0;
      s.end = total;
    } else {
      return this.retry(s, e, `pack answered ${res.status}`);
    }
    if (!res.body) return this.fail(s, e, "no response body");
    const reader = res.body.getReader();
    try {
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          if (!s.stopped) this.retry(s, e, "body read error");
          return;
        }
        if (s.stopped) return;
        if (chunk.done) break;
        if (!this.take(s, e, chunk.value)) return;
        if (s.pos >= s.end) break;
      }
    } finally {
      if (s.stopped) reader.cancel().catch(() => {});
    }
    if (s.stopped) return;
    this.streams.delete(s.id);
    if (s.pos < s.end) {
      // The body ended early: what arrived is kept, the rest is retried.
      this.retry(s, e, "body ended early");
      return;
    }
    this.plan();
    this.emitStats(true);
  }

  /** One chunk landed. False when the stream is over (stopped or the pack failed). */
  private take(s: Stream, e: Entry, chunk: Uint8Array): boolean {
    const st = e.store;
    const heldBefore = st.heldBytes;
    const repeatedBefore = st.repeatedBytes;
    const r = st.write(s.pos, chunk);
    s.pos += chunk.length;
    this.stats.packBytes += chunk.length;
    this.stats.packBytesRepeated += st.repeatedBytes - repeatedBefore;
    this.stats.packBytesHeld += st.heldBytes - heldBefore;
    if (r.error) {
      this.fail(s, e, r.error);
      return false;
    }
    e.attempts = 0;
    const removed = this.evict();
    if (r.completed.length) this.io.emit({ t: "frames", key: e.pack.key, added: r.completed, removed: [] });
    for (const [key, idx] of removed) this.io.emit({ t: "frames", key, added: [], removed: idx });
    this.emitStats(false);
    this.plan();
    return !s.stopped;
  }

  private retry(s: Stream, e: Entry, why: string) {
    this.stopStream(s);
    e.attempts++;
    if (e.attempts > RETRY_MS.length) {
      this.fail(s, e, `${why}, ${e.attempts} times`);
      return;
    }
    e.retryAt = this.io.clock.now() + RETRY_MS[e.attempts - 1]!;
    this.plan();
  }

  private fail(s: Stream, e: Entry, reason: string) {
    this.stopStream(s);
    this.markUnusable(e, reason, true);
  }

  /** The pack is unusable for the rest of the page view: streams stopped, bytes dropped. */
  private markUnusable(e: Entry, reason: string, announce: boolean) {
    if (e.failed) return;
    e.failed = reason;
    for (const t of [...this.streams.values()]) if (t.key === e.pack.key) this.stopStream(t);
    // The page loads this variant frame by frame now: its bytes are useless.
    const dropped = e.store.heldFrames();
    const before = e.store.heldBytes;
    const h = e.store.header;
    if (h) for (let si = 0; si < h.slots.length; si++) e.store.dropSlot(si);
    this.stats.packBytesHeld -= before - e.store.heldBytes;
    if (announce) {
      if (dropped.length) this.io.emit({ t: "frames", key: e.pack.key, added: [], removed: dropped });
      this.io.emit({ t: "failed", key: e.pack.key, reason });
    }
    this.emitStats(true);
    this.plan();
  }

  /** Over the cap: drop frames of the variant farthest from the active film. */
  private evict(): Array<[string, number[]]> {
    const out: Array<[string, number[]]> = [];
    if (this.stats.packBytesHeld <= this.capBytes) return out;
    const keep = new Set<string>();
    if (this.active >= 0) {
      const a = this.reel[this.active];
      const n = this.reel[this.active + this.planDir()];
      if (a) keep.add(a);
      if (n) keep.add(n);
    }
    const f = this.film >= 0 ? this.reel[this.film] : undefined;
    if (f) keep.add(f);
    for (const s of this.streams.values()) keep.add(s.key);
    const pin = this.where?.pin;
    const victims = [...this.entries.values()]
      .filter((e) => !keep.has(e.pack.key) && e.store.heldBytes > 0)
      .map((e) => {
        const at = this.reel.indexOf(e.pack.key);
        return { e, dist: at < 0 || this.active < 0 ? Infinity : Math.abs(at - this.active) };
      })
      .sort((x, y) => y.dist - x.dist);
    for (const { e } of victims) {
      const h = e.store.header;
      const dropped: number[] = [];
      if (h) {
        for (let si = h.slots.length - 1; si >= 0 && this.stats.packBytesHeld > this.capBytes; si--) {
          // The dissolve pin's frame stays.
          if (pin && pin.key === e.pack.key && h.slots[si]!.index === pin.frame) continue;
          const complete = e.store.held(h.slots[si]!.index);
          const freed = e.store.dropSlot(si);
          this.stats.packBytesHeld -= freed;
          if (freed && complete) dropped.push(h.slots[si]!.index);
        }
      }
      if (dropped.length) out.push([e.pack.key, dropped]);
      if (this.stats.packBytesHeld <= this.capBytes) break;
    }
    return out;
  }

  private emitStats(force: boolean) {
    const now = this.io.clock.now();
    if (!force && now - this.statsAt < STATS_EVERY_MS) {
      // Throttled: one trailing report, so the page never keeps stale numbers.
      this.cancelStats ??= this.io.clock.later(() => {
        this.cancelStats = null;
        this.emitStats(true);
      }, STATS_EVERY_MS - (now - this.statsAt));
      return;
    }
    this.cancelStats?.();
    this.cancelStats = null;
    this.statsAt = now;
    const progress: Record<string, PackProgress> = {};
    for (const e of this.entries.values()) {
      progress[e.pack.key] = {
        held: e.store.heldBytes,
        total: e.pack.layout.bytes,
        skeleton: e.store.firstMissing(0, e.pack.layout.skeletonEnd) < 0,
      };
    }
    this.stats.progress = progress;
    this.io.emit({ t: "stats", stats: { ...this.stats } });
  }
}
