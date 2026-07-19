"use client";

import Image from "next/image";
import { Check, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { Button } from "@/app/book/components/ui/Button";
import { cn } from "@/lib/utils";
import { IdentityTooltip } from "./IdentityTooltip";
import { StreakFlame } from "./StreakFlame";

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
      transition={{ duration: DUR.slow, ease: EASE.standard }}
      className="relative overflow-hidden rounded-4xl border border-(--cf-border) bg-(--cf-surface-strong) p-6 shadow-shadow-card sm:p-7 lg:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_left] from-accent-cyan/22 via-accent-cyan/10 to-transparent" />
      <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-(--cf-surface-muted) blur-3xl" />

      {/* A2: Avatar ring CSS — Pro gets rotating conic-gradient, Free gets cyan ring */}
      <style>{`
        @property --ring-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        @keyframes cf-ring-spin { to { --ring-angle: 360deg; } }
        .cf-avatar-ring {
          background: conic-gradient(from var(--ring-angle), var(--accent-amber), var(--accent-violet), var(--accent-cyan), var(--accent-amber));
          animation: cf-ring-spin 20s linear infinite;
        }
        @keyframes cf-pro-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .cf-pro-badge-shimmer {
          background: linear-gradient(90deg, var(--cf-profile-flame-base) 0%, var(--cf-profile-flame-light) 40%, var(--cf-profile-flame-pale) 50%, var(--cf-profile-flame-light) 60%, var(--cf-profile-flame-base) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: cf-pro-shimmer 3s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cf-avatar-ring { animation: none; background: conic-gradient(from 0deg, var(--accent-amber), var(--accent-violet), var(--accent-cyan), var(--accent-amber)); }
          .cf-pro-badge-shimmer { animation: none; }
        }
      `}</style>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Avatar with A2 tier ring — rotating conic-gradient */}
          <div className="relative shrink-0">
            <div
              className="cf-avatar-ring flex items-center justify-center overflow-hidden rounded-full p-[3px] shadow-[0_16px_38px_rgba(2,6,23,0.18)]"
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
                "inline-flex rounded-full px-3 py-1 text-cf-caption font-medium uppercase tracking-[0.22em]",
                isPro ? "border border-accent-amber/30 bg-accent-amber/10" : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)"
              )}>
                {isPro ? <span className="cf-pro-badge-shimmer">PRO</span> : "FREE"}
              </span>
              <IdentityTooltip currentLabel={identityLabel} booksCompleted={booksCompleted} />
            </div>

            {/* Name + A1 streak flame */}
            <div className="mt-3 flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-(--cf-text-1) sm:text-4xl">{name}</h1>
              <div className={cn(
                "flex items-center gap-1.5 rounded-2xl px-3 py-1.5",
                hasStreak ? "bg-accent-amber/10" : "bg-(--cf-surface-muted)"
              )}>
                <StreakFlame active={hasStreak} size={24} streakDays={streakDays} />
                <span className={cn("text-lg font-bold", hasStreak ? "text-accent-amber" : "text-(--cf-text-soft)")}>
                  {streakDays}
                </span>
              </div>
            </div>
            <p className="mt-1 text-sm text-(--cf-text-3)">@{username}</p>

            {/* A5 streak microcopy */}
            <p className={cn("mt-2 text-sm", hasStreak ? "text-(--accent-emerald)" : "text-(--cf-text-3)")}>
              {streakMicrocopy}
            </p>

            <p className="mt-3 max-w-2xl text-base leading-7 text-(--cf-text-2)">{bio}</p>

            {/* Hero stat row */}
            <div className="mt-5 flex flex-wrap gap-6">
              <div>
                <p className="text-cf-caption uppercase tracking-[0.22em] text-(--cf-text-3)">Books completed</p>
                <p className="mt-1 text-2xl font-bold text-(--cf-text-1)">{booksCompleted}</p>
              </div>
              <div>
                <p className="text-cf-caption uppercase tracking-[0.22em] text-(--cf-text-3)">Current streak</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: hasStreak ? "var(--accent-amber)" : "var(--cf-text-1)" }}>
                  {streakDays} <span className="text-base font-medium text-(--cf-text-3)">{streakDays === 1 ? "day" : "days"}</span>
                </p>
              </div>
              <div>
                <p className="text-cf-caption uppercase tracking-[0.22em] text-(--cf-text-3)">Total reading</p>
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
                  className={cn("h-full rounded-full", goalMet ? "bg-accent-emerald" : "bg-(--cf-accent)")}
                  initial={{ width: 0 }}
                  animate={{ width: `${goalPercent}%` }}
                  transition={{ duration: DUR.slow, ease: "easeOut", delay: 0.3 }}
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
