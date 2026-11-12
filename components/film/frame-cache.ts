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
 * Pack mode (attachPacks: the film worker, pack-client.ts). For a variant
 * served from its pack the compressed bytes live in the worker, not here: a
 * wanted frame whose bytes the worker holds is decoded THERE (same decode
 * limit, same reservation); one whose bytes have not arrived is simply not
 * loadable yet (no slot taken, nothing blocked) and is decoded when they
 * arrive if it is still wanted. Within the window the order is coarse
 * first: the playhead frame, then every 4th frame nearest the playhead, then
 * the in-between frames nearest first, so a cold window or a fast scroll
 * shows every 4th frame across the whole window before detail fills in. A
 * variant whose pack fails goes back to the per-frame path (frames already
 * decoded stay). The scheduler tells the worker where the visitor is on
 * every strong plan (`where`).
 *
 * `nearest` returns the closest decoded frame at or below the requested
 * index (else above, else the poster), so the canvas always has something to
 * draw while the exact frame is in flight. `window.__filmStats` (FilmStats)
 * counts fetches, refetches, decodes and draw accuracy.
 *
 * Failures (Phase 6, recovery 6b). A failure is PERMANENT when the server
 * answered that the file does not exist or cannot be used (404, 410, 416;
 * bytes that will not decode; for packs also a length or header that
 * disagrees with the timeline), TRANSIENT otherwise (a network error, a
 * timeout, an aborted body, 403/429, 5xx). A frame is tried at most
 * FRAME_TRIES times (the first try and two retries with backoff, counted
 * also when it leaves the wanted set and comes back); then it is failed:
 * never requested again, `nearest` serves a neighbour. The film is
 * UNREACHABLE when nothing of it has loaded on this page view (no poster, no
 * frame, no pack bytes), a poster has failed and UNREACHABLE_FAILED_FRAMES
 * frames have failed: the budget then halts (no fetch, decode or pack read)
 * and tells its listeners (onHalt), and the page runs in static mode.
 *
 * Permanent failures last the page view. Transient ones are forgiven on a
 * RECOVERY SIGNAL: the browser's `online` event (noteOnline), the document
 * shown again after at least HIDDEN_RECOVERY_MS hidden (noteVisibility), a
 * film response that succeeds after a drop (GAP_FAILURES distinct frames or
 * packs failed transiently since the last success; a frame or pack a success
 * already forgave counts again only after it has loaded once, so one file
 * that keeps failing while others load is forgiven that way at most once),
 * and, while halted for unreachability, a probe that succeeds. Signals other
 * than probes are honoured at most once per SIGNAL_GAP_MS (one arriving
 * sooner waits for the end of that gap; several waiting are one). Honoured,
 * a signal makes every transiently failed frame and pack loadable again,
 * each frame with a fresh FRAME_TRIES, and asks for failed posters again
 * through the IO (a poster that answers 404 there is never asked for again);
 * with nothing transient failed it does nothing.
 * While halted for unreachability no signal loads anything itself: it asks
 * for a probe, and only a probe that succeeds un-halts (onResume) and
 * forgives. Probes: one small request (the active film's poster, past every
 * cache) PROBE_AFTER_MS after the halt (5 s, 15 s, 45 s), then every
 * PROBE_EVERY_MS, at most PROBE_MAX per page view, none while the document
 * is hidden (a probe that comes due then runs when it is shown); a probe
 * that fails transiently only moves on, one that fails permanently ends
 * probing; one that comes due with no film to probe (every cache disposed)
 * arms no timer until a cache registers. A halt where every failure was
 * permanent (no film files at all) never probes, and the page's own halt
 * (no 2D context) never resumes. So
 * with the network down for good a page view makes the requests it made
 * before this rule plus at most PROBE_MAX probes, and nothing between them.
 */

import { SKELETON_STRIDE } from "./pack-format";
import type { FilmVariant } from "./types";

export type Drawable = ImageBitmap | HTMLImageElement;

export function frameUrl(variant: FilmVariant, index: number): string {
  const n = String(index + 1).padStart(variant.pad, "0");
  return `${variant.base}/f_${n}.${variant.ext}${variant.v ? `?v=${variant.v}` : ""}`;
}

/** Network + decode, injectable so the scheduler runs under node with fakes. */
export type FrameIO = {
  /**
   * Fetch one frame's compressed bytes; rejects on a non-OK response (with
   * `permanent: true` when the answer was permanent, see filmError).
   */
  fetchBlob: (url: string) => Promise<Blob>;
  /** Decode compressed bytes into something drawImage accepts. */
  decode: (blob: Blob) => Promise<Drawable>;
  /**
   * One request past every cache (the unreachability probe): resolves when
   * the network answered OK, rejects like fetchBlob. Absent (fakes): fetchBlob.
   */
  probe?: (url: string) => Promise<void>;
};

/** HTTP answers that mean the file does not exist or cannot be used: never retried after a recovery signal. */
export function permanentStatus(status: number): boolean {
  return status === 404 || status === 410 || status === 416;
}

/** An error that says whether the failure is permanent (see the file header). */
export function filmError(message: string, permanent: boolean): Error & { permanent: boolean } {
  return Object.assign(new Error(message), { permanent });
}

/** True for a failure marked permanent (filmError); anything else is transient. */
export function isPermanentFailure(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { permanent?: unknown }).permanent === true;
}

/** A probe that has not answered after this long failed (transiently). */
const PROBE_TIMEOUT_MS = 10_000;

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
    // re-encode changes the URL and never serves stale frames. A network
    // error or an aborted body rejects with the browser's TypeError: transient.
    const res = await fetch(url);
    if (!res.ok) throw filmError(`frame ${url} ${res.status}`, permanentStatus(res.status));
    return res.blob();
  },
  decode(blob) {
    if (typeof createImageBitmap === "function") return createImageBitmap(blob);
    return decodeWithImage(blob);
  },
  async probe(url) {
    // no-store: an answer from the HTTP cache would say nothing about the network.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw filmError(`probe ${url} ${res.status}`, permanentStatus(res.status));
      await res.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
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
  /** Frames failed now (FRAME_TRIES tries spent): not requested again unless a recovery signal forgives them (transient failures only). */
  framesFailed: number;
  /** Recovery signals honoured (each forgave the transient failures; a successful probe included). */
  recoveries: number;
  /** Probes sent while halted for unreachability (at most PROBE_MAX per page view). */
  probes: number;
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
    framesFailed: 0,
    recoveries: 0,
    probes: 0,
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
  /**
   * Where the visitor is: once per scroll decision (the strong plan). `pin`:
   * the dissolve frame while it is wanted and not decoded, so the worker
   * reads it even though its film is neither the active one nor the next.
   */
  where(at: { variant: FilmVariant; frame: number; direction: 1 | -1; lo: number; hi: number; pin?: { variant: FilmVariant; frame: number } | null }): void;
  /** Frames of `variant` arrived (`added`), or its mode changed (null: it fell back to frames). */
  subscribe(fn: (variant: FilmVariant, added: readonly number[] | null) => void): () => void;
  /** Stop (the budget halted: static mode). Optional for fakes. */
  stop?(): void;
  /**
   * A recovery signal: packs that failed transiently, and every pack stop()
   * marked, are read again. Optional for fakes.
   */
  resume?(): void;
  /** Some pack failed transiently. Optional for fakes. */
  hasTransient?(): boolean;
  /** `variant`'s pack failed transiently (not forgiven yet). Optional for fakes (then: hasTransient). */
  transient?(variant: FilmVariant): boolean;
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
 * is retried while the frame stays wanted, after 400 ms, then 800 ms; after
 * FRAME_TRIES tries in all it is failed (until a recovery signal forgives a
 * transient failure; a permanent one for the page view).
 */
const RETRY_BASE_MS = 400;
export const FRAME_TRIES = 3;
/** Failed frames (with nothing ever loaded and a poster failed) that make the film unreachable. */
export const UNREACHABLE_FAILED_FRAMES = 3;
/** Recovery signals other than probes are honoured at most once per this. */
export const SIGNAL_GAP_MS = 5_000;
/** The document shown again after at least this long hidden is a recovery signal. */
export const HIDDEN_RECOVERY_MS = 10_000;
/** Distinct frames failed transiently since the last success that make the next success a recovery signal (one frame alone is that file's problem, not a drop). */
export const GAP_FAILURES = 2;
/** Probe schedule while halted for unreachability: these gaps after the halt (5 s, 15 s, 45 s), then every PROBE_EVERY_MS. */
export const PROBE_AFTER_MS: readonly number[] = [5_000, 10_000, 30_000];
export const PROBE_EVERY_MS = 60_000;
/** Probes per page view, at most. */
export const PROBE_MAX = 10;
/** Budgets below this are "small" (phones): fewer decodes, smaller blob store. */
const SMALL_BUDGET = 256 * MB;

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

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
   * Frames whose last fetch or decode failed, with the tries so far and the
   * time a retry is due (backoff, see RETRY_BASE_MS). Retried while wanted
   * once due; the entry is forgotten when the frame decodes, kept when it
   * leaves the wanted set (the tries count for the whole page view).
   */
  private readonly failed = new Map<string, { attempts: number; retryAt: number; permanent: boolean }>();
  /** Frames failed (FRAME_TRIES spent): not requested again unless forgiven. */
  private readonly dead = new Set<string>();
  /** The dead frames whose failure was permanent: never forgiven. */
  private readonly deadPermanent = new Set<string>();
  /** Anything of the film loaded on this page view: a poster, a frame, pack bytes. */
  private everLoaded = false;
  private postersFailed = 0;
  private haltedFlag = false;
  /** Why the budget halted: the page (no 2D context: for good) or unreachability (probes may resume it). */
  private haltKind: "page" | "unreachable" | null = null;
  private readonly haltListeners = new Set<() => void>();
  private readonly resumeListeners = new Set<() => void>();
  /**
   * What failed transiently since the last film response that succeeded:
   * frame URLs and `pack:<variant key>` (distinct). GAP_FAILURES of them make
   * the next success a recovery signal.
   */
  private readonly gap = new Set<string>();
  /**
   * Gap entries forgiven by a success-after-gap signal that have not loaded
   * since. The network was working when they were forgiven, so failing again
   * is that file's problem (a 403/429 on one pack or frame), not a drop: they
   * do not count toward the next gap until they load once. This is what bounds
   * success-after-gap signals: each needs GAP_FAILURES entries never forgiven
   * that way before, so a file that keeps failing is forgiven by a success
   * at most once per page view (other signals still forgive it).
   */
  private readonly gapForgiven = new Set<string>();
  /** When the last recovery signal was honoured, and whether one waits for the gap to pass. */
  private signalAt = -Infinity;
  private signalQueued = false;
  /** The document is hidden (noteVisibility), since when. */
  private hidden = false;
  private hiddenAt = 0;
  /**
   * Probing (this halt): on, the schedule step, the timer generation, one due
   * while hidden, one in flight, and stalled (a probe came due with no film
   * to probe: every cache disposed, the page unmounted; no timer is armed
   * until a cache registers).
   */
  private probeOn = false;
  private probeStalled = false;
  private probeStep = 0;
  private probeGen = 0;
  private probeDue = false;
  private probing = false;
  /** When the pending retry wake-up fires (Infinity = none pending). */
  private wakeAt = Infinity;
  private readonly listeners = new Set<(cache: FrameCache, index: number) => void>();
  /** Pack mode: the film worker's bytes (null = every variant loads frame by frame). */
  private packs: PackSource | null = null;

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

  /** A phone-sized budget (the same signal decides the worker's byte cap). */
  get small(): boolean {
    return this.limitBytes < SMALL_BUDGET;
  }

  /**
   * Serve variants that have a pack through the film worker. Frames arriving
   * there start decodes for wanted frames; a variant falling back to frames
   * (null) clears its retry state and loads per frame from the next pump.
   */
  attachPacks(source: PackSource) {
    this.packs = source;
    source.subscribe((variant, added) => {
      const key = variantKey(variant);
      if (added === null) {
        // A pack that failed transiently: one entry of the gap (see gapForgiven).
        const src = this.packs;
        if (src && (src.transient ? src.transient(variant) : src.hasTransient?.())) this.noteGap(`pack:${key}`);
        for (const url of [...this.failed.keys()]) if (url.startsWith(`${variant.base}/`)) this.failed.delete(url);
        // The order and the mode follow the variant's new path at once.
        const plan = this.plan;
        if (plan && !plan.active.cache.disposed) {
          this.order = this.buildOrder(plan);
          this.indexWanted();
          this.stats.mode = this.packMode(plan.active.cache) ? "pack" : "frames";
        }
        this.pump();
        return;
      }
      if (added.length) {
        this.everLoaded = true;
        this.noteSuccess(`pack:${key}`);
      }
      for (const c of this.caches) {
        if (c.disposed || variantKey(c.variant) !== key) continue;
        const want = this.wantedKeys.get(c);
        if (want && added.some((i) => want.has(i) && !c.has(i) && !c.decoding.has(i))) {
          this.pump();
          return;
        }
      }
    });
  }

  /** Static mode: the budget loads nothing (see halt; only a successful probe resumes it). */
  get halted(): boolean {
    return this.haltedFlag;
  }

  /**
   * Stop loading for good: no fetch, decode or pack read starts again on this
   * page view (frames already decoded stay drawable). Called by the page when
   * it has no canvas to draw on; never resumed.
   */
  halt() {
    this.haltFor("page");
  }

  private haltFor(kind: "page" | "unreachable") {
    if (this.haltedFlag) {
      // The page's own halt outranks unreachability: no probe, no resume.
      if (kind === "page" && this.haltKind !== "page") {
        this.haltKind = "page";
        this.probeOn = false;
        this.probeGen++;
      }
      return;
    }
    this.haltedFlag = true;
    this.haltKind = kind;
    this.order = [];
    this.indexWanted();
    this.packs?.stop?.();
    for (const fn of this.haltListeners) fn();
    if (kind !== "unreachable") return;
    // Probe only when something failed transiently: with every film file
    // missing (404), nothing would ever answer differently.
    this.probeOn = this.hasTransient();
    this.probeStep = 0;
    this.probeDue = false;
    this.probeStalled = false;
    if (this.probeOn) this.scheduleProbe();
  }

  /** Listen for a halt (static mode). */
  onHalt(fn: () => void): () => void {
    this.haltListeners.add(fn);
    return () => {
      this.haltListeners.delete(fn);
    };
  }

  /** Listen for a halted budget resuming (a probe succeeded). */
  onResume(fn: () => void): () => void {
    this.resumeListeners.add(fn);
    return () => {
      this.resumeListeners.delete(fn);
    };
  }

  /** The browser's `online` event: a recovery signal. */
  noteOnline() {
    this.signal();
  }

  /** The document was hidden or shown. Shown after HIDDEN_RECOVERY_MS or more: a recovery signal. */
  noteVisibility(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const now = this.clock.now();
    if (hidden) {
      this.hiddenAt = now;
      return;
    }
    if (now - this.hiddenAt >= HIDDEN_RECOVERY_MS) this.signal();
    // A probe that came due while hidden runs now.
    if (this.probeDue) this.probe();
  }

  /** @internal A cache's poster loaded (`ok`) or failed. */
  notePoster(_cache: FrameCache, ok: boolean) {
    if (ok) {
      this.everLoaded = true;
      this.noteSuccess();
    } else this.postersFailed++;
    this.checkReachable();
  }

  /** Nothing ever loaded, a poster failed, enough frames failed: halt (probes may resume). */
  private checkReachable() {
    if (this.haltedFlag || this.everLoaded) return;
    if (this.postersFailed > 0 && this.dead.size >= UNREACHABLE_FAILED_FRAMES) this.haltFor("unreachable");
  }

  /** Something failed transiently and is not forgiven yet: a frame, or a pack. */
  private hasTransient(): boolean {
    for (const f of this.failed.values()) if (!f.permanent) return true;
    if (this.dead.size > this.deadPermanent.size) return true;
    return this.packs?.hasTransient?.() ?? false;
  }

  /** Something failed transiently: into the gap unless a success forgave it before and it has not loaded since. */
  private noteGap(key: string) {
    if (!this.gapForgiven.has(key)) this.gap.add(key);
  }

  /**
   * A film response succeeded (`key`: the frame URL or `pack:<key>` that
   * loaded, if any): after a drop (GAP_FAILURES entries in the gap) that is a
   * recovery signal, and what was in the gap is marked forgiven-by-success.
   */
  private noteSuccess(key?: string) {
    if (key !== undefined) this.gapForgiven.delete(key);
    const drop = this.gap.size >= GAP_FAILURES;
    if (drop) for (const k of this.gap) this.gapForgiven.add(k);
    this.gap.clear();
    if (drop) this.signal();
  }

  /**
   * A recovery signal (not a probe): honoured at most once per SIGNAL_GAP_MS
   * (sooner ones wait for the gap's end, as one). Running: forgive the
   * transient failures. Halted for unreachability: ask for a probe.
   */
  private signal() {
    if (this.haltKind === "page") return;
    if (this.haltedFlag ? !this.probeOn : !this.hasTransient()) return;
    const now = this.clock.now();
    const at = this.signalAt + SIGNAL_GAP_MS;
    if (now < at) {
      if (!this.signalQueued) {
        this.signalQueued = true;
        this.clock.later(() => {
          this.signalQueued = false;
          this.signal();
        }, at - now);
      }
      return;
    }
    this.signalAt = now;
    if (this.haltedFlag) this.probe();
    else this.recover();
  }

  /** The next scheduled probe (PROBE_AFTER_MS, then PROBE_EVERY_MS). */
  private scheduleProbe() {
    if (this.stats.probes >= PROBE_MAX) return;
    const gen = ++this.probeGen;
    const ms = PROBE_AFTER_MS[this.probeStep] ?? PROBE_EVERY_MS;
    this.clock.later(() => {
      if (gen !== this.probeGen || !this.probeOn) return;
      this.probeStep++;
      this.probe();
      // Stalled (no film to probe): no timer until a cache registers.
      if (!this.probeStalled) this.scheduleProbe();
    }, ms);
  }

  /** One probe now, unless one is in flight, the cap is reached or the document is hidden (then when shown). */
  private probe() {
    if (!this.haltedFlag || !this.probeOn || this.probing || this.stats.probes >= PROBE_MAX) return;
    if (this.hidden) {
      this.probeDue = true;
      return;
    }
    const url = this.probeUrl();
    if (!url) {
      this.probeStalled = true;
      return;
    }
    this.probeStalled = false;
    this.probeDue = false;
    this.probing = true;
    this.stats.probes++;
    const io = this.io;
    const req = io.probe ? io.probe(url) : io.fetchBlob(url).then(() => undefined);
    req.then(
      () => {
        this.probing = false;
        if (this.haltKind === "unreachable") this.recover();
      },
      (e: unknown) => {
        this.probing = false;
        if (!isPermanentFailure(e)) return;
        // The probe's file is gone: nothing will answer differently.
        this.probeOn = false;
        this.probeGen++;
      },
    );
  }

  /** The active film's poster (else any film's). */
  private probeUrl(): string | null {
    const active = this.plan?.active.cache;
    if (active && !active.disposed) return active.variant.poster;
    for (const c of this.caches) if (!c.disposed) return c.variant.poster;
    return null;
  }

  /**
   * Forgive every transient failure: frames get a fresh FRAME_TRIES, failed
   * posters load again, transiently failed packs are read again. A halted
   * budget resumes (onResume) with the last plan it was given.
   */
  private recover() {
    this.stats.recoveries++;
    for (const [url, f] of this.failed) if (!f.permanent) this.failed.delete(url);
    for (const url of this.dead) if (!this.deadPermanent.has(url)) this.dead.delete(url);
    this.stats.framesFailed = this.dead.size;
    this.gap.clear();
    const resumed = this.haltedFlag;
    if (resumed) {
      this.haltedFlag = false;
      this.haltKind = null;
      this.probeOn = false;
      this.probeDue = false;
      this.probeStalled = false;
      this.probeGen++;
    }
    // A poster that is gone for good stays failed; the others are asked for again.
    this.postersFailed = 0;
    for (const c of this.caches) if (!c.disposed && c.posterGone) this.postersFailed++;
    this.packs?.resume?.();
    for (const c of this.caches) if (!c.disposed) c.retryPoster();
    if (resumed) for (const fn of this.resumeListeners) fn();
    const plan = this.plan;
    if (plan && !plan.active.cache.disposed) this.want(plan, { weak: this.planWeak });
    else this.pump();
  }

  /** True while `cache` loads from its pack. */
  packMode(cache: FrameCache): boolean {
    return !!this.packs && this.packs.serves(cache.variant);
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
    // A probe came due with no film to probe: it runs now, the schedule goes on.
    if (this.probeStalled && this.probeOn && this.haltedFlag) {
      this.probe();
      if (!this.probeStalled) this.scheduleProbe();
    }
  }

  /**
   * @internal A poster asked for again after a recovery signal (FrameCache.
   * retryPoster): through the IO, so the answer says whether a failure is
   * permanent (the <img> of the first load cannot tell). Rejects like
   * fetchBlob; bytes that will not decode are a permanent failure.
   */
  async fetchPoster(url: string): Promise<Drawable> {
    const blob = await this.io.fetchBlob(url);
    try {
      return await this.io.decode(blob);
    } catch {
      throw filmError(`poster ${url} would not decode`, true);
    }
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
    // Halted: nothing loads; the plan is kept for a resume.
    if (this.haltedFlag) return;
    this.order = this.buildOrder(plan);
    this.indexWanted();
    const active = plan.active.cache;
    if (this.packs && !weak && active.variant.pack) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const w of this.order) {
        if (w.cache !== active) continue;
        lo = Math.min(lo, w.index);
        hi = Math.max(hi, w.index);
      }
      const frame = Math.min(active.variant.count - 1, Math.max(0, Math.round(plan.active.center)));
      // The dissolve pin, while it is in the wanted set and not decoded.
      const pinW = plan.pin && this.isWanted(plan.pin.cache, plan.pin.index) ? plan.pin : undefined;
      const pin = pinW && pinW.cache.variant.pack && !pinW.cache.has(pinW.index) ? { variant: pinW.cache.variant, frame: pinW.index } : null;
      this.packs.where({ variant: active.variant, frame, direction: plan.active.direction, lo, hi, pin });
    }
    this.stats.mode = this.packMode(active) ? "pack" : "frames";
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
    let steps: Array<{ index: number; cost: number }> = [];
    for (let d = 1; d <= ahead; d++) steps.push({ index: center + d * direction, cost: d / AHEAD_SHARE });
    for (let d = 1; d <= behind; d++) steps.push({ index: center - d * direction, cost: d / (1 - AHEAD_SHARE) });
    steps.sort((a, b) => a.cost - b.cost);
    // Pack mode: coarse first (every 4th frame nearest first, then the rest).
    const coarse = this.packMode(active);
    if (coarse) steps = [...steps.filter((x) => x.index % SKELETON_STRIDE === 0), ...steps.filter((x) => x.index % SKELETON_STRIDE !== 0)];

    const at = (cache: FrameCache, index: number): Wanted => ({ cache, index, url: frameUrl(cache.variant, index) });
    const order: Wanted[] = [at(active, center)];
    if (pin && pinOn) order.push(at(pin.cache, pin.index));
    for (const s of steps) order.push(at(active, s.index));
    if (next) {
      const head = Array.from({ length: nextN }, (_, i) => i);
      const nextCoarse = this.packMode(next);
      for (const i of nextCoarse ? [...head.filter((x) => x % SKELETON_STRIDE === 0), ...head.filter((x) => x % SKELETON_STRIDE !== 0)] : head) {
        order.push(at(next, i));
      }
    }
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
    const packs = this.packMode(cache) ? this.packs : null;
    const held = packs ? (i: number) => packs.holds(cache.variant, i) : (i: number) => this.blobs.has(frameUrl(cache.variant, i));
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
    if (this.haltedFlag) return;
    const s = this.stats;
    for (const { cache, index, url } of this.order) {
      if (s.fetchInFlight >= this.maxFetches && s.decodeInFlight >= this.maxDecodes) return;
      if (cache.disposed || cache.has(index) || cache.decoding.has(index) || !this.retryDue(url)) continue;
      if (this.packs && this.packs.serves(cache.variant)) {
        // Pack mode: decodable only once the worker holds the bytes; until
        // then the frame takes no slot and blocks nothing.
        if (s.decodeInFlight >= this.maxDecodes || !this.packs.holds(cache.variant, index)) continue;
        const bytes = frameBytes(cache.variant);
        if (!this.reserve(bytes)) continue;
        this.startPackDecode(this.packs, cache, index, url, bytes);
        continue;
      }
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

  /** True unless `url` failed (tries spent), or failed and its retry is not due yet (then a wake-up is set). */
  private retryDue(url: string): boolean {
    if (this.dead.has(url)) return false;
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

  /** A try failed; `permanent` sticks to the frame (see the file header). */
  private markFailed(url: string, permanent: boolean) {
    const prev = this.failed.get(url);
    const attempts = (prev?.attempts ?? 0) + 1;
    const perm = permanent || !!prev?.permanent;
    if (!permanent) this.noteGap(url);
    if (attempts >= FRAME_TRIES) {
      this.failed.delete(url);
      this.dead.add(url);
      if (perm) this.deadPermanent.add(url);
      this.stats.framesFailed = this.dead.size;
      this.checkReachable();
      return;
    }
    this.failed.set(url, { attempts, retryAt: this.clock.now() + RETRY_BASE_MS * 2 ** (attempts - 1), permanent: perm });
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
          this.everLoaded = true;
          this.putBlob(url, blob);
          this.noteSuccess(url);
        },
        (e: unknown) => {
          this.markFailed(url, isPermanentFailure(e));
        },
      )
      .finally(() => {
        s.fetchInFlight--;
        this.fetchingUrls.delete(url);
        this.pump();
      });
  }

  /** Book a decode: counters, the in-flight gauge, the reservation. */
  private beginDecode(cache: FrameCache, index: number, url: string, bytes: number) {
    const s = this.stats;
    s.decodes++;
    if (this.decodedEver.has(url)) s.redecodes++;
    s.decodeInFlight++;
    if (s.decodeInFlight > s.maxDecodeInFlight) s.maxDecodeInFlight = s.decodeInFlight;
    this.reserved += bytes;
    cache.decoding.add(index);
  }

  /** A decoded frame landed: into its cache, or closed when the cache is gone. */
  private landDecode(cache: FrameCache, index: number, url: string, img: Drawable, bytes: number) {
    this.reserved -= bytes;
    if (cache.disposed) {
      if ("close" in img) img.close();
      return;
    }
    this.decodedEver.add(url);
    this.failed.delete(url);
    this.everLoaded = true;
    const actual = drawableBytes(img) || bytes;
    this.used += actual;
    cache.put(index, img, actual);
  }

  /** Pack mode: decode in the worker from the bytes it holds. */
  private startPackDecode(packs: PackSource, cache: FrameCache, index: number, url: string, bytes: number) {
    this.beginDecode(cache, index, url, bytes);
    packs
      .decode(cache.variant, index)
      .then(
        ({ bitmap }) => this.landDecode(cache, index, url, bitmap, bytes),
        () => {
          this.reserved -= bytes;
          // Bytes dropped in the worker or the pack failed: nothing to back
          // off from (the frame decodes again when its bytes return, or loads
          // per frame). Held bytes that would not decode: back off (permanent).
          if (!cache.disposed && packs.serves(cache.variant) && packs.holds(cache.variant, index)) this.markFailed(url, true);
        },
      )
      .finally(() => {
        this.stats.decodeInFlight--;
        cache.decoding.delete(index);
        this.pump();
      });
  }

  private startDecode(cache: FrameCache, index: number, url: string, blob: Blob, bytes: number) {
    const s = this.stats;
    this.beginDecode(cache, index, url, bytes);
    const t0 = nowMs();
    this.io
      .decode(blob)
      .then(
        (img) => {
          recordDecode(s, "main", nowMs() - t0);
          this.reserved -= bytes;
          if (cache.disposed) {
            if ("close" in img) img.close();
            return;
          }
          this.decodedEver.add(url);
          this.failed.delete(url);
          this.everLoaded = true;
          const actual = drawableBytes(img) || bytes;
          this.used += actual;
          cache.put(index, img, actual);
        },
        () => {
          this.reserved -= bytes;
          if (cache.disposed) return;
          // Bad bytes: drop them so a later attempt fetches fresh ones. Bytes
          // that will not decode are a permanent failure.
          this.dropBlob(url);
          this.markFailed(url, true);
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
  private poster: Drawable | null = null;
  private posterTried = false;
  /** @internal A retry was answered permanently (404, bytes that will not decode): never asked for again. */
  posterGone = false;
  /** The poster load finished (loaded or failed). */
  private posterSettled = false;
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
   *
   * `handover`: this paint replaces the HTML poster (Phase 6), which shows
   * frame 0. Without the exact frame, the poster (frame 0) wins over any
   * decoded frame that is not closer to `index`, and while the poster is
   * still loading such a frame is not drawn at all (null: the HTML poster
   * stays up until the poster or the exact frame lands). Otherwise the
   * takeover could paint a frame a few steps away and then jump back.
   */
  nearest(index: number, record = false, handover = false): Drawable | null {
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
    if (handover && at !== index && img && Math.abs(index) <= Math.abs(at - index)) {
      if (this.poster) [at, img] = [-1, this.poster];
      else if (this.posterPending) [at, img] = [-1, null];
    }
    if (!img) img = this.poster;
    this.lastServed = at;
    if (record) {
      this.budget.stats.drawWant = index;
      this.budget.stats.drawAt = img ? at : -1;
    }
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

  /** The poster load has started and not finished yet. */
  get posterPending(): boolean {
    return this.posterTried && !this.posterSettled;
  }

  /**
   * @internal A recovery signal (the budget): a poster that failed loads
   * again, one try, through the budget's IO (fetchPoster) so the answer is
   * classified: one that is permanently gone is never asked for again.
   */
  retryPoster() {
    if (this.poster || this.posterGone || !this.posterTried || !this.posterSettled || this.disposed) return;
    this.posterSettled = false;
    void this.budget.fetchPoster(this.variant.poster).then(
      (img) => this.posterDone(img),
      (e: unknown) => {
        if (isPermanentFailure(e)) this.posterGone = true;
        this.posterDone(null);
      },
    );
  }

  private posterDone(img: Drawable | null) {
    this.posterSettled = true;
    this.budget.notePoster(this, !!img);
    if (!img) return;
    this.poster = img;
    if (!this.disposed) this.notify(-1);
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

  /**
   * Load the poster once (the HTML poster, Phase 6, is the same URL, so this
   * is normally a memory-cache hit; retried only on a recovery signal,
   * retryPoster). A failed poster is reported to the budget (unreachable
   * check) and never drawn.
   */
  async loadPoster(): Promise<Drawable | null> {
    if (this.poster || this.posterTried) return this.poster;
    this.posterTried = true;
    const img = new Image();
    img.decoding = "async";
    img.src = this.variant.poster;
    const ok = await img.decode().then(
      () => img.naturalWidth > 0,
      () => false,
    );
    this.posterSettled = true;
    this.budget.notePoster(this, ok);
    if (!ok) return null;
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
