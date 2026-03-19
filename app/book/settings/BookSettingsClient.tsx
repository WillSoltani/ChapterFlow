"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Target,
  Palette,
  Bell,
  Shield,
  ChevronDown,
  Key,
  Loader2,
  Settings2,
  LogOut,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import {
  type QuizIntensity,
  type MotivationStyle,
  useOnboardingState,
} from "@/app/book/hooks/useOnboardingState";
import { useBookEntitlements } from "@/app/book/hooks/useBookEntitlements";
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
// License key section
// ---------------------------------------------------------------------------

function LicenseKeySection() {
  const { billingState, redeemLicenseKey } = useBookEntitlements(true);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const entitlement = billingState.payload?.entitlement;
  const hasActiveLicense =
    entitlement?.plan === "PRO" &&
    entitlement.proSource === "license" &&
    entitlement.licenseExpiresAt != null;

  const formattedExpiry = hasActiveLicense && entitlement?.licenseExpiresAt
    ? new Date(entitlement.licenseExpiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setStatus("loading");
    setMessage("");
    const error = await redeemLicenseKey(trimmed);
    if (error) {
      setStatus("error");
      setMessage(error);
    } else {
      setStatus("success");
      setMessage("Pro access activated! Your plan has been upgraded.");
      setCode("");
    }
  }

  return (
    <section className="overflow-hidden rounded-[22px] border border-(--cf-border) bg-(--cf-surface) shadow-sm">
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--cf-surface-muted) text-(--cf-text-2)">
          <Key className="h-4 w-4" />
        </div>
        <h2 className="text-[15px] font-semibold text-(--cf-text-1)">License Key</h2>
      </div>
      <div className="px-2 pb-4">
        <div className="rounded-[13px] px-3 py-2">
          {hasActiveLicense && formattedExpiry ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-(--cf-success-border) bg-(--cf-success-soft) px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--cf-success-text)" />
              <div>
                <p className="text-sm font-semibold text-(--cf-success-text)">Pro access active</p>
                <p className="mt-0.5 text-xs text-(--cf-text-3)">
                  Your free-pass license is active until{" "}
                  <span className="font-medium text-(--cf-text-2)">{formattedExpiry}</span>.
                  {entitlement?.licenseKey && (
                    <span className="ml-1 font-mono text-(--cf-text-soft)">
                      ({entitlement.licenseKey})
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : null}

          <p className="mb-3 text-xs leading-relaxed text-(--cf-text-3)">
            Have a free-pass license key? Enter it below to activate Pro access for one month at no
            charge.
          </p>
          <form onSubmit={handleRedeem} className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (status !== "idle") { setStatus("idle"); setMessage(""); }
              }}
              placeholder="CF-XXXX-XXXX-XXXX"
              maxLength={17}
              spellCheck={false}
              autoComplete="off"
              className="cf-input min-w-0 flex-1 rounded-xl px-3 py-2 font-mono text-sm uppercase tracking-widest"
            />
            <button
              type="submit"
              disabled={status === "loading" || code.trim().length === 0}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)",
                status === "loading"
                  ? "cursor-wait opacity-60 bg-(--cf-surface-muted) text-(--cf-text-2) border border-(--cf-border)"
                  : "bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) text-white shadow-sm hover:brightness-105 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Redeem"
              )}
            </button>
          </form>

          {status === "success" && (
            <div className="mt-3 flex items-center gap-2 text-sm text-(--cf-success-text)">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}
          {status === "error" && (
            <div className="mt-3 flex items-center gap-2 text-sm text-(--cf-danger-text)">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
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
  const router = useRouter();
  const { state: preferences, patchSection, hydrated: prefsHydrated } = useBookPreferences();
  const {
    state: onboarding,
    hydrated: onboardingHydrated,
    setDailyGoalMinutes,
    setLearningStyle,
    setQuizIntensity,
    setReminderTime,
    setStreakMode,
    setMotivationStyle,
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

  // Persist onboarding-derived prefs (learningStyle, quizIntensity, streakMode,
  // motivationStyle, dailyGoalMinutes, reminderTime) to the backend profile.
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
            <p className="mt-1 text-sm text-(--cf-text-3)">
              Your preferences are saved automatically.
            </p>
          </div>
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
            label="Quiz difficulty"
            description="How hard the quiz questions are when you take a chapter quiz."
          >
            <SegPicker
              options={[
                { value: "easy" as const satisfies QuizIntensity, label: "Easy" },
                { value: "standard" as const satisfies QuizIntensity, label: "Standard" },
                { value: "challenging" as const satisfies QuizIntensity, label: "Challenging" },
              ]}
              value={hydrated ? onboarding.quizIntensity : "standard"}
              onChange={setQuizIntensity}
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
          <SettingRow
            label="Motivation style"
            description="Tone used in nudges, streaks, and progress messages."
          >
            <SegPicker
              options={[
                { value: "gentle" as const satisfies MotivationStyle, label: "Gentle" },
                { value: "direct" as const satisfies MotivationStyle, label: "Direct" },
                { value: "competitive" as const satisfies MotivationStyle, label: "Competitive" },
              ]}
              value={hydrated ? onboarding.motivationStyle : "gentle"}
              onChange={setMotivationStyle}
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

        {/* ── License Key ─────────────────────────────────────── */}
        <LicenseKeySection />

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
