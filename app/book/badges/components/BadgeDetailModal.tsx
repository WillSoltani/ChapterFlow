"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/app/book/components/ui/cn";
import type { BadgeWithProgress } from "../lib/badge-types";
import { TIER_PILL_STYLES, TIER_BORDER_COLORS, getBadgeRarity } from "../lib/badge-utils";

type BadgeDetailModalProps = {
  badge: BadgeWithProgress | null;
  onClose: () => void;
  showcaseBadgeIds: string[];
  onToggleShowcase: (badgeId: string) => void;
};

export function BadgeDetailModal({
  badge,
  onClose,
  showcaseBadgeIds,
  onToggleShowcase,
}: BadgeDetailModalProps) {
  const reduced = useReducedMotion();
  const [shareText, setShareText] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!badge) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [badge, handleKeyDown]);

  // Clear share confirmation when badge changes
  useEffect(() => setShareText(null), [badge?.id]);

  async function handleShare(b: BadgeWithProgress) {
    const text = `I just earned the "${b.name}" badge on ChapterFlow! \u{1F3C6} ${b.narrative || b.description}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `ChapterFlow Achievement: ${b.name}`,
          text,
          url: typeof window !== "undefined" ? window.location.href : "",
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setShareText("Copied!");
      setTimeout(() => setShareText(null), 2000);
    }
  }

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            className={cn(
              "relative z-10 w-full max-w-[480px] overflow-y-auto rounded-t-3xl border border-[rgba(255,255,255,0.08)] bg-[#12121A] p-6 shadow-2xl",
              "md:max-h-[85vh] md:rounded-3xl"
            )}
            initial={reduced ? { opacity: 0 } : { y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ maxHeight: "90vh" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.05)] text-neutral-400 transition hover:text-white"
              aria-label="Close"
              autoFocus
            >
              <X className="h-4 w-4" />
            </button>

            {badge.isSecret && !badge.isDiscovered ? (
              <SecretModalContent />
            ) : badge.isEarned ? (
              <EarnedModalContent
                badge={badge}
                reduced={Boolean(reduced)}
                showcaseBadgeIds={showcaseBadgeIds}
                onToggleShowcase={onToggleShowcase}
                onShare={() => handleShare(badge)}
                shareText={shareText}
              />
            ) : (
              <LockedModalContent badge={badge} reduced={Boolean(reduced)} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SecretModalContent() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="secret-badge-icon flex h-24 w-24 items-center justify-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
        <span className="badge-shimmer text-4xl text-neutral-500">?</span>
      </div>
      <TierPillDisplay tier="secret" earned={false} className="mt-4" />
      <h3 className="mt-4 text-xl font-semibold text-white">Hidden Achievement</h3>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-400">
        This badge reveals itself through your natural reading behavior. No hints — just keep reading.
      </p>
    </div>
  );
}

function EarnedModalContent({
  badge,
  reduced,
  showcaseBadgeIds,
  onToggleShowcase,
  onShare,
  shareText,
}: {
  badge: BadgeWithProgress;
  reduced: boolean;
  showcaseBadgeIds: string[];
  onToggleShowcase: (badgeId: string) => void;
  onShare: () => void;
  shareText: string | null;
}) {
  const rarity = getBadgeRarity(badge);
  const isPinned = showcaseBadgeIds.includes(badge.id);
  const showcaseFull = showcaseBadgeIds.length >= 5 && !isPinned;

  const categoryLabel =
    badge.category === "consistency" ? "Consistency & Streaks" :
    badge.category === "mastery" ? "Mastery & Depth" :
    badge.category === "books" ? "Books & Completion" :
    badge.category === "exploration" ? "Exploration & Discovery" :
    badge.category === "notes" ? "Notes & Reflection" :
    "Hidden Achievements";

  return (
    <div className="flex flex-col items-center text-center">
      <motion.span
        className="text-[96px] leading-none"
        initial={!reduced ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        {badge.icon}
      </motion.span>

      <TierPillDisplay tier={badge.tier} earned className="mt-4" />

      <h3 className="mt-4 text-2xl font-semibold text-amber-500">{badge.name}</h3>

      <p className="mt-3 max-w-sm text-sm italic leading-relaxed text-neutral-300">
        {badge.narrative}
      </p>

      <div className="mt-5 h-px w-full bg-[rgba(255,255,255,0.06)]" />

      <div className="mt-5 w-full space-y-4 text-left">
        <DetailRow label="Criteria" value={badge.criteria.description} />

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Rarity</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-full bg-amber-500/60"
                style={{ width: `${rarity}%` }}
              />
            </div>
            <span className="shrink-0 text-sm text-neutral-400">
              Earned by {rarity}% of readers
            </span>
          </div>
        </div>

        {badge.earnedDate && (
          <DetailRow
            label="Unlocked on"
            value={new Date(badge.earnedDate).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          />
        )}

        <DetailRow label="Part of" value={`${categoryLabel} collection`} />
      </div>

      <div className="mt-6 flex w-full gap-3">
        <button
          type="button"
          onClick={() => !showcaseFull && onToggleShowcase(badge.id)}
          disabled={showcaseFull}
          title={showcaseFull ? "Unpin a badge to make room" : undefined}
          className={cn(
            "flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
            showcaseFull
              ? "cursor-not-allowed border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] text-neutral-600"
              : isPinned
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] text-neutral-300 hover:bg-[rgba(255,255,255,0.08)]"
          )}
        >
          {showcaseFull ? "Showcase Full" : isPinned ? "Unpin from Showcase" : "Pin to Showcase"}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex-1 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-[rgba(255,255,255,0.08)]"
        >
          {shareText ?? "Share Achievement"}
        </button>
      </div>
    </div>
  );
}

function LockedModalContent({
  badge,
  reduced,
}: {
  badge: BadgeWithProgress;
  reduced: boolean;
}) {
  const remaining = badge.target - badge.current;

  const categoryLabel =
    badge.category === "consistency" ? "Consistency & Streaks" :
    badge.category === "mastery" ? "Mastery & Depth" :
    badge.category === "books" ? "Books & Completion" :
    badge.category === "exploration" ? "Exploration & Discovery" :
    badge.category === "notes" ? "Notes & Reflection" :
    "Hidden Achievements";

  const ctaHref =
    badge.category === "consistency" || badge.category === "mastery" || badge.category === "notes"
      ? "/book/workspace"
      : "/book/library";

  return (
    <div className="flex flex-col items-center text-center">
      <motion.span
        className="text-[96px] leading-none"
        initial={!reduced ? { scale: 0.95, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{ filter: "grayscale(100%) opacity(0.4)" }}
      >
        {badge.icon}
      </motion.span>

      <TierPillDisplay tier={badge.tier} earned={false} className="mt-4" />

      <h3 className="mt-4 text-2xl font-semibold text-white">{badge.name}</h3>

      <p className="mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">
        {badge.description}
      </p>

      <div className="mt-5 h-px w-full bg-[rgba(255,255,255,0.06)]" />

      <div className="mt-5 w-full space-y-4 text-left">
        <DetailRow label="Criteria" value={badge.criteria.description} />

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Progress</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
              style={{ width: `${Math.max(4, badge.percentage)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-neutral-300">
              {badge.current > 0
                ? `${badge.current} of ${badge.target} (${badge.percentage}%)`
                : "Not yet started"}
            </span>
            {remaining > 0 && badge.current > 0 && (
              <span className="text-neutral-500">
                {remaining} more to go
              </span>
            )}
          </div>
        </div>

        <DetailRow label="Part of" value={`${categoryLabel} collection`} />
      </div>

      <div className="mt-6 w-full">
        <Link
          href={ctaHref}
          className="block w-full rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-center text-sm font-medium text-amber-500 transition hover:bg-amber-500/15"
        >
          Continue Reading &rarr;
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm text-neutral-300">{value}</p>
    </div>
  );
}

function TierPillDisplay({ tier, earned, className }: { tier: string; earned: boolean; className?: string }) {
  const styles = TIER_PILL_STYLES[tier as keyof typeof TIER_PILL_STYLES] ?? TIER_PILL_STYLES.unique;
  const label = tier === "unique" ? "Unique" : tier === "secret" ? "Secret" : tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
        !earned && "opacity-50 grayscale-60",
        className
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
