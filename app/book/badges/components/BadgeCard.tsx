"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BadgeWithProgress } from "../lib/badge-types";
import { BADGE_ICONS, FALLBACK_BADGE_ICON } from "../lib/badge-ui-definitions";
import { TIER_BORDER_COLORS, TIER_GLOW_STYLES, getProgressText } from "../lib/badge-utils";

type BadgeCardProps = {
  badge: BadgeWithProgress;
  index?: number;
  onClick: () => void;
};

// Single source of truth for the metallic tier-pill gradients. BadgeDetailModal's
// TierPillDisplay imports this so the two pill renderers can never drift apart.
// (Lives here rather than badge-utils.ts to stay within this change's scope.)
export const METALLIC_GRADIENTS: Record<string, string> = {
  bronze: "linear-gradient(135deg, var(--cf-badge-bronze), var(--cf-badge-bronze-highlight))",
  silver: "linear-gradient(135deg, var(--cf-badge-silver), var(--cf-badge-silver-highlight))",
  gold: "linear-gradient(135deg, var(--cf-badge-gold), var(--cf-badge-gold-highlight))",
  platinum: "linear-gradient(135deg, var(--cf-badge-platinum), var(--cf-palette-white))",
  unique: "linear-gradient(135deg, var(--cf-badge-unique), var(--cf-badge-unique-highlight))",
  secret: "linear-gradient(135deg, var(--cf-badge-unique), var(--cf-badge-unique-highlight))",
};

function TierPill({ tier, earned }: { tier: string; earned: boolean }) {
  const label = tier === "unique" ? "Unique" : tier === "secret" ? "Secret" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const gradient = METALLIC_GRADIENTS[tier] ?? METALLIC_GRADIENTS.unique;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        !earned && "opacity-50 grayscale-[60%]"
      )}
      style={
        earned
          ? {
              background: gradient,
              color: tier === "platinum" || tier === "silver" ? "var(--cf-badge-text-cool)" : tier === "unique" || tier === "secret" ? "var(--cf-palette-white)" : "var(--cf-badge-text-warm)",
              textShadow: tier === "platinum" ? "0 1px 0 color-mix(in srgb, var(--cf-palette-white) 40%, transparent)" : "none",
            }
          : { background: "var(--cf-surface-strong)", color: "var(--cf-text-soft)" }
      }
    >
      {label}
    </span>
  );
}

export function BadgeCard({ badge, index = 0, onClick }: BadgeCardProps) {
  const reduced = useReducedMotion();

  if (badge.isSecret && !badge.isDiscovered) {
    return <SecretBadgeCard index={index} onClick={onClick} />;
  }

  if (badge.isEarned) {
    return <EarnedBadgeCard badge={badge} index={index} onClick={onClick} reduced={Boolean(reduced)} />;
  }

  return <LockedBadgeCard badge={badge} index={index} onClick={onClick} reduced={Boolean(reduced)} />;
}

function EarnedBadgeCard({
  badge,
  index,
  onClick,
  reduced,
}: {
  badge: BadgeWithProgress;
  index: number;
  onClick: () => void;
  reduced: boolean;
}) {
  const borderColor = TIER_BORDER_COLORS[badge.tier] ?? TIER_BORDER_COLORS.unique;
  const glowStyle = TIER_GLOW_STYLES[badge.tier] ?? TIER_GLOW_STYLES.unique;
  const Icon = BADGE_ICONS[badge.icon] ?? FALLBACK_BADGE_ICON;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.normal, delay: index * 0.05, ease: EASE.standard }}
      whileHover={reduced ? undefined : { y: -3 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left",
        "bg-(--cf-surface-muted) backdrop-blur-xl",
        "border-(--cf-border)",
        "cursor-pointer",
        "cf-focus"
      )}
      style={{
        borderLeftWidth: 2,
        borderLeftColor: borderColor,
        boxShadow: glowStyle,
        transition: "box-shadow 200ms ease, transform 200ms ease",
      }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <Icon
          className="h-12 w-12 shrink-0"
          style={{ color: "var(--accent-amber)" }}
          aria-hidden
        />
        <TierPill tier={badge.tier} earned />
      </div>

      <h3 className="mt-3 text-sm font-semibold" style={{ color: "var(--accent-amber)" }}>{badge.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-(--cf-text-3)">{badge.description}</p>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
        <span className="uppercase tracking-wider text-(--cf-text-soft)">
          {badge.category}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5" style={{ color: "var(--accent-amber)" }}>
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            {badge.fpValue}
          </span>
          <span className="font-medium" style={{ color: "var(--accent-emerald)" }}>&#10003; Earned</span>
        </div>
      </div>
    </motion.button>
  );
}

function LockedBadgeCard({
  badge,
  index,
  onClick,
  reduced,
}: {
  badge: BadgeWithProgress;
  index: number;
  onClick: () => void;
  reduced: boolean;
}) {
  const progressText = getProgressText(badge);
  const Icon = BADGE_ICONS[badge.icon] ?? FALLBACK_BADGE_ICON;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.normal, delay: index * 0.05, ease: EASE.standard }}
      whileHover={reduced ? undefined : { y: -1, opacity: 1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left",
        "bg-(--cf-surface-muted) backdrop-blur-md",
        "border-(--cf-border)",
        "cursor-pointer",
        "cf-focus"
      )}
      style={{ transition: "opacity 150ms ease, transform 200ms ease" }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="relative">
          <Icon className="h-12 w-12 shrink-0 text-(--cf-text-soft) opacity-35" aria-hidden />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--cf-surface)/80 text-[10px]">
            <Lock className="h-3 w-3 text-(--cf-text-soft)" />
          </span>
        </div>
        <TierPill tier={badge.tier} earned={false} />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-(--cf-text-1)">{badge.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-(--cf-text-soft)">{badge.description}</p>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
        <span className="uppercase tracking-wider text-(--cf-text-soft)">
          {badge.category}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 text-(--cf-text-soft)">
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            {badge.fpValue}
          </span>
          <span className="text-(--cf-text-soft)">{progressText}</span>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-(--cf-surface-strong)">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(badge.current > 0 ? 4 : 0, badge.percentage)}%`, background: "var(--accent-amber)" }}
        />
      </div>

      <p className="mt-1.5 text-[10px] text-(--cf-text-soft) opacity-0 transition-opacity group-hover:opacity-100">
        Click for details
      </p>
    </motion.button>
  );
}

function SecretBadgeCard({ index, onClick }: { index: number; onClick: () => void }) {
  const reduced = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.normal, delay: index * 0.05, ease: EASE.standard }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-4 text-left cursor-pointer",
        "bg-(--cf-surface-muted)",
        "border border-dashed border-(--cf-border)",
        "cf-focus"
      )}
      style={{ transition: "box-shadow 200ms ease" }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted)">
          <span className="text-xl text-(--cf-text-soft)">?</span>
        </div>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-(--cf-text-1)">Hidden Achievement</h3>
      <p className="mt-1 text-xs leading-relaxed text-(--cf-text-soft)">
        Discover through your reading journey
      </p>

      <div className="mt-3 text-[10px] uppercase tracking-wider text-(--cf-text-soft)">
        Secret
      </div>
    </motion.button>
  );
}
