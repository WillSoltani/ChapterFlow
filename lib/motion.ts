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

/**
 * Stagger timings for cascade reveals (a list/grid of children entering in
 * sequence). ONE source so every cascade on the marketing page shares the same
 * rhythm — the "calm/intentional" orchestration the landing redesign enforces.
 * `childDelay` is the per-child offset; `viewportAmount` is how much of the
 * container must be in view before the cascade arms (matches SectionReveal's
 * 0.15) so a fast scroll doesn't fire every section's cascade at once.
 */
export const STAGGER = {
  childDelay: 0.08, // seconds between consecutive children
  viewportAmount: 0.15, // fraction of the container visible before arming
} as const;

/**
 * Spring presets for framer-motion `useSpring` / `transition: { type: "spring" }`.
 * `progress` smooths a scroll-linked MotionValue (e.g. the page progress bar) so
 * it eases rather than tracking 1:1; `magnetic` is the soft pull-back used by the
 * primary CTA hover. Kept here so scroll/CTA motion stays retunable from one place.
 */
export const SPRING = {
  /** Smooths a scroll-progress MotionValue (low stiffness, well damped, no overshoot). */
  progress: { stiffness: 120, damping: 30, restDelta: 0.001 },
  /** Magnetic CTA pull — a touch of overshoot for a tactile "snap". */
  magnetic: { stiffness: 300, damping: 20, mass: 0.6 },
} as const;

/**
 * `useScroll({ offset })` presets for element-relative scroll tracking. The
 * tuple maps [target-edge meets container-edge] start -> end; progress runs 0->1
 * between them. `pinnedSection` tracks a tall section from top-aligned to
 * bottom-aligned — the right window for a pinned/sticky scrub; `enterLeave`
 * tracks an element across the viewport. NOTE: the page-wide progress bar must use the
 * DEFAULT document `useScroll()` (no target), which auto-accounts for total page
 * height — so it never desyncs when a tall pinned section changes that height.
 */
export const SCROLL_OFFSET = {
  /** A tall section pinned across the viewport: progress 0 at top-aligned, 1 at bottom-aligned. */
  pinnedSection: ["start start", "end end"] as const,
  /** An element entering then leaving the viewport: 0 as it enters bottom, 1 as it exits top. */
  enterLeave: ["start end", "end start"] as const,
} as const;
