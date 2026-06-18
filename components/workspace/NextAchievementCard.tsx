"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
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
  const progress = progressTotal > 0
    ? Math.min((progressCurrent / progressTotal) * 100, 100)
    : 0;

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
          : { duration: DUR.slow, delay: 0.1, ease: EASE.standard }
      }
    >
      <div className="flex items-start gap-3.5">
        {/* Metallic badge icon */}
        <div
          className="flex shrink-0 items-center justify-center rounded-xl"
          style={{
            width: 48,
            height: 48,
            background: "var(--accent-amber-glow)",
            border: "1px solid var(--cf-border-strong)",
            boxShadow:
              "inset 0 1px 0 var(--cf-border-strong), 0 0 15px -4px var(--accent-amber-glow)",
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
              style={{ background: "var(--cf-progress-track)" }}
              role="progressbar"
              aria-valuenow={progressCurrent}
              aria-valuemin={0}
              aria-valuemax={progressTotal}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--accent-amber), var(--accent-gold))",
                }}
                initial={prefersReducedMotion ? undefined : { width: 0 }}
                whileInView={{ width: `${progress}%` }}
                viewport={{ once: true }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: DUR.reveal, ease: "easeOut", delay: 0.4 }
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
        className="cf-focus mt-4 block text-xs font-medium transition-colors hover:text-(--cf-accent)"
        style={{ color: "var(--cf-accent)" }}
      >
        View All Achievements →
      </Link>
    </motion.div>
  );
}
