"use client";

/**
 * FramePin — copy that lives between two frames of the film.
 *
 * `from`/`to` are frame indices of the enclosing FilmSegment. The element
 * fades/rises in over `ease` frames after `from` and fades out over `ease`
 * frames before `to`. Opacity + transform only (compositor-safe), computed in
 * the segment's progress store so there is no per-frame React render — we
 * write CSS custom properties directly on the node.
 *
 * `hold` = true keeps the element visible after `to` (no fade-out), for the
 * last beat of a segment that hands off to body content.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useSegmentStore } from "./FilmSegment";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

type Props = {
  from: number;
  to: number;
  ease?: number;
  hold?: boolean;
  /** Rise distance in px. */
  y?: number;
  as?: "div" | "h1" | "h2" | "p" | "ul" | "li" | "span";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Allow pointer events (links/buttons) inside this pin. */
  interactive?: boolean;
  /**
   * Scrim container: a wrapper (e.g. `.film-halo` / `.film-box`) whose own
   * opacity must follow the pins inside it, so its gradient never lingers over
   * the footage after the copy has faded. Fades only (no rise) and is tagged
   * `data-frame-scrim` instead of `data-frame-pin`, so the audit judges the
   * pins inside it rather than the wrapper's box.
   */
  scrim?: boolean;
};

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

export function FramePin({
  from,
  to,
  ease = 6,
  hold = false,
  y: yProp,
  as = "div",
  className,
  style,
  children,
  interactive = false,
  scrim = false,
}: Props) {
  const y = yProp ?? (scrim ? 0 : 18);
  const ref = useRef<HTMLElement | null>(null);
  const store = useSegmentStore();
  const reduced = usePrefersReducedMotion();

  // SSR / no-JS / crawlers see the copy fully visible (no inline opacity in the
  // server HTML). Only a live browser arms the pin and scrubs it — same
  // "visible by default, hide after mount" rule as RecallReveal.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = -1;
    const apply = () => {
      const f = store.getFrame();
      const o = pinOpacity(f, from, to, Math.max(1, ease), hold);
      if (o === last) return;
      last = o;
      el.style.opacity = String(o);
      el.style.transform = reduced ? "none" : `translate3d(0, ${((1 - o) * y).toFixed(2)}px, 0)`;
      el.style.visibility = o <= 0 ? "hidden" : "visible";
      el.setAttribute("aria-hidden", o <= 0 ? "true" : "false");
    };
    apply();
    return store.subscribe(apply);
  }, [store, from, to, ease, hold, y, reduced]);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref as never}
      data-frame-pin={scrim ? undefined : ""}
      data-frame-scrim={scrim ? "" : undefined}
      className={`${interactive ? "pointer-events-auto" : ""} will-change-[opacity,transform] ${className ?? ""}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
