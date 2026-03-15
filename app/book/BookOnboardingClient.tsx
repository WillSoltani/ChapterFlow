"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeHelp,
  BookOpen,
  FileText,
  Lightbulb,
  Sparkles,
  Trophy,
} from "lucide-react";
import { OnboardingShell } from "@/app/book/components/OnboardingShell";
import { BookCard } from "@/app/book/components/BookCard";
import { GoalPicker, formatMinutesLabel } from "@/app/book/components/GoalPicker";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import {
  type LearningStyle,
  type MotivationStyle,
  type PronounOption,
  type QuizIntensity,
  useOnboardingState,
} from "@/app/book/hooks/useOnboardingState";

const TOTAL_STEPS = 5;
const MAX_BOOKS = 1;

const pronounOptions: PronounOption[] = [
  "Prefer not to say",
  "She / Her",
  "He / Him",
  "They / Them",
];

const learningStyleOptions: Array<{
  value: LearningStyle;
  label: string;
}> = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "deep", label: "Deep" },
];

const quizIntensityOptions: Array<{ value: QuizIntensity; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "standard", label: "Standard" },
  { value: "challenging", label: "Challenging" },
];

const motivationStyleOptions: Array<{
  value: MotivationStyle;
  label: string;
}> = [
  { value: "gentle", label: "Gentle" },
  { value: "direct", label: "Direct" },
  { value: "competitive", label: "Competitive" },
];

const stepContent = [
  {
    title: "ChapterFlow",
    subtitle:
      "Read with more clarity, more momentum, and more retention through guided chapter sessions built for depth.",
  },
  {
    title: "Let's personalize this",
    subtitle: "Tell us your name so we can tailor your first reading path.",
  },
  {
    title: "Pick your first book",
    subtitle:
      "Choose your starting book. You can add more titles later as the library grows.",
  },
  {
    title: "Set your daily goal",
    subtitle: "We'll help you stay consistent. You can adjust this later.",
  },
  {
    title: "One last personalization step",
    subtitle:
      "Optional preferences help us tune reminders, summaries, and quiz style to fit you.",
  },
];

function estimateSessions(goalMinutes: number): number {
  return Math.max(1, Math.ceil(300 / Math.max(goalMinutes, 10)));
}

type SegmentedOptionProps<T extends string> = {
  label: string;
  value: T;
  selected: boolean;
  onSelect: (value: T) => void;
};

function SegmentedOption<T extends string>({
  label,
  value,
  selected,
  onSelect,
}: SegmentedOptionProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={[
        "rounded-xl border px-3 py-2 text-sm transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50",
        selected
          ? "border-sky-300/55 bg-sky-400/20 text-sky-100"
          : "border-white/20 bg-white/5 text-slate-200 hover:border-white/35",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function HowItWorksRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/3 p-3.5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-500/15 text-sky-200">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>
    </li>
  );
}

export function BookOnboardingClient() {
  const router = useRouter();
  const {
    state,
    hydrated,
    goNextStep,
    goPreviousStep,
    setName,
    setPronoun,
    toggleBookSelection,
    setDailyGoalMinutes,
    setReminderTime,
    setLearningStyle,
    setQuizIntensity,
    setStreakMode,
    setMotivationStyle,
    completeSetup,
  } = useOnboardingState();

  useEffect(() => {
    if (!hydrated) return;
    if (state.setupComplete) {
      router.replace("/book/workspace");
    }
  }, [hydrated, router, state.setupComplete]);

  const step = state.currentStep;
  const selectedCount = state.selectedBookIds.length;
  const selectedBooksSet = useMemo(
    () => new Set(state.selectedBookIds),
    [state.selectedBookIds]
  );
  const limitReached = selectedCount >= MAX_BOOKS;

  const canContinue = (() => {
    if (step === 1) return state.name.trim().length > 0;
    if (step === 2) return selectedCount === MAX_BOOKS;
    return true;
  })();

  const handleContinue = () => {
    if (!canContinue) return;
    if (step === TOTAL_STEPS - 1) {
      completeSetup();
      router.push("/book/workspace");
      return;
    }
    goNextStep();
  };

  const subtitle = stepContent[step]?.subtitle ?? "";
  const title = stepContent[step]?.title ?? "";

  const actions =
    step === 0 ? (
      <div className="mx-auto flex max-w-sm justify-center">
        <button
          type="button"
          onClick={handleContinue}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 px-5 py-3.5 text-lg font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.38)] transition hover:brightness-105 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/55"
        >
          Get Started
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={goPreviousStep}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/5 px-4 py-3 text-lg font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:w-40"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className={[
            "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2",
            step === TOTAL_STEPS - 1
              ? "bg-linear-to-r from-amber-400 to-yellow-300 text-slate-900 shadow-[0_12px_28px_rgba(250,204,21,0.38)] focus-visible:ring-amber-300/60"
              : "bg-linear-to-r from-sky-500 to-cyan-400 text-white shadow-[0_12px_28px_rgba(14,165,233,0.35)] focus-visible:ring-sky-300/60",
            canContinue
              ? "hover:brightness-105 active:translate-y-0.5"
              : "cursor-not-allowed opacity-45",
          ].join(" ")}
        >
          {step === TOTAL_STEPS - 1 ? "Finish Setup" : "Continue"}
          {step === TOTAL_STEPS - 1 ? (
            <Sparkles className="h-5 w-5" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
        </button>
      </div>
    );

  return (
    <OnboardingShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {!hydrated ? (
        <div className="rounded-3xl border border-white/10 bg-white/3 p-8 text-center text-slate-300">
          Loading your onboarding setup...
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {step === 0 ? (
              <div className="mx-auto max-w-4xl space-y-5">
                <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-[28px] border border-sky-300/35 bg-linear-to-b from-sky-400/30 to-cyan-500/25 text-sky-100 shadow-[0_0_35px_rgba(56,189,248,0.28)]">
                  <BookOpen className="h-10 w-10" />
                </div>

                <div className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] p-5 sm:p-7">
                  <p className="text-center text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                    How it works
                  </p>
                  <ul className="mt-4 space-y-3">
                    <HowItWorksRow
                      icon={<FileText className="h-5 w-5" />}
                      title="Read a chapter summary"
                      description="A concise blend of short paragraphs and key bullets with optional detail expands."
                    />
                    <HowItWorksRow
                      icon={<Lightbulb className="h-5 w-5" />}
                      title="See real-world examples"
                      description="2–4 practical scenarios that connect ideas to daily decisions."
                    />
                    <HowItWorksRow
                      icon={<BadgeHelp className="h-5 w-5" />}
                      title="Pass the quiz to unlock the next chapter"
                      description="80% score required. Missed it? Review and retry."
                    />
                    <HowItWorksRow
                      icon={<Trophy className="h-5 w-5" />}
                      title="Finish the book and earn a badge"
                      description="Build momentum with a reading streak that actually sticks."
                    />
                  </ul>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mx-auto max-w-3xl space-y-4 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 sm:p-7">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">
                    What should we call you?
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={state.name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter your name"
                    className="w-full rounded-2xl border border-white/20 bg-white/6 px-4 py-3 text-lg text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
                  />
                </label>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-300">
                    Preferred pronoun (optional)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pronounOptions.map((pronoun) => (
                      <SegmentedOption
                        key={pronoun}
                        label={pronoun}
                        value={pronoun}
                        selected={state.pronoun === pronoun}
                        onSelect={setPronoun}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3 text-sky-100">
                  Nice to meet you,{" "}
                  <span className="font-semibold">
                    {state.name.trim() || "there"}
                  </span>
                  . Let&apos;s set up your first book.
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-300">
                    {selectedCount}/{MAX_BOOKS} selected
                  </p>
                  <p className="text-sm text-slate-400">
                    Start with this book and unlock the rest of the experience chapter by chapter.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {BOOKS_CATALOG.map((book) => {
                    const selected = selectedBooksSet.has(book.id);
                    const disabled = !selected && limitReached;
                    return (
                      <BookCard
                        key={book.id}
                        book={book}
                        selected={selected}
                        disabled={disabled}
                        onSelect={() => toggleBookSelection(book.id)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mx-auto max-w-4xl space-y-4">
                <GoalPicker value={state.dailyGoalMinutes} onChange={setDailyGoalMinutes} />
                <p className="text-center text-lg text-slate-300">
                  At{" "}
                  <span className="font-semibold text-amber-200">
                    {formatMinutesLabel(state.dailyGoalMinutes)}
                  </span>{" "}
                  per day, you&apos;ll finish a typical book in about{" "}
                  <span className="font-semibold text-slate-100">
                    {estimateSessions(state.dailyGoalMinutes)} sessions
                  </span>
                  .
                </p>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="mx-auto max-w-4xl space-y-4 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 sm:p-7">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    When should we remind you?
                  </label>
                  <input
                    type="time"
                    value={state.reminderTime}
                    onChange={(event) => setReminderTime(event.target.value)}
                    className="w-44 rounded-xl border border-white/20 bg-white/6 px-3 py-2 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-300">
                    Summaries style
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {learningStyleOptions.map((option) => (
                      <SegmentedOption
                        key={option.value}
                        label={option.label}
                        value={option.value}
                        selected={state.learningStyle === option.value}
                        onSelect={setLearningStyle}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-300">
                    Quiz difficulty
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {quizIntensityOptions.map((option) => (
                      <SegmentedOption
                        key={option.value}
                        label={option.label}
                        value={option.value}
                        selected={state.quizIntensity === option.value}
                        onSelect={setQuizIntensity}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Track streaks</p>
                    <p className="text-sm text-slate-400">
                      Keep a visible streak for consistent daily progress.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStreakMode(!state.streakMode)}
                    aria-pressed={state.streakMode}
                    className={[
                      "relative inline-flex h-7 w-12 items-center rounded-full transition",
                      state.streakMode ? "bg-sky-500" : "bg-white/25",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-block h-5 w-5 transform rounded-full bg-white transition",
                        state.streakMode ? "translate-x-6" : "translate-x-1",
                      ].join(" ")}
                    />
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-300">Motivation style</p>
                  <div className="flex flex-wrap gap-2">
                    {motivationStyleOptions.map((option) => (
                      <SegmentedOption
                        key={option.value}
                        label={option.label}
                        value={option.value}
                        selected={state.motivationStyle === option.value}
                        onSelect={setMotivationStyle}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      )}
    </OnboardingShell>
  );
}
