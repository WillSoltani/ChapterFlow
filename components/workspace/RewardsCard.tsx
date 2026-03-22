"use client";

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
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
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
        <span aria-hidden="true" style={{ color: "#7C3AED", fontSize: 18 }}>
          ◆
        </span>
        <span
          className="font-(family-name:--font-jetbrains) text-2xl font-bold tabular-nums"
          style={{ color: "#F0F0F0" }}
        >
          {flowPoints.toLocaleString()}
        </span>
        <span className="text-xs" style={{ color: "#A0A0B8" }}>
          Flow Points
        </span>
      </div>

      {/* Progress to next reward */}
      <div className="mt-3">
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
          role="progressbar"
          aria-valuenow={flowPoints}
          aria-valuemin={0}
          aria-valuemax={pointsRequired}
          aria-label={`${flowPoints} of ${pointsRequired} points toward ${nextRewardName}`}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #7C3AED, #A78BFA)",
            }}
            initial={prefersReducedMotion ? undefined : { width: 0 }}
            whileInView={{ width: `${progress}%` }}
            viewport={{ once: true }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.8, ease: "easeOut", delay: 0.2 }
            }
          />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "#6B6B80" }}>
          <span className="tabular-nums" style={{ color: "#A0A0B8" }}>
            {flowPoints}
          </span>{" "}
          / {pointsRequired} →{" "}
          <span style={{ color: "#A0A0B8" }}>{nextRewardName}</span>
        </p>
      </div>

      {/* Quick-earn actions */}
      <div className="mt-4 flex flex-col gap-2">
        {quickEarns.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-xs"
          >
            <span style={{ color: "#A0A0B8" }}>{item.label}</span>
            <span
              className="tabular-nums font-medium"
              style={{ color: "#7C3AED" }}
            >
              +{item.points} pts
            </span>
          </div>
        ))}
      </div>

      {/* Pro note */}
      {!isPro && (
        <p className="mt-3 text-[11px]" style={{ color: "#6B6B80" }}>
          2x points with Pro ✨
        </p>
      )}
    </motion.div>
  );
}
