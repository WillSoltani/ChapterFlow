"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useCallback } from "react";

interface TappableCardProps {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function TappableCard({
  selected,
  onSelect,
  disabled = false,
  children,
  className = "",
}: TappableCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
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
      tabIndex={disabled ? -1 : 0}
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
          : { scale: 0.99 }
      }
      transition={{ duration: 0.15 }}
      className={className}
      style={{
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        backgroundColor: selected
          ? "rgba(255,255,255,0.06)"
          : "var(--bg-glass)",
        border: selected
          ? "2px solid var(--accent-blue)"
          : "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg-val)",
        padding: selected ? "15px" : "16px", // compensate for thicker border
        minHeight: 48,
        outline: "none",
        transition:
          "border-color 200ms ease, background-color 150ms ease, box-shadow 200ms ease",
        boxShadow: selected
          ? "0 0 20px var(--glow-blue), inset 0 0 12px rgba(79,139,255,0.04)"
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
            backgroundColor: "var(--accent-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <Check size={14} color="#fff" strokeWidth={3} />
        </motion.div>
      )}

      {children}
    </motion.div>
  );
}
