"use client";

// Implements §4 Achievement Taxonomy display and §4.4 Hidden Track.
// Four-track layout: Mastery, Consistency, Exploration, Hidden.
// Hidden track shows only earned achievements — undiscovered ones are invisible.

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/app/book/components/ui/cn";
import type { AchievementTrack } from "@/app/book/badges/lib/achievement-definitions";
import {
  MASTERY_TRACK,
  CONSISTENCY_TRACK,
  EXPLORATION_TRACK,
  HIDDEN_TRACK,
  type AchievementDefinition,
} from "@/app/book/badges/lib/achievement-definitions";

// ── Types ───────────────────────────────────────────────────────────────────

type EarnedAchievement = {
  achievementId: string;
  earnedAt: string;
  ipAwarded: number;
};

type AchievementTrackDisplayProps = {
  earned: EarnedAchievement[];
};

// ── Track metadata ──────────────────────────────────────────────────────────

const TRACK_META: Record<AchievementTrack, { title: string; description: string; color: string }> = {
  mastery: {
    title: "Mastery",
    description: "Deep comprehension and willingness to challenge yourself",
    color: "var(--accent-cyan)",
  },
  consistency: {
    title: "Consistency",
    description: "Sustained engagement and habit formation",
    color: "var(--accent-amber)",
  },
  exploration: {
    title: "Exploration",
    description: "Intellectual breadth across categories",
    color: "var(--accent-emerald)",
  },
  hidden: {
    title: "Discoveries",
    description: "Revealed through natural behavior",
    color: "var(--accent-violet)",
  },
};

const TRACK_ORDER: AchievementTrack[] = ["mastery", "consistency", "exploration", "hidden"];

const TRACK_DEFINITIONS: Record<AchievementTrack, AchievementDefinition[]> = {
  mastery: MASTERY_TRACK,
  consistency: CONSISTENCY_TRACK,
  exploration: EXPLORATION_TRACK,
  hidden: HIDDEN_TRACK,
};

// ── Main Component ──────────────────────────────────────────────────────────

export function AchievementTrackDisplay({ earned }: AchievementTrackDisplayProps) {
  const [activeTrack, setActiveTrack] = useState<AchievementTrack>("mastery");
  const earnedSet = new Set(earned.map((e) => e.achievementId));
  const earnedMap = new Map(earned.map((e) => [e.achievementId, e]));

  const totalEarned = earned.length;
  const totalVisible = MASTERY_TRACK.length + CONSISTENCY_TRACK.length + EXPLORATION_TRACK.length;
  const hiddenEarned = earned.filter((e) => {
    const def = HIDDEN_TRACK.find((h) => h.id === e.achievementId);
    return !!def;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-(--cf-text-1)">Achievements</h2>
        <span className="text-sm tabular-nums text-(--cf-text-3)">
          {totalEarned} earned{hiddenEarned.length > 0 ? ` · ${hiddenEarned.length} discoveries` : ""}
        </span>
      </div>

      {/* Track tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--cf-surface-strong)" }}>
        {TRACK_ORDER.map((track) => {
          const meta = TRACK_META[track];
          const trackDefs = TRACK_DEFINITIONS[track];
          const trackEarned = trackDefs.filter((d) => earnedSet.has(d.id)).length;
          const isActive = activeTrack === track;

          return (
            <button
              key={track}
              type="button"
              onClick={() => setActiveTrack(track)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-(--cf-surface-muted) text-(--cf-text-1) shadow-sm"
                  : "text-(--cf-text-3) hover:text-(--cf-text-2)"
              )}
            >
              {meta.title}
              {track !== "hidden" && (
                <span className="ml-1 tabular-nums opacity-60">
                  {trackEarned}/{trackDefs.length}
                </span>
              )}
              {track === "hidden" && trackEarned > 0 && (
                <span className="ml-1 tabular-nums opacity-60">{trackEarned}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Track content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTrack}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <p className="mb-3 text-xs text-(--cf-text-soft)">
            {TRACK_META[activeTrack].description}
          </p>

          {activeTrack === "hidden" ? (
            <HiddenTrackList
              definitions={HIDDEN_TRACK}
              earnedSet={earnedSet}
              earnedMap={earnedMap}
            />
          ) : (
            <TrackList
              definitions={TRACK_DEFINITIONS[activeTrack]}
              earnedSet={earnedSet}
              earnedMap={earnedMap}
              trackColor={TRACK_META[activeTrack].color}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Regular track list ──────────────────────────────────────────────────────

function TrackList({
  definitions,
  earnedSet,
  earnedMap,
  trackColor,
}: {
  definitions: AchievementDefinition[];
  earnedSet: Set<string>;
  earnedMap: Map<string, EarnedAchievement>;
  trackColor: string;
}) {
  return (
    <div className="space-y-2">
      {definitions.map((def) => {
        const isEarned = earnedSet.has(def.id);
        const earnedData = earnedMap.get(def.id);

        return (
          <div
            key={def.id}
            className={cn(
              "rounded-xl border p-3 transition-colors",
              isEarned
                ? "border-transparent"
                : "border-(--cf-border-strong) opacity-60"
            )}
            style={{
              background: isEarned
                ? `color-mix(in srgb, ${trackColor} 8%, var(--cf-surface-muted))`
                : "var(--cf-surface-muted)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isEarned && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: trackColor }}
                  />
                )}
                <span className={cn("text-sm font-medium", isEarned ? "text-(--cf-text-1)" : "text-(--cf-text-2)")}>
                  {def.name}
                </span>
              </div>
              <span
                className="text-xs tabular-nums font-medium"
                style={{ color: isEarned ? trackColor : "var(--cf-text-soft)" }}
              >
                {def.ipValue} IP
              </span>
            </div>
            <p className="mt-1 text-xs text-(--cf-text-3)">{def.criteria}</p>
            {isEarned && earnedData && (
              <p className="mt-1 text-[11px] text-(--cf-text-soft)">
                Earned {new Date(earnedData.earnedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Hidden track list — §4.4: only shows earned achievements ────────────────

function HiddenTrackList({
  definitions,
  earnedSet,
  earnedMap,
}: {
  definitions: AchievementDefinition[];
  earnedSet: Set<string>;
  earnedMap: Map<string, EarnedAchievement>;
}) {
  const earnedHidden = definitions.filter((d) => earnedSet.has(d.id));

  if (earnedHidden.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-(--cf-border-strong) p-6 text-center"
        style={{ background: "var(--cf-surface-muted)" }}
      >
        <p className="text-sm text-(--cf-text-soft)">
          Some achievements reveal themselves only through discovery.
        </p>
        <p className="mt-1 text-xs text-(--cf-text-soft)">
          Keep reading — you might unlock something unexpected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {earnedHidden.map((def) => {
        const earnedData = earnedMap.get(def.id);

        return (
          <div
            key={def.id}
            className="rounded-xl border border-transparent p-3"
            style={{
              background: "color-mix(in srgb, var(--accent-violet) 8%, var(--cf-surface-muted))",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--accent-violet)" }}
                />
                <span className="text-sm font-medium text-(--cf-text-1)">{def.name}</span>
              </div>
              <span
                className="text-xs tabular-nums font-medium"
                style={{ color: "var(--accent-violet)" }}
              >
                {def.ipValue} IP
              </span>
            </div>
            <p className="mt-1 text-xs italic text-(--cf-text-2)">{def.celebrationCopy}</p>
            <p className="mt-1 text-xs text-(--cf-text-3)">{def.criteria}</p>
            {earnedData && (
              <p className="mt-1 text-[11px] text-(--cf-text-soft)">
                Discovered {new Date(earnedData.earnedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Hidden Achievement Discovery Celebration (§4.4) ─────────────────────────

export type HiddenAchievementCelebrationData = {
  name: string;
  celebrationCopy: string;
  ipAwarded: number;
};

type HiddenAchievementCelebrationProps = {
  data: HiddenAchievementCelebrationData | null;
  onDismiss: () => void;
};

export function HiddenAchievementCelebration({
  data,
  onDismiss,
}: HiddenAchievementCelebrationProps) {
  const reduced = useReducedMotion();

  if (!data) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-(--cf-overlay)" onClick={onDismiss} />

        <motion.div
          className="relative z-10 flex flex-col items-center rounded-3xl p-8 text-center shadow-shadow-elevated"
          style={{
            maxWidth: 400,
            background: "var(--cf-surface-muted)",
            border: "1px solid color-mix(in srgb, var(--accent-violet) 30%, transparent)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
          initial={reduced ? {} : { scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {/* Violet shimmer border — §4.4 */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background: "linear-gradient(135deg, transparent 30%, color-mix(in srgb, var(--accent-violet) 12%, transparent) 50%, transparent 70%)",
            }}
            initial={reduced ? {} : { x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 1.5, delay: 0.2, ease: "easeInOut" }}
          />

          {/* "Discovery unlocked:" prefix — §4.4 */}
          <motion.p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--accent-violet)" }}
            initial={reduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Discovery unlocked
          </motion.p>

          <motion.h2
            className="mt-3 text-xl font-semibold text-(--cf-text-1)"
            initial={reduced ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {data.name}
          </motion.h2>

          <motion.p
            className="mt-3 max-w-sm text-sm italic leading-relaxed text-(--cf-text-2)"
            initial={reduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {data.celebrationCopy}
          </motion.p>

          <motion.p
            className="mt-3 text-sm tabular-nums font-medium"
            style={{ color: "var(--accent-violet)" }}
            initial={reduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            +{data.ipAwarded} Insight Points
          </motion.p>

          <motion.button
            type="button"
            onClick={onDismiss}
            className="mt-6 rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-6 py-2.5 text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-strong)"
            initial={reduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Continue
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
