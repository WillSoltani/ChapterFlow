"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";
import type { BadgeCategoryGroup, BadgeWithProgress } from "../lib/badge-types";
import { BadgeCard } from "./BadgeCard";

type BadgeCategorySectionProps = {
  group: BadgeCategoryGroup;
  defaultOpen?: boolean;
  onBadgeClick: (badge: BadgeWithProgress) => void;
};

function getCategoryPillContent(group: BadgeCategoryGroup): { text: string; tone: "earned" | "progress" | "discover" | "secret" } {
  const isSecret = group.id === "secret";
  if (isSecret) {
    const discoveredCount = group.badges.filter((b) => b.isDiscovered).length;
    return { text: `${discoveredCount} of ${group.badges.length} discovered`, tone: "secret" };
  }

  const earnedCount = group.badges.filter((b) => b.isEarned).length;
  if (earnedCount > 0) {
    return { text: `${earnedCount} of ${group.badges.length}`, tone: "earned" };
  }

  const hasAnyProgress = group.badges.some((b) => b.current > 0);
  if (hasAnyProgress) {
    return { text: "In progress", tone: "progress" };
  }

  return { text: `${group.badges.length} to discover`, tone: "discover" };
}

export function BadgeCategorySection({
  group,
  defaultOpen = false,
  onBadgeClick,
}: BadgeCategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();

  const totalFP = group.badges.reduce((sum, b) => sum + b.fpValue, 0);
  const isSecret = group.id === "secret";
  const pill = getCategoryPillContent(group);

  return (
    <div className="overflow-hidden rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted)">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--cf-accent-border)"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">
              {group.title}
            </h2>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                pill.tone === "earned"
                  ? "text-white"
                  : pill.tone === "progress"
                    ? "text-white"
                    : "border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)"
              )}
              style={
                pill.tone === "earned"
                  ? { background: "var(--accent-amber)" }
                  : pill.tone === "progress"
                    ? { background: "var(--accent-emerald)" }
                    : undefined
              }
            >
              {pill.text}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-(--cf-text-soft)">{group.description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!isSecret && (
            <span className="hidden items-center gap-1 text-xs sm:inline-flex" style={{ color: "var(--accent-violet)" }}>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L8.5 8.5 2 9.27l4.5 5.05L5.82 22 12 18.77 18.18 22l-.68-7.68L22 9.27 15.5 8.5z"/></svg>
              {totalFP} FP
            </span>
          )}
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-(--cf-text-soft)" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-(--cf-border) px-5 pb-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.badges.map((badge, i) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    index={i}
                    onClick={() => onBadgeClick(badge)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
