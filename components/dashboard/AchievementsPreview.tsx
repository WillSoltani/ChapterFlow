"use client";

import { motion } from "framer-motion";
import { Flame, BookOpen } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const ease = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export function AchievementsPreview() {
  return (
    <div className="mt-9">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--text-muted)" }}
          >
            Achievements
          </span>
          <h2
            className="font-(family-name:--font-display) text-[20px] font-bold"
            style={{ color: "var(--text-heading)" }}
          >
            Quiet momentum, visible progress
          </h2>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11px]"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-elevated)",
          }}
        >
          3 / 24 earned
        </span>
      </div>

      {/* Two cards */}
      <motion.div
        className="grid grid-cols-1 gap-3.5 md:grid-cols-2"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
      >
        {/* Recent Achievement */}
        <motion.div variants={item}>
          <GlassCard className="p-5" hover={false}>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Recent
            </span>
            <div className="mt-2.5 flex items-center gap-3.5">
              <div
                className="flex flex-shrink-0 items-center justify-center rounded-xl"
                style={{
                  width: 44,
                  height: 44,
                  background: "var(--cf-warning-soft)",
                  border: "1px solid var(--cf-warning-border)",
                }}
              >
                <Flame size={22} style={{ color: "var(--accent-flame)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--text-heading)" }}
                >
                  Rhythm Bronze
                </p>
                <p
                  className="text-[12px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Build a 3-day streak
                </p>
              </div>
              <span
                className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{
                  color: "var(--accent-teal)",
                  background: "var(--cf-teal-soft)",
                  border: "1px solid var(--cf-teal-border)",
                }}
              >
                Earned
              </span>
            </div>
          </GlassCard>
        </motion.div>

        {/* Next Badge */}
        <motion.div variants={item}>
          <GlassCard className="p-5" hover={false}>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Next Badge
            </span>
            <div className="mt-2.5 flex items-center gap-3.5">
              <div
                className="flex flex-shrink-0 items-center justify-center rounded-xl"
                style={{
                  width: 44,
                  height: 44,
                  background: "var(--cf-blue-soft)",
                  border: "1px solid var(--cf-blue-border)",
                }}
              >
                <BookOpen size={22} style={{ color: "var(--accent-blue)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--text-heading)" }}
                >
                  Deep Diver
                </p>
                <p
                  className="text-[12px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Finish your first book
                </p>
                <div
                  className="mt-2 h-[3px] overflow-hidden rounded-sm"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: "33%",
                      background: "var(--accent-blue)",
                    }}
                  />
                </div>
                <p
                  className="mt-1 text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  4 of 12 chapters
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
