import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Compass,
  Layers3,
  NotebookPen,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  buildChapterFlowAppHref,
  buildChapterFlowAuthHref,
} from "@/app/_lib/chapterflow-brand";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";

const principles = [
  {
    icon: BookOpenText,
    title: "Reading with structure",
    body:
      "Each chapter has a clear path through summary, examples, quiz, and review so progress feels deliberate instead of loose.",
  },
  {
    icon: Clock3,
    title: "Progress tied to real effort",
    body:
      "Daily goals and streaks follow tracked reading time, not inflated content estimates, so momentum stays believable.",
  },
  {
    icon: Layers3,
    title: "A queue that keeps moving",
    body:
      "Saved books, completion suggestions, and guided next steps help you keep a strong reading path without friction.",
  },
];

const systemCards = [
  {
    icon: BrainCircuit,
    title: "Summaries that scale with you",
    body:
      "Simple, Standard, and Deeper modes let the same chapter meet different levels of focus and ambition.",
  },
  {
    icon: NotebookPen,
    title: "Examples that connect to real life",
    body:
      "Personal, school, and work contexts turn ideas into choices you can actually use.",
  },
  {
    icon: Trophy,
    title: "Mastery signals with restraint",
    body:
      "Badges, streaks, and milestones reward consistency and depth without turning the product into noise.",
  },
  {
    icon: Compass,
    title: "A reading system that stays clear",
    body:
      "Library, profile, settings, and progress all work together so the product feels calm even as it gets powerful.",
  },
];

const launchPoints = [
  "Choose a book worth finishing, not just starting.",
  "Read with summaries, examples, and quizzes that reinforce each other.",
  "Track progress, save insights, and move straight into the next book.",
];

export function ChapterFlowSiteHome() {
  const signInHref = buildChapterFlowAuthHref(
    `/auth/login?returnTo=${encodeURIComponent(buildChapterFlowAppHref("/book"))}`
  );
  const appHref = buildChapterFlowAppHref("/book");
  const libraryHref = buildChapterFlowAppHref("/book/library");

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#040812] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_8%_6%,rgba(34,211,238,0.14),transparent_48%),radial-gradient(860px_circle_at_88%_0%,rgba(56,189,248,0.14),transparent_42%),radial-gradient(720px_circle_at_50%_88%,rgba(251,191,36,0.10),transparent_34%),linear-gradient(180deg,rgba(4,8,18,0.98),rgba(3,7,18,1))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)] opacity-30" />

      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 sm:pb-20 sm:pt-10 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <ChapterFlowMark />
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href={libraryHref}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
            >
              Explore library
            </Link>
            <Link
              href={signInHref}
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,rgba(14,165,233,0.94),rgba(45,212,191,0.90))] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(45,212,191,0.18)] transition hover:brightness-105"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="grid gap-12 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:pt-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/8 px-3.5 py-1.5 text-xs uppercase tracking-[0.28em] text-cyan-100/75">
              <Sparkles className="h-3.5 w-3.5" />
              Premium guided reading
            </div>

            <h1 className="mt-7 text-5xl font-semibold tracking-[-0.04em] text-slate-50 sm:text-6xl lg:text-7xl">
              Reading that feels focused, modern, and worth returning to.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              {CHAPTERFLOW_NAME} turns serious nonfiction into a chapter based
              learning system with summaries, examples, quizzes, notes, and
              progress that respects actual effort.
            </p>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              {CHAPTERFLOW_TAGLINE}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signInHref}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.94),rgba(34,211,238,0.92))] px-5 py-3.5 text-base font-semibold text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.22)] transition hover:brightness-105"
              >
                Start with ChapterFlow
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={libraryHref}
                className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-base font-medium text-slate-100 transition hover:bg-white/[0.08]"
              >
                Preview the library
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-100/70">
                  Actual effort
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-50">
                  Reading time that tracks reality
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-100/70">
                  Guided depth
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-50">
                  Summaries, examples, quiz, and review
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-100/70">
                  Momentum
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-50">
                  Saved next reads and completion flow
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
            <div className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_28px_80px_rgba(2,6,23,0.36)] backdrop-blur-2xl sm:p-6">
              <div className="rounded-[28px] border border-white/10 bg-[#071222] p-5">
                <p className="text-xs uppercase tracking-[0.26em] text-cyan-100/70">
                  Inside the product
                </p>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">
                  A reading practice that compounds.
                </h2>
                <div className="mt-6 space-y-4">
                  {launchPoints.map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-sm leading-7 text-slate-300">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {systemCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-4 text-lg font-semibold text-slate-50">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-300">
                        {card.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <div
                key={principle.title}
                className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 shadow-[0_20px_50px_rgba(2,6,23,0.24)] backdrop-blur-xl"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-5 text-xl font-semibold text-slate-50">
                  {principle.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {principle.body}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-[34px] border border-white/10 bg-[linear-gradient(120deg,rgba(8,15,31,0.96),rgba(10,24,41,0.96))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.34)] sm:p-8 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-100/70">
              Ready when you are
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">
              Sign in on Siliconx, then continue inside the ChapterFlow app.
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-300">
              Your product home lives here. Your reading workspace lives on
              chapterflow.siliconx.ca. The transition should feel immediate
              and clean.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href={signInHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.94),rgba(45,212,191,0.90))] px-5 py-3.5 text-base font-semibold text-slate-950 transition hover:brightness-105"
            >
              Sign in to continue
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={appHref}
              className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-base font-medium text-slate-100 transition hover:bg-white/[0.08]"
            >
              Open app workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
