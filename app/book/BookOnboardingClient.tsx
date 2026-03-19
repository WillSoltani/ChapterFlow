"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeHelp,
  BookOpen,
  Brain,
  Briefcase,
  Check,
  Clock3,
  Compass,
  FileText,
  Flame,
  GraduationCap,
  Lightbulb,
  Mail,
  MapPin,
  MessageSquare,
  RefreshCw,
  Rocket,
  Scale,
  ShieldCheck,
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
  type BookOnboardingState,
  type LearningStyle,
  type MotivationStyle,
  type OccupationOption,
  type PronounOption,
  type QuizIntensity,
  type ReadingGoalOption,
  type ReferralSourceOption,
  useOnboardingState,
} from "@/app/book/hooks/useOnboardingState";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";

const TOTAL_STEPS = 7;
const MAX_BOOKS = 3;
const MAX_CATEGORIES = 3;
const STEP_LABELS = [
  "Tour",
  "Start",
  "Goals",
  "Interests",
  "Books",
  "Pace",
  "Preferences",
];

type InterestCategoryDef = {
  key: string;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
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
  icon: ComponentType<{ className?: string }>;
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
    description: "Read for the joy of learning without a fixed agenda",
    icon: Compass,
  },
];

const stepContent = [
  {
    title: "See how ChapterFlow teaches a chapter",
    subtitle:
      "A warm walkthrough of the product before we set up your first shelf.",
  },
  {
    title: "Make it feel like yours",
    subtitle:
      "Your account details are already connected. Add optional personalization only if it helps.",
  },
  {
    title: "Tell us what you want from reading",
    subtitle:
      "We use this to shape recommendations and the feel of your early sessions.",
  },
  {
    title: "Choose three topics",
    subtitle:
      "These interests guide the first books we put in front of you.",
  },
  {
    title: "Pick your first three books",
    subtitle:
      "Start with titles that fit your goals now. You can expand later.",
  },
  {
    title: "Set a reading pace you can keep",
    subtitle:
      "A realistic daily rhythm makes the whole product feel easier to use.",
  },
  {
    title: "Tune the learning experience",
    subtitle:
      "Finish with a few preferences so summaries, quizzes, and reminders feel right.",
  },
];

const PRIMARY_ACTION_LABELS = [
  "Build my setup",
  "Continue",
  "Continue",
  "See matching books",
  "Set my reading pace",
  "Tune preferences",
  "Launch ChapterFlow",
];

const readingGoalLabelMap: Record<ReadingGoalOption, string> = {
  career: "Career Growth",
  decisions: "Better Decisions",
  skills: "Learn New Skills",
  personal: "Personal Growth",
  curiosity: "Pure Curiosity",
};

const learningStyleLabelMap: Record<LearningStyle, string> = {
  concise: "Concise",
  balanced: "Balanced",
  deep: "Deep",
};

const quizIntensityLabelMap: Record<QuizIntensity, string> = {
  easy: "Easy",
  standard: "Standard",
  challenging: "Challenging",
};

const motivationStyleLabelMap: Record<MotivationStyle, string> = {
  gentle: "Gentle",
  direct: "Direct",
  competitive: "Competitive",
};

type TourStageId = "summary" | "examples" | "quiz" | "rewards";

type TourStage = {
  id: TourStageId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  stat: string;
  Icon: ComponentType<{ className?: string }>;
  highlights: string[];
  evidence?: string;
};

const TOUR_STAGES: TourStage[] = [
  {
    id: "summary",
    label: "Layered summary",
    eyebrow: "Start with the main point",
    title: "Read a chapter in the depth you want",
    description:
      "Every chapter opens with a layered summary so you can get clear quickly, then go deeper only when you want more detail.",
    stat: "3 depth modes",
    Icon: FileText,
    highlights: [
      "Move through short paragraphs, key bullets, and optional detail without losing the thread.",
      "Switch between concise, balanced, or deeper reading styles when you want more or less context.",
      "The structure is built to make the chapter easier to remember before you reach examples or quiz questions.",
    ],
  },
  {
    id: "examples",
    label: "Real-life examples",
    eyebrow: "Connect the lesson to your world",
    title: "Every chapter includes 6 practical scenarios",
    description:
      "You get 2 school scenarios, 2 work scenarios, and 2 personal-life scenarios so the idea feels easier to relate to right away.",
    stat: "2 school · 2 work · 2 personal",
    Icon: Lightbulb,
    highlights: [
      "Examples make abstract points feel more usable in the kinds of situations you actually face.",
      "You can filter by school, work, or personal context whenever you want the most relevant angle first.",
      "The tone stays practical and human so the chapter feels like guidance, not just explanation.",
    ],
  },
  {
    id: "quiz",
    label: "Scenario-based quiz",
    eyebrow: "Prove you understood the chapter",
    title: "Quizzes are built around real decisions, not memorized phrases",
    description:
      "Each chapter includes 10 quiz questions, and most are scenario based. They check whether you really understood the main point and can use it in a realistic situation.",
    stat: "10 questions per chapter",
    Icon: BadgeHelp,
    highlights: [
      "Most questions ask you to apply the chapter idea in a realistic context instead of simply recognizing a line from the summary.",
      "The quiz helps you prove you understood the chapter's main point before you unlock the next chapter.",
      "Explanations and retries make it easier to connect the lesson to your own life and carry it forward.",
    ],
    evidence:
      "Practice testing, often called retrieval practice, is widely regarded as a high-utility learning strategy in learning science.",
  },
  {
    id: "rewards",
    label: "Rewards that matter",
    eyebrow: "Progress should feel visible and useful",
    title: "Badges track momentum. Flow Points unlock more of the product.",
    description:
      "You earn badges as you progress, and Flow Points through participation features like scenario contributions. Together they make progress feel visible and useful.",
    stat: "Premium unlocks included",
    Icon: Trophy,
    highlights: [
      "Badges keep progress visible in a way that feels polished and motivating, not noisy.",
      "Flow Points can unlock more books for free, a free monthly pass, and other premium features as the system expands.",
      "The reward layer is meant to reinforce useful progress, not turn learning into cheap gamification.",
    ],
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
        "rounded-2xl border px-3.5 py-2.5 text-sm font-medium shadow-sm transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text) shadow-[0_10px_24px_var(--cf-accent-muted)]"
          : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

type GoalCardProps = {
  icon: ComponentType<{ className?: string }>;
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
        "group flex items-start gap-3 rounded-[26px] border p-4 text-left shadow-sm transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-[linear-gradient(180deg,var(--cf-accent-soft),var(--cf-surface))]"
          : "border-(--cf-border) bg-(--cf-surface) hover:-translate-y-0.5 hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200",
          selected
            ? "border-(--cf-accent-border) bg-(--cf-accent) text-white shadow-[0_6px_20px_var(--cf-accent-shadow)]"
            : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)",
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
        <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
          {description}
        </p>
      </div>
    </button>
  );
}

type CategoryCardProps = {
  Icon: ComponentType<{ className?: string }>;
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
        "relative flex flex-col gap-3 rounded-[26px] border p-4 text-left shadow-sm transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        selected
          ? "border-(--cf-accent-border) bg-[linear-gradient(180deg,var(--cf-accent-soft),var(--cf-surface))] shadow-[0_0_0_3px_var(--cf-accent-muted)]"
          : disabled
            ? "cursor-not-allowed border-(--cf-border) bg-(--cf-surface-muted) opacity-35"
            : "border-(--cf-border) bg-(--cf-surface) hover:-translate-y-0.5 hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-200",
          selected
            ? "border-(--cf-accent-border) bg-(--cf-accent) text-white shadow-[0_6px_18px_var(--cf-accent-shadow)]"
            : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)",
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
        <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
          {description}
        </p>
      </div>

      {selected ? (
        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-(--cf-accent)">
          <Check className="h-3 w-3 text-white" />
        </span>
      ) : null}
    </button>
  );
}

type SupportPanelTone = "neutral" | "accent" | "warm";

function SupportPanel({
  eyebrow,
  title,
  description,
  icon,
  tone = "neutral",
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: SupportPanelTone;
  children?: ReactNode;
}) {
  const toneClasses =
    tone === "accent"
      ? "border-(--cf-accent-border) bg-[linear-gradient(180deg,var(--cf-accent-soft),var(--cf-surface))]"
      : tone === "warm"
        ? "border-(--cf-warning-border) bg-[linear-gradient(180deg,var(--cf-warning-soft),var(--cf-surface))]"
        : "border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))]";

  const iconClasses =
    tone === "accent"
      ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
      : tone === "warm"
        ? "border-(--cf-warning-border) bg-(--cf-warning-soft) text-(--cf-warning-text)"
        : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)";

  return (
    <section className={["rounded-[30px] border p-5 shadow-sm", toneClasses].join(" ")}>
      <div className="flex items-start gap-3">
        <span
          className={[
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            iconClasses,
          ].join(" ")}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-(--cf-text-1)">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-(--cf-text-2)">
            {description}
          </p>
        </div>
      </div>

      {children ? <div>{children}</div> : null}
    </section>
  );
}

function MetricCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-(--cf-text-1)">
            {value}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function JourneyRow({
  stepNumber,
  title,
  description,
}: {
  stepNumber: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-(--cf-border) bg-(--cf-surface) p-3.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) text-xs font-semibold text-(--cf-info-text)">
        {stepNumber}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-(--cf-text-1)">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
          {description}
        </p>
      </div>
    </div>
  );
}

function InfoListRow({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-(--cf-accent)" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-(--cf-text-1)">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
          {description}
        </p>
      </div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-(--cf-divider) pt-3 first:border-t-0 first:pt-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
        {label}
      </span>
      <span className="text-right text-sm font-medium text-(--cf-text-1)">{value}</span>
    </div>
  );
}

function TourStageButton({
  stage,
  active,
  onSelect,
}: {
  stage: TourStage;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={[
        "rounded-[24px] border p-4 text-left shadow-sm transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        active
          ? "border-(--cf-accent-border) bg-[linear-gradient(180deg,var(--cf-accent-soft),var(--cf-surface))] shadow-[0_12px_28px_var(--cf-accent-muted)]"
          : "border-(--cf-border) bg-(--cf-surface) hover:-translate-y-0.5 hover:border-(--cf-border-strong) hover:bg-(--cf-surface-muted)",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200",
            active
              ? "border-(--cf-accent-border) bg-(--cf-accent) text-white"
              : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)",
          ].join(" ")}
        >
          <stage.Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p
            className={[
              "text-sm font-semibold",
              active ? "text-(--cf-info-text)" : "text-(--cf-text-1)",
            ].join(" ")}
          >
            {stage.label}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-(--cf-text-3)">
            {stage.stat}
          </p>
        </div>
      </div>
    </button>
  );
}

function TourPreview({ stageId }: { stageId: TourStageId }) {
  if (stageId === "summary") {
    return (
      <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
          Chapter Preview
        </p>
        <div className="mt-4 rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                Chapter 4
              </p>
              <h3 className="mt-1 text-lg font-semibold text-(--cf-text-1)">
                Protect the work that creates the most value
              </h3>
            </div>
            <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-semibold text-(--cf-info-text)">
              Balanced
            </span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-(--cf-text-2)">
            Deep work matters because concentrated time is what turns knowledge into
            useful output instead of scattered effort.
          </p>

          <div className="mt-4 space-y-2">
            {[
              "Short summary paragraphs keep the chapter readable and calm.",
              "Key bullets make the main structure easy to scan.",
              "Optional detail expands only when you want more depth.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-2xl border border-(--cf-border) bg-(--cf-surface) px-3 py-2.5"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-(--cf-accent)" />
                <p className="text-sm text-(--cf-text-2)">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stageId === "examples") {
    return (
      <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
          Scenario Preview
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "School",
              detail: "2 scenarios",
              description: "Classes, study systems, group work, and campus decisions.",
              Icon: GraduationCap,
            },
            {
              title: "Work",
              detail: "2 scenarios",
              description: "Projects, teams, meetings, priorities, and career tradeoffs.",
              Icon: Briefcase,
            },
            {
              title: "Personal",
              detail: "2 scenarios",
              description: "Habits, relationships, time, money, and day-to-day choices.",
              Icon: Users,
            },
          ].map(({ title, detail, description, Icon }) => (
            <div
              key={title}
              className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) p-4"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-(--cf-text-1)">{title}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--cf-accent)">
                {detail}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-(--cf-text-3)">
                {description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-(--cf-text-2)">
          The goal is to help the chapter idea feel instantly relatable, not abstract.
        </p>
      </div>
    );
  }

  if (stageId === "quiz") {
    return (
      <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
          Quiz Preview
        </p>
        <div className="mt-4 rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-(--cf-text-1)">Scenario question</p>
            <span className="rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1 text-xs font-semibold text-(--cf-text-3)">
              4 of 10
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">
            Your team keeps polishing tiny onboarding details, but repeat usage is
            still weak. What should you test first?
          </p>

          <div className="mt-4 space-y-2">
            {[
              "Spend another sprint refining the visuals so the flow looks more finished.",
              "Test whether the product solves a high-urgency problem before debating surface polish.",
              "Add more features so first-time users see more value immediately.",
              "Wait for more user feedback before making any product decision.",
            ].map((option, index) => {
              const selected = index === 1;
              return (
                <div
                  key={option}
                  className={[
                    "flex items-start gap-3 rounded-2xl border px-3.5 py-3",
                    selected
                      ? "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)"
                      : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      selected
                        ? "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)"
                        : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3)",
                    ].join(" ")}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-sm leading-relaxed">{option}</span>
                  {selected ? (
                    <Check className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-(--cf-success-text)" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-(--cf-success-border) bg-(--cf-success-soft) px-4 py-3 text-sm text-(--cf-success-text)">
            Correct. The question checks whether you can apply the chapter&apos;s
            main point, not just recognize a sentence from the summary.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
        Rewards Preview
      </p>

      <div className="mt-4 rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-(--cf-text-1)">Flow Points</p>
            <p className="mt-1 text-sm text-(--cf-text-3)">
              Useful progress with real unlock value
            </p>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-(--cf-text-1)">
            425
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-(--cf-border)">
          <div
            className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
            style={{ width: "71%" }}
          />
        </div>

        <div className="mt-4 space-y-2">
          {[
            { title: "Unlock a free book", status: "600 pts" },
            { title: "Free monthly pass", status: "1,000 pts" },
            { title: "Future premium perks", status: "Coming next" },
          ].map((item, index) => (
            <div
              key={item.title}
              className="flex items-center justify-between rounded-2xl border border-(--cf-border) bg-(--cf-surface) px-3.5 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-(--cf-text-1)">{item.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-(--cf-text-3)">
                  {index === 2 ? "Roadmap" : "Unlock milestone"}
                </p>
              </div>
              <span className="text-sm font-semibold text-(--cf-accent)">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
        <p className="text-sm font-semibold text-(--cf-text-1)">
          Badges keep the journey visible
        </p>
        <p className="mt-1 text-sm leading-relaxed text-(--cf-text-2)">
          Badges mark what you have completed and how consistently you are using the
          system, while Flow Points handle the premium unlock side through
          participation features like scenario submissions.
        </p>
      </div>
    </div>
  );
}

function SetupSummaryPanel({
  state,
  viewerName,
  selectedBooks,
}: {
  state: BookOnboardingState;
  viewerName: string;
  selectedBooks: Array<(typeof BOOKS_CATALOG)[number]>;
}) {
  return (
    <SupportPanel
      tone="accent"
      eyebrow="Your Setup"
      title="This is what your first experience will feel like"
      description="A quick preview before you launch into the app."
      icon={<Sparkles className="h-5 w-5" />}
    >
      <div className="mt-4 space-y-3">
        <SummaryLine label="Reader" value={viewerName} />
        <SummaryLine
          label="Goal"
          value={
            state.readingGoal ? readingGoalLabelMap[state.readingGoal] : "Still flexible"
          }
        />
        <SummaryLine
          label="Books"
          value={
            selectedBooks.length > 0
              ? `${selectedBooks.length} selected`
              : "Choose your first titles"
          }
        />
        <SummaryLine
          label="Pace"
          value={`${formatMinutesLabel(state.dailyGoalMinutes)} / day`}
        />
        <SummaryLine
          label="Summary style"
          value={learningStyleLabelMap[state.learningStyle]}
        />
        <SummaryLine
          label="Quiz style"
          value={quizIntensityLabelMap[state.quizIntensity]}
        />
      </div>
    </SupportPanel>
  );
}

export function BookOnboardingClient() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const {
    state,
    hydrated,
    goNextStep,
    goPreviousStep,
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
  const {
    identity: viewerIdentity,
    inferredLocation,
    locationLabel,
    loading: viewerLoading,
  } = useBookViewer();

  const [activeTourStage, setActiveTourStage] = useState<TourStageId>("summary");
  const [bookPage, setBookPage] = useState(0);
  const [booksPerPage, setBooksPerPage] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (state.setupComplete) router.replace("/book/workspace");
  }, [hydrated, router, state.setupComplete]);

  useEffect(() => {
    if (!hydrated) return;
    if (state.setupComplete) return;
    fetch("/app/api/book/me/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.profile?.onboardingCompleted === true) {
          completeSetup();
          router.replace("/book/workspace");
        }
      })
      .catch(() => {});
  }, [hydrated, state.setupComplete, completeSetup, router]);

  const step = state.currentStep;

  useEffect(() => {
    if (!hydrated) return;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [hydrated, step, prefersReducedMotion]);

  const selectedCount = state.selectedBookIds.length;
  const selectedBooksSet = useMemo(
    () => new Set(state.selectedBookIds),
    [state.selectedBookIds]
  );
  const selectedCategoriesSet = useMemo(
    () => new Set(state.selectedCategories),
    [state.selectedCategories]
  );
  const selectedCategoryDefs = useMemo(
    () =>
      state.selectedCategories
        .map((key) => INTEREST_CATEGORIES.find((category) => category.key === key))
        .filter((category): category is InterestCategoryDef => Boolean(category)),
    [state.selectedCategories]
  );
  const selectedBooks = useMemo(
    () =>
      state.selectedBookIds
        .map((bookId) => BOOKS_CATALOG.find((book) => book.id === bookId))
        .filter((book): book is (typeof BOOKS_CATALOG)[number] => Boolean(book)),
    [state.selectedBookIds]
  );

  const bookLimitReached = selectedCount >= MAX_BOOKS;
  const categoryLimitReached = state.selectedCategories.length >= MAX_CATEGORIES;
  const viewerName = viewerIdentity.displayName || "Reader";
  const welcomeName = viewerIdentity.givenName || viewerName;

  const categoriesSignatureRef = useRef<string>("");
  useEffect(() => {
    const signature = [...state.selectedCategories].sort().join(",");
    if (categoriesSignatureRef.current && signature !== categoriesSignatureRef.current) {
      clearBookSelections();
    }
    categoriesSignatureRef.current = signature;
  }, [state.selectedCategories, clearBookSelections]);

  const expandedCategoryMaps = useMemo(() => {
    const expanded = new Set<string>();
    state.selectedCategories.forEach((key) => {
      const category = INTEREST_CATEGORIES.find((item) => item.key === key);
      category?.maps.forEach((mapKey) => expanded.add(mapKey));
    });
    return expanded;
  }, [state.selectedCategories]);

  const filteredBooks = useMemo(() => {
    if (expandedCategoryMaps.size === 0) return BOOKS_CATALOG;
    return BOOKS_CATALOG.filter((book) =>
      book.categories.some((category) => expandedCategoryMaps.has(category))
    );
  }, [expandedCategoryMaps]);

  const totalBookPages = Math.max(1, Math.ceil(filteredBooks.length / booksPerPage));
  const paginatedBooks = useMemo(
    () => filteredBooks.slice(bookPage * booksPerPage, (bookPage + 1) * booksPerPage),
    [filteredBooks, bookPage, booksPerPage]
  );

  useEffect(() => {
    if (step === 4) setBookPage(0);
  }, [step]);

  useEffect(() => {
    setBookPage((current) => Math.min(current, Math.max(0, totalBookPages - 1)));
  }, [totalBookPages]);

  const canContinue = (() => {
    if (step === 3) return state.selectedCategories.length === MAX_CATEGORIES;
    if (step === 4) return selectedCount === MAX_BOOKS;
    return true;
  })();

  const actionHint = (() => {
    if (step === 0) return "Takes about two minutes. You can change everything later.";
    if (step === 1) {
      return viewerLoading
        ? "Connecting your account details..."
        : "We already filled the basics from your secure sign-in. Everything here is optional.";
    }
    if (step === 3) return `Pick exactly ${MAX_CATEGORIES} categories to continue.`;
    if (step === 4) return `Choose exactly ${MAX_BOOKS} books to build your starter shelf.`;
    return null;
  })();

  const handleContinue = async () => {
    if (!canContinue || isSaving) return;

    if (step === TOTAL_STEPS - 1) {
      try {
        setIsSaving(true);
        await fetch("/app/api/book/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: {
              onboardingCompleted: true,
              pronouns:
                state.pronoun !== "Prefer not to say" ? state.pronoun : undefined,
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
      } finally {
        setIsSaving(false);
      }
      return;
    }

    goNextStep();
  };

  const title = stepContent[step]?.title ?? "";
  const subtitle = stepContent[step]?.subtitle ?? "";
  const primaryActionLabel = isSaving ? "Saving..." : PRIMARY_ACTION_LABELS[step] ?? "Continue";
  const activeStage = TOUR_STAGES.find((stageItem) => stageItem.id === activeTourStage) ?? TOUR_STAGES[0];

  const actions =
    step === 0 ? (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
        {actionHint ? (
          <p className="text-center text-sm text-(--cf-text-3)">{actionHint}</p>
        ) : null}
        <button
          type="button"
          onClick={handleContinue}
          className="cf-btn cf-btn-primary w-full rounded-2xl px-5 py-3.5 text-lg"
        >
          {primaryActionLabel}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    ) : (
      <div className="space-y-3">
        {actionHint ? (
          <p className="text-center text-sm text-(--cf-text-3)">{actionHint}</p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={goPreviousStep}
            disabled={isSaving}
            className="cf-btn cf-btn-secondary rounded-2xl px-4 py-3 text-base sm:w-44"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue || isSaving}
            className={[
              "cf-btn flex-1 rounded-2xl px-4 py-3 text-base",
              step === TOTAL_STEPS - 1
                ? "border border-(--cf-warning-border) bg-linear-to-r from-amber-300 to-amber-200 text-slate-900 shadow-[0_16px_36px_rgba(245,158,11,0.22)] hover:brightness-105"
                : "cf-btn-primary",
            ].join(" ")}
          >
            {primaryActionLabel}
            {step === TOTAL_STEPS - 1 ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    );

  return (
    <OnboardingShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={title}
      subtitle={subtitle}
      actions={actions}
      stepLabels={STEP_LABELS}
    >
      {!hydrated ? (
        <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface-muted) p-8 text-center text-(--cf-text-2)">
          Loading your onboarding setup...
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: "easeOut" }}
          >
            {step === 0 ? (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(320px,0.78fr)]">
                  <section className="cf-panel relative overflow-hidden rounded-[34px] p-5 sm:p-8">
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_right,var(--cf-accent-muted),transparent_58%)]"
                      aria-hidden="true"
                    />

                    <div className="relative">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-info-text)">
                          Premium Tour
                        </span>
                        <p className="text-sm text-(--cf-text-3)">
                          Click through the chapter flow to preview how the product
                          teaches.
                        </p>
                      </div>

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {TOUR_STAGES.map((stageItem) => (
                          <TourStageButton
                            key={stageItem.id}
                            stage={stageItem}
                            active={activeTourStage === stageItem.id}
                            onSelect={() => setActiveTourStage(stageItem.id)}
                          />
                        ))}
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeTourStage}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : 0.22,
                            ease: "easeOut",
                          }}
                          className="mt-6 grid gap-6 rounded-[30px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] p-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(280px,0.98fr)]"
                        >
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
                              {activeStage.eyebrow}
                            </p>

                            <div className="mt-3 flex items-start gap-3">
                              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)">
                                <activeStage.Icon className="h-5 w-5" />
                              </span>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-2xl font-semibold tracking-tight text-(--cf-text-1)">
                                    {activeStage.title}
                                  </h2>
                                  <span className="rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1 text-xs font-semibold text-(--cf-info-text)">
                                    {activeStage.stat}
                                  </span>
                                </div>
                                <p className="mt-2 text-base leading-relaxed text-(--cf-text-2)">
                                  {activeStage.description}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 space-y-3">
                              {activeStage.highlights.map((highlight) => (
                                <div
                                  key={highlight}
                                  className="flex items-start gap-3 rounded-[22px] border border-(--cf-border) bg-(--cf-surface) px-4 py-3"
                                >
                                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                  <p className="text-sm leading-relaxed text-(--cf-text-2)">
                                    {highlight}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {activeStage.evidence ? (
                              <div className="mt-5 rounded-[22px] border border-(--cf-info-border) bg-(--cf-info-soft) px-4 py-3 text-sm leading-relaxed text-(--cf-info-text)">
                                {activeStage.evidence}
                              </div>
                            ) : null}
                          </div>

                          <TourPreview stageId={activeTourStage} />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </section>

                  <div className="space-y-4">
                    <SupportPanel
                      tone="accent"
                      eyebrow="Why ChapterFlow feels different"
                      title="The product is built around understanding, application, and follow-through."
                      description="You are not just skimming summaries. You are moving through a calm, repeatable learning loop."
                      icon={<Compass className="h-5 w-5" />}
                    >
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <MetricCard
                          icon={<FileText className="h-4 w-4" />}
                          value="3 depth modes"
                          label="Choose concise, balanced, or deeper summaries whenever you want."
                        />
                        <MetricCard
                          icon={<Lightbulb className="h-4 w-4" />}
                          value="6 scenarios"
                          label="Every chapter includes 2 school, 2 work, and 2 personal examples."
                        />
                        <MetricCard
                          icon={<BadgeHelp className="h-4 w-4" />}
                          value="10 questions"
                          label="Mostly scenario-based quizzes make you use the lesson before you move on."
                        />
                        <MetricCard
                          icon={<Trophy className="h-4 w-4" />}
                          value="80% to unlock"
                          label="Pass the chapter quiz, keep badges visible, and build meaningful momentum."
                        />
                      </div>
                    </SupportPanel>

                    <SupportPanel
                      tone="warm"
                      eyebrow="Your chapter journey"
                      title="One steady flow, repeated chapter by chapter."
                      description="The structure stays familiar, so understanding gets easier and progress feels premium instead of noisy."
                      icon={<BookOpen className="h-5 w-5" />}
                    >
                      <div className="mt-4 space-y-3">
                        <JourneyRow
                          stepNumber="01"
                          title="Read the main point"
                          description="Start with a layered summary that gets to the idea quickly."
                        />
                        <JourneyRow
                          stepNumber="02"
                          title="See it in real life"
                          description="Switch between school, work, and personal examples when you want context."
                        />
                        <JourneyRow
                          stepNumber="03"
                          title="Prove you got it"
                          description="Use scenario-led quiz questions to show you understood the chapter."
                        />
                        <JourneyRow
                          stepNumber="04"
                          title="Keep momentum visible"
                          description="Badges show progress while Flow Points unlock more of the product."
                        />
                      </div>
                    </SupportPanel>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[34px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm sm:p-7">
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
                      Smart Start
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-(--cf-text-2)">
                      Name and email already come from your secure account, so setup stays
                      short and thoughtful.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface)">
                            <ShieldCheck className="h-4 w-4 text-(--cf-accent)" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                              Account name
                            </p>
                            {viewerLoading ? (
                              <div className="mt-3 h-5 w-32 animate-pulse rounded-full bg-(--cf-border)" />
                            ) : (
                              <p className="mt-2 text-lg font-semibold text-(--cf-text-1)">
                                {viewerName}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-(--cf-text-3)">
                              Pulled from your authenticated account so you do not have to type it again.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface)">
                            <Mail className="h-4 w-4 text-(--cf-accent)" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                              Account email
                            </p>
                            {viewerLoading ? (
                              <div className="mt-3 h-5 w-40 animate-pulse rounded-full bg-(--cf-border)" />
                            ) : (
                              <p className="mt-2 truncate text-lg font-semibold text-(--cf-text-1)">
                                {viewerIdentity.email || "Signed in"}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-(--cf-text-3)">
                              Managed by sign-in, not by onboarding.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface)">
                          <MapPin className="h-4 w-4 text-(--cf-accent)" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                            Rough location
                          </p>
                          <p className="mt-2 text-base font-semibold text-(--cf-text-1)">
                            {locationLabel || "We’ll keep location optional."}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
                            {locationLabel
                              ? "When infrastructure headers are available, we infer a rough region on the server instead of asking for your city. It helps with context, but onboarding never depends on it."
                              : "If your connection exposes a reliable region signal, we use that quietly in the background. If not, nothing breaks and we never ask for city manually."}
                          </p>
                          {inferredLocation?.precision === "city" ? (
                            <p className="mt-2 text-xs text-(--cf-text-soft)">
                              Precision stays approximate. We use this for context, not exact tracking.
                            </p>
                          ) : null}
                        </div>
                      </div>
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

                    <div className="rounded-[24px] border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-3.5 text-(--cf-info-text)">
                      <span className="font-semibold">Hi {welcomeName}.</span> Next we&apos;ll tailor the experience around what you want from reading and the books you want to start with.
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <SupportPanel
                    tone="accent"
                    eyebrow="What changed"
                    title="No repeated basics"
                    description="Onboarding uses trusted account data first, then asks only for the optional details that actually shape the product."
                    icon={<Sparkles className="h-5 w-5" />}
                  >
                    <div className="mt-4 space-y-3">
                      <InfoListRow
                        title="Secure account hydration"
                        description="Name and email come from Cognito-backed session data, not a second onboarding form."
                      />
                      <InfoListRow
                        title="Approximate location only"
                        description="We use rough network or infrastructure hints when they are reliable, and we never require exact city input."
                      />
                      <InfoListRow
                        title="Optional personalization"
                        description="Pronouns and role remain optional and can be updated later if they help the app feel more natural."
                      />
                    </div>
                  </SupportPanel>

                  <SupportPanel
                    tone="neutral"
                    eyebrow="Up next"
                    title="Goals, interests, and first books"
                    description="After this, you’ll choose what you want from reading, the topics you care about most, and the books you want to start with."
                    icon={<Compass className="h-5 w-5" />}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[34px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm sm:p-7">
                  <div className="space-y-6">
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

                    <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3.5 text-sm text-(--cf-text-2)">
                      Both fields are optional. Choose whatever helps us tailor the
                      experience, then keep moving.
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <SupportPanel
                    tone="accent"
                    eyebrow="How this helps"
                    title="We shape the early experience around what matters to you"
                    description="Your goal helps guide which books surface first and how the setup frames your first sessions."
                    icon={<Target className="h-5 w-5" />}
                  >
                    <div className="mt-4 space-y-3">
                      <InfoListRow
                        title="Recommendation order"
                        description="We can bring the most relevant books to the front of your starting shelf."
                      />
                      <InfoListRow
                        title="Session framing"
                        description="The app can emphasize clearer outcomes and more useful context from the start."
                      />
                      <InfoListRow
                        title="Lower cognitive load"
                        description="A little context here makes the rest of onboarding easier to understand."
                      />
                    </div>
                  </SupportPanel>

                  <SupportPanel
                    tone="warm"
                    eyebrow="What stays flexible"
                    title="Nothing here locks you in"
                    description="You can change your goals, reading style, quiz difficulty, and reminders later in settings."
                    icon={<RefreshCw className="h-5 w-5" />}
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <div className="rounded-[30px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-(--cf-text-3)">
                          Topic Curation
                        </p>
                        <p className="mt-2 text-base leading-relaxed text-(--cf-text-2)">
                          Pick the three themes you want on your shelf first. We&apos;ll
                          use them to find stronger starting books.
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-3 text-sm font-semibold text-(--cf-info-text)">
                        {state.selectedCategories.length} / {MAX_CATEGORIES} selected
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedCategoryDefs.length > 0 ? (
                        selectedCategoryDefs.map((category) => (
                          <button
                            key={category.key}
                            type="button"
                            onClick={() => toggleCategorySelection(category.key)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-1.5 text-xs font-medium text-(--cf-info-text) transition hover:opacity-80"
                          >
                            <category.Icon className="h-3 w-3" />
                            {category.label}
                            <span className="opacity-60">×</span>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-(--cf-text-3)">
                          Your selected topics will appear here.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

                  {categoryLimitReached ? (
                    <p className="text-center text-sm text-(--cf-text-3)">
                      Tap a selected category if you want to swap it out.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <SupportPanel
                    tone="accent"
                    eyebrow="How curation works"
                    title="Your topic picks shape the starter shelf"
                    description="We use these themes to narrow book discovery and make your opening selection feel more intentional."
                    icon={<Compass className="h-5 w-5" />}
                  >
                    <div className="mt-4 space-y-3">
                      <InfoListRow
                        title="Less noise"
                        description="You see fewer random titles and more books that fit your current interests."
                      />
                      <InfoListRow
                        title="Better first-session fit"
                        description="The first books you choose are more likely to feel relevant enough to keep using."
                      />
                      <InfoListRow
                        title="Easy to change later"
                        description="This is only your starting lens, not a permanent filter."
                      />
                    </div>
                  </SupportPanel>

                  <SupportPanel
                    tone="warm"
                    eyebrow="Next step"
                    title="You’ll choose three actual books"
                    description="Once you lock your topics, we’ll show matching titles so your shelf starts strong."
                    icon={<BookOpen className="h-5 w-5" />}
                  />
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="rounded-[30px] border border-(--cf-border) bg-[linear-gradient(180deg,var(--cf-surface),var(--cf-surface-muted))] p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-3)">
                        Showing matches from
                      </span>
                      {selectedCategoryDefs.map((category) => (
                        <span
                          key={category.key}
                          className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) px-2.5 py-1 text-xs font-medium text-(--cf-info-text)"
                        >
                          <category.Icon className="h-3 w-3" />
                          {category.label}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                          · {filteredBooks.length} titles match
                        </span>
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-(--cf-text-3)">Show</span>
                        {([10, 20, 50] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setBooksPerPage(value);
                              setBookPage(0);
                            }}
                            className={[
                              "rounded-xl border px-2.5 py-1 text-xs font-medium transition",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                              booksPerPage === value
                                ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                                : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong)",
                            ].join(" ")}
                          >
                            {value}
                          </button>
                        ))}
                        <span className="text-xs text-(--cf-text-3)">per page</span>
                      </div>
                    </div>
                  </div>

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

                  {filteredBooks.length === 0 ? (
                    <p className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) p-6 text-center text-sm text-(--cf-text-3)">
                      No books matched these categories. Go back and try a different
                      topic mix.
                    </p>
                  ) : null}

                  {totalBookPages > 1 ? (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={bookPage === 0}
                        onClick={() => setBookPage((current) => current - 1)}
                        className={[
                          "cf-btn cf-btn-secondary rounded-2xl px-3 py-2 text-sm",
                          bookPage === 0 ? "opacity-45" : "",
                        ].join(" ")}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Prev
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalBookPages }, (_, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setBookPage(index)}
                            className={[
                              "h-9 min-w-[2.2rem] rounded-xl border px-2 text-sm font-medium transition",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                              bookPage === index
                                ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-info-text)"
                                : "border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) hover:border-(--cf-border-strong)",
                            ].join(" ")}
                          >
                            {index + 1}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={bookPage === totalBookPages - 1}
                        onClick={() => setBookPage((current) => current + 1)}
                        className={[
                          "cf-btn cf-btn-secondary rounded-2xl px-3 py-2 text-sm",
                          bookPage === totalBookPages - 1 ? "opacity-45" : "",
                        ].join(" ")}
                      >
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <SupportPanel
                    tone="accent"
                    eyebrow="Starter Shelf"
                    title="Choose three books that feel worth opening right now"
                    description="Your first shelf should feel focused, not overwhelming."
                    icon={<BookOpen className="h-5 w-5" />}
                  >
                    <div className="mt-4 space-y-3">
                      {selectedBooks.length > 0 ? (
                        selectedBooks.map((book, index) => (
                          <div
                            key={book.id}
                            className="flex items-start gap-3 rounded-[22px] border border-(--cf-border) bg-(--cf-surface) px-4 py-3"
                          >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--cf-accent-border) bg-(--cf-accent-soft) text-xs font-semibold text-(--cf-info-text)">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-(--cf-text-1)">
                                {book.title}
                              </p>
                              <p className="mt-1 text-sm text-(--cf-text-3)">{book.author}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm leading-relaxed text-(--cf-text-3)">
                          Your selected books will appear here as you build the shelf.
                        </p>
                      )}
                    </div>
                  </SupportPanel>

                  <SupportPanel
                    tone="warm"
                    eyebrow="Rewards"
                    title="Progress stays visible after setup"
                    description="Badges reflect what you finish. Flow Points can help unlock more books for free, a free monthly pass, and future premium features."
                    icon={<Trophy className="h-5 w-5" />}
                  />
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <GoalPicker value={state.dailyGoalMinutes} onChange={setDailyGoalMinutes} />

                  <div className="grid gap-3 md:grid-cols-3">
                    <MetricCard
                      icon={<Clock3 className="h-4 w-4" />}
                      value={formatMinutesLabel(state.dailyGoalMinutes)}
                      label="A realistic daily block beats an ambitious plan you never keep."
                    />
                    <MetricCard
                      icon={<BookOpen className="h-4 w-4" />}
                      value={`${estimateSessions(state.dailyGoalMinutes)} sessions`}
                      label="Approximate time to finish a typical book at this pace."
                    />
                    <MetricCard
                      icon={<RefreshCw className="h-4 w-4" />}
                      value="Flexible"
                      label="You can change your pace whenever your schedule shifts."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <SupportPanel
                    tone="accent"
                    eyebrow="Why pacing matters"
                    title="A calm pace makes the product easier to trust"
                    description="The goal is to make progress feel repeatable, not intense for a week and forgotten after."
                    icon={<Target className="h-5 w-5" />}
                  >
                    <div className="mt-4 space-y-3">
                      <InfoListRow
                        title="Shorter sessions are easier to return to"
                        description="Consistency matters more than picking a number that only works on ideal days."
                      />
                      <InfoListRow
                        title="Your pace shapes the app rhythm"
                        description="We use it for progress framing, reminders, and session planning."
                      />
                      <InfoListRow
                        title="You stay in control"
                        description="This is a starting point, not a commitment you cannot revise."
                      />
                    </div>
                  </SupportPanel>
                </div>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[34px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm sm:p-7">
                  <div className="space-y-6">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-(--cf-text-2)">
                        When should we remind you?
                      </label>
                      <input
                        type="time"
                        value={state.reminderTime}
                        onChange={(event) => setReminderTime(event.target.value)}
                        className="cf-input w-48 rounded-2xl px-3 py-2.5"
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

                    <div className="flex items-center justify-between rounded-[24px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-(--cf-text-1)">Track streaks</p>
                        <p className="mt-1 text-sm leading-relaxed text-(--cf-text-3)">
                          Keep a visible streak for steady daily progress.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={state.streakMode}
                        onClick={() => setStreakMode(!state.streakMode)}
                        className={[
                          "relative inline-flex h-7 w-12 items-center rounded-full transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
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
                </div>

                <div className="space-y-4">
                  <SetupSummaryPanel
                    state={state}
                    viewerName={viewerName}
                    selectedBooks={selectedBooks}
                  />

                  <SupportPanel
                    tone="warm"
                    eyebrow="Rewards"
                    title="Badges for progress, Flow Points for unlocks"
                    description="Badges keep your momentum visible. Flow Points can unlock more books for free, a free monthly pass, and future premium features."
                    icon={<Trophy className="h-5 w-5" />}
                  >
                    <div className="mt-4 space-y-3">
                      <SummaryLine
                        label="Reminder"
                        value={state.reminderTime || "No reminder set"}
                      />
                      <SummaryLine
                        label="Motivation"
                        value={motivationStyleLabelMap[state.motivationStyle]}
                      />
                    </div>
                  </SupportPanel>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      )}
    </OnboardingShell>
  );
}
