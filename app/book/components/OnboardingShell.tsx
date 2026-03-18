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
};

export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  actions,
}: OnboardingShellProps) {
  return (
    <main className="cf-app-shell">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pb-3 pt-6 sm:px-6 sm:pt-8">
        <ChapterFlowMark compact />
        <Link
          href="/"
          className="cf-btn cf-btn-secondary rounded-full px-3 py-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 pb-14 pt-2 sm:px-6 sm:pb-20">
        <StepperDots total={totalSteps} current={step} />

        <div className="mx-auto mt-7 max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-(--cf-text-1) sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-(--cf-text-2)">
            {subtitle}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-5xl">{children}</div>

        <div className="mx-auto mt-8 max-w-5xl">{actions}</div>
      </section>
    </main>
  );
}
