"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";

interface NextAchievementCardProps {
  name: string;
  description: string;
  progressCurrent: number;
  progressTotal: number;
}

export function NextAchievementCard({
  name,
  description,
  progressCurrent,
  progressTotal,
}: NextAchievementCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const progress = Math.min((progressCurrent / progressTotal) * 100, 100);

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
          : { duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <div className="flex items-start gap-3.5">
        {/* Metallic badge icon */}
        <div
          className="flex shrink-0 items-center justify-center rounded-xl"
          style={{
            width: 48,
            height: 48,
            background:
              "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(245,158,11,0.12))",
            border: "1px solid var(--cf-border-strong)",
            boxShadow:
              "inset 0 1px 0 var(--cf-border-strong), 0 0 15px -4px rgba(245,158,11,0.25)",
          }}
        >
          <Trophy size={24} style={{ color: "var(--accent-gold)" }} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--cf-text-soft)" }}
          >
            Next Achievement
          </p>
          <p
            className="mt-1 text-sm font-semibold"
            style={{ color: "var(--cf-text-1)" }}
          >
            {name}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--cf-text-3)" }}>
            {description}
          </p>

          {/* Progress */}
          <div className="mt-3">
            <div
              className="h-1 overflow-hidden rounded-full"
              style={{ background: "var(--cf-surface-muted)" }}
              role="progressbar"
              aria-valuenow={progressCurrent}
              aria-valuemin={0}
              aria-valuemax={progressTotal}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--accent-amber), #D97706)",
                  ...(progress > 80 ? { animation: "achievement-pulse-edge 2s ease-in-out infinite" } : {}),
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
            <p
              className="mt-1 text-[11px] tabular-nums"
              style={{ color: "var(--cf-text-soft)" }}
            >
              {progressCurrent} of {progressTotal}
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/book/badges"
        className="mt-4 block text-xs font-medium transition-colors hover:text-accent-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        style={{ color: "var(--cf-accent)" }}
      >
        View All Achievements →
      </Link>
    </motion.div>
  );
}
