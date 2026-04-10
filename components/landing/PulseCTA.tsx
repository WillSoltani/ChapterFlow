"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

export function PulseCTA({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false });
  const [shouldPulse, setShouldPulse] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (isInView) {
      const timer = setTimeout(() => setShouldPulse(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setShouldPulse(false);
    }
  }, [isInView, prefersReducedMotion]);

  return (
    <motion.div
      ref={ref}
      className={className}
      animate={
        shouldPulse && !prefersReducedMotion
          ? {
              boxShadow: [
                "0 0 0 0 rgba(34, 211, 238, 0)",
                "0 0 0 8px rgba(34, 211, 238, 0.15)",
                "0 0 0 0 rgba(34, 211, 238, 0)",
              ],
            }
          : {}
      }
      transition={
        shouldPulse && !prefersReducedMotion
          ? { duration: 2.5, repeat: 2, repeatDelay: 1 }
          : {}
      }
      style={{ borderRadius: 9999 }}
    >
      {children}
    </motion.div>
  );
}
