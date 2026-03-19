"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { StepperDots } from "@/app/book/components/StepperDots";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";

type OnboardingShellProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  actions: ReactNode;
  stepLabels?: string[];
};

export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  actions,
  stepLabels,
}: OnboardingShellProps) {
  const progressPercent = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <main className="cf-app-shell">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pb-3 pt-6 sm:px-6 sm:pt-8">
        <ChapterFlowMark compact />
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-(--cf-text-3)">
              Guided Setup
            </p>
            <p className="mt-1 text-sm text-(--cf-text-3)">
              Choose your first books and tune the experience.
            </p>
          </div>
          <Link
            href="/"
            className="cf-btn cf-btn-secondary rounded-full px-3 py-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 pt-2 sm:px-6 sm:pb-20">
        <div className="cf-panel relative overflow-hidden rounded-[34px] p-5 sm:p-7">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,var(--cf-accent-muted),transparent_60%)]"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-info-text)">
                <span>Guided Setup</span>
                <span className="h-1 w-1 rounded-full bg-(--cf-text-soft)" />
                <span>
                  Step {step + 1} of {totalSteps}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-(--cf-text-1) sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-(--cf-text-2)">
                {subtitle}
              </p>
            </div>

            <div className="w-full max-w-xl">
              <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-(--cf-text-3)">
                <span>{stepLabels?.[step] ?? `Step ${step + 1}`}</span>
                <span>{progressPercent}% complete</span>
              </div>
              <StepperDots total={totalSteps} current={step} labels={stepLabels} />
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-6xl">{children}</div>

        <div className="mx-auto mt-8 max-w-6xl">{actions}</div>
      </section>
    </main>
  );
}
