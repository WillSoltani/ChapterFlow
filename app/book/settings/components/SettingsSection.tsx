"use client";

import { type ReactNode, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/app/book/components/ui/cn";

type SettingsSectionProps = {
  icon: LucideIcon;
  title: string;
  summary?: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  reducedMotion?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
};

export function SettingsSection({
  icon: Icon,
  title,
  summary,
  expanded,
  onToggle,
  children,
  reducedMotion,
  highlighted,
  dimmed,
}: SettingsSectionProps) {
  const contentId = useMemo(
    () => `settings-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    [title]
  );

  return (
    <motion.section
      aria-label={title}
      animate={dimmed ? { opacity: 0.2 } : { opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
      className={cn(
        "overflow-hidden rounded-[22px] border backdrop-blur-sm transition-shadow duration-300",
        "bg-(--cf-surface)",
        highlighted
          ? "border-(--cf-accent-border) shadow-[0_0_24px_var(--cf-accent-shadow)]"
          : expanded
            ? "border-(--cf-border-strong) shadow-(--cf-shadow-lg)"
            : "border-(--cf-border)",
        dimmed && "pointer-events-none"
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-4 px-5 py-4 transition-colors",
          "hover:bg-(--cf-surface-muted)",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--cf-accent-border)"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--cf-surface-muted) text-(--cf-text-2)">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-semibold text-(--cf-text-1)">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Collapsed summary — desktop only */}
          <AnimatePresence>
            {summary && !expanded && (
              <motion.span
                initial={reducedMotion ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="hidden max-w-60 truncate text-xs text-(--cf-text-soft) sm:block"
              >
                {summary}
              </motion.span>
            )}
          </AnimatePresence>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-(--cf-text-soft)" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={contentId}
            role="region"
            aria-label={`${title} settings`}
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
            }
            className="overflow-hidden"
          >
            <div className="border-t border-(--cf-border) px-2 pb-3 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
