"use client";

/**
 * RecallReaderShowcase — frames the live in-app reader demo as a premium,
 * intentional product screen on the landing.
 *
 * Two jobs (the bright reader stays bright, per owner):
 *  1. Applies the `.recall-reader-demo` scope (globals.css): (a) FIXES the
 *     "filter bar floats mid-page" bug — neutralizes ExamplesList's inherited
 *     `sticky` + zeroes --cr-header-h + contains PhaseStepper's fixed tooltips,
 *     and (b) re-points the reader's accent from cyan to the page's periwinkle.
 *  2. ONE calm, premium entrance: the screen rises + settles + fades in as it
 *     scrolls into view, once. No mouse-follow tilt (that read as distracting) —
 *     the only ongoing motion is the product itself auto-playing its phases.
 *
 * Reduced-motion → the showcase renders directly in its meaningful final state,
 * with no hidden pre-intersection frame. We ALWAYS render the same motion.div and
 * gate only the BEHAVIOR — never swap the element type — and read the preference through
 * the hydration-safe usePrefersReducedMotion (server snapshot is false, so SSR
 * and the first client render agree). This avoids the hydration mismatch a
 * motion.div ↔ plain div swap would cause.
 */
import { m } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

export function RecallReaderShowcase({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();

  return (
    <m.div
      className="recall-reader-demo"
      initial={reduced ? false : { opacity: 0, y: 36, scale: 0.965 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
