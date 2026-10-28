"use client";

/**
 * HallText — real English prose on the corridor walls of P01.
 *
 * The footage walls are blank cotton-rag (video models can't render real
 * words). This layer puts REAL sentences from the Atomic Habits package on
 * both walls with CSS 3D perspective so they recede with the corridor, then —
 * on the `compress` beat — most lines dim and the three "kept" lines peel
 * forward and catch the accent.
 *
 * Driven by the segment's frame store (no React re-render per frame):
 *   enter … compress    all lines visible, dim ink
 *   compress … lines_lit non-kept lines fade; kept lines brighten + lift 6px
 *   lines_lit … end      kept lines hold, dolly parallax continues
 *
 * Transform + opacity only. Reduced motion: static final state.
 */

import { useEffect, useRef } from "react";
import { useSegmentStore } from "./FilmSegment";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

type Line = { text: string; keep?: boolean };

const WALL_LINES: Line[] = [
  { text: "The orchestra has not sounded better in eight weeks, and that is exactly when most teachers reseat the section." },
  { text: "Useful change arrives by steps, not leaps.", keep: true },
  { text: "Nothing on the scoreboard moves for a long time. Then it moves all at once, and people call it luck." },
  { text: "Small inputs stay hidden until a threshold breaks.", keep: true },
  { text: "A single degree of change feels like nothing in the room. It is everything over a year." },
  { text: "You quit one week before the bend, and you never find out it was there." },
  { text: "Protect the system while results lag.", keep: true },
  { text: "He did not get faster. His station did." },
];

const LEFT = WALL_LINES.slice(0, 4);
const RIGHT = WALL_LINES.slice(4);

export function HallText({ compress, litAt, end }: { compress: number; litAt: number; end: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const store = useSegmentStore();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const lines = Array.from(root.querySelectorAll<HTMLElement>("[data-line]"));
    let last = -1;
    const apply = () => {
      const f = store.getFrame();
      if (f === last) return;
      last = f;
      // 0 → 1 across the compress window
      const k = Math.min(1, Math.max(0, (f - compress) / Math.max(1, litAt - compress)));
      // slow dolly parallax across the whole film (walls slide toward camera)
      const dolly = reduced ? 1 : f / Math.max(1, end);
      root.style.setProperty("--hall-dolly", dolly.toFixed(4));
      // The first ~14 frames are the dissolve from the previous film's doorway
      // close-up; hold the prose back until the corridor is on screen, then
      // ease it in. (Per-line opacity below is untouched, so the compress
      // choreography and its test read the same values.)
      const fadeIn = reduced ? 1 : Math.min(1, Math.max(0, (f - 10) / 20));
      root.style.opacity = (fadeIn * fadeIn * (3 - 2 * fadeIn)).toFixed(3);
      for (const el of lines) {
        const keep = el.dataset.keep === "1";
        const o = keep ? 0.55 + 0.45 * k : 0.55 * (1 - k);
        el.style.opacity = o.toFixed(3);
        el.style.transform = reduced ? "none" : `translate3d(0, 0, ${(keep ? 14 * k : 0).toFixed(1)}px)`;
        el.style.color = keep && k > 0.5 ? "var(--cf-recall-accent)" : "var(--cf-recall-ink)";
      }
    };
    apply();
    return store.subscribe(apply);
  }, [store, compress, litAt, end, reduced]);

  return (
    <div ref={ref} className="hall-text" aria-hidden>
      <div className="hall-wall hall-wall-left">
        {LEFT.map((l, i) => (
          <p key={i} data-line="" data-keep={l.keep ? "1" : "0"} className="hall-line">
            {l.text}
          </p>
        ))}
      </div>
      <div className="hall-wall hall-wall-right">
        {RIGHT.map((l, i) => (
          <p key={i} data-line="" data-keep={l.keep ? "1" : "0"} className="hall-line">
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}
