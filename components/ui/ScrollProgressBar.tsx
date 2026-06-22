"use client";

import { m, useScroll, useSpring } from "framer-motion";
import { SPRING } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

/**
 * ScrollProgressBar — a thin reading-progress line fixed to the top of the
 * viewport, filling left→right as the page scrolls.
 *
 * Bound to the DEFAULT document `useScroll()` (no `target`), so `scrollYProgress`
 * is always 0→1 of the WHOLE document — it auto-accounts for the tall pinned
 * signature section changing total page height and never desyncs (see lib/motion
 * SCROLL_OFFSET note).
 *
 * Motion discipline: the bar is user-driven (it only moves when you scroll, so
 * it's outside WCAG 2.2.2 auto-motion), but the `useSpring` smoothing is itself a
 * small motion, so under `prefers-reduced-motion` we bind `scaleX` directly to
 * the raw progress (instant, no easing). `useScroll`/`useSpring` both start at 0,
 * and we always render the same `m.div`, so SSR and hydration match (scaleX:0 at
 * top in every branch). Decorative duplicate of scroll position → `aria-hidden`.
 *
 * Uses the lightweight `m` component under LandingMotionProvider's LazyMotion.
 */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const smoothed = useSpring(scrollYProgress, SPRING.progress);
  const prefersReducedMotion = usePrefersReducedMotion();
  const scaleX = prefersReducedMotion ? scrollYProgress : smoothed;

  return (
    <m.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-(--accent-cyan)"
      style={{ scaleX }}
    />
  );
}
