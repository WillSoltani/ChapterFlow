"use client";

import { useRef, useSyncExternalStore } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// Client-only "mounted" flag without setState-in-effect: returns false during
// SSR + the first hydration render, then true on the client after hydration.
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface SectionRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
}

export function SectionReveal({
  children,
  className,
  delay = 0,
  direction = "up",
}: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const prefersReducedMotion = useReducedMotion();

  // No-JS robustness: SSR and the first client render are visible
  // (opacity:1). Only after the component mounts on the client do we
  // arm the opacity:0 -> 1 reveal. This guarantees below-the-fold
  // content stays visible if JS is disabled, IntersectionObserver is
  // unsupported, or hydration stalls. The in-view animation feel is
  // unchanged for JS users.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const initialOffset =
    direction === "up"
      ? { y: 24, x: 0 }
      : direction === "left"
        ? { x: -24, y: 0 }
        : { x: 24, y: 0 };

  // Until mounted (SSR / no-JS), render fully visible with no transform.
  const hidden = { opacity: 0, ...initialOffset };
  const shown = { opacity: 1, x: 0, y: 0 };

  // After mount, below-the-fold blocks snap to `hidden` instantly (no
  // visible fade-out — they are off-screen), then animate the reveal on
  // scroll-in with the original easing once `isInView` flips true.
  const target = mounted && !isInView ? hidden : shown;
  const revealing = target === shown && mounted;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={shown}
      animate={target}
      transition={
        revealing
          ? { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0 }
      }
    >
      {children}
    </motion.div>
  );
}
