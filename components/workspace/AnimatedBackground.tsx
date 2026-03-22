"use client";

import { motion, useReducedMotion } from "framer-motion";

export function AnimatedBackground() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      {/* Violet orb — top left */}
      <motion.div
        style={{
          position: "absolute",
          top: "-100px",
          left: "-100px",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, rgba(124, 58, 237, 0) 65%)",
          filter: "blur(60px)",
          willChange: "transform",
        }}
        animate={
          prefersReducedMotion
            ? {}
            : { x: [0, 40, -30, 20, 0], y: [0, -35, 25, -15, 0] }
        }
        transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
      />
      {/* Blue orb — center right */}
      <motion.div
        style={{
          position: "absolute",
          top: "30%",
          right: "-80px",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.10) 0%, rgba(59, 130, 246, 0) 65%)",
          filter: "blur(60px)",
          willChange: "transform",
        }}
        animate={
          prefersReducedMotion
            ? {}
            : { x: [0, -35, 30, -20, 0], y: [0, 30, -25, 35, 0] }
        }
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />
      {/* Amber orb — bottom left */}
      <motion.div
        style={{
          position: "absolute",
          bottom: "-80px",
          left: "20%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(245, 158, 11, 0.07) 0%, rgba(245, 158, 11, 0) 65%)",
          filter: "blur(60px)",
          willChange: "transform",
        }}
        animate={
          prefersReducedMotion
            ? {}
            : { x: [0, 30, -25, 20, 0], y: [0, -30, 20, -25, 0] }
        }
        transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
