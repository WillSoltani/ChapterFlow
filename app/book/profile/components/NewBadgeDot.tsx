"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

export function NewBadgeDot() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.span
      className="absolute -right-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-accent-amber"
      animate={
        reducedMotion
          ? { scale: 1, opacity: 1 }
          : { scale: [1, 1.3, 1], opacity: [0.7, 1, 1] }
      }
      transition={reducedMotion ? { duration: 0 } : { duration: 1.2, repeat: 1, ease: "easeInOut" }}
    />
  );
}
