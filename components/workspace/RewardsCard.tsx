"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { INSIGHT_POINTS_EARNING_RULES } from "@/app/book/_lib/flow-points-economy";

interface RewardsCardProps {
  insightPoints: number;
  nextRewardName: string;
  pointsRequired: number;
}

export function RewardsCard({
  insightPoints,
  nextRewardName,
  pointsRequired,
}: RewardsCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const progress = Math.min((insightPoints / pointsRequired) * 100, 100);

  const quizRule = INSIGHT_POINTS_EARNING_RULES.find((r) => r.sourceType === "quiz_pass");
  const bookRule = INSIGHT_POINTS_EARNING_RULES.find((r) => r.sourceType === "book_complete");
  const quickEarns = [
    { label: quizRule?.label ?? "Complete a learning loop", display: quizRule?.displayValue ?? "80–230 IP" },
    { label: bookRule?.label ?? "Finish a book", display: bookRule?.displayValue ?? "120 IP" },
  ];

  return (
    <motion.div
      className="flex-1 rounded-xl p-5"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px) saturate(125%)",
        WebkitBackdropFilter: "blur(16px) saturate(125%)",
        border: "1px solid var(--cf-border)",
      }}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {/* Points balance */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          style={{
            color: "var(--accent-amber)",
            fontSize: 18,
            filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--accent-amber) 40%, transparent))",
          }}
        >
          ◆
        </span>
        <span
          className="font-(family-name:--font-jetbrains) text-2xl font-bold tabular-nums"
          style={{ color: "var(--cf-text-1)" }}
        >
          {insightPoints.toLocaleString()}
        </span>
        <span className="text-xs" style={{ color: "var(--cf-text-3)" }}>
          Insight Points
        </span>
      </div>

      {/* Progress to next reward */}
      <div className="mt-3">
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--cf-progress-track)" }}
          role="progressbar"
          aria-valuenow={insightPoints}
          aria-valuemin={0}
          aria-valuemax={pointsRequired}
          aria-label={`${insightPoints} of ${pointsRequired} points toward ${nextRewardName}`}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, var(--cf-accent), var(--cf-accent-strong))",
            }}
            initial={prefersReducedMotion ? undefined : { width: 0 }}
            whileInView={{ width: `${progress}%` }}
            viewport={{ once: true }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.8, ease: "easeOut", delay: 0.4 }
            }
          />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--cf-text-soft)" }}>
          <span className="tabular-nums" style={{ color: "var(--cf-text-3)" }}>
            {insightPoints}
          </span>{" "}
          / {pointsRequired} →{" "}
          <span style={{ color: "var(--cf-text-3)" }}>{nextRewardName}</span>
        </p>
      </div>

      {/* Quick-earn actions */}
      <div className="mt-4 flex flex-col gap-2">
        {quickEarns.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-xs"
          >
            <span style={{ color: "var(--cf-text-3)" }}>{item.label}</span>
            <span
              className="tabular-nums font-medium"
              style={{ color: "var(--cf-accent)" }}
            >
              {item.display}
            </span>
          </div>
        ))}
      </div>

      {/* Link to rewards page */}
      <Link
        href="/rewards"
        className="mt-3 block text-[11px] transition-colors hover:text-(--cf-accent)"
        style={{ color: "var(--cf-text-soft)" }}
      >
        View all rewards →
      </Link>
    </motion.div>
  );
}
