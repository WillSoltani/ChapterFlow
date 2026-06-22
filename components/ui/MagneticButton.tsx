"use client";

import { useRef } from "react";
import { m, useMotionValue, useSpring } from "framer-motion";
import { SPRING } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

/**
 * MagneticButton — a tactile, load-bearing CTA micro-interaction: the wrapped
 * element softly pulls toward the cursor and springs back on leave. Unlike an
 * always-on pulse/throb (off-brand for a calm product), this only moves in
 * response to the user's own cursor, so it reads as "this is interactive,"
 * not "look at me."
 *
 * Accessibility: under `prefers-reduced-motion` the pointer handler no-ops (no
 * movement at all). We ALWAYS render the same `m.span` (handlers don't change
 * SSR output and x/y start at 0), so SSR and hydration match — no element-type
 * swap, no hydration mismatch. Touch devices never fire mousemove, so they get
 * the static button for free. Uses the lightweight `m` under LandingMotionProvider.
 */
export function MagneticButton({
  children,
  className,
  strength = 0.3,
  max = 12,
}: {
  children: React.ReactNode;
  className?: string;
  /** Fraction of cursor-offset the element follows (0..1). */
  strength?: number;
  /** Max pull distance in px on each axis. */
  max?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING.magnetic);
  const springY = useSpring(y, SPRING.magnetic);

  const clamp = (v: number) => Math.max(-max, Math.min(max, v));

  const handleMove = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(clamp((e.clientX - (r.left + r.width / 2)) * strength));
    y.set(clamp((e.clientY - (r.top + r.height / 2)) * strength));
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <m.span
      ref={ref}
      className={className}
      style={{ x: springX, y: springY, display: "inline-block" }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
    >
      {children}
    </m.span>
  );
}
