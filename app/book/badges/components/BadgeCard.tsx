"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";
import type { BadgeWithProgress } from "../lib/badge-types";
import { TIER_BORDER_COLORS, TIER_GLOW_STYLES, TIER_PILL_STYLES, getProgressText } from "../lib/badge-utils";

type BadgeCardProps = {
  badge: BadgeWithProgress;
  index?: number;
  onClick: () => void;
};

function TierPill({ tier, earned }: { tier: string; earned: boolean }) {
  const styles = TIER_PILL_STYLES[tier as keyof typeof TIER_PILL_STYLES] ?? TIER_PILL_STYLES.unique;
  const label = tier === "unique" ? "Unique" : tier === "secret" ? "Secret" : tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        !earned && "opacity-50 grayscale-[60%]"
      )}
      style={
        earned
          ? { background: styles.background, color: styles.color, textShadow: styles.textShadow }
          : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
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
  const rarity = Math.max(1, Math.min(95, ((badge.id.charCodeAt(0) * 7 + (badge.id.charCodeAt(1) ?? 0) * 3) % 20) + (badge.tier === "platinum" ? 2 : badge.tier === "gold" ? 8 : badge.tier === "silver" ? 18 : 34)));

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={reduced ? undefined : { y: -3 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left",
        "bg-[rgba(255,255,255,0.06)] backdrop-blur-xl",
        "border-[rgba(255,255,255,0.08)]",
        "cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
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
        <motion.span
          className="text-[48px] leading-none"
          animate={reduced ? undefined : { opacity: [0.85, 1, 0.85] }}
          transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {badge.icon}
        </motion.span>
        <TierPill tier={badge.tier} earned />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-amber-500">{badge.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-400">{badge.description}</p>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
        <span className="uppercase tracking-wider text-neutral-500">
          {badge.category}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 text-amber-500">
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            {badge.fpValue}
          </span>
          <span className="font-medium text-emerald-500">&#10003; Earned</span>
        </div>
      </div>

      <p className="mt-1.5 text-[10px] text-neutral-500 transition-opacity group-hover:opacity-80">
        Earned by {rarity}% of readers
      </p>
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

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={reduced ? undefined : { y: -1, opacity: 1 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left",
        "bg-[rgba(255,255,255,0.02)] backdrop-blur-md",
        "border-[rgba(255,255,255,0.04)]",
        "opacity-85 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
      )}
      style={{ transition: "opacity 150ms ease, transform 200ms ease" }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="relative">
          <span className="text-[48px] leading-none" style={{ filter: "grayscale(100%) opacity(0.4)" }}>
            {badge.icon}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/80 text-[10px]">
            <Lock className="h-3 w-3 text-neutral-500" />
          </span>
        </div>
        <TierPill tier={badge.tier} earned={false} />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-white">{badge.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{badge.description}</p>

      <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
        <span className="uppercase tracking-wider text-neutral-500">
          {badge.category}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 text-neutral-500">
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            {badge.fpValue}
          </span>
          <span className="text-neutral-500">{progressText}</span>
        </div>
      </div>

      {badge.current > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
          <div
            className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
            style={{ width: `${Math.max(4, badge.percentage)}%` }}
          />
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100">
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
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-4 text-left cursor-pointer",
        "bg-[rgba(255,255,255,0.015)]",
        "border border-dashed border-[rgba(255,255,255,0.06)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
      )}
      style={{ transition: "box-shadow 200ms ease" }}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="secret-badge-icon relative flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
          <span className="badge-shimmer text-xl text-neutral-500">?</span>
        </div>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-white">Hidden Achievement</h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-600">
        Discover through your reading journey
      </p>

      <div className="mt-3 text-[10px] uppercase tracking-wider text-neutral-600">
        Secret
      </div>
    </motion.button>
  );
}
