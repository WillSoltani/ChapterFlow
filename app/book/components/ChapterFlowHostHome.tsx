import Link from "next/link";
import { ArrowRight, BookOpen, BrainCircuit, Layers3, ShieldCheck } from "lucide-react";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  buildChapterFlowAppHref,
  buildChapterFlowSiteHref,
} from "@/app/_lib/chapterflow-brand";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";

type ChapterFlowHostHomeProps = {
  mode: "app" | "auth";
};

const featureCards = [
  {
    icon: BookOpen,
    title: "Read with structure",
    body:
      "Move chapter by chapter with clear summaries, examples, and quiz checkpoints that keep momentum high.",
  },
  {
    icon: BrainCircuit,
    title: "Retain what matters",
    body:
      "Track real reading time, reflect with notes, and turn finished chapters into stronger recall and better decisions.",
  },
  {
    icon: Layers3,
    title: "Build a reading flow",
    body:
      "Save what you want next, follow your queue, and keep a steady path through books that actually compound.",
  },
  {
    icon: ShieldCheck,
    title: "Own your progress",
    body:
      "Preferences, badges, streaks, and profile insights stay connected so the app feels like a real practice, not a toy.",
  },
];

export function ChapterFlowHostHome({ mode }: ChapterFlowHostHomeProps) {
  const primaryHref =
    mode === "auth"
      ? `/auth/login?returnTo=${encodeURIComponent(buildChapterFlowAppHref("/book"))}`
      : "/book";

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#040812] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(980px_circle_at_8%_-8%,rgba(34,211,238,0.18),transparent_54%),radial-gradient(860px_circle_at_94%_4%,rgba(244,114,182,0.10),transparent_45%),linear-gradient(180deg,rgba(5,10,24,0.98),rgba(3,7,18,1))]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-7 sm:px-6 sm:pb-24 sm:pt-10">
        <header className="flex items-center justify-between gap-4">
          <ChapterFlowMark />
          <div className="rounded-full border border-cyan-300/20 bg-cyan-400/8 px-3 py-1.5 text-xs uppercase tracking-[0.28em] text-cyan-100/75">
            {mode === "auth" ? "Auth Portal" : "Reading Workspace"}
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 pt-10 lg:grid-cols-[1.2fr_0.9fr] lg:pt-14">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs uppercase tracking-[0.24em] text-slate-300">
              Chapter driven learning
            </p>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-50 sm:text-6xl lg:text-7xl">
              {mode === "auth" ? "Sign in to continue your reading flow." : "A premium reading app built for momentum and depth."}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              {CHAPTERFLOW_TAGLINE}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.92),rgba(34,211,238,0.88))] px-5 py-3.5 text-base font-semibold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.22)] transition hover:brightness-105"
              >
                {mode === "auth" ? "Continue to ChapterFlow" : `Enter ${CHAPTERFLOW_NAME}`}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={mode === "auth" ? buildChapterFlowSiteHref("/") : "/auth/login"}
                className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-base font-medium text-slate-200 transition hover:bg-white/[0.08]"
              >
                {mode === "auth" ? "View product home" : "Sign in"}
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_50px_rgba(2,6,23,0.24)] backdrop-blur-xl"
                >
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-50">{card.title}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{card.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
