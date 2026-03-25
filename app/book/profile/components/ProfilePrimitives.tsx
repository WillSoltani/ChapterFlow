"use client";

import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Lock,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  motion,
  useMotionValue,
  useTransform,
  useInView,
  animate,
} from "framer-motion";
import { Button } from "@/app/book/components/ui/Button";
import { Card } from "@/app/book/components/ui/Card";
import { BookCover } from "@/app/book/components/BookCover";
import { cn } from "@/app/book/components/ui/cn";

/* ═══════════════════════════════════════════════════════
   FadeIn — scroll-triggered stagger wrapper (H2)
   ═══════════════════════════════════════════════════════ */

export function FadeIn({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   AnimatedNumber — scroll-triggered counter (C1)
   ═══════════════════════════════════════════════════════ */

export function AnimatedNumber({
  value,
  duration = 0.8,
  formatFn,
}: {
  value: number;
  duration?: number;
  formatFn?: (v: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) =>
    formatFn ? formatFn(v) : String(Math.round(v))
  );

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, value, { duration, ease: "easeOut" });
    return controls.stop;
  }, [isInView, value, duration, motionVal]);

  useEffect(() => {
    return rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
  }, [rounded]);

  return <span ref={ref}>0</span>;
}

/* ═══════════════════════════════════════════════════════
   StreakFlame — SVG flame with CSS flicker animation (A1)
   ═══════════════════════════════════════════════════════ */

const MILESTONE_STREAKS = new Set([7, 14, 21, 30, 50, 100, 200, 365]);

function StreakFlame({ active, size = 28, streakDays = 0 }: { active: boolean; size?: number; streakDays?: number }) {
  const celebratedRef = useRef(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const isMilestone = MILESTONE_STREAKS.has(streakDays);

  useEffect(() => {
    if (isMilestone && active && !celebratedRef.current) {
      celebratedRef.current = true;
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [isMilestone, active]);

  return (
    <span className="relative inline-flex shrink-0">
      {/* Ambient glow wrapper */}
      <span
        className={cn("inline-flex shrink-0", active && "cf-flame-flicker")}
        style={active ? { filter: "drop-shadow(0 0 12px rgba(249,115,22,0.25)) drop-shadow(0 0 24px rgba(249,115,22,0.1))" } : undefined}
      >
        <svg
          width={size}
          height={Math.round(size * 32 / 28)}
          viewBox="0 0 28 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M14 1C14 1 5 10.5 5 17C5 22.52 9.03 27 14 27C18.97 27 23 22.52 23 17C23 10.5 14 1 14 1Z"
            fill={active ? "url(#flameGradV2)" : "var(--cf-text-soft)"}
            opacity={active ? 1 : 0.6}
          />
          <path
            d="M14 27C11.79 27 10 24.88 10 22.1C10 19.32 14 14 14 14C14 14 18 19.32 18 22.1C18 24.88 16.21 27 14 27Z"
            fill={active ? "#fde68a" : "var(--cf-text-soft)"}
            opacity={active ? 0.9 : 0.3}
          />
          <defs>
            <linearGradient id="flameGradV2" x1="14" y1="1" x2="14" y2="27" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#f97316" />
            </linearGradient>
          </defs>
        </svg>
      </span>

      {/* Milestone celebration particles */}
      {showCelebration ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {Array.from({ length: 7 }).map((_, i) => {
            const angle = (i / 7) * 360 + Math.random() * 30;
            const dist = 30 + Math.random() * 25;
            const rad = (angle * Math.PI) / 180;
            const colors = ["#f59e0b", "#fb923c", "#fbbf24", "#fde68a"];
            return (
              <motion.span
                key={i}
                className="absolute h-1 w-1 rounded-full"
                style={{ backgroundColor: colors[i % colors.length] }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(rad) * dist,
                  y: Math.sin(rad) * dist,
                  opacity: 0,
                  scale: 0.5,
                }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            );
          })}
        </span>
      ) : null}

      <style>{`
        @keyframes cf-flame-flicker {
          0%, 100% { transform: translateY(0) scaleY(1); filter: brightness(1); }
          25% { transform: translateY(-1px) scaleY(1.04); filter: brightness(1.08); }
          50% { transform: translateY(0.5px) scaleY(0.97); filter: brightness(0.95); }
          75% { transform: translateY(-0.5px) scaleY(1.02); filter: brightness(1.05); }
        }
        .cf-flame-flicker {
          animation: cf-flame-flicker 2.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cf-flame-flicker { animation: none; }
        }
      `}</style>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   SectionCard (unchanged)
   ═══════════════════════════════════════════════════════ */

type SectionCardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  eyebrow,
  icon,
  right,
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <Card className={cn("overflow-hidden p-0", className)} {...props}>
      <div className="border-b border-(--cf-divider) bg-(--cf-surface-muted) px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon ? (
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2)">
                {icon}
              </div>
            ) : null}
            <div>
              {eyebrow ? (
                <p className="text-[11px] uppercase tracking-[0.26em] text-(--cf-text-soft)">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-(--cf-text-1)">
                {title}
              </h2>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-(--cf-text-2)">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
   StatCard — with scroll-triggered animation + conditional
   gradient tints (C1 + C2)
   ═══════════════════════════════════════════════════════ */

export function StatCard({
  icon,
  label,
  value,
  helper,
  trend,
  animate: shouldAnimate,
  numericValue,
  formatFn,
  performanceLevel,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper?: string;
  trend?: ReactNode;
  animate?: boolean;
  numericValue?: number;
  formatFn?: (v: number) => string;
  performanceLevel?: "strong" | "active" | "zero";
}) {
  const bgTint = performanceLevel === "strong"
    ? "bg-linear-to-br from-amber-500/[0.03] to-transparent"
    : performanceLevel === "zero"
      ? "bg-linear-to-br from-blue-500/[0.02] to-transparent"
      : "";

  return (
    <div className={cn("rounded-[26px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-sm", bgTint)}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">
          {icon}
        </span>
        {trend ? <span className="text-xs text-(--cf-text-3)">{trend}</span> : null}
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-3)">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-(--cf-text-1)">
        {shouldAnimate && numericValue != null ? (
          <AnimatedNumber value={numericValue} formatFn={formatFn} />
        ) : (
          value
        )}
      </p>
      {helper ? <p className="mt-2 text-sm text-(--cf-text-3)">{helper}</p> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Identity label progression data (A3)
   ═══════════════════════════════════════════════════════ */

const IDENTITY_LEVELS = [
  { label: "Getting Started", books: 0 },
  { label: "Curious Reader", books: 1 },
  { label: "Knowledge Seeker", books: 3 },
  { label: "Dedicated Learner", books: 6 },
  { label: "Knowledge Builder", books: 11 },
  { label: "Polymath", books: 21 },
];

function IdentityTooltip({
  currentLabel,
  booksCompleted,
}: {
  currentLabel: string;
  booksCompleted: number;
}) {
  const [open, setOpen] = useState(false);
  const currentIdx = IDENTITY_LEVELS.findIndex((l) => l.label === currentLabel);
  const nextLevel = IDENTITY_LEVELS[currentIdx + 1];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-(--cf-text-2) transition hover:bg-(--cf-surface)"
        aria-expanded={open}
      >
        <Sparkles className="h-3 w-3" />
        {currentLabel}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-(--cf-border) bg-(--cf-surface-strong) p-4 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--cf-text-soft)">Reading level progression</p>
          {nextLevel ? (
            <p className="mt-2 text-sm text-(--cf-text-2)">
              Next: <span className="font-semibold text-(--cf-text-1)">{nextLevel.label}</span> — Complete {nextLevel.books} books
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-300">You've reached the highest level!</p>
          )}
          {nextLevel ? (
            <div className="mt-2 text-xs text-(--cf-text-3)">
              {booksCompleted}/{nextLevel.books} books to next level
            </div>
          ) : null}
          <div className="mt-3 space-y-1.5">
            {IDENTITY_LEVELS.map((level, i) => {
              const isActive = level.label === currentLabel;
              const isPast = i < currentIdx;
              return (
                <div key={level.label} className="flex items-center gap-2 text-xs">
                  <span className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px]",
                    isActive ? "bg-(--cf-accent) text-white" : isPast ? "bg-(--cf-success-soft) text-(--cf-success-text)" : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
                  )}>
                    {isPast ? <Check className="h-2.5 w-2.5" /> : isActive ? "→" : ""}
                  </span>
                  <span className={cn(isActive ? "font-semibold text-(--cf-text-1)" : isPast ? "text-(--cf-text-2)" : "text-(--cf-text-soft)")}>
                    {level.label}
                  </span>
                  {level.books > 0 ? (
                    <span className="text-(--cf-text-soft)">({level.books} books)</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Identity Hero Banner (A1-A4 + existing features)
   ═══════════════════════════════════════════════════════ */

export function IdentityHeroBanner({
  avatar,
  initials,
  name,
  username,
  bio,
  plan,
  identityLabel,
  streakDays,
  streakMicrocopy,
  booksCompleted,
  totalHours,
  dailyGoalMinutes,
  minutesReadToday,
  onEdit,
  onSettings,
}: {
  avatar: string | null;
  initials: string;
  name: string;
  username: string;
  bio: string;
  plan: "FREE" | "PRO";
  identityLabel: string;
  streakDays: number;
  streakMicrocopy: string;
  booksCompleted: number;
  totalHours: string;
  dailyGoalMinutes: number;
  minutesReadToday: number;
  onEdit: () => void;
  onSettings: () => void;
}) {
  const isPro = plan === "PRO";
  const hasStreak = streakDays > 0;
  const goalMet = minutesReadToday >= dailyGoalMinutes;
  const goalPercent = Math.min(100, Math.round((minutesReadToday / Math.max(dailyGoalMinutes, 1)) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[34px] border border-(--cf-border) bg-(--cf-surface-strong) p-6 shadow-sm sm:p-7 lg:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_left] from-sky-500/22 via-cyan-400/10 to-transparent" />
      <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-(--cf-surface-muted) blur-3xl" />

      {/* A2: Pro animated ring CSS */}
      {isPro ? (
        <style>{`
          @property --ring-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
          @keyframes cf-ring-spin { to { --ring-angle: 360deg; } }
          .cf-pro-ring {
            background: conic-gradient(from var(--ring-angle), #f59e0b, #fbbf24, #f59e0b);
            animation: cf-ring-spin 8s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .cf-pro-ring { animation: none; background: #f59e0b; }
          }
        `}</style>
      ) : null}

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Avatar with A2 tier ring */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "flex items-center justify-center overflow-hidden rounded-full p-[3px] shadow-[0_16px_38px_rgba(2,6,23,0.18)]",
                isPro ? "cf-pro-ring" : "bg-blue-400/50"
              )}
              style={isPro ? undefined : { padding: "2px" }}
            >
              <div className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full bg-(--cf-surface-muted) sm:h-[96px] sm:w-[96px]">
                {avatar ? (
                  <Image src={avatar} alt={name} width={96} height={96} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <span className="text-2xl font-semibold text-(--cf-text-1) sm:text-3xl">{initials}</span>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-3xl">
            {/* Plan badge + identity label (A3) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "inline-flex rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em]",
                isPro ? "border border-amber-400/30 bg-amber-400/10 text-amber-300" : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)"
              )}>
                {isPro ? "PRO" : "FREE"}
              </span>
              <IdentityTooltip currentLabel={identityLabel} booksCompleted={booksCompleted} />
            </div>

            {/* Name + A1 streak flame */}
            <div className="mt-3 flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-(--cf-text-1) sm:text-4xl">{name}</h1>
              <div className={cn(
                "flex items-center gap-1.5 rounded-2xl px-3 py-1.5",
                hasStreak ? "bg-amber-500/10" : "bg-(--cf-surface-muted)"
              )}>
                <StreakFlame active={hasStreak} size={24} streakDays={streakDays} />
                <span className={cn("text-lg font-bold", hasStreak ? "text-amber-400" : "text-(--cf-text-soft)")}>
                  {streakDays}
                </span>
              </div>
            </div>
            <p className="mt-1 text-sm text-(--cf-text-3)">@{username}</p>

            {/* A5 streak microcopy */}
            <p className={cn("mt-2 text-sm", hasStreak ? "text-amber-300/80" : "text-(--cf-text-3)")}>
              {streakMicrocopy}
            </p>

            <p className="mt-3 max-w-2xl text-base leading-7 text-(--cf-text-2)">{bio}</p>

            {/* Hero stat row */}
            <div className="mt-5 flex flex-wrap gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Books completed</p>
                <p className="mt-1 text-2xl font-bold text-(--cf-text-1)">{booksCompleted}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Current streak</p>
                <p className="mt-1 text-2xl font-bold text-(--cf-text-1)">
                  {streakDays} <span className="text-base font-medium text-(--cf-text-3)">days</span>
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Total reading</p>
                <p className="mt-1 text-2xl font-bold text-(--cf-text-1)">{totalHours}</p>
              </div>
            </div>

            {/* A4: Daily goal indicator */}
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm">
                {goalMet ? (
                  <span className="inline-flex items-center gap-1 text-(--cf-success-text)">
                    <Check className="h-3.5 w-3.5" /> Today&apos;s goal complete!
                  </span>
                ) : (
                  <span className="text-(--cf-text-3)">
                    Today&apos;s goal: {dailyGoalMinutes} min &middot; {minutesReadToday}/{dailyGoalMinutes} min
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-[3px] w-48 overflow-hidden rounded-full bg-(--cf-border)">
                <motion.div
                  className={cn("h-full rounded-full", goalMet ? "bg-emerald-500" : "bg-(--cf-accent)")}
                  initial={{ width: 0 }}
                  animate={{ width: `${goalPercent}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 lg:flex-col lg:items-stretch">
          <Button variant="secondary" onClick={onEdit}>Edit profile</Button>
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition hover:bg-(--cf-surface) hover:text-(--cf-text-1)"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   StickyMiniHeader (H1 — already done, kept)
   ═══════════════════════════════════════════════════════ */

export function StickyMiniHeader({
  visible,
  avatar,
  initials,
  name,
  streakDays,
  onSettings,
}: {
  visible: boolean;
  avatar: string | null;
  initials: string;
  name: string;
  streakDays: number;
  onSettings: () => void;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ y: visible ? 0 : -60, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed left-0 right-0 top-[56px] z-20 border-b border-(--cf-border) bg-(--cf-surface-strong)/95"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <div className="mx-auto flex max-w-450 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-10 xl:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-(--cf-border) bg-(--cf-surface-muted)">
            {avatar ? (
              <Image src={avatar} alt={name} width={28} height={28} className="h-full w-full object-cover" unoptimized />
            ) : (
              <span className="text-[10px] font-semibold text-(--cf-text-1)">{initials}</span>
            )}
          </div>
          <span className="text-sm font-semibold text-(--cf-text-1)">{name}</span>
          <span className="inline-flex items-center gap-1 text-sm">
            <StreakFlame active={streakDays > 0} size={16} />
            <span className={cn("font-semibold", streakDays > 0 ? "text-amber-400" : "text-(--cf-text-soft)")}>{streakDays}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onSettings}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   4-Step Learning Loop Indicator (B1)
   ═══════════════════════════════════════════════════════ */

const STEP_LABELS = ["Summary", "Scenarios", "Quiz", "Unlock"] as const;

function LearningLoopSteps({ completedSteps }: { completedSteps: boolean[] }) {
  const currentStep = completedSteps.findIndex((s) => !s);
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const done = completedSteps[i];
        const isCurrent = i === currentStep;
        return (
          <div key={label} className="flex items-center">
            {i > 0 ? (
              <div className={cn("h-[2px] w-5 sm:w-7", done ? "bg-(--cf-accent)" : "bg-(--cf-border)")} />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done
                    ? "border-(--cf-accent) bg-(--cf-accent) text-white"
                    : isCurrent
                      ? "border-(--cf-accent) bg-transparent text-(--cf-accent) animate-pulse"
                      : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                "text-[10px] leading-none",
                done ? "text-(--cf-text-2)" : isCurrent ? "font-medium text-(--cf-text-1)" : "text-(--cf-text-soft)"
              )}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MomentumCard (B1-B3) — full-width, 4-step, chapter time,
   pulsing CTA
   ═══════════════════════════════════════════════════════ */

export function MomentumCard({
  title,
  chapterLabel,
  mode,
  progress,
  bookEta,
  chapterMinutes,
  chapterNumber,
  totalChapters,
  completedSteps,
  dailyGoalMinutes,
  onContinue,
}: {
  title: string;
  chapterLabel: string;
  mode: string;
  progress: number;
  bookEta: string;
  chapterMinutes: number;
  chapterNumber: number;
  totalChapters: number;
  completedSteps: boolean[];
  dailyGoalMinutes: number;
  onContinue: () => void;
}) {
  const chapterEta = chapterMinutes > 0 ? `~${chapterMinutes} min for this chapter` : "";
  const fitsGoal = chapterMinutes > 0 && chapterMinutes <= dailyGoalMinutes + 5;

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-(--cf-accent-border) bg-linear-to-br from-(--cf-accent-soft) to-(--cf-surface-strong) p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-(--cf-accent)/8 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-(--cf-accent-border) bg-(--cf-surface) px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-(--cf-info-text)">Currently reading</span>
          <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-2)">{mode}</span>
        </div>
        <h3 className="mt-4 text-2xl font-bold tracking-tight text-(--cf-text-1) sm:text-3xl">{title}</h3>
        <p className="mt-2 text-sm text-(--cf-text-2)">{chapterLabel}</p>

        {/* B1: 4-step learning loop */}
        <div className="mt-5">
          <LearningLoopSteps completedSteps={completedSteps} />
        </div>

        {/* B2: Chapter-level time + book-level secondary */}
        <div className="mt-4 space-y-1">
          {chapterEta ? (
            <p className="text-sm font-medium text-(--cf-text-1)">
              {chapterEta}
              {fitsGoal ? <span className="ml-1 text-(--cf-text-3)">— fits in your {dailyGoalMinutes} min goal</span> : null}
            </p>
          ) : null}
          <p className="text-xs text-(--cf-text-3)">
            Chapter {chapterNumber} of {totalChapters} &middot; {bookEta} total remaining
          </p>
        </div>

        {/* Book progress bar */}
        <motion.div className="mt-4 h-2 overflow-hidden rounded-full bg-(--cf-border)">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </motion.div>
        <p className="mt-1 text-right text-xs text-(--cf-text-soft)">{Math.round(progress)}% complete</p>

        {/* B3: Pulsing glow CTA */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onContinue}
          className="mt-4 cf-cta-pulse"
        >
          Continue Reading &rarr;
        </Button>
        <style>{`
          @keyframes cf-cta-glow { 0%,100% { box-shadow: 0 0 16px rgba(59,130,246,0.2); } 50% { box-shadow: 0 0 28px rgba(59,130,246,0.4); } }
          .cf-cta-pulse { animation: cf-cta-glow 3s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .cf-cta-pulse { animation: none; } }
        `}</style>
      </div>
    </div>
  );
}

/* ─── Momentum empty state (B5) ─── */

export function MomentumEmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface-strong) p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-3xl">
        📖✨
      </div>
      <h3 className="text-lg font-semibold text-(--cf-text-1)">Your next chapter is waiting</h3>
      <p className="mt-2 text-sm text-(--cf-text-3)">
        Pick a book and start your first learning loop — it takes about 15 minutes.
      </p>
      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button variant="primary" onClick={onBrowse}>Browse Library &rarr;</Button>
        <Button variant="secondary" onClick={onBrowse}>Recommended for you &rarr;</Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ActiveBookCard (unchanged)
   ═══════════════════════════════════════════════════════ */

export function ActiveBookCard({
  title, author, bookId, coverImage, icon, progress, chapterLabel, eta, onContinue,
}: {
  title: string; author: string; bookId: string; coverImage?: string; icon: string;
  progress: number; chapterLabel: string; eta: string; onContinue: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-sm">
      <div className="flex gap-4">
        <BookCover bookId={bookId} title={title} icon={icon} coverImage={coverImage} className="h-24 w-18 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted)" fallbackClassName="text-3xl" sizes="72px" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-(--cf-text-1)">{title}</p>
          <p className="mt-1 text-sm text-(--cf-text-3)">{author}</p>
          <p className="mt-3 text-sm text-(--cf-text-2)">{chapterLabel}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-border)">
            <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-(--cf-text-3)">{progress}% &bull; {eta}</p>
            <Button variant="secondary" size="sm" onClick={onContinue}>Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   AchievementBadgeCard (unchanged)
   ═══════════════════════════════════════════════════════ */

export function AchievementBadgeCard({
  icon, title, description, earned, progressLabel, category, onOpen,
}: {
  icon: string; title: string; description: string; earned: boolean;
  progressLabel?: string; category?: string; onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group rounded-[26px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        earned ? "border-(--cf-warning-border) bg-(--cf-warning-soft)" : "border-(--cf-border) bg-(--cf-surface-muted) hover:border-(--cf-border-strong) hover:bg-(--cf-surface)"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-3xl transition", !earned && "opacity-45 grayscale")}>{icon}</span>
        {!earned ? <Lock className="h-4 w-4 text-(--cf-text-soft)" /> : null}
      </div>
      <p className={cn("mt-4 text-sm font-semibold", earned ? "text-(--cf-warning-text)" : "text-(--cf-text-1)")}>{title}</p>
      <p className="mt-2 text-sm leading-6 text-(--cf-text-3)">{description}</p>
      {category ? <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-(--cf-text-soft)">{category}</p> : null}
      {progressLabel ? <p className="mt-2 text-xs uppercase tracking-[0.18em] text-(--cf-text-soft)">{progressLabel}</p> : null}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   TimelineRow (unchanged)
   ═══════════════════════════════════════════════════════ */

export function TimelineRow({ title, detail, meta }: { title: string; detail: string; meta: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3.5">
      <div className="flex flex-col items-center">
        <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-(--cf-accent)" />
        <span className="mt-2 h-full w-px bg-(--cf-border)" />
      </div>
      <div>
        <p className="text-sm font-medium text-(--cf-text-1)">{title}</p>
        <p className="mt-1 text-sm leading-6 text-(--cf-text-3)">{detail}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-(--cf-text-soft)">{meta}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   NotePreviewCard (unchanged)
   ═══════════════════════════════════════════════════════ */

export function NotePreviewCard({
  title, body, meta, actionLabel, onAction,
}: {
  title: string; body: string; meta: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-sm">
      <p className="text-sm font-semibold text-(--cf-text-1)">{title}</p>
      <p className="mt-3 line-clamp-4 text-sm leading-7 text-(--cf-text-2)">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-(--cf-text-soft)">{meta}</p>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-sm text-(--cf-accent) transition hover:text-(--cf-accent-strong)">
            {actionLabel}<ArrowUpRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Pinned Takeaway Card (G2) — quote-style
   ═══════════════════════════════════════════════════════ */

export function PinnedTakeawayCard({ text, source }: { text: string; source: string }) {
  return (
    <div className="rounded-xl border-l-[3px] border-l-amber-400/60 bg-(--cf-surface)/60 px-4 py-3">
      <p className="text-sm italic leading-6 text-(--cf-text-1)">&ldquo;{text}&rdquo;</p>
      <p className="mt-2 text-xs text-(--cf-text-soft)">📌 {source}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HeatmapCalendar (D1) — with date labels + today indicator
   ═══════════════════════════════════════════════════════ */

type HeatmapCell = {
  key: string;
  dateLabel: string;
  minutes: number;
  chapters: number;
  level: number;
};

const HEATMAP_COLORS = [
  "bg-(--cf-surface-muted)",
  "bg-blue-900/40",
  "bg-blue-700/50",
  "bg-blue-500/60",
  "bg-blue-400/80",
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HeatmapCalendar({ cells }: { cells: HeatmapCell[] }) {
  const last30 = cells.slice(-30);
  const today = todayKey();
  const [tooltip, setTooltip] = useState<{ key: string; text: string } | null>(null);

  // Build a 7-row grid (Mon-Sun rows × ~5 week columns)
  const DOW_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
  // Organize cells into rows by day of week
  const rows: (HeatmapCell | null)[][] = Array.from({ length: 7 }, () => []);
  for (const cell of last30) {
    const d = new Date(`${cell.key}T12:00:00`);
    const dow = (d.getDay() + 6) % 7; // 0=Mon, 6=Sun
    rows[dow].push(cell);
  }
  // Pad rows to equal length
  const maxCols = Math.max(...rows.map((r) => r.length), 1);
  for (const row of rows) {
    while (row.length < maxCols) row.unshift(null);
  }

  return (
    <div>
      <div className="flex gap-1">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1.5 pr-1.5 pt-0">
          {DOW_LABELS.map((label, i) => (
            <div key={i} className="flex h-5 items-center sm:h-6">
              <span className="w-6 text-right font-mono text-[10px] text-(--cf-text-soft)">{label}</span>
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex flex-1 flex-col gap-1.5">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5">
              {row.map((cell, colIdx) => {
                if (!cell) return <div key={`empty-${rowIdx}-${colIdx}`} className="h-5 w-5 sm:h-6 sm:w-6" />;
                const isToday = cell.key === today;
                const tipText = cell.minutes > 0
                  ? `${cell.dateLabel} — ${cell.chapters} chapter${cell.chapters !== 1 ? "s" : ""} read`
                  : `${cell.dateLabel} — No activity`;
                return (
                  <div
                    key={cell.key}
                    className={cn(
                      "group relative h-5 w-5 cursor-default rounded-[5px] border transition-colors sm:h-6 sm:w-6",
                      HEATMAP_COLORS[cell.level] ?? HEATMAP_COLORS[0],
                      isToday ? "border-(--cf-border-strong) ring-1 ring-(--cf-border)" : "border-(--cf-border)",
                      isToday && cell.level === 0 && "border-dashed border-(--cf-border-strong)"
                    )}
                    role="img"
                    aria-label={`${cell.dateLabel}: ${cell.minutes} minutes, ${cell.chapters} chapters${isToday ? " — today" : ""}`}
                    onMouseEnter={() => setTooltip({ key: cell.key, text: tipText })}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => setTooltip((prev) => prev?.key === cell.key ? null : { key: cell.key, text: tipText })}
                  >
                    {isToday ? (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-(--cf-text-1)" />
                    ) : null}
                    {tooltip?.key === cell.key ? (
                      <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-(--cf-border) bg-(--cf-surface-strong) px-2 py-1 text-[11px] text-(--cf-text-2) shadow-lg">
                        {tooltip.text}
                        <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-(--cf-border) bg-(--cf-surface-strong)" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-(--cf-text-soft)">
          <span>Less</span>
          {HEATMAP_COLORS.map((color, i) => (
            <div key={i} className={cn("h-3.5 w-3.5 rounded-[3px] border border-(--cf-border)", color)} />
          ))}
          <span>More</span>
        </div>
        <span className="text-[11px] text-(--cf-text-soft)">● = today</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Sparkline (D2) — SVG mini chart from daily data
   ═══════════════════════════════════════════════════════ */

export function Sparkline({ data }: { data: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const isInView = useInView(svgRef, { once: true, margin: "-20px" });

  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 56;
  const padY = 4;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - padY - ((v / max) * (h - padY * 2));
    return `${x},${y}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const lastX = w;
  const lastY = h - padY - ((data[data.length - 1] / max) * (h - padY * 2));

  return (
    <svg ref={svgRef} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[200px]" aria-label="Daily reading sparkline">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.15)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#sparkFill)"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.path
        ref={pathRef}
        d={line}
        fill="none"
        stroke="var(--cf-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={isInView ? { pathLength: 1 } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r="3"
        fill="var(--cf-accent)"
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : {}}
        transition={{ delay: 1.2, duration: 0.3, ease: "easeOut" }}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   ActiveDaysRing (D3) — circular progress ring
   ═══════════════════════════════════════════════════════ */

export function ActiveDaysRing({ active, total }: { active: number; total: number }) {
  const pct = Math.min(100, Math.round((active / Math.max(total, 1)) * 100));
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 100 ? "var(--accent-gold)" : pct >= 50 ? "var(--cf-success-text)" : "var(--cf-accent)";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80" aria-label={`${active} of ${total} active days`}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--cf-border)" strokeWidth="5" />
        <motion.circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fill="currentColor" className="text-(--cf-text-1)" fontSize="18" fontWeight="700">
          {active}
        </text>
      </svg>
      <p className="text-xs text-(--cf-text-3)">of {total} days</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   UpgradeCard (F2 — already good, kept)
   ═══════════════════════════════════════════════════════ */

export function UpgradeCard({
  booksUsed, booksTotal, personalizedMessage, onUpgrade,
}: {
  booksUsed: number; booksTotal: number; personalizedMessage: string; onUpgrade: () => void;
}) {
  const percent = Math.min(100, Math.round((booksUsed / Math.max(booksTotal, 1)) * 100));
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-amber-400/20 bg-(--cf-surface-strong) p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_right] from-amber-500/8 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-(--cf-text-2)">FREE PLAN</span>
          <span className="text-sm text-(--cf-text-3)">{booksUsed} of {booksTotal} books used</span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-(--cf-border)">
          <div className="h-full rounded-full bg-linear-to-r from-amber-500 to-amber-400" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-4 text-base leading-7 text-(--cf-text-2)">{personalizedMessage}</p>
        <p className="mt-3 text-lg font-semibold text-(--cf-text-1)">
          $7.99 CAD/month <span className="text-sm font-normal text-(--cf-text-3)">— less than a single book purchase</span>
        </p>
        <p className="mt-2 text-sm text-(--cf-text-3)">Join readers who chose to go deeper</p>
        <Button variant="primary" size="lg" fullWidth onClick={onUpgrade} className="mt-5">Start 7-day free trial &rarr;</Button>
        <p className="mt-3 text-center text-sm text-(--cf-text-soft)">Not now</p>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-(--cf-text-3)">
          <span>Cancel anytime</span><span>&bull;</span><span>No hidden fees</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ProStatusCard (F1 — enhanced with personalized value)
   ═══════════════════════════════════════════════════════ */

export function ProStatusCard({
  renewalDate,
  booksAccessedCount,
  proSinceLabel,
  onManage,
}: {
  renewalDate: string;
  booksAccessedCount: number;
  proSinceLabel: string;
  onManage: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-amber-400/20 bg-(--cf-surface-strong) p-6 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_right] from-amber-500/8 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-amber-300">PRO</span>
          <span className="text-xs text-(--cf-text-soft)">{proSinceLabel}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-soft)">Books accessed</p>
            <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{booksAccessedCount}</p>
          </div>
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-soft)">Advanced analytics</p>
            <p className="mt-1 text-sm font-medium text-(--cf-success-text)">✓ Unlocked</p>
          </div>
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-soft)">Next renewal</p>
            <p className="mt-1 text-sm font-medium text-(--cf-text-1)">{renewalDate}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-(--cf-text-2)">Thanks for being a Pro reader. Your support keeps ChapterFlow growing.</p>
        <Button variant="secondary" onClick={onManage} className="mt-4">Manage subscription</Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CompletionByModeChart (C5 — interactive with counts + nudge)
   ═══════════════════════════════════════════════════════ */

export function CompletionByModeChart({
  data,
  counts,
}: {
  data: { label: string; value: number }[];
  counts?: { simple: number; standard: number; deeper: number };
}) {
  const hasDeeper = (counts?.deeper ?? 0) > 0;
  return (
    <div className="space-y-3">
      {data.map((entry) => {
        const count = counts
          ? counts[entry.label.toLowerCase() as keyof typeof counts] ?? 0
          : 0;
        return (
          <div key={entry.label} className="group">
            <div className="flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
              <span>{entry.label}</span>
              <span>
                {entry.value}%
                {counts ? <span className="ml-1 text-xs text-(--cf-text-soft)">({count} chapters)</span> : null}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--cf-border)">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)"
                initial={{ width: 0 }}
                whileInView={{ width: `${entry.value}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              />
            </div>
          </div>
        );
      })}
      {!hasDeeper ? (
        <p className="mt-2 text-xs text-(--cf-text-soft)">
          Try Deeper mode on your next chapter — it adds scenarios for real-world application.
        </p>
      ) : (
        <p className="mt-2 text-xs text-(--cf-text-soft)">
          Deeper mode chapters show higher quiz scores on average. Your reading depth shapes your retention.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Quiz Bar Chart (2.3) — mini vertical bar chart
   ═══════════════════════════════════════════════════════ */

export function QuizBarChart({
  scores,
  avg,
  best,
  last,
  trend,
}: {
  scores: number[];
  avg: number;
  best: number;
  last: number;
  trend: "up" | "down" | "steady";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-30px" });
  const maxScore = 100;

  return (
    <div ref={containerRef}>
      {/* Bar chart */}
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {scores.map((score, i) => {
          const heightPct = (score / maxScore) * 100;
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-t bg-(--cf-accent)"
              initial={{ height: 0 }}
              animate={isInView ? { height: `${heightPct}%` } : {}}
              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.05 }}
              title={`${score}%`}
            />
          );
        })}
      </div>
      {/* Average line indicator */}
      <div className="relative mt-1 h-0 border-t border-dashed border-(--cf-text-soft)/30" style={{ bottom: `${(avg / maxScore) * 80}px`, marginTop: `-${(avg / maxScore) * 80}px`, position: "relative" }}>
        <span className="absolute -top-3 right-0 text-[10px] text-(--cf-text-soft)">avg {avg}%</span>
      </div>

      {/* Stat row */}
      <div className="mt-4 flex items-center gap-2 text-[13px] text-(--cf-text-3)">
        <span>Average: <span className="font-semibold text-(--cf-text-1)">{avg}%</span></span>
        <span className="text-(--cf-text-soft)">·</span>
        <span>Best: <span className="font-semibold text-(--cf-text-1)">{best}%</span></span>
        <span className="text-(--cf-text-soft)">·</span>
        <span>Last: <span className="font-semibold text-(--cf-text-1)">{last}%</span></span>
      </div>

      {/* Trend */}
      <p className={cn("mt-1 text-xs", trend === "up" ? "text-emerald-400" : trend === "down" ? "text-amber-400" : "text-(--cf-accent)")}>
        {trend === "up" ? "↑ Improving across recent quizzes" : trend === "down" ? "↓ Review recommended" : "→ Steady performance"}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Pro Micro-Badge (2.5) — tiny "PRO" pill for free users
   ═══════════════════════════════════════════════════════ */

export function ProBadge() {
  return (
    <span className="ml-1 inline-flex rounded px-1 py-px text-[9px] font-semibold uppercase leading-none tracking-wide text-amber-500/60 bg-amber-500/[0.08]">
      PRO
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   Up-Next Preview (2.1) — "When you finish, explore:"
   ═══════════════════════════════════════════════════════ */

export function UpNextPreview({
  label,
  bookTitle,
  category,
  onClick,
}: {
  label: string;
  bookTitle: string;
  category?: string;
  onClick: () => void;
}) {
  return (
    <div className="mt-4 border-t border-(--cf-divider) pt-4">
      <button type="button" onClick={onClick} className="group flex items-center gap-2 text-left text-sm text-(--cf-text-3) transition hover:text-(--cf-text-2)">
        <BookOpen className="h-4 w-4 shrink-0" />
        <span>
          {label}: <span className="font-medium text-(--cf-text-2) group-hover:text-(--cf-text-1)">{bookTitle}</span>
        </span>
        {category ? (
          <span className="shrink-0 rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-2 py-0.5 text-[10px] text-(--cf-text-soft)">{category}</span>
        ) : null}
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   This Week Calendar Strip (E1)
   ═══════════════════════════════════════════════════════ */

const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ThisWeekStrip({ cells }: { cells: HeatmapCell[] }) {
  const todayStr = todayKey();
  const todayDate = new Date(`${todayStr}T12:00:00`);
  const todayDow = (todayDate.getDay() + 6) % 7; // 0=Mon

  // Build Mon-Sun for current week
  const weekCells: (HeatmapCell | null)[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - todayDow + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cell = cells.find((c) => c.key === key) ?? null;
    weekCells.push(cell);
  }

  return (
    <div className="border-t border-(--cf-divider) pt-3">
      <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">This week</p>
      <div className="flex items-center justify-between gap-1">
        {weekCells.map((cell, i) => {
          const isToday = i === todayDow;
          const isFuture = i > todayDow;
          const hasActivity = cell ? cell.minutes > 0 : false;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-(--cf-text-soft)">{SHORT_DAYS[i]}</span>
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all",
                  isFuture && "text-(--cf-text-soft)",
                  !isFuture && hasActivity && "bg-emerald-500/20 text-emerald-400",
                  !isFuture && !hasActivity && !isToday && "text-(--cf-text-soft)",
                  isToday && !hasActivity && "border border-dashed border-(--cf-accent)/40 text-(--cf-accent)",
                  isToday && hasActivity && "bg-emerald-500/20 text-emerald-400 ring-1 ring-(--cf-accent)/30"
                )}
              >
                {isFuture ? "○" : hasActivity ? "✓" : isToday ? "●" : "○"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Knowledge / Category Map (E2)
   ═══════════════════════════════════════════════════════ */

export function CategoryMap({
  explored,
  totalCategories,
  onCategoryClick,
}: {
  explored: { name: string; chapters: number }[];
  totalCategories: number;
  onCategoryClick?: (category: string) => void;
}) {
  const remaining = totalCategories - explored.length;
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">
          Categories explored
        </p>
        <span className="text-xs text-(--cf-text-3)">
          {explored.length} of {totalCategories}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {explored.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => onCategoryClick?.(cat.name)}
            className="rounded-full border border-blue-500/10 bg-blue-500/10 px-2.5 py-1 text-[11px] text-blue-400 transition hover:bg-blue-500/15"
          >
            {cat.name} · {cat.chapters}
          </button>
        ))}
        {remaining > 0 ? (
          <span className="px-2 py-1 text-[11px] text-(--cf-text-soft)">
            +{remaining} more to discover
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Staggered Badge Grid (B6) — wrapper with staggerChildren
   ═══════════════════════════════════════════════════════ */

const badgeContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const badgeItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export function StaggeredBadgeGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={badgeContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredBadgeItem({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={badgeItemVariants}>
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   New Badge Celebration Dot (B8)
   ═══════════════════════════════════════════════════════ */

export function NewBadgeDot() {
  return (
    <motion.span
      className="absolute -right-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-amber-400"
      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Skeleton loading (H5)
   ═══════════════════════════════════════════════════════ */

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-2xl bg-(--cf-surface-muted)", className)}>
      <div className="h-full w-full rounded-2xl bg-linear-to-r from-transparent via-(--cf-border) to-transparent" style={{ animation: "shimmer 1.5s infinite", backgroundSize: "200% 100%" }} />
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-450 space-y-8 px-4 pb-28 pt-7 sm:px-6 lg:px-10 lg:pt-8 xl:px-16">
      {/* Hero skeleton */}
      <div className="rounded-[34px] border border-(--cf-border) bg-(--cf-surface-strong) p-6 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Shimmer className="h-20 w-20 shrink-0 !rounded-full sm:h-[100px] sm:w-[100px]" />
          <div className="flex-1 space-y-3">
            <Shimmer className="h-5 w-32" />
            <Shimmer className="h-9 w-64" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-72" />
            <div className="flex gap-6 pt-2">
              <Shimmer className="h-14 w-24" />
              <Shimmer className="h-14 w-24" />
              <Shimmer className="h-14 w-24" />
            </div>
          </div>
        </div>
      </div>
      {/* Section skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-strong) p-6">
          <Shimmer className="h-5 w-40 mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Shimmer className="h-32" />
            <Shimmer className="h-32" />
            <Shimmer className="h-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Section Dot Navigator (H3) — desktop only
   ═══════════════════════════════════════════════════════ */

export function SectionNav({
  sections,
  activeIndex,
  onNavigate,
}: {
  sections: { id: string; label: string }[];
  activeIndex: number;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav
      className="fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 lg:flex"
      aria-label="Section navigation"
    >
      {sections.map((section, i) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onNavigate(section.id)}
          className="group relative flex items-center justify-end"
          aria-label={`Go to ${section.label}`}
        >
          <span className="pointer-events-none absolute right-5 whitespace-nowrap rounded-lg bg-(--cf-surface-strong) px-2.5 py-1 text-xs text-(--cf-text-2) opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {section.label}
          </span>
          <span className={cn(
            "h-2 w-2 rounded-full transition-all",
            i === activeIndex ? "h-2.5 w-2.5 bg-(--cf-accent)" : "bg-(--cf-text-soft)/40 hover:bg-(--cf-text-soft)"
          )} />
        </button>
      ))}
    </nav>
  );
}
