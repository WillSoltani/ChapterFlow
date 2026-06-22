"use client";

/**
 * RecallAmbient — the page's depth field.
 *
 * A single FIXED layer behind all content that turns the flat near-black canvas
 * into a lit room: a slow drifting aurora and a top spotlight seat the page in
 * light, two soft accent blooms (the ONE periwinkle hue, very low opacity) add
 * depth, a base vignette darkens the edges, and a whisper of procedural film
 * grain breaks up the flatness. The two blooms drift gently in opposite
 * directions as you scroll (a slow parallax) so the backdrop feels alive, not
 * static, Apple product-page depth. Drift is transform-only (off the main
 * thread) and disabled under prefers-reduced-motion; the aurora animation is a
 * pure-CSS keyframe (`.rl-ambient-aurora` in globals.css) that no-ops under
 * reduced motion too.
 *
 * Token-only color, pointer-events-none, aria-hidden. The sections above render
 * transparent so these blooms read through the whole page.
 */
import { motion, useScroll, useTransform } from "framer-motion";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

export function RecallAmbient() {
  // Honor BOTH the OS setting and the in-app html[data-motion="reduced"] toggle
  // (framer's useReducedMotion is OS-only); the bloom drift below reads this.
  const prefersReducedMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();

  // Gentle counter-drift across the whole scroll (subtle; depth, not spectacle).
  const yUpper = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const yLower = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const noMotion = prefersReducedMotion;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--cf-recall-bg)" }}
    >
      {/* aurora — a slow, wide accent wash drifting across the top of the page;
          the keyframe + reduced-motion guard live in globals.css (.rl-ambient-aurora) */}
      <div className="rl-ambient-aurora" />
      {/* top spotlight — a soft white cone seating the hero from above */}
      <div className="rl-ambient-spot" />

      {/* upper-right bloom — seats the hero in light */}
      <motion.div
        className="absolute -right-[10%] -top-[15%] h-[70vh] w-[70vh] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, var(--cf-recall-bloom), transparent 70%)",
          y: noMotion ? 0 : yUpper,
        }}
      />
      {/* lower-left bloom — keeps the mid/lower page from going dead-flat */}
      <motion.div
        className="absolute -bottom-[20%] -left-[12%] h-[60vh] w-[60vh] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, var(--cf-recall-bloom), transparent 72%)",
          opacity: 0.7,
          y: noMotion ? 0 : yLower,
        }}
      />
      {/* base vignette — pulls the eye inward, deepens the edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(140% 110% at 50% 35%, transparent 55%, var(--cf-recall-vignette) 100%)",
        }}
      />
      {/* film grain — procedural, desaturated, barely-there */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 0.04, mixBlendMode: "overlay" }}
      >
        <filter id="recall-ambient-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={2}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#recall-ambient-grain)" />
      </svg>
    </div>
  );
}
