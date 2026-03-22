"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { CircularProgress } from "@/components/ui/CircularProgress";

const ease = [0.22, 1, 0.36, 1] as const;

const steps = [
  { label: "Account created", done: true },
  { label: "First book selected", done: true },
  { label: "Read your first chapter", done: false },
  { label: "Complete your first quiz", done: false },
];

export function EmptyStateGettingStarted() {
  const doneCount = steps.filter((s) => s.done).length;
  const progress = (doneCount / steps.length) * 100;

  return (
    <motion.div
      className="mt-[22px]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <GlassCard
        className="flex flex-col gap-4 p-5 md:flex-row md:items-center"
        hover={false}
      >
        <CircularProgress
          size={56}
          strokeWidth={4}
          progress={progress}
          color="var(--accent-teal)"
        >
          <span
            className="font-(family-name:--font-jetbrains) text-[12px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {doneCount}/{steps.length}
          </span>
        </CircularProgress>

        <div className="flex-1">
          <h3
            className="text-[15px] font-semibold"
            style={{ color: "var(--text-heading)" }}
          >
            Getting started
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {steps.map((step) => (
              <div
                key={step.label}
                className="flex items-center gap-1.5"
              >
                {step.done ? (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17L4 12"
                      stroke="var(--accent-teal)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <div
                    className="h-3.5 w-3.5 rounded-[3px]"
                    style={{ border: "1.5px solid var(--border-medium)" }}
                  />
                )}
                <span
                  className="text-[12px]"
                  style={{
                    color: step.done
                      ? "var(--text-secondary)"
                      : "var(--text-muted)",
                  }}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <p
            className="mt-2 text-[12px]"
            style={{ color: "var(--text-muted)" }}
          >
            Complete your first session to unlock your stats dashboard.
          </p>
        </div>
      </GlassCard>
    </motion.div>
  );
}
