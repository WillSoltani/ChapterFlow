"use client";

import { BookOpen, Globe, HelpCircle, LockOpen } from "lucide-react";

const tasks = [
  {
    icon: BookOpen,
    label: "Read the main idea",
    time: "5m",
    color: "var(--accent-blue)",
  },
  {
    icon: Globe,
    label: "Explore scenarios",
    time: "3m",
    color: "var(--accent-flame)",
  },
  {
    icon: HelpCircle,
    label: "Chapter quiz",
    time: "3m",
    color: "var(--accent-teal)",
  },
  {
    icon: LockOpen,
    label: "Unlock Chapter 5",
    time: "1m",
    color: "var(--accent-gold)",
  },
];

export function SessionBreakdown() {
  return (
    <div className="p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[14px] font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          Today&apos;s Session
        </span>
        <span
          className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px]"
          style={{
            color: "var(--accent-teal)",
            background: "rgba(45,212,191,0.06)",
            border: "1px solid rgba(45,212,191,0.12)",
          }}
        >
          ⚡ ~12 min
        </span>
      </div>

      {/* Task list */}
      <div className="mt-3.5 flex flex-col">
        {tasks.map((task, i) => {
          const Icon = task.icon;
          return (
            <div
              key={task.label}
              className="flex items-center gap-2.5 py-2.5"
              style={{
                borderTop:
                  i > 0 ? "1px solid var(--border-subtle)" : "none",
              }}
            >
              <div
                className="flex items-center justify-center rounded-md"
                style={{
                  width: 24,
                  height: 24,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderLeft: `2px solid ${task.color}`,
                }}
              >
                <Icon size={12} style={{ color: task.color }} />
              </div>
              <span
                className="flex-1 text-[13px]"
                style={{ color: "var(--text-primary)" }}
              >
                {task.label}
              </span>
              <span
                className="font-(family-name:--font-jetbrains) text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                {task.time}
              </span>
            </div>
          );
        })}
      </div>

      {/* Secondary CTA */}
      <button
        className="mt-3 w-full cursor-pointer rounded-[var(--radius-md-val)] py-2.5 text-[13px] font-semibold transition-all"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-medium)",
          color: "var(--text-heading)",
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--border-accent)";
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--border-medium)";
        }}
      >
        Start Session
      </button>
    </div>
  );
}
