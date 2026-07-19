"use client";

import {
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { MONTHLY_PRICE_WITH_CURRENCY, TRIAL_CTA_LABEL } from "@/lib/pricing";
import type { ProSource } from "@/lib/entitlement-types";
import {
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
  APPLE_MANAGED_SUBSCRIPTION_LABEL,
} from "@/lib/apple-billing";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { Button } from "@/app/book/components/ui/Button";
import { cn } from "@/lib/utils";

/* ─── Inline markdown helper ─── */



/* ═══════════════════════════════════════════════════════
   FadeIn — scroll-triggered stagger wrapper (H2)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   AnimatedNumber — scroll-triggered counter (C1)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   StreakFlame — SVG flame with CSS flicker animation (A1)
   ═══════════════════════════════════════════════════════ */





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
    <div
      className={cn("cf-panel rounded-3xl p-5", "overflow-hidden p-0", className)}
      {...props}
    >
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
                <p className="text-cf-caption uppercase tracking-[0.26em] text-(--cf-text-3)">
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
    </div>
  );
}




/* ═══════════════════════════════════════════════════════
   StatCard — with scroll-triggered animation + conditional
   gradient tints (C1 + C2)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   Identity label progression data (A3)
   ═══════════════════════════════════════════════════════ */





/* ═══════════════════════════════════════════════════════
   Identity Hero Banner (A1-A4 + existing features)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   StickyMiniHeader (H1 — already done, kept)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   4-Step Learning Loop Indicator (B1)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   MomentumCard (B1-B3) — full-width, 4-step, chapter time,
   pulsing CTA
   ═══════════════════════════════════════════════════════ */



/* ─── Momentum empty state (B5) ─── */



/* ═══════════════════════════════════════════════════════
   ActiveBookCard (unchanged)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   AchievementBadgeCard (unchanged)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   TimelineRow (unchanged)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   NotePreviewCard (unchanged)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   Pinned Takeaway Card (G2) — quote-style
   ═══════════════════════════════════════════════════════ */



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

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}



/* ═══════════════════════════════════════════════════════
   Sparkline (D2) — SVG mini chart from daily data
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   ActiveDaysRing (D3) — circular progress ring
   ═══════════════════════════════════════════════════════ */



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
    <div className="relative overflow-hidden rounded-4xl border border-accent-amber/20 bg-(--cf-surface-strong) p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_right] from-accent-amber/8 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="cf-pill px-3 py-1 text-cf-caption font-medium uppercase tracking-[0.22em]">FREE PLAN</span>
          <span className="text-sm text-(--cf-text-3)">{booksUsed} of {booksTotal} books used</span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-(--cf-border)">
          <div className="h-full rounded-full bg-linear-to-r from-accent-amber to-accent-amber" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-4 text-base leading-7 text-(--cf-text-2)">{personalizedMessage}</p>
        <p className="mt-3 text-lg font-semibold text-(--cf-text-1)">
          {MONTHLY_PRICE_WITH_CURRENCY}/month <span className="text-sm font-normal text-(--cf-text-3)">— less than a single book purchase</span>
        </p>
        <p className="mt-2 text-sm text-(--cf-text-3)">Join readers who chose to go deeper</p>
        <Button variant="primary" size="lg" fullWidth onClick={onUpgrade} className="mt-5">{TRIAL_CTA_LABEL} &rarr;</Button>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-(--cf-text-3)">
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
  proSource,
  onManage,
}: {
  renewalDate: string;
  booksAccessedCount: number;
  proSinceLabel: string;
  /** When "apple", subscription is billed through the App Store — show Apple's
   *  management link rather than the Stripe billing portal. Derived from the
   *  shared `ProSource` source of truth so it cannot drift (WS3-014). */
  proSource?: ProSource;
  onManage: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-4xl border border-accent-amber/20 bg-(--cf-surface-strong) p-6 shadow-shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_right] from-accent-amber/8 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full border border-accent-amber/30 bg-accent-amber/10 px-3 py-1 text-cf-caption font-medium uppercase tracking-[0.22em] text-accent-amber">PRO</span>
          <span className="text-xs text-(--cf-text-soft)">{proSinceLabel}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-3)">Books accessed</p>
            <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{booksAccessedCount}</p>
          </div>
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-3)">Advanced analytics</p>
            <p className="mt-1 text-sm font-medium text-(--cf-success-text)">✓ Unlocked</p>
          </div>
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-3)">Next renewal</p>
            <p className="mt-1 text-sm font-medium text-(--cf-text-1)">{renewalDate}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-(--cf-text-2)">Thanks for being a Pro reader. Your support keeps ChapterFlow growing.</p>
        {proSource === "apple" ? (
          <>
            <p className="mt-4 text-xs text-(--cf-text-soft)">{APPLE_MANAGED_SUBSCRIPTION_LABEL}.</p>
            <a
              href={APPLE_MANAGE_SUBSCRIPTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex h-(--cf-control-height-sm) items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface) px-4 text-sm font-semibold text-(--cf-text-1) transition-colors hover:border-(--cf-text-soft)"
            >
              Manage in the App Store
            </a>
          </>
        ) : (
          <Button variant="secondary" onClick={onManage} className="mt-4">Manage subscription</Button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CompletionByModeChart (C5 — interactive with counts + nudge)
   ═══════════════════════════════════════════════════════ */

const MODE_BAR_COLORS: Record<string, string> = {
  Simple: "var(--accent-cyan)",
  Standard: "var(--accent-violet)",
  Deeper: "var(--accent-amber)",
};

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
      {data.map((entry, idx) => {
        const count = counts
          ? counts[entry.label.toLowerCase() as keyof typeof counts] ?? 0
          : 0;
        const barColor = MODE_BAR_COLORS[entry.label] ?? "var(--cf-accent)";
        const staggerDelay = idx * 0.15;
        return (
          <div key={entry.label} className="group">
            <div className="flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
              <span>{entry.label}</span>
              <span>
                {entry.value}%
                {counts ? <span className="ml-1 text-xs text-(--cf-text-soft)">({count} {count === 1 ? "chapter" : "chapters"})</span> : null}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--cf-border)">
              <motion.div
                className="h-full rounded-full"
                style={{ background: barColor }}
                initial={{ width: 0 }}
                whileInView={{ width: `${entry.value}%` }}
                viewport={{ once: true }}
                transition={{ duration: DUR.reveal, ease: "easeOut", delay: staggerDelay }}
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
              transition={{ duration: DUR.slow, ease: "easeOut", delay: i * 0.05 }}
              title={`${score}%`}
            />
          );
        })}
      </div>
      {/* Average line indicator */}
      <div className="relative mt-1 h-0 border-t border-dashed border-(--cf-text-soft)/30" style={{ bottom: `${(avg / maxScore) * 80}px`, marginTop: `-${(avg / maxScore) * 80}px`, position: "relative" }}>
        <span className="absolute -top-3 right-0 text-[10px] text-(--cf-text-3)">avg {avg}%</span>
      </div>

      {/* Stat row */}
      <div className="mt-4 flex items-center gap-2 text-cf-label text-(--cf-text-3)">
        <span>Average: <span className="font-semibold text-(--cf-text-1)">{avg}%</span></span>
        <span className="text-(--cf-text-soft)">·</span>
        <span>Best: <span className="font-semibold text-(--cf-text-1)">{best}%</span></span>
        <span className="text-(--cf-text-soft)">·</span>
        <span>Last: <span className="font-semibold text-(--cf-text-1)">{last}%</span></span>
      </div>

      {/* Trend */}
      <p className={cn("mt-1 text-xs", trend === "up" ? "text-accent-emerald" : trend === "down" ? "text-accent-amber" : "text-(--cf-accent)")}>
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
    <span className="ml-1 inline-flex rounded px-1 py-px text-cf-caption font-semibold uppercase leading-none tracking-wide text-accent-amber/60 bg-accent-amber/[0.08]">
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
          <span className="cf-pill shrink-0 px-2 py-0.5 text-[10px] text-(--cf-text-3)">{category}</span>
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
      <p className="mb-2 text-cf-caption uppercase tracking-[0.22em] text-(--cf-text-3)">This week</p>
      <div className="flex items-center justify-between gap-1">
        {weekCells.map((cell, i) => {
          const isToday = i === todayDow;
          const isFuture = i > todayDow;
          const hasActivity = cell ? cell.minutes > 0 : false;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-(--cf-text-3)">{SHORT_DAYS[i]}</span>
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-all",
                  isFuture && "text-(--cf-text-soft)",
                  !isFuture && hasActivity && "bg-accent-emerald/20 text-accent-emerald",
                  !isFuture && !hasActivity && !isToday && "text-(--cf-text-soft)",
                  isToday && !hasActivity && "border border-dashed border-(--cf-accent)/40 text-(--cf-accent)",
                  isToday && hasActivity && "bg-accent-emerald/20 text-accent-emerald ring-1 ring-(--cf-accent)/30"
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



/* ═══════════════════════════════════════════════════════
   Staggered Badge Grid (B6) — wrapper with staggerChildren
   ═══════════════════════════════════════════════════════ */

const badgeContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const badgeItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.page, ease: EASE.standard } },
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
    <motion.div variants={badgeItemVariants} className="h-full">
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
      className="absolute -right-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-accent-amber"
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
      <div className="rounded-4xl border border-(--cf-border) bg-(--cf-surface-strong) p-6 sm:p-7 lg:p-8">
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
          <span className="pointer-events-none absolute right-5 whitespace-nowrap rounded-lg bg-(--cf-surface-strong) px-2.5 py-1 text-xs text-(--cf-text-2) opacity-0 shadow-shadow-elevated transition-opacity group-hover:opacity-100">
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

export { FadeIn } from "./FadeIn";
export { AnimatedNumber } from "./AnimatedNumber";
export { StatCard } from "./StatCard";

export { IdentityHeroBanner } from "./IdentityHeroBanner";
export { StickyMiniHeader } from "./StickyMiniHeader";
export { MomentumCard } from "./MomentumCard";
export { MomentumEmptyState } from "./MomentumEmptyState";
export { ActiveBookCard } from "./ActiveBookCard";
export { AchievementBadgeCard } from "./AchievementBadgeCard";
export { TimelineRow } from "./TimelineRow";
export { NotePreviewCard } from "./NotePreviewCard";
export { PinnedTakeawayCard } from "./PinnedTakeawayCard";
export { HeatmapCalendar } from "./HeatmapCalendar";
export { Sparkline } from "./Sparkline";
export { ActiveDaysRing } from "./ActiveDaysRing";
export { CategoryMap } from "./CategoryMap";
