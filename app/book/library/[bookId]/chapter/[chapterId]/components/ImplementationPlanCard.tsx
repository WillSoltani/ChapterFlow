"use client";

import { useState } from "react";
import { Zap, Target, Clock, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { ImplementationPlanItem } from "@/app/book/data/mockChapters";

const CONTEXT_ICONS: Record<string, string> = {
  work: "Briefcase",
  school: "GraduationCap",
  personal: "Heart",
};

const CONTEXT_LABELS: Record<string, string> = {
  work: "Work",
  school: "School",
  personal: "Personal",
};

type ImplementationPlanCardProps = {
  plan: ImplementationPlanItem;
  fontScaleClass: string;
};

export function ImplementationPlanCard({ plan, fontScaleClass }: ImplementationPlanCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="cr-glass-reading overflow-hidden rounded-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Target className="h-4.5 w-4.5 text-(--cr-accent)" />
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-(--cr-text-secondary)">
            Implementation Plan
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-(--cr-text-disabled)" />
        ) : (
          <ChevronDown className="h-4 w-4 text-(--cr-text-disabled)" />
        )}
      </button>

      {expanded && (
        <div className="space-y-5 px-6 pb-6">
          {/* Core Skill */}
          <div className="rounded-lg border border-(--cr-accent)/20 bg-(--cr-accent-muted) px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-(--cr-accent) mb-1.5">
              Core Skill
            </p>
            <p className={`text-(--cr-text-primary) ${fontScaleClass}`}>
              {plan.coreSkill}
            </p>
          </div>

          {/* If-Then Plans */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-(--cr-text-secondary)">
              If-Then Plans
            </p>
            {plan.ifThenPlans.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-(--cr-glass-border) bg-(--cr-glass-card) px-4 py-3"
              >
                <span className="inline-block rounded-md bg-(--cr-accent-muted) px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-(--cr-accent) mb-1.5">
                  {CONTEXT_LABELS[item.context] ?? item.context}
                </span>
                <p className={`text-(--cr-text-primary) ${fontScaleClass}`}>
                  {item.plan}
                </p>
              </div>
            ))}
          </div>

          {/* 24-Hour Challenge */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-amber-500">
                24-Hour Challenge
              </p>
            </div>
            <p className={`text-(--cr-text-primary) ${fontScaleClass}`}>
              {plan.twentyFourHourChallenge}
            </p>
          </div>

          {/* Weekly Practice */}
          <div className="rounded-lg border border-(--cr-glass-border) bg-(--cr-glass-card) px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-(--cr-text-secondary)" />
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-(--cr-text-secondary)">
                Weekly Practice
              </p>
            </div>
            <p className={`text-(--cr-text-primary) ${fontScaleClass}`}>
              {plan.weeklyPractice}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
