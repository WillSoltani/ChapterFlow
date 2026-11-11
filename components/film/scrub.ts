/**
 * Pure scrub math for FilmBackdrop. No DOM writes, no React — unit-testable.
 */

import type { FilmVariant, SegmentRegistration } from "./types";

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

/**
 * Breath clock offset across a loop stop. The loop stops (reel ended, tab
 * hidden) with the breath frozen at its last value; on the restart, the time
 * since the last ticked frame (`lastTick`) is added to the offset, so
 * breathAt(now − offset) resumes exactly where it froze instead of jumping by
 * up to the breath amplitude in one frame.
 */
export function holdBreathClock(offset: number, lastTick: number, now: number): number {
  return now > lastTick ? offset + (now - lastTick) : offset;
}

/**
 * Canvas backing store for a box of boxW × boxH CSS px: device pixels, DPR
 * capped at 2, and never wider than the 1920 px source frames (a Retina
 * 2880 px canvas only upsamples them and costs 2.25× fill).
 */
export function backingSize(boxW: number, boxH: number, dpr: number, maxW = 1920): { w: number; h: number } {
  if (!(boxW > 0) || !(boxH > 0)) return { w: 0, h: 0 };
  const scale = Math.min(Math.min(dpr || 1, 2), maxW / boxW);
  return { w: Math.round(boxW * scale), h: Math.round(boxH * scale) };
}

/**
 * Vertical shift (backing px) that moves the centre of a box-centred picture
 * from the box centre to the STAGE centre. The canvas box is the large
 * viewport (100lvh), the sticky stage the small one (100svh): on a phone the
 * picture stays centred on the stage whether the address bar shows or not.
 * 0 when the stage fills the box (desktop), so nothing moves there.
 */
export function stageShift(stageCss: number, boxCss: number, backingH: number): number {
  if (!(boxCss > 0)) return 0;
  return ((stageCss - boxCss) / 2) * (backingH / boxCss);
}

/**
 * Where a frame (iw × ih) is drawn on a canvas of cw × ch backing px: cover-
 * fit to the canvas, grown by the breath `zoom` around (0.5, 0.45), then moved
 * down by `shiftY` (see stageShift). The scale depends on the canvas box only.
 */
export function framePlacement(cw: number, ch: number, iw: number, ih: number, zoom: number, shiftY = 0) {
  const r = coverRect(cw, ch, iw, ih);
  const w = r.w * (1 + zoom);
  const h = r.h * (1 + zoom);
  return { x: r.x - (w - r.w) * 0.5, y: shiftY + r.y - (h - r.h) * 0.45, w, h };
}

/**
 * Where a variant's frame image (iw × ih) is drawn. A plain variant: its own
 * framePlacement. A band tier (`frame` + `band`): the VIRTUAL frame
 * (1080×1920) is placed by framePlacement exactly as the full portrait frame
 * was, and the image fills the band's rectangle inside it, so every picture
 * pixel lands where the full frame put it (to within resampling). The image's
 * own size does not enter: a 900×810 and a 1080×972 tier land on the same rect.
 */
export function variantPlacement(
  cw: number,
  ch: number,
  v: Pick<FilmVariant, "width" | "height" | "frame" | "band">,
  iw: number,
  ih: number,
  zoom: number,
  shiftY = 0,
) {
  const { frame, band } = v;
  if (!frame || !band) return framePlacement(cw, ch, iw, ih, zoom, shiftY);
  const r = framePlacement(cw, ch, frame.w, frame.h, zoom, shiftY);
  const sx = r.w / frame.w;
  const sy = r.h / frame.h;
  return { x: r.x + band.x * sx, y: r.y + band.y * sy, w: band.w * sx, h: band.h * sy };
}

/**
 * Segment rects relative to the viewport from cached document tops: top =
 * docTop − scrollY. Writes into `out` (reused objects, no allocation per tick).
 */
export function viewportRects(
  tops: readonly number[],
  heights: readonly number[],
  scrollY: number,
  out: Array<{ top: number; height: number }>,
): Array<{ top: number; height: number }> {
  out.length = Math.min(out.length, tops.length);
  for (let i = 0; i < tops.length; i++) {
    const top = (tops[i] ?? 0) - scrollY;
    const height = heights[i] ?? 0;
    const r = out[i];
    if (r) {
      r.top = top;
      r.height = height;
    } else out.push({ top, height });
  }
  return out;
}

/**
 * The scroll position from which the LAST segment (document top `top`,
 * height `height`) sits at progress 1 for good (pickActive with vh = `stage`).
 */
export function reelEndScrollY(top: number, height: number, stage: number): number {
  return top + height - stage;
}
