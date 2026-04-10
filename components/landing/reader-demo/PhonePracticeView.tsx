"use client";

import { useState } from "react";
import { ArrowRight, Bookmark, Target, Trophy, Zap } from "lucide-react";
import {
  DEMO_IMPLEMENTATION_PLAN,
  DEMO_KEY_TAKEAWAY_CARD,
  DEMO_TAKEAWAYS_BY_DEPTH,
} from "./demoChapter";

interface PhonePracticeViewProps {
  isActive: boolean;
}

const CONTEXT_LABELS: Record<string, string> = {
  work: "Work",
  school: "School",
  personal: "Personal",
};

/**
 * Compact phone-scale mirror of the in-app PracticePhase.
 *
 * Shows the celebratory header, One Takeaway, 2 bookmarked takeaways,
 * a mini Implementation Plan card, 2 commit checkboxes, and a pulsing
 * Continue button. All using the same `cr-glass-card`, `cr-pulse-glow`,
 * and color tokens as the real reader.
 */
export function PhonePracticeView({ isActive }: PhonePracticeViewProps) {
  const bookmarked = DEMO_TAKEAWAYS_BY_DEPTH.standard.slice(0, 2);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  return (
    <div
      className="space-y-3"
      style={{
        padding: "0 12px",
        animation: isActive ? "cr-card-enter 350ms ease-out" : undefined,
      }}
    >
      {/* Celebratory header */}
      <div className="text-center" style={{ paddingTop: 4 }}>
        <p
          className="text-[10px] font-bold"
          style={{
            color: "var(--cr-accent)",
            fontFamily: "var(--font-display)",
          }}
        >
          ✨ You&rsquo;ve earned this. Lock it in.
        </p>
        <p
          className="text-[8px] mt-0.5"
          style={{ color: "var(--cr-text-disabled)" }}
        >
          One final step — cement what you learned.
        </p>
      </div>

      {/* The One Takeaway */}
      <section
        className="cr-glass-card relative overflow-hidden"
        style={{
          border: "1px solid rgba(77, 182, 172, 0.30)",
          padding: "10px 12px",
          borderRadius: 8,
        }}
      >
        <p
          className="text-[7px] font-bold uppercase mb-1"
          style={{
            color: "var(--cr-accent)",
            letterSpacing: "0.1em",
          }}
        >
          The One Takeaway
        </p>
        <p
          className="text-[9px] font-medium"
          style={{
            color: "var(--cr-text-heading)",
            lineHeight: 1.55,
          }}
        >
          {DEMO_KEY_TAKEAWAY_CARD}
        </p>
      </section>

      {/* Bookmarked takeaways */}
      <section
        className="cr-glass-card"
        style={{
          border: "1px solid rgba(77, 182, 172, 0.20)",
          padding: "10px 12px",
          borderRadius: 8,
        }}
      >
        <div className="flex items-center gap-1 mb-1.5">
          <Bookmark
            className="h-2.5 w-2.5"
            style={{ color: "var(--cr-accent)" }}
            fill="currentColor"
          />
          <p
            className="text-[7px] font-bold uppercase"
            style={{
              color: "var(--cr-accent)",
              letterSpacing: "0.1em",
            }}
          >
            Your Bookmarked Takeaways
          </p>
        </div>
        <ul className="space-y-1.5">
          {bookmarked.map((takeaway, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md"
              style={{
                background: "var(--cr-bg-surface-2)",
                border: "1px solid var(--cr-glass-border)",
                padding: "6px 8px",
              }}
            >
              <span
                className="flex shrink-0 items-center justify-center rounded-full font-bold"
                style={{
                  width: 12,
                  height: 12,
                  background: "rgba(77, 182, 172, 0.15)",
                  color: "var(--cr-accent)",
                  fontSize: "7px",
                }}
              >
                {i + 1}
              </span>
              <span
                className="text-[7.5px] flex-1"
                style={{
                  color: "var(--cr-text-primary)",
                  lineHeight: 1.5,
                  fontWeight: 450,
                }}
              >
                {takeaway}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Implementation plan mini card */}
      <section
        className="cr-glass-reading"
        style={{ borderRadius: 8, overflow: "hidden" }}
      >
        <div
          className="flex items-center gap-1.5"
          style={{ padding: "8px 12px" }}
        >
          <Target
            className="h-2.5 w-2.5"
            style={{ color: "var(--cr-accent)" }}
          />
          <p
            className="text-[7px] font-bold uppercase"
            style={{
              color: "var(--cr-text-secondary)",
              letterSpacing: "0.08em",
            }}
          >
            Implementation Plan
          </p>
        </div>

        <div style={{ padding: "0 12px 10px", display: "grid", gap: 6 }}>
          {/* Core skill */}
          <div
            className="rounded-md"
            style={{
              border: "1px solid rgba(77, 182, 172, 0.20)",
              background: "var(--cr-accent-muted)",
              padding: "6px 8px",
            }}
          >
            <p
              className="text-[6.5px] font-bold uppercase mb-0.5"
              style={{
                color: "var(--cr-accent)",
                letterSpacing: "0.06em",
              }}
            >
              Core Skill
            </p>
            <p
              className="text-[8px]"
              style={{
                color: "var(--cr-text-primary)",
                lineHeight: 1.45,
              }}
            >
              {DEMO_IMPLEMENTATION_PLAN.coreSkill}
            </p>
          </div>

          {/* First If-Then plan */}
          {DEMO_IMPLEMENTATION_PLAN.ifThenPlans.slice(0, 1).map((item, i) => (
            <div
              key={i}
              className="rounded-md"
              style={{
                border: "1px solid var(--cr-glass-border)",
                background: "var(--cr-glass-card)",
                padding: "6px 8px",
              }}
            >
              <span
                className="inline-block rounded-sm font-bold uppercase"
                style={{
                  background: "var(--cr-accent-muted)",
                  color: "var(--cr-accent)",
                  padding: "1px 4px",
                  fontSize: "6px",
                  letterSpacing: "0.08em",
                  marginBottom: 3,
                }}
              >
                {CONTEXT_LABELS[item.context] ?? item.context}
              </span>
              <p
                className="text-[7.5px]"
                style={{
                  color: "var(--cr-text-primary)",
                  lineHeight: 1.45,
                }}
              >
                {item.plan}
              </p>
            </div>
          ))}

          {/* 24-hour challenge */}
          <div
            className="rounded-md"
            style={{
              border: "1px solid rgba(245, 158, 11, 0.20)",
              background: "rgba(245, 158, 11, 0.05)",
              padding: "6px 8px",
            }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <Zap className="h-2 w-2" style={{ color: "#F59E0B" }} />
              <p
                className="text-[6.5px] font-bold uppercase"
                style={{
                  color: "#F59E0B",
                  letterSpacing: "0.06em",
                }}
              >
                24-Hour Challenge
              </p>
            </div>
            <p
              className="text-[7.5px]"
              style={{
                color: "var(--cr-text-primary)",
                lineHeight: 1.45,
              }}
            >
              {DEMO_IMPLEMENTATION_PLAN.twentyFourHourChallenge}
            </p>
          </div>
        </div>
      </section>

      {/* Commit checkboxes */}
      <section
        className="cr-glass-card"
        style={{
          border: "1px solid rgba(77, 182, 172, 0.20)",
          padding: "10px 12px",
          borderRadius: 8,
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <p
            className="text-[7px] font-bold uppercase"
            style={{
              color: "var(--cr-accent)",
              letterSpacing: "0.1em",
            }}
          >
            Commit to Your Steps
          </p>
          <span
            className="text-[7px]"
            style={{ color: "var(--cr-text-disabled)" }}
          >
            {Object.values(checked).filter(Boolean).length} of 2
          </span>
        </div>
        <ul className="space-y-1.5">
          {DEMO_IMPLEMENTATION_PLAN.ifThenPlans.slice(0, 2).map((step, i) => {
            const isChecked = !!checked[i];
            return (
              <li key={i}>
                <label
                  className="flex items-start gap-2 cursor-pointer"
                  style={{ alignItems: "flex-start" }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      setChecked((prev) => ({ ...prev, [i]: !prev[i] }))
                    }
                    className="cursor-pointer"
                    style={{
                      width: 10,
                      height: 10,
                      marginTop: 2,
                      accentColor: "#22d3ee",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="text-[7.5px] flex-1"
                    style={{
                      color: "var(--cr-text-secondary)",
                      lineHeight: 1.5,
                      textDecoration: isChecked ? "line-through" : "none",
                      opacity: isChecked ? 0.5 : 1,
                    }}
                  >
                    {step.plan}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Continue button */}
      <div className="flex justify-center pt-1 pb-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full font-bold transition"
          style={{
            background: "var(--cr-accent)",
            color: "var(--cr-text-inverse)",
            padding: "6px 14px",
            fontSize: "9px",
            animation: "cr-pulse-glow 2s ease-in-out infinite",
          }}
        >
          <Trophy className="h-2.5 w-2.5" />
          Continue to Chapter 2
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
