"use client";

// Implements §8.1 — IP Balance Display (header bar: compact diamond icon + number)

import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { CounterAnimation } from "@/components/ui/CounterAnimation";

/** Geometric diamond/prism icon for Insight Points — §8.1 */
function InsightPointsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2L3 9l9 13 9-13-9-7z"
        fill="var(--accent-violet)"
        fillOpacity={0.2}
        stroke="var(--accent-violet)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M3 9h18"
        stroke="var(--accent-violet)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d="M12 2l-3.5 7M12 2l3.5 7M12 22l-5-13M12 22l5-13"
        stroke="var(--accent-violet)"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.5}
      />
    </svg>
  );
}

interface FlowPointsIndicatorProps {
  points: number;
  availableIPToday?: number;
}

export function FlowPointsIndicator({
  points,
  availableIPToday = 0,
}: FlowPointsIndicatorProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      className="flex flex-col items-end gap-0.5"
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.normal, delay: 0.35 }}
    >
      <div
        className="flex items-center gap-1.5"
        title="Insight Points (IP) — earned when you pass a quiz or finish a book. Spend them on bonus books and Pro passes."
        aria-label={`${points.toLocaleString()} Insight Points (IP). Insight Points are earned by passing quizzes and finishing books, and spent on bonus books and Pro passes.`}
      >
        <InsightPointsIcon size={16} />
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "var(--text-heading)" }}
        >
          <CounterAnimation
            key={points}
            target={points}
            duration={0.8}
            className="text-sm font-semibold tabular-nums"
          />{" "}
          Insight Points (IP)
        </span>
      </div>
      {availableIPToday > 0 && (
        <span className="text-xs" style={{ color: "var(--accent-violet)" }}>
          +{availableIPToday} IP available
        </span>
      )}
    </motion.div>
  );
}
