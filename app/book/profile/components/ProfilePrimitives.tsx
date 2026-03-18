"use client";

import type { HTMLAttributes, ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight, Lock } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import { Card } from "@/app/book/components/ui/Card";
import { BookCover } from "@/app/book/components/BookCover";
import { cn } from "@/app/book/components/ui/cn";

type SectionCardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
};

export function SectionCard({ title, description, eyebrow, icon, right, className, children, ...props }: SectionCardProps) {
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
              {eyebrow ? <p className="text-[11px] uppercase tracking-[0.26em] text-(--cf-text-soft)">{eyebrow}</p> : null}
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-(--cf-text-1)">{title}</h2>
              {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-(--cf-text-2)">{description}</p> : null}
            </div>
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </Card>
  );
}

export function ProfileHeroCard({
  avatar,
  initials,
  accent = "sky",
  name,
  username,
  tagline,
  plan,
  streakLabel,
  joinDate,
  readingGoal,
  onEdit,
  onShare,
}: {
  avatar: string | null;
  initials: string;
  accent?: "sky" | "emerald" | "amber" | "rose";
  name: string;
  username: string;
  tagline: string;
  plan: string;
  streakLabel: string;
  joinDate: string;
  readingGoal: string;
  onEdit: () => void;
  onShare: () => void;
}) {
  const accentClass = {
    sky: "from-sky-500/28 via-cyan-400/12 to-transparent",
    emerald: "from-emerald-500/24 via-teal-400/12 to-transparent",
    amber: "from-amber-500/24 via-orange-400/10 to-transparent",
    rose: "from-rose-500/24 via-pink-400/12 to-transparent",
  } as const;

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-(--cf-border) bg-(--cf-surface-strong) p-6 shadow-sm sm:p-7 lg:p-8">
      <div className={cn("pointer-events-none absolute inset-0 bg-radial-[circle_at_top_left]", accentClass[accent])} />
      <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-(--cf-border) bg-(--cf-surface-muted) shadow-[0_16px_38px_rgba(2,6,23,0.18)] sm:h-28 sm:w-28">
              {avatar ? (
                <Image src={avatar} alt={name} width={112} height={112} className="h-full w-full object-cover" unoptimized />
              ) : (
                <span className="text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-4xl">{initials}</span>
              )}
            </div>
          </div>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-(--cf-text-2)">
                {plan}
              </span>
              <span className="inline-flex rounded-full border border-(--cf-warning-border) bg-(--cf-warning-soft) px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-(--cf-warning-text)">
                {streakLabel}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-(--cf-text-1) sm:text-5xl">{name}</h1>
            <p className="mt-2 text-sm text-(--cf-text-3)">@{username}</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-(--cf-text-2)">{tagline}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetaBadge label="Joined" value={joinDate} />
              <MetaBadge label="Reading goal" value={readingGoal} />
              <MetaBadge label="Focus" value="Retention first reading" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 xl:flex-col xl:items-stretch">
          <Button variant="primary" onClick={onEdit}>
            Edit profile
          </Button>
          <Button variant="secondary" onClick={onShare}>
            Share profile
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetaBadge({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">{label}</p>
      <p className="mt-2 text-sm font-medium text-(--cf-text-1)">{value}</p>
    </div>
  );
}

export function StatCard({ icon, label, value, helper, trend }: { icon: ReactNode; label: string; value: ReactNode; helper?: string; trend?: ReactNode }) {
  return (
    <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2)">{icon}</span>
        {trend ? <span className="text-xs text-(--cf-text-3)">{trend}</span> : null}
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-3)">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-(--cf-text-1)">{value}</p>
      {helper ? <p className="mt-2 text-sm text-(--cf-text-3)">{helper}</p> : null}
    </div>
  );
}

export function ActiveBookCard({
  title,
  author,
  bookId,
  coverImage,
  icon,
  progress,
  chapterLabel,
  eta,
  onContinue,
}: {
  title: string;
  author: string;
  bookId: string;
  coverImage?: string;
  icon: string;
  progress: number;
  chapterLabel: string;
  eta: string;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-sm">
      <div className="flex gap-4">
        <BookCover
          bookId={bookId}
          title={title}
          icon={icon}
          coverImage={coverImage}
          className="h-24 w-18 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted)"
          fallbackClassName="text-3xl"
          sizes="72px"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-(--cf-text-1)">{title}</p>
          <p className="mt-1 text-sm text-(--cf-text-3)">{author}</p>
          <p className="mt-3 text-sm text-(--cf-text-2)">{chapterLabel}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-border)">
            <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-(--cf-text-3)">{progress}% complete • {eta}</p>
            <Button variant="secondary" size="sm" onClick={onContinue}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AchievementBadgeCard({
  icon,
  title,
  description,
  earned,
  progressLabel,
  onOpen,
}: {
  icon: string;
  title: string;
  description: string;
  earned: boolean;
  progressLabel?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group rounded-[26px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
        earned
          ? "border-(--cf-warning-border) bg-(--cf-warning-soft)"
          : "border-(--cf-border) bg-(--cf-surface-muted) hover:border-(--cf-border-strong) hover:bg-(--cf-surface)"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-3xl transition", !earned && "opacity-45 grayscale")}>{icon}</span>
        {!earned ? <Lock className="h-4 w-4 text-(--cf-text-soft)" /> : null}
      </div>
      <p className={cn("mt-4 text-sm font-semibold", earned ? "text-(--cf-warning-text)" : "text-(--cf-text-1)")}>{title}</p>
      <p className="mt-2 text-sm leading-6 text-(--cf-text-3)">{description}</p>
      {progressLabel ? <p className="mt-3 text-xs uppercase tracking-[0.18em] text-(--cf-text-soft)">{progressLabel}</p> : null}
    </button>
  );
}

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

export function NotePreviewCard({ title, body, meta, actionLabel, onAction }: { title: string; body: string; meta: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="rounded-[24px] border border-(--cf-border) bg-(--cf-surface) p-4 shadow-sm">
      <p className="text-sm font-semibold text-(--cf-text-1)">{title}</p>
      <p className="mt-3 line-clamp-4 text-sm leading-7 text-(--cf-text-2)">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-(--cf-text-soft)">{meta}</p>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-sm text-(--cf-accent) transition hover:text-(--cf-accent-strong)">
            {actionLabel}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PrivacyRow({ label, description, control }: { label: string; description: string; control: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-(--cf-text-1)">{label}</p>
        <p className="mt-1 text-sm leading-6 text-(--cf-text-3)">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function SubscriptionSummaryCard({
  plan,
  status,
  priceLabel,
  used,
  remaining,
  onUpgrade,
  onManage,
}: {
  plan: string;
  status: string;
  priceLabel: string;
  used: number;
  remaining: number;
  onUpgrade: () => void;
  onManage: () => void;
}) {
  const total = Math.max(used + remaining, 1);
  const percent = Math.min(100, Math.round((used / total) * 100));

  // Only show "Manage subscription" when the user has an active PRO subscription
  // (guarantees a Stripe customer ID exists). For free, canceled, or past_due-only
  // users we show the upgrade CTA instead.
  const isActivePro =
    plan === "Pro" && (status === "active" || status === "past_due");

  return (
    <div className="rounded-[30px] border border-(--cf-border) bg-(--cf-surface) p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-(--cf-text-3)">Subscription</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-2)">{plan}</span>
            <span className="inline-flex rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-(--cf-success-text)">{status}</span>
          </div>
          <h3 className="mt-4 text-2xl font-semibold text-(--cf-text-1)">{priceLabel}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-(--cf-text-2)">
            {isActivePro
              ? "You're on the Pro plan. Manage your billing, update your payment method, or review invoices below."
              : "Unlock unlimited books, advanced quizzes, and full reading analytics with a Pro subscription."}
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
          <span>Free book access used</span>
          <span>{used} used • {remaining} remaining</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-border)">
          <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {isActivePro ? (
          <Button variant="secondary" onClick={onManage} className="sm:col-span-2">
            Manage subscription
          </Button>
        ) : (
          <Button variant="primary" onClick={onUpgrade} className="sm:col-span-2">
            Upgrade to Pro
          </Button>
        )}
      </div>
    </div>
  );
}
