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
 * Reduced-motion → the entrance plays with a zero-duration transition (instant,
 * no visible movement). We ALWAYS render the same motion.div and gate only the
 * BEHAVIOR — never swap the element type — and read the motion preference through
 * the hydration-safe usePrefersReducedMotion (server snapshot is false, so SSR
 * and the first client render agree). This avoids the hydration mismatch a
 * motion.div ↔ plain div swap would cause.
 */
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

export function RecallReaderShowcase({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      className="recall-reader-demo"
      initial={{ opacity: 0, y: 36, scale: 0.965 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
