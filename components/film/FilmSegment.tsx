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
 * Accessibility: the stage is `pointer-events-none` except for marked
 * interactive children; focus inside the stage snaps the window so the focused
 * element's frame is on screen (keyboard users never land mid-scrub).
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useReel } from "./reel-context";
import type { FilmManifest } from "./types";

type ProgressStore = {
  subscribe: (fn: () => void) => () => void;
  getProgress: () => number;
  getFrame: () => number;
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
  reducedSteps?: number;
  breath?: number;
  /** Reported on <html data-reel-section>; defaults to id. */
  section?: string;
  /**
   * Soft-focus the film while this segment is active (html[data-reel-soft]).
   * Used when a legible overlay (real prose) sits on top of footage whose own
   * printed text is model pseudo-text.
   */
  softFocus?: boolean;
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
  reducedSteps = 5,
  breath = 0.01,
  section,
  softFocus = false,
  ariaLabel,
  children,
  body,
  className,
}: Props) {
  const reel = useReel();
  const ref = useRef<HTMLElement | null>(null);
  const state = useRef({ progress: 0, frame: 0 });
  const listeners = useRef(new Set<() => void>());

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
    }),
    [],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return reel.register({
      index,
      el,
      film,
      dissolveIn,
      reducedSteps,
      breath,
      section: section ?? id,
      onProgress: (progress, frame) => {
        if (state.current.frame === frame && state.current.progress === progress) return;
        state.current = { progress, frame };
        for (const fn of listeners.current) fn();
      },
    });
  }, [reel, index, film, dissolveIn, reducedSteps, breath, section, id]);

  // Keyboard focus inside the sticky stage: make sure the stage is pinned.
  const onFocusCapture = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top > 0) el.scrollIntoView({ block: "start", behavior: "instant" });
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
        className={`relative ${className ?? ""}`}
        style={{ height: `${pace * 100}svh` }}
        data-soft-focus={softFocus ? "" : undefined}
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
