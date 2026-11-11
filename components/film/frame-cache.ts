/**
 * Frame loading for the film reel: one scheduler (FrameBudget) for the whole
 * page, one FrameCache of decoded frames per film variant.
 *
 * The model. On every scroll decision the loop hands the budget ONE plan
 * (`want`): the active film's playhead, the previous film's last frame while
 * the dissolve can still draw it, and the next film's opening. The budget
 * turns that into one WANTED SET whose decoded size fits in about 80% of the
 * budget, ordered nearest-first in the scroll direction. Loads start only for
 * wanted frames: at most 4 fetches and 2 (small budget) or 4 decodes at a
 * time. A fetch that has started always completes and its compressed bytes
 * are kept in a byte-capped store, so a frame is fetched once per page and
 * decoded again from those bytes when the visitor comes back. A decode
 * reserves its decoded size when it starts. Eviction removes only frames
 * OUTSIDE the wanted set, farthest from the playhead first, so a new far frame
 * can never push out a near one (the churn behind 10,000+ requests per pass
 * before this rewrite).
 *
 * `nearest` returns the closest decoded frame at or below the requested
 * index (else above, else the poster), so the canvas always has something to
 * draw while the exact frame is in flight. `window.__filmStats` (FilmStats)
 * counts fetches, refetches, decodes and draw accuracy.
 */

import type { FilmVariant } from "./types";

export type Drawable = ImageBitmap | HTMLImageElement;

export function frameUrl(variant: FilmVariant, index: number): string {
  const n = String(index + 1).padStart(variant.pad, "0");
  return `${variant.base}/f_${n}.${variant.ext}${variant.v ? `?v=${variant.v}` : ""}`;
}

/** Network + decode, injectable so the scheduler runs under node with fakes. */
export type FrameIO = {
  /** Fetch one frame's compressed bytes; rejects on a non-OK response. */
  fetchBlob: (url: string) => Promise<Blob>;
  /** Decode compressed bytes into something drawImage accepts. */
  decode: (blob: Blob) => Promise<Drawable>;
};

async function decodeWithImage(blob: Blob): Promise<HTMLImageElement> {
  // No createImageBitmap (old Safari): decode through an <img> on an object URL.
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Time source for retry backoff, injectable so tests drive it by hand. */
export type FrameClock = {
  now: () => number;
  /** Run `fn` once after `ms` milliseconds. */
  later: (fn: () => void, ms: number) => void;
};

const systemClock: FrameClock = {
  now: () => Date.now(),
  later: (fn, ms) => {
    setTimeout(fn, ms);
  },
};

export const browserFrameIO: FrameIO = {
  async fetchBlob(url) {
    // Frame URLs carry ?v=<version>, so the default cache policy is safe: a
    // re-encode changes the URL and never serves stale frames.
    const res = await fetch(url);
    if (!res.ok) throw new Error(`frame ${url} ${res.status}`);
    return res.blob();
  },
  decode(blob) {
    if (typeof createImageBitmap === "function") return createImageBitmap(blob);
    return decodeWithImage(blob);
  },
};

/**
 * Hot-path counters, published as `window.__filmStats` (production too) and
 * shown by the `?hud=1` overlay. Plain numbers, and the mode string.
 */
export type FilmStats = {
  /** Per-frame network fetches started (the per-frame path only; packs are counted below). */
  fetches: number;
  /** Per-frame network fetches for a frame whose bytes this page had already fetched. */
  refetches: number;
  decodes: number;
  /** Decodes of a frame decoded before (from held bytes, after an eviction). */
  redecodes: number;
  /** Canvas paints that drew the exact wanted frame. */
  exactDraws: number;
  /** Canvas paints that drew a neighbour or the poster instead. */
  fallbackDraws: number;
  /** Sum over fallback draws of |drawn index − wanted index| (poster = frame 0). */
  fallbackDistanceSum: number;
  evictions: number;
  maxFetchInFlight: number;
  maxDecodeInFlight: number;
  /** Live gauges and the limits they run under. */
  fetchInFlight: number;
  decodeInFlight: number;
  fetchLimit: number;
  decodeLimit: number;
  /** Scrub loop (use-scrub-loop.ts): canvas backing-store reallocations. */
  canvasResizes: number;
  /** Scrub loop: segment geometry reads (one getBoundingClientRect per segment). */
  geometryMeasures: number;
  /** Scrub loop: animation frames that did work, and frames that found nothing changed. */
  ticksWorked: number;
  ticksSkipped: number;
  /** How the ACTIVE variant loads: "pack" (worker, one stream per film) or "frames" (one request per frame). */
  mode: "pack" | "frames";
  /** Pack range requests the worker opened. */
  packRequests: number;
  /** Pack bytes received. */
  packBytes: number;
  /** Pack bytes received for a range already held (must stay 0). */
  packBytesRepeated: number;
  /** Pack bytes the worker holds now (all variants). */
  packBytesHeld: number;
  /** Pack streams stopped and reopened at the playhead. */
  packReaims: number;
  /** Variants that fell back from their pack to frames (404, unusable, worker failure). */
  packFallbacks: number;
  /** The active film's pack: share of its bytes held (0–1) and whether its skeleton is complete (0/1). */
  packHeldShare: number;
  packSkeleton: number;
  /** Decodes in the worker, and their time there (ms). */
  workerDecodes: number;
  workerDecodeMeanMs: number;
  workerDecodeMaxMs: number;
  /**
   * Decodes started from the page (the per-frame path: createImageBitmap or
   * <img>; WebKit decodes these on the main thread), and the time until the
   * picture was ready (ms).
   */
  mainThreadDecodes: number;
  mainThreadDecodeMeanMs: number;
  mainThreadDecodeMaxMs: number;
  /** Last canvas paint: the frame wanted and the frame drawn (-1 = the poster or nothing). */
  drawWant: number;
  drawAt: number;
};

export function newFilmStats(fetchLimit = 0, decodeLimit = 0): FilmStats {
  return {
    fetches: 0,
    refetches: 0,
    decodes: 0,
    redecodes: 0,
    exactDraws: 0,
    fallbackDraws: 0,
    fallbackDistanceSum: 0,
    evictions: 0,
    maxFetchInFlight: 0,
    maxDecodeInFlight: 0,
    fetchInFlight: 0,
    decodeInFlight: 0,
    fetchLimit,
    decodeLimit,
    canvasResizes: 0,
    geometryMeasures: 0,
    ticksWorked: 0,
    ticksSkipped: 0,
    mode: "frames",
    packRequests: 0,
    packBytes: 0,
    packBytesRepeated: 0,
    packBytesHeld: 0,
    packReaims: 0,
    packFallbacks: 0,
    packHeldShare: 0,
    packSkeleton: 0,
    workerDecodes: 0,
    workerDecodeMeanMs: 0,
    workerDecodeMaxMs: 0,
    mainThreadDecodes: 0,
    mainThreadDecodeMeanMs: 0,
    mainThreadDecodeMaxMs: 0,
    drawWant: -1,
    drawAt: -1,
  };
}

/** Fold one decode time into a mean / max pair of counters. */
export function recordDecode(s: FilmStats, where: "worker" | "main", ms: number) {
  if (where === "worker") {
    s.workerDecodes++;
    s.workerDecodeMeanMs += (ms - s.workerDecodeMeanMs) / s.workerDecodes;
    if (ms > s.workerDecodeMaxMs) s.workerDecodeMaxMs = ms;
  } else {
    s.mainThreadDecodes++;
    s.mainThreadDecodeMeanMs += (ms - s.mainThreadDecodeMeanMs) / s.mainThreadDecodes;
    if (ms > s.mainThreadDecodeMaxMs) s.mainThreadDecodeMaxMs = ms;
  }
}

/** Identity of a variant's bytes: folder name plus pack (else frame) version. */
export function variantKey(v: FilmVariant): string {
  return `${v.name}@${v.pack?.v ?? v.v ?? "0"}`;
}

/**
 * Pack mode (pack-client.ts, the film worker). A variant served from its
 * pack has its compressed bytes in the worker: a frame is either held there
 * (decodable now, in the worker) or not yet (not loadable: it takes no slot).
 * Injectable so the scheduler runs under node with a fake.
 */
export type PackSource = {
  /** True while `variant` is loaded from its pack; false = the per-frame path. */
  serves(variant: FilmVariant): boolean;
  /** The frame's compressed bytes are held by the worker. */
  holds(variant: FilmVariant, index: number): boolean;
  /** Decode a held frame in the worker. Rejects when its bytes are gone or the pack failed. */
  decode(variant: FilmVariant, index: number): Promise<{ bitmap: ImageBitmap; ms: number }>;
  /** Where the visitor is: once per scroll decision (the strong plan). */
  where(at: { variant: FilmVariant; frame: number; direction: 1 | -1; lo: number; hi: number }): void;
  /** Frames of `variant` arrived (`added`), or its mode changed (null: it fell back to frames). */
  subscribe(fn: (variant: FilmVariant, added: readonly number[] | null) => void): () => void;
};

/** One scroll decision. */
export type FramePlan = {
  /** The film on screen: a window around `center`, ~70% toward `direction`. */
  active: { cache: FrameCache; center: number; direction: 1 | -1 };
  /**
   * The previous film's last frame: the dissolve draws it under the active
   * film's frames below `until`. Wanted while the window can reach them.
   */
  pin?: { cache: FrameCache; index: number; until: number } | undefined;
  /** The next film: its opening frames (a bounded count). */
  next?: FrameCache | undefined;
};

type Wanted = { cache: FrameCache; index: number; url: string };

const MB = 1024 * 1024;
const FETCH_LIMIT = 4;
const HEADROOM = 0.8;
const AHEAD_SHARE = 0.7;
const NEXT_HEAD_MAX = 12;
const NEXT_HEAD_SHARE = 0.3;
/**
 * A failed fetch or decode (rate limiter 403/429, 5xx, a dropped connection)
 * is retried while the frame stays wanted, after 400 ms, 800 ms, ... capped
 * at 4 s, so a parked visitor recovers once the network does without the
 * reel hammering a server that is refusing it.
 */
const RETRY_BASE_MS = 400;
const RETRY_MAX_MS = 4000;
/** Budgets below this are "small" (phones): fewer decodes, smaller blob store. */
const SMALL_BUDGET = 256 * MB;

function drawableBytes(d: Drawable): number {
  const w = "naturalWidth" in d ? d.naturalWidth || d.width : d.width;
  const h = "naturalHeight" in d ? d.naturalHeight || d.height : d.height;
  return w * h * 4;
}

function frameBytes(v: FilmVariant): number {
  return v.width * v.height * 4;
}

/**
 * FrameBudget — the decoded-byte budget AND the load scheduler shared by every
 * FrameCache on the page (see the file header for the model).
 */
export class FrameBudget {
  readonly stats: FilmStats;
  readonly maxFetches: number;
  readonly maxDecodes: number;
  readonly blobLimitBytes: number;

  private used = 0;
  private reserved = 0;
  private readonly caches = new Set<FrameCache>();
  private plan: FramePlan | null = null;
  private planWeak = true;
  private order: Wanted[] = [];
  private readonly wantedKeys = new Map<FrameCache, Set<number>>();
  private readonly wantedUrls = new Map<string, Wanted>();
  // Everything below is keyed by frame URL, not by cache: a cache re-created
  // for the same film (React StrictMode remount, orientation flip back) finds
  // the bytes it already has and the fetches already on the wire.
  /** Compressed bytes, least recently used first (Map insertion order). */
  private readonly blobs = new Map<string, { blob: Blob; bytes: number }>();
  private blobUsed = 0;
  private readonly fetchingUrls = new Set<string>();
  /** URLs whose bytes this page has fetched / has decoded. */
  private readonly fetchedEver = new Set<string>();
  private readonly decodedEver = new Set<string>();
  /**
   * Frames whose last fetch or decode failed, with the time a retry is due
   * (backoff, see RETRY_BASE_MS). Retried while still wanted once due; the
   * entry is forgotten when the frame decodes or leaves the wanted set.
   */
  private readonly failed = new Map<string, { attempts: number; retryAt: number }>();
  /** When the pending retry wake-up fires (Infinity = none pending). */
  private wakeAt = Infinity;
  private readonly listeners = new Set<(cache: FrameCache, index: number) => void>();

  constructor(
    public readonly limitBytes: number,
    private readonly io: FrameIO = browserFrameIO,
    private readonly clock: FrameClock = systemClock,
  ) {
    const small = limitBytes < SMALL_BUDGET;
    this.maxFetches = FETCH_LIMIT;
    this.maxDecodes = small ? 2 : 4;
    this.blobLimitBytes = (small ? 24 : 96) * MB;
    this.stats = newFilmStats(this.maxFetches, this.maxDecodes);
  }

  get usedBytes(): number {
    return this.used;
  }

  /** Decoded bytes reserved by decodes still in flight. */
  get reservedBytes(): number {
    return this.reserved;
  }

  get blobBytes(): number {
    return this.blobUsed;
  }

  /** Decoded frames held, across all caches. */
  get count(): number {
    let n = 0;
    for (const c of this.caches) n += c.size;
    return n;
  }

  /** The current wanted set, in load order. */
  wanted(): Wanted[] {
    return this.order.slice();
  }

  isWanted(cache: FrameCache, index: number): boolean {
    return this.wantedKeys.get(cache)?.has(index) ?? false;
  }

  hasBlob(cache: FrameCache, index: number): boolean {
    return this.blobs.has(frameUrl(cache.variant, index));
  }

  /** Frames of `variant` that fit in the budget, and the share the wanted set may use. */
  capacity(variant: FilmVariant): { frames: number; usable: number } {
    const frames = Math.floor(this.limitBytes / frameBytes(variant));
    return { frames, usable: Math.max(1, Math.floor(frames * HEADROOM)) };
  }

  /** Listen for decoded frames landing in any cache (index -1 = a poster). */
  subscribe(fn: (cache: FrameCache, index: number) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** @internal FrameCache → budget. */
  register(cache: FrameCache) {
    this.caches.add(cache);
  }

  /** @internal FrameCache → listeners. */
  emit(cache: FrameCache, index: number) {
    for (const fn of this.listeners) fn(cache, index);
  }

  /**
   * Replace the wanted set. A `weak` plan (mount warm-up) applies only until
   * the scroll loop has made its first decision; it never overrides one.
   */
  want(plan: FramePlan, opts: { weak?: boolean } = {}) {
    const weak = opts.weak === true;
    if (weak && this.plan && !this.planWeak) return;
    if (plan.active.cache.disposed) return;
    this.plan = plan;
    this.planWeak = weak;
    this.order = this.buildOrder(plan);
    this.indexWanted();
    for (const url of [...this.failed.keys()]) if (!this.wantedUrls.has(url)) this.failed.delete(url);
    this.pump();
  }

  private indexWanted() {
    this.wantedKeys.clear();
    this.wantedUrls.clear();
    for (const w of this.order) {
      let s = this.wantedKeys.get(w.cache);
      if (!s) this.wantedKeys.set(w.cache, (s = new Set()));
      s.add(w.index);
      this.wantedUrls.set(w.url, w);
    }
  }

  private buildOrder(plan: FramePlan): Wanted[] {
    const { cache: active, center: rawCenter, direction } = plan.active;
    const count = active.variant.count;
    const center = Math.min(count - 1, Math.max(0, Math.round(rawCenter)));
    const { usable } = this.capacity(active.variant);

    const pin = plan.pin && !plan.pin.cache.disposed && plan.pin.cache !== active && usable >= 3 ? plan.pin : undefined;
    const next = plan.next && !plan.next.disposed && plan.next !== active ? plan.next : undefined;
    let nextN = next ? Math.min(NEXT_HEAD_MAX, Math.floor(usable * NEXT_HEAD_SHARE), next.variant.count) : 0;
    // The pin costs one frame, and only while the window can reach the dissolve.
    const pinOn = !!pin && center < pin.until + usable;
    // When the network is behind the playhead, frames land after the window
    // has passed them. The frame the canvas would fall back to (nearest held
    // bytes at or below the playhead, as `nearest` searches) is wanted too,
    // so a late frame is decoded and drawn instead of the poster.
    const fallback = usable >= 3 ? this.heldFallback(active, center) : -1;
    const fixed = (pinOn ? 1 : 0) + (fallback >= 0 ? 1 : 0);
    let windowN = usable - fixed - nextN;
    if (windowN < 1) {
      nextN = Math.max(0, nextN - (1 - windowN));
      windowN = usable - fixed - nextN;
    }
    windowN = Math.max(1, Math.min(windowN, count));

    // Split the window ~70/30 toward the scroll direction; frames that fall
    // off either end of the film go to the other side.
    const spare = windowN - 1;
    let ahead = Math.round(spare * AHEAD_SHARE);
    let behind = spare - ahead;
    const roomAhead = direction > 0 ? count - 1 - center : center;
    const roomBehind = direction > 0 ? center : count - 1 - center;
    if (ahead > roomAhead) {
      behind = Math.min(roomBehind, behind + ahead - roomAhead);
      ahead = roomAhead;
    }
    if (behind > roomBehind) {
      ahead = Math.min(roomAhead, ahead + behind - roomBehind);
      behind = roomBehind;
    }

    // Nearest-first, with distance weighted by the bias (behind costs more).
    const steps: Array<{ index: number; cost: number }> = [];
    for (let d = 1; d <= ahead; d++) steps.push({ index: center + d * direction, cost: d / AHEAD_SHARE });
    for (let d = 1; d <= behind; d++) steps.push({ index: center - d * direction, cost: d / (1 - AHEAD_SHARE) });
    steps.sort((a, b) => a.cost - b.cost);

    const at = (cache: FrameCache, index: number): Wanted => ({ cache, index, url: frameUrl(cache.variant, index) });
    const order: Wanted[] = [at(active, center)];
    if (pin && pinOn) order.push(at(pin.cache, pin.index));
    for (const s of steps) order.push(at(active, s.index));
    if (next) for (let i = 0; i < nextN; i++) order.push(at(next, i));
    // Last: it needs no fetch, only a decode slot the window is not using.
    if (fallback >= 0 && !steps.some((s) => s.index === fallback)) order.push(at(active, fallback));
    return order;
  }

  /**
   * The frame `nearest(center)` would draw if its bytes were decoded: the
   * closest frame at or below `center` (else above) whose compressed bytes are
   * held. -1 when the playhead frame itself is held or decoded, or when a
   * decoded frame is already at least as close.
   */
  private heldFallback(cache: FrameCache, center: number): number {
    const held = (i: number) => this.blobs.has(frameUrl(cache.variant, i));
    if (cache.has(center) || held(center)) return -1;
    for (let i = center - 1; i >= 0; i--) {
      if (cache.has(i)) return -1;
      if (held(i)) return i;
    }
    for (let i = center + 1; i < cache.variant.count; i++) {
      if (cache.has(i)) return -1;
      if (held(i)) return i;
    }
    return -1;
  }

  /** Start whatever the limits allow, in wanted order. */
  private pump() {
    const s = this.stats;
    for (const { cache, index, url } of this.order) {
      if (s.fetchInFlight >= this.maxFetches && s.decodeInFlight >= this.maxDecodes) return;
      if (cache.disposed || cache.has(index) || cache.decoding.has(index) || !this.retryDue(url)) continue;
      const held = this.blobs.get(url);
      if (held) {
        if (s.decodeInFlight >= this.maxDecodes) continue;
        const bytes = frameBytes(cache.variant);
        if (!this.reserve(bytes)) continue;
        // Most recently used.
        this.blobs.delete(url);
        this.blobs.set(url, held);
        this.startDecode(cache, index, url, held.blob, bytes);
        continue;
      }
      if (this.fetchingUrls.has(url) || s.fetchInFlight >= this.maxFetches) continue;
      this.startFetch(url);
    }
  }

  /** True unless `url` failed and its retry is not due yet (then a wake-up is set). */
  private retryDue(url: string): boolean {
    const f = this.failed.get(url);
    if (!f) return true;
    const now = this.clock.now();
    if (now >= f.retryAt) return true;
    if (f.retryAt < this.wakeAt) {
      this.wakeAt = f.retryAt;
      this.clock.later(() => {
        this.wakeAt = Infinity;
        this.pump();
      }, f.retryAt - now);
    }
    return false;
  }

  private markFailed(url: string) {
    const attempts = (this.failed.get(url)?.attempts ?? 0) + 1;
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempts - 1));
    this.failed.set(url, { attempts, retryAt: this.clock.now() + delay });
  }

  private startFetch(url: string) {
    const s = this.stats;
    s.fetches++;
    if (this.fetchedEver.has(url)) s.refetches++;
    s.fetchInFlight++;
    if (s.fetchInFlight > s.maxFetchInFlight) s.maxFetchInFlight = s.fetchInFlight;
    this.fetchingUrls.add(url);
    // Never aborted: a fetch that has started completes and its bytes are
    // kept, even if the frame (or its cache) is no longer wanted.
    this.io
      .fetchBlob(url)
      .then(
        (blob) => {
          this.fetchedEver.add(url);
          this.putBlob(url, blob);
        },
        () => {
          this.markFailed(url);
        },
      )
      .finally(() => {
        s.fetchInFlight--;
        this.fetchingUrls.delete(url);
        this.pump();
      });
  }

  private startDecode(cache: FrameCache, index: number, url: string, blob: Blob, bytes: number) {
    const s = this.stats;
    s.decodes++;
    if (this.decodedEver.has(url)) s.redecodes++;
    s.decodeInFlight++;
    if (s.decodeInFlight > s.maxDecodeInFlight) s.maxDecodeInFlight = s.decodeInFlight;
    this.reserved += bytes;
    cache.decoding.add(index);
    this.io
      .decode(blob)
      .then(
        (img) => {
          this.reserved -= bytes;
          if (cache.disposed) {
            if ("close" in img) img.close();
            return;
          }
          this.decodedEver.add(url);
          this.failed.delete(url);
          const actual = drawableBytes(img) || bytes;
          this.used += actual;
          cache.put(index, img, actual);
        },
        () => {
          this.reserved -= bytes;
          if (cache.disposed) return;
          // Bad bytes: drop them so a later attempt fetches fresh ones.
          this.dropBlob(url);
          this.markFailed(url);
        },
      )
      .finally(() => {
        s.decodeInFlight--;
        cache.decoding.delete(index);
        this.pump();
      });
  }

  private putBlob(url: string, blob: Blob) {
    this.dropBlob(url);
    const bytes = blob.size || 0;
    this.blobs.set(url, { blob, bytes });
    this.blobUsed += bytes;
    if (this.blobUsed <= this.blobLimitBytes) return;
    // Least recently used out, sparing bytes a wanted frame still needs.
    for (const k of this.blobs.keys()) {
      if (this.blobUsed <= this.blobLimitBytes) break;
      if (k === url) continue;
      const w = this.wantedUrls.get(k);
      if (w && !w.cache.has(w.index)) continue;
      this.dropBlob(k);
    }
  }

  private dropBlob(key: string) {
    const e = this.blobs.get(key);
    if (!e) return;
    this.blobs.delete(key);
    this.blobUsed -= e.bytes;
  }

  /**
   * Make room for one decode of `bytes`: evict decoded frames outside the
   * wanted set, farthest from the playhead first, until decoded + decoding +
   * this one fits. False when it cannot fit (the decode waits).
   */
  private reserve(bytes: number): boolean {
    while (this.used + this.reserved + bytes > this.limitBytes) {
      const victim = this.pickVictim();
      if (!victim) break;
      victim.cache.evict(victim.index);
      this.stats.evictions++;
    }
    return this.used + this.reserved + bytes <= this.limitBytes || this.used + this.reserved === 0;
  }

  private pickVictim(): Wanted | null {
    const active = this.plan?.active;
    let best: Wanted | null = null;
    let bestScore = -1;
    for (const cache of this.caches) {
      for (const index of cache.decodedIndices()) {
        if (this.isWanted(cache, index)) continue;
        // Frames of other films first, then the active film's, farthest first.
        const score = active && cache === active.cache ? Math.abs(index - active.center) : 1e9 + index;
        if (score > bestScore) {
          bestScore = score;
          best = { cache, index, url: "" };
        }
      }
    }
    return best;
  }

  /** @internal A cache dropped a decoded frame (eviction, dispose). */
  released(bytes: number) {
    this.used -= bytes;
  }

  /**
   * @internal A cache is gone: forget its place in the plan. Its compressed
   * bytes stay in the (byte-capped) store for a cache re-created for the same
   * film; its decoded frames were already released by `dispose`.
   */
  drop(cache: FrameCache) {
    this.caches.delete(cache);
    this.order = this.order.filter((w) => w.cache !== cache);
    this.indexWanted();
    if (this.plan?.active.cache === cache) this.plan = null;
  }
}

/**
 * Decoded-frame budget for this device. Chrome exposes `deviceMemory` (GB,
 * capped at 8); Safari does not, so phones and tablets (portrait / narrow)
 * get the conservative figure and desktops a larger one. All well under any
 * per-tab ceiling; the reel only ever needs a window around the playhead.
 */
export function pickFrameBudgetBytes(): number {
  if (typeof window === "undefined") return 160 * MB;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem > 0) return Math.min(512, Math.max(96, mem * 48)) * MB;
  const small = window.innerWidth < 1024 || window.innerHeight > window.innerWidth;
  return (small ? 160 : 384) * MB;
}

/** Decoded frames of one film variant. Loading is scheduled by its FrameBudget. */
export class FrameCache {
  disposed = false;
  /** Index served by the last `nearest` call: -1 = the poster or nothing. */
  lastServed = -1;
  /** @internal Indices with a decode in flight (owned by the budget). */
  readonly decoding = new Set<number>();

  private readonly bitmaps = new Map<number, { img: Drawable; bytes: number }>();
  private poster: HTMLImageElement | null = null;
  private readonly listeners = new Set<(index: number) => void>();

  constructor(
    public readonly variant: FilmVariant,
    public readonly budget: FrameBudget,
  ) {
    budget.register(this);
  }

  get size(): number {
    return this.bitmaps.size;
  }

  /** Listen for frames landing; index -1 = the poster. */
  subscribe(fn: (index: number) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(index: number) {
    for (const fn of this.listeners) fn(index);
    this.budget.emit(this, index);
  }

  get(index: number): Drawable | undefined {
    return this.bitmaps.get(index)?.img;
  }

  has(index: number): boolean {
    return this.bitmaps.has(index);
  }

  decodedIndices(): IterableIterator<number> {
    return this.bitmaps.keys();
  }

  /**
   * Closest decoded frame ≤ index, else closest ≥ index, else the poster.
   * `record` counts the lookup as a canvas paint in the budget's stats.
   */
  nearest(index: number, record = false): Drawable | null {
    let at = -1;
    let img: Drawable | null = this.bitmaps.get(index)?.img ?? null;
    if (img) at = index;
    for (let i = index - 1; i >= 0 && !img; i--) {
      const b = this.bitmaps.get(i);
      if (b) [at, img] = [i, b.img];
    }
    for (let i = index + 1; i < this.variant.count && !img; i++) {
      const b = this.bitmaps.get(i);
      if (b) [at, img] = [i, b.img];
    }
    if (!img) img = this.poster;
    this.lastServed = at;
    if (record && img) {
      const s = this.budget.stats;
      if (at === index) s.exactDraws++;
      else {
        s.fallbackDraws++;
        // The poster is the film's first frame.
        s.fallbackDistanceSum += Math.abs(index - Math.max(0, at));
      }
    }
    return img;
  }

  /** Drop one decoded frame (budget eviction). Its bytes stay held for a re-decode. */
  evict(index: number) {
    const e = this.bitmaps.get(index);
    if (!e) return;
    if ("close" in e.img) e.img.close();
    this.bitmaps.delete(index);
    this.budget.released(e.bytes);
  }

  /** @internal The budget hands over a decoded frame (bytes already counted). */
  put(index: number, img: Drawable, bytes: number) {
    const old = this.bitmaps.get(index);
    if (old) {
      if ("close" in old.img) old.img.close();
      this.budget.released(old.bytes);
    }
    this.bitmaps.set(index, { img, bytes });
    this.notify(index);
  }

  async loadPoster(): Promise<HTMLImageElement> {
    if (this.poster) return this.poster;
    const img = new Image();
    img.decoding = "async";
    img.src = this.variant.poster;
    await img.decode().catch(() => undefined);
    this.poster = img;
    if (!this.disposed) this.notify(-1);
    return img;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const i of [...this.bitmaps.keys()]) this.evict(i);
    this.budget.drop(this);
    this.listeners.clear();
  }
}
