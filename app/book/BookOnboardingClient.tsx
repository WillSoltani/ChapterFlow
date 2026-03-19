"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeHelp,
  BookOpen,
  Brain,
  Briefcase,
  Check,
  Compass,
  FileText,
  Flame,
  GraduationCap,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Rocket,
  Scale,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { OnboardingShell } from "@/app/book/components/OnboardingShell";
import { BookCard } from "@/app/book/components/BookCard";
import { GoalPicker, formatMinutesLabel } from "@/app/book/components/GoalPicker";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import {
  type LearningStyle,
  type MotivationStyle,
  type OccupationOption,
  type PronounOption,
  type QuizIntensity,
  type ReadingGoalOption,
  type ReferralSourceOption,
  useOnboardingState,
} from "@/app/book/hooks/useOnboardingState";

const TOTAL_STEPS = 7;
const MAX_BOOKS = 3;
const MAX_CATEGORIES = 3;

// ─── Category definitions ─────────────────────────────────────────────────────

type InterestCategoryDef = {
  key: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  maps: string[];
};

const INTEREST_CATEGORIES: InterestCategoryDef[] = [
  {
    key: "psychology",
    label: "Psychology & Behavior",
    description: "Human nature, biases, and what drives decisions",
    Icon: Brain,
    maps: ["Psychology", "Human Behavior", "Behavior", "Behavioral Economics"],
  },
  {
    key: "business",
    label: "Business & Strategy",
    description: "Building organizations and winning in markets",
    Icon: Briefcase,
    maps: ["Business", "Strategy", "Management", "Execution", "Governance"],
  },
  {
    key: "productivity",
    label: "Productivity & Focus",
    description: "Systems for deep work and getting more done",
    Icon: Zap,
    maps: ["Productivity", "Focus", "Self Management", "Attention"],
  },
  {
    key: "communication",
    label: "Communication & Influence",
    description: "Persuasion, negotiation, and reading people",
    Icon: MessageSquare,
    maps: [
      "Communication",
      "Persuasion",
      "Negotiation",
      "Social Skills",
      "Presentation Skills",
      "Public Speaking",
      "Conflict",
    ],
  },
  {
    key: "self-development",
    label: "Self Development",
    description: "Habits, mindset, discipline, and becoming your best self",
    Icon: Sprout,
    maps: [
      "Self Development",
      "Self Improvement",
      "Personal Development",
      "Self Mastery",
      "Self Discipline",
      "Self Awareness",
    ],
  },
  {
    key: "finance",
    label: "Finance & Wealth",
    description: "Money management, investing, and building wealth",
    Icon: TrendingUp,
    maps: ["Finance", "Personal Finance", "Wealth"],
  },
  {
    key: "leadership",
    label: "Leadership & Career",
    description: "Leading teams, driving results, and career growth",
    Icon: Target,
    maps: ["Leadership", "Career"],
  },
  {
    key: "thinking",
    label: "Decision Making",
    description: "Mental models, reasoning, and reducing costly mistakes",
    Icon: Lightbulb,
    maps: ["Decision Making", "Mental Models", "Thinking", "Risk", "Behavioral Economics"],
  },
  {
    key: "resilience",
    label: "Resilience & Grit",
    description: "Mental toughness and thriving under pressure",
    Icon: Flame,
    maps: ["Resilience", "Mental Toughness"],
  },
  {
    key: "learning",
    label: "Learning & Mastery",
    description: "Accelerated learning and deep skill acquisition",
    Icon: GraduationCap,
    maps: ["Learning", "Education", "Skill Building"],
  },
  {
    key: "habits",
    label: "Habits & Behavior Change",
    description: "Building routines that stick and breaking bad patterns",
    Icon: RefreshCw,
    maps: ["Behavior Change", "Attention"],
  },
  {
    key: "relationships",
    label: "Relationships",
    description: "Deepening connections and understanding people",
    Icon: Users,
    maps: ["Relationships", "Social Skills"],
  },
  {
    key: "philosophy",
    label: "Philosophy & Meaning",
    description: "Stoicism, ethics, and living with purpose",
    Icon: Scale,
    maps: ["Philosophy", "Stoicism", "Meaning", "Happiness", "Ethics"],
  },
  {
    key: "entrepreneurship",
    label: "Entrepreneurship",
    description: "Starting companies, innovation, and product thinking",
    Icon: Rocket,
    maps: ["Entrepreneurship", "Innovation", "Product"],
  },
];

// ─── Option sets ──────────────────────────────────────────────────────────────

const pronounOptions: PronounOption[] = [
  "Prefer not to say",
  "She / Her",
  "He / Him",
  "They / Them",
];

const occupationOptions: OccupationOption[] = [
  "Student",
  "Professional",
  "Entrepreneur",
  "Creative",
  "Other",
];

const referralSourceOptions: ReferralSourceOption[] = [
  "Social media",
  "Word of mouth",
  "Search engine",
  "Newsletter",
  "Other",
];

const learningStyleOptions: Array<{ value: LearningStyle; label: string }> = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "deep", label: "Deep" },
];

const quizIntensityOptions: Array<{ value: QuizIntensity; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "standard", label: "Standard" },
  { value: "challenging", label: "Challenging" },
];

const motivationStyleOptions: Array<{ value: MotivationStyle; label: string }> = [
  { value: "gentle", label: "Gentle" },
  { value: "direct", label: "Direct" },
  { value: "competitive", label: "Competitive" },
];

const readingGoalOptions: Array<{
  value: ReadingGoalOption;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "career",
    label: "Career Growth",
    description: "Advance professionally and stay sharp in your field",
    icon: TrendingUp,
  },
  {
    value: "decisions",
    label: "Better Decisions",
    description: "Think more clearly and reason through hard choices",
    icon: Brain,
  },
  {
    value: "skills",
    label: "Learn New Skills",
    description: "Pick up frameworks, tools, and practical knowledge",
    icon: GraduationCap,
  },
  {
    value: "personal",
    label: "Personal Growth",
    description: "Build better habits, mindset, and self-awareness",
    icon: Sprout,
  },
  {
    value: "curiosity",
    label: "Pure Curiosity",
    description: "Read for the joy of learning without a specific agenda",
    icon: Compass,
  },
];

const stepContent = [
  {
    title: "ChapterFlow",
    subtitle:
      "Read with more clarity, more momentum, and more retention through guided chapter sessions built for depth.",
  },
  {
    title: "Let's personalize this",
    subtitle: "Tell us a bit about yourself so we can tailor your experience.",
  },
  {
    title: "What brings you here?",
    subtitle: "Understanding your goals helps us make ChapterFlow work better for you.",
  },
  {
    title: "What interests you?",
    subtitle: `Pick ${MAX_CATEGORIES} categories — we'll find the best books for your goals.`,
  },
  {
    title: "Pick your first books",
    subtitle: `Choose ${MAX_BOOKS} books from your selected categories to get started.`,
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

function isValidEmailOrEmpty(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

// ─── Shared primitives ────────────────────────────────────────────────────────

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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
          : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) hover:border-(--cf-border-strong)",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

type GoalCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

function GoalCard({ icon: Icon, label, description, selected, onSelect }: GoalCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft)"
          : "border-(--cf-border) bg-(--cf-surface-muted) hover:border-(--cf-border-strong) hover:bg-(--cf-surface)",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          selected
            ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
            : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p
          className={[
            "text-sm font-semibold",
            selected ? "text-(--cf-info-text)" : "text-(--cf-text-1)",
          ].join(" ")}
        >
          {label}
        </p>
        <p className="mt-0.5 text-xs text-(--cf-text-3)">{description}</p>
      </div>
    </button>
  );
}

type CategoryCardProps = {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function CategoryCard({
  Icon,
  label,
  description,
  selected,
  disabled,
  onSelect,
}: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        "relative flex flex-col gap-2.5 rounded-2xl border p-3.5 text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft) shadow-[0_0_0_3px_rgba(14,165,233,0.12)]"
          : disabled
            ? "cursor-not-allowed border-(--cf-border) bg-(--cf-surface-muted) opacity-30"
            : "border-(--cf-border) bg-(--cf-surface-muted) hover:border-(--cf-border-strong) hover:bg-(--cf-surface)",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200",
          selected
            ? "border-(--cf-accent-border) bg-(--cf-accent) text-white shadow-[0_2px_8px_rgba(14,165,233,0.35)]"
            : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p
          className={[
            "text-sm font-semibold leading-tight",
            selected ? "text-(--cf-info-text)" : "text-(--cf-text-1)",
          ].join(" ")}
        >
          {label}
        </p>
        <p className="mt-1 text-xs leading-snug text-(--cf-text-3)">{description}</p>
      </div>
      {selected && (
        <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-(--cf-accent)">
          <Check className="h-2.5 w-2.5 text-white" />
        </span>
      )}
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
    <li className="flex items-start gap-3 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-3.5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-(--cf-text-1)">{title}</p>
        <p className="mt-1 text-sm text-(--cf-text-2)">{description}</p>
      </div>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BookOnboardingClient() {
  const router = useRouter();
  const {
    state,
    hydrated,
    goNextStep,
    goPreviousStep,
    setName,
    setEmail,
    setCity,
    setPronoun,
    setOccupation,
    setReadingGoal,
    setReferralSource,
    toggleCategorySelection,
    clearBookSelections,
    toggleBookSelection,
    setDailyGoalMinutes,
    setReminderTime,
    setLearningStyle,
    setQuizIntensity,
    setStreakMode,
    setMotivationStyle,
    completeSetup,
  } = useOnboardingState();

  // Redirect if already complete
  useEffect(() => {
    if (!hydrated) return;
    if (state.setupComplete) router.replace("/book/workspace");
  }, [hydrated, router, state.setupComplete]);

  // On a fresh device localStorage is empty — check backend so returning users skip onboarding
  useEffect(() => {
    if (!hydrated) return;
    if (state.setupComplete) return;
    fetch("/app/api/book/me/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile?.onboardingCompleted === true) {
          completeSetup();
          router.replace("/book/workspace");
        }
      })
      .catch(() => {});
  }, [hydrated, state.setupComplete, completeSetup, router]);

  const step = state.currentStep;

  // ── Selection state ────────────────────────────────────────────────────────
  const selectedCount = state.selectedBookIds.length;
  const selectedBooksSet = useMemo(
    () => new Set(state.selectedBookIds),
    [state.selectedBookIds]
  );
  const selectedCategoriesSet = useMemo(
    () => new Set(state.selectedCategories),
    [state.selectedCategories]
  );
  const bookLimitReached = selectedCount >= MAX_BOOKS;
  const categoryLimitReached = state.selectedCategories.length >= MAX_CATEGORIES;

  // ── Clear books when categories change ────────────────────────────────────
  const categoriesSignatureRef = useRef<string>("");
  useEffect(() => {
    const signature = [...state.selectedCategories].sort().join(",");
    if (categoriesSignatureRef.current && signature !== categoriesSignatureRef.current) {
      clearBookSelections();
    }
    categoriesSignatureRef.current = signature;
  }, [state.selectedCategories, clearBookSelections]);

  // ── Filtered books for step 4 ────────────────────────────────────────────
  const expandedCategoryMaps = useMemo(() => {
    const expanded = new Set<string>();
    state.selectedCategories.forEach((key) => {
      const cat = INTEREST_CATEGORIES.find((c) => c.key === key);
      cat?.maps.forEach((m) => expanded.add(m));
    });
    return expanded;
  }, [state.selectedCategories]);

  const filteredBooks = useMemo(() => {
    if (expandedCategoryMaps.size === 0) return BOOKS_CATALOG;
    return BOOKS_CATALOG.filter((book) =>
      book.categories.some((c) => expandedCategoryMaps.has(c))
    );
  }, [expandedCategoryMaps]);

  // ── Book pagination ───────────────────────────────────────────────────────
  const [bookPage, setBookPage] = useState(0);
  const [booksPerPage, setBooksPerPage] = useState(10);

  const totalBookPages = Math.ceil(filteredBooks.length / booksPerPage);
  const paginatedBooks = useMemo(
    () => filteredBooks.slice(bookPage * booksPerPage, (bookPage + 1) * booksPerPage),
    [filteredBooks, bookPage, booksPerPage]
  );

  useEffect(() => {
    if (step === 4) setBookPage(0);
  }, [step]);

  const emailValid = isValidEmailOrEmpty(state.email);

  const canContinue = (() => {
    if (step === 1) return state.name.trim().length > 0 && emailValid;
    if (step === 3) return state.selectedCategories.length === MAX_CATEGORIES;
    if (step === 4) return selectedCount === MAX_BOOKS;
    return true;
  })();

  const handleContinue = () => {
    if (!canContinue) return;
    if (step === TOTAL_STEPS - 1) {
      fetch("/app/api/book/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            onboardingCompleted: true,
            displayName: state.name.trim() || undefined,
            pronouns:
              state.pronoun !== "Prefer not to say" ? state.pronoun : undefined,
            email: state.email.trim() || undefined,
            city: state.city.trim() || undefined,
            occupation: state.occupation ?? undefined,
            readingGoal: state.readingGoal ?? undefined,
            referralSource: state.referralSource ?? undefined,
            selectedCategories: state.selectedCategories,
            selectedBookIds: state.selectedBookIds,
            dailyGoalMinutes: state.dailyGoalMinutes,
            learningStyle: state.learningStyle,
            quizIntensity: state.quizIntensity,
            streakMode: state.streakMode,
            motivationStyle: state.motivationStyle,
          },
        }),
      }).catch(() => {});
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) px-5 py-3.5 text-lg font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.38)] transition hover:brightness-105 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
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
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-(--cf-border) bg-(--cf-surface) px-4 py-3 text-lg font-semibold text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) sm:w-40"
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
              ? "bg-linear-to-r from-amber-400 to-yellow-300 text-slate-900 shadow-[0_12px_28px_rgba(250,204,21,0.38)] focus-visible:ring-(--cf-warning-border)"
              : "bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) text-white shadow-[0_12px_28px_rgba(14,165,233,0.35)] focus-visible:ring-(--cf-accent-border)",
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
        <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-muted) p-8 text-center text-(--cf-text-2)">
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
            {/* ── Step 0: Welcome ─────────────────────────────────────────── */}
            {step === 0 ? (
              <div className="mx-auto max-w-4xl space-y-5">
                <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-[28px] border border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent) shadow-[0_0_35px_rgba(56,189,248,0.28)]">
                  <BookOpen className="h-10 w-10" />
                </div>

                <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface) p-5 sm:p-7">
                  <p className="text-center text-xs font-semibold uppercase tracking-[0.26em] text-(--cf-text-3)">
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

            {/* ── Step 1: Who you are ──────────────────────────────────────── */}
            {step === 1 ? (
              <div className="mx-auto max-w-3xl space-y-5 rounded-[30px] border border-(--cf-border) bg-(--cf-surface) p-5 sm:p-7">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-(--cf-text-2)">
                    What should we call you?{" "}
                    <span className="text-(--cf-accent)">*</span>
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={state.name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="cf-input w-full rounded-2xl px-4 py-3 text-lg"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-(--cf-text-2)">
                        Email address
                      </span>
                      <input
                        type="email"
                        value={state.email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={[
                          "cf-input w-full rounded-2xl px-4 py-3",
                          !emailValid
                            ? "border-(--cf-error-border) ring-1 ring-(--cf-error-border)"
                            : "",
                        ].join(" ")}
                      />
                    </label>
                    {!emailValid && (
                      <p className="mt-1.5 text-xs text-(--cf-error-text)">
                        Please enter a valid email address.
                      </p>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-(--cf-text-2)">
                      City
                    </span>
                    <input
                      type="text"
                      value={state.city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Toronto"
                      className="cf-input w-full rounded-2xl px-4 py-3"
                    />
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-(--cf-text-2)">
                    Preferred pronoun{" "}
                    <span className="font-normal text-(--cf-text-3)">(optional)</span>
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

                <div>
                  <p className="mb-2 text-sm font-medium text-(--cf-text-2)">
                    What best describes you?{" "}
                    <span className="font-normal text-(--cf-text-3)">(optional)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {occupationOptions.map((option) => (
                      <SegmentedOption
                        key={option}
                        label={option}
                        value={option}
                        selected={state.occupation === option}
                        onSelect={setOccupation}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-3 text-(--cf-info-text)">
                  Nice to meet you,{" "}
                  <span className="font-semibold">
                    {state.name.trim() || "there"}
                  </span>
                  . Let&apos;s set up your first books.
                </div>
              </div>
            ) : null}

            {/* ── Step 2: What brings you here ────────────────────────────── */}
            {step === 2 ? (
              <div className="mx-auto max-w-3xl space-y-6 rounded-[30px] border border-(--cf-border) bg-(--cf-surface) p-5 sm:p-7">
                <div>
                  <p className="mb-3 text-sm font-medium text-(--cf-text-2)">
                    What do you most want to get from reading?{" "}
                    <span className="font-normal text-(--cf-text-3)">(optional)</span>
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {readingGoalOptions.map((option) => (
                      <GoalCard
                        key={option.value}
                        icon={option.icon}
                        label={option.label}
                        description={option.description}
                        selected={state.readingGoal === option.value}
                        onSelect={() => setReadingGoal(option.value)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-(--cf-text-2)">
                    How did you hear about ChapterFlow?{" "}
                    <span className="font-normal text-(--cf-text-3)">(optional)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {referralSourceOptions.map((option) => (
                      <SegmentedOption
                        key={option}
                        label={option}
                        value={option}
                        selected={state.referralSource === option}
                        onSelect={setReferralSource}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-center text-xs text-(--cf-text-3)">
                  Both fields are optional — hit Continue whenever you&apos;re ready.
                </p>
              </div>
            ) : null}

            {/* ── Step 3: Category selection ───────────────────────────────── */}
            {step === 3 ? (
              <div className="space-y-5">
                {/* Progress counter */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {state.selectedCategories.map((key) => {
                      const cat = INTEREST_CATEGORIES.find((c) => c.key === key);
                      if (!cat) return null;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleCategorySelection(key)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-medium text-(--cf-info-text) transition hover:opacity-80"
                        >
                          <cat.Icon className="h-3 w-3" />
                          {cat.label}
                          <span className="ml-0.5 opacity-60">×</span>
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className={[
                      "shrink-0 text-sm font-semibold tabular-nums transition-colors",
                      state.selectedCategories.length === MAX_CATEGORIES
                        ? "text-(--cf-success-text)"
                        : "text-(--cf-text-2)",
                    ].join(" ")}
                  >
                    {state.selectedCategories.length} / {MAX_CATEGORIES} selected
                  </p>
                </div>

                {/* Category grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                  {INTEREST_CATEGORIES.map(({ key, label, description, Icon }) => {
                    const selected = selectedCategoriesSet.has(key);
                    const disabled = !selected && categoryLimitReached;
                    return (
                      <CategoryCard
                        key={key}
                        Icon={Icon}
                        label={label}
                        description={description}
                        selected={selected}
                        disabled={disabled}
                        onSelect={() => toggleCategorySelection(key)}
                      />
                    );
                  })}
                </div>

                {categoryLimitReached && (
                  <p className="text-center text-xs text-(--cf-text-3)">
                    Tap a selected category to swap it out.
                  </p>
                )}
              </div>
            ) : null}

            {/* ── Step 4: Book selection (filtered) ───────────────────────── */}
            {step === 4 ? (
              <div className="space-y-4">
                {/* Category context chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-(--cf-text-3)">Showing books from:</span>
                  {state.selectedCategories.map((key) => {
                    const cat = INTEREST_CATEGORIES.find((c) => c.key === key);
                    if (!cat) return null;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-2.5 py-0.5 text-xs font-medium text-(--cf-info-text)"
                      >
                        <cat.Icon className="h-3 w-3" />
                        {cat.label}
                      </span>
                    );
                  })}
                </div>

                {/* Header: selection count + per-page selector */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-(--cf-text-2)">
                    <span
                      className={[
                        "font-semibold",
                        selectedCount === MAX_BOOKS
                          ? "text-(--cf-success-text)"
                          : "text-(--cf-text-1)",
                      ].join(" ")}
                    >
                      {selectedCount}/{MAX_BOOKS}
                    </span>{" "}
                    books selected
                    <span className="ml-2 text-(--cf-text-3)">
                      · {filteredBooks.length} books match
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-(--cf-text-3)">Show</span>
                    {([10, 20, 50] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setBooksPerPage(n);
                          setBookPage(0);
                        }}
                        className={[
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                          booksPerPage === n
                            ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                            : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) hover:border-(--cf-border-strong)",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                    <span className="text-xs text-(--cf-text-3)">per page</span>
                  </div>
                </div>

                {/* Book grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {paginatedBooks.map((book) => {
                    const selected = selectedBooksSet.has(book.id);
                    const disabled = !selected && bookLimitReached;
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

                {filteredBooks.length === 0 && (
                  <p className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-6 text-center text-sm text-(--cf-text-3)">
                    No books found for your selected categories. Go back and try different ones.
                  </p>
                )}

                {/* Pagination controls */}
                {totalBookPages > 1 && (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={bookPage === 0}
                      onClick={() => setBookPage((p) => p - 1)}
                      className={[
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                        bookPage === 0
                          ? "cursor-not-allowed border-(--cf-border) text-(--cf-text-soft) opacity-40"
                          : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
                      ].join(" ")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Prev
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalBookPages }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setBookPage(i)}
                          className={[
                            "h-8 min-w-[2rem] rounded-xl border px-2 text-sm font-medium transition",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                            bookPage === i
                              ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                              : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong)",
                          ].join(" ")}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={bookPage === totalBookPages - 1}
                      onClick={() => setBookPage((p) => p + 1)}
                      className={[
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                        bookPage === totalBookPages - 1
                          ? "cursor-not-allowed border-(--cf-border) text-(--cf-text-soft) opacity-40"
                          : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
                      ].join(" ")}
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Step 5: Daily goal ───────────────────────────────────────── */}
            {step === 5 ? (
              <div className="mx-auto max-w-4xl space-y-4">
                <GoalPicker value={state.dailyGoalMinutes} onChange={setDailyGoalMinutes} />
                <p className="text-center text-lg text-(--cf-text-2)">
                  At{" "}
                  <span className="font-semibold text-(--cf-warning-text)">
                    {formatMinutesLabel(state.dailyGoalMinutes)}
                  </span>{" "}
                  per day, you&apos;ll finish a typical book in about{" "}
                  <span className="font-semibold text-(--cf-text-1)">
                    {estimateSessions(state.dailyGoalMinutes)} sessions
                  </span>
                  .
                </p>
              </div>
            ) : null}

            {/* ── Step 6: Preferences ─────────────────────────────────────── */}
            {step === 6 ? (
              <div className="mx-auto max-w-4xl space-y-4 rounded-[30px] border border-(--cf-border) bg-(--cf-surface) p-5 sm:p-7">
                <div>
                  <label className="mb-2 block text-sm font-medium text-(--cf-text-2)">
                    When should we remind you?
                  </label>
                  <input
                    type="time"
                    value={state.reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="cf-input w-44 rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-(--cf-text-2)">
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
                  <p className="mb-2 text-sm font-medium text-(--cf-text-2)">
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

                <div className="flex items-center justify-between rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-(--cf-text-1)">Track streaks</p>
                    <p className="text-sm text-(--cf-text-3)">
                      Keep a visible streak for consistent daily progress.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStreakMode(!state.streakMode)}
                    aria-pressed={state.streakMode}
                    className={[
                      "relative inline-flex h-7 w-12 items-center rounded-full transition",
                      state.streakMode ? "bg-(--cf-accent)" : "bg-(--cf-border-strong)",
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
                  <p className="mb-2 text-sm font-medium text-(--cf-text-2)">
                    Motivation style
                  </p>
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
