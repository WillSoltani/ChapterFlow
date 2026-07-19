"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { BookOpen, Brain, RotateCcw, Check } from "lucide-react";
import type { DailyQuest } from "./progressTypes";

interface DailyQuestsProps {
  quests: DailyQuest[];
  onQuestClick?: (questId: string) => void;
}

/** Map quest id to accent color and icon component */
function getQuestAccent(questId: string): {
  color: string;
  bg: string;
  Icon: typeof BookOpen;
} {
  switch (questId) {
    case "q1":
      return { color: "var(--accent-cyan)", bg: "color-mix(in srgb, var(--accent-cyan) 15%, transparent)", Icon: BookOpen };
    case "q2":
      return { color: "var(--accent-amber)", bg: "color-mix(in srgb, var(--accent-amber) 15%, transparent)", Icon: Brain };
    case "q3":
      return { color: "var(--accent-violet)", bg: "color-mix(in srgb, var(--accent-violet) 15%, transparent)", Icon: RotateCcw };
    default:
      return { color: "var(--accent-cyan)", bg: "color-mix(in srgb, var(--accent-cyan) 15%, transparent)", Icon: BookOpen };
  }
}

export function DailyQuests({ quests, onQuestClick }: DailyQuestsProps) {
  const prefersReduced = useReducedMotion();
  const allComplete = quests.every((q) => q.completed);
  const completedCount = quests.filter((q) => q.completed).length;
  const allPartiallyStarted =
    quests.length > 0 && quests.every((q) => q.current > 0 && !q.completed);

  return (
    <motion.section
      className="rounded-2xl p-5"
      style={{
        background: "var(--cf-surface-muted)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: allComplete
          ? "1px solid color-mix(in srgb, var(--accent-emerald) 30%, transparent)"
          : "1px solid var(--cf-border)",
        boxShadow: allComplete
          ? "0 0 20px color-mix(in srgb, var(--accent-emerald) 10%, transparent)"
          : "var(--cf-shadow-md)",
      }}
      initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.normal, delay: 0.6 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          Today&apos;s Quests
        </h2>
        <motion.span
          className="rounded-lg px-2 py-0.5 text-xs font-medium"
          style={{
            background: "color-mix(in srgb, var(--accent-violet) 15%, transparent)",
            color: "var(--accent-violet)",
          }}
          animate={
            allPartiallyStarted && !prefersReduced
              ? { opacity: [1, 0.7, 1] }
              : undefined
          }
          transition={
            allPartiallyStarted
              ? { repeat: Infinity, duration: 2, ease: "easeInOut" }
              : undefined
          }
        >
          {"\u{1F3AF}"} {completedCount}/{quests.length} done
        </motion.span>
      </div>

      {/* All complete banner */}
      {allComplete && (
        <div
          className="mt-3 rounded-xl px-3 py-2 text-center text-xs font-medium"
          style={{
            background: "color-mix(in srgb, var(--accent-emerald) 10%, transparent)",
            color: "var(--accent-emerald)",
          }}
        >
          {"\u{1F389}"} All quests complete!
        </div>
      )}

      {/* Quest items */}
      <div className="mt-3 flex flex-col gap-2">
        {quests.map((quest) => {
          const { color, bg, Icon } = getQuestAccent(quest.id);
          const progressPct = quest.target > 0 ? (quest.current / quest.target) * 100 : 0;
          const almostThere = progressPct > 80 && !quest.completed;

          const isClickable = !!onQuestClick && quest.id === "q3";

          return (
            <div
              key={quest.id}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={isClickable ? () => onQuestClick(quest.id) : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onQuestClick(quest.id); } } : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2${isClickable ? " cursor-pointer transition-colors hover:brightness-110" : ""}`}
              style={{
                background: quest.completed
                  ? "color-mix(in srgb, var(--accent-emerald) 6%, transparent)"
                  : "var(--cf-surface-muted)",
              }}
            >
              {/* Colored circle icon */}
              <div
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 32,
                  height: 32,
                  background: bg,
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color }}
                />
              </div>

              {/* Title + almost there */}
              <div className="flex flex-1 flex-col">
                <span
                  className="text-sm"
                  style={{
                    color: quest.completed
                      ? "var(--text-tertiary)"
                      : "var(--text-primary)",
                    textDecoration: quest.completed ? "line-through" : "none",
                  }}
                >
                  {quest.title}
                </span>
                {almostThere && (
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: "var(--accent-amber)" }}
                  >
                    Almost there!
                  </span>
                )}
              </div>

              {/* Progress indicator */}
              {quest.type === "boolean" ? (
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                  style={{
                    border: quest.completed
                      ? "none"
                      : `1.5px solid ${color}`,
                    background: quest.completed
                      ? "var(--accent-emerald)"
                      : "transparent",
                  }}
                >
                  {quest.completed && (
                    <Check className="h-3 w-3" style={{ color: "var(--cf-page-bg)" }} />
                  )}
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <div
                    className="overflow-hidden rounded-full"
                    style={{
                      width: 48,
                      height: 4,
                      background: "var(--cf-progress-track)",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, progressPct)}%`,
                        background: quest.completed ? "var(--accent-emerald)" : color,
                      }}
                    />
                  </div>
                  <span
                    className="tabular-nums text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {quest.current}/{quest.target}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
