"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { DUR } from "@/lib/motion";

type EmptyStateVariant = "plain" | "panel";

interface EmptyStateProps {
  /**
   * Accepts BOTH a Lucide component reference (admin usage: `icon={Bell}`) AND a
   * rendered node / emoji string (ui & progress usage). When `icon` is a function
   * (a component) it is rendered as `<Icon />` inside the admin accent-chip / panel
   * treatment; otherwise it is rendered inline in the plain ui/progress layout.
   */
  icon?: React.ReactNode | LucideIcon;
  /** Only applies to the inline node/emoji rendering path (plain/progress default 64). */
  iconSize?: number;
  title: string;
  description?: string;
  /** CTA — label + handler (progress / ui style). Renders an internal styled button. */
  ctaLabel?: string;
  onCtaClick?: () => void;
  /** Caller-supplied rendered node (admin style). */
  action?: React.ReactNode;
  /** Admin panel density toggle (default false). Only affects the panel variant. */
  compact?: boolean;
  /**
   * `panel` = admin card chrome (cf-panel-muted + accent chip). `plain` = ui/progress
   * centered flex column. Defaults to `panel` when a LucideIcon component is passed,
   * otherwise `plain`.
   */
  variant?: EmptyStateVariant;
  className?: string;
}

function isComponentIcon(
  icon: React.ReactNode | LucideIcon,
): icon is LucideIcon {
  // A plain function component.
  if (typeof icon === "function") return true;
  // lucide-react icons (and any React.forwardRef / React.memo component) are
  // EXOTIC component OBJECTS, not functions — `typeof` is "object". Treat those
  // as component references so they render as `<Icon />`, not as a raw React
  // child (which throws "Objects are not valid as a React child {$$typeof,
  // render}"). A already-rendered element (react.element) is deliberately NOT
  // matched here so node/emoji callers still render inline.
  if (typeof icon === "object" && icon !== null) {
    const tag = (icon as { $$typeof?: symbol }).$$typeof;
    return (
      tag === Symbol.for("react.forward_ref") ||
      tag === Symbol.for("react.memo")
    );
  }
  return false;
}

export function EmptyState({
  icon,
  iconSize = 64,
  title,
  description,
  ctaLabel,
  onCtaClick,
  action,
  compact = false,
  variant,
  className = "",
}: EmptyStateProps) {
  const prefersReduced = useReducedMotion();

  const iconIsComponent = icon != null && isComponentIcon(icon);
  // Default to the admin panel treatment when a Lucide component icon is supplied,
  // otherwise the plain ui/progress layout.
  const resolvedVariant: EmptyStateVariant =
    variant ?? (iconIsComponent ? "panel" : "plain");

  const cta = ctaLabel && onCtaClick && (
    <button
      type="button"
      onClick={onCtaClick}
      className="cf-pressable mt-4 cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium transition-colors hover:brightness-110"
      style={{
        background: "var(--accent-cyan)",
        color: "var(--bg-base)",
      }}
    >
      {ctaLabel}
    </button>
  );

  if (resolvedVariant === "panel") {
    const Icon = iconIsComponent ? (icon as LucideIcon) : null;
    return (
      <div
        className={[
          "cf-panel-muted rounded-2xl text-center",
          compact ? "px-4 py-6" : "px-6 py-10",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {Icon ? (
          <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-(--cf-accent-soft) text-(--cf-accent)">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        ) : (
          icon != null && (
            <div className="mx-auto inline-flex items-center justify-center">
              {icon as React.ReactNode}
            </div>
          )
        )}
        <p className="mt-3 text-base font-semibold text-(--cf-text-1)">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-(--cf-text-3)">
            {description}
          </p>
        )}
        {action && <div className="mt-4 inline-flex">{action}</div>}
        {cta}
      </div>
    );
  }

  // plain (ui / progress) variant — preserves the former progress/EmptyState markup
  // verbatim (its only consumer was ReadingActivity); the former ui/EmptyState had
  // zero consumers, so matching progress here is a pure behavior-preserving merge.
  return (
    <motion.div
      initial={{ opacity: prefersReduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.normal }}
      className={`flex flex-col items-center justify-center py-8 text-center ${className}`}
    >
      {icon != null && (
        <span
          className="mb-3"
          style={{ color: "var(--text-tertiary)", fontSize: iconSize }}
        >
          {icon as React.ReactNode}
        </span>
      )}
      <p
        className="text-lg font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        {title}
      </p>
      {description !== undefined && (
        <p
          className="mt-1.5 max-w-md text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>
      )}
      {action}
      {cta}
    </motion.div>
  );
}
