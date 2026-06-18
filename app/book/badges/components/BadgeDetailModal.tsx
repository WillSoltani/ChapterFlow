"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { X, Share2, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/app/book/components/ui/cn";
import { Dialog } from "@/components/ui/Dialog";
import type { BadgeWithProgress } from "../lib/badge-types";
import { METALLIC_GRADIENTS } from "./BadgeCard";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { buildShareCardUrl, buildShareText, performShare } from "@/app/book/_lib/share-card-url";

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

  // Clear share confirmation when badge changes
  useEffect(() => setShareText(null), [badge?.id]);

  const { identity } = useBookViewer();

  async function handleShare(b: BadgeWithProgress) {
    const params = { type: "badge" as const, badgeName: b.name, userName: identity.displayName };
    const result = await performShare({
      title: `ChapterFlow Achievement: ${b.name}`,
      text: buildShareText(params),
      url: buildShareCardUrl(params),
    });
    if (result === "copied" || result === "shared") {
      setShareText(result === "copied" ? "Copied!" : "Shared!");
      setTimeout(() => setShareText(null), 2000);
    }
  }

  const ariaLabel = badge
    ? badge.isSecret && !badge.isDiscovered
      ? "Hidden achievement"
      : `${badge.name} — badge details`
    : "Badge details";

  return (
    <Dialog open={Boolean(badge)} onClose={onClose} ariaLabel={ariaLabel} size="md">
      {badge && (
        <div className="relative p-6">
          <button
            type="button"
            onClick={onClose}
            className="cf-pressable absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) transition hover:text-(--cf-text-1)"
            aria-label="Close"
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
        </div>
      )}
    </Dialog>
  );
}

function SecretModalContent() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="secret-badge-icon flex h-24 w-24 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted)">
        <span className="badge-shimmer text-4xl text-(--cf-text-soft)">?</span>
      </div>
      <TierPillDisplay tier="secret" earned={false} className="mt-4" />
      <h3 className="mt-4 text-xl font-semibold text-(--cf-text-1)">Hidden Achievement</h3>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-(--cf-text-3)">
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
  const isPinned = showcaseBadgeIds.includes(badge.id);
  const showcaseFull = showcaseBadgeIds.length >= 5 && !isPinned;

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

      <h3 className="mt-4 text-2xl font-semibold" style={{ color: "var(--accent-amber)" }}>{badge.name}</h3>

      <p className="mt-3 max-w-sm text-sm italic leading-relaxed text-(--cf-text-2)">
        {badge.narrative}
      </p>

      <div className="mt-5 h-px w-full bg-(--cf-divider)" />

      <div className="mt-5 w-full space-y-4 text-left">
        <DetailRow label="Criteria" value={badge.criteria.description} />

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

        <DetailRow label="Part of" value={`${badge.category} collection`} />
      </div>

      <div className="mt-6 flex w-full gap-3">
        <button
          type="button"
          onClick={() => !showcaseFull && onToggleShowcase(badge.id)}
          disabled={showcaseFull}
          title={showcaseFull ? "Unpin a badge to make room" : undefined}
          className={cn(
            "flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
            !showcaseFull && "cf-pressable",
            showcaseFull
              ? "cursor-not-allowed border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
              : isPinned
                ? "border-(--cf-border) text-(--cf-text-2) hover:bg-(--cf-surface-strong)"
                : "border-(--cf-border) text-(--cf-text-2) hover:bg-(--cf-surface-strong)"
          )}
          style={
            !showcaseFull && isPinned
              ? { borderColor: "var(--cf-accent-border)", background: "var(--cf-accent-soft)", color: "var(--cf-accent)" }
              : undefined
          }
        >
          {showcaseFull ? "Showcase Full" : isPinned ? "Unpin from Showcase" : "Pin to Showcase"}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="cf-pressable inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)"
        >
          {shareText ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
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

  const ctaHref =
    badge.category === "Books" || badge.category === "Exploration" || badge.category === "Examples"
      ? "/book/library"
      : "/dashboard";

  return (
    <div className="flex flex-col items-center text-center">
      <motion.span
        className="text-[96px] leading-none"
        initial={!reduced ? { scale: 0.95, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DUR.normal }}
        style={{ filter: "grayscale(100%) opacity(0.4)" }}
      >
        {badge.icon}
      </motion.span>

      <TierPillDisplay tier={badge.tier} earned={false} className="mt-4" />

      <h3 className="mt-4 text-2xl font-semibold text-(--cf-text-1)">{badge.name}</h3>

      <p className="mt-3 max-w-sm text-sm leading-relaxed text-(--cf-text-3)">
        {badge.description}
      </p>

      <div className="mt-5 h-px w-full bg-(--cf-divider)" />

      <div className="mt-5 w-full space-y-4 text-left">
        <DetailRow label="Criteria" value={badge.criteria.description} />

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-(--cf-text-soft)">Progress</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-(--cf-surface-strong)">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(4, badge.percentage)}%`, background: "var(--accent-amber)" }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-(--cf-text-2)">
              {badge.current > 0
                ? `${badge.current} of ${badge.target} (${badge.percentage}%)`
                : "Not yet started"}
            </span>
            {remaining > 0 && badge.current > 0 && (
              <span className="text-(--cf-text-soft)">
                {remaining} more to go
              </span>
            )}
          </div>
        </div>

        <DetailRow label="Part of" value={`${badge.category} collection`} />
      </div>

      <div className="mt-6 w-full">
        <Link
          href={ctaHref}
          className="cf-pressable block w-full rounded-2xl border px-4 py-2.5 text-center text-sm font-medium transition"
          style={{
            borderColor: "var(--cf-accent-border)",
            background: "var(--cf-accent-soft)",
            color: "var(--cf-accent)",
          }}
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
      <p className="text-[11px] uppercase tracking-[0.2em] text-(--cf-text-soft)">{label}</p>
      <p className="mt-1 text-sm text-(--cf-text-2)">{value}</p>
    </div>
  );
}

function TierPillDisplay({ tier, earned, className }: { tier: string; earned: boolean; className?: string }) {
  const label = tier === "unique" ? "Unique" : tier === "secret" ? "Secret" : tier.charAt(0).toUpperCase() + tier.slice(1);
  const gradient = METALLIC_GRADIENTS[tier] ?? METALLIC_GRADIENTS.unique;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
        !earned && "opacity-50 grayscale-60",
        className
      )}
      style={
        earned
          ? {
              background: gradient,
              color: tier === "platinum" || tier === "silver" ? "#1a1a2e" : tier === "unique" || tier === "secret" ? "#ffffff" : "#1a0f00",
              textShadow: tier === "platinum" ? "0 1px 0 rgba(255,255,255,0.4)" : "none",
            }
          : { background: "var(--cf-surface-strong)", color: "var(--cf-text-soft)" }
      }
    >
      {label}
    </span>
  );
}
