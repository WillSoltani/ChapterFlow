"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { DEMO_QUIZ_BY_DEPTH } from "./demoChapter";

interface PhoneQuizViewProps {
  isActive: boolean;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

/**
 * Compact phone-scale mirror of the in-app QuizPanel.
 *
 * Shows a single question with options. While the phase is active,
 * cinematically:
 *   t+1.5s — option B (the correct one) gets the teal selected state
 *   t+2.0s — option B reveals as correct (check mark, success state)
 *   t+2.5s — score ring fills from 0% to 100%
 *   t+3.5s — mini cr-confetti burst inside the phone screen
 */
export function PhoneQuizView({ isActive }: PhoneQuizViewProps) {
  const question = DEMO_QUIZ_BY_DEPTH.standard[0];
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ringPercent, setRingPercent] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Cinematic auto-answer choreography
  useEffect(() => {
    if (!isActive) {
      setSelectedIndex(null);
      setRevealed(false);
      setRingPercent(0);
      setShowConfetti(false);
      return;
    }

    const t1 = setTimeout(() => setSelectedIndex(question.correctIndex), 1500);
    const t2 = setTimeout(() => setRevealed(true), 2000);
    const t3 = setTimeout(() => setRingPercent(100), 2500);
    const t4 = setTimeout(() => setShowConfetti(true), 3500);
    const t5 = setTimeout(() => setShowConfetti(false), 5500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [isActive, question.correctIndex]);

  // SVG ring geometry
  const size = 60;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    ringPercent === 0
      ? circumference * 0.97
      : circumference - (ringPercent / 100) * circumference;

  // Confetti particles (15 instead of 25 for the small phone)
  const particles = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        x: `${(Math.random() - 0.5) * 140}px`,
        y: `${-50 - Math.random() * 80}px`,
        r: `${Math.random() * 720}deg`,
        color:
          i % 3 === 0
            ? "var(--cr-accent)"
            : i % 3 === 1
              ? "var(--cr-warning)"
              : "var(--cr-success)",
        delay: `${Math.random() * 0.25}s`,
        size: 3 + Math.random() * 3,
      })),
    []
  );

  return (
    <div
      className="relative space-y-3"
      style={{
        padding: "0 12px",
        animation: isActive ? "cr-card-enter 350ms ease-out" : undefined,
      }}
    >
      {/* Header with progress ring */}
      <section
        className="cr-glass-reading flex items-center justify-between gap-3"
        style={{ padding: "8px 12px", borderRadius: 10 }}
      >
        <div>
          <p
            className="text-[7px] font-bold uppercase"
            style={{
              color: "var(--cr-text-secondary)",
              letterSpacing: "0.16em",
            }}
          >
            Quiz · {DEMO_QUIZ_BY_DEPTH.standard.length} questions
          </p>
          <p
            className="text-[8px] mt-0.5"
            style={{ color: "var(--cr-text-disabled)" }}
          >
            Pass at 60% to unlock practice
          </p>
        </div>

        {/* Progress ring */}
        <div className="relative inline-flex items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--cr-fill-subtle)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--cr-accent)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-bold"
              style={{
                color: "var(--cr-text-heading)",
                fontSize: "10px",
              }}
            >
              {ringPercent}%
            </span>
          </div>
        </div>
      </section>

      {/* Question card */}
      <article
        className="cr-glass-reading"
        style={{
          padding: "12px",
          borderRadius: 10,
          animation: isActive ? "cr-card-enter 300ms ease-out 100ms both" : undefined,
        }}
      >
        <div className="flex items-start gap-2 mb-2">
          <div
            className="flex shrink-0 items-center justify-center rounded-full font-bold"
            style={{
              width: 16,
              height: 16,
              background: "var(--cr-accent)",
              color: "var(--cr-text-inverse)",
              fontSize: "8px",
            }}
          >
            1
          </div>
          <p
            className="text-[9px] font-semibold flex-1"
            style={{
              color: "var(--cr-text-heading)",
              lineHeight: 1.4,
            }}
          >
            {question.prompt}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-1.5">
          {question.options.slice(0, 3).map((option, optionIndex) => {
            const isCorrectChoice = optionIndex === question.correctIndex;
            const isSelected = selectedIndex === optionIndex;
            const showAsCorrect = revealed && isCorrectChoice;

            return (
              <div
                key={optionIndex}
                className="flex items-center gap-1.5 rounded-md transition-all"
                style={{
                  padding: "5px 7px",
                  border: `1px solid ${
                    showAsCorrect
                      ? "var(--cr-success)"
                      : isSelected
                        ? "var(--cr-accent)"
                        : "var(--cr-glass-border)"
                  }`,
                  background: showAsCorrect
                    ? "var(--cr-success-bg)"
                    : isSelected
                      ? "var(--cr-accent-muted)"
                      : "var(--cr-bg-surface-2)",
                }}
              >
                <span
                  className="flex shrink-0 items-center justify-center rounded-full font-bold"
                  style={{
                    width: 12,
                    height: 12,
                    fontSize: "7px",
                    background: showAsCorrect
                      ? "var(--cr-success)"
                      : isSelected
                        ? "var(--cr-accent)"
                        : "var(--cr-fill-muted)",
                    color: showAsCorrect || isSelected
                      ? "var(--cr-text-inverse)"
                      : "var(--cr-text-secondary)",
                  }}
                >
                  {showAsCorrect ? (
                    <Check className="h-2 w-2" strokeWidth={3} />
                  ) : (
                    OPTION_LABELS[optionIndex]
                  )}
                </span>
                <span
                  className="text-[7.5px]"
                  style={{
                    color: showAsCorrect
                      ? "var(--cr-text-heading)"
                      : "var(--cr-text-primary)",
                    lineHeight: 1.4,
                  }}
                >
                  {option}
                </span>
              </div>
            );
          })}
        </div>

        {/* Correct banner */}
        {revealed && (
          <div
            className="mt-2 flex items-center gap-1 rounded-md"
            style={{
              borderLeft: "2px solid var(--cr-success)",
              background: "var(--cr-success-bg)",
              padding: "4px 7px",
              animation: "cr-card-enter 250ms ease-out",
            }}
          >
            <Check
              className="h-2.5 w-2.5"
              style={{ color: "var(--cr-success)" }}
            />
            <span
              className="text-[7px] font-semibold"
              style={{ color: "var(--cr-success)" }}
            >
              Correct!
            </span>
          </div>
        )}
      </article>

      {/* Confetti burst (clipped by phone screen) */}
      {showConfetti && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute left-1/2 top-1/2 rounded-sm"
              style={
                {
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  "--cr-confetti-x": p.x,
                  "--cr-confetti-y": p.y,
                  "--cr-confetti-r": p.r,
                  animation: `cr-confetti 1.8s ease-out ${p.delay} forwards`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
