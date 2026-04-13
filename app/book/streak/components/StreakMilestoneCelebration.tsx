"use client";

// Implements §2.4 — Streak milestone celebrations.
// Follows the same celebration patterns as BadgeCelebration.tsx (toast/modal/epic tiers).

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Share2, Check } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { buildShareCardUrl, buildShareText, performShare } from "@/app/book/_lib/share-card-url";

// ── Milestone copy from §2.4 (exact strings from spec) ─────────────────────

const MILESTONE_COPY: Record<number, { copy: string; style: CelebrationStyle }> = {
  3: {
    copy: "Three days of learning. This is where habits begin.",
    style: "toast",
  },
  7: {
    copy: "One full week. You chose to learn seven days in a row — that puts you ahead of most people who start.",
    style: "expanded-toast",
  },
  14: {
    copy: "Two weeks of sustained curiosity. The research says you're 3.6× more likely to keep going now.",
    style: "modal",
  },
  30: {
    copy: "Thirty days. This isn't a streak anymore — it's who you are.",
    style: "modal-confetti",
  },
  60: {
    copy: "Sixty days of deliberate learning. You've built something most people only talk about.",
    style: "modal-confetti",
  },
  100: {
    copy: "Triple digits. One hundred days of choosing to grow. This is rare and remarkable.",
    style: "fullscreen",
  },
  200: {
    copy: "Two hundred days. At this point, the habit carries you — not the other way around.",
    style: "fullscreen",
  },
  365: {
    copy: "One year of daily learning. Three hundred and sixty-five decisions to be curious. This is extraordinary.",
    style: "fullscreen",
  },
};

type CelebrationStyle =
  | "toast"
  | "expanded-toast"
  | "modal"
  | "modal-confetti"
  | "fullscreen";

export type StreakMilestoneData = {
  days: number;
  ip: number;
  currentStreak: number;
  consistencyScore?: number;
};

type StreakMilestoneCelebrationProps = {
  milestones: StreakMilestoneData[];
  onDismiss: () => void;
};

export function StreakMilestoneCelebration({
  milestones,
  onDismiss,
}: StreakMilestoneCelebrationProps) {
  const reduced = useReducedMotion();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  const current = milestones[currentIdx];
  if (!current || !visible) return null;

  const meta = MILESTONE_COPY[current.days];
  if (!meta) {
    // Unknown milestone — auto-dismiss
    if (currentIdx < milestones.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      onDismiss();
    }
    return null;
  }

  const isToast = meta.style === "toast" || meta.style === "expanded-toast";
  const isModal = meta.style === "modal" || meta.style === "modal-confetti";
  const isFullscreen = meta.style === "fullscreen";
  const hasConfetti = meta.style === "modal-confetti" || meta.style === "fullscreen";

  function handleNext() {
    if (currentIdx < milestones.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      setVisible(false);
      onDismiss();
    }
  }

  // Auto-dismiss toasts after 5s
  useEffect(() => {
    if (isToast) {
      const timer = setTimeout(handleNext, 5000);
      return () => clearTimeout(timer);
    }
    if (isModal && !hasConfetti) {
      const timer = setTimeout(handleNext, 6000);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, isToast, isModal, hasConfetti]);

  if (reduced) {
    return <ReducedMotionFallback milestone={current} meta={meta} onDismiss={handleNext} />;
  }

  // ── Toast display ──────────────────────────────────────────────────────
  if (isToast) {
    return (
      <div className="fixed right-4 top-20 z-[60] flex flex-col gap-2">
        <AnimatePresence>
          <motion.div
            key={current.days}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="cursor-pointer overflow-hidden rounded-2xl border border-accent-amber/20 bg-(--cf-surface-muted) shadow-shadow-elevated"
            style={{ maxWidth: 360 }}
            onClick={handleNext}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <motion.span
                className="text-2xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                🔥
              </motion.span>
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--accent-amber)" }}>
                  {current.days}-Day Streak
                </p>
                <p className="text-sm leading-relaxed text-(--cf-text-2)">
                  {meta.copy}
                </p>
                <p className="mt-1 text-xs tabular-nums" style={{ color: "var(--accent-violet)" }}>
                  +{current.ip} IP
                </p>
              </div>
            </div>
            {/* Auto-dismiss countdown */}
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
        </AnimatePresence>
      </div>
    );
  }

  // ── Modal / Fullscreen display ─────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-(--cf-overlay)"
          onClick={isFullscreen ? undefined : handleNext}
        />

        <div className="relative z-10 flex flex-col items-center px-6 text-center">
          {/* Confetti for modal-confetti and fullscreen */}
          {hasConfetti && <ConfettiParticles />}

          {/* Flame icon with scale animation */}
          <motion.div
            className={cn(
              "flex items-center justify-center rounded-full",
              isFullscreen
                ? "h-28 w-28 text-[72px]"
                : "h-20 w-20 text-[56px]"
            )}
            style={{
              background: "color-mix(in srgb, var(--accent-amber) 15%, transparent)",
            }}
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
          >
            🔥
          </motion.div>

          {/* Day count */}
          <motion.div
            className="mt-4 flex items-baseline gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span
              className={cn(
                "font-bold tabular-nums",
                isFullscreen ? "text-5xl" : "text-4xl"
              )}
              style={{ color: "var(--accent-amber)" }}
            >
              {current.days}
            </span>
            <span className="text-lg font-medium text-(--cf-text-2)">day streak</span>
          </motion.div>

          {/* Celebration copy — exact strings from §2.4 */}
          <motion.p
            className="mt-4 max-w-md text-sm italic leading-relaxed text-(--cf-text-2)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {meta.copy}
          </motion.p>

          {/* Consistency score (§2.3 enrichment) */}
          {current.consistencyScore != null && current.consistencyScore > 0 && (
            <motion.p
              className="mt-2 text-xs text-(--cf-text-soft)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              30-day consistency: {current.consistencyScore}%
            </motion.p>
          )}

          {/* IP award */}
          <motion.p
            className="mt-3 text-sm tabular-nums font-medium"
            style={{ color: "var(--accent-violet)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            +{current.ip} Insight Points
          </motion.p>

          {/* Action buttons */}
          <motion.div
            className="mt-8 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {hasConfetti && <StreakShareButton days={current.days} />}
            <button
              type="button"
              onClick={handleNext}
              className="rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-6 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)"
            >
              {currentIdx < milestones.length - 1 ? "Next" : "Continue"}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Streak Share Button ─────────────────────────────────────────────────

function StreakShareButton({ days }: { days: number }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const { identity } = useBookViewer();

  async function handleShare() {
    const params = { type: "streak" as const, streakDays: days, userName: identity.displayName };
    const result = await performShare({
      title: `${days}-Day Reading Streak`,
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
      {feedback ?? "Share Milestone"}
    </button>
  );
}

// ── Reduced Motion Fallback ──────────────────────────────────────────────

function ReducedMotionFallback({
  milestone,
  meta,
  onDismiss,
}: {
  milestone: StreakMilestoneData;
  meta: { copy: string };
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed right-4 top-20 z-[60]">
      <div
        className="cursor-pointer rounded-2xl border border-accent-amber/20 bg-(--cf-surface-muted) px-4 py-3 shadow-shadow-elevated"
        style={{ maxWidth: 360 }}
        onClick={onDismiss}
      >
        <p className="text-xs font-medium" style={{ color: "var(--accent-amber)" }}>
          🔥 {milestone.days}-Day Streak
        </p>
        <p className="mt-1 text-sm leading-relaxed text-(--cf-text-2)">{meta.copy}</p>
        <p className="mt-1 text-xs tabular-nums" style={{ color: "var(--accent-violet)" }}>
          +{milestone.ip} IP
        </p>
      </div>
    </div>
  );
}

// ── Simple confetti particles (reuses pattern from CanvasConfetti) ────────

function ConfettiParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${-5 - Math.random() * 10}%`,
            background: ["var(--accent-amber)", "var(--accent-cyan)", "var(--accent-emerald)", "var(--accent-violet)"][i % 4],
          }}
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={{
            y: `${300 + Math.random() * 200}%`,
            opacity: 0,
            scale: 0.3,
            rotate: Math.random() * 720,
          }}
          transition={{
            duration: 2 + Math.random() * 1.5,
            delay: Math.random() * 0.5,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
