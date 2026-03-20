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
  return (
    <main className="cf-app-shell relative isolate min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--cf-accent-muted),transparent_32%),radial-gradient(circle_at_bottom_right,var(--cf-warning-soft),transparent_28%)] opacity-80"
        aria-hidden="true"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pb-4 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/"
          aria-label="Go back to the ChapterFlow home page"
          className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
        >
          <ChapterFlowMark compact />
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
              Welcome tour
            </p>
            <p className="mt-1 text-sm text-(--cf-text-3)">
              A quick setup before your first reading session.
            </p>
          </div>
          <Link
            href="/"
            className="cf-btn cf-btn-secondary rounded-full px-3 py-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
        </div>
      </header>

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
          <div className="cf-panel relative overflow-hidden rounded-[34px] p-6 sm:p-8 lg:p-10">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_right,var(--cf-accent-muted),transparent_60%)]"
              aria-hidden="true"
            />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                <span>{stepLabels?.[step] ?? `Step ${step + 1}`}</span>
                <span className="h-1 w-1 rounded-full bg-(--cf-border-strong)" />
                <span>
                  {step + 1} / {totalSteps}
                </span>
              </div>

              <div className="mt-6 max-w-3xl">
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-(--cf-text-1) sm:text-[3.25rem]">
                  {title}
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-(--cf-text-2)">
                  {subtitle}
                </p>
              </div>

              <div className="mt-8">{children}</div>
            </div>
          </div>

          <aside className="cf-panel hidden rounded-[30px] p-6 xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
              Progress
            </p>
            <div className="mt-4">
              <StepperDots total={totalSteps} current={step} labels={stepLabels} />
            </div>

            <div className="mt-6 rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
              <p className="text-sm font-medium text-(--cf-text-1)">
                Short, useful, and easy to finish.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                This setup keeps the product tour tight, then puts a starter shelf in place
                so the app already feels ready when you land in your workspace.
              </p>
            </div>
          </aside>
        </div>

        <div className="mx-auto mt-6 max-w-6xl">{actions}</div>
      </section>
    </main>
  );
}
