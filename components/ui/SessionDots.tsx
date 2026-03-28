"use client";

import { BookOpen, Globe, HelpCircle, LockOpen } from "lucide-react";

interface SessionDotsProps {
  currentStep?: number;
  completedSteps?: number[];
  className?: string;
}

const steps = [
  { icon: BookOpen, label: "Summary", color: "var(--accent-blue)" },
  { icon: Globe, label: "Scenario", color: "var(--accent-flame)" },
  { icon: HelpCircle, label: "Quiz", color: "var(--accent-teal)" },
  { icon: LockOpen, label: "Unlock", color: "var(--accent-gold)" },
];

export function SessionDots({
  currentStep = 0,
  completedSteps = [],
  className = "",
}: SessionDotsProps) {
  return (
    <div className={`flex items-center ${className}`}>
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = completedSteps.includes(i);
        const isCurrent = i === currentStep;

        return (
          <div key={step.label} className="flex items-center">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 30,
                height: 30,
                background: isCompleted
                  ? "rgba(34,211,238,0.1)"
                  : "var(--bg-elevated)",
                border: `1px solid ${
                  isCurrent
                    ? "var(--accent-blue)"
                    : isCompleted
                      ? "rgba(34,211,238,0.2)"
                      : "var(--border-subtle)"
                }`,
                boxShadow: isCurrent
                  ? "0 0 8px var(--accent-blue-glow)"
                  : "none",
              }}
            >
              {isCompleted ? (
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
                <Icon
                  size={14}
                  style={{
                    color: isCurrent ? step.color : "var(--text-muted)",
                  }}
                />
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 20,
                  height: 1,
                  background: "var(--border-subtle)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
