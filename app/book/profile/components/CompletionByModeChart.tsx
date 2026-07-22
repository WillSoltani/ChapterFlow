"use client";

import { motion } from "framer-motion";
import { DUR } from "@/lib/motion";

const MODE_BAR_COLORS: Record<string, string> = {
  Simple: "var(--accent-cyan)",
  Standard: "var(--accent-violet)",
  Deeper: "var(--accent-amber)",
};

export function CompletionByModeChart({
  data,
  counts,
}: {
  data: { label: string; value: number }[];
  counts?: { simple: number; standard: number; deeper: number };
}) {
  const hasDeeper = (counts?.deeper ?? 0) > 0;
  return (
    <div className="space-y-3">
      {data.map((entry, idx) => {
        const count = counts
          ? counts[entry.label.toLowerCase() as keyof typeof counts] ?? 0
          : 0;
        const barColor = MODE_BAR_COLORS[entry.label] ?? "var(--cf-accent)";
        const staggerDelay = idx * 0.15;
        return (
          <div key={entry.label} className="group">
            <div className="flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
              <span>{entry.label}</span>
              <span>
                {entry.value}%
                {counts ? <span className="ml-1 text-xs text-(--cf-text-soft)">({count} {count === 1 ? "chapter" : "chapters"})</span> : null}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--cf-border)">
              <motion.div
                className="h-full rounded-full"
                style={{ background: barColor }}
                initial={{ width: 0 }}
                whileInView={{ width: `${entry.value}%` }}
                viewport={{ once: true }}
                transition={{ duration: DUR.reveal, ease: "easeOut", delay: staggerDelay }}
              />
            </div>
          </div>
        );
      })}
      {!hasDeeper ? (
        <p className="mt-2 text-xs text-(--cf-text-soft)">
          Try Deeper mode on your next chapter — it adds scenarios for real-world application.
        </p>
      ) : (
        <p className="mt-2 text-xs text-(--cf-text-soft)">
          Deeper mode chapters show higher quiz scores on average. Your reading depth shapes your retention.
        </p>
      )}
    </div>
  );
}
