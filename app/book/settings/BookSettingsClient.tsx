"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { DUR } from "@/lib/motion";
import {
  ArrowLeft,
  BookOpen,
  Target,
  Palette,
  Accessibility,
  Bell,
  User,
  Keyboard,
  LogOut,
  Settings2,
} from "lucide-react";

// Existing hooks
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookEntitlements } from "@/app/book/hooks/useBookEntitlements";
import type { BillingInterval } from "@/app/book/hooks/useBookEntitlements";
import { MONTHLY_PRICE_WITH_CURRENCY } from "@/lib/pricing";
import { useToast } from "@/app/book/hooks/useToast";
import { Toast } from "@/app/book/components/ui/Toast";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { fetchBookJson, redirectToReauth, isReauthResponse } from "@/app/book/_lib/book-api";

// New settings hooks
import {
  buildReminderSchedulePatch,
  buildReadingReminderTogglePatch,
} from "./lib/reminder-consent-core";
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
import { performLogout } from "@/lib/logout";
import type { RefreshResult } from "./components/RefreshPreferencesModal";

// Constants
import { READING_PROFILES, DAILY_GOAL_OPTIONS, MOTIVATION_OPTIONS } from "./constants/profiles";
import {
  QUIZ_STYLE_TO_INTENSITY,
  PERSONA_TO_MOTIVATION,
  MOTIVATION_TO_PERSONA,
  DAILY_GOAL_TIERS,
} from "./constants/defaults";
import { TTS_SPEED_OPTIONS, snapTtsSpeedToOption } from "./constants/tts";

// Types
import type {
  ReadingProfile,
  MotivationPersona,
  DailyGoalPreset,
  CelebrationEvent,
  StreakMode,
  FontFamily,
  LineSpacing,
  LetterSpacing,
  ColorBlindMode,
} from "./types/settings";
import type { LearningStyle, QuizIntensity, MotivationStyle } from "@/app/book/hooks/useOnboardingState";

// Finding A: one user-facing depth vocabulary end to end. Settings' reading
// profiles now read with the SAME names a buyer saw on Pricing (Lite / Standard
// / Deeper) instead of the unrelated "Quick Learner / Balanced Reader / Deep
// Diver" system. The descriptive old name is kept as a card sub-label so the
// relabel doesn't disorient existing users. Source strings stay in profiles.ts;
// this is a display override at the (owned) render sites.
const DEPTH_DISPLAY: Record<ReadingProfile, string> = {
  quick: "Lite",
  balanced: "Standard",
  deep: "Deeper",
};

// Finding C: the in-page section index (sticky left rail ≥lg, horizontal pill
// row <lg). ids + icons mirror the six SettingsSection blocks below; `title`
// matches each SettingsSection's aria-label so goToSection can find its anchor
// without owning SettingsSection.tsx.
const SETTINGS_SECTION_INDEX = [
  { id: "reading", label: "Reading", title: "Reading Experience", icon: BookOpen },
  { id: "goals", label: "Goals", title: "Goals & Motivation", icon: Target },
  { id: "appearance", label: "Appearance", title: "Appearance", icon: Palette },
  { id: "accessibility", label: "Accessibility", title: "Accessibility", icon: Accessibility },
  { id: "notifications", label: "Notifications", title: "Notifications", icon: Bell },
  { id: "account", label: "Account", title: "Account & Subscription", icon: User },
] as const;

// H26: The reading-reminder cron resolves each user's send time from the
// device timezone stored in settings.notifications.reminderTimezone. Fall back
// to "UTC" (the cron's own default) if the browser can't report a zone.
function detectReminderTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type BookSettingsClientProps = {
  isAdmin: boolean;
  userEmail: string | null;
  appVersion: string;
  /** Optional billing-interval pre-selection carried from an upgrade deep-link
   *  (e.g. the landing "Annual" toggle). Clamped to an available tier downstream. */
  initialUpgradeInterval?: BillingInterval;
};

export function BookSettingsClient({ isAdmin, userEmail, appVersion, initialUpgradeInterval }: BookSettingsClientProps) {
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
  const { billingState, launchBillingAction, redeemLicenseKey } =
    useBookEntitlements(true);
  const { toast, showToast } = useToast();

  // Identity + nav search for the shared TopNav. Settings has its own in-page
  // search (useSettingsSearch); the global search panel stays disabled here.
  const { identity: viewerIdentity } = useBookViewer();
  const viewerName = viewerIdentity.displayName || "Reader";
  const navSearchRef = useRef<HTMLInputElement | null>(null);
  const [navSearch, setNavSearch] = useState("");

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
    // Inline the logic from individual handlers to avoid duplicate toasts,
    // redundant state updates, and unwanted celebrations during a bulk refresh.
    const preset = READING_PROFILES.find((p) => p.id === result.profile);
    if (preset) {
      const learningModeMap: Record<string, "guided" | "standard" | "challenge"> = {
        concise: "guided", balanced: "standard", deep: "challenge",
      };
      patchExt({
        readingProfile: result.profile,
        profileCustomized: false,
        quizStyle: preset.defaults.quizStyle,
        learningMode: learningModeMap[preset.defaults.learningStyle] ?? "standard",
        dailyGoalPreset: result.goal,
        motivationPersona: result.motivation,
        colorBlindMode: result.colorBlind,
        personalizationDismissed: false,
      });
      setLearningStyle(preset.defaults.learningStyle);
      setQuizIntensity(
        QUIZ_STYLE_TO_INTENSITY[preset.defaults.quizStyle] as QuizIntensity
      );
      patchSection("reading", { fontSize: preset.defaults.fontSize });
    }
    setDailyGoalMinutes(result.goal);
    patchSection("accessibility", {
      dyslexiaFriendlyFont: result.dyslexia,
      highContrastMode: result.highContrast,
    });
    if (result.dyslexia) patchExt({ fontFamily: "opendyslexic" });
    showToast("Preferences updated!", "success");
    triggerToast();
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

  // H26: The reading-reminder cron reads the per-user send time exclusively from
  // settings.notifications.reminderTimeLocal / reminderTimezone (defaulting to
  // 20:00 UTC when unset). The TimePicker historically only updated the
  // onboarding snapshot (persisted as profile.reminderTime, which no Lambda
  // reads), so every custom time silently fired at 20:00 UTC. Persist the
  // canonical fields directly: they live outside BookPreferencesState, so they
  // ride a dedicated PATCH rather than the preferences full-state sync — the
  // settings allow-list already accepts them and mergeSettings preserves them.
  const persistReminderSchedule = useCallback((timeLocal: string) => {
    fetchBookJson("/app/api/book/me/settings", {
      method: "PATCH",
      body: JSON.stringify(
        buildReminderSchedulePatch(timeLocal, detectReminderTimezone()),
      ),
    }).catch(() => {});
  }, []);

  // F4: The reading-reminder cron only sends the reminder EMAIL when the user
  // has opted into the email channel (`settings.notifications.channels.email ===
  // true`, the canonical opt-IN gate shared by every nudge sender — see PR 309).
  // Nothing in the settings UI ever wrote that flag, so the email NEVER sent and
  // users got only the in-app notification. Enabling reading reminders is the
  // explicit opt-in moment: record `channels.email: true` on the same dedicated
  // PATCH that carries the canonical send-time fields. Disabling reminders does
  // NOT clear it — that would silently opt the user out of unrelated email
  // categories (weekly digest, welcome-back); the one-click unsubscribe route is
  // the sole email opt-out path. (Deep-merge means we only ADD channels.email.)
  const persistReminderEmailOptIn = useCallback((enabled: boolean) => {
    const patch = buildReadingReminderTogglePatch(
      enabled,
      detectReminderTimezone(),
      onboarding.reminderTime || undefined,
    );
    if (!patch) return;
    fetchBookJson("/app/api/book/me/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).catch(() => {});
  }, [onboarding.reminderTime]);

  // H26 backfill: users who chose a reminder time before this fix have
  // profile.reminderTime but no settings.notifications.reminderTimeLocal/zone,
  // so the cron defaults them to 20:00 UTC. On first load, if reminders are on
  // and the canonical fields are absent, seed them from the onboarding time plus
  // the device timezone. Deferred past the preferences hook's debounced
  // full-state sync (≤500ms) so the read sees a settled row and the write lands
  // last (those keys are never carried by the full-state sync, so it can only
  // preserve them, never overwrite).
  //
  // F4 backfill: the same one-shot effect also seeds the email opt-in
  // (`channels.email: true`) for users who already had reminders ON before the
  // opt-in was ever written — including those H26 already gave a reminderTime, who
  // would otherwise short-circuit the seed below. Without this their reminder
  // email stays gated off forever (the cron requires channels.email === true).
  const reminderBackfilledRef = useRef(false);
  useEffect(() => {
    if (!hydrated || reminderBackfilledRef.current) return;
    if (!preferences.notifications.readingReminderEnabled) return;
    reminderBackfilledRef.current = true;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchBookJson<{
        settings: {
          notifications?: {
            reminderTimeLocal?: unknown;
            reminderTimezone?: unknown;
            channels?: { email?: unknown };
          };
        } | null;
      }>("/app/api/book/me/settings")
        .then((payload) => {
          if (cancelled) return;
          const notif = payload.settings?.notifications;
          const hasSchedule =
            typeof notif?.reminderTimeLocal === "string" &&
            typeof notif?.reminderTimezone === "string";
          if (!hasSchedule) {
            // Seeding the schedule already carries channels.email: true.
            persistReminderSchedule(onboarding.reminderTime || "20:00");
            return;
          }
          // Schedule already canonical (H26) — only the email opt-in may be missing.
          if (notif?.channels?.email !== true) {
            persistReminderEmailOptIn(true);
          }
        })
        .catch(() => {});
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    hydrated,
    preferences.notifications.readingReminderEnabled,
    onboarding.reminderTime,
    persistReminderSchedule,
    persistReminderEmailOptIn,
  ]);

  // Derived state
  const isPro = billingState.payload?.entitlement.plan === "PRO";
  const plan = billingState.payload?.entitlement.plan ?? "FREE";
  const price = billingState.payload?.paywall.price ?? MONTHLY_PRICE_WITH_CURRENCY;
  // Free-tier slot count is server-driven (BOOK_FREE_SLOTS_DEFAULT, per-user
  // overridable) — never hardcode it in the UI.
  const freeBookSlots = billingState.payload?.entitlement.freeBookSlots ?? 2;

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
    announce(`Reading profile changed to ${DEPTH_DISPLAY[profile]}`);
    showToast("Profile applied", "success");
    triggerToast();
  }

  // PREF-1: the Quiz Style control was removed from this screen (no quiz route
  // reads quizStyle/quizIntensity — they key off difficulty + tone), so the
  // currentQuizStyle selector + handleQuizStyleChange handler were dead code and
  // are gone. The stored field + onboarding→profile seeding stay intact, so a
  // future quiz-style implementation can re-add a control cheaply.

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
    // L79: turning streak tracking off must also stop "streak about to expire"
    // nudges. The streak-at-risk cron gates on settings.notifications
    // .streakReminderEnabled, so flip it off here. Leave it untouched when
    // re-enabling so we never silently turn a notification back on — the user
    // can re-enable Streak alerts themselves.
    if (mode === "off") {
      patchSection("notifications", { streakReminderEnabled: false });
    }
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
    // Finding A: collapsed-section preview uses the canonical depth name too.
    const profileLabel = DEPTH_DISPLAY[ext.readingProfile] ?? "Custom";
    return `${profileLabel} · ${preferences.reading.fontSize}px`;
  }

  function getGoalsSummary() {
    const daily = ext.dailyGoalPreset;
    const streak = ext.streakMode === "off" ? "Off" : ext.streakMode === "standard" ? "Standard" : "Flexible";
    return `${daily} min/day · ${streak}`;
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
    if (preferences.notifications.streakReminderEnabled && ext.streakMode !== "off") {
      parts.push("Streak alerts on");
    }
    if (preferences.notifications.weeklyDigestEnabled) {
      parts.push("Weekly digest on");
    }
    if (preferences.notifications.welcomeBackEnabled) {
      parts.push("Welcome-back on");
    }
    return parts.length > 0 ? parts.join(" · ") : "All off";
  }

  function getAccountSummary() {
    return plan === "PRO"
      ? "Pro plan"
      : `Free plan · ${freeBookSlots} book${freeBookSlots === 1 ? "" : "s"}`;
  }

  // --- Search helpers ---
  function isSectionVisible(sectionId: string) {
    if (!isSearching || !results) return true;
    return results.matchedSections.has(sectionId);
  }

  function isSectionDimmed(sectionId: string) {
    if (!isSearching) return false;
    return !isSectionVisible(sectionId);
  }

  // While searching, force-expand a matched (but collapsed) section so the
  // matched row is actually visible instead of hidden behind a collapsed header.
  function isSectionShown(sectionId: string) {
    if (isSearching && results?.matchedSections.has(sectionId)) return true;
    return isSectionExpanded(sectionId);
  }

  // Finding C: section-index jump. Expand the target (a non-mutating UI toggle)
  // then scroll its SettingsSection (matched by aria-label, since SettingsSection
  // is not owned here) to just below the sticky TopNav (~64px + breathing room).
  function goToSection(sectionId: string, sectionTitle: string) {
    if (!isSectionExpanded(sectionId)) toggleSection(sectionId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`section[aria-label="${sectionTitle}"]`);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageTransition className="cf-app-shell min-h-screen pb-10">
      <TopNav
        name={viewerName}
        avatarUrl={viewerIdentity.avatarDataUrl}
        activeTab="settings"
        searchQuery={navSearch}
        onSearchChange={setNavSearch}
        searchInputRef={navSearchRef}
        showSearch={false}
        showGlobalSearchPanel={false}
        logoVariant="dashboard"
      />
      {/* Skip-link target (TopNav renders the shared "Skip to main content"
          link to the #main anchor). This is the first content element AFTER
          TopNav, so focusing it actually bypasses the nav (per batch 12 / PR 148:
          the cf-app-shell wrapper contains TopNav, so it must NOT be the target). */}
      <div id="main" tabIndex={-1} className="px-4 pt-7 sm:px-6 focus:outline-none">
      {/* Header */}
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="cf-pressable cf-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface) text-(--cf-text-2) transition hover:bg-(--cf-surface-muted)"
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

      <div className="mx-auto max-w-5xl">
        {/* Finding C: section index — mobile/tablet horizontal pill row.
            Scrolls internally (overflow-x-auto) so the PAGE never gains
            horizontal scroll. Hidden ≥lg, where the sticky left rail takes over. */}
        <nav
          aria-label="Settings sections"
          className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden"
        >
          {SETTINGS_SECTION_INDEX.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToSection(s.id, s.title)}
              className="cf-pressable cf-focus inline-flex shrink-0 items-center gap-1.5 rounded-full border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-xs font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)"
            >
              <s.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8">
          {/* Desktop sticky section rail (≥lg) */}
          <nav aria-label="Settings sections" className="hidden lg:block">
            <div className="sticky top-24 space-y-0.5">
              {SETTINGS_SECTION_INDEX.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSection(s.id, s.title)}
                  className="cf-pressable cf-focus flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-(--cf-text-2) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)"
                >
                  <s.icon className="h-4 w-4 shrink-0 text-(--cf-text-soft)" aria-hidden="true" />
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content column */}
          <div className="min-w-0 space-y-4">
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
            expanded={isSectionShown("reading")}
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
                    // Finding A: canonical depth name (Lite/Standard/Deeper),
                    // with the old descriptive name kept as a sub-label.
                    label: DEPTH_DISPLAY[p.id],
                    description: `${p.label} · ${p.description}`,
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
                    Listen to chapters read aloud. Open any chapter and tap the
                    speaker icon to start playback &mdash; perfect for commutes
                    or multitasking.
                  </p>

                  {/* SET-2: Playback speed is the one TTS preference with a real
                      backend — it seeds and persists the reader AudioPlayer's
                      speed. Voice / auto-advance controls stay removed: there is
                      no multi-voice narration backend, and auto-advance conflicts
                      with quiz-gated chapter unlocks. */}
                  <div className="mt-3">
                    <SettingRow
                      label="Playback speed"
                      description="How fast chapters are read aloud. Takes effect the next time you open the player."
                    >
                      <SegmentedControl
                        groupId="seg-tts-speed"
                        options={TTS_SPEED_OPTIONS.map((s) => ({ value: String(s), label: `${s}×` }))}
                        value={hydrated ? String(snapTtsSpeedToOption(ext.ttsSpeed)) : "1"}
                        onChange={(v) => { patchExt({ ttsSpeed: Number(v) }); announce(`Playback speed changed to ${v}x`); triggerToast(); }}
                        label="Text-to-speech playback speed"
                        reducedMotion={reducedMotion}
                      />
                    </SettingRow>
                  </div>
                </>
              ) : (
                <ProFeatureCard
                  icon="&#128266;"
                  title="Text-to-speech"
                  description="Listen to chapters read aloud while you walk, cook, or commute."
                  detailDescription="Text-to-speech lets you listen to any chapter read aloud with natural-sounding narration. Open any chapter in the reader and tap the speaker to start, so you can learn hands-free while you walk, cook, or commute."
                  reducedMotion={reducedMotion}
                  onUpgrade={() => launchBillingAction("upgrade")}
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
            expanded={isSectionShown("goals")}
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
                <CardSelector<string>
                  // Finding B: labels/subtext/"Most popular" come from the shared
                  // DAILY_GOAL_TIERS (single source of truth, also consumed by
                  // onboarding StepPace). DAILY_GOAL_OPTIONS is kept ONLY for its
                  // per-value emoji/tint styling, looked up by value.
                  options={DAILY_GOAL_TIERS.map((tier) => {
                    const style = DAILY_GOAL_OPTIONS.find((o) => o.value === tier.value);
                    return {
                      value: String(tier.value),
                      emoji: style?.emoji ?? "⏱️",
                      label: tier.name,
                      description: tier.subtext,
                      prominentValue: tier.minutesLabel,
                      tint: style?.tint,
                      selectedTint: style?.selectedTint,
                      badge: tier.recommended ? "Most popular" : undefined,
                    };
                  })}
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
              description="Set a weekly chapter target to aim for."
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
            <div className="rounded-lg px-3 py-3 transition-colors hover:bg-(--cf-surface-muted)">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--cf-text-1)">Streak mode</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={ext.streakMode}
                      initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: DUR.micro }}
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
                  transition={reducedMotion ? { duration: 0 } : { duration: DUR.fast }}
                >
                  <SettingRow
                    label="Skip days in a row"
                    description="Days you can miss in a row without losing your streak."
                  >
                    <Stepper
                      value={ext.streakSkipDays}
                      onChange={(v) => { patchExt({ streakSkipDays: v }); announce(`Skip days in a row changed to ${v}`); triggerToast(); }}
                      min={1}
                      max={3}
                      label="Skip days in a row"
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
                    transition={{ duration: DUR.fast }}
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
                  onUpgrade={() => launchBillingAction("upgrade")}
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
            expanded={isSectionShown("appearance")}
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
                  : "Automatically switch to dark mode during evening hours while you're reading."
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
                  transition={reducedMotion ? { duration: 0 } : { duration: DUR.fast }}
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
            expanded={isSectionShown("accessibility")}
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
            expanded={isSectionShown("notifications")}
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
                onChange={(v) => { patchSection("notifications", { readingReminderEnabled: v }); persistReminderEmailOptIn(v); announce(`Reading reminders ${v ? "enabled" : "disabled"}`); triggerToast(); }}
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
                  transition={reducedMotion ? { duration: 0 } : { duration: DUR.micro }}
                >
                  <SettingRow
                    id="reminder-time"
                    label="Reminder time"
                    description="When to receive your daily reading nudge."
                  >
                    <TimePicker
                      value={hydrated ? onboarding.reminderTime || "20:00" : "20:00"}
                      onChange={(v) => { setReminderTime(v); persistReminderSchedule(v); announce(`Reminder time changed to ${v}`); triggerToast(); }}
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
                  transition={reducedMotion ? { duration: 0 } : { duration: DUR.micro }}
                >
                  <SettingRow
                    id="streak-alerts"
                    label="Streak alerts"
                    description="Get a heads-up when your reading streak is about to expire."
                  >
                    <ToggleSwitch
                      checked={hydrated ? preferences.notifications.streakReminderEnabled : true}
                      onChange={(v) => { patchSection("notifications", { streakReminderEnabled: v }); announce(`Streak alerts ${v ? "enabled" : "disabled"}`); triggerToast(); }}
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
                  transition={reducedMotion ? { duration: 0 } : { duration: DUR.micro }}
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
                checked={hydrated ? preferences.notifications.weeklyDigestEnabled : true}
                onChange={(v) => { patchSection("notifications", { weeklyDigestEnabled: v }); announce(`Weekly summary email ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Weekly summary email"
              />
            </SettingRow>

            <Divider />

            {/* 5F. Welcome-back Emails */}
            <SettingRow
              id="welcome-back"
              label="Welcome-back emails"
              description="A friendly email if you've been away for a while, with a bonus to welcome you back."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.notifications.welcomeBackEnabled : true}
                onChange={(v) => { patchSection("notifications", { welcomeBackEnabled: v }); announce(`Welcome-back emails ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Welcome-back emails"
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
            expanded={isSectionShown("account")}
            onToggle={() => toggleSection("account")}
            reducedMotion={reducedMotion}
            dimmed={isSectionDimmed("account")}
          >
            {/* 6A. Subscription Status */}
            <div className="px-3 py-3" id="subscription">
              <SubscriptionCard
                plan={plan}
                freeBookSlots={freeBookSlots}
                currentPeriodEnd={billingState.payload?.entitlement.currentPeriodEnd}
                cancelAtPeriodEnd={billingState.payload?.entitlement.cancelAtPeriodEnd}
                proSource={billingState.payload?.entitlement.proSource}
                price={price}
                pricingTiers={billingState.payload?.paywall.pricingTiers}
                initialInterval={initialUpgradeInterval}
                onUpgrade={(interval) => launchBillingAction("upgrade", interval)}
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
              description="Off by default. Help improve ChapterFlow by sharing device, performance, and navigation data, plus an approximate (city-level) location. We never sell this data or use it for ads. See our Privacy Policy for details."
            >
              <ToggleSwitch
                checked={hydrated ? preferences.privacy.analyticsParticipation : false}
                onChange={(v) => { patchSection("privacy", { analyticsParticipation: v }); announce(`Usage analytics ${v ? "enabled" : "disabled"}`); triggerToast(); }}
                label="Share usage analytics"
              />
            </SettingRow>

            <Divider />

            <SettingRow
              id="reading-history"
              label="Save reading history"
              description="Save your daily reading activity to power your streaks and reading history."
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
              description="Download your reading history, notes, bookmarks, and quiz results."
            >
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="cf-pressable cf-btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
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
                className="cf-pressable cf-btn-secondary rounded-xl px-4 py-2 text-sm font-medium"
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

            {/* 6F. Sign out */}
            <div className="px-3">
              <div className="mt-4 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-(--cf-text-3)">
                  Account
                </p>
                {userEmail && (
                  <p className="mt-1.5 text-sm text-(--cf-text-2)">
                    Signed in as{" "}
                    <span className="font-medium text-(--cf-text-1)">{userEmail}</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={performLogout}
                  className="cf-pressable cf-focus mt-3 flex w-full items-center gap-2.5 rounded-xl border border-(--cf-border) px-4 py-3 text-left text-sm font-medium text-(--cf-text-2) transition-colors hover:bg-(--cf-accent-muted)"
                >
                  <LogOut className="h-4 w-4 text-(--cf-text-3)" />
                  <div>
                    <span className="text-(--cf-text-1)">Sign out</span>
                    <p className="text-xs text-(--cf-text-3)">
                      Sign out of ChapterFlow on this device.
                    </p>
                  </div>
                </button>
                {isAdmin && (
                  <a
                    href="/book/admin"
                    className="cf-pressable cf-focus mt-2 flex w-full items-center gap-2.5 rounded-xl border border-(--cf-border) px-4 py-3 text-left text-sm font-medium text-(--cf-accent) transition-colors hover:bg-(--cf-accent-muted)"
                  >
                    <Settings2 className="h-4 w-4" />
                    <div>
                      <span>Admin dashboard</span>
                      <p className="text-xs text-(--cf-text-3)">
                        Manage catalog, users, and billing.
                      </p>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* 6G. Danger Zone */}
            <div className="px-3">
              <DangerZone
                onDeactivate={async () => {
                  try {
                    const res = await fetch("/app/api/book/me/account/deactivate", { method: "POST" });
                    if (res.ok) {
                      window.location.href = "/auth/logout";
                    } else if (await isReauthResponse(res)) {
                      // Step-up auth (#5): stale session → force a fresh login and
                      // return to settings to retry.
                      redirectToReauth("/book/settings");
                    } else {
                      showToast("Failed to deactivate account. Please try again.", "error");
                    }
                  } catch {
                    showToast("Failed to deactivate account. Please try again.", "error");
                  }
                }}
                onDelete={async () => {
                  try {
                    const res = await fetch("/app/api/book/me/account/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ confirm: "DELETE" }),
                    });
                    if (res.ok) {
                      window.location.href = "/auth/logout";
                    } else if (await isReauthResponse(res)) {
                      // Step-up auth (#5): self-delete requires a recent sign-in.
                      // Force a fresh login and return to settings to retry.
                      redirectToReauth("/book/settings");
                    } else {
                      showToast("Failed to delete account. Please try again.", "error");
                    }
                  } catch {
                    showToast("Failed to delete account. Please try again.", "error");
                  }
                }}
                reducedMotion={reducedMotion}
              />
            </div>
          </SettingsSection>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-(--cf-text-3)">
          <span>ChapterFlow</span>
          <span>&middot;</span>
          <span>v{appVersion}</span>
        </div>
        <div className="h-6" />
          </div>{/* content column */}
        </div>{/* section-rail grid */}
      </div>{/* max-w-5xl */}
      </div>{/* #main skip-target */}

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
