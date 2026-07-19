"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";
import { X } from "lucide-react";
import type { LearningMode, FontFamily } from "@/app/book/settings/types/settings";
import type { ReadingDepth } from "@/app/book/data/bookChapters";

const MODE_OPTIONS: Array<{
  id: LearningMode;
  icon: string;
  label: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    id: "guided",
    icon: "\uD83C\uDF31",
    label: "Guided",
    description: "More guidance and pacing support",
  },
  {
    id: "standard",
    icon: "\uD83D\uDCDA",
    label: "Standard",
    description: "Balanced pacing and feedback",
    recommended: true,
  },
  {
    id: "challenge",
    icon: "\uD83C\uDFC6",
    label: "Challenge",
    description: "Faster pace with fewer interruptions",
  },
];

const DEPTH_OPTIONS: Array<{
  id: ReadingDepth;
  label: string;
  description: string;
}> = [
  { id: "simple", label: "Lite", description: "Shorter, conversational" },
  { id: "standard", label: "Standard", description: "Balanced explanation" },
  { id: "deeper", label: "Deeper", description: "Longer, with edge cases" },
];

export type LineSpacingPref = "compact" | "comfortable" | "relaxed";

const LINE_SPACING_OPTIONS: Array<{ id: LineSpacingPref; label: string }> = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Cozy" },
  { id: "relaxed", label: "Relaxed" },
];

const WIDTH_OPTIONS: Array<{ id: "narrow" | "medium" | "wide"; label: string; px: number }> = [
  { id: "narrow", label: "Narrow", px: 640 },
  { id: "medium", label: "Medium", px: 800 },
  { id: "wide", label: "Wide", px: 960 },
];

// NS-2: first-class typeface control (Apple Books / Kindle style). The binary
// toggle only ever sets serif vs. sans; the accessibility "opendyslexic" option
// stays reachable on the full Settings page and maps to "Sans" lit here so the
// toggle never appears empty.
type TypefaceToggle = "serif" | "sans-serif";
const TYPEFACE_OPTIONS: Array<{ id: TypefaceToggle; label: string }> = [
  { id: "serif", label: "Serif" },
  { id: "sans-serif", label: "Sans" },
];

const FONT_MIN = 12;
const FONT_MAX = 24;

export type ReaderSettingsMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorClassName?: string;
  learningMode: LearningMode;
  onChangeLearningMode: (mode: LearningMode) => void;
  showDepthSelector: boolean;
  readingDepth?: ReadingDepth;
  onChangeReadingDepth?: (depth: ReadingDepth) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  // Typography controls (Kindle-style), wired to the reading-pref CSS-var pipeline.
  fontSize: number;
  onChangeFontSize: (px: number) => void;
  lineSpacing: LineSpacingPref;
  onChangeLineSpacing: (value: LineSpacingPref) => void;
  contentWidth: number;
  onChangeContentWidth: (px: number) => void;
  // NS-2 typeface (Serif/Sans). Optional so the reader compiles before the
  // single prefs instance is wired through (batch-05 handoff); the control only
  // renders once onChangeFontFamily is provided.
  fontFamily?: FontFamily;
  onChangeFontFamily?: (value: FontFamily) => void;
};

export function ReaderSettingsMenu({
  open,
  onClose,
  anchorClassName,
  learningMode,
  onChangeLearningMode,
  showDepthSelector,
  readingDepth,
  onChangeReadingDepth,
  focusMode,
  onToggleFocus,
  fontSize,
  onChangeFontSize,
  lineSpacing,
  onChangeLineSpacing,
  contentWidth,
  onChangeContentWidth,
  fontFamily,
  onChangeFontFamily,
}: ReaderSettingsMenuProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use a timeout so the opening click does not immediately close
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Non-modal dialog focus management: move focus into the panel on open and
  // restore it to the opener (the settings trigger) on close. A non-modal
  // dialog manages focus but does NOT trap it (the background stays
  // interactive), which matches this popover's behavior.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const panel = popoverRef.current;
      const first = panel?.querySelector<HTMLElement>(
        'button:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      (first ?? panel)?.focus?.();
    }, 0);
    return () => {
      window.clearTimeout(t);
      opener?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          className={[
            // Mobile: bottom-sheet anchored to viewport. Desktop: dropdown.
            "fixed left-0 right-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl",
            "sm:absolute sm:left-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-2 sm:w-80 sm:rounded-2xl sm:max-w-none",
            "max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-h-[80vh]",
            anchorClassName ?? "",
          ].join(" ")}
          style={{
            background: "var(--cr-bg-surface-2)",
            border: "1px solid var(--cr-glass-border)",
            boxShadow: "0 16px 48px color-mix(in srgb, var(--cf-palette-black) 45%, transparent)",
          }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: DUR.fast, ease: EASE.standard }}
          role="dialog"
          aria-label="Reading settings"
          tabIndex={-1}
        >
          {/* Mobile drag handle */}
          <div className="flex sm:hidden justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-(--cr-glass-border)" />
          </div>

          <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
              Reading settings
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-(--cr-text-secondary) hover:text-(--cr-text-primary) sm:hidden"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 pb-4 space-y-4">
            <SettingsSection label="Mode">
              <RadioGroup
                options={MODE_OPTIONS}
                value={learningMode}
                onChange={onChangeLearningMode}
              />
              {/* RF-2 / D8: the Mode RadioGroup above is the single depth lever.
                  The "Customize it" disclosure only makes sense when a separate
                  depth selector exists (showDepthSelector) — otherwise it would
                  expand to nothing, so hide the helper alongside the selector. */}
              {showDepthSelector && (
                <p className="mt-2 text-cf-caption leading-snug text-(--cr-text-disabled)">
                  Difficulty is set during onboarding.{" "}
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="font-semibold text-(--cr-accent) underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] rounded"
                    aria-expanded={advancedOpen}
                  >
                    Customize it
                  </button>
                  .
                </p>
              )}
            </SettingsSection>

            <AnimatePresence initial={false}>
              {advancedOpen && (
                <motion.div
                  key="advanced"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: DUR.fast, ease: EASE.standard }}
                  className="space-y-4 overflow-hidden"
                >
                  {showDepthSelector && readingDepth && onChangeReadingDepth && (
                    <SettingsSection label="Difficulty">
                      <RadioGroup
                        options={DEPTH_OPTIONS}
                        value={readingDepth}
                        onChange={onChangeReadingDepth}
                      />
                    </SettingsSection>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border-t border-(--cr-glass-border) pt-3">
              <SettingsSection label="Text">
                <div className="space-y-3">
                  {/* Font size — Kindle-style A− / A+ stepper. */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-(--cr-text-secondary)">Font size</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onChangeFontSize(Math.max(FONT_MIN, fontSize - 1))}
                        disabled={fontSize <= FONT_MIN}
                        aria-label="Decrease font size"
                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-(--cr-glass-border) bg-(--cr-bg-surface-3) text-(--cr-text-primary) transition hover:brightness-110 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
                      >
                        <span className="text-xs font-bold">A</span>
                      </button>
                      <span
                        aria-live="polite"
                        className="w-12 text-center text-xs font-semibold tabular-nums text-(--cr-text-primary)"
                      >
                        {fontSize}px
                      </span>
                      <button
                        type="button"
                        onClick={() => onChangeFontSize(Math.min(FONT_MAX, fontSize + 1))}
                        disabled={fontSize >= FONT_MAX}
                        aria-label="Increase font size"
                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-(--cr-glass-border) bg-(--cr-bg-surface-3) text-(--cr-text-primary) transition hover:brightness-110 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]"
                      >
                        <span className="text-lg font-bold leading-none">A</span>
                      </button>
                    </div>
                  </div>

                  {/* Line spacing */}
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-(--cr-text-secondary)">Line spacing</p>
                    <Segmented
                      ariaLabel="Line spacing"
                      options={LINE_SPACING_OPTIONS}
                      value={lineSpacing}
                      onChange={onChangeLineSpacing}
                    />
                  </div>

                  {/* Reading width */}
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-(--cr-text-secondary)">Width</p>
                    <Segmented
                      ariaLabel="Reading width"
                      options={WIDTH_OPTIONS}
                      value={contentWidth <= 720 ? "narrow" : contentWidth >= 880 ? "wide" : "medium"}
                      onChange={(id) => {
                        const match = WIDTH_OPTIONS.find((w) => w.id === id);
                        if (match) onChangeContentWidth(match.px);
                      }}
                    />
                  </div>

                  {/* Typeface (NS-2) — first-class Serif/Sans, Apple Books style.
                      Rendered only once the prefs instance is wired through
                      (batch-05 handoff). opendyslexic shows "Sans" lit. */}
                  {onChangeFontFamily && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-(--cr-text-secondary)">Typeface</p>
                      <Segmented
                        ariaLabel="Typeface"
                        options={TYPEFACE_OPTIONS}
                        value={fontFamily === "serif" ? "serif" : "sans-serif"}
                        onChange={onChangeFontFamily}
                      />
                    </div>
                  )}
                </div>
              </SettingsSection>
            </div>

            <div className="border-t border-(--cr-glass-border) pt-3">
              <ToggleRow
                label="Focus mode"
                description="Hide stepper and chrome"
                value={focusMode}
                onChange={onToggleFocus}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-(--cr-text-disabled)">
        {label}
      </p>
      {children}
    </div>
  );
}

type RadioOption<T extends string> = {
  id: T;
  icon?: string;
  label: string;
  description?: string;
  recommended?: boolean;
};

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<RadioOption<T>>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={[
              "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition",
              active
                ? "bg-(--cr-accent-muted) text-(--cr-accent)"
                : "text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-3)",
            ].join(" ")}
            aria-pressed={active}
          >
            {option.icon && <span className="mt-0.5 text-base leading-none">{option.icon}</span>}
            <div className="min-w-0 flex-1">
              <p
                className={[
                  "text-xs font-semibold flex items-center gap-1.5",
                  active ? "text-(--cr-accent)" : "text-(--cr-text-primary)",
                ].join(" ")}
              >
                {option.label}
                {option.recommended && (
                  <span className="rounded-full bg-(--cr-accent-muted) px-1.5 py-0.5 text-cf-caption font-bold text-(--cr-accent)">
                    REC
                  </span>
                )}
              </p>
              {option.description && (
                <p className="mt-0.5 text-cf-caption text-(--cr-text-disabled)">
                  {option.description}
                </p>
              )}
            </div>
            {active && (
              <span
                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--cr-accent)" }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-1 rounded-xl bg-(--cr-bg-surface-3) p-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={[
              "flex min-h-11 flex-1 items-center justify-center rounded-lg px-2 text-xs font-semibold transition",
              active
                ? "bg-(--cr-accent) text-(--cr-text-inverse)"
                : "text-(--cr-text-secondary) hover:text-(--cr-text-primary)",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-(--cr-bg-surface-3)"
      aria-pressed={value}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-(--cr-text-primary)">{label}</p>
        {description && (
          <p className="mt-0.5 text-cf-caption text-(--cr-text-disabled)">{description}</p>
        )}
      </div>
      <span
        className={[
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          value ? "bg-(--cr-accent)" : "bg-(--cr-bg-surface-3)",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white transition",
            value ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
