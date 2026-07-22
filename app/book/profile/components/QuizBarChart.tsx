"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { DUR } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function QuizBarChart({
  scores,
  avg,
  best,
  last,
  trend,
}: {
  scores: number[];
  avg: number;
  best: number;
  last: number;
  trend: "up" | "down" | "steady";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-30px" });
  const maxScore = 100;

  return (
    <div ref={containerRef}>
      {/* Bar chart */}
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {scores.map((score, i) => {
          const heightPct = (score / maxScore) * 100;
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-t bg-(--cf-accent)"
              initial={{ height: 0 }}
              animate={isInView ? { height: `${heightPct}%` } : {}}
              transition={{ duration: DUR.slow, ease: "easeOut", delay: i * 0.05 }}
              title={`${score}%`}
            />
          );
        })}
      </div>
      {/* Average line indicator */}
      <div className="relative mt-1 h-0 border-t border-dashed border-(--cf-text-soft)/30" style={{ bottom: `${(avg / maxScore) * 80}px`, marginTop: `-${(avg / maxScore) * 80}px`, position: "relative" }}>
        <span className="absolute -top-3 right-0 text-[10px] text-(--cf-text-3)">avg {avg}%</span>
      </div>

      {/* Stat row */}
      <div className="mt-4 flex items-center gap-2 text-cf-label text-(--cf-text-3)">
        <span>Average: <span className="font-semibold text-(--cf-text-1)">{avg}%</span></span>
        <span className="text-(--cf-text-soft)">·</span>
        <span>Best: <span className="font-semibold text-(--cf-text-1)">{best}%</span></span>
        <span className="text-(--cf-text-soft)">·</span>
        <span>Last: <span className="font-semibold text-(--cf-text-1)">{last}%</span></span>
      </div>

      {/* Trend */}
      <p className={cn("mt-1 text-xs", trend === "up" ? "text-accent-emerald" : trend === "down" ? "text-accent-amber" : "text-(--cf-accent)")}>
        {trend === "up" ? "↑ Improving across recent quizzes" : trend === "down" ? "↓ Review recommended" : "→ Steady performance"}
      </p>
    </div>
  );
}
