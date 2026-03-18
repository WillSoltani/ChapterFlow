"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Target,
  Palette,
  Bell,
  Shield,
  ChevronDown,
  Loader2,
  Settings2,
  LogOut,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useToast } from "@/app/book/hooks/useToast";
import { ConfirmModal } from "@/app/book/components/ui/ConfirmModal";
import { Toast } from "@/app/book/components/ui/Toast";
import { cn } from "@/app/book/components/ui/cn";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-(--cf-accent)" : "bg-(--cf-border-strong)"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

function SegPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-(--cf-surface-muted) p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[9px] px-3 py-1.5 text-sm font-medium transition-all",
            value === opt.value
              ? "bg-(--cf-surface-strong) text-(--cf-text-1) shadow-sm"
              : "text-(--cf-text-3) hover:text-(--cf-text-2)"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-(--cf-border) bg-(--cf-surface) shadow-sm">
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--cf-surface-muted) text-(--cf-text-2)">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-[15px] font-semibold text-(--cf-text-1)">{title}</h2>
      </div>
      <div className="px-2 pb-2">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[13px] px-3 py-3 transition-colors hover:bg-(--cf-surface-muted)">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-(--cf-text-1)">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-(--cf-text-3)">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="mx-3 h-px bg-(--cf-divider)" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type BookSettingsClientProps = {
  isAdmin: boolean;
  userEmail: string | null;
  appVersion: string;
};

export function BookSettingsClient({}: BookSettingsClientProps) {
  const { state: preferences, patchSection, hydrated: prefsHydrated } = useBookPreferences();
  const {
    state: onboarding,
    hydrated: onboardingHydrated,
    setDailyGoalMinutes,
    setLearningStyle,
    setReminderTime,
    setStreakMode,
    resetSetup,
  } = useOnboardingState();
  const { toast, showToast } = useToast();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "reset" | "deactivate" | "delete" | null;
  }>({ open: false, type: null });
  const [saveState, setSaveState] = useState<"idle" | "saving">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotRef = useRef<string>("");

  // ------------------------------------------------------------------
  // Auto-save indicator
  // ------------------------------------------------------------------
  const triggerSave = useCallback(() => {
    const snapshot = JSON.stringify(preferences);
    if (snapshot === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshot;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState("idle"), 1400);
  }, [preferences]);

  useEffect(() => {
    if (!prefsHydrated) return;
    triggerSave();
  }, [preferences, prefsHydrated, triggerSave]);

  // ------------------------------------------------------------------
  // Confirm actions
  // ------------------------------------------------------------------
  function handleConfirm() {
    const type = confirmModal.type;
    setConfirmModal({ open: false, type: null });
    if (type === "reset") {
      resetSetup();
      showToast("Setup reset. You'll see onboarding next visit.", "success");
    } else if (type === "deactivate") {
      showToast("Deactivation not yet supported — contact support.", "error");
    } else if (type === "delete") {
      showToast("Deletion not yet supported — contact support.", "error");
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const hydrated = prefsHydrated && onboardingHydrated;

  return (
    <div className="cf-app-shell min-h-screen px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-(--cf-text-1)">
            Settings
          </h1>
          <p className="mt-1 text-sm text-(--cf-text-3)">
            Your preferences are saved automatically.
          </p>
        </div>
        {saveState === "saving" && (
          <div className="flex items-center gap-2 text-xs text-(--cf-text-3)">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Saving…</span>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-2xl space-y-4">

        {/* ── Reading ─────────────────────────────────────────── */}
        <SectionCard icon={BookOpen} title="Reading">
          <SettingRow
            label="Default chapter view"
            description="Which tab opens first when you enter a chapter."
          >
            <SegPicker
              options={[
                { value: "summary" as const, label: "Summary" },
                { value: "examples" as const, label: "Examples" },
                { value: "quiz" as const, label: "Quiz" },
              ]}
              value={hydrated ? preferences.reading.defaultChapterTab : "summary"}
              onChange={(v) => patchSection("reading", { defaultChapterTab: v })}
            />
          </SettingRow>
          <Divider />
          <SettingRow label="Font size" description="Reading text size in chapters.">
            <div className="flex items-center gap-3">
              <span className="w-6 text-right text-xs tabular-nums text-(--cf-text-3)">
                {hydrated ? preferences.reading.fontSize : 16}
              </span>
              <input
                type="range"
                min={13}
                max={20}
                step={1}
                value={hydrated ? preferences.reading.fontSize : 16}
                onChange={(e) =>
                  patchSection("reading", { fontSize: Number(e.target.value) })
                }
                className="w-28 accent-sky-500"
              />
            </div>
          </SettingRow>
          <Divider />
          <SettingRow
            label="Focus mode by default"
            description="Hide sidebar and header when reading."
          >
            <Toggle
              checked={hydrated ? preferences.reading.focusModeDefault : false}
              onChange={(v) => patchSection("reading", { focusModeDefault: v })}
            />
          </SettingRow>
          <Divider />
          <SettingRow label="Progress bar" description="Show chapter completion at the top.">
            <Toggle
              checked={hydrated ? preferences.reading.showProgressBar : true}
              onChange={(v) => patchSection("reading", { showProgressBar: v })}
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Resume where you left off"
            description="Scroll back to your last position automatically."
          >
            <Toggle
              checked={hydrated ? preferences.reading.resumeWhereLeftOff : true}
              onChange={(v) => patchSection("reading", { resumeWhereLeftOff: v })}
            />
          </SettingRow>
        </SectionCard>

        {/* ── Goals ───────────────────────────────────────────── */}
        <SectionCard icon={Target} title="Goals">
          <SettingRow label="Daily reading goal" description="Minutes to read each day.">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setDailyGoalMinutes(
                    Math.max(10, (hydrated ? onboarding.dailyGoalMinutes : 20) - 5)
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--cf-border) text-base leading-none select-none text-(--cf-text-2) transition-colors hover:bg-(--cf-surface-muted)"
              >
                −
              </button>
              <span className="w-14 text-center text-sm font-semibold tabular-nums text-(--cf-text-1)">
                {hydrated ? onboarding.dailyGoalMinutes : 20} min
              </span>
              <button
                type="button"
                onClick={() =>
                  setDailyGoalMinutes(
                    Math.min(240, (hydrated ? onboarding.dailyGoalMinutes : 20) + 5)
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--cf-border) text-base leading-none select-none text-(--cf-text-2) transition-colors hover:bg-(--cf-surface-muted)"
              >
                +
              </button>
            </div>
          </SettingRow>
          <Divider />
          <SettingRow
            label="Learning depth"
            description="How much detail you want in explanations and summaries."
          >
            <SegPicker
              options={[
                { value: "concise" as const, label: "Concise" },
                { value: "balanced" as const, label: "Balanced" },
                { value: "deep" as const, label: "Deep" },
              ]}
              value={hydrated ? onboarding.learningStyle : "balanced"}
              onChange={setLearningStyle}
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Streak tracking"
            description="Build a daily reading streak and get reminded when it's at risk."
          >
            <Toggle
              checked={hydrated ? onboarding.streakMode : true}
              onChange={setStreakMode}
            />
          </SettingRow>
          <Divider />
          <SettingRow label="Weekly chapter goal" description="Chapters to complete each week.">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  patchSection("goals", {
                    weeklyChapterGoal: Math.max(
                      1,
                      (hydrated ? preferences.goals.weeklyChapterGoal : 3) - 1
                    ),
                  })
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--cf-border) text-base leading-none select-none text-(--cf-text-2) transition-colors hover:bg-(--cf-surface-muted)"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums text-(--cf-text-1)">
                {hydrated ? preferences.goals.weeklyChapterGoal : 3}
              </span>
              <button
                type="button"
                onClick={() =>
                  patchSection("goals", {
                    weeklyChapterGoal: Math.min(
                      30,
                      (hydrated ? preferences.goals.weeklyChapterGoal : 3) + 1
                    ),
                  })
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--cf-border) text-base leading-none select-none text-(--cf-text-2) transition-colors hover:bg-(--cf-surface-muted)"
              >
                +
              </button>
            </div>
          </SettingRow>
        </SectionCard>

        {/* ── Appearance ──────────────────────────────────────── */}
        <SectionCard icon={Palette} title="Appearance">
          <SettingRow label="Theme" description="Choose your preferred color scheme.">
            <SegPicker
              options={[
                { value: "dark" as const, label: "Dark" },
                { value: "light" as const, label: "Light" },
                { value: "system" as const, label: "System" },
              ]}
              value={hydrated ? preferences.appearance.theme : "dark"}
              onChange={(v) => patchSection("appearance", { theme: v })}
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Interface density"
            description="How compact or spacious the layout feels."
          >
            <SegPicker
              options={[
                { value: "compact" as const, label: "Compact" },
                { value: "comfortable" as const, label: "Default" },
                { value: "spacious" as const, label: "Spacious" },
              ]}
              value={hydrated ? preferences.appearance.interfaceDensity : "comfortable"}
              onChange={(v) => patchSection("appearance", { interfaceDensity: v })}
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Reduced motion"
            description="Minimize animations and transitions throughout the app."
          >
            <Toggle
              checked={hydrated ? preferences.appearance.reducedMotion : false}
              onChange={(v) => patchSection("appearance", { reducedMotion: v })}
            />
          </SettingRow>
        </SectionCard>

        {/* ── Notifications ───────────────────────────────────── */}
        <SectionCard icon={Bell} title="Notifications">
          <SettingRow
            label="Reading reminders"
            description="Get notified at your preferred time to read."
          >
            <Toggle
              checked={hydrated ? preferences.notifications.readingReminderEnabled : true}
              onChange={(v) =>
                patchSection("notifications", { readingReminderEnabled: v })
              }
            />
          </SettingRow>
          <Divider />
          <SettingRow label="Reminder time" description="When to receive your daily reading nudge.">
            <input
              type="time"
              value={hydrated ? onboarding.reminderTime : "20:00"}
              onChange={(e) => setReminderTime(e.target.value)}
              disabled={hydrated ? !preferences.notifications.readingReminderEnabled : false}
              className="cf-input rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-(--cf-accent-border) disabled:cursor-not-allowed disabled:opacity-40"
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Streak reminders"
            description="Alert when your reading streak is about to break."
          >
            <Toggle
              checked={hydrated ? preferences.notifications.streakReminder : true}
              onChange={(v) => patchSection("notifications", { streakReminder: v })}
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Weekly summary email"
            description="A brief digest of your reading progress each week."
          >
            <Toggle
              checked={
                hydrated ? preferences.notifications.weeklyLearningSummaryEmail : true
              }
              onChange={(v) =>
                patchSection("notifications", { weeklyLearningSummaryEmail: v })
              }
            />
          </SettingRow>
        </SectionCard>

        {/* ── Privacy & Data ──────────────────────────────────── */}
        <SectionCard icon={Shield} title="Privacy & Data">
          <SettingRow
            label="Analytics"
            description="Share anonymous usage data to help improve ChapterFlow."
          >
            <Toggle
              checked={hydrated ? preferences.privacy.analyticsParticipation : true}
              onChange={(v) => patchSection("privacy", { analyticsParticipation: v })}
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Personalized recommendations"
            description="Use your reading history to suggest books you'll love."
          >
            <Toggle
              checked={
                hydrated ? preferences.privacy.personalizedRecommendations : true
              }
              onChange={(v) =>
                patchSection("privacy", { personalizedRecommendations: v })
              }
            />
          </SettingRow>
          <Divider />
          <SettingRow
            label="Save reading history"
            description="Remember which chapters and books you've completed."
          >
            <Toggle
              checked={hydrated ? preferences.privacy.saveReadingHistory : true}
              onChange={(v) => patchSection("privacy", { saveReadingHistory: v })}
            />
          </SettingRow>
          <Divider />
          <div className="flex items-center justify-between gap-4 rounded-[13px] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-(--cf-text-1)">Legal</p>
              <p className="mt-0.5 text-xs text-(--cf-text-3)">
                Review our policies
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <a
                href="/legal/privacy"
                className="font-medium text-(--cf-accent) hover:underline"
              >
                Privacy
              </a>
              <a
                href="/legal/terms"
                className="font-medium text-(--cf-accent) hover:underline"
              >
                Terms
              </a>
              <a
                href="/legal/cookies"
                className="font-medium text-(--cf-accent) hover:underline"
              >
                Cookies
              </a>
            </div>
          </div>
        </SectionCard>

        {/* ── Advanced (collapsible) ───────────────────────────── */}
        <section className="overflow-hidden rounded-[22px] border border-(--cf-border) bg-(--cf-surface) shadow-sm">
          <button
            type="button"
            onClick={() => setAdvancedOpen((p) => !p)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-(--cf-surface-muted)"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--cf-surface-muted) text-(--cf-text-2)">
                <Settings2 className="h-4 w-4" />
              </div>
              <span className="text-[15px] font-semibold text-(--cf-text-1)">
                Advanced
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-(--cf-text-soft) transition-transform",
                advancedOpen && "rotate-180"
              )}
            />
          </button>

          {advancedOpen && (
            <div className="border-t border-(--cf-divider) px-2 pb-2 pt-2">
              {/* Quiz */}
              <div className="px-3 pb-1 pt-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--cf-text-soft)">
                  Quiz
                </p>
              </div>
              <SettingRow
                label="Question style"
                description="Show all questions at once or one at a time."
              >
                <SegPicker
                  options={[
                    { value: "one-by-one" as const, label: "One-by-one" },
                    { value: "all-at-once" as const, label: "All at once" },
                  ]}
                  value={
                    hydrated
                      ? preferences.learning.questionPresentationStyle
                      : "one-by-one"
                  }
                  onChange={(v) =>
                    patchSection("learning", { questionPresentationStyle: v })
                  }
                />
              </SettingRow>
              <Divider />
              <SettingRow
                label="Shuffle questions"
                description="Randomize question order each session."
              >
                <Toggle
                  checked={
                    hydrated ? preferences.learning.shuffleQuestionOrder : false
                  }
                  onChange={(v) =>
                    patchSection("learning", { shuffleQuestionOrder: v })
                  }
                />
              </SettingRow>
              <Divider />
              <SettingRow
                label="Retry incorrect only"
                description="Loop through only the questions you got wrong."
              >
                <Toggle
                  checked={hydrated ? preferences.learning.retryIncorrectOnly : true}
                  onChange={(v) =>
                    patchSection("learning", { retryIncorrectOnly: v })
                  }
                />
              </SettingRow>

              {/* Library */}
              <div className="px-3 pb-1 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--cf-text-soft)">
                  Library
                </p>
              </div>
              <SettingRow
                label="Default sort order"
                description="How books are ordered in your library."
              >
                <select
                  value={
                    hydrated
                      ? preferences.library.defaultLibrarySorting
                      : "recommended"
                  }
                  onChange={(e) =>
                    patchSection("library", {
                      defaultLibrarySorting: e.target
                        .value as typeof preferences.library.defaultLibrarySorting,
                    })
                  }
                  className="cf-input rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-(--cf-accent-border)"
                >
                  <option value="recommended">Recommended</option>
                  <option value="recently-opened">Recently opened</option>
                  <option value="shortest-read">Shortest</option>
                  <option value="longest-read">Longest</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </SettingRow>
              <Divider />
              <SettingRow
                label="Show reading time estimates"
                description="Display estimated reading time per book."
              >
                <Toggle
                  checked={
                    hydrated ? preferences.library.showReadingTimeEstimates : true
                  }
                  onChange={(v) =>
                    patchSection("library", { showReadingTimeEstimates: v })
                  }
                />
              </SettingRow>

              {/* Accessibility */}
              <div className="px-3 pb-1 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--cf-text-soft)">
                  Accessibility
                </p>
              </div>
              <SettingRow label="Larger text" description="Increase text size across the app.">
                <Toggle
                  checked={
                    hydrated ? preferences.accessibility.largerTextMode : false
                  }
                  onChange={(v) =>
                    patchSection("accessibility", { largerTextMode: v })
                  }
                />
              </SettingRow>
              <Divider />
              <SettingRow
                label="High contrast"
                description="Sharper color contrast for readability."
              >
                <Toggle
                  checked={
                    hydrated ? preferences.accessibility.highContrastMode : false
                  }
                  onChange={(v) =>
                    patchSection("accessibility", { highContrastMode: v })
                  }
                />
              </SettingRow>
              <Divider />
              <SettingRow
                label="Dyslexia-friendly font"
                description="Switch to OpenDyslexic for reading text."
              >
                <Toggle
                  checked={
                    hydrated ? preferences.accessibility.dyslexiaFriendlyFont : false
                  }
                  onChange={(v) =>
                    patchSection("accessibility", { dyslexiaFriendlyFont: v })
                  }
                />
              </SettingRow>

              {/* Account */}
              <div className="px-3 pb-1 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--cf-text-soft)">
                  Account
                </p>
              </div>
              <div className="space-y-1 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal({ open: true, type: "reset" })}
                  className="flex w-full items-center gap-2.5 rounded-[13px] px-3 py-2.5 text-sm font-medium text-(--cf-text-2) transition-colors hover:bg-(--cf-surface-muted)"
                >
                  <RotateCcw className="h-4 w-4 text-(--cf-text-soft)" />
                  Reset onboarding setup
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal({ open: true, type: "deactivate" })}
                  className="flex w-full items-center gap-2.5 rounded-[13px] px-3 py-2.5 text-sm font-medium text-(--cf-warning-text) transition-colors hover:bg-(--cf-warning-soft)"
                >
                  <LogOut className="h-4 w-4" />
                  Deactivate account
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal({ open: true, type: "delete" })}
                  className="flex w-full items-center gap-2.5 rounded-[13px] px-3 py-2.5 text-sm font-medium text-(--cf-danger-text) transition-colors hover:bg-(--cf-danger-soft)"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete account &amp; all data
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="h-6" />
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={confirmModal.open && confirmModal.type === "reset"}
        title="Reset onboarding?"
        description="Your reading preferences won't be affected — only the onboarding flow will reset. You'll see it again on your next visit."
        confirmLabel="Reset"
        tone="primary"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal({ open: false, type: null })}
      />
      <ConfirmModal
        open={confirmModal.open && confirmModal.type === "deactivate"}
        title="Deactivate account?"
        description="Your account will be suspended. You can reactivate by signing back in. This does not delete your data."
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal({ open: false, type: null })}
      />
      <ConfirmModal
        open={confirmModal.open && confirmModal.type === "delete"}
        title="Delete everything?"
        description={
          <span>
            This permanently erases your account, reading history, quiz results, and notes.{" "}
            <strong className="text-(--cf-danger-text)">This cannot be undone.</strong>
          </span>
        }
        confirmLabel="Delete permanently"
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal({ open: false, type: null })}
      />

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />
    </div>
  );
}
