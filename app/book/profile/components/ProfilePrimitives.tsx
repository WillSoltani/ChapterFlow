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
    <Card className={cn("overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-0", className)} {...props}>
      <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_45%)] px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon ? (
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-slate-100">
                {icon}
              </div>
            ) : null}
            <div>
              {eyebrow ? <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">{eyebrow}</p> : null}
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
              {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
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
    <div className="relative overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(145deg,rgba(10,15,28,0.96),rgba(11,17,32,0.88))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.5)] sm:p-7 lg:p-8">
      <div className={cn("pointer-events-none absolute inset-0 bg-radial-[circle_at_top_left]", accentClass[accent])} />
      <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-white/14 bg-white/7 shadow-[0_16px_38px_rgba(2,6,23,0.42)] sm:h-28 sm:w-28">
              {avatar ? (
                <Image src={avatar} alt={name} width={112} height={112} className="h-full w-full object-cover" unoptimized />
              ) : (
                <span className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">{initials}</span>
              )}
            </div>
          </div>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">
                {plan}
              </span>
              <span className="inline-flex rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-amber-100">
                {streakLabel}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">{name}</h1>
            <p className="mt-2 text-sm text-slate-400">@{username}</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">{tagline}</p>
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
    <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

export function StatCard({ icon, label, value, helper, trend }: { icon: ReactNode; label: string; value: ReactNode; helper?: string; trend?: ReactNode }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_30px_rgba(2,6,23,0.26)]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-slate-100">{icon}</span>
        {trend ? <span className="text-xs text-slate-400">{trend}</span> : null}
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-400">{helper}</p> : null}
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
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_16px_30px_rgba(2,6,23,0.24)]">
      <div className="flex gap-4">
        <BookCover
          bookId={bookId}
          title={title}
          icon={icon}
          coverImage={coverImage}
          className="h-24 w-18 rounded-2xl border border-white/14 bg-white/7"
          fallbackClassName="text-3xl"
          sizes="72px"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-slate-50">{title}</p>
          <p className="mt-1 text-sm text-slate-400">{author}</p>
          <p className="mt-3 text-sm text-slate-300">{chapterLabel}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-linear-to-r from-sky-400 to-cyan-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">{progress}% complete • {eta}</p>
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
        "group rounded-[26px] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
        earned
          ? "border-amber-300/28 bg-[linear-gradient(140deg,rgba(251,191,36,0.14),rgba(251,191,36,0.05))]"
          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-3xl transition", !earned && "opacity-45 grayscale")}>{icon}</span>
        {!earned ? <Lock className="h-4 w-4 text-slate-600" /> : null}
      </div>
      <p className={cn("mt-4 text-sm font-semibold", earned ? "text-amber-100" : "text-slate-100")}>{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      {progressLabel ? <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{progressLabel}</p> : null}
    </button>
  );
}

export function TimelineRow({ title, detail, meta }: { title: string; detail: string; meta: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-white/8 bg-black/12 px-4 py-3.5">
      <div className="flex flex-col items-center">
        <span className="mt-1 inline-flex h-3 w-3 rounded-full bg-sky-300" />
        <span className="mt-2 h-full w-px bg-white/8" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-100">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{meta}</p>
      </div>
    </div>
  );
}

export function NotePreviewCard({ title, body, meta, actionLabel, onAction }: { title: string; body: string; meta: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-300">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{meta}</p>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-sm text-sky-200 transition hover:text-sky-100">
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
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-black/12 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
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

  return (
    <div className="rounded-[30px] border border-white/12 bg-[linear-gradient(145deg,rgba(10,15,28,0.96),rgba(11,17,32,0.88))] p-5 shadow-[0_24px_50px_rgba(2,6,23,0.42)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Subscription</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">{plan}</span>
            <span className="inline-flex rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-100">{status}</span>
          </div>
          <h3 className="mt-4 text-2xl font-semibold text-slate-50">{priceLabel}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Clear billing labels, a tasteful upgrade path, and realistic placeholders for renewal, invoices, and payment method all live here.
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/8 bg-black/12 p-4">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>Free book access used</span>
          <span>{used} used • {remaining} remaining</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-linear-to-r from-sky-400 to-cyan-300" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button variant="primary" onClick={onUpgrade}>Upgrade to Pro</Button>
        <Button variant="secondary" onClick={onManage}>Manage subscription</Button>
      </div>
    </div>
  );
}
