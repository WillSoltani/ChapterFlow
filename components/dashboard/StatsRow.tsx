"use client";

import { motion } from "framer-motion";
import { BookOpen, CheckCircle, Target } from "lucide-react";
import { SparkLine } from "@/components/ui/SparkLine";
import { GlassCard } from "@/components/ui/GlassCard";

const ease = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

const completedBookGradients = [
  "linear-gradient(135deg, #2563EB, #1E40AF)",
  "linear-gradient(135deg, #D97706, #B45309)",
];

export function StatsRow() {
  return (
    <motion.div
      className="mt-[22px] grid grid-cols-1 gap-3.5 md:grid-cols-3"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-50px" }}
    >
      {/* Chapters This Week */}
      <motion.div variants={item}>
        <GlassCard className="p-[18px_20px]">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: "var(--accent-blue)" }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Chapters This Week
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span
              className="font-(family-name:--font-jetbrains) text-[28px] font-bold leading-none"
              style={{ color: "var(--text-heading)" }}
            >
              7
            </span>
            <SparkLine
              data={[2, 3, 1, 4, 2, 5, 3]}
              color="var(--accent-blue)"
              width={72}
              height={22}
            />
          </div>
          <p
            className="mt-2 text-[11px]"
            style={{ color: "var(--accent-teal)" }}
          >
            +3 vs last week
          </p>
        </GlassCard>
      </motion.div>

      {/* Books Completed */}
      <motion.div variants={item}>
        <GlassCard className="p-[18px_20px]">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} style={{ color: "var(--accent-teal)" }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Books Completed
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span
              className="font-(family-name:--font-jetbrains) text-[28px] font-bold leading-none"
              style={{ color: "var(--text-heading)" }}
            >
              2
            </span>
            {/* Mini book shelf */}
            <div className="flex items-end gap-1">
              {completedBookGradients.map((g, i) => (
                <div
                  key={i}
                  className="rounded-sm"
                  style={{ width: 8, height: 20, background: g }}
                />
              ))}
              <div
                className="rounded-sm"
                style={{
                  width: 8,
                  height: 20,
                  border: "1px dashed var(--border-medium)",
                }}
              />
            </div>
          </div>
          <p
            className="mt-2 text-[11px]"
            style={{ color: "var(--text-secondary)" }}
          >
            1 in progress
          </p>
        </GlassCard>
      </motion.div>

      {/* Quiz Average */}
      <motion.div variants={item}>
        <GlassCard className="p-[18px_20px]">
          <div className="flex items-center gap-2">
            <Target size={16} style={{ color: "var(--accent-teal)" }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Quiz Average
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span
              className="font-(family-name:--font-jetbrains) text-[28px] font-bold leading-none"
              style={{ color: "var(--accent-teal)" }}
            >
              84%
            </span>
            <SparkLine
              data={[70, 75, 80, 82, 90, 84, 88]}
              color="var(--accent-teal)"
              width={72}
              height={22}
            />
          </div>
          <p
            className="mt-2 text-[11px]"
            style={{ color: "var(--accent-teal)" }}
          >
            Trending up
          </p>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
