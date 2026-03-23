"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { DailyQuest } from "./progressTypes";

interface DailyQuestsProps {
  quests: DailyQuest[];
  bonusFP: number;
}

export function DailyQuests({ quests, bonusFP }: DailyQuestsProps) {
  const prefersReduced = useReducedMotion();
  const allComplete = quests.every((q) => q.completed);

  // TODO: Connect to quests API — endpoint: GET /api/book/me/quests

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: allComplete
          ? "1px solid rgba(52,211,153,0.3)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: allComplete
          ? "0 0 20px rgba(52,211,153,0.1)"
          : "0 4px 16px rgba(0,0,0,0.2)",
        backgroundColor: "rgba(15,15,26,0.95)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.6 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          Today&apos;s Quests
        </h2>
        <span
          className="rounded-lg px-2 py-0.5 text-xs font-medium"
          style={{
            background: "rgba(167,139,250,0.15)",
            color: "#A78BFA",
          }}
        >
          {"\u{1F381}"} +{bonusFP} FP for all
        </span>
      </div>

      {/* All complete banner */}
      {allComplete && (
        <div
          className="mt-3 rounded-xl px-3 py-2 text-center text-xs font-medium"
          style={{
            background: "rgba(52,211,153,0.1)",
            color: "#34D399",
          }}
        >
          {"\u{1F389}"} All quests complete! +{bonusFP} FP earned
        </div>
      )}

      {/* Quest items */}
      <div className="mt-3 flex flex-col gap-2">
        {quests.map((quest) => (
          <div
            key={quest.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2"
            style={{
              background: quest.completed
                ? "rgba(52,211,153,0.06)"
                : "rgba(255,255,255,0.03)",
            }}
          >
            {/* Icon */}
            <span className="text-base shrink-0">{quest.icon}</span>

            {/* Title */}
            <span
              className="flex-1 text-sm"
              style={{
                color: quest.completed
                  ? "var(--text-muted)"
                  : "var(--text-primary)",
                textDecoration: quest.completed ? "line-through" : "none",
              }}
            >
              {quest.title}
            </span>

            {/* Progress indicator */}
            {quest.type === "boolean" ? (
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                style={{
                  border: quest.completed
                    ? "none"
                    : "1.5px solid rgba(255,255,255,0.2)",
                  background: quest.completed
                    ? "#34D399"
                    : "transparent",
                }}
              >
                {quest.completed && (
                  <Check className="h-3 w-3" style={{ color: "#0A0A14" }} />
                )}
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <div
                  className="overflow-hidden rounded-full"
                  style={{
                    width: 48,
                    height: 4,
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (quest.current / quest.target) * 100)}%`,
                      background: quest.completed ? "#34D399" : "#38BDF8",
                    }}
                  />
                </div>
                <span
                  className="tabular-nums text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {quest.current}/{quest.target}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
}
