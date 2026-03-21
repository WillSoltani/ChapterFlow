"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Briefcase,
  Check,
  Clock3,
  Compass,
  FileText,
  GraduationCap,
  Layers,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { OnboardingShell } from "@/app/book/components/OnboardingShell";
import { BookCard } from "@/app/book/components/BookCard";
import { BookCover } from "@/app/book/components/BookCover";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import {
  buildPersonalizationRecommendation,
  type ChapterStartMode,
  getChapterStartModeLabel,
  getPreferredExampleContextLabel,
  type PreferredExampleContext,
} from "@/app/book/_lib/onboarding-personalization";
import { BOOKS_CATALOG, getBookById, type BookCatalogItem } from "@/app/book/data/booksCatalog";
import {
  type BookOnboardingState,
  type LearningStyle,
  type MotivationStyle,
  type ReadingGoalOption,
  useOnboardingState,
} from "@/app/book/hooks/useOnboardingState";

const TOTAL_STEPS = 5;
const MAX_BOOKS = 3;
const DEFAULT_DAILY_GOAL_MINUTES = 20;
const STEP_LABELS = ["Welcome", "How it works", "Tailor", "Starter shelf", "Ready"];
const READING_GOAL_VALUES: readonly ReadingGoalOption[] = [
  "career",
  "decisions",
  "skills",
  "personal",
  "curiosity",
] as const;
const CHAPTER_START_MODE_VALUES: readonly ChapterStartMode[] = [
  "summary-first",
  "practical-first",
  "balanced",
] as const;
const PREFERRED_EXAMPLE_CONTEXT_VALUES: readonly PreferredExampleContext[] = [
  "all",
  "work",
  "school",
  "personal",
] as const;
const AVAILABLE_BOOK_IDS = new Set(BOOKS_CATALOG.map((book) => book.id));

type ProfilePayload = {
  profile?: Partial<{
    onboardingCompleted: boolean;
    readingGoal: ReadingGoalOption;
    selectedCategories: string[];
    selectedBookIds: string[];
    dailyGoalMinutes: number;
    learningStyle: LearningStyle;
    chapterStartMode: ChapterStartMode;
    preferredExampleContext: PreferredExampleContext;
    motivationStyle: MotivationStyle;
  }> | null;
  identity?: Partial<{
    displayName: string;
    givenName: string | null;
  }> | null;
};

type GoalOption = {
  value: ReadingGoalOption;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

type StartModeOption = {
  value: ChapterStartMode;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

type ContextOption = {
  value: PreferredExampleContext;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

type LoopStage = {
  label: string;
  description: string;
  stat: string;
  Icon: ComponentType<{ className?: string }>;
};

const GOAL_OPTIONS: GoalOption[] = [
  {
    value: "career",
    label: "Move faster at work",
    description: "Prioritize books that sharpen judgment, leadership, and communication.",
    Icon: Briefcase,
  },
  {
    value: "decisions",
    label: "Think more clearly",
    description: "Start with frameworks that help you reason through hard choices.",
    Icon: Brain,
  },
  {
    value: "skills",
    label: "Build useful skills",
    description: "Lean into books that turn ideas into things you can actually use.",
    Icon: GraduationCap,
  },
  {
    value: "personal",
    label: "Grow in everyday life",
    description: "Surface books that help with habits, relationships, and self-direction.",
    Icon: Sparkles,
  },
  {
    value: "curiosity",
    label: "Follow curiosity",
    description: "Keep the shelf broad, thoughtful, and easy to explore without pressure.",
    Icon: Compass,
  },
];

const CHAPTER_START_OPTIONS: StartModeOption[] = [
  {
    value: "summary-first",
    label: "Start with the key idea",
    description: "Open each chapter with the clearest version of the takeaway, then branch into scenarios and quiz.",
    Icon: FileText,
  },
  {
    value: "practical-first",
    label: "Start with real situations",
    description: "Jump into scenarios first, then read the summary once the idea already feels grounded.",
    Icon: Lightbulb,
  },
  {
    value: "balanced",
    label: "Keep the full flow balanced",
    description: "Move through summary, scenarios, and quiz in a steady rhythm without front-loading one piece.",
    Icon: Layers,
  },
];

const CONTEXT_OPTIONS: ContextOption[] = [
  {
    value: "all",
    label: "Mix of everything",
    description: "Keep school, work, and personal-life examples equally available.",
    Icon: Compass,
  },
  {
    value: "work",
    label: "Work first",
    description: "Surface team, project, leadership, and career situations first.",
    Icon: Briefcase,
  },
  {
    value: "school",
    label: "School first",
    description: "Surface studying, classes, exams, and academic choices first.",
    Icon: GraduationCap,
  },
  {
    value: "personal",
    label: "Personal life first",
    description: "Surface habits, relationships, and everyday decisions first.",
    Icon: Users,
  },
];

const PRODUCT_LOOP: LoopStage[] = [
  {
    label: "Read the key idea",
    description: "Layered chapter summaries make the first pass clear fast.",
    stat: "Readable in one sitting",
    Icon: FileText,
  },
  {
    label: "See how it applies",
    description: "Each chapter includes practical scenarios that make the lesson feel usable.",
    stat: "6 scenarios per chapter",
    Icon: Lightbulb,
  },
  {
    label: "Lock it in",
    description: "Scenario-based quizzes check whether the idea actually stuck.",
    stat: "10 questions per chapter",
    Icon: Brain,
  },
  {
    label: "Keep momentum visible",
    description: "Progress, badges, and Flow Points make consistency easier to notice.",
    stat: "Progress that stays visible",
    Icon: Trophy,
  },
];

const READING_GOAL_LABELS: Record<ReadingGoalOption, string> = {
  career: "career growth",
  decisions: "better decisions",
  skills: "practical skill building",
  personal: "personal growth",
  curiosity: "curiosity-led reading",
};

const GOAL_KEYWORDS: Record<ReadingGoalOption, string[]> = {
  career: ["career", "leadership", "business", "strategy", "management", "communication"],
  decisions: ["decision", "mental models", "psychology", "behavior", "risk", "thinking"],
  skills: ["learning", "productivity", "execution", "communication", "focus", "skill"],
  personal: ["self", "relationships", "habits", "philosophy", "meaning", "happiness"],
  curiosity: ["psychology", "philosophy", "business", "learning", "behavior", "history"],
};

const CONTEXT_KEYWORDS: Record<Exclude<PreferredExampleContext, "all">, string[]> = {
  work: ["business", "career", "leadership", "management", "strategy", "communication"],
  school: ["learning", "education", "psychology", "thinking", "focus", "skill"],
  personal: ["self", "habits", "relationships", "meaning", "happiness", "philosophy"],
};

function isReadingGoal(value: unknown): value is ReadingGoalOption {
  return typeof value === "string" && READING_GOAL_VALUES.includes(value as ReadingGoalOption);
}

function isChapterStartMode(value: unknown): value is ChapterStartMode {
  return (
    typeof value === "string" &&
    CHAPTER_START_MODE_VALUES.includes(value as ChapterStartMode)
  );
}

function isPreferredExampleContext(value: unknown): value is PreferredExampleContext {
  return (
    typeof value === "string" &&
    PREFERRED_EXAMPLE_CONTEXT_VALUES.includes(value as PreferredExampleContext)
  );
}

function getFirstName(identity: ProfilePayload["identity"]): string | null {
  if (typeof identity?.givenName === "string" && identity.givenName.trim()) {
    return identity.givenName.trim();
  }
  if (typeof identity?.displayName === "string" && identity.displayName.trim()) {
    return identity.displayName.trim().split(/\s+/)[0] ?? null;
  }
  return null;
}

function deriveLearningStyle(goal: ReadingGoalOption | null, startMode: ChapterStartMode): LearningStyle {
  if (goal === "curiosity" || goal === "decisions") return "deep";
  if (startMode === "summary-first") return "concise";
  return "balanced";
}

function deriveMotivationStyle(goal: ReadingGoalOption | null): MotivationStyle {
  if (goal === "career" || goal === "skills") return "direct";
  return "gentle";
}

function deriveSelectedCategories(bookIds: string[]): string[] {
  const categories = bookIds
    .map((bookId) => getBookById(bookId))
    .filter((book): book is BookCatalogItem => Boolean(book))
    .flatMap((book) => book.categories);
  return Array.from(new Set(categories)).slice(0, 3);
}

function scoreBook(
  book: BookCatalogItem,
  goal: ReadingGoalOption | null,
  context: PreferredExampleContext
): number {
  const haystack = `${book.category} ${book.categories.join(" ")}`.toLowerCase();
  let score = 0;

  if (goal) {
    GOAL_KEYWORDS[goal].forEach((keyword, index) => {
      if (haystack.includes(keyword)) {
        score += 16 - index;
      }
    });
  }

  if (context !== "all") {
    CONTEXT_KEYWORDS[context].forEach((keyword, index) => {
      if (haystack.includes(keyword)) {
        score += 10 - index;
      }
    });
  }

  score += book.difficulty === "Easy" ? 4 : book.difficulty === "Medium" ? 2 : 0;
  score += Math.max(0, 6 - Math.round(book.estimatedMinutes / 70));

  return score;
}

function rankBooks(goal: ReadingGoalOption | null, context: PreferredExampleContext) {
  return [...BOOKS_CATALOG]
    .sort((left, right) => {
      const scoreDelta = scoreBook(right, goal, context) - scoreBook(left, goal, context);
      if (scoreDelta !== 0) return scoreDelta;
      if (left.difficulty !== right.difficulty) {
        const difficultyRank = { Easy: 0, Medium: 1, Hard: 2 } as const;
        return difficultyRank[left.difficulty] - difficultyRank[right.difficulty];
      }
      if (left.estimatedMinutes !== right.estimatedMinutes) {
        return left.estimatedMinutes - right.estimatedMinutes;
      }
      return left.title.localeCompare(right.title);
    });
}

function takeWrappedWindow<T>(items: T[], offset: number, size: number): T[] {
  if (items.length <= size) return items;
  const safeOffset = ((offset % items.length) + items.length) % items.length;
  const window = items.slice(safeOffset, safeOffset + size);
  if (window.length === size) return window;
  return [...window, ...items.slice(0, size - window.length)];
}

function formatBookCountLabel(count: number) {
  if (count === 1) return "1 book ready";
  return `${count} books ready`;
}

function helperCopyForStep(step: number, canContinue: boolean) {
  if (step === 0) return "A quick look at how the product works, then you are in.";
  if (step === 1) return "This is the actual reading loop inside ChapterFlow.";
  if (step === 2) {
    return canContinue
      ? "These choices shape what opens first and what feels most relevant."
      : "Choose a goal, a chapter opening style, and the scenario context that should feel closest first.";
  }
  if (step === 3) {
    return canContinue
      ? "Your starter shelf is ready. Swap anything if you want a different mix."
      : "Keep three books on your starter shelf so your workspace opens with a strong starting point.";
  }
  return "You can change these preferences later in settings without losing progress.";
}

type ChoiceCardProps = {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  icon?: ComponentType<{ className?: string }>;
  badge?: string;
};

function ChoiceCard({
  label,
  description,
  selected,
  onClick,
  icon: Icon,
  badge,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "group relative w-full overflow-hidden rounded-[28px] border p-5 text-left transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft) shadow-[0_18px_48px_var(--cf-accent-muted)]"
          : "border-(--cf-border) bg-(--cf-surface) hover:-translate-y-0.5 hover:border-(--cf-border-strong) hover:shadow-[var(--cf-shadow-md)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              className={[
                "mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                selected
                  ? "border-(--cf-accent-border) bg-white/70 text-(--cf-info-text)"
                  : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-(--cf-text-1)">
                {label}
              </h3>
              {badge ? (
                <span className="rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                  {badge}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">{description}</p>
          </div>
        </div>

        <span
          className={[
            "mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-(--cf-accent-border) bg-(--cf-accent) text-white"
              : "border-(--cf-border-strong) bg-(--cf-surface-muted) text-transparent",
          ].join(" ")}
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

type CompactOptionProps = {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
};

function CompactOption({
  label,
  description,
  selected,
  onClick,
  icon: Icon,
}: CompactOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "group relative rounded-[24px] border p-4 text-left transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft)"
          : "border-(--cf-border) bg-(--cf-surface) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-10 w-10 items-center justify-center rounded-2xl border",
          selected
            ? "border-(--cf-accent-border) bg-white/70 text-(--cf-info-text)"
            : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)",
        ].join(" ")}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-[-0.02em] text-(--cf-text-1)">
        {label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">{description}</p>
    </button>
  );
}

function LoadingShell() {
  return (
    <OnboardingShell
      step={0}
      totalSteps={TOTAL_STEPS}
      title="Getting your welcome tour ready"
      subtitle="Pulling in your account and starter shelf."
      stepLabels={STEP_LABELS}
      actions={<div />}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="h-24 rounded-[28px] bg-(--cf-surface-muted)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-40 rounded-[28px] bg-(--cf-surface-muted)" />
            <div className="h-40 rounded-[28px] bg-(--cf-surface-muted)" />
          </div>
        </div>
        <div className="h-[320px] rounded-[32px] bg-(--cf-surface-muted)" />
      </div>
    </OnboardingShell>
  );
}

export function BookOnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [identity, setIdentity] = useState<ProfilePayload["identity"]>(null);
  const [shelfOffset, setShelfOffset] = useState(0);
  const bootstrapRequestedRef = useRef(false);
  const profileSeededRef = useRef(false);
  const autoShelfSeedRef = useRef<string | null>(null);

  const {
    state,
    hydrated,
    patchState,
    goNextStep,
    goPreviousStep,
    setReadingGoal,
    setChapterStartMode,
    setPreferredExampleContext,
    toggleBookSelection,
    replaceBookSelections,
    completeSetup,
  } = useOnboardingState();

  const previewMode =
    searchParams.get("preview") === "1" ||
    searchParams.get("preview") === "true" ||
    searchParams.get("inspect") === "1" ||
    searchParams.get("inspect") === "true";

  useEffect(() => {
    if (!hydrated || bootstrapRequestedRef.current) return;
    bootstrapRequestedRef.current = true;

    let mounted = true;

    fetchBookJson<ProfilePayload>("/app/api/book/me/profile")
      .then((data) => {
        if (!mounted) return;
        setIdentity(data.identity ?? null);

        if (!previewMode && data?.profile?.onboardingCompleted === true) {
          completeSetup();
          router.replace("/book/workspace");
          return;
        }

        if (profileSeededRef.current) return;
        if (
          state.currentStep !== 0 ||
          state.readingGoal !== null ||
          state.selectedBookIds.length > 0
        ) {
          profileSeededRef.current = true;
          return;
        }

        const nextPatch: Partial<BookOnboardingState> = {};
        if (isReadingGoal(data.profile?.readingGoal)) {
          nextPatch.readingGoal = data.profile?.readingGoal;
        }
        if (isChapterStartMode(data.profile?.chapterStartMode)) {
          nextPatch.chapterStartMode = data.profile.chapterStartMode;
        }
        if (isPreferredExampleContext(data.profile?.preferredExampleContext)) {
          nextPatch.preferredExampleContext = data.profile.preferredExampleContext;
        }
        if (Array.isArray(data.profile?.selectedBookIds)) {
          nextPatch.selectedBookIds = data.profile.selectedBookIds.filter((bookId) =>
            AVAILABLE_BOOK_IDS.has(bookId)
          );
        }
        if (Array.isArray(data.profile?.selectedCategories)) {
          nextPatch.selectedCategories = data.profile.selectedCategories
            .filter((value): value is string => typeof value === "string")
            .slice(0, 3);
        }
        if (
          typeof data.profile?.dailyGoalMinutes === "number" &&
          Number.isFinite(data.profile.dailyGoalMinutes)
        ) {
          nextPatch.dailyGoalMinutes = data.profile.dailyGoalMinutes;
        }
        if (Object.keys(nextPatch).length > 0) {
          patchState(nextPatch);
        }
        profileSeededRef.current = true;
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setBootstrapping(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    completeSetup,
    hydrated,
    patchState,
    previewMode,
    router,
    state.currentStep,
    state.readingGoal,
    state.selectedBookIds.length,
  ]);

  const step = Math.min(state.currentStep, TOTAL_STEPS - 1);
  const firstName = getFirstName(identity);
  const previewBook =
    getBookById("atomic-habits") ??
    getBookById(state.selectedBookIds[0] || "") ??
    BOOKS_CATALOG[0]!;

  const rankedBooks = useMemo(
    () => rankBooks(state.readingGoal, state.preferredExampleContext),
    [state.preferredExampleContext, state.readingGoal]
  );

  useEffect(() => {
    setShelfOffset(0);
  }, [state.readingGoal, state.preferredExampleContext]);

  useEffect(() => {
    if (step !== 3) return;
    if (state.selectedBookIds.length > 0) return;

    const signature = `${state.readingGoal ?? "none"}:${state.preferredExampleContext}`;
    if (autoShelfSeedRef.current === signature) return;

    replaceBookSelections(rankedBooks.slice(0, MAX_BOOKS).map((book) => book.id));
    autoShelfSeedRef.current = signature;
  }, [
    rankedBooks,
    replaceBookSelections,
    state.preferredExampleContext,
    state.readingGoal,
    state.selectedBookIds.length,
    step,
  ]);

  const selectedBooks = useMemo(
    () =>
      state.selectedBookIds
        .map((bookId) => getBookById(bookId))
        .filter((book): book is BookCatalogItem => Boolean(book)),
    [state.selectedBookIds]
  );

  const suggestedWindow = useMemo(
    () => takeWrappedWindow(rankedBooks, shelfOffset, 6),
    [rankedBooks, shelfOffset]
  );

  const visibleBooks = useMemo(() => {
    const selectedSet = new Set(state.selectedBookIds);
    const orderedSelected = selectedBooks;
    const remainder = suggestedWindow.filter((book) => !selectedSet.has(book.id));
    return [...orderedSelected, ...remainder];
  }, [selectedBooks, state.selectedBookIds, suggestedWindow]);

  const canContinue = useMemo(() => {
    if (step === 2) {
      return state.readingGoal !== null;
    }
    if (step === 3 || step === 4) {
      return state.readingGoal !== null && state.selectedBookIds.length === MAX_BOOKS;
    }
    return true;
  }, [state.readingGoal, state.selectedBookIds.length, step]);

  const derivedLearningStyle = useMemo(
    () => deriveLearningStyle(state.readingGoal, state.chapterStartMode),
    [state.chapterStartMode, state.readingGoal]
  );
  const derivedMotivationStyle = useMemo(
    () => deriveMotivationStyle(state.readingGoal),
    [state.readingGoal]
  );
  const derivedCategories = useMemo(
    () => deriveSelectedCategories(state.selectedBookIds),
    [state.selectedBookIds]
  );

  const setupPreview = useMemo(() => {
    return buildPersonalizationRecommendation({
      readingGoalLabel: state.readingGoal ? READING_GOAL_LABELS[state.readingGoal] : null,
      chapterStartMode: state.chapterStartMode,
      preferredExampleContext: state.preferredExampleContext,
      learningStyle: derivedLearningStyle,
      motivationStyle: derivedMotivationStyle,
      dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
      selectedBookTitle: selectedBooks[0]?.title ?? null,
    });
  }, [
    derivedLearningStyle,
    derivedMotivationStyle,
    selectedBooks,
    state.chapterStartMode,
    state.preferredExampleContext,
    state.readingGoal,
  ]);

  async function handleComplete() {
    if (isSaving || !canContinue || !state.readingGoal) return;
    setSaveError(null);
    setIsSaving(true);

    const finalProfile = {
      onboardingCompleted: true,
      readingGoal: state.readingGoal,
      selectedBookIds: state.selectedBookIds,
      selectedCategories: derivedCategories,
      dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
      learningStyle: derivedLearningStyle,
      chapterStartMode: state.chapterStartMode,
      preferredExampleContext: state.preferredExampleContext,
      motivationStyle: derivedMotivationStyle,
    };

    try {
      await fetchBookJson("/app/api/book/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ profile: finalProfile }),
      });

      patchState(finalProfile);
      completeSetup();
      router.push("/book/workspace");
    } catch (error) {
      if (error instanceof BookClientError) {
        setSaveError(error.message);
      } else {
        setSaveError("We couldn't finish your setup just yet. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handlePrimaryAction() {
    if (step === TOTAL_STEPS - 1) {
      void handleComplete();
      return;
    }
    if (!canContinue) return;
    goNextStep();
  }

  if (!hydrated || bootstrapping) {
    return <LoadingShell />;
  }

  const primaryActionLabel =
    step === 0
      ? "Start my setup"
      : step === 1
        ? "Tailor the experience"
        : step === 2
          ? "Build my starter shelf"
          : step === 3
            ? "Review my setup"
            : "Open my workspace";

  const motionTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

  const subtitle =
    step === 0
      ? "Read the key idea, see how it applies, and lock it in before you move on."
      : step === 1
        ? "This is the rhythm inside every chapter, so the app feels useful from the first session."
        : step === 2
          ? "A few quick choices shape what opens first and which examples feel closest to you."
          : step === 3
            ? "We picked a few strong matches already. Keep them, swap them, and your workspace is ready."
            : "Everything is lined up so the app already feels like your space when you land inside.";

  return (
    <OnboardingShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={
        step === 0
          ? firstName
            ? `Welcome, ${firstName}.`
            : "Welcome to ChapterFlow."
          : step === 1
            ? "See the chapter flow."
            : step === 2
              ? "Make it feel like yours."
              : step === 3
                ? "Choose your starter shelf."
                : "Your first sessions are ready."
      }
      subtitle={subtitle}
      stepLabels={STEP_LABELS}
      actions={
        <div className="cf-panel rounded-[28px] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              {saveError ? (
                <p
                  className="rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-soft) px-4 py-3 text-sm text-(--cf-danger-text)"
                  role="alert"
                >
                  {saveError}
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-(--cf-text-2)">
                  {helperCopyForStep(step, canContinue)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goPreviousStep}
                  className="cf-btn cf-btn-secondary rounded-full px-5 py-3"
                >
                  Back
                </button>
              ) : null}

              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={!canContinue || isSaving}
                className="cf-btn rounded-full px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Finishing setup..." : primaryActionLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 0, y: 18, filter: "blur(8px)" }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 0, y: -12, filter: "blur(8px)" }
          }
          transition={motionTransition}
        >
          {step === 0 ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-end">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-info-text)">
                    Guided reading
                  </span>
                  <span className="rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                    Premium product tour
                  </span>
                </div>

                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-(--cf-text-2)">
                  ChapterFlow is built for people who want more than a book summary. You read
                  the key idea, see it in realistic situations, then prove it stuck before you
                  move on.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)">
                      <FileText className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-(--cf-text-1)">
                      Read clearly
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                      Start with the core idea instead of a wall of notes.
                    </p>
                  </div>
                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)">
                      <Lightbulb className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-(--cf-text-1)">
                      Apply it fast
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                      Scenarios make abstract ideas feel usable right away.
                    </p>
                  </div>
                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)">
                      <Trophy className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-(--cf-text-1)">
                      Keep momentum
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                      Progress stays visible without turning the product into noise.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface-muted),var(--cf-surface))] p-5 shadow-[var(--cf-shadow-md)]">
                <div className="flex items-start gap-4">
                  <BookCover
                    bookId={previewBook.id}
                    title={previewBook.title}
                    icon={previewBook.icon}
                    coverImage={previewBook.coverImage}
                    className="h-24 w-20 rounded-[20px] border border-(--cf-border) bg-(--cf-surface)"
                    fallbackClassName="text-4xl"
                    sizes="80px"
                    interactive={false}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                      Tonight&apos;s session
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-(--cf-text-1)">
                      {previewBook.title}
                    </h2>
                    <p className="mt-1 text-sm text-(--cf-text-2)">
                      {previewBook.author}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                      <span className="rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1">
                        Summary
                      </span>
                      <span className="rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1">
                        Scenarios
                      </span>
                      <span className="rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1">
                        Quiz
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3 rounded-[26px] border border-(--cf-border) bg-(--cf-surface) p-4">
                  <div className="flex items-center justify-between text-sm text-(--cf-text-2)">
                    <span>Chapter 1</span>
                    <span>Ready in one session</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Summary
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                        Clear first pass with the idea stripped to what matters.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Scenarios
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                        Real situations that make the takeaway easier to use.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Quiz
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                        Pass the chapter and unlock the next one.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
              <div className="grid gap-4 md:grid-cols-2">
                {PRODUCT_LOOP.map((stage) => (
                  <div
                    key={stage.label}
                    className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">
                      <stage.Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                      {stage.stat}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-(--cf-text-1)">
                      {stage.label}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">
                      {stage.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[30px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface-muted),var(--cf-surface))] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                  What makes it feel different
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-(--cf-text-1)">
                  The chapter does not end when the summary ends.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">
                  ChapterFlow is built around the full loop. You read the point, pressure test it
                  through realistic situations, then reinforce it with a quiz before you move on.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-4.5 w-4.5 text-(--cf-text-2)" />
                      <p className="text-sm font-medium text-(--cf-text-1)">
                        No dense reading list to manage up front.
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                      Your workspace opens with a small starter shelf instead of a crowded library.
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4">
                    <div className="flex items-center gap-3">
                      <Clock3 className="h-4.5 w-4.5 text-(--cf-text-2)" />
                      <p className="text-sm font-medium text-(--cf-text-1)">
                        Built for short, repeatable sessions.
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                      The default rhythm starts at 20 minutes so the product feels easy to return to.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-8">
              <section>
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                    What do you want most from this?
                  </p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {GOAL_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      label={option.label}
                      description={option.description}
                      icon={option.Icon}
                      selected={state.readingGoal === option.value}
                      onClick={() => setReadingGoal(option.value)}
                    />
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                    How should each chapter begin?
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {CHAPTER_START_OPTIONS.map((option) => (
                    <CompactOption
                      key={option.value}
                      label={option.label}
                      description={option.description}
                      icon={option.Icon}
                      selected={state.chapterStartMode === option.value}
                      onClick={() => setChapterStartMode(option.value)}
                    />
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                    Which examples should feel closest first?
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {CONTEXT_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      label={option.label}
                      description={option.description}
                      icon={option.Icon}
                      selected={state.preferredExampleContext === option.value}
                      onClick={() => setPreferredExampleContext(option.value)}
                    />
                  ))}
                </div>
              </section>

              <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                  Live preview
                </p>
                <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-(--cf-text-1)">
                  {setupPreview.headline}
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-(--cf-text-2)">
                  {setupPreview.body}
                </p>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-[30px] border border-(--cf-border) bg-(--cf-surface-muted) p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                    Starter shelf
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-(--cf-text-1)">
                    We picked three books that fit your setup.
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
                    Keep them as-is or swap in something closer to what you want right now.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="rounded-full border border-(--cf-border) bg-(--cf-surface) px-3.5 py-2 text-sm text-(--cf-text-2)">
                    {formatBookCountLabel(state.selectedBookIds.length)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShelfOffset((current) => current + 3)}
                    className="cf-btn cf-btn-secondary rounded-full px-4 py-2.5 text-sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Show a different mix
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {selectedBooks.map((book) => (
                  <div
                    key={book.id}
                    className="inline-flex items-center gap-3 rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-2"
                  >
                    <BookCover
                      bookId={book.id}
                      title={book.title}
                      icon={book.icon}
                      coverImage={book.coverImage}
                      className="h-11 w-9 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted)"
                      fallbackClassName="text-lg"
                      sizes="36px"
                      interactive={false}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-(--cf-text-1)">{book.title}</p>
                      <p className="truncate text-xs text-(--cf-text-3)">{book.author}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {visibleBooks.map((book, index) => {
                  const isSelected = state.selectedBookIds.includes(book.id);
                  const isRecommended = rankedBooks.slice(0, MAX_BOOKS).some((item) => item.id === book.id);
                  const disableNewSelection = !isSelected && state.selectedBookIds.length >= MAX_BOOKS;

                  return (
                    <div key={book.id} className="relative">
                      {isRecommended ? (
                        <span className="pointer-events-none absolute left-5 top-5 z-10 rounded-full border border-(--cf-accent-border) bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-info-text)">
                          Recommended
                        </span>
                      ) : null}
                      <BookCard
                        book={book}
                        selected={isSelected}
                        disabled={disableNewSelection}
                        onSelect={() => toggleBookSelection(book.id)}
                      />
                      {index < selectedBooks.length ? (
                        <span className="pointer-events-none absolute right-5 top-5 rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
              <div className="space-y-5">
                <div className="rounded-[30px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface-muted),var(--cf-surface))] p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                    Your setup
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-(--cf-text-1)">
                    {setupPreview.headline}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">
                    {setupPreview.body}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Chapter flow
                      </p>
                      <p className="mt-2 text-sm font-medium text-(--cf-text-1)">
                        {getChapterStartModeLabel(state.chapterStartMode)}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Scenario focus
                      </p>
                      <p className="mt-2 text-sm font-medium text-(--cf-text-1)">
                        {getPreferredExampleContextLabel(state.preferredExampleContext)}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                        Daily rhythm
                      </p>
                      <p className="mt-2 text-sm font-medium text-(--cf-text-1)">
                        {DEFAULT_DAILY_GOAL_MINUTES} minutes
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface-muted) p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                    What happens first
                  </p>
                  <ul className="mt-4 space-y-3">
                    {setupPreview.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-3 rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-4 text-sm leading-relaxed text-(--cf-text-2)"
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--cf-accent-soft) text-(--cf-info-text)">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface) p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                  Ready on your shelf
                </p>
                <div className="mt-5 space-y-4">
                  {selectedBooks.map((book, index) => (
                    <div
                      key={book.id}
                      className="flex items-center gap-4 rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-4"
                    >
                      <BookCover
                        bookId={book.id}
                        title={book.title}
                        icon={book.icon}
                        coverImage={book.coverImage}
                        className="h-16 w-14 rounded-[18px] border border-(--cf-border) bg-(--cf-surface)"
                        fallbackClassName="text-2xl"
                        sizes="56px"
                        interactive={false}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-(--cf-border) bg-(--cf-surface) px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cf-text-3)">
                            {index === 0 ? "First up" : "Starter shelf"}
                          </span>
                        </div>
                        <h4 className="mt-2 truncate text-base font-semibold text-(--cf-text-1)">
                          {book.title}
                        </h4>
                        <p className="truncate text-sm text-(--cf-text-2)">{book.author}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </OnboardingShell>
  );
}
