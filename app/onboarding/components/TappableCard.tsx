"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useCallback } from "react";
import { DUR } from "@/lib/motion";

interface TappableCardProps {
  selected: boolean;
  onSelect: () => void;
  tabStop: boolean;
  positionInSet: number;
  setSize: number;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

type RadioNavigationTarget = Pick<HTMLElement, "focus" | "click">;

export function moveRadioSelectionByArrow(
  targets: readonly RadioNavigationTarget[],
  currentIndex: number,
  key: string,
): boolean {
  if (
    targets.length === 0 ||
    currentIndex < 0 ||
    currentIndex >= targets.length
  ) {
    return false;
  }

  const direction =
    key === "ArrowRight" || key === "ArrowDown"
      ? 1
      : key === "ArrowLeft" || key === "ArrowUp"
        ? -1
        : 0;
  if (direction === 0) return false;

  const nextIndex = (currentIndex + direction + targets.length) % targets.length;
  targets[nextIndex].focus();
  targets[nextIndex].click();
  return true;
}

export default function TappableCard({
  selected,
  onSelect,
  tabStop,
  positionInSet,
  setSize,
  disabled = false,
  children,
  className = "",
}: TappableCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      const group = e.currentTarget.closest('[role="radiogroup"]');
      const radios = group
        ? Array.from(
            group.querySelectorAll<HTMLElement>(
              '[role="radio"]:not([aria-disabled="true"])',
            ),
          )
        : [];
      if (
        moveRadioSelectionByArrow(
          radios,
          radios.indexOf(e.currentTarget),
          e.key,
        )
      ) {
        e.preventDefault();
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    [disabled, onSelect]
  );

  return (
    <motion.div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      aria-posinset={positionInSet}
      aria-setsize={setSize}
      tabIndex={disabled ? -1 : tabStop ? 0 : -1}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={handleKeyDown}
      whileHover={
        disabled || prefersReducedMotion
          ? {}
          : { scale: 1.015 }
      }
      whileTap={
        disabled || prefersReducedMotion
          ? {}
          : { scale: 0.97 }
      }
      transition={{ duration: DUR.micro }}
      className={className}
      style={{
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        // Cyan tint reads on BOTH themes (the old `white 6%` vanished on light).
        backgroundColor: selected
          ? "color-mix(in srgb, var(--accent-cyan) 8%, transparent)"
          : "var(--bg-glass)",
        // Border stays 1px in both states (no layout-shift hack); selection is
        // signalled with the accent border + a soft ring instead of a 2px edge.
        border: selected
          ? "1px solid var(--accent-cyan)"
          : "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg-val)",
        padding: 16,
        minHeight: 48,
        // No `outline: none` — the global :focus-visible cyan ring must show for
        // keyboard users.
        transition:
          "border-color var(--duration-fast) var(--ease-out), background-color var(--duration-micro) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)",
        boxShadow: selected
          ? "0 0 0 1px color-mix(in srgb, var(--accent-cyan) 40%, transparent), 0 0 20px color-mix(in srgb, var(--accent-cyan) 12%, transparent)"
          : "none",
      }}
    >
      {/* Animated checkmark */}
      {selected && (
        <motion.div
          initial={prefersReducedMotion ? { scale: 1 } : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 15 }
          }
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: "50%",
            backgroundColor: "var(--accent-cyan)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <Check size={14} color="var(--cf-accent-contrast)" strokeWidth={3} />
        </motion.div>
      )}

      {children}
    </motion.div>
  );
}
