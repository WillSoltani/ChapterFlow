/**
 * lib/motion.ts — the single TypeScript motion-token source for framer-motion.
 *
 * Mirrors the CSS scale in app/globals.css:300-320 (--duration-* / --ease-* /
 * --cf-site-ease). framer-motion's `transition.duration` is in SECONDS, so the
 * DUR.* values are seconds whose numbers equal the CSS millisecond tokens (e.g.
 * --duration-fast: 200ms -> DUR.fast: 0.2). Import these instead of hardcoding
 * durations/eases so JS-driven (framer) and CSS-driven motion stay identical and
 * the whole app can be retuned from one place.
 *
 * North Star "Quiet Library, Earned Spark": ONE reveal ease
 * cubic-bezier(0.22,1,0.36,1) for content reveals, motion earned by progress
 * (never ambient), always useReducedMotion-guarded.
 *
 * NOTE: the system-wide migration of the remaining ~280 hardcoded framer values
 * onto this module is a separate batch (19). The two reference consumers are
 * components/ui/SectionReveal.tsx and components/ui/PageTransition.tsx.
 */

// Durations in SECONDS, mirroring the --duration-* ms tokens (globals.css:300-305).
export const DUR = {
  instant: 0.1, // --duration-instant: 100ms
  micro: 0.15, // --duration-micro:   150ms
  fast: 0.2, // --duration-fast:    200ms
  normal: 0.3, // --duration-normal:  300ms
  page: 0.4, // --duration-page:    400ms
  slow: 0.5, // --duration-slow:    500ms
  reveal: 0.7, // content reveal — SectionReveal's long, soft entrance
} as const;

// A cubic-bezier control-point tuple. Matches framer-motion's `BezierDefinition`
// (motion-utils: `readonly [number, number, number, number]`), so these are
// assignable directly to a `transition.ease`.
type Bezier = readonly [number, number, number, number];

export const EASE = {
  /** House reveal ease — cubic-bezier(0.22,1,0.36,1) = --cf-site-ease (globals.css:318). Canonical for content reveals & page transitions. */
  standard: [0.22, 1, 0.36, 1] as Bezier,
  /** Springy overshoot — cubic-bezier(0.34,1.56,0.64,1) = --ease-spring (globals.css:307). For pop/celebration accents only. */
  spring: [0.34, 1.56, 0.64, 1] as Bezier,
  /** Plain easeOut — cubic-bezier(0.25,0.1,0.25,1) = --ease-out (globals.css:306). Legacy; prefer `standard` for reveals. */
  out: [0.25, 0.1, 0.25, 1] as Bezier,
} as const;
