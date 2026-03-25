"use client";

import { motion, useReducedMotion } from "framer-motion";

type BackgroundOrbsProps = {
  accentColor?: string;
};

export function BackgroundOrbs({
  accentColor = "#DC2626",
}: BackgroundOrbsProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Primary orb — book accent color, behind hero area */}
      <motion.div
        className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
          filter: "blur(140px)",
          opacity: 0,
        }}
        animate={{ opacity: 0.10 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.8, ease: "easeOut" as const }
        }
      />

      {/* Secondary ambient orb — soft indigo, lower-right behind chapter list */}
      <motion.div
        className="absolute -right-48 top-[60%] h-[500px] w-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, #818CF8 0%, transparent 70%)",
          filter: "blur(140px)",
          opacity: 0,
        }}
        animate={{ opacity: 0.05 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.8, ease: "easeOut" as const, delay: 0.1 }
        }
      />
    </div>
  );
}
