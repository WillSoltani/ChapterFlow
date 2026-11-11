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
 * Transform + opacity only, each written only when it changed (quantised,
 * layers.ts); colour only when a line's highlight flips. The two walls are
 * promoted only while the Hall's segment is on screen. Reduced motion:
 * static final state.
 */

import { useEffect, useRef } from "react";
import { useSegmentStore } from "./FilmSegment";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { hallLineStyle, quantOpacity } from "./layers";

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
    // Last written string per element: identical values are never written.
    const lines = Array.from(root.querySelectorAll<HTMLElement>("[data-line]")).map((el) => ({
      el,
      keep: el.dataset.keep === "1",
      o: "",
      t: "",
      lit: null as boolean | null,
    }));
    let last = -1;
    let dollyW = "";
    let rootO = "";
    const apply = () => {
      const f = store.getFrame();
      if (f === last) return;
      last = f;
      // 0 → 1 across the compress window
      const k = Math.min(1, Math.max(0, (f - compress) / Math.max(1, litAt - compress)));
      // slow dolly parallax across the whole film (walls slide toward camera);
      // 0.01 steps = about 0.3 px of wall travel on a desktop, less on a phone
      const dolly = (reduced ? 1 : f / Math.max(1, end)).toFixed(2);
      if (dolly !== dollyW) {
        dollyW = dolly;
        root.style.setProperty("--hall-dolly", dolly);
      }
      // The first ~14 frames are the dissolve from the previous film's doorway
      // close-up; hold the prose back until the corridor is on screen, then
      // ease it in. (Per-line opacity below is untouched, so the compress
      // choreography and its test read the same values.)
      const fadeIn = reduced ? 1 : Math.min(1, Math.max(0, (f - 10) / 20));
      const o = String(quantOpacity(fadeIn * fadeIn * (3 - 2 * fadeIn)));
      if (o !== rootO) {
        rootO = o;
        root.style.opacity = o;
      }
      for (const l of lines) {
        const s = hallLineStyle(l.keep, k, reduced);
        if (s.opacity !== l.o) {
          l.o = s.opacity;
          l.el.style.opacity = s.opacity;
        }
        if (s.transform !== l.t) {
          l.t = s.transform;
          l.el.style.transform = s.transform;
        }
        // Colour only when the highlight flips (its 240 ms transition then
        // runs for the lines that change, not a repaint every frame).
        if (s.lit !== l.lit) {
          l.lit = s.lit;
          l.el.style.color = s.lit ? "var(--cf-recall-accent)" : "var(--cf-recall-ink)";
        }
      }
    };
    apply();
    return store.subscribe(apply);
  }, [store, compress, litAt, end, reduced]);

  // The two walls hold a compositor layer only while the Hall's segment is
  // on screen (its frames play from the moment its top enters the viewport).
  useEffect(() => {
    const root = ref.current;
    const seg = root?.closest<HTMLElement>("[data-film-segment]");
    if (!root || !seg || typeof IntersectionObserver === "undefined") return;
    const walls = Array.from(root.querySelectorAll<HTMLElement>(".hall-wall"));
    let on: boolean | null = null;
    const io = new IntersectionObserver((entries) => {
      const visible = entries[entries.length - 1]?.isIntersecting ?? false;
      if (visible === on) return;
      on = visible;
      for (const w of walls) w.style.willChange = visible ? "transform" : "";
    });
    io.observe(seg);
    return () => {
      io.disconnect();
      for (const w of walls) w.style.willChange = "";
    };
  }, []);

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
