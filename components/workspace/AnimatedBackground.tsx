"use client";

import { motion, useReducedMotion } from "framer-motion";

export function AnimatedBackground() {
  const prefersReducedMotion = useReducedMotion();

  const orbs = [
    {
      className: "left-[-10%] top-[-5%]",
      size: 600,
      color: "rgba(124, 58, 237, 0.08)",
      duration: 45,
      dx: 30,
      dy: 20,
    },
    {
      className: "right-[-5%] top-[20%]",
      size: 500,
      color: "rgba(59, 130, 246, 0.06)",
      duration: 55,
      dx: -25,
      dy: 30,
    },
    {
      className: "left-[10%] bottom-[5%]",
      size: 400,
      color: "rgba(245, 158, 11, 0.04)",
      duration: 50,
      dx: 20,
      dy: -25,
    },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${orb.className}`}
          style={{
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            filter: "blur(120px)",
            willChange: prefersReducedMotion ? "auto" : "transform",
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  x: [0, orb.dx, -orb.dx * 0.5, 0],
                  y: [0, -orb.dy, orb.dy * 0.7, 0],
                }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: orb.duration,
                  repeat: Infinity,
                  ease: "linear",
                }
          }
        />
      ))}
    </div>
  );
}
