"use client";

import { motion, useReducedMotion } from "framer-motion";

interface EmptyStateProps {
  icon?: React.ReactNode;
  iconSize?: number;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon,
  iconSize = 48,
  title,
  description,
  ctaLabel,
  onCtaClick,
  actionHref,
  className = "",
}: EmptyStateProps) {
  const prefersReduced = useReducedMotion();

  const button = ctaLabel && (actionHref || onCtaClick) && (
    actionHref ? (
      <a
        href={actionHref}
        className="mt-4 inline-block cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition-colors hover:brightness-110"
        style={{
          background: "var(--accent-cyan)",
          color: "#FFFFFF",
        }}
      >
        {ctaLabel}
      </a>
    ) : (
      <button
        type="button"
        onClick={onCtaClick}
        className="mt-4 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition-colors hover:brightness-110"
        style={{
          background: "var(--accent-cyan)",
          color: "#FFFFFF",
        }}
      >
        {ctaLabel}
      </button>
    )
  );

  return (
    <motion.div
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}
    >
      {icon && (
        <div
          className="mb-4"
          style={{ color: "var(--text-tertiary)", fontSize: iconSize }}
        >
          {icon}
        </div>
      )}
      <h3
        className="text-lg font-semibold mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <p
        className="text-sm mb-6"
        style={{ color: "var(--text-secondary)", maxWidth: 320 }}
      >
        {description}
      </p>
      {button}
    </motion.div>
  );
}
