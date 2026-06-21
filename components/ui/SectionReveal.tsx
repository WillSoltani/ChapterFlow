"use client";

import { useRef, useSyncExternalStore } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";

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

  // No-JS / hydration robustness: SSR and the first client render are visible
  // (opacity:1). Only after the component mounts on the client do we arm the
  // opacity:0 -> 1 reveal. This guarantees below-the-fold content stays visible
  // if JS is disabled, IntersectionObserver is unsupported, or hydration stalls.
  // The in-view animation feel is unchanged for JS users.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );

  // Calm, intentional rise — a short offset reads as "settling into place" rather
  // than the long template fade-up. (Full per-preset reveal vocabulary is a
  // separate refinement; the resting composition is already art-directed.)
  const initialOffset =
    direction === "up"
      ? { y: 14, x: 0 }
      : direction === "left"
        ? { x: -16, y: 0 }
        : { x: 16, y: 0 };

  const hidden = { opacity: 0, ...initialOffset };
  const shown = { opacity: 1, x: 0, y: 0 };

  // CRITICAL: we always render the SAME element (`motion.div`) and gate every
  // client-only signal (useReducedMotion / useInView) behind `mounted`. Until
  // mounted is true, the output is identical on the server and the first client
  // render — fully visible, no transform, no animation. This removes the
  // hydration mismatch that the old `if (prefersReducedMotion) return <div>`
  // early-return caused: the server (reduced-motion unknown -> false) rendered a
  // <motion.div> with an inline style, while a reduced-motion client rendered a
  // bare <div> with none, and React ("won't be patched up") left content stuck
  // at the server's inline opacity. Reduced-motion users now stay visible with
  // no animation; the reveal only ever applies to motion-enabled clients.
  const allowReveal = mounted && !prefersReducedMotion;

  // After mount, motion-enabled below-the-fold blocks snap to `hidden` instantly
  // (no visible fade-out — they are off-screen), then animate the reveal on
  // scroll-in with the original easing once `isInView` flips true.
  const target = allowReveal && !isInView ? hidden : shown;
  const revealing = allowReveal && isInView;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={shown}
      animate={target}
      transition={
        revealing
          ? { duration: DUR.reveal, delay, ease: EASE.standard }
          : { duration: 0 }
      }
    >
      {children}
    </motion.div>
  );
}
