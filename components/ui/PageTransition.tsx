"use client";

import { useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";

// Client-only "mounted" flag without setState-in-effect (mirrors SectionReveal):
// false during SSR + the first hydration render, true otherwise. A page mounted
// during client-side navigation (not hydration) reads `true` on its first render,
// so the entrance animation still plays on in-app navigations.
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );

  // CRITICAL: always render the SAME element (`motion.div`) and gate every
  // client-only signal behind `mounted`, exactly like SectionReveal. Until
  // mounted is true the output is identical on the server and the first client
  // render — fully visible (opacity:1, no transform), no animation. This removes
  // the hydration mismatch / content-stuck-invisible risk the old reduced-motion
  // early-return carried (it returned a bare div before reaching the motion
  // path): the server (reduced-motion unknown -> false) rendered a motion.div at
  // initial opacity:0 wrapping the whole page while a reduced-motion client
  // rendered a plain div, leaving the page stuck at the server's inline opacity.
  // Reduced-motion users
  // now stay visible with no animation; the fade-in only ever applies to
  // motion-enabled clients.
  const animateEntrance = mounted && !prefersReducedMotion;

  const shown = { opacity: 1, y: 0 };
  const hidden = { opacity: 0, y: 12 };

  return (
    <motion.div
      className={className}
      initial={animateEntrance ? hidden : shown}
      animate={shown}
      transition={
        animateEntrance
          ? { duration: DUR.page, ease: EASE.standard }
          : { duration: 0 }
      }
    >
      {children}
    </motion.div>
  );
}
