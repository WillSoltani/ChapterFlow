"use client";

import type { HTMLAttributes, ReactNode } from "react";
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







/* ═══════════════════════════════════════════════════════
   Sparkline (D2) — SVG mini chart from daily data
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   ActiveDaysRing (D3) — circular progress ring
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   UpgradeCard (F2 — already good, kept)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   ProStatusCard (F1 — enhanced with personalized value)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   CompletionByModeChart (C5 — interactive with counts + nudge)
   ═══════════════════════════════════════════════════════ */





/* ═══════════════════════════════════════════════════════
   Quiz Bar Chart (2.3) — mini vertical bar chart
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   Pro Micro-Badge (2.5) — tiny "PRO" pill for free users
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   Up-Next Preview (2.1) — "When you finish, explore:"
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   This Week Calendar Strip (E1)
   ═══════════════════════════════════════════════════════ */





/* ═══════════════════════════════════════════════════════
   Knowledge / Category Map (E2)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   Staggered Badge Grid (B6) — wrapper with staggerChildren
   ═══════════════════════════════════════════════════════ */









/* ═══════════════════════════════════════════════════════
   New Badge Celebration Dot (B8)
   ═══════════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════
   Skeleton loading (H5)
   ═══════════════════════════════════════════════════════ */





/* ═══════════════════════════════════════════════════════
   Section Dot Navigator (H3) — desktop only
   ═══════════════════════════════════════════════════════ */



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

export { UpgradeCard } from "./UpgradeCard";
export { ProStatusCard } from "./ProStatusCard";
export { CompletionByModeChart } from "./CompletionByModeChart";
export { QuizBarChart } from "./QuizBarChart";
export { ProBadge } from "./ProBadge";
export { UpNextPreview } from "./UpNextPreview";
export { ThisWeekStrip } from "./ThisWeekStrip";
export { StaggeredBadgeGrid } from "./StaggeredBadgeGrid";
export { StaggeredBadgeItem } from "./StaggeredBadgeItem";
export { NewBadgeDot } from "./NewBadgeDot";
export { ProfileSkeleton } from "./ProfileSkeleton";
export { SectionNav } from "./SectionNav";
