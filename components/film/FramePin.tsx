"use client";

/**
 * FramePin — copy that lives between two frames of the film.
 *
 * `from`/`to` are frame indices of the enclosing FilmSegment. The element
 * fades/rises in over `ease` frames after `from` and fades out over `ease`
 * frames before `to`. Opacity + transform only (compositor-safe), computed in
 * the segment's progress store so there is no per-frame React render: the
 * styles are written directly on the node, only when they changed, and the
 * node is promoted to its own layer only while it moves (see the effect).
 *
 * `hold` = true keeps the element visible after `to` (no fade-out), for the
 * last beat of a segment that hands off to body content.
 */

import { Children, isValidElement, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useSegmentStore } from "./FilmSegment";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { PIN_DEMOTE_MS, pinStyle } from "./layers";
import { PinChainContext, PinCollectContext } from "./pin-registry";
import { pin, pinHiddenAtStart, pinOpacity } from "./pins";

export { pinHiddenAtStart, pinOpacity } from "./pins";

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
  /**
   * The pin holds a primary start button (Phase 7, start button always in
   * reach). It becomes a suppression zone for the nav's persistent start
   * button ([data-public-sticky-cta-suppress]; "hero" also marks it
   * [data-public-hero-cta], so the nav's shows as soon as this one goes) and
   * is marked data-cta-off while its button is not shown: its effective
   * opacity below one half. The nav watches that attribute (no layout read).
   * Only the mounted pin sets it (never the server HTML).
   */
  startCta?: "hero" | "chapter";
  /**
   * Own opacity below which the button counts as not shown (default 0.5).
   * A pin inside a scrim that fades on the same curve shows at o², so it
   * passes Math.SQRT1_2: the switch lands where the button is at one half.
   */
  ctaOnAt?: number;
};

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
  startCta,
  ctaOnAt = 0.5,
}: Props) {
  const y = yProp ?? (scrim ? 0 : 18);
  const ref = useRef<HTMLElement | null>(null);
  const store = useSegmentStore();
  const reduced = usePrefersReducedMotion();
  // Tests only (pins.test.tsx): report this pin with the scrims around it.
  const collect = useContext(PinCollectContext);
  const outer = useContext(PinChainContext);
  const chain = collect ? [...outer, pin(from, to, { ease, hold })] : null;
  if (collect && chain) collect.pin(store.id, chain, textOf(children));

  // Server HTML carries no inline opacity: crawlers and no-JS readers get all
  // the copy. A pin that is off at its chapter's first frame is marked
  // data-frame-later, and CSS keeps it hidden until the reel arms (with a
  // no-JS failsafe, globals.css "First paint"). Then a live browser arms the
  // pin here and scrubs it.
  //
  // Layers: a pin holds no permanent will-change. It is promoted only while
  // its values are changing and demoted PIN_DEMOTE_MS after they settle, or
  // at once when it comes to rest at opacity 0. Values are quantised
  // (layers.ts) and every style is written only when its string changed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastO = "";
    let lastT: string | null = "";
    let lastHidden: boolean | null = null;
    let lastCtaOff: boolean | null = null;
    let promoted = false;
    let changedAt = 0;
    let timer = 0;
    const demote = () => {
      window.clearTimeout(timer);
      timer = 0;
      if (!promoted) return;
      promoted = false;
      el.style.willChange = "";
    };
    const settle = () => {
      const idle = performance.now() - changedAt;
      if (idle >= PIN_DEMOTE_MS - 1) demote();
      else timer = window.setTimeout(settle, PIN_DEMOTE_MS - idle);
    };
    let first = true;
    const apply = () => {
      const o = pinOpacity(store.getFrame(), from, to, Math.max(1, ease), hold);
      if (startCta) {
        const off = o < ctaOnAt;
        if (off !== lastCtaOff) {
          lastCtaOff = off;
          if (off) el.setAttribute("data-cta-off", "");
          else el.removeAttribute("data-cta-off");
        }
      }
      const s = pinStyle(o, y, scrim, reduced);
      const moved = s.opacity !== lastO || (s.transform !== null && s.transform !== lastT);
      if (!moved) return;
      if (s.opacity !== lastO) {
        lastO = s.opacity;
        el.style.opacity = s.opacity;
      }
      if (s.transform !== null && s.transform !== lastT) {
        lastT = s.transform;
        el.style.transform = s.transform;
      }
      // A pin that is off is hidden by its opacity only: it stays in the
      // accessibility tree and its links in the tab order (keyboard focus
      // brings it on, FilmSegment). Its links stop taking pointer events.
      const hidden = s.opacity === "0";
      if (hidden !== lastHidden) {
        lastHidden = hidden;
        if (interactive) el.style.pointerEvents = hidden ? "none" : "";
      }
      // The first write arms the pin at mount: nothing is moving yet.
      if (first) {
        first = false;
        return;
      }
      if (hidden) {
        demote();
        return;
      }
      changedAt = performance.now();
      if (!promoted) {
        promoted = true;
        el.style.willChange = scrim ? "opacity" : "opacity, transform";
      }
      if (!timer) timer = window.setTimeout(settle, PIN_DEMOTE_MS);
    };
    apply();
    const off = store.subscribe(apply);
    return () => {
      off();
      demote();
    };
  }, [store, from, to, ease, hold, y, reduced, scrim, startCta, ctaOnAt, interactive]);

  // The chapter reads a focused element's pins (FilmSegment, keyboard focus).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return store.registerPin(el, pin(from, to, { ease, hold }));
  }, [store, from, to, ease, hold]);

  // data-cta-off is never server-rendered: only the effect above, which
  // drives the pin's opacity, may claim its button is not shown. If it never
  // runs, the readable layout (readable-layout.ts) shows every pin, and the
  // nav must then count this button as shown (Phase 7 review).
  const Tag = as as "div";
  return (
    <Tag
      ref={ref as never}
      data-frame-pin={scrim ? undefined : ""}
      data-frame-scrim={scrim ? "" : undefined}
      data-frame-later={pinHiddenAtStart(from, to, ease, hold) ? "" : undefined}
      data-public-sticky-cta-suppress={startCta ? "" : undefined}
      data-public-hero-cta={startCta === "hero" ? "" : undefined}
      className={`${interactive ? "pointer-events-auto" : ""} ${className ?? ""}`}
      style={style}
    >
      {chain && scrim ? <PinChainContext.Provider value={chain}>{children}</PinChainContext.Provider> : children}
    </Tag>
  );
}

/** The text of a pin's children (test reports only). */
function textOf(node: ReactNode): string {
  let out = "";
  Children.forEach(node, (c) => {
    if (typeof c === "string" || typeof c === "number") out += c;
    else if (isValidElement<{ children?: ReactNode }>(c)) out += textOf(c.props.children);
  });
  return out.replace(/\s+/g, " ").trim().slice(0, 50);
}
