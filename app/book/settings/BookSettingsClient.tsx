"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Brain,
  CreditCard,
  Download,
  Eye,
  Gauge,
  GraduationCap,
  Grid2x2,
  HandHelping,
  LayoutPanelTop,
  Loader2,
  Lock,
  Palette,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Target,
  Upload,
  UserCog,
  Wand2,
} from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { Button } from "@/app/book/components/ui/Button";
import { ConfirmModal } from "@/app/book/components/ui/ConfirmModal";
import { Toast } from "@/app/book/components/ui/Toast";
import { BOOKS_CATALOG } from "@/app/book/data/booksCatalog";
import { useBookEntitlements } from "@/app/book/hooks/useBookEntitlements";
import { useBookPreferences } from "@/app/book/hooks/useBookPreferences";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import {
  type LearningStyle,
  type QuizIntensity,
  useOnboardingState,
} from "@/app/book/hooks/useOnboardingState";
import { useToast } from "@/app/book/hooks/useToast";
import {
  ChipsRow,
  DangerActionCard,
  InlineSummaryStat,
  PreviewCard,
  SectionNav,
  type SectionNavItem,
  SectionPill,
  SegmentedControl,
  SelectRow,
  SettingGroup,
  SettingsSearchBar,
  SettingsSectionCard,
  SliderRow,
  ToggleRow,
} from "@/app/book/settings/components/SettingsPrimitives";

type BookSettingsClientProps = {
  isAdmin: boolean;
  userEmail: string | null;
  appVersion: string;
};

type ConfirmActionKind =
  | "clear-reading-history"
  | "clear-quiz-history"
  | "clear-notes"
  | "sign-out-all"
  | "deactivate-account"
  | "delete-account"
  | "reset-local-data";

type SaveState = "idle" | "saving" | "saved";

type SectionSearchEntry = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  searchTerms: string[];
};

const WEEKDAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const REMINDER_TONE_PREVIEW = {
  subtle: "Quiet reminder. Your reading window is open if you want a calm reset.",
  motivating: "Momentum check. A short reading block keeps your week on track.",
  direct: "Reading session pending. Open your next chapter to keep your plan intact.",
} as const;

const FAQ_ENTRIES = [
  {
    question: "How are reading defaults applied?",
    answer:
      "Defaults shape the first view you see when opening a chapter. You can still change mode, tab, and layout inside the reader at any time.",
  },
  {
    question: "What happens if I turn off history saving?",
    answer:
      "The app stops keeping local reading, quiz, or notes history for that category. Existing stored records remain until you clear them.",
  },
  {
    question: "Will reminders send promotional messages?",
    answer:
      "No. Product reminders, learning summaries, and promotional emails are controlled separately so you can keep the signal without the noise.",
  },
];

const DEFAULT_OPEN_SECTIONS: Record<string, boolean> = {
  "reading-experience": true,
  "learning-and-quiz": true,
  "daily-goals-and-streaks": true,
  "notifications-and-reminders": false,
  "library-and-discovery": false,
  "appearance-and-interface": false,
  accessibility: false,
  "privacy-and-data": false,
  "billing-and-plan-controls": false,
  "support-feedback-and-legal": false,
  "admin-settings": false,
};

const DEFAULT_VIEW_COPY = {
  summary: "Summary",
  examples: "Examples",
  quiz: "Quiz",
} as const;

function clearBookLocalStorage() {
  const keysToDelete: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (key.startsWith("book-accelerator:")) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => window.localStorage.removeItem(key));
}

function formatMinutes(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!remainder) return `${hours} hr`;
    return `${hours} hr ${remainder} min`;
  }
  return `${minutes} min`;
}

function mapLearningStyle(value: LearningStyle) {
  if (value === "concise") return "Simple";
  if (value === "deep") return "Deeper";
  return "Standard";
}

function mapQuizMode(value: QuizIntensity) {
  if (value === "challenging") return "Challenging";
  if (value === "easy") return "Easy";
  return "Standard";
}

function createDownload(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TimeInput({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block rounded-2xl border border-white/8 bg-black/10 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-100">{label}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        <input
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="rounded-xl border border-white/10 bg-[#0e1527] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-300/35 disabled:opacity-60"
        />
      </div>
    </label>
  );
}

function NumberInput({
  label,
  description,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/8 bg-black/10 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-100">{label}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-24 rounded-xl border border-white/10 bg-[#0e1527] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-300/35"
          />
          {suffix ? <span className="text-sm text-slate-400">{suffix}</span> : null}
        </div>
      </div>
    </label>
  );
}

function SupportActionCard({
  title,
  description,
  buttonLabel,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-200">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      <Button variant="secondary" className="mt-4" onClick={onClick}>
        {buttonLabel}
      </Button>
    </div>
  );
}

export function BookSettingsClient({ isAdmin, userEmail, appVersion }: BookSettingsClientProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("reading-experience");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(DEFAULT_OPEN_SECTIONS);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionKind | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const {
    state: onboarding,
    hydrated: onboardingHydrated,
    setDailyGoalMinutes,
    setReminderTime,
    setLearningStyle,
    setQuizIntensity,
    setStreakMode,
    resetSetup,
  } = useOnboardingState();

  const { state: preferences, hydrated: prefsHydrated, patchSection, reset: resetPreferences } = useBookPreferences();
  const { billingState } = useBookEntitlements(
    onboarding.setupComplete
  );

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchInputRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  useEffect(() => {
    if (!onboardingHydrated || !prefsHydrated) return;

    const snapshot = JSON.stringify({
      onboarding: {
        name: onboarding.name,
        dailyGoalMinutes: onboarding.dailyGoalMinutes,
        reminderTime: onboarding.reminderTime,
        learningStyle: onboarding.learningStyle,
        quizIntensity: onboarding.quizIntensity,
        streakMode: onboarding.streakMode,
      },
      preferences,
    });

    if (lastSnapshotRef.current === null) {
      lastSnapshotRef.current = snapshot;
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      return;
    }

    if (lastSnapshotRef.current === snapshot) return;

    lastSnapshotRef.current = snapshot;
    setSaveState("saving");

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("saved");
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      saveTimerRef.current = window.setTimeout(() => setSaveState("idle"), 1800);
    }, 450);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [onboarding, onboardingHydrated, preferences, prefsHydrated]);

  useEffect(() => {
    const ids = [
      "reading-experience",
      "learning-and-quiz",
      "daily-goals-and-streaks",
      "notifications-and-reminders",
      "library-and-discovery",
      "appearance-and-interface",
      "accessibility",
      "privacy-and-data",
      "billing-and-plan-controls",
      "support-feedback-and-legal",
      ...(isAdmin ? ["admin-settings"] : []),
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.2, 0.35] }
    );

    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [isAdmin]);

  const categories = useMemo(
    () => Array.from(new Set(BOOKS_CATALOG.map((book) => book.category))).sort((left, right) => left.localeCompare(right)),
    []
  );

  const preferredCategories = preferences.library.preferredCategories;
  const hiddenCategories = preferences.library.hiddenCategories;

  const sectionSearchEntries = useMemo<SectionSearchEntry[]>(() => {
    const commonAdminTerms = [
      "content management shortcut",
      "upload book package shortcut",
      "draft books shortcut",
      "ingestion status shortcut",
      "feature flag placeholder",
      "analytics shortcut placeholder",
    ];

    return [
      {
        id: "reading-experience",
        title: "Reading experience",
        description: "Shape how chapters, summaries, spacing, and focus feel by default.",
        icon: <BookOpen className="h-4 w-4" />,
        searchTerms: [
          "default reading mode",
          "default chapter tab",
          "font size",
          "line spacing",
          "content width",
          "paragraph density",
          "focus mode default",
          "show progress bar toggle",
          "show key takeaways by default toggle",
          "resume where I left off toggle",
          "open next unlocked chapter automatically toggle",
          "reading session timer visibility",
          "estimated reading time visibility toggle",
          "live preview panel",
        ],
      },
      {
        id: "learning-and-quiz",
        title: "Learning and quiz settings",
        description: "Tune quiz difficulty, explanations, review depth, and example defaults.",
        icon: <Brain className="h-4 w-4" />,
        searchTerms: [
          "default quiz mode",
          "question presentation style",
          "shuffle question order toggle",
          "shuffle answer order toggle",
          "show explanation after each answer toggle",
          "show explanations only after submit toggle",
          "retry incorrect only toggle",
          "confidence check before answer toggle",
          "require passing quiz to unlock next chapter toggle",
          "review style preference",
          "post chapter review cards toggle",
          "preferred examples category default",
        ],
      },
      {
        id: "daily-goals-and-streaks",
        title: "Daily goals and streaks",
        description: "Control pace, streak logic, milestones, and preferred reading cadence.",
        icon: <Target className="h-4 w-4" />,
        searchTerms: [
          "daily reading goal",
          "weekly chapter goal",
          "weekly quiz goal",
          "streak tracking toggle",
          "streak mode",
          "show streak on home screen toggle",
          "milestone celebration toggle",
          "badge animation toggle",
          "reminder if usual reading time is missed",
          "preferred reading days selection",
        ],
      },
      {
        id: "notifications-and-reminders",
        title: "Notifications and reminders",
        description: "Keep reminders calm, respectful, and clearly separate from marketing.",
        icon: <Bell className="h-4 w-4" />,
        searchTerms: [
          "master notifications toggle",
          "reading reminder toggle",
          "reminder schedule",
          "reminder time picker",
          "quiet hours",
          "chapter unlocked notification toggle",
          "streak reminder toggle",
          "badge earned notification toggle",
          "weekly learning summary email toggle",
          "product updates toggle",
          "promotional email toggle",
          "reminder tone style",
        ],
      },
      {
        id: "library-and-discovery",
        title: "Library and discovery",
        description: "Personalize recommendations, category curation, sorting, and visible metadata.",
        icon: <Grid2x2 className="h-4 w-4" />,
        searchTerms: [
          "preferred categories",
          "hidden categories",
          "recommendation preference",
          "default library sorting",
          "show completed books in library toggle",
          "hide archived books toggle",
          "show reading time estimates toggle",
          "show difficulty labels toggle",
          "show badges and popularity markers toggle",
          "default examples filter",
        ],
      },
      {
        id: "appearance-and-interface",
        title: "Appearance and interface",
        description: "Choose theme, density, motion, accent, and surface style with restraint.",
        icon: <Palette className="h-4 w-4" />,
        searchTerms: [
          "theme",
          "accent color",
          "interface density",
          "reduced motion toggle",
          "subtle animations toggle",
          "hover effects toggle",
          "card style preference",
          "sticky action bars toggle",
          "keyboard shortcut hints toggle",
          "date format",
          "time format",
          "language selector placeholder",
        ],
      },
      {
        id: "accessibility",
        title: "Accessibility",
        description: "Treat clarity, focus, contrast, and keyboard support as first class controls.",
        icon: <Eye className="h-4 w-4" />,
        searchTerms: [
          "larger text mode",
          "high contrast mode",
          "reduced motion",
          "focus ring strength",
          "screen reader friendly mode placeholder",
          "keyboard navigation helper toggle",
          "dyslexia friendly font toggle",
          "button size preference",
          "tooltip timing preference",
          "line focus or reading ruler mode toggle",
        ],
      },
      {
        id: "privacy-and-data",
        title: "Privacy and data",
        description: "Be explicit about analytics, stored history, exports, and destructive account actions.",
        icon: <Lock className="h-4 w-4" />,
        searchTerms: [
          "analytics participation toggle",
          "personalized recommendations toggle",
          "save reading history toggle",
          "save quiz history toggle",
          "save notes toggle",
          "export my data button",
          "download progress report button",
          "clear reading history action",
          "clear quiz history action",
          "clear notes action",
          "active sessions preview",
          "sign out of all devices",
          "deactivate account action",
          "delete account action",
        ],
      },
      {
        id: "billing-and-plan-controls",
        title: "Billing and plan controls",
        description: "Surface plan status, billing shortcuts, and Free versus Pro with transparent language.",
        icon: <CreditCard className="h-4 w-4" />,
        searchTerms: [
          "current plan card",
          "free books used",
          "remaining free access summary",
          "upgrade to Pro button",
          "manage subscription button",
          "billing renewal date",
          "payment method preview",
          "invoice history placeholder",
          "billing portal shortcut",
          "promo code field placeholder",
          "comparison panel for Free vs Pro",
          "cancel subscription flow",
          "what happens if I cancel explanation",
        ],
      },
      {
        id: "support-feedback-and-legal",
        title: "Support, feedback, and legal",
        description: "Offer calm support actions, product trust signals, and clear legal links.",
        icon: <HandHelping className="h-4 w-4" />,
        searchTerms: [
          "help center entry",
          "contact support button",
          "report a bug",
          "request a feature",
          "FAQ area",
          "changelog or what is new section",
          "app version",
          "privacy policy link",
          "terms link",
          "cookie policy link",
          "send feedback button or mini form",
        ],
      },
      ...(isAdmin
        ? [
            {
              id: "admin-settings",
              title: "Admin only settings",
              description: "Private controls for package management, ingestion visibility, and future flags.",
              icon: <UserCog className="h-4 w-4" />,
              searchTerms: commonAdminTerms,
            },
          ]
        : []),
    ];
  }, [isAdmin]);

  const normalizedQuery = query.trim().toLowerCase();

  const sectionMatchCounts = useMemo(() => {
    return Object.fromEntries(
      sectionSearchEntries.map((section) => {
        if (!normalizedQuery) return [section.id, section.searchTerms.length];
        const haystack = [section.title, section.description, ...section.searchTerms].map((term) => term.toLowerCase());
        const matches = haystack.filter((term) => term.includes(normalizedQuery)).length;
        return [section.id, matches];
      })
    ) as Record<string, number>;
  }, [normalizedQuery, sectionSearchEntries]);

  const visibleSections = useMemo(
    () => sectionSearchEntries.filter((section) => sectionMatchCounts[section.id] > 0),
    [sectionMatchCounts, sectionSearchEntries]
  );

  const navItems = useMemo<SectionNavItem[]>(
    () =>
      visibleSections.map((section) => ({
        id: section.id,
        title: section.title,
        description: section.description,
        icon: section.icon,
        results: sectionMatchCounts[section.id],
      })),
    [sectionMatchCounts, visibleSections]
  );

  const totalMatches = useMemo(
    () => visibleSections.reduce((sum, section) => sum + sectionMatchCounts[section.id], 0),
    [sectionMatchCounts, visibleSections]
  );

  const quickStats = useMemo(() => {
    return {
      readingMode: mapLearningStyle(onboarding.learningStyle),
      quizMode: mapQuizMode(onboarding.quizIntensity),
      streakMode: onboarding.streakMode ? "Strict daily" : "Flexible weekly",
      reminderTime: onboarding.reminderTime,
    };
  }, [onboarding.learningStyle, onboarding.quizIntensity, onboarding.reminderTime, onboarding.streakMode]);

  const readingPreviewStyle = {
    fontSize: `${preferences.reading.fontSize + (preferences.accessibility.largerTextMode ? 2 : 0)}px`,
    lineHeight: preferences.reading.lineSpacing / 100,
    maxWidth: `${Math.min(Math.max(preferences.reading.contentWidth / 9.5, 64), 100)}%`,
  } as const;

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navigateToSection = (id: string) => {
    setActiveSection(id);
    setOpenSections((prev) => ({ ...prev, [id]: true }));
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleCategory = (field: "preferredCategories" | "hiddenCategories", value: string) => {
    const current = preferences.library[field];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    patchSection("library", { [field]: next });
  };

  const toggleReadingDay = (value: string) => {
    const current = preferences.goals.preferredReadingDays;
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    patchSection("goals", { preferredReadingDays: next.length ? next : current });
  };

  const toggleCustomReminderDay = (value: string) => {
    const current = preferences.notifications.customReminderDays;
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    patchSection("notifications", { customReminderDays: next.length ? next : current });
  };

  const handleDestructiveAction = () => {
    if (!confirmAction) return;

    if (confirmAction === "reset-local-data") {
      clearBookLocalStorage();
      resetSetup();
      resetPreferences();
      showToast("Local settings cleared", "success");
      router.push("/book");
      setConfirmAction(null);
      return;
    }

    const successMessage: Record<Exclude<ConfirmActionKind, "reset-local-data">, string> = {
      "clear-reading-history": "Reading history cleared for this device",
      "clear-quiz-history": "Quiz history cleared for this device",
      "clear-notes": "Saved notes cleared for this device",
      "sign-out-all": "Sign out request queued",
      "deactivate-account": "Account deactivation review started",
      "delete-account": "Account deletion review started",
    };

    showToast(successMessage[confirmAction as Exclude<ConfirmActionKind, "reset-local-data">], "success");
    setConfirmAction(null);
  };

  const handleExportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: { name: onboarding.name, email: userEmail },
      onboarding,
      preferences,
    };
    createDownload(
      `book-accelerator-settings-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2)
    );
    showToast("Data export downloaded", "success");
  };

  const handleDownloadProgressReport = () => {
    const report = [
      "ChapterFlow progress report",
      `Generated: ${new Date().toLocaleString()}`,
      `Reader: ${onboarding.name || "Reader"}`,
      `Daily goal: ${formatMinutes(onboarding.dailyGoalMinutes)}`,
      `Reading mode: ${mapLearningStyle(onboarding.learningStyle)}`,
      `Quiz mode: ${mapQuizMode(onboarding.quizIntensity)}`,
      `Streak mode: ${onboarding.streakMode ? "Strict daily" : "Flexible weekly"}`,
      `Preferred categories: ${preferredCategories.join(", ") || "None selected"}`,
      `Recommendation style: ${preferences.library.recommendationPreference}`,
      `Theme: ${preferences.appearance.theme}`,
    ].join("\n");
    createDownload("book-accelerator-progress-report.txt", report, "text/plain");
    showToast("Progress report downloaded", "success");
  };

  const confirmModalCopy: Record<ConfirmActionKind, { title: string; description: string; confirmLabel: string }> = {
    "clear-reading-history": {
      title: "Clear reading history?",
      description: "This removes locally stored reading history for this device. It does not remove purchased access or book availability.",
      confirmLabel: "Clear reading history",
    },
    "clear-quiz-history": {
      title: "Clear quiz history?",
      description: "This removes locally stored quiz attempts and confidence checks for this device.",
      confirmLabel: "Clear quiz history",
    },
    "clear-notes": {
      title: "Clear saved notes?",
      description: "This removes locally stored notes from the current browser. Export data first if you want a copy.",
      confirmLabel: "Clear notes",
    },
    "sign-out-all": {
      title: "Sign out of all devices?",
      description: "This is a placeholder flow until backend session revocation is connected. It is shown here so the control surface is ready.",
      confirmLabel: "Sign out everywhere",
    },
    "deactivate-account": {
      title: "Deactivate account?",
      description: "Deactivation hides your account until it is reactivated. Billing and history handling would be finalized on the backend later.",
      confirmLabel: "Deactivate account",
    },
    "delete-account": {
      title: "Delete account?",
      description: "Deletion is destructive. This placeholder flow exists so the final backend path can plug into the same trust oriented interface.",
      confirmLabel: "Delete account",
    },
    "reset-local-data": {
      title: "Reset all local settings?",
      description: "This clears onboarding, progress, notes, badges, and settings stored in this browser.",
      confirmLabel: "Reset local data",
    },
  };

  if (!onboardingHydrated || !prefsHydrated || !onboarding.setupComplete) {
    return (
      <main className="relative min-h-screen text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-slate-300">
          Loading settings...
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[#050813]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(980px_circle_at_8%_-8%,rgba(56,189,248,0.14),transparent_58%),radial-gradient(880px_circle_at_100%_0%,rgba(250,204,21,0.08),transparent_50%),linear-gradient(180deg,rgba(9,13,24,0.96),rgba(5,8,19,1))]" />

      <TopNav
        name={onboarding.name || "Reader"}
        activeTab="settings"
        searchQuery=""
        onSearchChange={() => undefined}
        searchInputRef={searchInputRef}
        showSearch={false}
      />

      <section className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pt-8">
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-4">
              <SectionNav items={navItems} activeId={activeSection} onNavigate={navigateToSection} />
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_34px_rgba(2,6,23,0.26)]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Live status</p>
                <div className="mt-4 space-y-3">
                  <InlineSummaryStat label="Reading mode" value={quickStats.readingMode} />
                  <InlineSummaryStat label="Quiz mode" value={quickStats.quizMode} />
                  <InlineSummaryStat label="Daily goal" value={formatMinutes(onboarding.dailyGoalMinutes)} />
                  <InlineSummaryStat label="Reminder time" value={quickStats.reminderTime} />
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_44px_rgba(2,6,23,0.34)] sm:p-6 lg:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">ChapterFlow</p>
                  <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">Settings</h1>
                  <p className="mt-4 text-base leading-7 text-slate-300">
                    Configure reading depth, learning flow, reminders, privacy, and plan controls from one calm, structured control center.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
                  <div className="rounded-[24px] border border-white/10 bg-black/12 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Account</p>
                    <p className="mt-2 text-sm font-medium text-slate-100">{userEmail ?? "Signed in"}</p>
                    <p className="mt-1 text-sm text-slate-400">Plan aware settings and privacy controls</p>
                  </div>
                  <div className="rounded-[24px] border border-emerald-300/15 bg-emerald-500/10 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/80">Save status</p>
                    <p className="mt-2 text-sm font-medium text-emerald-50">
                      {saveState === "saving" ? "Saving changes" : saveState === "saved" ? "Changes saved" : "Auto save ready"}
                    </p>
                    <p className="mt-1 text-sm text-emerald-100/70">{lastSavedAt ? `Last update ${lastSavedAt}` : "Changes save automatically"}</p>
                  </div>
                </div>
              </div>
            </div>

            <SettingsSearchBar
              value={query}
              onChange={setQuery}
              resultCount={totalMatches}
              onClear={() => setQuery("")}
            />

            {normalizedQuery ? (
              <div className="flex flex-wrap gap-2 rounded-[26px] border border-white/10 bg-white/[0.03] p-3">
                {visibleSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => navigateToSection(section.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-200 transition hover:border-sky-300/30 hover:bg-sky-500/10"
                  >
                    {section.icon}
                    {section.title}
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">{sectionMatchCounts[section.id]}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="grid gap-6">
              {visibleSections.some((section) => section.id === "reading-experience") ? (
                <SettingsSectionCard
                  id="reading-experience"
                  title="Reading experience"
                  description="Shape the default chapter environment so every session feels intentional, readable, and steady."
                  helper="Reader defaults"
                  status={`${mapLearningStyle(onboarding.learningStyle)} mode`}
                  icon={<BookOpen className="h-5 w-5" />}
                  right={<SectionPill>{DEFAULT_VIEW_COPY[preferences.reading.defaultChapterTab]}</SectionPill>}
                  mobileCollapsed={!openSections["reading-experience"]}
                  onToggleMobile={() => toggleSection("reading-experience")}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-5">
                      <SettingGroup title="Default opening view" description="Tune where a chapter starts and how dense the reading surface feels.">
                        <SegmentedControl
                          value={onboarding.learningStyle}
                          onChange={setLearningStyle}
                          options={[
                            { value: "concise", label: "Simple", description: "A cleaner first pass with lighter cognitive load." },
                            { value: "balanced", label: "Standard", description: "Default pace for most reading sessions." },
                            { value: "deep", label: "Deeper", description: "Extra detail and more demanding reading from the start." },
                          ]}
                        />
                        <SegmentedControl
                          value={preferences.reading.defaultChapterTab}
                          onChange={(value) => patchSection("reading", { defaultChapterTab: value })}
                          options={[
                            { value: "summary", label: "Summary", description: "Open on the main lesson frame first." },
                            { value: "examples", label: "Examples", description: "Start with practical scenarios and application." },
                            { value: "quiz", label: "Quiz", description: "Jump straight into recall and review." },
                          ]}
                        />
                      </SettingGroup>

                      <SettingGroup title="Reading surface" description="Use sliders to shape comfort without turning the reader into a toy.">
                        <SliderRow
                          label="Font size"
                          description="A refined size scale for long chapter reading."
                          value={preferences.reading.fontSize}
                          min={14}
                          max={20}
                          step={1}
                          onChange={(value) => patchSection("reading", { fontSize: value })}
                          renderValue={(value) => `${value}px`}
                        />
                        <SliderRow
                          label="Line spacing"
                          description="More space improves calm scanning. Less space improves density."
                          value={preferences.reading.lineSpacing}
                          min={130}
                          max={190}
                          step={5}
                          onChange={(value) => patchSection("reading", { lineSpacing: value })}
                          renderValue={(value) => `${(value / 100).toFixed(2)}x`}
                        />
                        <SliderRow
                          label="Content width"
                          description="Narrower text blocks feel focused. Wider blocks fit more on screen."
                          value={preferences.reading.contentWidth}
                          min={640}
                          max={960}
                          step={20}
                          onChange={(value) => patchSection("reading", { contentWidth: value })}
                          renderValue={(value) => `${value}px`}
                        />
                        <SegmentedControl
                          value={preferences.reading.paragraphDensity}
                          onChange={(value) => patchSection("reading", { paragraphDensity: value })}
                          options={[
                            { value: "airy", label: "Airy", description: "More breathing room between blocks." },
                            { value: "balanced", label: "Balanced", description: "Default rhythm for everyday reading." },
                            { value: "dense", label: "Dense", description: "Higher information density on one screen." },
                          ]}
                        />
                      </SettingGroup>

                      <SettingGroup title="Flow behavior" description="Small controls that remove friction across repeated sessions.">
                        <ToggleRow
                          label="Focus mode by default"
                          description="Start reading with surrounding chrome reduced for fewer visual distractions."
                          checked={preferences.reading.focusModeDefault}
                          onChange={(value) => patchSection("reading", { focusModeDefault: value })}
                        />
                        <ToggleRow
                          label="Show progress bar"
                          description="Keep chapter progress visible at the top of the reader."
                          checked={preferences.reading.showProgressBar}
                          onChange={(value) => patchSection("reading", { showProgressBar: value })}
                        />
                        <ToggleRow
                          label="Show key takeaways by default"
                          description="Expand takeaways when a chapter opens so the lesson structure is visible immediately."
                          checked={preferences.reading.showKeyTakeawaysByDefault}
                          onChange={(value) => patchSection("reading", { showKeyTakeawaysByDefault: value })}
                        />
                        <ToggleRow
                          label="Resume where I left off"
                          description="Return to the last open chapter and scroll context when possible."
                          checked={preferences.reading.resumeWhereLeftOff}
                          onChange={(value) => patchSection("reading", { resumeWhereLeftOff: value })}
                        />
                        <ToggleRow
                          label="Open next unlocked chapter automatically"
                          description="Move forward with less friction after completing a chapter or its quiz."
                          checked={preferences.reading.openNextUnlockedChapterAutomatically}
                          onChange={(value) => patchSection("reading", { openNextUnlockedChapterAutomatically: value })}
                        />
                        <ToggleRow
                          label="Show reading session timer"
                          description="Keep session pacing visible when you are reading with a time target."
                          checked={preferences.reading.showReadingSessionTimer}
                          onChange={(value) => patchSection("reading", { showReadingSessionTimer: value })}
                        />
                        <ToggleRow
                          label="Show estimated reading time"
                          description="Display chapter time estimates near summary and navigation controls."
                          checked={preferences.reading.showEstimatedReadingTime}
                          onChange={(value) => patchSection("reading", { showEstimatedReadingTime: value })}
                        />
                      </SettingGroup>
                    </div>

                    <PreviewCard
                      eyebrow="Live preview"
                      title="Reading environment"
                      footer="This preview changes immediately so you can tune comfort before opening a chapter."
                    >
                      <div className="rounded-[24px] border border-white/10 bg-[#0b1324] p-4 shadow-[0_18px_34px_rgba(2,6,23,0.3)]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Chapter preview</p>
                            <h4 className="mt-1 text-sm font-semibold text-slate-50">Focused reading surface</h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {preferences.reading.showProgressBar ? <span>Progress on</span> : <span>Progress off</span>}
                            <span className="rounded-full border border-white/10 px-2 py-1">{mapLearningStyle(onboarding.learningStyle)}</span>
                          </div>
                        </div>
                        {preferences.reading.showProgressBar ? (
                          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                            <div className="h-full w-[46%] rounded-full bg-linear-to-r from-sky-400 to-cyan-300" />
                          </div>
                        ) : null}
                        <div className="mt-5 space-y-4 text-slate-200" style={readingPreviewStyle}>
                          <p className="font-medium text-slate-50">What changes the experience most is not volume. It is how quickly the page tells you where to place attention.</p>
                          <p className="text-slate-300">
                            A stable reading surface lowers decision fatigue. When spacing, width, and default tab feel right, the mind spends less effort on navigation and more effort on understanding.
                          </p>
                          {preferences.reading.showKeyTakeawaysByDefault ? (
                            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/8 p-3 text-sm text-emerald-100/90">
                              Key takeaways open by default so the chapter structure is visible before you go deeper.
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-400">
                          <InlineSummaryStat label="Default tab" value={DEFAULT_VIEW_COPY[preferences.reading.defaultChapterTab]} />
                          <InlineSummaryStat label="Content width" value={`${preferences.reading.contentWidth}px`} />
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "learning-and-quiz") ? (
                <SettingsSectionCard
                  id="learning-and-quiz"
                  title="Learning and quiz settings"
                  description="Control how questions appear, how feedback is revealed, and how much review context follows a chapter."
                  helper="Retention controls"
                  status={mapQuizMode(onboarding.quizIntensity)}
                  icon={<Brain className="h-5 w-5" />}
                  right={<SectionPill>{preferences.learning.reviewStylePreference.replace(/-/g, " ")}</SectionPill>}
                  mobileCollapsed={!openSections["learning-and-quiz"]}
                  onToggleMobile={() => toggleSection("learning-and-quiz")}
                  accent="amber"
                >
                  <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
                    <div className="space-y-5">
                      <SettingGroup title="Quiz defaults" description="Choose how demanding and guided the default quiz experience should feel.">
                        <SegmentedControl
                          value={onboarding.quizIntensity}
                          onChange={setQuizIntensity}
                          options={[
                            { value: "easy", label: "Easy", description: "A lighter starting point for quick recall." },
                            { value: "standard", label: "Standard", description: "Balanced challenge for everyday review." },
                            { value: "challenging", label: "Challenging", description: "A tougher recall posture with more pressure." },
                          ]}
                        />
                        <SegmentedControl
                          value={preferences.learning.questionPresentationStyle}
                          onChange={(value) => patchSection("learning", { questionPresentationStyle: value })}
                          options={[
                            { value: "all-at-once", label: "All at once", description: "See the whole quiz and plan your pass." },
                            { value: "one-by-one", label: "One by one", description: "Stay focused on a single question at a time." },
                          ]}
                          className="sm:grid-cols-2 xl:grid-cols-2"
                        />
                      </SettingGroup>

                      <SettingGroup title="Quiz behavior" description="Short helper text explains how each choice changes the learning experience.">
                        <ToggleRow
                          label="Shuffle question order"
                          description="Reduce memorizing position patterns and encourage actual recall."
                          checked={preferences.learning.shuffleQuestionOrder}
                          onChange={(value) => patchSection("learning", { shuffleQuestionOrder: value })}
                        />
                        <ToggleRow
                          label="Shuffle answer order"
                          description="Prevent answer placement from becoming a shortcut."
                          checked={preferences.learning.shuffleAnswerOrder}
                          onChange={(value) => patchSection("learning", { shuffleAnswerOrder: value })}
                        />
                        <ToggleRow
                          label="Show explanation after each answer"
                          description="Best when you want fast feedback and lower correction delay."
                          checked={preferences.learning.showExplanationAfterEachAnswer}
                          onChange={(value) => patchSection("learning", { showExplanationAfterEachAnswer: value })}
                        />
                        <ToggleRow
                          label="Show explanations only after submit"
                          description="Useful when you want cleaner test conditions before review."
                          checked={preferences.learning.showExplanationsOnlyAfterSubmit}
                          onChange={(value) => patchSection("learning", { showExplanationsOnlyAfterSubmit: value })}
                        />
                        <ToggleRow
                          label="Retry incorrect only"
                          description="Focus the second pass on your actual misses instead of repeating everything."
                          checked={preferences.learning.retryIncorrectOnly}
                          onChange={(value) => patchSection("learning", { retryIncorrectOnly: value })}
                        />
                        <ToggleRow
                          label="Confidence check before answer"
                          description="Add a quick confidence signal before submission for better self awareness."
                          checked={preferences.learning.confidenceCheckBeforeAnswer}
                          onChange={(value) => patchSection("learning", { confidenceCheckBeforeAnswer: value })}
                        />
                        <ToggleRow
                          label="Require passing quiz to unlock next chapter"
                          description="Turn this on only if you want a stricter learning gate between chapters."
                          checked={preferences.learning.requirePassingQuizToUnlockNextChapter}
                          onChange={(value) => patchSection("learning", { requirePassingQuizToUnlockNextChapter: value })}
                        />
                        <SelectRow
                          label="Review style preference"
                          description="Choose how much context appears after a chapter is complete."
                          value={preferences.learning.reviewStylePreference}
                          onChange={(value) => patchSection("learning", { reviewStylePreference: value })}
                          options={[
                            { value: "summary-only", label: "Summary only" },
                            { value: "summary-plus-examples", label: "Summary plus examples" },
                            { value: "full-review", label: "Full review" },
                          ]}
                        />
                        <ToggleRow
                          label="Post chapter review cards"
                          description="Keep compact reflection cards after each chapter to strengthen retention."
                          checked={preferences.learning.postChapterReviewCards}
                          onChange={(value) => patchSection("learning", { postChapterReviewCards: value })}
                        />
                        <SelectRow
                          label="Preferred examples category"
                          description="Open examples on the context that feels most relevant to your current life."
                          value={preferences.learning.preferredExamplesCategoryDefault}
                          onChange={(value) => patchSection("learning", { preferredExamplesCategoryDefault: value })}
                          options={[
                            { value: "all", label: "All" },
                            { value: "personal", label: "Personal" },
                            { value: "school", label: "School" },
                            { value: "work", label: "Work" },
                          ]}
                        />
                      </SettingGroup>
                    </div>

                    <PreviewCard
                      eyebrow="Quiz preview"
                      title="How a chapter check will feel"
                      footer="The preview reflects your explanation timing, presentation style, and review depth preferences."
                    >
                      <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#0b1324] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Default mode</p>
                            <h4 className="mt-1 text-sm font-semibold text-slate-50">{mapQuizMode(onboarding.quizIntensity)}</h4>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                            {preferences.learning.questionPresentationStyle === "one-by-one" ? "One by one" : "All at once"}
                          </span>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/14 p-4">
                          <p className="text-sm font-medium text-slate-100">Why does the app show explanations this way?</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-300">
                            <label className="flex items-start gap-3 rounded-xl border border-sky-300/20 bg-sky-500/10 px-3 py-2">
                              <span className="mt-0.5 inline-flex h-4 w-4 rounded-full border border-sky-300/30 bg-sky-300" />
                              <span>Reveal feedback {preferences.learning.showExplanationAfterEachAnswer ? "after each answer" : "after submit"}.</span>
                            </label>
                            <label className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
                              <span className="mt-0.5 inline-flex h-4 w-4 rounded-full border border-white/20" />
                              <span>{preferences.learning.reviewStylePreference.replace(/-/g, " ")} review follows completion.</span>
                            </label>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InlineSummaryStat label="Retry flow" value={preferences.learning.retryIncorrectOnly ? "Incorrect only" : "Full quiz repeat"} />
                          <InlineSummaryStat label="Examples default" value={preferences.learning.preferredExamplesCategoryDefault} />
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "daily-goals-and-streaks") ? (
                <SettingsSectionCard
                  id="daily-goals-and-streaks"
                  title="Daily goals and streaks"
                  description="Support consistency with clean targets, weekly structure, and streak logic that stays motivating instead of noisy."
                  helper="Consistency system"
                  status={quickStats.streakMode}
                  icon={<Target className="h-5 w-5" />}
                  right={<SectionPill>{formatMinutes(onboarding.dailyGoalMinutes)}</SectionPill>}
                  mobileCollapsed={!openSections["daily-goals-and-streaks"]}
                  onToggleMobile={() => toggleSection("daily-goals-and-streaks")}
                  accent="emerald"
                >
                  <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
                    <div className="space-y-5">
                      <SettingGroup title="Goal pacing" description="Set clear expectations for time, chapters, and review volume.">
                        <SliderRow
                          label="Daily reading goal"
                          description="Choose a realistic target from ten minutes to four hours."
                          value={onboarding.dailyGoalMinutes}
                          min={10}
                          max={240}
                          step={5}
                          onChange={setDailyGoalMinutes}
                          renderValue={formatMinutes}
                        />
                        <NumberInput
                          label="Weekly chapter goal"
                          description="Optional structure for chapter completion across the week."
                          value={preferences.goals.weeklyChapterGoal}
                          min={0}
                          max={14}
                          suffix="chapters"
                          onChange={(value) => patchSection("goals", { weeklyChapterGoal: Math.max(0, Math.min(14, value || 0)) })}
                        />
                        <NumberInput
                          label="Weekly quiz goal"
                          description="Optional structure for review consistency and recall practice."
                          value={preferences.goals.weeklyQuizGoal}
                          min={0}
                          max={21}
                          suffix="quizzes"
                          onChange={(value) => patchSection("goals", { weeklyQuizGoal: Math.max(0, Math.min(21, value || 0)) })}
                        />
                      </SettingGroup>

                      <SettingGroup title="Streak behavior" description="Choose how visible and how strict streaks should be inside the app.">
                        <ToggleRow
                          label="Streak tracking"
                          description="Track consistency over time and use streak based summaries in progress views."
                          checked={preferences.goals.streakTrackingEnabled}
                          onChange={(value) => patchSection("goals", { streakTrackingEnabled: value })}
                        />
                        <SegmentedControl
                          value={onboarding.streakMode ? "strict" : "flexible"}
                          onChange={(value) => setStreakMode(value === "strict")}
                          options={[
                            { value: "strict", label: "Strict daily", description: "Best if you want a clean every day accountability line." },
                            { value: "flexible", label: "Flexible weekly", description: "Best if your schedule shifts and weekly consistency matters more." },
                          ]}
                          className="sm:grid-cols-2 xl:grid-cols-2"
                        />
                        <ToggleRow
                          label="Show streak on home screen"
                          description="Keep streak status visible on the main workspace and progress surfaces."
                          checked={preferences.goals.showStreakOnHomeScreen}
                          onChange={(value) => patchSection("goals", { showStreakOnHomeScreen: value })}
                        />
                        <ToggleRow
                          label="Milestone celebration"
                          description="Use restrained milestone moments when goals or streak thresholds are reached."
                          checked={preferences.goals.milestoneCelebration}
                          onChange={(value) => patchSection("goals", { milestoneCelebration: value })}
                        />
                        <ToggleRow
                          label="Badge animation"
                          description="Allow subtle motion when new recognition is earned."
                          checked={preferences.goals.badgeAnimation}
                          onChange={(value) => patchSection("goals", { badgeAnimation: value })}
                        />
                        <ToggleRow
                          label="Remind me if my usual reading time is missed"
                          description="Use habit awareness instead of fixed pressure when you miss your normal session window."
                          checked={preferences.goals.remindIfUsualReadingTimeMissed}
                          onChange={(value) => patchSection("goals", { remindIfUsualReadingTimeMissed: value })}
                        />
                        <ChipsRow
                          label="Preferred reading days"
                          description="This helps weekly pacing and reminder logic feel aligned with your real schedule."
                          options={WEEKDAY_OPTIONS}
                          selected={preferences.goals.preferredReadingDays}
                          onToggle={toggleReadingDay}
                        />
                      </SettingGroup>
                    </div>

                    <PreviewCard
                      eyebrow="Goal summary"
                      title="Current plan setup"
                      footer="The system favors motivating clarity over pressure. Weekly targets are optional and can stay light."
                    >
                      <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#0b1324] p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <InlineSummaryStat label="Daily target" value={formatMinutes(onboarding.dailyGoalMinutes)} />
                          <InlineSummaryStat label="Streak logic" value={quickStats.streakMode} />
                          <InlineSummaryStat label="Weekly chapters" value={preferences.goals.weeklyChapterGoal || "Off"} />
                          <InlineSummaryStat label="Weekly quizzes" value={preferences.goals.weeklyQuizGoal || "Off"} />
                        </div>
                        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/8 p-4">
                          <p className="text-sm font-medium text-emerald-50">Active reading cadence</p>
                          <p className="mt-2 text-sm leading-6 text-emerald-100/85">
                            {preferences.goals.preferredReadingDays.join(", ")} • {preferences.goals.showStreakOnHomeScreen ? "Home screen streak visible" : "Home screen streak hidden"}
                          </p>
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "notifications-and-reminders") ? (
                <SettingsSectionCard
                  id="notifications-and-reminders"
                  title="Notifications and reminders"
                  description="Keep reminders useful and respectful, with essential learning signals clearly separated from promotional messages."
                  helper="Reminder hygiene"
                  status={preferences.notifications.notificationsEnabled ? "Enabled" : "Muted"}
                  icon={<Bell className="h-5 w-5" />}
                  right={<SectionPill>{preferences.notifications.reminderToneStyle}</SectionPill>}
                  mobileCollapsed={!openSections["notifications-and-reminders"]}
                  onToggleMobile={() => toggleSection("notifications-and-reminders")}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
                    <div className="space-y-5">
                      <SettingGroup title="Delivery controls" description="Product reminders and product marketing are separated clearly so you can keep trust intact.">
                        <ToggleRow
                          label="Master notifications"
                          description="Disable every non essential reminder surface from one place."
                          checked={preferences.notifications.notificationsEnabled}
                          onChange={(value) => patchSection("notifications", { notificationsEnabled: value })}
                        />
                        <ToggleRow
                          label="Reading reminder"
                          description="Receive reminder nudges for reading sessions and missed routines."
                          checked={preferences.notifications.readingReminderEnabled}
                          onChange={(value) => patchSection("notifications", { readingReminderEnabled: value })}
                          disabled={!preferences.notifications.notificationsEnabled}
                        />
                        <SelectRow
                          label="Reminder schedule"
                          description="Choose a steady rhythm or specify your own reading days."
                          value={preferences.notifications.reminderSchedule}
                          onChange={(value) => patchSection("notifications", { reminderSchedule: value })}
                          options={[
                            { value: "daily", label: "Daily" },
                            { value: "weekdays", label: "Weekdays" },
                            { value: "custom", label: "Custom" },
                          ]}
                        />
                        <TimeInput
                          label="Reminder time"
                          description="Use the time you most often want your first nudge."
                          value={onboarding.reminderTime}
                          onChange={setReminderTime}
                        />
                        {preferences.notifications.reminderSchedule === "custom" ? (
                          <ChipsRow
                            label="Custom reminder days"
                            description="Pick the days that should carry reminders."
                            options={WEEKDAY_OPTIONS}
                            selected={preferences.notifications.customReminderDays}
                            onToggle={toggleCustomReminderDay}
                          />
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-2">
                          <TimeInput
                            label="Quiet hours start"
                            value={preferences.notifications.quietHoursStart}
                            onChange={(value) => patchSection("notifications", { quietHoursStart: value })}
                          />
                          <TimeInput
                            label="Quiet hours end"
                            value={preferences.notifications.quietHoursEnd}
                            onChange={(value) => patchSection("notifications", { quietHoursEnd: value })}
                          />
                        </div>
                      </SettingGroup>

                      <SettingGroup title="Message categories" description="Keep product progress signals and promotional messages under separate control.">
                        <ToggleRow
                          label="Chapter unlocked notification"
                          description="Know when a new chapter is available based on your current path."
                          checked={preferences.notifications.chapterUnlockedNotification}
                          onChange={(value) => patchSection("notifications", { chapterUnlockedNotification: value })}
                        />
                        <ToggleRow
                          label="Streak reminder"
                          description="Receive reminders tied to streak preservation if streak tracking is active."
                          checked={preferences.notifications.streakReminder}
                          onChange={(value) => patchSection("notifications", { streakReminder: value })}
                        />
                        <ToggleRow
                          label="Badge earned notification"
                          description="Receive a compact heads up when a new badge or milestone lands."
                          checked={preferences.notifications.badgeEarnedNotification}
                          onChange={(value) => patchSection("notifications", { badgeEarnedNotification: value })}
                        />
                        <ToggleRow
                          label="Weekly learning summary email"
                          description="Get a calm weekly summary of time, chapters, quizzes, and streak movement."
                          checked={preferences.notifications.weeklyLearningSummaryEmail}
                          onChange={(value) => patchSection("notifications", { weeklyLearningSummaryEmail: value })}
                        />
                        <ToggleRow
                          label="Product updates"
                          description="Receive important changes, launches, and high signal platform improvements."
                          checked={preferences.notifications.productUpdates}
                          onChange={(value) => patchSection("notifications", { productUpdates: value })}
                        />
                        <ToggleRow
                          label="Promotional email"
                          description="Receive campaign style messages only if you explicitly want them."
                          checked={preferences.notifications.promotionalEmail}
                          onChange={(value) => patchSection("notifications", { promotionalEmail: value })}
                        />
                        <SegmentedControl
                          value={preferences.notifications.reminderToneStyle}
                          onChange={(value) => patchSection("notifications", { reminderToneStyle: value })}
                          options={[
                            { value: "subtle", label: "Subtle", description: "Calm, low pressure wording." },
                            { value: "motivating", label: "Motivating", description: "Steady encouragement without noise." },
                            { value: "direct", label: "Direct", description: "Clean and action oriented wording." },
                          ]}
                        />
                      </SettingGroup>
                    </div>

                    <PreviewCard
                      eyebrow="Reminder preview"
                      title="Message style"
                      footer="Tone only changes the language style. Delivery rules stay under your schedule and quiet hours settings."
                    >
                      <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#0b1324] p-4">
                        <div className="rounded-2xl border border-white/8 bg-black/12 p-4">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Preview</p>
                          <p className="mt-3 text-sm leading-7 text-slate-100">
                            {REMINDER_TONE_PREVIEW[preferences.notifications.reminderToneStyle]}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InlineSummaryStat label="Schedule" value={preferences.notifications.reminderSchedule} />
                          <InlineSummaryStat label="Time" value={onboarding.reminderTime} />
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                          Quiet hours run from {preferences.notifications.quietHoursStart} to {preferences.notifications.quietHoursEnd}.
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "library-and-discovery") ? (
                <SettingsSectionCard
                  id="library-and-discovery"
                  title="Library and discovery"
                  description="Guide what appears in your library and how new books are recommended without cluttering the experience."
                  helper="Discovery curation"
                  status={preferences.library.recommendationPreference.replace(/-/g, " ")}
                  icon={<Grid2x2 className="h-5 w-5" />}
                  right={<SectionPill>{preferences.library.defaultLibrarySorting.replace(/-/g, " ")}</SectionPill>}
                  mobileCollapsed={!openSections["library-and-discovery"]}
                  onToggleMobile={() => toggleSection("library-and-discovery")}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-5">
                      <SettingGroup title="Category curation" description="Personalize what you see without losing the library’s overall structure.">
                        <ChipsRow
                          label="Preferred categories"
                          description="Boost the categories you want featured more heavily in recommendations."
                          options={categories}
                          selected={preferredCategories}
                          onToggle={(value) => toggleCategory("preferredCategories", value)}
                        />
                        <ChipsRow
                          label="Hidden categories"
                          description="Reduce categories that are not relevant to your current focus."
                          options={categories}
                          selected={hiddenCategories}
                          onToggle={(value) => toggleCategory("hiddenCategories", value)}
                        />
                      </SettingGroup>

                      <SettingGroup title="Recommendation behavior" description="Decide how new content is ranked and what metadata stays visible while browsing.">
                        <SelectRow
                          label="Recommendation preference"
                          description="Choose whether the library should bias toward ease, balance, challenge, or popularity."
                          value={preferences.library.recommendationPreference}
                          onChange={(value) => patchSection("library", { recommendationPreference: value })}
                          options={[
                            { value: "easiest-first", label: "Easiest first" },
                            { value: "balanced", label: "Balanced" },
                            { value: "challenging-first", label: "Challenging first" },
                            { value: "most-popular", label: "Most popular" },
                          ]}
                        />
                        <SelectRow
                          label="Default library sorting"
                          description="Control the default browse order when you open the library."
                          value={preferences.library.defaultLibrarySorting}
                          onChange={(value) => patchSection("library", { defaultLibrarySorting: value })}
                          options={[
                            { value: "recommended", label: "Recommended" },
                            { value: "recently-opened", label: "Recently opened" },
                            { value: "shortest-read", label: "Shortest read" },
                            { value: "longest-read", label: "Longest read" },
                            { value: "alphabetical", label: "Alphabetical" },
                          ]}
                        />
                        <SelectRow
                          label="Default examples filter"
                          description="Choose which example context should be selected most often in reading surfaces."
                          value={preferences.library.defaultExamplesFilter}
                          onChange={(value) => patchSection("library", { defaultExamplesFilter: value })}
                          options={[
                            { value: "all", label: "All" },
                            { value: "personal", label: "Personal" },
                            { value: "school", label: "School" },
                            { value: "work", label: "Work" },
                          ]}
                        />
                        <ToggleRow
                          label="Show completed books"
                          description="Keep finished books visible in the main library view."
                          checked={preferences.library.showCompletedBooks}
                          onChange={(value) => patchSection("library", { showCompletedBooks: value })}
                        />
                        <ToggleRow
                          label="Hide archived books"
                          description="Reduce older archived entries from the main browse surface."
                          checked={preferences.library.hideArchivedBooks}
                          onChange={(value) => patchSection("library", { hideArchivedBooks: value })}
                        />
                        <ToggleRow
                          label="Show reading time estimates"
                          description="Keep time previews visible across cards and detail views."
                          checked={preferences.library.showReadingTimeEstimates}
                          onChange={(value) => patchSection("library", { showReadingTimeEstimates: value })}
                        />
                        <ToggleRow
                          label="Show difficulty labels"
                          description="Display Easy, Medium, and Hard cues in library cards."
                          checked={preferences.library.showDifficultyLabels}
                          onChange={(value) => patchSection("library", { showDifficultyLabels: value })}
                        />
                        <ToggleRow
                          label="Show badges and popularity markers"
                          description="Keep visual signals for social proof and earned progress visible in browsing."
                          checked={preferences.library.showBadgesAndPopularityMarkers}
                          onChange={(value) => patchSection("library", { showBadgesAndPopularityMarkers: value })}
                        />
                      </SettingGroup>
                    </div>

                    <PreviewCard
                      eyebrow="Curation preview"
                      title="Library discovery posture"
                      footer="Preferences here shape browse order and which book metadata is emphasized on cards."
                    >
                      <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#0b1324] p-4">
                        <div className="rounded-2xl border border-white/8 bg-black/12 p-4">
                          <p className="text-sm font-medium text-slate-50">Recommended next</p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            Recommendations are currently weighted toward {preferences.library.recommendationPreference.replace(/-/g, " ")} with {preferredCategories.length ? preferredCategories.join(", ") : "all categories"} favored.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InlineSummaryStat label="Sort" value={preferences.library.defaultLibrarySorting.replace(/-/g, " ")} />
                          <InlineSummaryStat label="Examples" value={preferences.library.defaultExamplesFilter} />
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                          Hidden categories: {hiddenCategories.length ? hiddenCategories.join(", ") : "None"}
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "appearance-and-interface") ? (
                <SettingsSectionCard
                  id="appearance-and-interface"
                  title="Appearance and interface"
                  description="Offer a curated amount of interface control so the app feels personal without turning into a customization toy."
                  helper="Visual system"
                  status={preferences.appearance.theme}
                  icon={<Palette className="h-5 w-5" />}
                  right={<SectionPill>{preferences.appearance.cardStylePreference.replace(/-/g, " ")}</SectionPill>}
                  mobileCollapsed={!openSections["appearance-and-interface"]}
                  onToggleMobile={() => toggleSection("appearance-and-interface")}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.14fr_0.86fr]">
                    <div className="space-y-5">
                      <SettingGroup title="Theme and density" description="Keep the choice set classy and constrained.">
                        <SegmentedControl
                          value={preferences.appearance.theme}
                          onChange={(value) => patchSection("appearance", { theme: value })}
                          options={[
                            { value: "dark", label: "Dark", description: "Low glare and more cinematic contrast." },
                            { value: "light", label: "Light", description: "Bright surfaces with strong legibility." },
                            { value: "system", label: "System", description: "Follow the device preference automatically." },
                          ]}
                        />
                        <SegmentedControl
                          value={preferences.appearance.interfaceDensity}
                          onChange={(value) => patchSection("appearance", { interfaceDensity: value })}
                          options={[
                            { value: "compact", label: "Compact", description: "Higher information density on screen." },
                            { value: "comfortable", label: "Comfortable", description: "Default spacing balance." },
                            { value: "spacious", label: "Spacious", description: "More breathing room and larger tap targets." },
                          ]}
                        />
                        <SegmentedControl
                          value={preferences.appearance.cardStylePreference}
                          onChange={(value) => patchSection("appearance", { cardStylePreference: value })}
                          options={[
                            { value: "soft-glass", label: "Soft glass", description: "A luminous surface with subtle depth." },
                            { value: "flat-minimal", label: "Flat minimal", description: "Sharper surfaces and less visual treatment." },
                            { value: "elevated", label: "Elevated", description: "Richer depth and stronger separation." },
                          ]}
                        />
                      </SettingGroup>

                      <SettingGroup title="Interface behavior" description="Animation, hover response, and formatting cues stay useful rather than decorative.">
                        <SelectRow
                          label="Accent color"
                          description="A restrained accent affects highlights, active states, and premium emphasis."
                          value={preferences.appearance.accentColor}
                          onChange={(value) => patchSection("appearance", { accentColor: value })}
                          options={[
                            { value: "sky", label: "Sky" },
                            { value: "emerald", label: "Emerald" },
                            { value: "amber", label: "Amber" },
                            { value: "rose", label: "Rose" },
                          ]}
                        />
                        <ToggleRow
                          label="Reduced motion"
                          description="Limit movement across the interface when you want a steadier screen."
                          checked={preferences.appearance.reducedMotion}
                          onChange={(value) => patchSection("appearance", { reducedMotion: value })}
                        />
                        <ToggleRow
                          label="Subtle animations"
                          description="Keep meaningful transitions for context changes and success feedback."
                          checked={preferences.appearance.subtleAnimations}
                          onChange={(value) => patchSection("appearance", { subtleAnimations: value })}
                          disabled={preferences.appearance.reducedMotion}
                        />
                        <ToggleRow
                          label="Hover effects"
                          description="Use richer hover affordances on desktop surfaces."
                          checked={preferences.appearance.hoverEffects}
                          onChange={(value) => patchSection("appearance", { hoverEffects: value })}
                        />
                        <ToggleRow
                          label="Sticky action bars"
                          description="Keep important actions visible while moving through long pages or readers."
                          checked={preferences.appearance.stickyActionBars}
                          onChange={(value) => patchSection("appearance", { stickyActionBars: value })}
                        />
                        <ToggleRow
                          label="Keyboard shortcut hints"
                          description="Show subtle hints for shortcuts like search focus and quick navigation."
                          checked={preferences.appearance.keyboardShortcutHints}
                          onChange={(value) => patchSection("appearance", { keyboardShortcutHints: value })}
                        />
                        <SelectRow
                          label="Date format"
                          description="Choose how dates are shown across progress and billing surfaces."
                          value={preferences.appearance.dateFormat}
                          onChange={(value) => patchSection("appearance", { dateFormat: value })}
                          options={[
                            { value: "month-day-year", label: "Month day year" },
                            { value: "day-month-year", label: "Day month year" },
                            { value: "year-month-day", label: "Year month day" },
                          ]}
                        />
                        <SelectRow
                          label="Time format"
                          description="Choose between twelve hour and twenty four hour time formatting."
                          value={preferences.appearance.timeFormat}
                          onChange={(value) => patchSection("appearance", { timeFormat: value })}
                          options={[
                            { value: "12h", label: "12 hour" },
                            { value: "24h", label: "24 hour" },
                          ]}
                        />
                        <SelectRow
                          label="Language"
                          description="A placeholder that keeps the page ready for localized interface support later."
                          value={preferences.appearance.language}
                          onChange={(value) => patchSection("appearance", { language: value })}
                          options={[
                            { value: "English", label: "English" },
                            { value: "English (Canada)", label: "English Canada" },
                            { value: "English (United States)", label: "English United States" },
                          ]}
                        />
                      </SettingGroup>
                    </div>

                    <PreviewCard
                      eyebrow="Visual preview"
                      title="Theme, card style, and density"
                      footer="These previews are curated rather than exhaustive so the product keeps a strong visual identity."
                    >
                      <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#0b1324] p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            { id: "dark", label: "Dark" },
                            { id: "light", label: "Light" },
                            { id: "system", label: "System" },
                          ].map((option) => {
                            const active = preferences.appearance.theme === option.id;
                            return (
                              <div key={option.id} className={`rounded-2xl border p-3 ${active ? "border-sky-300/30 bg-sky-500/10" : "border-white/10 bg-white/[0.04]"}`}>
                                <div className={`h-20 rounded-xl ${option.id === "light" ? "bg-linear-to-br from-slate-100 to-slate-300" : option.id === "system" ? "bg-linear-to-br from-slate-950 via-slate-700 to-slate-100" : "bg-linear-to-br from-slate-950 to-slate-700"}`} />
                                <p className="mt-3 text-sm font-medium text-slate-100">{option.label}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InlineSummaryStat label="Density" value={preferences.appearance.interfaceDensity} />
                          <InlineSummaryStat label="Accent" value={preferences.appearance.accentColor} />
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/12 p-4">
                          <p className="text-sm font-medium text-slate-50">Card style preview</p>
                          <div className={`mt-3 rounded-2xl border p-4 ${preferences.appearance.cardStylePreference === "soft-glass" ? "border-sky-300/20 bg-white/[0.08] backdrop-blur-sm" : preferences.appearance.cardStylePreference === "flat-minimal" ? "border-white/8 bg-[#0d1321]" : "border-white/12 bg-white/[0.06] shadow-[0_18px_34px_rgba(2,6,23,0.28)]"}`}>
                            <p className="text-sm text-slate-200">A restrained premium surface with focus on content hierarchy.</p>
                          </div>
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "accessibility") ? (
                <SettingsSectionCard
                  id="accessibility"
                  title="Accessibility"
                  description="Accessibility is treated as product quality, not an afterthought. Controls here are written plainly and designed with equal care."
                  helper="Inclusive reading"
                  status={preferences.accessibility.highContrastMode ? "High contrast" : "Standard contrast"}
                  icon={<Eye className="h-5 w-5" />}
                  right={<SectionPill>{preferences.accessibility.focusRingStrength}</SectionPill>}
                  mobileCollapsed={!openSections["accessibility"]}
                  onToggleMobile={() => toggleSection("accessibility")}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
                    <div className="space-y-5">
                      <SettingGroup title="Reading support" description="Increase clarity, guidance, and keyboard support without making the page look secondary.">
                        <ToggleRow
                          label="Larger text mode"
                          description="Increase base reading size across the experience."
                          checked={preferences.accessibility.largerTextMode}
                          onChange={(value) => patchSection("accessibility", { largerTextMode: value })}
                        />
                        <ToggleRow
                          label="High contrast mode"
                          description="Increase separation between text, surfaces, and active controls."
                          checked={preferences.accessibility.highContrastMode}
                          onChange={(value) => patchSection("accessibility", { highContrastMode: value })}
                        />
                        <ToggleRow
                          label="Reduced motion"
                          description="Mirror the main reduced motion preference from this section as well."
                          checked={preferences.appearance.reducedMotion}
                          onChange={(value) => patchSection("appearance", { reducedMotion: value })}
                        />
                        <SelectRow
                          label="Focus ring strength"
                          description="Increase visible focus guidance for keyboard and switch device navigation."
                          value={preferences.accessibility.focusRingStrength}
                          onChange={(value) => patchSection("accessibility", { focusRingStrength: value })}
                          options={[
                            { value: "standard", label: "Standard" },
                            { value: "strong", label: "Strong" },
                            { value: "maximum", label: "Maximum" },
                          ]}
                        />
                        <ToggleRow
                          label="Screen reader friendly mode"
                          description="A placeholder that keeps the page ready for richer semantic and skip link support later."
                          checked={preferences.accessibility.screenReaderFriendlyMode}
                          onChange={(value) => patchSection("accessibility", { screenReaderFriendlyMode: value })}
                        />
                        <ToggleRow
                          label="Keyboard navigation helper"
                          description="Show small helper cues when keyboard navigation is likely in use."
                          checked={preferences.accessibility.keyboardNavigationHelper}
                          onChange={(value) => patchSection("accessibility", { keyboardNavigationHelper: value })}
                        />
                        <ToggleRow
                          label="Dyslexia friendly font"
                          description="Use a more differentiated reading face when that improves comfort."
                          checked={preferences.accessibility.dyslexiaFriendlyFont}
                          onChange={(value) => patchSection("accessibility", { dyslexiaFriendlyFont: value })}
                        />
                        <SelectRow
                          label="Button size"
                          description="Increase tap and click target size across interactive controls."
                          value={preferences.accessibility.buttonSizePreference}
                          onChange={(value) => patchSection("accessibility", { buttonSizePreference: value })}
                          options={[
                            { value: "standard", label: "Standard" },
                            { value: "large", label: "Large" },
                          ]}
                        />
                        <SelectRow
                          label="Tooltip timing"
                          description="Adjust how quickly helper tips appear when you pause over controls."
                          value={preferences.accessibility.tooltipTimingPreference}
                          onChange={(value) => patchSection("accessibility", { tooltipTimingPreference: value })}
                          options={[
                            { value: "fast", label: "Fast" },
                            { value: "balanced", label: "Balanced" },
                            { value: "extended", label: "Extended" },
                          ]}
                        />
                        <ToggleRow
                          label="Reading ruler mode"
                          description="Keep a single line focus band visible for supported reading contexts later."
                          checked={preferences.accessibility.readingRulerMode}
                          onChange={(value) => patchSection("accessibility", { readingRulerMode: value })}
                        />
                      </SettingGroup>
                    </div>

                    <PreviewCard
                      eyebrow="Accessibility preview"
                      title="Clarity surface"
                      footer="This block shows contrast, text scale, and focus visibility together so tradeoffs are obvious."
                    >
                      <div className={`space-y-4 rounded-[24px] border p-4 ${preferences.accessibility.highContrastMode ? "border-sky-200/25 bg-slate-950" : "border-white/10 bg-[#0b1324]"}`}>
                        <div className={`rounded-2xl border p-4 ${preferences.accessibility.highContrastMode ? "border-sky-200/30 bg-slate-900" : "border-white/8 bg-black/12"}`}>
                          <p className={`font-medium ${preferences.accessibility.highContrastMode ? "text-white" : "text-slate-100"}`} style={{ fontSize: preferences.accessibility.largerTextMode ? 18 : 15 }}>
                            Readable interfaces should lower friction before they try to impress.
                          </p>
                          <p className={`mt-3 leading-7 ${preferences.accessibility.highContrastMode ? "text-slate-100" : "text-slate-300"}`} style={{ fontSize: preferences.accessibility.largerTextMode ? 17 : 14 }}>
                            The settings page treats contrast, focus guidance, and motion restraint as first class controls because they affect comprehension and confidence every day.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <InlineSummaryStat label="Focus ring" value={preferences.accessibility.focusRingStrength} />
                          <InlineSummaryStat label="Button size" value={preferences.accessibility.buttonSizePreference} />
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "privacy-and-data") ? (
                <SettingsSectionCard
                  id="privacy-and-data"
                  title="Privacy and data"
                  description="Make storage and trust decisions explicit, with plain language and visible consequences for destructive actions."
                  helper="Trust controls"
                  status={preferences.privacy.analyticsParticipation ? "Analytics on" : "Analytics off"}
                  icon={<Lock className="h-5 w-5" />}
                  right={<SectionPill>Danger zone included</SectionPill>}
                  mobileCollapsed={!openSections["privacy-and-data"]}
                  onToggleMobile={() => toggleSection("privacy-and-data")}
                  accent="rose"
                >
                  <div className="space-y-5">
                    <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
                      <div className="space-y-5">
                        <SettingGroup title="Data participation" description="Choose what helps improve the product and what stays off the record.">
                          <ToggleRow
                            label="Analytics participation"
                            description="Share product usage analytics so the team can improve weak spots and drop off points."
                            checked={preferences.privacy.analyticsParticipation}
                            onChange={(value) => patchSection("privacy", { analyticsParticipation: value })}
                          />
                          <ToggleRow
                            label="Personalized recommendations"
                            description="Use your reading and quiz behavior to tailor discovery and sequencing."
                            checked={preferences.privacy.personalizedRecommendations}
                            onChange={(value) => patchSection("privacy", { personalizedRecommendations: value })}
                          />
                          <ToggleRow
                            label="Save reading history"
                            description="Store chapter progress and session history for continuity and reporting."
                            checked={preferences.privacy.saveReadingHistory}
                            onChange={(value) => patchSection("privacy", { saveReadingHistory: value })}
                          />
                          <ToggleRow
                            label="Save quiz history"
                            description="Store quiz attempts, retries, and confidence patterns for future review."
                            checked={preferences.privacy.saveQuizHistory}
                            onChange={(value) => patchSection("privacy", { saveQuizHistory: value })}
                          />
                          <ToggleRow
                            label="Save notes"
                            description="Store local notes so annotations stay attached to your reading workflow."
                            checked={preferences.privacy.saveNotes}
                            onChange={(value) => patchSection("privacy", { saveNotes: value })}
                          />
                        </SettingGroup>

                        <SettingGroup title="Export and records" description="Keep self service data controls close at hand.">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Button variant="secondary" className="justify-start" onClick={handleExportData}>
                              <Download className="h-4 w-4" />
                              Export my data
                            </Button>
                            <Button variant="secondary" className="justify-start" onClick={handleDownloadProgressReport}>
                              <Gauge className="h-4 w-4" />
                              Download progress report
                            </Button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Button variant="secondary" className="justify-start" onClick={() => setConfirmAction("clear-reading-history")}>
                              Clear reading history
                            </Button>
                            <Button variant="secondary" className="justify-start" onClick={() => setConfirmAction("clear-quiz-history")}>
                              Clear quiz history
                            </Button>
                            <Button variant="secondary" className="justify-start sm:col-span-2" onClick={() => setConfirmAction("clear-notes")}>
                              Clear notes
                            </Button>
                          </div>
                        </SettingGroup>
                      </div>

                      <div className="space-y-5">
                        <PreviewCard
                          eyebrow="Active sessions"
                          title="Recent device activity"
                          footer="Session revocation connects here once backend device tracking is live."
                        >
                          <div className="rounded-2xl border border-white/8 bg-black/12 p-4 text-sm leading-6 text-slate-400">
                            Active session data is not yet available. Once backend session tracking is connected, this panel will show your devices, locations, and let you revoke individual sessions.
                          </div>
                          <Button variant="secondary" className="mt-4" onClick={() => setConfirmAction("sign-out-all")}>
                            Sign out of all devices
                          </Button>
                        </PreviewCard>

                        <div className="rounded-[28px] border border-rose-300/18 bg-rose-500/[0.05] p-5">
                          <div className="flex items-center gap-3">
                            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-rose-100">
                              <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.26em] text-rose-100/65">Danger zone</p>
                              <h3 className="mt-1 text-lg font-semibold text-rose-50">Account and local device actions</h3>
                            </div>
                          </div>
                          <div className="mt-5 space-y-4">
                            <DangerActionCard
                              title="Reset local settings"
                              description="Clear settings, progress, notes, and onboarding data stored in this browser. This is the strongest local reset action."
                              actionLabel="Reset local data"
                              onAction={() => setConfirmAction("reset-local-data")}
                            />
                            <DangerActionCard
                              title="Deactivate account"
                              description="Hide the account while preserving a review path for backend account lifecycle handling later."
                              actionLabel="Deactivate account"
                              onAction={() => setConfirmAction("deactivate-account")}
                            />
                            <DangerActionCard
                              title="Delete account"
                              description="Permanent deletion should always require an explicit confirmation path and a clear backend process."
                              actionLabel="Delete account"
                              onAction={() => setConfirmAction("delete-account")}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "billing-and-plan-controls") ? (
                <SettingsSectionCard
                  id="billing-and-plan-controls"
                  title="Billing and plan controls"
                  description="Show plan state clearly, explain upgrade value, and keep subscription management direct and calm."
                  helper="Plan transparency"
                  status={billingState.payload?.entitlement.plan ?? "Plan"}
                  icon={<CreditCard className="h-5 w-5" />}
                  right={<SectionPill>{billingState.payload?.paywall.price ?? "Subscription"}</SectionPill>}
                  mobileCollapsed={!openSections["billing-and-plan-controls"]}
                  onToggleMobile={() => toggleSection("billing-and-plan-controls")}
                  accent="amber"
                >
                  <div className="space-y-5">
                    <div className="rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Current plan</p>
                          <h3 className="mt-2 text-2xl font-semibold text-slate-50">
                            {billingState.loading
                              ? "Loading plan"
                              : billingState.payload?.entitlement.plan === "PRO"
                                ? "Pro"
                                : "Free"}
                          </h3>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                            {billingState.error
                              ? "Plan details could not be loaded right now."
                              : billingState.payload?.entitlement.plan === "PRO"
                                ? "Your account has Pro access. Billing management will be available in a future update."
                                : "You are using the Free plan. Upgrading to Pro will be available in a future update."}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:min-w-[200px]">
                          <Button variant="primary" disabled>
                            Upgrade to Pro
                          </Button>
                          <Button variant="secondary" disabled>
                            Manage subscription
                          </Button>
                          <p className="text-center text-[11px] text-slate-500">Billing management coming soon</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <InlineSummaryStat
                          label="Free books used"
                          value={billingState.payload ? billingState.payload.entitlement.unlockedBooksCount : "—"}
                        />
                        <InlineSummaryStat
                          label="Remaining free access"
                          value={billingState.payload ? billingState.payload.entitlement.remainingFreeStarts : "—"}
                        />
                        <InlineSummaryStat
                          label="Billing renewal"
                          value={billingState.payload?.entitlement.plan === "PRO" ? "Managed in portal" : "Not applicable"}
                        />
                        <InlineSummaryStat label="Payment method" value={billingState.payload?.entitlement.plan === "PRO" ? "Card on file" : "No payment method"} />
                      </div>
                    </div>

                    <PreviewCard
                      eyebrow="Free vs Pro"
                      title="Plan comparison"
                      footer="Full billing management will be available in a future update."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-black/12 p-4">
                          <p className="text-sm font-semibold text-slate-50">Free</p>
                          <ul className="mt-3 space-y-2 text-sm text-slate-300">
                            <li>Use your free book starts thoughtfully</li>
                            <li>Core reader and quiz flow</li>
                            <li>Local settings and privacy controls</li>
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
                          <p className="text-sm font-semibold text-sky-50">Pro</p>
                          <ul className="mt-3 space-y-2 text-sm text-sky-100/90">
                            {(billingState.payload?.paywall.benefits ?? [
                              "Unlimited book starts",
                              "Cross device continuity as backend support expands",
                              "Advanced learning controls as they ship",
                            ]).map((benefit) => (
                              <li key={benefit}>{benefit}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </PreviewCard>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {visibleSections.some((section) => section.id === "support-feedback-and-legal") ? (
                <SettingsSectionCard
                  id="support-feedback-and-legal"
                  title="Support, feedback, and legal"
                  description="Keep support calm and professional, separate legal information cleanly, and show that the product is actively maintained."
                  helper="Support and trust"
                  status={`v${appVersion}`}
                  icon={<HandHelping className="h-5 w-5" />}
                  right={<SectionPill>Maintained</SectionPill>}
                  mobileCollapsed={!openSections["support-feedback-and-legal"]}
                  onToggleMobile={() => toggleSection("support-feedback-and-legal")}
                >
                  <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <SupportActionCard
                          title="Help center"
                          description="Browse calm product guidance, common workflows, and product explanations."
                          buttonLabel="Open help center"
                          onClick={() => showToast("Help center content is being prepared. Check back soon.", "info")}
                        />
                        <SupportActionCard
                          title="Contact support"
                          description="Reach a human for account or product issues when self service does not solve it."
                          buttonLabel="Contact support"
                          onClick={() => window.open("mailto:support@chapterflow.io", "_blank")}
                        />
                        <SupportActionCard
                          title="Report a bug"
                          description="Flag issues with enough detail for the team to reproduce them quickly."
                          buttonLabel="Report a bug"
                          onClick={() => window.open("mailto:support@chapterflow.io?subject=Bug+Report", "_blank")}
                        />
                        <SupportActionCard
                          title="Request a feature"
                          description="Suggest improvements when the workflow itself needs to change."
                          buttonLabel="Request a feature"
                          onClick={() => window.open("mailto:support@chapterflow.io?subject=Feature+Request", "_blank")}
                        />
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Feedback</p>
                            <h3 className="mt-2 text-lg font-semibold text-slate-50">Send product feedback</h3>
                          </div>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (!feedbackText.trim()) {
                                showToast("Write some feedback before sending.", "info");
                                return;
                              }
                              window.open(
                                `mailto:feedback@chapterflow.io?subject=Product+Feedback&body=${encodeURIComponent(feedbackText)}`,
                                "_blank"
                              );
                              setFeedbackText("");
                              showToast("Opening your mail client with feedback ready to send.", "success");
                            }}
                          >
                            Send feedback
                          </Button>
                        </div>
                        <textarea
                          rows={5}
                          value={feedbackText}
                          onChange={(event) => setFeedbackText(event.target.value)}
                          placeholder="Share what felt confusing, what felt strong, or what should improve next."
                          className="mt-4 w-full rounded-2xl border border-white/10 bg-[#0d1424] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-300/35"
                        />
                      </div>
                    </div>

                    <div className="space-y-5">
                      <PreviewCard
                        eyebrow="FAQ"
                        title="Common questions"
                        footer={`ChapterFlow UI version ${appVersion}`}
                      >
                        <div className="space-y-3">
                          {FAQ_ENTRIES.map((entry) => (
                            <div key={entry.question} className="rounded-2xl border border-white/8 bg-black/12 p-4">
                              <p className="text-sm font-medium text-slate-100">{entry.question}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-400">{entry.answer}</p>
                            </div>
                          ))}
                        </div>
                      </PreviewCard>

                      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                        <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Legal</p>
                        <div className="mt-4 flex flex-col gap-3 text-sm">
                          <Link href="/legal/privacy" className="rounded-2xl border border-white/10 bg-black/12 px-4 py-3 text-slate-200 transition hover:border-white/18 hover:bg-white/[0.06]">
                            Privacy policy
                          </Link>
                          <Link href="/legal/terms" className="rounded-2xl border border-white/10 bg-black/12 px-4 py-3 text-slate-200 transition hover:border-white/18 hover:bg-white/[0.06]">
                            Terms
                          </Link>
                          <Link href="/legal/cookies" className="rounded-2xl border border-white/10 bg-black/12 px-4 py-3 text-slate-200 transition hover:border-white/18 hover:bg-white/[0.06]">
                            Cookie policy
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </SettingsSectionCard>
              ) : null}

              {isAdmin && visibleSections.some((section) => section.id === "admin-settings") ? (
                <SettingsSectionCard
                  id="admin-settings"
                  title="Admin only settings"
                  description="Private operational shortcuts stay separate from user facing controls so the main settings page remains clean for regular readers."
                  helper="Operator tools"
                  status="Admin only"
                  icon={<UserCog className="h-5 w-5" />}
                  right={<SectionPill>Hidden from standard users</SectionPill>}
                  mobileCollapsed={!openSections["admin-settings"]}
                  onToggleMobile={() => toggleSection("admin-settings")}
                  accent="amber"
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      { title: "Content management", description: "Open internal content tools and current published inventory.", icon: <LayoutPanelTop className="h-4 w-4" /> },
                      { title: "Upload book package", description: "Go straight to package upload for new or revised content files.", icon: <Upload className="h-4 w-4" /> },
                      { title: "Draft books", description: "Review draft versions before publishing changes live.", icon: <BookOpen className="h-4 w-4" /> },
                      { title: "Ingestion status", description: "Monitor current ingestion jobs and investigate failures quickly.", icon: <Gauge className="h-4 w-4" /> },
                      { title: "Feature flags", description: "Reserved for staged releases and interface experiments later.", icon: <Wand2 className="h-4 w-4" /> },
                      { title: "Analytics shortcut", description: "Reserved for direct access into internal book product analytics later.", icon: <GraduationCap className="h-4 w-4" /> },
                    ].map((card) => (
                      <div key={card.title} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/7 text-slate-100">
                          {card.icon}
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-50">{card.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>
                        <Button variant="secondary" className="mt-4">Open placeholder</Button>
                      </div>
                    ))}
                  </div>
                </SettingsSectionCard>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction ? confirmModalCopy[confirmAction].title : ""}
        description={confirmAction ? confirmModalCopy[confirmAction].description : ""}
        confirmLabel={confirmAction ? confirmModalCopy[confirmAction].confirmLabel : "Confirm"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleDestructiveAction}
      />

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />

      <div className="pointer-events-none fixed bottom-5 right-5 z-40 hidden rounded-2xl border border-white/10 bg-[#0b1324]/92 px-4 py-3 text-sm shadow-[0_18px_40px_rgba(2,6,23,0.46)] backdrop-blur md:flex md:items-center md:gap-3">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${saveState === "saving" ? "bg-amber-400/15 text-amber-100" : saveState === "saved" ? "bg-emerald-400/15 text-emerald-100" : "bg-sky-400/15 text-sky-100"}`}>
          {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === "saved" ? <ShieldCheck className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium text-slate-100">
            {saveState === "saving" ? "Saving changes" : saveState === "saved" ? "Changes saved" : "Auto save active"}
          </p>
          <p className="text-xs text-slate-400">{lastSavedAt ? `Last update ${lastSavedAt}` : "This page saves small changes automatically."}</p>
        </div>
      </div>
    </main>
  );
}
