/**
 * RecallReveal — the page's one scroll-motion primitive.
 *
 * A section-level, scroll-TRIGGERED entrance: each below-the-fold section rises +
 * fades in the first time it enters the viewport, then stays. This is the fix for
 * the old design's dead feel — its cf-fade-up entrances fired on page LOAD,
 * off-screen, so the page below the fold had no life by the time you scrolled to it.
 *
 * WHY JS (IntersectionObserver) and not native CSS scroll-timeline:
 *   The native `animation-timeline: view()` approach only animates in Chromium —
 *   Safari < 26 and older Firefox render it static. This version animates on ALL
 *   browsers via IntersectionObserver, while staying just as safe against the
 *   no-JS / crawler "invisible content" trap:
 *
 *   The element renders FULLY VISIBLE by default (server HTML has no hidden state).
 *   Only AFTER the client mounts do we add `cf-reveal` (which arms the hidden
 *   opacity:0 + translateY start), then an observer adds `cf-reveal-in` to play the
 *   transition once it scrolls into view. So no-JS, crawlers, and the SSR pass all
 *   see the content; only a live, scripted browser ever hides-then-reveals it.
 *
 * Motion is compositor-safe (opacity + transform only). Under prefers-reduced-motion
 * we skip arming entirely (content stays put, no transform, no fade).
 */
"use client";

import {
  Children,
  isValidElement,
  cloneElement,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type ReactElement,
} from "react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

type RecallRevealProps = {
  children: ReactNode;
  className?: string;
  /** Extra delay before the transition starts, in ms. */
  delay?: number;
  /** Vertical travel distance of the rise-in, in px. */
  y?: number;
  /** IntersectionObserver threshold — fraction of the element that must be visible. */
  amount?: number;
  /**
   * When true, reveal the DIRECT children in sequence (incremental delay) instead
   * of the wrapper as one block. Useful for lists / card rows.
   */
  stagger?: boolean;
};

/** Per-child step (ms) applied when `stagger` is on. */
const STAGGER_STEP_MS = 90;

/** A CSS custom-property bag we can pass through inline style without `any`. */
type RevealStyle = CSSProperties & {
  "--cf-reveal-y"?: string;
  "--cf-reveal-delay"?: string;
};

export function RecallReveal({
  children,
  className,
  delay = 0,
  y = 28,
  amount = 0.18,
  stagger = false,
}: RecallRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Honor BOTH the OS setting and the in-app html[data-motion="reduced"] toggle
  // (framer's useReducedMotion is OS-only); reactive to a live toggle change.
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion: never arm the hidden state, never observe — the
    // content is already visible from SSR, so there is simply nothing to do.
    // If a live data-motion toggle flipped to reduced AFTER we armed (the hook is
    // reactive, so this effect re-runs), un-arm so nothing is left stuck at
    // opacity:0 once the observer below is torn down.
    if (prefersReducedMotion) {
      el.classList.remove("cf-reveal");
      return;
    }

    // Bail out gracefully if IntersectionObserver is unavailable (very old engines
    // / SSR safety net): leave the element visible, no reveal.
    if (typeof IntersectionObserver === "undefined") return;

    // Arm the hidden start state AFTER mount, so no-JS / crawlers never see it.
    // In stagger mode the wrapper is NOT armed — its direct children carry
    // `cf-reveal-item` and arm individually (see the CSS). Arming the wrapper too
    // would double-hide (the whole block fades AND each child staggers).
    if (!stagger) el.classList.add("cf-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("cf-reveal-in");
            // Reveal once, then stop watching.
            observer.disconnect();
            break;
          }
        }
      },
      // Clamp threshold into the valid [0, 1] range IO requires.
      { threshold: Math.min(Math.max(amount, 0), 1) },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [prefersReducedMotion, amount, stagger]);

  const style: RevealStyle = {
    "--cf-reveal-y": `${y}px`,
    "--cf-reveal-delay": `${delay}ms`,
  };

  const rootClassName = [
    stagger ? "cf-reveal-group" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // Stagger mode: tag each direct child so the CSS can give it an incremental
  // transition-delay. We set the per-child delay inline (robust regardless of how
  // many children there are, no nth-child ceiling) and add a marker class.
  const content = stagger
    ? Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{
          className?: string;
          style?: CSSProperties;
        }>;
        const childDelay = delay + index * STAGGER_STEP_MS;
        const childStyle: RevealStyle = {
          ...(el.props.style ?? {}),
          "--cf-reveal-delay": `${childDelay}ms`,
        };
        return cloneElement(el, {
          className: el.props.className
            ? `cf-reveal-item ${el.props.className}`
            : "cf-reveal-item",
          style: childStyle,
        });
      })
    : children;

  return (
    <div ref={ref} className={rootClassName || undefined} style={style}>
      {content}
    </div>
  );
}
