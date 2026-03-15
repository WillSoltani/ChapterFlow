import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleCheckBig,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { landingContent } from "@/app/book/components/site/content";

type HeroSectionProps = {
  signInHref: string;
};

export function HeroSection({ signInHref }: HeroSectionProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pb-18 pt-10 sm:px-6 sm:pb-24 sm:pt-14 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3.5 py-1.5 text-xs uppercase tracking-[0.28em] text-cyan-100/80">
            <Sparkles className="h-3.5 w-3.5" />
            {landingContent.hero.eyebrow}
          </div>

          <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-slate-50 sm:text-6xl lg:text-7xl">
            {landingContent.hero.title}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            {landingContent.hero.body}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            {landingContent.hero.supporting}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={signInHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(94,234,212,0.98),rgba(56,189,248,0.94))] px-5 py-3.5 text-base font-semibold text-slate-950 shadow-[0_22px_54px_rgba(45,212,191,0.24)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href="#showcase"
              className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-base font-medium text-slate-100 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              See the product flow
            </a>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {landingContent.hero.proofPoints.map((point) => (
              <span
                key={point}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-sm text-slate-200"
              >
                <Check className="h-4 w-4 text-emerald-300" />
                {point}
              </span>
            ))}
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {landingContent.hero.signalCards.map((card) => (
              <article
                key={card.label}
                className="cf-site-panel cf-site-hover rounded-[24px] p-4"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                  {card.label}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{card.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="cf-site-panel-strong relative overflow-hidden rounded-[34px] p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(480px_circle_at_84%_18%,rgba(94,234,212,0.16),transparent_38%),radial-gradient(420px_circle_at_10%_100%,rgba(56,189,248,0.14),transparent_42%)]" />

            <div className="relative flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-2 uppercase tracking-[0.24em]">ChapterFlow workspace</span>
            </div>

            <div className="relative mt-6 rounded-[28px] border border-white/10 bg-[rgba(6,15,30,0.82)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                    Current chapter
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
                    Atomic Habits
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Chapter 8 · Make the cue obvious
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/72">
                    Progress
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">68%</p>
                </div>
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-900/80">
                <div className="h-full w-[68%] rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,1),rgba(94,234,212,1))]" />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                    Chapter summary
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-50">
                    Design your environment so the habit starts itself.
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    The chapter focuses on making the trigger for a habit obvious,
                    visible, and easy to act on before motivation has a chance to disappear.
                  </p>

                  <div className="mt-4 space-y-2 text-sm text-slate-200">
                    <div className="flex items-start gap-2">
                      <CircleCheckBig className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>See the chapter idea before the detail overwhelms it.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CircleCheckBig className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Relate it to real-life examples that feel familiar.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CircleCheckBig className="mt-0.5 h-4 w-4 text-emerald-300" />
                      <span>Pass the quiz before the next chapter opens.</span>
                    </div>
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
                      Real-life examples
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1">
                        Student
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        Work
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        Personal
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      The concept is shown through everyday situations, so the chapter
                      feels easier to use and easier to remember.
                    </p>
                  </article>

                  <article className="rounded-[24px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(56,189,248,0.12),rgba(94,234,212,0.06))] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">
                          Quiz unlock
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-50">
                          Pass 80% to continue
                        </p>
                      </div>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/22 bg-slate-950/35 text-cyan-100">
                        <LockKeyhole className="h-4 w-4" />
                      </span>
                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-950/60">
                      <div className="h-full w-[82%] rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,1),rgba(94,234,212,1))]" />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-200">
                      Short quizzes keep progression tied to comprehension, not just time spent scrolling.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>

          <div className="cf-site-float absolute -left-3 top-14 hidden w-24 rounded-[22px] border border-white/14 bg-[#0a1427]/90 p-2 shadow-[0_24px_50px_rgba(2,6,23,0.55)] md:block">
            <Image
              src="/book-covers/atomic-habits.svg"
              alt="Atomic Habits cover"
              width={120}
              height={170}
              className="h-auto w-full rounded-[16px]"
            />
          </div>

          <div className="cf-site-float absolute -right-2 bottom-7 hidden w-52 rounded-[24px] border border-white/12 bg-[#09152a]/92 p-4 shadow-[0_24px_50px_rgba(2,6,23,0.55)] xl:block">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/72">
              Reading momentum
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-slate-400">Streak</p>
                <p className="mt-1 text-lg font-semibold text-slate-50">14 days</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-slate-400">Library</p>
                <p className="mt-1 text-lg font-semibold text-slate-50">~200 books</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
