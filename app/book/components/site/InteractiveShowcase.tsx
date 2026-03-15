"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpenCheck,
  CircleCheckBig,
  LockKeyhole,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/app/book/components/ui/cn";
import { landingContent } from "@/app/book/components/site/content";

export function InteractiveShowcase() {
  const [modeId, setModeId] = useState<(typeof landingContent.showcase.modes)[number]["id"]>(
    landingContent.showcase.modes[1].id
  );
  const [audienceId, setAudienceId] = useState<
    (typeof landingContent.showcase.audiences)[number]["id"]
  >(landingContent.showcase.audiences[0].id);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const reduceMotion = useReducedMotion();

  const activeMode = useMemo(
    () => landingContent.showcase.modes.find((mode) => mode.id === modeId)!,
    [modeId]
  );
  const activeAudience = useMemo(
    () => landingContent.showcase.audiences.find((audience) => audience.id === audienceId)!,
    [audienceId]
  );

  useEffect(() => {
    setSelectedOption(null);
  }, [modeId, audienceId]);

  const unlocked = selectedOption === activeAudience.correctIndex;
  const quizProgress = unlocked ? 100 : Math.min(activeMode.progress + 12, 86);

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: "easeOut" as const };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
      <div className="cf-site-panel-strong overflow-hidden rounded-[34px]">
        <div className="border-b border-white/10 px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/74">
                Live chapter demo
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                Switch depth, examples, and quiz state in one surface.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                This preview mirrors the real ChapterFlow product loop: summary first,
                real-life examples second, quiz unlock last.
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Reading depth">
              {landingContent.showcase.modes.map((mode) => {
                const active = mode.id === modeId;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setModeId(mode.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50",
                      active
                        ? "border-cyan-300/28 bg-cyan-400/12 text-cyan-50"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-50"
                    )}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(5,12,25,0.82)]">
            <div className="border-b border-white/10 px-4 py-3 text-xs text-slate-400 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-2 uppercase tracking-[0.22em]">ChapterFlow session</span>
              </div>
            </div>

            <div className="grid gap-5 p-4 lg:grid-cols-[1.15fr_0.85fr] lg:p-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/74">
                      Book
                    </p>
                    <h4 className="mt-2 text-xl font-semibold text-slate-50">
                      Deep Work
                    </h4>
                    <p className="mt-1 text-sm text-slate-400">
                      Chapter 4 · Make focus visible enough to repeat
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Mode
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-50">
                      {activeMode.label}
                    </p>
                  </div>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-900/80">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,1),rgba(94,234,212,1))]"
                    animate={{ width: `${activeMode.progress}%` }}
                    transition={transition}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{activeMode.sessionLength}</span>
                  <span>{activeMode.progress}% of the chapter flow complete</span>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.article
                    key={activeMode.id}
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
                    transition={transition}
                    className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/74">
                      Chapter summary
                    </p>
                    <h5 className="mt-2 text-2xl font-semibold text-slate-50">
                      {activeMode.summaryTitle}
                    </h5>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {activeMode.summary}
                    </p>

                    <div className="mt-5 space-y-2">
                      {activeMode.bullets.map((bullet) => (
                        <div key={bullet} className="flex items-start gap-2 text-sm text-slate-200">
                          <CircleCheckBig className="mt-0.5 h-4 w-4 text-emerald-300" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        {activeMode.quizQuestions} question quiz
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        Summary → examples → unlock
                      </span>
                    </div>
                  </motion.article>
                </AnimatePresence>
              </div>

              <div className="space-y-4">
                <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/74">
                    Reading path
                  </p>

                  <div className="mt-4 space-y-2">
                    {[
                      "Read the chapter summary",
                      "Switch to a real-life example",
                      "Pass the quiz to unlock next chapter",
                    ].map((item, index) => (
                      <div
                        key={item}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm",
                          index < 2 || unlocked
                            ? "border-emerald-300/18 bg-emerald-500/8 text-slate-100"
                            : "border-white/10 bg-black/20 text-slate-400"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                            index < 2 || unlocked
                              ? "border-emerald-300/24 bg-emerald-500/18 text-emerald-100"
                              : "border-white/10 bg-white/[0.04] text-slate-500"
                          )}
                        >
                          {index + 1}
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-[24px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(56,189,248,0.10),rgba(94,234,212,0.05))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/78">
                        Unlock rule
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-50">
                        Quiz must be passed before progression.
                      </p>
                    </div>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/22 bg-slate-950/35 text-cyan-100">
                      <LockKeyhole className="h-4 w-4" />
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-200">
                    The next chapter stays locked until the reader proves the idea has landed.
                  </p>
                </article>
              </div>
            </div>

            <div className="border-t border-white/10 p-4 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/74">
                    Real-life examples
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Change the lens and watch the same chapter idea adapt to different parts of life.
                  </p>
                </div>

                <div
                  className="flex flex-wrap gap-2"
                  role="toolbar"
                  aria-label="Example audience"
                >
                  {landingContent.showcase.audiences.map((audience) => {
                    const active = audience.id === audienceId;

                    return (
                      <button
                        key={audience.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAudienceId(audience.id)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50",
                          active
                            ? "border-cyan-300/28 bg-cyan-400/12 text-cyan-50"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-50"
                        )}
                      >
                        {audience.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={activeAudience.id}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
                  transition={transition}
                  className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h5 className="text-xl font-semibold text-slate-50">
                        {activeAudience.title}
                      </h5>
                      <p className="mt-2 text-sm leading-7 text-slate-300">
                        {activeAudience.scenario}
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                      {activeAudience.label}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/74">
                        What ChapterFlow shows
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {activeAudience.application}
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/74">
                        Why it sticks
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {activeAudience.whyItSticks}
                      </p>
                    </div>
                  </div>
                </motion.article>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={`${modeId}-${audienceId}`}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
            transition={transition}
            className="cf-site-panel rounded-[34px] p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/74">
                  Quiz unlock
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
                  {activeAudience.quizPrompt}
                </h3>
              </div>

              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/18 bg-cyan-400/10 text-cyan-100">
                <BookOpenCheck className="h-4.5 w-4.5" />
              </span>
            </div>

            <div className="mt-5 space-y-2">
              {activeAudience.quizOptions.map((option, index) => {
                const selected = selectedOption === index;
                const correct = index === activeAudience.correctIndex;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelectedOption(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50",
                      selected && correct
                        ? "border-emerald-300/26 bg-emerald-500/10 text-emerald-50"
                        : selected
                          ? "border-rose-300/22 bg-rose-500/10 text-rose-100"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        selected && correct
                          ? "border-emerald-300/26 bg-emerald-500/18 text-emerald-100"
                          : selected
                            ? "border-rose-300/22 bg-rose-500/18 text-rose-100"
                            : "border-white/10 bg-black/20 text-slate-500"
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">{option}</span>
                    {selected && correct ? (
                      <CircleCheckBig className="h-4 w-4 text-emerald-300" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="inline-flex items-center gap-2 text-slate-300">
                  <Target className="h-4 w-4 text-cyan-100" />
                  Pass score
                </span>
                <span className="font-semibold text-slate-50">80%</span>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-900/80">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    unlocked
                      ? "bg-[linear-gradient(90deg,rgba(16,185,129,1),rgba(94,234,212,1))]"
                      : "bg-[linear-gradient(90deg,rgba(56,189,248,1),rgba(94,234,212,1))]"
                  )}
                  animate={{ width: `${quizProgress}%` }}
                  transition={transition}
                />
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                {selectedOption === null
                  ? "Choose an answer to simulate the quiz gate and see what progression feels like."
                  : unlocked
                    ? "Correct. The next chapter unlocks immediately, and the reading flow keeps moving."
                    : "Not quite. The chapter stays locked until the reader demonstrates understanding."}
              </p>
            </div>
          </motion.article>
        </AnimatePresence>

        <article className="cf-site-panel rounded-[34px] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/74">
            Momentum signals
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-slate-400">Mode depth</p>
              <p className="mt-2 text-xl font-semibold text-slate-50">{activeMode.label}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                {activeMode.sessionLength}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-slate-400">Example lens</p>
              <p className="mt-2 text-xl font-semibold text-slate-50">{activeAudience.label}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                Real-life relevance
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-slate-400">Library scale</p>
              <p className="mt-2 text-xl font-semibold text-slate-50">~200 books</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                Expanding rapidly
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-[22px] border border-cyan-300/16 bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-slate-200">
            <Sparkles className="h-4 w-4 shrink-0 text-cyan-100" />
            The showcase stays lightweight, but the product story stays precise:
            finish more books by making comprehension part of progression.
          </div>
        </article>
      </div>
    </div>
  );
}
