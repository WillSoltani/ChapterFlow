"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function AnimatedCheckmark() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div
        className="relative mx-auto"
        style={{ width: 80, height: 80 }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "rgba(62,207,178,0.15)" }}
        />
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="#3ECFB2"
            strokeWidth="3"
          />
          <path
            d="M24 42 L34 52 L56 30"
            fill="none"
            stroke="#3ECFB2"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay: 0.1,
        type: "spring",
        stiffness: 300,
        damping: 20,
      }}
      className="relative mx-auto"
      style={{ width: 80, height: 80 }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "rgba(62,207,178,0.15)" }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 30px rgba(62,207,178,0.3)" }}
      />

      {/* SVG with animated strokes */}
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <motion.circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="#3ECFB2"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
        />
        <motion.path
          d="M24 42 L34 52 L56 30"
          fill="none"
          stroke="#3ECFB2"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.4, duration: 0.35, ease: "easeOut" }}
        />
      </svg>

      {/* Post-draw pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: "2px solid rgba(62,207,178,0.3)" }}
        initial={{ scale: 1, opacity: 0 }}
        animate={{ scale: 1.3, opacity: [0, 0.5, 0] }}
        transition={{ delay: 0.85, duration: 0.6, ease: "easeOut" }}
      />
    </motion.div>
  );
}
