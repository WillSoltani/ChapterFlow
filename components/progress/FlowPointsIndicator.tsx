"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";

interface FlowPointsIndicatorProps {
  points: number;
  availableFPToday?: number;
}

export function FlowPointsIndicator({
  points,
  availableFPToday = 0,
}: FlowPointsIndicatorProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className="flex flex-col items-end gap-0.5"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.35 }}
    >
      <div className="flex items-center gap-1.5">
        <Zap
          className="h-4 w-4"
          style={{ color: "var(--cf-accent)" }}
          fill="var(--cf-accent)"
        />
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "var(--text-heading)" }}
        >
          {points.toLocaleString()} Flow Points
        </span>
      </div>
      {availableFPToday > 0 && (
        <span className="text-xs" style={{ color: "var(--cf-accent)" }}>
          +{availableFPToday} FP available
        </span>
      )}
    </motion.div>
  );
}
