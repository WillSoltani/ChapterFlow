"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

interface RewardsCardProps {
  flowPoints: number;
  nextRewardName: string;
  pointsRequired: number;
  isPro: boolean;
}

export function RewardsCard({
  flowPoints,
  nextRewardName,
  pointsRequired,
  isPro,
}: RewardsCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const progress = Math.min((flowPoints / pointsRequired) * 100, 100);

  const quickEarns = [
    { label: "Complete a chapter quiz", points: 15 },
    { label: "Finish a book", points: 40 },
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
      {/* Points balance with shine sweep */}
      <div className="flex items-center gap-2">
        <span aria-hidden="true" style={{ color: "var(--accent-violet)", fontSize: 18, filter: "drop-shadow(0 0 8px rgba(139,92,246,0.4))" }}>
          ◆
        </span>
        <span className="relative inline-block overflow-hidden">
          <span
            className="font-(family-name:--font-jetbrains) text-2xl font-bold tabular-nums"
            style={{ color: "var(--cf-text-1)" }}
          >
            {flowPoints.toLocaleString()}
          </span>
          {/* Shine sweep effect */}
          {!prefersReducedMotion && (
            <motion.span
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 48%, rgba(255,255,255,0.18) 52%, transparent 60%)",
                mixBlendMode: "overlay",
              }}
              initial={{ x: "-120%" }}
              animate={{ x: "220%" }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                repeatDelay: 5,
                ease: "easeInOut",
              }}
            />
          )}
        </span>
        <span className="text-xs" style={{ color: "var(--cf-text-3)" }}>
          Flow Points
        </span>
      </div>

      {/* Progress to next reward */}
      <div className="mt-3">
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--cf-surface-muted)" }}
          role="progressbar"
          aria-valuenow={flowPoints}
          aria-valuemin={0}
          aria-valuemax={pointsRequired}
          aria-label={`${flowPoints} of ${pointsRequired} points toward ${nextRewardName}`}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, var(--accent-violet), var(--accent-cyan))",
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
            {flowPoints}
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
              +{item.points} pts
            </span>
          </div>
        ))}
      </div>

      {/* Pro note */}
      {!isPro && (
        <Link
          href="/pricing"
          className="mt-3 block text-[11px] transition-colors hover:text-accent-violet"
          style={{ color: "var(--cf-text-soft)" }}
        >
          2x points with Pro ✨
        </Link>
      )}
    </motion.div>
  );
}
