"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import type { LearningMode, ContentTone } from "@/app/book/settings/types/settings";
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

const TONE_OPTIONS: Array<{
  id: ContentTone;
  icon: string;
  label: string;
  description: string;
}> = [
  { id: "gentle", icon: "\u2615", label: "Gentle", description: "Warm and invitational" },
  { id: "direct", icon: "\u26A1", label: "Direct", description: "Clean, efficient language" },
  { id: "competitive", icon: "\uD83D\uDD25", label: "Competitive", description: "Energizing, edge-driven" },
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

export type ReaderSettingsMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorClassName?: string;
  learningMode: LearningMode;
  onChangeLearningMode: (mode: LearningMode) => void;
  contentTone: ContentTone;
  onChangeContentTone: (tone: ContentTone) => void;
  showDepthSelector: boolean;
  readingDepth?: ReadingDepth;
  onChangeReadingDepth?: (depth: ReadingDepth) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
};

export function ReaderSettingsMenu({
  open,
  onClose,
  anchorClassName,
  learningMode,
  onChangeLearningMode,
  contentTone,
  onChangeContentTone,
  showDepthSelector,
  readingDepth,
  onChangeReadingDepth,
  focusMode,
  onToggleFocus,
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          className={[
            // Mobile: bottom-sheet anchored to viewport. Desktop: dropdown.
            "fixed left-0 right-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl",
            "sm:absolute sm:left-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-2 sm:w-80 sm:rounded-2xl sm:max-w-none",
            anchorClassName ?? "",
          ].join(" ")}
          style={{
            background: "var(--cr-bg-surface-2)",
            border: "1px solid var(--cr-glass-border)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
          }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          role="dialog"
          aria-label="Reading settings"
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
              <p className="mt-2 text-[11px] leading-snug text-(--cr-text-disabled)">
                Tone and difficulty are set during onboarding.{" "}
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="font-semibold text-(--cr-accent) underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--cr-accent)_55%,transparent)] rounded"
                  aria-expanded={advancedOpen}
                >
                  Customize them
                </button>
                .
              </p>
            </SettingsSection>

            <AnimatePresence initial={false}>
              {advancedOpen && (
                <motion.div
                  key="advanced"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="space-y-4 overflow-hidden"
                >
                  <SettingsSection label="Tone">
                    <RadioGroup
                      options={TONE_OPTIONS}
                      value={contentTone}
                      onChange={onChangeContentTone}
                    />
                  </SettingsSection>

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
                  <span className="rounded-full bg-(--cr-accent-muted) px-1.5 py-0.5 text-[9px] font-bold text-(--cr-accent)">
                    REC
                  </span>
                )}
              </p>
              {option.description && (
                <p className="mt-0.5 text-[11px] text-(--cr-text-disabled)">
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
          <p className="mt-0.5 text-[11px] text-(--cr-text-disabled)">{description}</p>
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
