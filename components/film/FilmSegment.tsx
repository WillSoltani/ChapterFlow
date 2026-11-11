"use client";

/**
 * FilmSegment — one scroll-scrubbed chapter of the reel.
 *
 * Renders a tall section (`pace` × 100svh) with a sticky 100svh stage inside.
 * Scrolling through the tall section scrubs the film from frame 0 → last;
 * FilmBackdrop paints the frames, this component only reports its element and
 * exposes the live progress / frame via context to `useFrameRange` consumers.
 *
 * Children are the composed copy (headline, lede, pins) laid over the film.
 * The optional `body` renders AFTER the stage as ordinary flowing content once
 * the scrub finishes (chrome switches to "body").
 *
 * Scroll length: `pace` × 100svh, or under reduced motion one stage plus one
 * step per reduced-motion stop (`stops`, from the chapter's pins and named
 * keyframes: pins.ts reducedStops). Both are CSS (globals.css, from the
 * --film-pace and --film-stops properties set here), so the OS setting holds
 * from the first paint and the in-app toggle switches at once.
 *
 * Accessibility: the stage is `pointer-events-none` except for marked
 * interactive children. KEYBOARD focus on an element inside a pin that is not
 * fully on (or a stage that is not pinned) scrolls the window, instantly, to
 * the nearest frame where the pin and its scrims are fully on with the stage
 * pinned: a reduced-motion stop under reduced motion. Focus from a pointer
 * (not :focus-visible) never moves the page.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import { readReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { PinCollectContext } from "./pin-registry";
import {
  chainOpacity,
  focusFrame,
  frameScroll,
  fullyOnRange,
  minPinnedFrame,
  reducedStopScroll,
  type PinRange,
} from "./pins";
import { useReel } from "./reel-context";
import type { FilmManifest } from "./types";

type ProgressStore = {
  subscribe: (fn: () => void) => () => void;
  getProgress: () => number;
  getFrame: () => number;
  /** The chapter's id. */
  id: string;
  /** A FramePin's element and timing (read when keyboard focus lands in it). */
  registerPin: (el: Element, range: PinRange) => () => void;
};

const SegmentContext = createContext<ProgressStore | null>(null);

export function useSegmentStore(): ProgressStore {
  const s = useContext(SegmentContext);
  if (!s) throw new Error("useSegmentStore must be used inside <FilmSegment>");
  return s;
}

/** Live frame of the enclosing segment (re-renders on frame change). */
export function useSegmentFrame(): number {
  const s = useSegmentStore();
  return useSyncExternalStore(s.subscribe, s.getFrame, () => 0);
}

type Props = {
  id: string;
  film: FilmManifest;
  /** Index in the reel (order on the page). */
  index: number;
  /** Scroll length in viewport heights. 3 = scroll 3 screens to play the film. */
  pace?: number;
  dissolveIn?: number;
  /**
   * Reduced motion: the frames the chapter steps through (pins.ts
   * reducedStops over its pins and named keyframes), ascending.
   */
  stops: readonly number[];
  breath?: number;
  /** Reported on <html data-reel-section>; defaults to id. */
  section?: string;
  ariaLabel?: string;
  children?: ReactNode;
  body?: ReactNode;
  className?: string;
};

export function FilmSegment({
  id,
  film,
  index,
  pace = 3,
  dissolveIn = 0,
  stops,
  breath = 0.01,
  section,
  ariaLabel,
  children,
  body,
  className,
}: Props) {
  const reel = useReel();
  const ref = useRef<HTMLElement | null>(null);
  const state = useRef({ progress: 0, frame: 0 });
  const listeners = useRef(new Set<() => void>());
  const pins = useRef(new Map<Element, PinRange>());

  const store = useMemo<ProgressStore>(
    () => ({
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => {
          listeners.current.delete(fn);
        };
      },
      getProgress: () => state.current.progress,
      getFrame: () => state.current.frame,
      id,
      registerPin: (el, range) => {
        pins.current.set(el, range);
        return () => {
          if (pins.current.get(el) === range) pins.current.delete(el);
        };
      },
    }),
    [id],
  );

  // Tests only (pins.test.tsx): report the stops this chapter steps through.
  const collect = useContext(PinCollectContext);
  if (collect) collect.segment(id, film.name, stops);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return reel.register({
      index,
      el,
      film,
      dissolveIn,
      stops,
      breath,
      section: section ?? id,
      onProgress: (progress, frame) => {
        if (state.current.frame === frame && state.current.progress === progress) return;
        state.current = { progress, frame };
        for (const fn of listeners.current) fn();
      },
    });
  }, [reel, index, film, dissolveIn, stops, breath, section, id]);

  // Keyboard focus inside the stage: bring the focused element's pin on
  // (see the header). Layout is read here, in a focus handler, never in the
  // scroll path. The browser's own focus scroll runs after this handler and
  // finds the element in view.
  const onFocusCapture = (e: FocusEvent<HTMLElement>) => {
    const el = ref.current;
    const target = e.target;
    if (!el || !(target instanceof Element) || target === el) return;
    if (!keyboardFocus(target)) return;
    // The readable page (the reel never armed): plain flow, the browser's scroll.
    if (!el.closest("[data-film-armed]")) return;
    const chain: PinRange[] = [];
    for (let n: Element | null = target; n && n !== el; n = n.parentElement) {
      const r = pins.current.get(n);
      if (r) chain.unshift(r);
    }
    const stageEl = el.querySelector<HTMLElement>("[data-film-stage]");
    const stage = stageEl?.getBoundingClientRect().height || window.innerHeight;
    const box = el.getBoundingClientRect();
    const height = box.height;
    if (!(height > stage)) return;
    const pinned = box.top <= 0.5 && box.bottom >= stage - 0.5;
    if (pinned && chainOpacity(state.current.frame, chain) === 1) return;
    const top = box.top + window.scrollY;
    const y = focusScroll({ chain, stops, count: film.landscape.count, first: index === 0, height, stage, offset: window.scrollY - top, frame: state.current.frame });
    window.scrollTo({ top: top + y, behavior: "instant" as ScrollBehavior });
  };

  return (
    <SegmentContext.Provider value={store}>
      <section
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        data-film-segment=""
        data-film={film.name}
        data-index={index}
        // The reduced-motion stops, for the audits and the owner's sheets.
        data-film-stops={stops.join(",")}
        className={`relative ${className ?? ""}`}
        // Height: globals.css ([data-film-segment]), normal or reduced motion.
        style={{ "--film-pace": pace, "--film-stops": stops.length } as CSSProperties}
        onFocusCapture={onFocusCapture}
      >
        <div
          data-film-stage=""
          className="pointer-events-none sticky top-0 h-[100svh] w-full overflow-hidden [container-type:inline-size]"
        >
          {children}
        </div>
      </section>
      {body ? (
        <div data-film-body="" className="relative">
          {body}
        </div>
      ) : null}
    </SegmentContext.Provider>
  );
}

/**
 * Focus that should drive the film: keyboard focus (:focus-visible), never a
 * click or tap (a pointer focuses the element it pressed, already in view).
 */
function keyboardFocus(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Scroll offset from the chapter's top that shows the focused pin `chain`
 * fully on with the stage pinned. Reduced motion: the stop nearest the
 * current one where the chain is fully on (every pin has one, pins.ts).
 * Normal motion: the nearest such frame (focusFrame). No pin (or no frame):
 * the chapter's start.
 */
function focusScroll(a: {
  chain: readonly PinRange[];
  stops: readonly number[];
  count: number;
  first: boolean;
  height: number;
  stage: number;
  offset: number;
  frame: number;
}): number {
  const range = a.chain.length ? fullyOnRange(a.chain, a.count) : ([0, a.count - 1] as [number, number]);
  if (!range) return 0;
  if (readReducedMotion()) {
    const n = a.stops.length;
    const step = n > 1 ? (a.height - a.stage) / (n - 1) : 1;
    const now = Math.round(a.offset / step);
    let best = -1;
    a.stops.forEach((f, j) => {
      if (f < range[0] || f > range[1]) return;
      if (best < 0 || Math.abs(j - now) < Math.abs(best - now)) best = j;
    });
    return best < 0 ? 0 : reducedStopScroll(best, a.height, a.stage, n);
  }
  const f = focusFrame(range, a.frame, minPinnedFrame(a.count, a.height, a.stage, a.first), a.count - 1);
  return f === null ? 0 : frameScroll(f, a.count, a.height, a.stage, a.first);
}
