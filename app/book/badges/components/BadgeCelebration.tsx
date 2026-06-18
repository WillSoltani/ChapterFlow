"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/app/book/components/ui/cn";
import { Dialog } from "@/components/ui/Dialog";
import { Confetti } from "@/components/ui/Confetti";
import type { BadgeWithProgress, BadgeTier } from "../lib/badge-types";
import { Share2, Check, Trophy, Medal, Award, Star, Sparkles, Flame, type LucideIcon } from "lucide-react";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { buildShareCardUrl, buildShareText, performShare } from "@/app/book/_lib/share-card-url";

type BadgeCelebrationProps = {
  newlyEarned: BadgeWithProgress[];
  onDismiss: () => void;
  onPinToShowcase: (badgeId: string) => void;
};

const TIER_PRIORITY: Record<BadgeTier, number> = {
  platinum: 6,
  secret: 5,
  gold: 4,
  silver: 3,
  unique: 2,
  bronze: 1,
};

type CelebrationLevel = "bronze" | "modal" | "epic";

function getCelebrationLevel(tier: BadgeTier): CelebrationLevel {
  if (tier === "platinum" || tier === "secret") return "epic";
  if (tier === "silver" || tier === "gold") return "modal";
  return "bronze";
}

// Crafted lucide/gold marks instead of OS emoji for the celebration moment, so
// reader / dashboard / onboarding / badges speak one visual language and the
// "win" reads on the gold channel (--accent-gold). The badge's own `icon` emoji
// is unchanged everywhere else (cards, timeline, detail) — this is celebration
// presentation only.
const TIER_ICON: Record<BadgeTier, LucideIcon> = {
  bronze: Medal,
  silver: Award,
  gold: Trophy,
  platinum: Star,
  unique: Sparkles,
  secret: Flame,
};

function TierMark({ tier, className }: { tier: BadgeTier; className?: string }) {
  const Icon = TIER_ICON[tier] ?? Trophy;
  return (
    <Icon
      className={className}
      style={{ color: "var(--accent-gold)" }}
      strokeWidth={2.25}
      aria-hidden="true"
    />
  );
}

export function BadgeCelebration({
  newlyEarned,
  onDismiss,
  onPinToShowcase,
}: BadgeCelebrationProps) {
  const reduced = useReducedMotion();
  const router = useRouter();

  // Sort by tier priority descending
  const sorted = useMemo(
    () =>
      [...newlyEarned].sort(
        (a, b) => (TIER_PRIORITY[b.tier] ?? 0) - (TIER_PRIORITY[a.tier] ?? 0)
      ),
    [newlyEarned]
  );

  // First badge gets full celebration, rest become toasts
  const heroBadge = sorted[0] ?? null;
  const heroLevel = heroBadge ? getCelebrationLevel(heroBadge.tier) : "bronze";
  const remainingBadges = useMemo(() => sorted.slice(1), [sorted]);

  const [heroVisible, setHeroVisible] = useState(false);
  const [toasts, setToasts] = useState<BadgeWithProgress[]>([]);
  const [dismissed, setDismissed] = useState(false);

  // Track every pending setTimeout so we can clear them on unmount / re-run and
  // avoid setState-after-unmount and replayed/late toasts during rapid bursts.
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = useCallback(() => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
  }, []);

  const handleDismissHero = useCallback(() => {
    setHeroVisible(false);

    // Cancel any in-flight staggered toasts before scheduling new ones.
    clearTimeouts();

    // Show remaining as toasts (staggered) or summary
    if (remainingBadges.length > 0 && remainingBadges.length <= 3) {
      // Stagger toasts
      remainingBadges.forEach((badge, i) => {
        schedule(() => {
          setToasts((prev) => [...prev, badge]);
        }, i * 1500);
      });
      schedule(() => {
        setToasts([]);
        setDismissed(true);
        onDismiss();
      }, remainingBadges.length * 1500 + 4000);
    } else if (remainingBadges.length > 3) {
      // Summary toast
      setToasts([remainingBadges[0]!]); // Use first as placeholder for summary
      schedule(() => {
        setToasts([]);
        setDismissed(true);
        onDismiss();
      }, 4000);
    } else {
      setDismissed(true);
      onDismiss();
    }
  }, [remainingBadges, onDismiss, clearTimeouts, schedule]);

  // Show hero celebration
  useEffect(() => {
    if (!heroBadge || dismissed) return;

    if (reduced || heroLevel === "bronze") {
      // Show all as toasts
      setToasts(sorted);
      schedule(() => {
        setToasts([]);
        onDismiss();
      }, 5000);
      return clearTimeouts;
    }

    // Show hero modal
    setHeroVisible(true);

    // Auto-dismiss bronze/unique hero after 5s
    if (heroLevel === "modal") {
      schedule(() => {
        handleDismissHero();
      }, 6000);
      return clearTimeouts;
    }
    // Epic celebrations require manual dismiss
    return clearTimeouts;
  }, [
    heroBadge,
    dismissed,
    reduced,
    heroLevel,
    sorted,
    onDismiss,
    handleDismissHero,
    schedule,
    clearTimeouts,
  ]);

  if (newlyEarned.length === 0) return null;

  const summaryMode = remainingBadges.length > 3;

  return (
    <>
      {/* Toast notifications */}
      <div
        className="fixed right-4 top-20 z-[60] flex flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence>
          {toasts.map((badge, i) => (
            <motion.button
              key={badge.id}
              type="button"
              aria-label={
                summaryMode && i === 0
                  ? `You earned ${newlyEarned.length} new badges`
                  : `Achievement unlocked: ${badge.name}`
              }
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="cursor-pointer overflow-hidden rounded-2xl border border-(--cf-gold-border) bg-(--cf-surface-muted) text-left shadow-shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
              onClick={() => router.push("/book/badges")}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <motion.span
                  className="flex items-center justify-center text-(--accent-gold)"
                  aria-hidden="true"
                  initial={reduced ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <TierMark tier={badge.tier} className="h-6 w-6" />
                </motion.span>
                <div>
                  <p className="text-xs font-medium text-(--cf-text-soft)">Achievement Unlocked</p>
                  <p className="text-sm font-semibold text-(--cf-text-1)">
                    {summaryMode && i === 0
                      ? `You earned ${newlyEarned.length} new badges!`
                      : badge.name}
                  </p>
                </div>
              </div>
              {/* Auto-dismiss countdown bar */}
              <div className="h-0.5 w-full" style={{ background: "var(--cf-surface-strong)" }}>
                <motion.div
                  className="h-full"
                  style={{ background: "var(--accent-gold)" }}
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 5, ease: "linear" }}
                />
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* One fire-once, gold-tilted burst behind the celebration (epic only).
          Gold = the win; tokens resolve per-theme inside Confetti. */}
      {heroVisible && heroBadge && !reduced && heroLevel === "epic" && (
        <Confetti
          trigger
          origin="center"
          particleCount={120}
          zIndex={101}
          colors={["--accent-gold", "--cf-gold-border"]}
        />
      )}

      {/* Hero celebration modal — Wave-0 Dialog (role=dialog, aria-modal, focus
          trap, Escape, focus restore). Epic ignores backdrop clicks so a stray
          tap doesn't end the moment, but Escape and Continue both dismiss it. */}
      <Dialog
        open={heroVisible && Boolean(heroBadge) && !reduced}
        onClose={handleDismissHero}
        ariaLabel={heroBadge ? `Achievement unlocked: ${heroBadge.name}` : "Achievement unlocked"}
        size="lg"
        closeOnBackdrop={heroLevel !== "epic"}
      >
        {heroBadge && (
          <div className="relative flex flex-col items-center px-6 py-10 text-center">
            {heroLevel === "modal" && <ShimmerOverlay />}

            <motion.div
              aria-hidden="true"
              className="flex items-center justify-center rounded-full"
              style={{
                width: heroLevel === "epic" ? 88 : 72,
                height: heroLevel === "epic" ? 88 : 72,
                background: "color-mix(in srgb, var(--accent-gold) 14%, transparent)",
                border: "2px solid color-mix(in srgb, var(--accent-gold) 40%, transparent)",
              }}
              initial={reduced ? false : { scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <TierMark
                tier={heroBadge.tier}
                className={cn(heroLevel === "epic" ? "h-11 w-11" : "h-9 w-9")}
              />
            </motion.div>

            <motion.h2
              className="mt-6 text-2xl font-semibold text-(--cf-text-1)"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {heroBadge.name}
            </motion.h2>

            {heroLevel === "epic" ? (
              <TypewriterText
                text={heroBadge.narrative}
                className="mt-4 max-w-md text-sm italic leading-relaxed text-(--cf-text-2)"
              />
            ) : (
              <motion.p
                className="mt-4 max-w-md text-sm italic leading-relaxed text-(--cf-text-2)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {heroBadge.narrative}
              </motion.p>
            )}

            <motion.p
              className="mt-3 text-sm text-(--cf-text-soft)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {heroLevel === "epic" ? "A rare achievement — legendary." : "Well earned — impressive!"}
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {heroLevel === "epic" && <ShareButton badge={heroBadge} />}
              <button
                type="button"
                onClick={() => onPinToShowcase(heroBadge.id)}
                className="rounded-2xl border border-(--cf-gold-border) bg-(--cf-gold-soft) px-5 py-2.5 text-sm font-medium text-(--cf-text-1) transition hover:bg-[color-mix(in_srgb,var(--accent-gold)_18%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
              >
                Pin to Showcase
              </button>
              <button
                type="button"
                onClick={handleDismissHero}
                className="rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-5 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)"
              >
                Continue
              </button>
            </motion.div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function ShareButton({ badge }: { badge: BadgeWithProgress }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const { identity } = useBookViewer();

  async function handleShare() {
    const params = { type: "badge" as const, badgeName: badge.name, userName: identity.displayName };
    const result = await performShare({
      title: `ChapterFlow: ${badge.name}`,
      text: buildShareText(params),
      url: buildShareCardUrl(params),
    });
    if (result === "copied" || result === "shared") {
      setFeedback(result === "copied" ? "Copied!" : "Shared!");
      setTimeout(() => setFeedback(null), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-5 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)"
    >
      {feedback ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {feedback ?? "Share Achievement"}
    </button>
  );
}

function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState("");
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplayed(text);
      return;
    }
    let i = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [text, reduced]);

  // The visible text types out, but the full narrative is always in the a11y
  // tree (sr-only) so a screen reader opening the Dialog reads the whole story,
  // not a half-typed fragment. (WCAG 1.1.1 / 4.1.3.)
  return (
    <p className={className}>
      <span aria-hidden="true">{reduced ? text : displayed}</span>
      <span className="sr-only">{text}</span>
    </p>
  );
}

function ShimmerOverlay() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, rgba(255,215,0,0.04) 45%, rgba(255,215,0,0.04) 50%, transparent 55%)",
          backgroundSize: "200% 100%",
          animation: "badge-shimmer 1.5s ease-in-out forwards",
        }}
      />
    </motion.div>
  );
}
