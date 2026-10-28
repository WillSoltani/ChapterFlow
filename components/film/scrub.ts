/**
 * Pure scrub math for FilmBackdrop. No DOM writes, no React — unit-testable.
 */

import type { SegmentRegistration } from "./types";

export type ActivePick = {
  seg: SegmentRegistration;
  /** 0..1 scroll progress through the segment's sticky travel. */
  progress: number;
};

/**
 * Given segment rects (top relative to viewport, height) and the viewport
 * height, pick the active segment and its progress.
 *
 * Rules:
 *   • Active = the LAST segment whose box has entered the viewport from the
 *     bottom (top < vh) and not yet left through the top (top + height > 0).
 *   • The first segment scrubs over its sticky travel (height − vh).
 *   • Every later segment scrubs over travel + vh: it starts playing the
 *     moment its box crosses the viewport bottom — while the previous stage
 *     slides out — and reaches its last frame when its own travel is spent.
 *     So the reel never freezes on a chapter's last frame for a whole
 *     viewport of scroll, then cuts: the next film is already moving, and the
 *     dissolve rides the slide-in.
 *   • Before the first segment: hold frame 0 of the first.
 *   • In a gap between segments, or after the last: hold the most recent one.
 */
export function pickActive(
  segs: SegmentRegistration[],
  rects: Array<{ top: number; height: number }>,
  vh: number,
): ActivePick | null {
  let pick: ActivePick | null = null;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const rect = rects[i];
    if (!seg || !rect) break;
    const { top, height } = rect;
    const travel = height - vh;
    if (i === 0 && top > 0) return { seg, progress: 0 };
    if (top >= vh) break;
    if (top + height <= 0) {
      pick = { seg, progress: 1 };
      continue;
    }
    const lead = i === 0 ? 0 : vh;
    const span = travel + lead;
    pick = { seg, progress: span > 0 ? clamp01((lead - top) / span) || 0 : 1 };
  }
  return pick;
}

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Quantise progress to N discrete steps (reduced motion). */
export function quantise(p: number, steps: number): number {
  if (steps <= 0) return p;
  return Math.round(p * steps) / steps;
}

export function frameAt(p: number, count: number): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(p * (count - 1))));
}

/** Cover-fit rect for drawing image (iw×ih) into canvas (cw×ch). */
export function coverRect(
  cw: number,
  ch: number,
  iw: number,
  ih: number,
  originX = 0.5,
  originY = 0.5,
) {
  const scale = Math.max(cw / iw, ch / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: (cw - w) * originX, y: (ch - h) * originY, w, h };
}

/** Slow sinusoidal breath amplitude in [0, amp]. */
export function breathAt(t: number, amp: number, period = 2600): number {
  if (amp <= 0) return 0;
  return amp * (0.5 + 0.5 * Math.sin(t / period));
}
