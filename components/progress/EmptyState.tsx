"use client";

import { motion, useReducedMotion } from "framer-motion";

interface EmptyStateProps {
  icon?: string;
  iconSize?: number;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  iconSize = 48,
  title,
  description,
  ctaLabel,
  onCtaClick,
  className = "",
}: EmptyStateProps) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-8 text-center ${className}`}
    >
      {icon && (
        <span style={{ fontSize: iconSize }} className="mb-3">
          {icon}
        </span>
      )}
      <p
        className="text-lg font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        {title}
      </p>
      <p
        className="mt-1.5 max-w-md text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </p>
      {ctaLabel && onCtaClick && (
        <button
          type="button"
          onClick={onCtaClick}
          className="mt-4 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </motion.div>
  );
}
