"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import { CardSelector } from "./controls/CardSelector";
import { ToggleSwitch } from "./controls/ToggleSwitch";
import { DropdownSelect } from "./controls/DropdownSelect";
import { READING_PROFILES, DAILY_GOAL_OPTIONS, MOTIVATION_OPTIONS } from "../constants/profiles";
import type {
  ReadingProfile,
  DailyGoalPreset,
  MotivationPersona,
  ColorBlindMode,
} from "../types/settings";

type RefreshPreferencesModalProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (prefs: RefreshResult) => void;
  reducedMotion?: boolean;
  // Current values (pre-populate)
  currentProfile: ReadingProfile;
  currentGoal: DailyGoalPreset;
  currentMotivation: MotivationPersona;
  currentDyslexia: boolean;
  currentHighContrast: boolean;
  currentColorBlind: ColorBlindMode;
};

export type RefreshResult = {
  profile: ReadingProfile;
  goal: DailyGoalPreset;
  motivation: MotivationPersona;
  dyslexia: boolean;
  highContrast: boolean;
  colorBlind: ColorBlindMode;
};

const TOTAL_STEPS = 4;

export function RefreshPreferencesModal({
  open,
  onClose,
  onComplete,
  reducedMotion,
  currentProfile,
  currentGoal,
  currentMotivation,
  currentDyslexia,
  currentHighContrast,
  currentColorBlind,
}: RefreshPreferencesModalProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1=forward, -1=back

  // Local state for wizard
  const [profile, setProfile] = useState<ReadingProfile>(currentProfile);
  const [goal, setGoal] = useState<DailyGoalPreset>(currentGoal);
  const [motivation, setMotivation] = useState<MotivationPersona>(currentMotivation);
  const [dyslexia, setDyslexia] = useState(currentDyslexia);
  const [highContrast, setHighContrast] = useState(currentHighContrast);
  const [colorBlind, setColorBlind] = useState<ColorBlindMode>(currentColorBlind);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  function goNext() {
    if (step < TOTAL_STEPS) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      onComplete({ profile, goal, motivation, dyslexia, highContrast, colorBlind });
      onClose();
      setStep(1);
    }
  }

  function goBack() {
    if (step > 1) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }

  function handleClose() {
    onClose();
    setStep(1);
  }

  if (!open) return null;

  const slideVariants = {
    enter: (d: number) => ({
      x: d > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({
      x: d > 0 ? -60 : 60,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reducedMotion ? undefined : { opacity: 0 }}
        className="absolute inset-0 bg-(--cf-overlay) backdrop-blur-sm"
        onClick={handleClose}
      />
      <motion.div
        initial={reducedMotion ? false : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-(--cf-surface-strong) border border-(--cf-border) p-6 shadow-xl overflow-hidden"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-(--cf-surface-muted) text-(--cf-text-soft) z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? "bg-(--cf-accent)" : "bg-(--cf-surface-strong)"
              }`}
            />
          ))}
        </div>

        {/* Step content with slide animation */}
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={reducedMotion ? undefined : slideVariants}
            initial={reducedMotion ? false : "enter"}
            animate="center"
            exit={reducedMotion ? undefined : "exit"}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <div>
                <p className="text-xs text-(--cf-text-soft) mb-1">Step 1 of {TOTAL_STEPS}</p>
                <h3 className="text-lg font-bold text-(--cf-text-1)">
                  What best describes your reading style?
                </h3>
                <div className="mt-4">
                  <CardSelector
                    options={READING_PROFILES.map((p) => ({
                      value: p.id,
                      emoji: p.emoji,
                      label: p.label,
                      description: p.description,
                      tint: p.tint,
                      selectedTint: p.selectedTint,
                    }))}
                    value={profile}
                    onChange={setProfile}
                    label="Reading style"
                    columns={3}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-xs text-(--cf-text-soft) mb-1">Step 2 of {TOTAL_STEPS}</p>
                <h3 className="text-lg font-bold text-(--cf-text-1)">
                  How much time can you dedicate daily?
                </h3>
                <div className="mt-4">
                  <CardSelector
                    options={DAILY_GOAL_OPTIONS.map((opt) => ({
                      value: String(opt.value) as any,
                      emoji: opt.emoji,
                      label: opt.label,
                      description: opt.subtext,
                      prominentValue: `${opt.value} min`,
                      tint: opt.tint,
                      selectedTint: opt.selectedTint,
                    }))}
                    value={String(goal)}
                    onChange={(v) => setGoal(Number(v) as DailyGoalPreset)}
                    label="Daily goal"
                    columns={4}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <p className="text-xs text-(--cf-text-soft) mb-1">Step 3 of {TOTAL_STEPS}</p>
                <h3 className="text-lg font-bold text-(--cf-text-1)">
                  How do you like to be motivated?
                </h3>
                <div className="mt-4">
                  <CardSelector
                    options={MOTIVATION_OPTIONS.map((opt) => ({
                      value: opt.id,
                      emoji: opt.emoji,
                      label: opt.persona,
                      description: opt.description,
                      tint: opt.tint,
                      selectedTint: opt.selectedTint,
                    }))}
                    value={motivation}
                    onChange={setMotivation}
                    label="Motivation style"
                    columns={3}
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <p className="text-xs text-(--cf-text-soft) mb-1">Step 4 of {TOTAL_STEPS}</p>
                <h3 className="text-lg font-bold text-(--cf-text-1)">
                  Any accessibility needs?
                </h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-(--cf-text-1)">Dyslexia-friendly font</p>
                      <p className="text-xs text-(--cf-text-3)">Use OpenDyslexic typeface</p>
                    </div>
                    <ToggleSwitch checked={dyslexia} onChange={setDyslexia} label="Dyslexia font" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-(--cf-text-1)">High contrast</p>
                      <p className="text-xs text-(--cf-text-3)">Sharper colors and borders</p>
                    </div>
                    <ToggleSwitch checked={highContrast} onChange={setHighContrast} label="High contrast" />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-(--cf-text-1)">Color vision</p>
                      <p className="text-xs text-(--cf-text-3)">Adjust for color vision differences</p>
                    </div>
                    <DropdownSelect
                      options={[
                        { value: "off", label: "Off" },
                        { value: "protanopia", label: "Protanopia" },
                        { value: "deuteranopia", label: "Deuteranopia" },
                        { value: "tritanopia", label: "Tritanopia" },
                      ]}
                      value={colorBlind}
                      onChange={(v) => setColorBlind(v as ColorBlindMode)}
                      label="Color vision"
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step < TOTAL_STEPS && (
              <button
                type="button"
                onClick={goNext}
                className="text-sm text-(--cf-text-3) hover:text-(--cf-text-2)"
              >
                Skip
              </button>
            )}
            <Button variant="primary" size="sm" onClick={goNext}>
              {step === TOTAL_STEPS ? "Done \u2014 Update my preferences" : "Next"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
