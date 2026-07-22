"use client";

import Image from "next/image";
import { Settings } from "lucide-react";
import { motion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { StreakFlame } from "./StreakFlame";

export function StickyMiniHeader({
  visible,
  avatar,
  initials,
  name,
  streakDays,
  onSettings,
}: {
  visible: boolean;
  avatar: string | null;
  initials: string;
  name: string;
  streakDays: number;
  onSettings: () => void;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ y: visible ? 0 : -60, opacity: visible ? 1 : 0 }}
      transition={{ duration: DUR.fast, ease: EASE.standard }}
      className="fixed left-0 right-0 top-[56px] z-20 border-b border-(--cf-border) bg-(--cf-surface-strong)/95"
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <div className="mx-auto flex max-w-450 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-10 xl:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-(--cf-border) bg-(--cf-surface-muted)">
            {avatar ? (
              <Image src={avatar} alt={name} width={28} height={28} className="h-full w-full object-cover" unoptimized />
            ) : (
              <span className="text-[10px] font-semibold text-(--cf-text-1)">{initials}</span>
            )}
          </div>
          <span className="text-sm font-semibold text-(--cf-text-1)">{name}</span>
          <span className="inline-flex items-center gap-1 text-sm">
            <StreakFlame active={streakDays > 0} size={16} />
            <span className={cn("font-semibold", streakDays > 0 ? "text-accent-amber" : "text-(--cf-text-soft)")}>{streakDays}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onSettings}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition hover:text-(--cf-text-1)"
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
