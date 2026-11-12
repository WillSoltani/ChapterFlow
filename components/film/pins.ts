/**
 * Pin timing: when the reel's copy (FramePin) shows, as pure functions.
 *
 *   • pinOpacity / pinHiddenAtStart: one pin's opacity at a frame (FramePin).
 *   • Chains: a pin with the scrims it sits in (a pin inside a fading scrim
 *     shows at the product of both opacities).
 *   • Reduced motion (Phase 8): the frames a chapter steps through, derived
 *     from its pins and its named keyframes (reducedStops), the scroll zone of
 *     each stop (reducedStopIndex / reducedStopScroll) and a chapter's height
 *     (reducedHeightSvh, the same formula as globals.css).
 *   • Keyboard focus (Phase 8): the frame a focused pin is brought to.
 *
 * No DOM, no React: unit-tested in pins.test.tsx against the real reel.
 */

/** A FramePin's timing (ease defaults to PIN_EASE, hold to false). */
export type PinRange = { from: number; to: number; ease?: number; hold?: boolean };
/** A chapter's pins: a pin, or a scrim with the pins inside it. */
export type PinTree = PinRange | { scrim: PinRange; pins: readonly PinTree[] };

/** FramePin's default fade length (frames). */
export const PIN_EASE = 6;

/** smoothstep: zero velocity at both ends so entrances/exits never "pop". */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function pinOpacity(frame: number, from: number, to: number, ease: number, hold: boolean): number {
  // A pin that starts at frame 0 is fully visible at rest (above-the-fold copy
  // must paint on first frame for LCP / no-scroll users).
  if (from <= 0 && frame <= 0) return 1;
  if (frame < from) return 0;
  if (from > 0 && frame < from + ease) return smooth((frame - from) / ease);
  if (hold) return 1;
  if (frame > to) return 0;
  if (frame > to - ease) return smooth((to - frame) / ease);
  return 1;
}

/**
 * True when the pin is not on at its chapter's first frame (frame 0, where
 * every chapter's store starts). Such pins are marked `data-frame-later` in
 * the server HTML and kept hidden by CSS until the reel arms (globals.css,
 * Phase 6), so the copy of later frames never piles up before hydration.
 */
export function pinHiddenAtStart(from: number, to: number, ease: number, hold: boolean): boolean {
  return pinOpacity(0, from, to, Math.max(1, ease), hold) === 0;
}

/** A pin's timing with only the options given (FramePin props, exactOptionalPropertyTypes). */
export function pin(from: number, to: number, opts: { ease?: number; hold?: boolean } = {}): PinRange {
  const r: PinRange = { from, to };
  if (opts.ease !== undefined) r.ease = opts.ease;
  if (opts.hold !== undefined) r.hold = opts.hold;
  return r;
}

const opacityOf = (frame: number, r: PinRange) => pinOpacity(frame, r.from, r.to, Math.max(1, r.ease ?? PIN_EASE), r.hold ?? false);

/** Every pin of a tree with the scrims it sits in, outermost first, the pin last (a scrim is a chain of its own). */
export function pinChains(tree: readonly PinTree[], outer: readonly PinRange[] = []): PinRange[][] {
  const out: PinRange[][] = [];
  for (const node of tree) {
    if ("scrim" in node) {
      const chain = [...outer, node.scrim];
      out.push(chain);
      out.push(...pinChains(node.pins, chain));
    } else out.push([...outer, node]);
  }
  return out;
}

/** Effective opacity of a chain at a frame: the product of its pins'. */
export function chainOpacity(frame: number, chain: readonly PinRange[]): number {
  let o = 1;
  for (const r of chain) o *= opacityOf(frame, r);
  return o;
}

/**
 * First and last frame (inclusive) of 0..count−1 where the chain is fully on,
 * or null if it never is. One interval: each pin is fully on over one
 * interval, and so is their intersection.
 */
export function fullyOnRange(chain: readonly PinRange[], count: number): [number, number] | null {
  let a = -1;
  let b = -1;
  for (let f = 0; f < count; f++) {
    if (chainOpacity(f, chain) !== 1) continue;
    if (a < 0) a = f;
    b = f;
  }
  return a < 0 ? null : [a, b];
}

/**
 * The named beats of a film as inclusive frame spans: from each key to the
 * frame before the next one; the last runs to the film's last frame. Frames
 * before `start` (a chapter's dissolve) are cut off; a beat that lies wholly
 * before it is dropped.
 */
export function beatSpans(count: number, keys: readonly number[], start = 0): Array<[number, number]> {
  const beats = [...new Set(keys.map((k) => Math.min(count - 1, Math.max(0, Math.round(k)))))].sort((x, y) => x - y);
  return beats
    .map((k, i): [number, number] => [Math.max(k, start), (beats[i + 1] ?? count) - 1])
    .filter(([a, b]) => a <= b);
}

/**
 * The frames a chapter steps through under reduced motion, ascending.
 *
 * Every pin (with its scrims) is fully on at one stop at least, and each
 * named beat is shown once: one stop inside each beat's span (beatSpans),
 * placed where the most pins not yet seen are fully on, then where the
 * fewest pins are caught mid-fade, then nearest the beat's own key. Pins no
 * beat's stop can show get the fewest extra stops that do (the classic
 * interval stabbing: each at the end of the earliest-ending pin left). The
 * choice across beats is searched, so no other placement needs fewer extras.
 * `start`: no stop before this frame (a later chapter's dissolve, where the
 * canvas still shows the previous film's last frame). Throws if a pin is
 * never fully on from `start` on (an authoring error).
 */
export function reducedStops(count: number, keys: readonly number[], tree: readonly PinTree[], opts: { start?: number } = {}): number[] {
  const start = Math.max(0, opts.start ?? 0);
  const chains = pinChains(tree);
  const ranges = chains.map((c): [number, number] => {
    const r = fullyOnRange(c, count);
    if (!r || r[1] < start) {
      const p = c[c.length - 1]!;
      throw new Error(`pin ${p.from}–${p.to} is never fully on${start ? ` from frame ${start}` : ""}`);
    }
    return [Math.max(r[0], start), r[1]];
  });
  const n = chains.length;
  // Per frame: which chains are fully on (as a key), and how many are mid-fade.
  const onAt: boolean[][] = [];
  const partialAt: number[] = [];
  for (let f = 0; f < count; f++) {
    const on: boolean[] = [];
    let partial = 0;
    for (const c of chains) {
      const o = chainOpacity(f, c);
      on.push(o === 1);
      if (o > 0 && o < 1) partial++;
    }
    onAt.push(on);
    partialAt.push(partial);
  }
  const spans = beatSpans(count, keys, start);
  // Candidates per beat: one frame per distinct maximal set of fully-on pins
  // (a set inside another set of the same beat is never the better pick), the
  // frame with the fewest mid-fades, then the nearest to the key.
  type Cand = { frame: number; on: boolean[]; partial: number; dist: number };
  const cands: Cand[][] = spans.map(([a, b]) => {
    const best = new Map<string, Cand>();
    for (let f = a; f <= b; f++) {
      const on = onAt[f]!;
      const k = on.map((x) => (x ? "1" : "0")).join("");
      const c: Cand = { frame: f, on, partial: partialAt[f]!, dist: f - a };
      const prev = best.get(k);
      if (!prev || c.partial < prev.partial || (c.partial === prev.partial && c.dist < prev.dist)) best.set(k, c);
    }
    const all = [...best.values()];
    const sub = (x: boolean[], y: boolean[]) => x.every((v, i) => !v || y[i]);
    const maximal = all.filter((c) => !all.some((d) => d !== c && sub(c.on, d.on) && !sub(d.on, c.on)));
    return maximal.sort((x, y) => x.partial - y.partial || x.dist - y.dist);
  });

  // Fewest stops that show the pins left (interval stabbing, earliest end first).
  const extras = (covered: boolean[]): number[] => {
    const left = ranges.map((r, i) => ({ r, i })).filter(({ i }) => !covered[i]).sort((x, y) => x.r[1] - y.r[1]);
    const hit = new Set<number>();
    const out: number[] = [];
    for (const { r, i } of left) {
      if (hit.has(i)) continue;
      // Every frame in [lo, r[1]] stabs the same pins as r[1] does.
      const stabbed = left.filter(({ r: q }) => q[0] <= r[1] && q[1] >= r[1]);
      const lo = Math.max(...stabbed.map(({ r: q }) => q[0]));
      let f = r[1];
      for (let g = r[1]; g >= lo; g--) if (partialAt[g]! < partialAt[f]!) f = g;
      out.push(f);
      for (const s of stabbed) hit.add(s.i);
    }
    return out;
  };

  let best: { picks: Cand[]; extra: number[]; cost: [number, number, number] } | null = null;
  const pick: Cand[] = [];
  const walk = (s: number) => {
    if (s === cands.length) {
      const covered = Array.from({ length: n }, (_, i) => pick.some((c) => c.on[i]));
      const extra = extras(covered);
      const cost: [number, number, number] = [
        extra.length,
        pick.reduce((t, c) => t + c.partial, 0) + extra.reduce((t, f) => t + partialAt[f]!, 0),
        pick.reduce((t, c) => t + c.dist, 0),
      ];
      if (!best || cost[0] < best.cost[0] || (cost[0] === best.cost[0] && (cost[1] < best.cost[1] || (cost[1] === best.cost[1] && cost[2] < best.cost[2]))))
        best = { picks: [...pick], extra, cost };
      return;
    }
    for (const c of cands[s]!) {
      pick.push(c);
      walk(s + 1);
      pick.pop();
    }
  };
  walk(0);
  const chosen = best as { picks: Cand[]; extra: number[] } | null;
  const frames = chosen ? [...chosen.picks.map((c) => c.frame), ...chosen.extra] : [];
  return [...new Set(frames)].sort((x, y) => x - y);
}

/**
 * Reduced motion: scroll per stop, in svh (one comfortable step: a few wheel
 * notches or one short swipe). globals.css sizes a chapter with the same
 * number: 100svh + (stops − 1) × 40svh.
 */
export const REDUCED_STEP_SVH = 40;

/** A chapter's height under reduced motion (svh): one stage plus one step per stop after the first. */
export function reducedHeightSvh(stops: number): number {
  return 100 + Math.max(0, stops - 1) * REDUCED_STEP_SVH;
}

/**
 * The stop shown at progress `p` (pickActive) of a chapter `height` px tall
 * with a `stage` px sticky stage. The stops share the pinned travel (height −
 * stage) in equal steps, each centred on its own scroll position
 * (reducedStopScroll); a later chapter's slide-in (its first stage of
 * progress, `first` false) belongs to its first stop. Uses the measured
 * height, so it holds whatever the chapter's CSS height is.
 */
export function reducedStopIndex(p: number, height: number, stage: number, first: boolean, n: number): number {
  if (n <= 1) return 0;
  const travel = height - stage;
  if (!(travel > 0)) return p >= 1 ? n - 1 : 0;
  const t = p * (first ? travel : height) - (first ? 0 : stage);
  const j = Math.round(t / (travel / (n - 1)));
  return j < 0 ? 0 : j > n - 1 ? n - 1 : j;
}

/** Scroll offset from the chapter's top at which stop `j` of `n` is centred. */
export function reducedStopScroll(j: number, height: number, stage: number, n: number): number {
  if (n <= 1) return 0;
  return (j * Math.max(0, height - stage)) / (n - 1);
}

/**
 * Pixels a scroll target keeps inside a chapter's pinned travel. At the very
 * end of the travel (the last stop, offset height − stage) the next chapter's
 * box touches the viewport's bottom edge: chapter heights are fractional (40svh
 * steps), and a browser that rounds the scroll position up by a sub-pixel
 * would make the NEXT chapter the active one (pickActive: top < vh) and draw
 * its first stop behind this chapter's copy.
 */
export const STOP_EDGE_PX = 2;

/**
 * Scroll offset from the chapter's top to scroll TO for stop `j` of `n`
 * (keyboard focus, keyboard paging): reducedStopScroll, kept STOP_EDGE_PX
 * inside the end of the pinned travel. reducedStopIndex still names stop `j`
 * there (a step is 40svh).
 */
export function reducedStopTarget(j: number, height: number, stage: number, n: number): number {
  const end = Math.max(0, height - stage);
  return Math.max(0, Math.min(reducedStopScroll(j, height, stage, n), end - STOP_EDGE_PX));
}

/**
 * Normal motion: scroll offset from the chapter's top at which frame `f`
 * shows (the inverse of pickActive + frameAt). The first chapter scrubs over
 * its pinned travel; a later one from the moment its box enters the viewport
 * (a stage above its top).
 */
export function frameScroll(f: number, count: number, height: number, stage: number, first: boolean): number {
  const p = count > 1 ? f / (count - 1) : 0;
  return first ? p * (height - stage) : p * height - stage;
}

/** The first frame of a chapter shown with its stage pinned (offset ≥ 0). */
export function minPinnedFrame(count: number, height: number, stage: number, first: boolean): number {
  if (first || !(height > 0)) return 0;
  return Math.min(count - 1, Math.ceil((stage / height) * (count - 1)));
}

/**
 * Keyboard focus, normal motion: the frame a focused pin is brought to. The
 * frame of its fully-on range `range` nearest the current one, among frames
 * shown with the stage pinned [minFrame, maxFrame], one frame inside the
 * range's ends when it is long enough (a scroll position lands within a
 * fraction of a frame). Null when no such frame exists.
 */
export function focusFrame(range: readonly [number, number], current: number, minFrame: number, maxFrame: number): number | null {
  let lo = Math.max(range[0], minFrame);
  let hi = Math.min(range[1], maxFrame);
  if (lo > hi) return null;
  if (hi - lo >= 2) {
    lo++;
    hi--;
  }
  return Math.min(hi, Math.max(lo, Math.round(current)));
}
