"use client";

/**
 * RecallHowItWorks — STEP 2 · § "The loop" (how it works).
 *
 * RESTRAINED by design: ONE idea ("four steps, one loop"), ONE focal element
 * (the REAL in-app reader, shown exactly ONCE, auto-playing through its four
 * phases), and a minimal four-step rail that NAMES the loop in plain words.
 *
 * Deliberately NO curve / chart here — the retention curve appears exactly once,
 * in the hero. The fourth step (spaced review) is the differentiator and is
 * described in TYPOGRAPHY, not re-drawn as a graph.
 *
 * Near-monochrome over the same deep canvas; the single periwinkle recall accent
 * is the only hue. Fast cf-fade-up entrances; prefers-reduced-motion renders the
 * final state statically and the reader is mounted controlled+static.
 */

import dynamic from "next/dynamic";
import { BookOpen, Lightbulb, CircleCheck, CalendarClock } from "lucide-react";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { CATALOG_MEDIAN_CHAPTER_MINUTES } from "@/lib/catalog-stats";
import { RecallReaderShowcase } from "./RecallReaderShowcase";

/** The heavy client reader is loaded lazily, below the fold. A reserved-height
 *  skeleton keeps CLS at 0 while the chunk streams in. */
const DesktopReaderShell = dynamic(
  () =>
    import("@/components/landing/reader-demo/DesktopReaderShell").then(
      (mod) => mod.DesktopReaderShell
    ),
  { ssr: false, loading: () => <ReaderSkeleton /> }
);

function ReaderSkeleton() {
  return (
    <div
      aria-hidden
      className="aspect-[1180/760] w-full rounded-2xl border"
      style={{
        background: "var(--cf-recall-plate)",
        borderColor: "var(--cf-recall-frame)",
      }}
    />
  );
}

type Step = {
  icon: typeof BookOpen;
  label: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: BookOpen,
    label: "Summary",
    body: "The big ideas of the whole book, distilled to what matters.",
  },
  {
    icon: Lightbulb,
    label: "Examples",
    body: "Watch each idea play out in real situations, so it actually clicks for you.",
  },
  {
    icon: CircleCheck,
    label: "Quiz",
    body: "You recall it in your own words. That small act of effort is what burns it in.",
  },
  {
    icon: CalendarClock,
    label: "Spaced review",
    body: "It finds you again days later, right before you'd forget, until it is yours for good.",
  },
];

export function RecallHowItWorks() {
  // Honor the in-app motion toggle (html[data-motion=reduced]), not just the OS
  // query. Reduced → mount the reader controlled + static (no auto-advance).
  const reduced = usePrefersReducedMotion();

  return (
    <section
      id="how-it-works"
      aria-labelledby="recall-loop-headline"
      className="relative w-full overflow-hidden px-6 py-28 sm:px-10 sm:py-32 lg:px-16 lg:py-40"
      style={{ background: "transparent" }}
    >
      <div className="mx-auto w-full max-w-[72rem]">
        {/* ── Editorial header: one idea, lots of air ── */}
        <header className="mx-auto max-w-[44rem] text-center">
          <p
            className="cf-fade-up font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.34em]"
            style={{
              color: "var(--cf-recall-ink-faint)",
              animationDelay: "0ms",
            }}
          >
            The loop
          </p>
          <h2
            id="recall-loop-headline"
            className="cf-fade-up mt-6 font-(family-name:--font-display) font-bold leading-[0.96] tracking-[-0.04em] text-balance"
            style={{
              color: "var(--cf-recall-ink)",
              fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)",
              animationDelay: "55ms",
            }}
          >
            Four steps. Then it sticks.
          </h2>
          <p
            className="cf-fade-up mx-auto mt-6 max-w-[40ch] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]"
            style={{
              color: "var(--cf-recall-ink-soft)",
              animationDelay: "110ms",
            }}
          >
            Every chapter takes about {CATALOG_MEDIAN_CHAPTER_MINUTES} minutes.
            You read it, you recall it, and the ideas come back on their own, with
            no notebooks and no willpower.
          </p>
        </header>

        {/* ── ONE focal element: the REAL reader, shown once, seated in light so
            the bright product screen reads as an intentional, lit object on the
            dark page (not a flat slab). ── */}
        <div
          className="cf-fade-up relative isolate mx-auto mt-16 max-w-[60rem] sm:mt-20"
          style={{ animationDelay: "165ms" }}
        >
          {/* periwinkle halo pooled behind the screen */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[120%] w-[118%] -translate-x-1/2 -translate-y-1/2 rounded-[3rem]"
            style={{
              background:
                "radial-gradient(closest-side, var(--cf-recall-bloom-deep), var(--cf-recall-bloom) 42%, transparent 74%)",
            }}
          />
          {/* Scopes the reader-demo fixes/skin (sticky-bar bug fix + periwinkle
              accent) and adds the gentle 3D tilt. */}
          <RecallReaderShowcase>
            <div
              className="overflow-hidden rounded-[1.75rem] md:rounded-2xl"
              style={{
                boxShadow:
                  "0 40px 120px -40px var(--cf-recall-glow), 0 0 0 1px var(--cf-recall-frame)",
              }}
            >
              {reduced ? (
                <DesktopReaderShell controlledPhase="summary" autoPlay={false} />
              ) : (
                <DesktopReaderShell autoPlay />
              )}
            </div>
          </RecallReaderShowcase>
        </div>

        {/* ── The four-step rail: NAMES the loop, no chart ── */}
        <ol className="mx-auto mt-16 grid max-w-[64rem] grid-cols-1 gap-px overflow-hidden rounded-2xl border sm:mt-20 sm:grid-cols-2 lg:grid-cols-4"
          style={{
            borderColor: "var(--cf-recall-frame)",
            background: "var(--cf-recall-frame)",
          }}
        >
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className="cf-fade-up flex flex-col gap-4 p-7 sm:p-8"
                style={{
                  background: "var(--cf-recall-plate)",
                  animationDelay: `${200 + i * 45}ms`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="font-(family-name:--font-mono) text-[12px] tracking-[0.18em]"
                    style={{ color: "var(--cf-recall-accent)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                    style={{ color: "var(--cf-recall-accent)" }}
                  />
                </div>
                <div>
                  <h3
                    className="font-(family-name:--font-display) text-[1.0625rem] font-semibold"
                    style={{ color: "var(--cf-recall-ink)" }}
                  >
                    {step.label}
                  </h3>
                  <p
                    className="mt-2 text-[0.9375rem] leading-relaxed"
                    style={{ color: "var(--cf-recall-ink-soft)" }}
                  >
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
