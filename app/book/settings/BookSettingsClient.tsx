"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Target,
  Palette,
  Accessibility,
  Bell,
  User,
  Keyboard,
} from "lucide-react";

// Existing hooks
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookEntitlements } from "@/app/book/hooks/useBookEntitlements";
import { useToast } from "@/app/book/hooks/useToast";
import { Toast } from "@/app/book/components/ui/Toast";

// New settings hooks
import { useSettingsPage } from "./hooks/useSettingsPage";
import { useSettingsSearch } from "./hooks/useSettingsSearch";
import { usePersonalizationScore } from "./hooks/usePersonalizationScore";
import { useReducedMotion } from "./hooks/useReducedMotion";

// Components
import { SettingsSearch } from "./components/SettingsSearch";
import { PersonalizationMeter } from "./components/PersonalizationMeter";
import { SettingsSection } from "./components/SettingsSection";
import { SettingRow, Divider, SubsectionLabel } from "./components/SettingRow";
import { ToggleSwitch } from "./components/controls/ToggleSwitch";
import { SegmentedControl } from "./components/controls/SegmentedControl";
import { CardSelector } from "./components/controls/CardSelector";
import { Stepper } from "./components/controls/Stepper";
import { SliderControl } from "./components/controls/SliderControl";
import { TimePicker } from "./components/controls/TimePicker";
import { DropdownSelect } from "./components/controls/DropdownSelect";
import { ProBadge } from "./components/ProBadge";
import { ProFeatureCard } from "./components/ProFeatureCard";
import { SubscriptionCard } from "./components/SubscriptionCard";
import { DangerZone } from "./components/DangerZone";
import { ExportModal } from "./components/ExportModal";
import { MicroCelebration } from "./components/MicroCelebration";
import { RefreshPreferencesModal } from "./components/RefreshPreferencesModal";
import { useSaveToast, SaveToast } from "./components/SaveToast";
import { PageTransition } from "@/components/ui/PageTransition";
import type { RefreshResult } from "./components/RefreshPreferencesModal";

// Constants
import { READING_PROFILES, DAILY_GOAL_OPTIONS, MOTIVATION_OPTIONS } from "./constants/profiles";
import {
  QUIZ_STYLE_TO_INTENSITY,
  INTENSITY_TO_QUIZ_STYLE,
  PERSONA_TO_MOTIVATION,
  MOTIVATION_TO_PERSONA,
} from "./constants/defaults";

// Types
import type {
  ReadingProfile,
  QuizStyle,
  MotivationPersona,
  ContentTone,
  DailyGoalPreset,
  CelebrationEvent,
  StreakMode,
  FontFamily,
  LineSpacing,
  LetterSpacing,
  ColorBlindMode,
} from "./types/settings";
import type { LearningStyle, QuizIntensity, MotivationStyle } from "@/app/book/hooks/useOnboardingState";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type BookSettingsClientProps = {
  isAdmin: boolean;
  userEmail: string | null;
  appVersion: string;
};

export function BookSettingsClient({}: BookSettingsClientProps) {
  const router = useRouter();

  // Existing state hooks
  const { state: preferences, patchSection, hydrated: prefsHydrated } = useBookPreferences();
  const {
    state: onboarding,
    hydrated: onboardingHydrated,
    setDailyGoalMinutes,
    setLearningStyle,
    setQuizIntensity,
    setReminderTime,
    setStreakMode: setOnboardingStreakMode,
    setMotivationStyle: setOnboardingMotivationStyle,
    resetSetup,
  } = useOnboardingState();
  const { billingState, billingAction, launchBillingAction, redeemLicenseKey } =
    useBookEntitlements(true);
  const { toast, showToast } = useToast();

  // New settings hooks
  const {
    hydrated: extHydrated,
    state: ext,
    patch: patchExt,
    toggleSection,
    isSectionExpanded,
  } = useSettingsPage();
  const { query, setQuery, results, isSearching } = useSettingsSearch();
  const reducedMotion = useReducedMotion(preferences.appearance.reducedMotion);

  // Hydration state
  const hydrated = prefsHydrated && onboardingHydrated && extHydrated;

  // Personalization score
  const personalizationScore = usePersonalizationScore(
    preferences,
    ext,
    onboarding.dailyGoalMinutes,
    onboarding.reminderTime
  );

  // Score milestone tracking
  const prevScoreRef = useRef<number>(0);
  useEffect(() => {
    if (!hydrated) return;
    const prev = prevScoreRef.current;
    const curr = personalizationScore;
    if (prev < 50 && curr >= 50 && curr < 100) {
      triggerCelebration("score-50");
    } else if (prev < 100 && curr >= 100) {
      triggerCelebration("score-100");
    }
    prevScoreRef.current = curr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalizationScore, hydrated]);

  // Screen reader live announcements
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  function announce(message: string) {
    // Clear then set to ensure screen readers re-read
    setLiveAnnouncement("");
    requestAnimationFrame(() => setLiveAnnouncement(message));
  }

  // Celebration event
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerCelebration(event: CelebrationEvent) {
    if (reducedMotion) return;
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    setCelebration(event);
    celebrationTimer.current = setTimeout(() => setCelebration(null), 2000);
  }

  // Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Refresh preferences wizard
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);

  function handleRefreshComplete(result: RefreshResult) {
    handleProfileChange(result.profile);
    handleDailyGoalChange(result.goal);
    handleMotivationChange(result.motivation);
    patchSection("accessibility", {
      dyslexiaFriendlyFont: result.dyslexia,
      highContrastMode: result.highContrast,
    });
    patchExt({ colorBlindMode: result.colorBlind, personalizationDismissed: false });
    if (result.dyslexia) patchExt({ fontFamily: "opendyslexic" });
    showToast("Preferences updated!", "success");
  }

  // Auto-save toast
  const { visible: saveToastVisible, triggerToast } = useSaveToast();

  // Persist onboarding-derived prefs to backend
  const lastOnboardingPrefsRef = useRef<string>("");
  useEffect(() => {
    if (!onboardingHydrated) return;
    const snapshot = JSON.stringify({
      learningStyle: onboarding.learningStyle,
      quizIntensity: onboarding.quizIntensity,
      streakMode: onboarding.streakMode,
      motivationStyle: onboarding.motivationStyle,
      dailyGoalMinutes: onboarding.dailyGoalMinutes,
      reminderTime: onboarding.reminderTime.trim() ? onboarding.reminderTime : null,
    });
    if (snapshot === lastOnboardingPrefsRef.current) return;
    lastOnboardingPrefsRef.current = snapshot;
    const timer = setTimeout(() => {
      fetch("/app/api/book/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: JSON.parse(snapshot) }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [
    onboardingHydrated,
    onboarding.learningStyle,
    onboarding.quizIntensity,
    onboarding.streakMode,
    onboarding.motivationStyle,
    onboarding.dailyGoalMinutes,
    onboarding.reminderTime,
  ]);

  // Derived state
  const isPro = billingState.payload?.entitlement.plan === "PRO";
  const plan = billingState.payload?.entitlement.plan ?? "FREE";
  const price = billingState.payload?.paywall.price ?? "$7.99 CAD";

  // --- Reading Profile logic ---
  function handleProfileChange(profile: ReadingProfile) {
    const preset = READING_PROFILES.find((p) => p.id === profile);
    if (!preset) return;
    const learningModeMap: Record<string, "guided" | "standard" | "challenge"> = {
      concise: "guided",
      balanced: "standard",
      deep: "challenge",
    };
    patchExt({
      readingProfile: profile,
      profileCustomized: false,
      quizStyle: preset.defaults.quizStyle,
      dailyGoalPreset: preset.defaults.dailyGoalPreset,
      learningMode: learningModeMap[preset.defaults.learningStyle] ?? "standard",
    });
    setLearningStyle(preset.defaults.learningStyle);
    setQuizIntensity(
      QUIZ_STYLE_TO_INTENSITY[preset.defaults.quizStyle] as QuizIntensity
    );
    setDailyGoalMinutes(preset.defaults.dailyGoalPreset);
    patchSection("reading", { fontSize: preset.defaults.fontSize });
    triggerCelebration("profile-selected");
    announce(`Reading profile changed to ${preset.label}`);
    showToast("Profile applied", "success");
    triggerToast();
  }

  // --- Quiz Style mapping ---
  const currentQuizStyle: QuizStyle = hydrated
    ? (INTENSITY_TO_QUIZ_STYLE[onboarding.quizIntensity] ?? "challenge")
    : "challenge";

  function handleQuizStyleChange(style: QuizStyle) {
    patchExt({ quizStyle: style, profileCustomized: true });
    setQuizIntensity(QUIZ_STYLE_TO_INTENSITY[style] as QuizIntensity);
    const labels = { comfortable: "Comfortable", challenge: "Challenge me", surprise: "Surprise me" };
    announce(`Quiz style changed to ${labels[style]}`);
    triggerToast();
  }

  // --- Motivation mapping (reads from ext, independent of onboarding) ---
  const currentMotivation: MotivationPersona = hydrated
    ? (ext.motivationPersona ?? "coach")
    : "coach";

  function handleMotivationChange(persona: MotivationPersona) {
    patchExt({ motivationPersona: persona, profileCustomized: true });
    if (persona === "rival") triggerCelebration("rival-selected");
    const labels = { coach: "Personal Coach", partner: "Accountability Partner", rival: "Rival" };
    announce(`Motivation style changed to ${labels[persona]}`);
    triggerToast();
  }

  // --- Content tone (independent of motivation persona) ---
  function handleContentToneChange(tone: ContentTone) {
    patchExt({ contentTone: tone, profileCustomized: true });
    const labels = { gentle: "Gentle", direct: "Direct", competitive: "Competitive" };
    announce(`Content tone changed to ${labels[tone]}`);
    triggerToast();
  }

  // --- Daily goal mapping ---
  function handleDailyGoalChange(preset: DailyGoalPreset) {
    const prev = ext.dailyGoalPreset;
    patchExt({ dailyGoalPreset: preset, profileCustomized: true });
    setDailyGoalMinutes(preset);
    if (preset > prev) triggerCelebration("goal-increased");
    announce(`Daily reading goal changed to ${preset} minutes`);
    triggerToast();
  }

  // --- Streak mode ---
  function handleStreakModeChange(mode: StreakMode) {
    patchExt({ streakMode: mode, profileCustomized: true });
    setOnboardingStreakMode(mode !== "off");
    if (mode !== "off") triggerCelebration("streak-enabled");
    const labels = { off: "Off", standard: "Standard", flexible: "Flexible" };
    announce(`Streak mode changed to ${labels[mode]}`);
    triggerToast();
  }

  // --- Dyslexia font sync ---
  function handleDyslexiaToggle(enabled: boolean) {
    patchSection("accessibility", { dyslexiaFriendlyFont: enabled });
    if (enabled) {
      patchExt({ fontFamily: "opendyslexic" });
    }
    announce(`Dyslexia-friendly font ${enabled ? "enabled" : "disabled"}`);
    triggerToast();
  }

  // --- Font family change (sync dyslexia toggle) ---
  function handleFontFamilyChange(family: FontFamily) {
    patchExt({ fontFamily: family });
    if (family === "opendyslexic") {
      patchSection("accessibility", { dyslexiaFriendlyFont: true });
    } else if (preferences.accessibility.dyslexiaFriendlyFont) {
      patchSection("accessibility", { dyslexiaFriendlyFont: false });
    }
    const labels = { serif: "Serif", "sans-serif": "Sans-Serif", opendyslexic: "OpenDyslexic" };
    announce(`Font family changed to ${labels[family]}`);
    triggerToast();
  }

  // --- Section summaries ---
  function getReadingSummary() {
    const profile = READING_PROFILES.find((p) => p.id === ext.readingProfile);
    const profileLabel = profile?.label ?? "Custom";
    return `${profileLabel} · ${preferences.reading.fontSize}px`;
  }

  function getGoalsSummary() {
    const daily = ext.dailyGoalPreset;
    const streak = ext.streakMode === "off" ? "Off" : ext.streakMode === "standard" ? "Standard" : "Flexible";
    const tone = ext.contentTone.charAt(0).toUpperCase() + ext.contentTone.slice(1);
    return `${daily} min/day · ${streak} · ${tone}`;
  }

  function getAppearanceSummary() {
    const theme = preferences.appearance.theme;
    const label = theme.charAt(0).toUpperCase() + theme.slice(1);
    return `${label}${preferences.appearance.reducedMotion ? " · Reduced motion" : ""}`;
  }

  function getAccessibilitySummary() {
    const active: string[] = [];
    if (preferences.accessibility.dyslexiaFriendlyFont) active.push("OpenDyslexic");
    if (preferences.accessibility.highContrastMode) active.push("High contrast");
    if (ext.colorBlindMode !== "off") active.push("Color adjusted");
    return active.length > 0 ? active.join(" · ") : "No adjustments active";
  }

  function getNotificationsSummary() {
    const parts: string[] = [];
    if (preferences.notifications.readingReminderEnabled) {
      parts.push(`Reminders at ${onboarding.reminderTime || "8:00 PM"}`);
    }
    if (preferences.notifications.streakReminder && ext.streakMode !== "off") {
      parts.push("Streak alerts on");
    }
    return parts.length > 0 ? parts.join(" · ") : "All off";
  }

  function getAccountSummary() {
    return plan === "PRO" ? "Pro plan" : "Free plan · 2 books";
  }

  // --- Search helpers ---
  function isSectionVisible(sectionId: string) {
    if (!isSearching || !results) return true;
    return results.matchedSections.has(sectionId as any);
  }

  function isSectionDimmed(sectionId: string) {
    if (!isSearching) return false;
    return !isSectionVisible(sectionId);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageTransition className="cf-app-shell min-h-screen px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-(--cf-text-1)">
              Settings
            </h1>
            <p className="mt-0.5 text-sm text-(--cf-text-3)">
              Your preferences are saved automatically.
            </p>
          </div>
        </div>
        {/* Save indicator hidden — auto-save toast shown below */}
        <div className="w-16" />
      </div>

      <div className="mx-auto max-w-5xl space-y-4">
        {/* Search */}
        <SettingsSearch query={query} onChange={setQuery} />

        {/* No search results */}
        {isSearching && results && !results.hasResults && (
          <div className="py-12 text-center">
            <p className="text-sm text-(--cf-text-3)">
              No settings found for &ldquo;{query}&rdquo;. Try a different search term.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
           Section 1: Reading Experience
           ══════════════════════════════════════════════════════════════ */}
        {isSectionVisible("reading") && (
          <SettingsSection
            icon={BookOpen}
            title="Reading Experience"
            summary={getReadingSummary()}
            expanded={isSectionExpanded("reading")}
            onToggle={() => toggleSection("reading")}
            reducedMotion={reducedMotion}
            dimmed={isSectionDimmed("reading")}
          >
            {/* 1A. Reading Profiles */}
            <div className="px-3 py-3">
              <p className="text-sm font-medium text-(--cf-text-1)">Reading profiles</p>
              <p className="mt-0.5 text-xs text-(--cf-text-3)">
                This sets your starting point. Customize anything below.
              </p>
              <div className="mt-3">
                <CardSelector
                  options={READING_PROFILES.map((p) => ({
                    value: p.id,
                    emoji: p.emoji,
                    label: p.label,
                    description: p.description,
                    tint: p.tint,
                    selectedTint: p.selectedTint,
                  }))}
                  value={hydrated ? ext.readingProfile : "balanced"}
                  onChange={handleProfileChange}
                  label="Reading profiles"
                  columns={3}
                />
              </div>
              {ext.profileCustomized && (
                <p className="mt-2 text-[11px] italic text-accent-amber/70">
                  Your settings have been customized
                </p>
              )}
            </div>

            <Divider />

            {/* 1B. Content Tone */}
            <div className="px-3 py-3" id="content-tone">
              <p className="text-sm font-medium text-(--cf-text-1)">Content tone</p>
              <p className="mt-0.5 text-xs text-(--cf-text-3)">
                How chapter summaries, scenarios, and quiz feedback are written for you.
              </p>
              <div className="mt-3">
                <CardSelector
                  options={[
                    {
                      value: "gentle",
                      emoji: "\uD83C\uDF3F",
                      label: "Gentle",
                      description: "Warm and encouraging. Concepts explained with patience and care.",
                      tint: "from-accent-emerald/[0.07] to-accent-emerald/[0.03]",
                      selectedTint: "border-accent-emerald/30 shadow-[0_0_20px_rgba(52,211,153,0.12)]",
                    },
                    {
                      value: "direct",
                      emoji: "\uD83C\uDFAF",
                      label: "Direct",
                      description: "Clear and efficient. Straight to the point, no fluff.",
                      tint: "from-accent-cyan/[0.07] to-accent-cyan/[0.03]",
                      selectedTint: "border-(--cf-accent)/30 shadow-[0_0_20px_var(--cf-accent-shadow)]",
                    },
                    {
                      value: "competitive",
                      emoji: "\u26A1",
                      label: "Competitive",
                      description: "Bold and challenging. Pushes you to think harder.",
                      tint: "from-accent-amber/[0.07] to-accent-amber/[0.03]",
                      selectedTint: "border-accent-amber/30 shadow-[0_0_20px_rgba(251,191,36,0.12)]",
                    },
                  ]}
                  value={ext.contentTone}
                  onChange={(v) => handleContentToneChange(v as ContentTone)}
                  label="Content tone"
                  columns={3}
                />
              </div>
            </div>

            <Divider />

            {/* 1C. Font Family */}
            <SettingRow
              id="font-family"
              label="Font family"
              description="Choose the typeface that feels most comfortable for long reads."
            >
              <SegmentedControl
                groupId="seg-font-family"
                options={[
                  { value: "serif", label: "Serif" },
                  { value: "sans-serif", label: "Sans-Serif" },
                  { value: "opendyslexic", label: "OpenDyslexic" },
                ]}
                value={hydrated ? ext.fontFamily : "sans-serif"}
                onChange={handleFontFamilyChange}
                label="Font family"
                reducedMotion={reducedMotion}
              />
            </SettingRow>
            {ext.fontFamily === "opendyslexic" && (
              <p className="mx-3 -mt-1 mb-2 text-[11px] text-(--cf-text-soft)">
                Uses the open-source OpenDyslexic typeface, designed for readers with dyslexia.
              </p>
            )}

            <Divider />

            {/* 1D. Font Size */}
            <SettingRow
              id="font-size"
              label="Font size"
              description="Adjust the reading text size in chapters."
            >
              <SliderControl
                value={hydrated ? preferences.reading.fontSize : 16}
                onChange={(v) => { patchSection("reading", { fontSize: v }); announce(`Font size changed to ${v} pixels`); triggerToast(); }}
                min={12}
                max={24}
                step={1}
                suffix="px"
                label="Font size"
                showEndLabels
              />
            </SettingRow>

            <Divider />

            {/* 1E. Line Spacing */}
            <SettingRow
              id="line-spacing"
              label="Line spacing"
              description="Breathing room between lines of text."
            >
              <SegmentedControl
                groupId="seg-line-spacing"
                options={[
                  { value: "compact", label: "Compact" },
                  { value: "comfortable", label: "Comfortable" },
                  { value: "relaxed", label: "Relaxed" },
                ]}
                value={hydrated ? ext.lineSpacing : "comfortable"}
                onChange={(v: LineSpacing) => { patchExt({ lineSpacing: v }); announce(`Line spacing changed to ${v}`); triggerToast(); }}
                label="Line spacing"
                reducedMotion={reducedMotion}
              />
            </SettingRow>

            <Divider />

            {/* 1F. Letter Spacing */}
            <SettingRow
              id="letter-spacing"
              label="Letter spacing"
              description="Space between individual characters."
            >
              <SegmentedControl
                groupId="seg-letter-spacing"
                options={[
                  { value: "tight", label: "Tight" },
                  { value: "normal", label: "Normal" },
                  { value: "wide", label: "Wide" },
                ]}
                value={hydrated ? ext.letterSpacing : "normal"}
                onChange={(v: LetterSpacing) => { patchExt({ letterSpacing: v }); announce(`Letter spacing changed to ${v}`); triggerToast(); }}
                label="Letter spacing"
                reducedMotion={reducedMotion}
              />
            </SettingRow>

            <Divider />

            {/* 1G. Focus Mode */}
            <SettingRow
              id="focus-mode"
              label="Focus mode"
              description="Just you and the words. Sidebar and header fade away while reading."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.reading.focusModeDefault : false}
                onChange={(v) => { patchSection("reading", { focusModeDefault: v }); announce(`Focus mode ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Focus mode"
              />
            </SettingRow>

            <Divider />

            {/* 1H. Progress Bar */}
            <SettingRow
              id="progress-bar"
              label="Progress bar"
              description="A thin bar at the top showing how far you've come in the chapter."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.reading.showProgressBar : true}
                onChange={(v) => { patchSection("reading", { showProgressBar: v }); announce(`Progress bar ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Progress bar"
              />
            </SettingRow>

            <Divider />

            {/* 1I. Resume Where You Left Off */}
            <SettingRow
              id="resume-position"
              label="Pick up where you left off"
              description="Automatically scroll to your last reading position."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.reading.resumeWhereLeftOff : true}
                onChange={(v) => { patchSection("reading", { resumeWhereLeftOff: v }); announce(`Resume position ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Resume position"
              />
            </SettingRow>

            <Divider />

            {/* 1J. Reading Time Estimates */}
            <SettingRow
              id="reading-time"
              label="Show reading time"
              description="Display estimated time to finish each book and chapter."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.reading.showEstimatedReadingTime : true}
                onChange={(v) => { patchSection("reading", { showEstimatedReadingTime: v }); announce(`Reading time estimates ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Reading time estimates"
              />
            </SettingRow>

            <Divider />

            {/* 1K. Text-to-Speech (Pro) */}
            <div className="px-3 py-3" id="text-to-speech">
              {isPro ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-base">&#128266;</span>
                    <span className="text-sm font-medium text-(--cf-text-1)">
                      Text-to-speech
                    </span>
                    <ProBadge />
                  </div>
                  <p className="mt-0.5 text-xs text-(--cf-text-3)">
                    Listen to chapters read aloud. Perfect for commutes or multitasking.
                  </p>
                  <div className="mt-3 space-y-1 border-l-2 border-(--cf-accent)/20 pl-4 ml-1">
                    <SettingRow label="Voice">
                      <DropdownSelect
                        options={[
                          { value: "clara", label: "Clara (Natural)" },
                          { value: "james", label: "James (Warm)" },
                          { value: "aria", label: "Aria (Clear)" },
                        ]}
                        value={ext.ttsVoice}
                        onChange={(v) => { patchExt({ ttsVoice: v as any }); announce(`TTS voice changed to ${v}`); triggerToast(); }}
                        label="TTS Voice"
                      />
                    </SettingRow>
                    <SettingRow label="Speed">
                      <SliderControl
                        value={ext.ttsSpeed}
                        onChange={(v) => { patchExt({ ttsSpeed: v }); announce(`TTS speed changed to ${v}x`); triggerToast(); }}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        suffix="x"
                        label="TTS Speed"
                        tickMarks={["0.5\u00d7", "1\u00d7", "1.5\u00d7", "2\u00d7"]}
                      />
                    </SettingRow>
                    <SettingRow
                      label="Auto-advance"
                      description="Continue to the next section automatically."
                    >
                      <ToggleSwitch
                        checked={ext.ttsAutoAdvance}
                        onChange={(v) => { patchExt({ ttsAutoAdvance: v }); announce(`TTS auto-advance ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                        label="TTS Auto-advance"
                      />
                    </SettingRow>
                  </div>
                </>
              ) : (
                <ProFeatureCard
                  icon="&#128266;"
                  title="Text-to-speech"
                  description="Listen to chapters read aloud while you walk, cook, or commute."
                  detailDescription="Text-to-speech lets you listen to any chapter read aloud with natural-sounding voices. Adjust speed, choose your preferred voice, and let chapters auto-advance so you can learn hands-free."
                  reducedMotion={reducedMotion}
                />
              )}
            </div>
          </SettingsSection>
        )}

        {/* ══════════════════════════════════════════════════════════════
           Section 2: Goals & Motivation
           ══════════════════════════════════════════════════════════════ */}
        {isSectionVisible("goals") && (
          <SettingsSection
            icon={Target}
            title="Goals & Motivation"
            summary={getGoalsSummary()}
            expanded={isSectionExpanded("goals")}
            onToggle={() => toggleSection("goals")}
            reducedMotion={reducedMotion}
            dimmed={isSectionDimmed("goals")}
          >
            {/* 2A. Daily Reading Goal */}
            <div className="px-3 py-3" id="daily-goal">
              <p className="text-sm font-medium text-(--cf-text-1)">Daily reading goal</p>
              <p className="mt-0.5 text-xs text-(--cf-text-3)">
                How much time you want to invest in learning each day.
              </p>
              <div className="mt-3">
                <CardSelector
                  options={DAILY_GOAL_OPTIONS.map((opt) => ({
                    value: String(opt.value) as any,
                    emoji: opt.emoji,
                    label: opt.label,
                    description: opt.subtext,
                    prominentValue: `${opt.value} min`,
                    tint: opt.tint,
                    selectedTint: opt.selectedTint,
                    badge: opt.recommended ? "Recommended" : undefined,
                  }))}
                  value={hydrated ? String(ext.dailyGoalPreset) : "10"}
                  onChange={(v) => handleDailyGoalChange(Number(v) as DailyGoalPreset)}
                  label="Daily reading goal"
                  columns={4}
                />
              </div>
            </div>

            <Divider />

            {/* 2B. Weekly Chapter Goal */}
            <SettingRow
              id="weekly-chapter-goal"
              label="Weekly chapter goal"
              description="Chapters to complete each week. We'll celebrate when you hit it."
            >
              <Stepper
                value={hydrated ? preferences.goals.weeklyChapterGoal : 3}
                onChange={(v) => { patchSection("goals", { weeklyChapterGoal: v }); announce(`Weekly chapter goal changed to ${v}`); triggerToast(); }}
                min={1}
                max={10}
                label="Weekly chapter goal"
              />
            </SettingRow>

            <Divider />

            {/* 2D. Quiz Preferences Subsection */}
            <SubsectionLabel>Quiz preferences</SubsectionLabel>

            {/* 2D. Question Flow */}
            <SettingRow
              id="question-flow"
              label="Question flow"
              description="See questions one at a time, or all together like a worksheet."
            >
              <SegmentedControl
                groupId="seg-question-flow"
                options={[
                  { value: "one-by-one", label: "One-by-one" },
                  { value: "all-at-once", label: "All at once" },
                ]}
                value={hydrated ? preferences.learning.questionPresentationStyle : "one-by-one"}
                onChange={(v) => { patchSection("learning", { questionPresentationStyle: v }); announce(`Question flow changed to ${v}`); triggerToast(); }}
                label="Question flow"
                reducedMotion={reducedMotion}
              />
            </SettingRow>

            <Divider />

            {/* 2D-iii. Shuffle Questions */}
            <SettingRow
              id="shuffle-questions"
              label="Shuffle questions"
              description="Randomize the order each time you retake a quiz."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.learning.shuffleQuestionOrder : false}
                onChange={(v) => { patchSection("learning", { shuffleQuestionOrder: v }); announce(`Shuffle questions ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Shuffle questions"
              />
            </SettingRow>

            <Divider />

            {/* 2D-iv. Retry Incorrect Only */}
            <SettingRow
              id="retry-incorrect"
              label="Retry incorrect only"
              description="When retaking a quiz, focus only on the ones you got wrong."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.learning.retryIncorrectOnly : true}
                onChange={(v) => { patchSection("learning", { retryIncorrectOnly: v }); announce(`Retry incorrect only ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Retry incorrect only"
              />
            </SettingRow>

            <Divider />

            {/* 2E. Streak Mode */}
            <div className="rounded-[13px] px-3 py-3 transition-colors hover:bg-(--cf-surface-muted)">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--cf-text-1)">Streak mode</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={ext.streakMode}
                      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="mt-0.5 text-xs leading-relaxed text-(--cf-text-3)"
                    >
                      {ext.streakMode === "off"
                        ? "No streak tracking. Read at your own pace with zero pressure."
                        : ext.streakMode === "standard"
                          ? "Build a daily reading streak. Miss a day and it resets."
                          : "Streaks with breathing room. Choose your skip days below."}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <div className="shrink-0">
                  <SegmentedControl
                    groupId="seg-streak-mode"
                    options={[
                      { value: "off", label: "Off" },
                      { value: "standard", label: "Standard" },
                      { value: "flexible", label: "Flexible" },
                    ]}
                    value={hydrated ? ext.streakMode : "standard"}
                    onChange={handleStreakModeChange}
                    label="Streak mode"
                    reducedMotion={reducedMotion}
                  />
                </div>
              </div>
            </div>

            {/* Conditional: Skip days (only when Flexible) */}
            <AnimatePresence initial={false}>
              {ext.streakMode === "flexible" && (
                <motion.div
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                >
                  <SettingRow
                    label="Skip days per week"
                    description="Days you can skip without breaking your streak."
                  >
                    <Stepper
                      value={ext.streakSkipDays}
                      onChange={(v) => { patchExt({ streakSkipDays: v }); announce(`Skip days per week changed to ${v}`); triggerToast(); }}
                      min={1}
                      max={3}
                      label="Skip days per week"
                    />
                  </SettingRow>
                </motion.div>
              )}
            </AnimatePresence>

            <Divider />

            {/* 2F. Motivation Style */}
            <div className="px-3 py-3" id="motivation-style">
              <p className="text-sm font-medium text-(--cf-text-1)">Motivation style</p>
              <p className="mt-0.5 text-xs text-(--cf-text-3)">
                How ChapterFlow encourages you in nudges, streaks, and progress messages.
              </p>
              <div className="mt-3">
                <CardSelector
                  options={MOTIVATION_OPTIONS.map((opt) => ({
                    value: opt.id,
                    emoji: opt.emoji,
                    label: opt.persona,
                    description: opt.description,
                    tint: opt.tint,
                    selectedTint: opt.selectedTint,
                  }))}
                  value={currentMotivation}
                  onChange={handleMotivationChange}
                  label="Motivation style"
                  columns={3}
                />
              </div>
              <AnimatePresence>
                {currentMotivation === "rival" && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mx-3 mt-1 mb-2 text-[11px] italic text-(--cf-text-3)"
                  >
                    Enables leaderboard-style comparisons with other readers. You can switch
                    back anytime.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <Divider />

            {/* 2G. Spaced Repetition (Pro) */}
            <div className="px-3 py-3" id="spaced-repetition">
              {isPro ? (
                <SettingRow
                  label={
                    <>
                      Review retention target <ProBadge />
                    </>
                  }
                  description="How well you want to remember what you've read. Higher = more frequent reviews."
                >
                  <SliderControl
                    value={ext.spacedRepetitionTarget}
                    onChange={(v) => { patchExt({ spacedRepetitionTarget: v }); announce(`Retention target changed to ${v}%`); triggerToast(); }}
                    min={70}
                    max={95}
                    step={5}
                    suffix="%"
                    label="Spaced repetition target"
                  />
                </SettingRow>
              ) : (
                <ProFeatureCard
                  icon="&#128202;"
                  title="Spaced Repetition"
                  description="ChapterFlow can intelligently schedule quiz reviews so you never forget what you learned."
                  detailDescription="Spaced repetition uses cognitive science to schedule review sessions at optimal intervals. Set your retention target and ChapterFlow will automatically remind you to review chapters before you forget them."
                  reducedMotion={reducedMotion}
                />
              )}
            </div>
          </SettingsSection>
        )}

        {/* ══════════════════════════════════════════════════════════════
           Section 3: Appearance
           ══════════════════════════════════════════════════════════════ */}
        {isSectionVisible("appearance") && (
          <SettingsSection
            icon={Palette}
            title="Appearance"
            summary={getAppearanceSummary()}
            expanded={isSectionExpanded("appearance")}
            onToggle={() => toggleSection("appearance")}
            reducedMotion={reducedMotion}
            dimmed={isSectionDimmed("appearance")}
          >
            {/* 3A. Theme */}
            <SettingRow
              id="theme"
              label="Theme"
              description="Choose your preferred color scheme."
            >
              <SegmentedControl
                groupId="seg-theme"
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
                value={hydrated ? preferences.appearance.theme : "light"}
                onChange={(v) => { patchSection("appearance", { theme: v }); announce(`Theme changed to ${v}`); triggerToast(); }}
                label="Theme"
                reducedMotion={reducedMotion}
              />
            </SettingRow>

            <Divider />

            {/* 3B. Scheduled Dark Mode */}
            <SettingRow
              id="night-mode-schedule"
              label="Night mode schedule"
              description={
                preferences.appearance.theme === "dark"
                  ? "You're already in dark mode all the time."
                  : "Automatically switch to dark mode during evening hours."
              }
            >
              <ToggleSwitch
                checked={ext.scheduledDarkMode}
                onChange={(v) => { patchExt({ scheduledDarkMode: v }); announce(`Night mode schedule ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                disabled={preferences.appearance.theme === "dark"}
                label="Night mode schedule"
              />
            </SettingRow>

            <AnimatePresence initial={false}>
              {ext.scheduledDarkMode && preferences.appearance.theme !== "dark" && (
                <motion.div
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                  className="ml-6 flex items-center gap-3 border-l-2 border-(--cf-divider) pl-4 pb-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-(--cf-text-3)">From</span>
                    <TimePicker
                      value={ext.darkModeFrom}
                      onChange={(v) => { patchExt({ darkModeFrom: v }); announce(`Dark mode start time changed`); triggerToast(); }}
                      label="Dark mode start time"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-(--cf-text-3)">To</span>
                    <TimePicker
                      value={ext.darkModeTo}
                      onChange={(v) => { patchExt({ darkModeTo: v }); announce(`Dark mode end time changed`); triggerToast(); }}
                      label="Dark mode end time"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Divider />

            {/* 3C. Reduced Motion */}
            <SettingRow
              id="reduced-motion"
              label="Reduced motion"
              description="Minimize animations and transitions throughout the app."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.appearance.reducedMotion : false}
                onChange={(v) => { patchSection("appearance", { reducedMotion: v }); announce(`Reduced motion ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Reduced motion"
              />
            </SettingRow>
          </SettingsSection>
        )}

        {/* ══════════════════════════════════════════════════════════════
           Section 4: Accessibility
           ══════════════════════════════════════════════════════════════ */}
        {isSectionVisible("accessibility") && (
          <SettingsSection
            icon={Accessibility}
            title="Accessibility"
            summary={getAccessibilitySummary()}
            expanded={isSectionExpanded("accessibility")}
            onToggle={() => toggleSection("accessibility")}
            reducedMotion={reducedMotion}
            dimmed={isSectionDimmed("accessibility")}
          >
            {/* 4A. High Contrast */}
            <SettingRow
              id="high-contrast"
              label="High contrast"
              description="Sharper colors and stronger borders for improved readability."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.accessibility.highContrastMode : false}
                onChange={(v) => { patchSection("accessibility", { highContrastMode: v }); announce(`High contrast ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="High contrast"
              />
            </SettingRow>

            <Divider />

            {/* 4C. Color Blind Mode */}
            <SettingRow
              id="color-blind"
              label="Color vision adjustment"
              description="Adjust colors throughout the app for different types of color vision."
            >
              <DropdownSelect
                options={[
                  { value: "off", label: "Off" },
                  { value: "protanopia", label: "Protanopia" },
                  { value: "deuteranopia", label: "Deuteranopia" },
                  { value: "tritanopia", label: "Tritanopia" },
                ]}
                value={hydrated ? ext.colorBlindMode : "off"}
                onChange={(v: ColorBlindMode) => { patchExt({ colorBlindMode: v }); announce(`Color vision adjustment changed to ${v === "off" ? "off" : v}`); triggerToast(); }}
                label="Color vision adjustment"
              />
            </SettingRow>

            <Divider />

            {/* 4D. Keyboard Navigation Info */}
            <div id="keyboard-nav" className="mx-3 my-2 flex gap-3 rounded-xl bg-(--cf-surface-muted) px-4 py-3 border border-(--cf-border)" style={{ borderLeftWidth: "2px", borderLeftColor: "var(--cf-accent-border)" }}>
              <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-text-soft)" />
              <div>
                <p className="text-sm font-medium text-(--cf-text-1)">
                  Keyboard navigation
                </p>
                <p className="mt-1 text-xs leading-relaxed text-(--cf-text-3)">
                  ChapterFlow fully supports keyboard navigation. Use Tab to move between
                  elements, Enter to select, and Escape to close panels. Screen readers are
                  fully supported.
                </p>
              </div>
            </div>
          </SettingsSection>
        )}

        {/* ══════════════════════════════════════════════════════════════
           Section 5: Notifications
           ══════════════════════════════════════════════════════════════ */}
        {isSectionVisible("notifications") && (
          <SettingsSection
            icon={Bell}
            title="Notifications"
            summary={getNotificationsSummary()}
            expanded={isSectionExpanded("notifications")}
            onToggle={() => toggleSection("notifications")}
            reducedMotion={reducedMotion}
            dimmed={isSectionDimmed("notifications")}
          >
            {/* 5A. Reading Reminders */}
            <SettingRow
              id="reading-reminders"
              label="Reading reminders"
              description="A friendly nudge at your chosen time to keep your habit alive."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.notifications.readingReminderEnabled : true}
                onChange={(v) => { patchSection("notifications", { readingReminderEnabled: v }); announce(`Reading reminders ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Reading reminders"
              />
            </SettingRow>

            {/* 5B. Reminder Time (conditional) */}
            <AnimatePresence initial={false}>
              {preferences.notifications.readingReminderEnabled && (
                <motion.div
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
                >
                  <SettingRow
                    id="reminder-time"
                    label="Reminder time"
                    description="When to receive your daily reading nudge."
                  >
                    <TimePicker
                      value={hydrated ? onboarding.reminderTime || "20:00" : "20:00"}
                      onChange={(v) => { setReminderTime(v); triggerToast(); }}
                      label="Reminder time"
                    />
                  </SettingRow>
                </motion.div>
              )}
            </AnimatePresence>

            <Divider />

            {/* 5C. Streak Reminders (hidden when streak mode is off) */}
            <AnimatePresence initial={false}>
              {ext.streakMode !== "off" && (
                <motion.div
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
                >
                  <SettingRow
                    id="streak-alerts"
                    label="Streak alerts"
                    description="Get a heads-up when your reading streak is about to expire."
                  >
                    <ToggleSwitch
                      checked={hydrated ? preferences.notifications.streakReminder : true}
                      onChange={(v) => { patchSection("notifications", { streakReminder: v }); announce(`Streak alerts ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                      label="Streak alerts"
                    />
                  </SettingRow>
                  <Divider />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 5D. Break Reminders */}
            <SettingRow
              id="break-reminders"
              label="Break reminders"
              description="A gentle reminder to rest your eyes during long reading sessions."
            >
              <ToggleSwitch
                checked={ext.breakReminders}
                onChange={(v) => { patchExt({ breakReminders: v }); announce(`Break reminders ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Break reminders"
              />
            </SettingRow>

            <AnimatePresence initial={false}>
              {ext.breakReminders && (
                <motion.div
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
                >
                  <SettingRow
                    label="Remind after"
                    description="How long before you get a gentle break nudge."
                  >
                    <SegmentedControl
                      groupId="seg-break-duration"
                      options={[
                        { value: "15", label: "15 min" },
                        { value: "30", label: "30 min" },
                        { value: "45", label: "45 min" },
                        { value: "60", label: "60 min" },
                      ]}
                      value={String(ext.breakReminderMinutes)}
                      onChange={(v) => { patchExt({ breakReminderMinutes: Number(v) }); announce(`Break reminder interval changed to ${v} minutes`); triggerToast(); }}
                      label="Break reminder interval"
                      reducedMotion={reducedMotion}
                    />
                  </SettingRow>
                </motion.div>
              )}
            </AnimatePresence>

            <Divider />

            {/* 5E. Weekly Summary Email */}
            <SettingRow
              id="weekly-summary"
              label="Weekly summary email"
              description="A brief digest of your reading progress, delivered every Monday."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.notifications.weeklyLearningSummaryEmail : true}
                onChange={(v) => { patchSection("notifications", { weeklyLearningSummaryEmail: v }); announce(`Weekly summary email ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Weekly summary email"
              />
            </SettingRow>
          </SettingsSection>
        )}

        {/* ══════════════════════════════════════════════════════════════
           Section 6: Account & Subscription
           ══════════════════════════════════════════════════════════════ */}
        {isSectionVisible("account") && (
          <SettingsSection
            icon={User}
            title="Account & Subscription"
            summary={getAccountSummary()}
            expanded={isSectionExpanded("account")}
            onToggle={() => toggleSection("account")}
            reducedMotion={reducedMotion}
            dimmed={isSectionDimmed("account")}
          >
            {/* 6A. Subscription Status */}
            <div className="px-3 py-3" id="subscription">
              <SubscriptionCard
                plan={plan}
                currentPeriodEnd={billingState.payload?.entitlement.currentPeriodEnd}
                price={price}
                onUpgrade={() => launchBillingAction("upgrade")}
                onManage={() => launchBillingAction("portal")}
                onRedeemKey={redeemLicenseKey}
                reducedMotion={reducedMotion}
              />
            </div>

            <Divider />

            {/* 6B. Privacy Controls */}
            <SubsectionLabel>Privacy</SubsectionLabel>

            <SettingRow
              id="analytics"
              label="Share usage analytics"
              description="Help improve ChapterFlow by sharing anonymous usage data. No personal information is ever collected."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.privacy.analyticsParticipation : false}
                onChange={(v) => { patchSection("privacy", { analyticsParticipation: v }); announce(`Usage analytics ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Share usage analytics"
              />
            </SettingRow>

            <Divider />

            <SettingRow
              id="recommendations"
              label="Personalized recommendations"
              description="Use your reading history to suggest books you'll love."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.privacy.personalizedRecommendations : true}
                onChange={(v) => { patchSection("privacy", { personalizedRecommendations: v }); announce(`Personalized recommendations ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Personalized recommendations"
              />
            </SettingRow>

            <Divider />

            <SettingRow
              id="reading-history"
              label="Save reading history"
              description="Remember which chapters and books you've completed."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.privacy.saveReadingHistory : true}
                onChange={(v) => { patchSection("privacy", { saveReadingHistory: v }); announce(`Save reading history ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Save reading history"
              />
            </SettingRow>

            <Divider />

            {/* 6C. Data Export */}
            <SettingRow
              id="export-data"
              label="Export my data"
              description="Download your reading history, highlights, notes, and quiz results."
            >
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="cf-btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
              >
                Export
              </button>
            </SettingRow>

            <Divider />

            {/* 6D. Refresh Preferences */}
            <SettingRow
              id="refresh-preferences"
              label="Refresh my preferences"
              description="Re-run the personalization wizard to update your reading profile."
            >
              <button
                type="button"
                onClick={() => setRefreshModalOpen(true)}
                className="cf-btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
              >
                Refresh
              </button>
            </SettingRow>

            <Divider />

            {/* 6E. Legal Links */}
            <div className="flex items-center justify-center gap-3 px-3 py-3 text-xs">
              <a
                href="/legal/privacy"
                className="font-medium text-(--cf-text-3) hover:text-(--cf-accent) hover:underline"
              >
                Privacy Policy
              </a>
              <span className="text-(--cf-text-soft)">&middot;</span>
              <a
                href="/legal/terms"
                className="font-medium text-(--cf-text-3) hover:text-(--cf-accent) hover:underline"
              >
                Terms of Service
              </a>
              <span className="text-(--cf-text-soft)">&middot;</span>
              <a
                href="/legal/cookies"
                className="font-medium text-(--cf-text-3) hover:text-(--cf-accent) hover:underline"
              >
                Cookie Policy
              </a>
            </div>

            {/* 6F. Danger Zone */}
            <div className="px-3">
              <DangerZone
                onDeactivate={() =>
                  showToast("Deactivation not yet supported — contact support.", "error")
                }
                onDelete={() =>
                  showToast("Deletion not yet supported — contact support.", "error")
                }
                reducedMotion={reducedMotion}
              />
            </div>
          </SettingsSection>
        )}

        <div className="h-6" />
      </div>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        isPro={isPro}
        reducedMotion={reducedMotion}
      />

      {/* Refresh Preferences Wizard */}
      <RefreshPreferencesModal
        open={refreshModalOpen}
        onClose={() => setRefreshModalOpen(false)}
        onComplete={handleRefreshComplete}
        reducedMotion={reducedMotion}
        currentProfile={ext.readingProfile}
        currentGoal={ext.dailyGoalPreset}
        currentMotivation={ext.motivationPersona}
        currentDyslexia={preferences.accessibility.dyslexiaFriendlyFont}
        currentHighContrast={preferences.accessibility.highContrastMode}
        currentColorBlind={ext.colorBlindMode}
      />

      {/* Auto-save floating toast */}
      <SaveToast visible={saveToastVisible} />

      {/* Action toast */}
      <Toast open={toast.open} message={toast.message} tone={toast.tone} />

      {/* Micro Celebrations */}
      <MicroCelebration event={celebration} reducedMotion={reducedMotion} />

      {/* Screen reader live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>
    </PageTransition>
  );
}
