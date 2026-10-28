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
    return this.bitmaps.get(index);
  }

  has(index: number): boolean {
    return this.bitmaps.has(index);
  }

  /** Closest decoded frame ≤ index, else closest ≥ index, else poster. */
  nearest(index: number): ImageBitmap | HTMLImageElement | null {
    if (this.bitmaps.has(index)) return this.bitmaps.get(index)!;
    for (let i = index - 1; i >= 0; i--) {
      const b = this.bitmaps.get(i);
      if (b) return b;
    }
    for (let i = index + 1; i < this.variant.count; i++) {
      const b = this.bitmaps.get(i);
      if (b) return b;
    }
    return this.poster;
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
    }
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
    for (const b of this.bitmaps.values()) if ("close" in b) b.close();
    this.bitmaps.clear();
    this.order.length = 0;
    this.listeners.clear();
  }
}
