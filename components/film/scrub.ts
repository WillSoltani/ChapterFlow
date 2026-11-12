/**
 * Pure scrub math for FilmBackdrop. No DOM writes, no React — unit-testable.
 */

import type { BandRect, FilmVariant, FrameSize, SegmentRegistration } from "./types";

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

export const BREATH_PERIOD_MS = 2600;

/** Slow sinusoidal breath amplitude in [0, amp]. */
export function breathAt(t: number, amp: number, period = BREATH_PERIOD_MS): number {
  if (amp <= 0) return 0;
  return amp * (0.5 + 0.5 * Math.sin(t / period));
}

/**
 * Breath clock offset that puts the breath at rest at time `t`: breathAt(t −
 * offset) = 0, the bottom of the sine, so it leaves rest with zero speed. The
 * loop starts the clock at the canvas's first real paint, which then matches
 * the HTML hero poster (placed with no zoom) exactly (Phase 6).
 */
export function breathRestOffset(t: number, period = BREATH_PERIOD_MS): number {
  return t + (Math.PI / 2) * period;
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
  return breathe(coverRect(cw, ch, iw, ih), zoom, shiftY);
}

/** A placed rect grown by the breath `zoom` around (0.5, 0.45), then moved down by `shiftY`. */
function breathe(r: { x: number; y: number; w: number; h: number }, zoom: number, shiftY: number) {
  const w = r.w * (1 + zoom);
  const h = r.h * (1 + zoom);
  return { x: r.x - (w - r.w) * 0.5, y: shiftY + r.y - (h - r.h) * 0.45, w, h };
}

/**
 * Framing amount for band tiers on tall screens: 100 = cover-fit the virtual
 * frame to the canvas (today: on a tall phone the band is wider than the
 * screen and its sides are cut, up to about 20% of it), 0 = fit the band to
 * the canvas width (the whole band shows, the picture is smaller). An OWNER
 * PICK, temporary: ?frame=0|25|50|75|100 (parseFrameParam, read once by the
 * page on the server and passed down, so the HTML poster and the canvas use
 * the same amount). Landscape frames never use it.
 */
export const FRAME_AMOUNTS = [0, 25, 50, 75, 100] as const;
export type FrameAmount = (typeof FRAME_AMOUNTS)[number];
export const DEFAULT_FRAME_AMOUNT: FrameAmount = 100;

/** ?frame=<amount> from a query string or Next searchParams; anything but the five amounts is the default. */
export function parseFrameParam(search: string | Record<string, string | string[] | undefined>): FrameAmount {
  const raw = typeof search === "string" ? new URLSearchParams(search).get("frame") : search.frame;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const hit = FRAME_AMOUNTS.find((a) => String(a) === v);
  return hit ?? DEFAULT_FRAME_AMOUNT;
}

/**
 * Scale of a band tier's virtual frame (`frame`, band `band` inside it) on a
 * canvas of cw × ch at framing `amount` (0..100): linear between fitting the
 * band to the width (never more than cover) and cover. 100 returns the cover
 * scale itself (not a lerp), so the default is today's placement bit for bit.
 * Where the canvas is wider than the frame's aspect (tablets) both ends are
 * the cover scale and the amount changes nothing.
 */
export function bandFitScale(cw: number, ch: number, frame: FrameSize, band: BandRect, amount: number): number {
  const cover = Math.max(cw / frame.w, ch / frame.h);
  if (!(amount < 100)) return cover;
  const width = Math.min(cw / band.w, cover);
  return width + (cover - width) * (Math.max(0, amount) / 100);
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
  amount: number = DEFAULT_FRAME_AMOUNT,
) {
  const { frame, band } = v;
  if (!frame || !band) return framePlacement(cw, ch, iw, ih, zoom, shiftY);
  let r: { x: number; y: number; w: number; h: number };
  if (amount < 100) {
    // Framing amount (bandFitScale): the virtual frame at that scale, centred
    // on the canvas like coverRect, then the same breath and stage shift.
    const k = bandFitScale(cw, ch, frame, band, amount);
    const w = frame.w * k;
    const h = frame.h * k;
    r = breathe({ x: (cw - w) * 0.5, y: (ch - h) * 0.5, w, h }, zoom, shiftY);
  } else r = framePlacement(cw, ch, frame.w, frame.h, zoom, shiftY);
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

/** The kind of the last scroll input (use-scrub-loop tracks it with passive listeners). */
export type ScrollInput = "wheel" | "touch" | "key" | "other";

/** Default touch smoothing (ms); ?smooth=<ms> replaces it (parseSmoothParam). */
export const TOUCH_SMOOTHING_MS = 35;

/**
 * Smoothing time constant (ms) for the scrub, by input. A FEEL decision: edit
 * freely. Higher = a smoother glide, but the film lags the input; lower =
 * tighter, but a wheel's 10–30 frame steps show as cuts. A wheel needs the
 * glide; a finger is already continuous, so it gets a short one and the film
 * stays under the finger. 0 = no smoothing. Phone values to try with
 * ?smooth=: 0, 20, 35, 50, 90.
 */
export function smoothingMs(input: ScrollInput, touchMs: number = TOUCH_SMOOTHING_MS): number {
  if (input === "touch") return touchMs;
  return 90;
}

/** ?smooth=<ms>: an integer 0..200 overrides the touch smoothing; anything else is null. */
export function parseSmoothParam(search: string): number | null {
  const raw = new URLSearchParams(search).get("smooth");
  if (raw === null || !/^\d{1,3}$/.test(raw)) return null;
  const ms = Number(raw);
  return ms <= 200 ? ms : null;
}

/**
 * One step of the exponential chase of the target frame over `dtMs` (capped
 * at 50 ms) with time constant `tauMs`. 0 snaps. Within half a frame it
 * settles ON the target, so the loop's idle check (smoothed = target) holds.
 */
export function smoothFrameStep(current: number, target: number, dtMs: number, tauMs: number): number {
  if (!(tauMs > 0)) return target;
  const k = 1 - Math.exp(-Math.min(50, dtMs) / tauMs);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.5 ? target : next;
}

const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Spacebar", "Home", "End"]);

/** Keys that scroll the page (keyboard scrolling). */
export function isScrollKey(key: string): boolean {
  return SCROLL_KEYS.has(key);
}

/** A wheel or key input this old (ms) no longer explains a scroll. */
const INPUT_STALE_MS = 400;

/**
 * The input a scroll at `now` is attributed to, given the last input kind and
 * when it arrived. A wheel or key input older than 400 ms does not explain a
 * scroll (a programmatic scroll, an anchor jump, a scrollbar drag): "other".
 * Touch holds until another input: a fling scrolls for seconds after the
 * finger lifts.
 */
export function scrollInputAt(kind: ScrollInput, inputAt: number, now: number): ScrollInput {
  if ((kind === "wheel" || kind === "key") && now - inputAt > INPUT_STALE_MS) return "other";
  return kind;
}

/**
 * The body after the reel is opaque from this share of a stage height below
 * its top ([data-film-body] in globals.css: the film fades into it over the
 * first 10svh, solid by 30svh).
 */
export const BODY_OPAQUE_STAGES = 0.3;

/**
 * The scroll position from which nothing of the canvas can show: the LAST
 * segment (document top `top`, height `height`) has left the viewport and so
 * has the body's translucent top. Below it the canvas wrapper is hidden (not
 * composited); above it, visible.
 */
export function canvasHiddenFrom(top: number, height: number, stage: number): number {
  return top + height + BODY_OPAQUE_STAGES * stage;
}
