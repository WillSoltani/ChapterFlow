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
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(920px_circle_at_10%_-6%,rgba(34,211,238,0.16),transparent_58%),radial-gradient(880px_circle_at_100%_0%,rgba(244,114,182,0.08),transparent_52%)]" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pb-3 pt-6 sm:px-6 sm:pt-8">
        <ChapterFlowMark compact />
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 pb-14 pt-2 sm:px-6 sm:pb-20">
        <StepperDots total={totalSteps} current={step} />

        <div className="mx-auto mt-7 max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-300">
            {subtitle}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-5xl">{children}</div>

        <div className="mx-auto mt-8 max-w-5xl">{actions}</div>
      </section>
    </main>
  );
}
