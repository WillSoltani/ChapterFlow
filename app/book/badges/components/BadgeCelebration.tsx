"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/app/book/components/ui/cn";
import type { BadgeWithProgress, BadgeTier } from "../lib/badge-types";
import { getBadgeRarity } from "../lib/badge-utils";

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
  const remainingBadges = sorted.slice(1);

  const [heroVisible, setHeroVisible] = useState(false);
  const [toasts, setToasts] = useState<BadgeWithProgress[]>([]);
  const [dismissed, setDismissed] = useState(false);

  // Show hero celebration
  useEffect(() => {
    if (!heroBadge || dismissed) return;

    if (reduced || heroLevel === "bronze") {
      // Show all as toasts
      setToasts(sorted);
      const timer = setTimeout(() => {
        setToasts([]);
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }

    // Show hero modal
    setHeroVisible(true);

    // Auto-dismiss bronze/unique hero after 5s
    if (heroLevel === "modal") {
      const timer = setTimeout(() => {
        handleDismissHero();
      }, 6000);
      return () => clearTimeout(timer);
    }
    // Epic celebrations require manual dismiss
  }, [heroBadge, dismissed, reduced]);

  function handleDismissHero() {
    setHeroVisible(false);

    // Show remaining as toasts (staggered) or summary
    if (remainingBadges.length > 0 && remainingBadges.length <= 3) {
      // Stagger toasts
      remainingBadges.forEach((badge, i) => {
        setTimeout(() => {
          setToasts((prev) => [...prev, badge]);
        }, i * 1500);
      });
      setTimeout(() => {
        setToasts([]);
        setDismissed(true);
        onDismiss();
      }, remainingBadges.length * 1500 + 4000);
    } else if (remainingBadges.length > 3) {
      // Summary toast
      setToasts([remainingBadges[0]!]); // Use first as placeholder for summary
      setTimeout(() => {
        setToasts([]);
        setDismissed(true);
        onDismiss();
      }, 4000);
    } else {
      setDismissed(true);
      onDismiss();
    }
  }

  if (newlyEarned.length === 0) return null;

  const summaryMode = remainingBadges.length > 3;

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed right-4 top-20 z-[60] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((badge, i) => (
            <motion.div
              key={badge.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="cursor-pointer overflow-hidden rounded-2xl border border-accent-amber/20 bg-(--cf-surface-muted) shadow-shadow-elevated"
              onClick={() => router.push("/book/badges")}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <motion.span
                  className="text-2xl"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  {badge.icon}
                </motion.span>
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--accent-amber)" }}>Achievement Unlocked</p>
                  <p className="text-sm font-semibold text-(--cf-text-1)">
                    {summaryMode && i === 0
                      ? `\u{1F389} You earned ${newlyEarned.length} new badges!`
                      : badge.name}
                  </p>
                </div>
              </div>
              {/* Auto-dismiss countdown bar */}
              <div className="h-0.5 w-full" style={{ background: "var(--cf-surface-strong)" }}>
                <motion.div
                  className="h-full"
                  style={{ background: "var(--accent-amber)" }}
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 5, ease: "linear" }}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Hero celebration modal */}
      <AnimatePresence>
        {heroVisible && heroBadge && !reduced && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className={cn(
                "absolute inset-0",
                heroLevel === "epic" ? "bg-(--cf-overlay)" : "bg-(--cf-overlay)"
              )}
              onClick={heroLevel === "epic" ? undefined : handleDismissHero}
            />

            <div className="relative z-10 flex flex-col items-center px-6 text-center">
              {/* Confetti for epic celebrations */}
              {heroLevel === "epic" && <ConfettiEffect />}

              {/* Shimmer overlay for modal celebrations */}
              {heroLevel === "modal" && <ShimmerOverlay />}

              <motion.span
                className={cn(
                  "leading-none",
                  heroLevel === "epic" ? "text-[120px]" : "text-[96px]"
                )}
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 12, bounce: 0.5 }}
              >
                {heroBadge.icon}
              </motion.span>

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
                Earned by {getBadgeRarity(heroBadge)}% of readers
                {heroLevel === "epic" ? " — legendary." : " — impressive!"}
              </motion.p>

              <motion.div
                className="mt-8 flex gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                {heroLevel === "epic" && (
                  <ShareButton badge={heroBadge} />
                )}
                <button
                  type="button"
                  onClick={() => onPinToShowcase(heroBadge.id)}
                  className="rounded-2xl border border-accent-amber/30 bg-accent-amber/10 px-5 py-2.5 text-sm font-medium text-accent-amber transition hover:bg-accent-amber/20"
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ShareButton({ badge }: { badge: BadgeWithProgress }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = `I just earned the "${badge.name}" badge on ChapterFlow! \u{1F3C6} ${badge.narrative || badge.description}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: `ChapterFlow: ${badge.name}`, text }); return; } catch { /* cancelled */ }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-5 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)"
    >
      {copied ? "Copied!" : "Share Achievement"}
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

  return <p className={className}>{displayed}</p>;
}

function ConfettiEffect() {
  const particles = useMemo(
    () =>
      Array.from({ length: 35 }).map((_, i) => ({
        id: i,
        x: 45 + Math.random() * 10, // Start near center
        delay: Math.random() * 0.8,
        duration: 2 + Math.random() * 1.5,
        size: 4 + Math.random() * 6,
        color: ["#f59e0b", "#ffd700", "#f97316", "#8b7dff", "#e5e4e2"][i % 5],
        angle: (i / 35) * 360,
        distance: 200 + Math.random() * 400,
        rotation: Math.random() * 720 - 360,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p) => {
        const radians = (p.angle * Math.PI) / 180;
        const endX = Math.cos(radians) * p.distance;
        const endY = Math.sin(radians) * p.distance + 300; // gravity pull

        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: `${p.x}%`,
              top: "45%",
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
              x: endX,
              y: endY,
              opacity: 0,
              scale: 1,
              rotate: p.rotation,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeOut",
            }}
          />
        );
      })}
    </div>
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
