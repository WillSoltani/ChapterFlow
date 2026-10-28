/**
 * FrameCache — decoded-bitmap LRU for one film variant.
 *
 * Frames are fetched as ImageBitmap (off-main-thread decode where supported)
 * and kept in a bounded map. `prefetch` warms a window around the current
 * frame so scrubbing never shows a hole; `nearest` returns the closest decoded
 * frame at or below the requested index so the canvas always has *something*
 * to draw while the exact frame is in flight.
 */

import type { FilmVariant } from "./types";

export function frameUrl(variant: FilmVariant, index: number): string {
  const n = String(index + 1).padStart(variant.pad, "0");
  return `${variant.base}/f_${n}.${variant.ext}${variant.v ? `?v=${variant.v}` : ""}`;
}

/**
 * FrameBudget — one decoded-pixel budget shared by every FrameCache on the
 * page, with a single LRU across them.
 *
 * Why: each FrameCache kept up to 160 bitmaps, and a portrait frame decodes to
 * 1080×1920×4 ≈ 8.3 MB — 1.3 GB per film, seven films on the page. Mobile
 * Safari's per-tab memory ceiling is around 1–1.5 GB, so a scrub through the
 * reel on a phone hit it and the tab was killed ("a problem repeatedly
 * occurred" / a reload that never comes back). Everything decoded now counts
 * against one limit sized for the device; the oldest-used frame anywhere is
 * evicted first. `nearest()` covers a hole, as for a frame still in flight.
 */
export class FrameBudget {
  private used = 0;
  private readonly entries: Array<{ cache: FrameCache; index: number; bytes: number }> = [];

  constructor(public readonly limitBytes: number) {}

  get usedBytes(): number {
    return this.used;
  }

  get count(): number {
    return this.entries.length;
  }

  /** Register a decoded frame; evicts least-recently-used frames over the limit. */
  track(cache: FrameCache, index: number, bytes: number) {
    this.entries.push({ cache, index, bytes });
    this.used += bytes;
    // Keep at least the frame just added, even if it alone exceeds the limit.
    while (this.used > this.limitBytes && this.entries.length > 1) {
      const e = this.entries.shift()!;
      this.used -= e.bytes;
      e.cache.evict(e.index);
    }
  }

  /** Mark a frame as just used, so it is evicted last. */
  touch(cache: FrameCache, index: number) {
    const i = this.entries.findIndex((e) => e.cache === cache && e.index === index);
    if (i < 0 || i === this.entries.length - 1) return;
    const [e] = this.entries.splice(i, 1);
    if (e) this.entries.push(e);
  }

  /** Forget a frame the cache dropped on its own (local cap, dispose). */
  release(cache: FrameCache, index: number) {
    const i = this.entries.findIndex((e) => e.cache === cache && e.index === index);
    if (i < 0) return;
    const [e] = this.entries.splice(i, 1);
    if (e) this.used -= e.bytes;
  }
}

/**
 * Decoded-frame budget for this device. Chrome exposes `deviceMemory` (GB,
 * capped at 8); Safari does not, so phones and tablets (portrait / narrow)
 * get the conservative figure and desktops a larger one. All well under any
 * per-tab ceiling; the reel only ever needs a window around the playhead.
 */
export function pickFrameBudgetBytes(): number {
  const MB = 1024 * 1024;
  if (typeof window === "undefined") return 160 * MB;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem > 0) return Math.min(512, Math.max(96, mem * 48)) * MB;
  const small = window.innerWidth < 1024 || window.innerHeight > window.innerWidth;
  return (small ? 160 : 384) * MB;
}

function bitmapBytes(bmp: ImageBitmap | HTMLImageElement): number {
  const w = "naturalWidth" in bmp ? bmp.naturalWidth || bmp.width : bmp.width;
  const h = "naturalHeight" in bmp ? bmp.naturalHeight || bmp.height : bmp.height;
  return w * h * 4;
}

export class FrameCache {
  private readonly bitmaps = new Map<number, ImageBitmap | HTMLImageElement>();
  private readonly inflight = new Map<number, Promise<void>>();
  /** Abort handles for loads started by `prefetch`, so a window that has
   *  moved on can cancel what it no longer needs (see `prefetch`). */
  private readonly speculative = new Map<number, AbortController>();
  private readonly order: number[] = [];
  private poster: HTMLImageElement | null = null;
  private listeners = new Set<() => void>();

  constructor(
    public readonly variant: FilmVariant,
    private readonly capacity = 160,
    private readonly budget: FrameBudget | null = null,
  ) {}

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  get(index: number): ImageBitmap | HTMLImageElement | undefined {
    const b = this.bitmaps.get(index);
    if (b) this.budget?.touch(this, index);
    return b;
  }

  has(index: number): boolean {
    return this.bitmaps.has(index);
  }

  /** Closest decoded frame ≤ index, else closest ≥ index, else poster. */
  nearest(index: number): ImageBitmap | HTMLImageElement | null {
    const exact = this.bitmaps.get(index);
    if (exact) {
      this.budget?.touch(this, index);
      return exact;
    }
    for (let i = index - 1; i >= 0; i--) {
      const b = this.bitmaps.get(i);
      if (b) {
        this.budget?.touch(this, i);
        return b;
      }
    }
    for (let i = index + 1; i < this.variant.count; i++) {
      const b = this.bitmaps.get(i);
      if (b) {
        this.budget?.touch(this, i);
        return b;
      }
    }
    return this.poster;
  }

  /** Drop one decoded frame (budget eviction). A later `load` refetches it. */
  evict(index: number) {
    const old = this.bitmaps.get(index);
    if (!old) return;
    if ("close" in old) old.close();
    this.bitmaps.delete(index);
    const i = this.order.indexOf(index);
    if (i >= 0) this.order.splice(i, 1);
  }

  async loadPoster(): Promise<HTMLImageElement> {
    if (this.poster) return this.poster;
    const img = new Image();
    img.decoding = "async";
    img.src = this.variant.poster;
    await img.decode().catch(() => undefined);
    this.poster = img;
    this.notify();
    return img;
  }

  load(index: number, signal?: AbortSignal): Promise<void> {
    if (index < 0 || index >= this.variant.count) return Promise.resolve();
    if (this.bitmaps.has(index)) return Promise.resolve();
    const pending = this.inflight.get(index);
    if (pending) return pending;

    const p = (async () => {
      try {
        const url = frameUrl(this.variant, index);
        let bmp: ImageBitmap | HTMLImageElement;
        if (typeof createImageBitmap === "function") {
          // Frame URLs carry ?v=<version>, so the default cache policy is
          // safe: a re-encode changes the URL and never serves stale frames.
          const res = await fetch(url, signal ? { signal } : undefined);
          if (!res.ok) throw new Error(`frame ${index} ${res.status}`);
          const blob = await res.blob();
          bmp = await createImageBitmap(blob);
        } else {
          const img = new Image();
          img.decoding = "async";
          img.src = url;
          await img.decode();
          bmp = img;
        }
        this.put(index, bmp);
      } catch {
        // Missing or aborted frame: leave a hole; `nearest` will cover it, and
        // a later `load` for the same index starts a fresh fetch.
      } finally {
        this.inflight.delete(index);
        this.speculative.delete(index);
      }
    })();
    this.inflight.set(index, p);
    return p;
  }

  private put(index: number, bmp: ImageBitmap | HTMLImageElement) {
    this.bitmaps.set(index, bmp);
    this.order.push(index);
    while (this.order.length > this.capacity) {
      const evict = this.order.shift()!;
      const old = this.bitmaps.get(evict);
      if (old && "close" in old) old.close();
      this.bitmaps.delete(evict);
      this.budget?.release(this, evict);
    }
    this.budget?.track(this, index, bitmapBytes(bmp));
    this.notify();
  }

  /**
   * Warm a window around `center`, nearest-first, biased toward `direction`.
   *
   * Speculative loads outside the NEW window are aborted. Without that, a fast
   * scrub across the reel enqueues a fetch for nearly every frame it passes
   * (~1,600 same-origin requests) and the browser's per-host connection
   * budget serialises everything behind them — including the app's own
   * navigations (a nav anchor's RSC round-trip waited >10 s in dev). The
   * in-flight set is now bounded by the window, so the queue drains at scrub
   * speed instead of at reel length.
   */
  prefetch(center: number, radius = 24, direction: 1 | -1 = 1) {
    const ahead = Math.round(radius * 1.4);
    const behind = Math.round(radius * 0.6);
    const lo = Math.max(0, center - (direction > 0 ? behind : ahead));
    const hi = Math.min(this.variant.count - 1, center + (direction > 0 ? ahead : behind));
    for (const [i, ctl] of this.speculative) {
      if (i < lo || i > hi) {
        ctl.abort();
        this.speculative.delete(i);
      }
    }
    const queue: number[] = [];
    for (let d = 0; d <= Math.max(ahead, behind); d++) {
      const a = center + d * direction;
      const b = center - d * direction;
      if (a >= lo && a <= hi) queue.push(a);
      if (d !== 0 && b >= lo && b <= hi) queue.push(b);
    }
    for (const i of queue) {
      if (this.bitmaps.has(i) || this.inflight.has(i)) continue;
      const ctl = new AbortController();
      this.speculative.set(i, ctl);
      void this.load(i, ctl.signal);
    }
  }

  /** Sequential full warm (used on idle after poster paint). */
  async warmAll(step = 1) {
    for (let i = 0; i < this.variant.count; i += step) {
      await this.load(i);
    }
  }

  dispose() {
    for (const ctl of this.speculative.values()) ctl.abort();
    this.speculative.clear();
    for (const i of this.bitmaps.keys()) this.budget?.release(this, i);
    for (const b of this.bitmaps.values()) if ("close" in b) b.close();
    this.bitmaps.clear();
    this.order.length = 0;
    this.listeners.clear();
  }
}
