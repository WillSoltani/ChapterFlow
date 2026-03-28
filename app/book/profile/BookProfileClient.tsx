"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Award,
  BookMarked,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Clock3,
  Flame,
  GraduationCap,
  Medal,
  NotebookPen,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { InfoModal } from "@/app/book/home/components/InfoModal";
import { Button } from "@/app/book/components/ui/Button";
import { Toast } from "@/app/book/components/ui/Toast";
import {
  getBookProgressStorageKey,
  getChapterReaderStorageKey,
  parseStoredBookProgress,
  parseStoredReaderState,
} from "@/app/book/_lib/reader-storage";
import type { BadgeState } from "@/app/book/data/mockBadges";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";
import { BOOK_STORAGE_EVENT, emitBookStorageChanged } from "@/app/book/hooks/bookStorageEvents";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useBookEntitlements } from "@/app/book/hooks/useBookEntitlements";
import { useBookProfile } from "@/app/book/hooks/useBookProfile";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useToast } from "@/app/book/hooks/useToast";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import {
  BadgeDetailPanel,
  BadgeTimelineItem,
  FeaturedBadgeCard,
  ProgressToNextBadgeCard,
} from "@/app/book/badges/components/BadgeSystemCards";
import { EditProfileModal } from "@/app/book/profile/components/EditProfileModal";
import {
  ActiveBookCard,
  ActiveDaysRing,
  CategoryMap,
  CompletionByModeChart,
  FadeIn,
  HeatmapCalendar,
  IdentityHeroBanner,
  MomentumCard,
  MomentumEmptyState,
  NewBadgeDot,
  NotePreviewCard,
  PinnedTakeawayCard,
  ProfileSkeleton,
  ProStatusCard,
  QuizBarChart,
  SectionCard,
  SectionNav,
  Sparkline,
  StaggeredBadgeGrid,
  StaggeredBadgeItem,
  StatCard,
  StickyMiniHeader,
  ThisWeekStrip,
  TimelineRow,
  UpgradeCard,
  UpNextPreview,
} from "@/app/book/profile/components/ProfilePrimitives";

// ─── Types ───

type BookProfileClientProps = {
  userEmail: string | null;
  appVersion: string;
};

type NoteEntry = {
  id: string;
  bookId: string;
  chapterId: string;
  title: string;
  body: string;
  meta: string;
  sortAt: string;
};

type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  sortAt: string;
  dateKey: string;
};

type QuizEntry = {
  id: string;
  label: string;
  score: number;
  sortAt: string;
};

// ─── Helpers ───

function formatMinutes(minutes: number) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes} min`;
}

function formatHours(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function mapLearningStyle(value: string) {
  if (value === "concise") return "Simple";
  if (value === "deep") return "Deeper";
  return "Standard";
}

function depthLabel(value: string) {
  if (value === "simple") return "Simple";
  if (value === "standard") return "Standard";
  return "Deeper";
}

function firstLine(text: string) {
  return text.split("\n").find((line) => line.trim())?.trim() || text.trim();
}

function summarizeNote(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177)}...`;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "R";
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

function toDayKeyLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Identity label (unchanged) ───

function getIdentityLabel(booksCompleted: number, categoriesCount: number): string {
  if (booksCompleted === 0) return "Getting Started";
  if (booksCompleted <= 2) return "Curious Reader";
  if (booksCompleted <= 5) return "Knowledge Seeker";
  if (booksCompleted <= 10) return "Dedicated Learner";
  if (booksCompleted <= 20) return "Knowledge Builder";
  if (booksCompleted > 20 && categoriesCount >= 5) return "Polymath";
  return "Knowledge Builder";
}

// ─── Streak microcopy — full lookup table (A5) ───

const STREAK_MILESTONES: [number, string][] = [
  [365, "One full year. Legendary. 👑"],
  [200, "200 days of reading. This is who you are now."],
  [100, "Triple digits. You've built something extraordinary 🎖️"],
  [50, "Fifty days. Half a hundred. Unstoppable."],
  [30, "30-day streak! Top 5% of ChapterFlow readers 🏆"],
  [21, "21 days — science says this is officially a habit 🧠"],
  [14, "Two weeks straight. This isn't a phase anymore."],
  [10, "Double digits — discipline is becoming instinct"],
  [7, "One full week! Your reading habit is taking shape ✨"],
  [5, "Five days strong — you're proving this is real"],
  [3, "3 days running — momentum is building"],
  [2, "Two in a row — a pattern is forming"],
  [1, "Day 1 — it all starts here 🔥"],
];

function getStreakMicrocopy(days: number): string {
  if (days === 0) return "Start a new streak today — one chapter lights the flame";
  for (const [milestone, msg] of STREAK_MILESTONES) {
    if (days >= milestone) return msg;
  }
  return `Keep going — day ${days} and counting`;
}

// ─── Quiz score subtitle (C3 improved) ───

function getQuizScoreSubtitle(score: number, hasQuizzes: boolean): string {
  if (!hasQuizzes) return "Complete your first quiz to start tracking retention";
  if (score < 50) return "Room to grow — try Deeper mode for better retention";
  if (score < 80) return "Solid understanding — you're retaining the key ideas";
  return "Exceptional recall — you're mastering this material";
}

// ─── Relative date for timeline (D4) ───

function relativeDateLabel(dateKey: string): string {
  const today = toDayKeyLocal(new Date());
  if (dateKey === today) return "Today";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === toDayKeyLocal(yesterday)) return "Yesterday";
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  if (dateKey === toDayKeyLocal(twoDaysAgo)) return "2 days ago";
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

// ─── Section IDs for nav (H3) ───

const SECTION_IDS = [
  { id: "hero", label: "Profile" },
  { id: "momentum", label: "Momentum" },
  { id: "performance", label: "Performance" },
  { id: "activity", label: "Activity" },
  { id: "achievements", label: "Achievements" },
  { id: "plan", label: "Plan" },
  { id: "reflection", label: "Reflection" },
  { id: "history", label: "History" },
];

// ─── Main component ───

export function BookProfileClient({ userEmail, appVersion }: BookProfileClientProps) {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [showMiniHeader, setShowMiniHeader] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);
  const [achievementView, setAchievementView] = useState<"showcase" | "timeline">("showcase");
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [takeawayText, setTakeawayText] = useState("");
  const { toast, showToast } = useToast();

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const { analytics, hydrated: analyticsHydrated } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );
  const { state: profile, hydrated: profileHydrated, patch: patchProfile } = useBookProfile({
    displayName: viewerIdentity.displayName || "Reader",
    pronouns: onboarding.pronoun,
    createdAt: onboarding.completedAt,
  });
  const { billingState, launchBillingAction } = useBookEntitlements(
    onboarding.setupComplete
  );
  const badgeSystem = useBadgeSystem({
    selectedBookIds: onboarding.selectedBookIds,
    dailyGoalMinutes: onboarding.dailyGoalMinutes,
    plan: billingState.payload?.entitlement.plan ?? "FREE",
  });

  // ─── Storage sync ───

  useEffect(() => {
    function onStorageChange() {
      setRevision((v) => v + 1);
    }
    window.addEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
    window.addEventListener("storage", onStorageChange);
    window.addEventListener("focus", onStorageChange);
    return () => {
      window.removeEventListener(BOOK_STORAGE_EVENT, onStorageChange as EventListener);
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("focus", onStorageChange);
    };
  }, []);

  // ─── Redirect if not onboarded ───

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  // Gate: true once all data is loaded and sections are in the DOM
  const contentReady = onboardingHydrated && analyticsHydrated && badgeSystem.hydrated && profileHydrated && onboarding.setupComplete;

  // ─── Sticky mini-header observer (disabled — mini-header not used) ───
  void showMiniHeader;

  // ─── Section nav observer (H3) ───

  useEffect(() => {
    if (!contentReady) return;
    const els = SECTION_IDS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the most-visible intersecting entry
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const idx = SECTION_IDS.findIndex((s) => s.id === visible[0].target.id);
          if (idx >= 0) setActiveSectionIdx(idx);
        }
      },
      { rootMargin: "-30% 0px -30% 0px", threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [contentReady]);

  const handleSectionNav = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ─── Derived data ───

  const localInsights = useMemo(() => {
    if (!analyticsHydrated) {
      return {
        quizQuestionsAnswered: 0,
        notes: [] as NoteEntry[],
        recentQuizEntries: [] as QuizEntry[],
        activityLog: [] as ActivityEntry[],
        depthCounts: { simple: 0, standard: 0, deeper: 0 },
        recentOpenedChapters: [] as ActivityEntry[],
        categoriesSet: new Set<string>(),
      };
    }

    const notes: NoteEntry[] = [];
    const recentQuizEntries: QuizEntry[] = [];
    const activityLog: ActivityEntry[] = [];
    const recentOpenedChapters: ActivityEntry[] = [];
    const depthCounts = { simple: 0, standard: 0, deeper: 0 };
    const categoriesSet = new Set<string>();
    let quizQuestionsAnswered = 0;
    void revision;

    for (const snapshot of analytics?.bookSnapshots ?? []) {
      if (snapshot.book.category) categoriesSet.add(snapshot.book.category);

      const progress = parseStoredBookProgress(
        window.localStorage.getItem(getBookProgressStorageKey(snapshot.book.id))
      );
      const chapters = getBookChaptersBundle(snapshot.book.id).chapters;
      const chapterMap = new Map(chapters.map((ch) => [ch.id, ch]));

      if (progress?.lastReadChapterId) {
        const chapter = chapterMap.get(progress.lastReadChapterId);
        const dateStr = progress.lastOpenedAt;
        const dateKey = dateStr ? toDayKeyLocal(new Date(dateStr)) : "";
        recentOpenedChapters.push({
          id: `${snapshot.book.id}:${progress.lastReadChapterId}:opened`,
          title: chapter ? `${snapshot.book.title} • ${chapter.code}` : `${snapshot.book.title} • Recent chapter`,
          detail: chapter ? chapter.title : "Recent chapter activity",
          meta: new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          sortAt: dateStr,
          dateKey,
        });
      }

      Object.entries(progress?.chapterCompletedAt ?? {}).forEach(([chapterId, completedAt]) => {
        const chapter = chapterMap.get(chapterId);
        if (!chapter) return;
        const dateKey = toDayKeyLocal(new Date(completedAt));
        activityLog.push({
          id: `${snapshot.book.id}:${chapterId}:completed`,
          title: `${snapshot.book.title} • ${chapter.code}`,
          detail: `Completed ${chapter.title}`,
          meta: new Date(completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          sortAt: completedAt,
          dateKey,
        });
      });

      for (const chapter of chapters) {
        const reader = parseStoredReaderState(
          window.localStorage.getItem(getChapterReaderStorageKey(snapshot.book.id, chapter.id))
        );
        if (!reader) continue;
        depthCounts[reader.readingDepth] += 1;
        quizQuestionsAnswered += Object.keys(reader.quizAnswers).length;

        if (reader.quizResult) {
          const sortAt = progress?.chapterCompletedAt?.[chapter.id] ?? progress?.lastOpenedAt ?? "1970-01-01T00:00:00.000Z";
          recentQuizEntries.push({
            id: `${snapshot.book.id}:${chapter.id}:quiz`,
            label: `${snapshot.book.title} • ${chapter.code}`,
            score: reader.quizResult.score,
            sortAt,
          });
        }

        if (reader.notes.trim()) {
          const sortAt = progress?.lastOpenedAt ?? "1970-01-01T00:00:00.000Z";
          notes.push({
            id: `${snapshot.book.id}:${chapter.id}:note`,
            bookId: snapshot.book.id,
            chapterId: chapter.id,
            title: `${snapshot.book.title} • ${chapter.code}`,
            body: summarizeNote(reader.notes),
            meta: chapter.title,
            sortAt,
          });
        }
      }
    }

    notes.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
    recentQuizEntries.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
    activityLog.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
    recentOpenedChapters.sort((a, b) => b.sortAt.localeCompare(a.sortAt));

    return { quizQuestionsAnswered, notes, recentQuizEntries, activityLog, depthCounts, recentOpenedChapters, categoriesSet };
  }, [analytics, analyticsHydrated, revision]);

  const statsSummary = useMemo(() => {
    const totalReadingMinutes = analytics?.heatmapCells.reduce((sum, cell) => sum + cell.minutes, 0) ?? 0;
    return {
      currentStreak: analytics?.streakDays ?? 0,
      longestStreak: analytics?.longestStreak ?? 0,
      booksCompleted: analytics?.booksCompleted ?? 0,
      totalChaptersCompleted: analytics?.totalCompletedChapters ?? 0,
      quizQuestionsAnswered: localInsights.quizQuestionsAnswered,
      averageQuizScore: analytics?.avgQuizScore ?? 0,
      maxQuizScore: analytics?.maxQuizScore ?? 0,
      totalReadingMinutes,
      categoriesCount: localInsights.categoriesSet.size,
      minutesReadToday: analytics?.minutesReadToday ?? 0,
    };
  }, [analytics, localInsights.quizQuestionsAnswered, localInsights.categoriesSet.size]);

  const currentSnapshot = useMemo(() => {
    const sorted = [...(analytics?.bookSnapshots ?? [])].sort((a, b) => {
      const aR = a.status === "in_progress" ? 0 : a.status === "not_started" ? 1 : 2;
      const bR = b.status === "in_progress" ? 0 : b.status === "not_started" ? 1 : 2;
      if (aR !== bR) return aR - bR;
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
    return sorted[0] ?? null;
  }, [analytics]);

  const activeBooks = useMemo(
    () => [...(analytics?.bookSnapshots ?? [])]
      .filter((s) => s.status === "in_progress")
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, 4),
    [analytics]
  );

  const recentFinishedBooks = useMemo(
    () => [...(analytics?.bookSnapshots ?? [])]
      .filter((s) => s.status === "completed")
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, 4),
    [analytics]
  );

  // 2.1: "Up next" suggestion
  const upNextSuggestion = useMemo(() => {
    if (!currentSnapshot) return null;
    // If other books are in progress, suggest the most recent one
    const otherActive = activeBooks.find((s) => s.book.id !== currentSnapshot.book.id);
    if (otherActive) {
      return { label: "Also in progress", title: otherActive.book.title, category: otherActive.book.category, bookId: otherActive.book.id };
    }
    // Otherwise suggest from same category
    const sameCategory = (analytics?.bookSnapshots ?? []).find(
      (s) => s.book.category === currentSnapshot.book.category && s.book.id !== currentSnapshot.book.id && s.status === "not_started"
    );
    if (sameCategory) {
      return { label: "When you finish, explore", title: sameCategory.book.title, category: sameCategory.book.category, bookId: sameCategory.book.id };
    }
    return null;
  }, [currentSnapshot, activeBooks, analytics]);

  // E2: Category exploration map
  const exploredCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const snapshot of analytics?.bookSnapshots ?? []) {
      const cat = snapshot.book.category;
      if (cat && snapshot.completedChapters > 0) {
        catMap.set(cat, (catMap.get(cat) ?? 0) + snapshot.completedChapters);
      }
    }
    return Array.from(catMap.entries())
      .map(([name, chapters]) => ({ name, chapters }))
      .sort((a, b) => b.chapters - a.chapters);
  }, [analytics]);

  // B1/B2: Current reading details with learning loop steps + chapter time
  const currentReadingDetails = useMemo(() => {
    if (!currentSnapshot) return null;
    void revision;
    const progress = parseStoredBookProgress(
      window.localStorage.getItem(getBookProgressStorageKey(currentSnapshot.book.id))
    );
    const chapters = getBookChaptersBundle(currentSnapshot.book.id).chapters;
    const currentChapterId = progress?.currentChapterId || currentSnapshot.resumeChapterId || chapters[0]?.id || "";
    const chapter = chapters.find((c) => c.id === currentChapterId) ?? chapters[0];
    const completedSet = new Set(progress?.completedChapterIds ?? []);
    const remainingMinutes = chapters
      .filter((c) => !completedSet.has(c.id))
      .reduce((sum, c) => sum + c.minutes, 0);
    const reader = chapter
      ? parseStoredReaderState(
          window.localStorage.getItem(getChapterReaderStorageKey(currentSnapshot.book.id, chapter.id))
        )
      : null;

    // B1: Determine 4-step completion
    const summaryDone = reader != null;
    const scenariosDone = reader?.showRecap === true;
    const quizDone = reader?.quizResult != null;
    const unlockDone = chapter ? completedSet.has(chapter.id) : false;

    const chapterIdx = chapter ? chapters.findIndex((c) => c.id === chapter.id) : 0;

    return {
      chapterLabel: chapter ? `${chapter.code} ${chapter.title}` : "Ready to start",
      mode: reader ? depthLabel(reader.readingDepth) : mapLearningStyle(onboarding.learningStyle),
      bookEta: formatMinutes(Math.max(remainingMinutes, 10)),
      chapterMinutes: chapter?.minutes ?? 15,
      chapterNumber: chapterIdx + 1,
      totalChapters: chapters.length,
      completedSteps: [summaryDone, scenariosDone, quizDone, unlockDone],
      chapterId: chapter?.id ?? currentSnapshot.resumeChapterId,
    };
  }, [currentSnapshot, onboarding.learningStyle, revision]);

  const completionByMode = useMemo(() => {
    const total = localInsights.depthCounts.simple + localInsights.depthCounts.standard + localInsights.depthCounts.deeper;
    if (!total) return [
      { label: "Simple", value: 0 },
      { label: "Standard", value: 0 },
      { label: "Deeper", value: 0 },
    ];
    return [
      { label: "Simple", value: Math.round((localInsights.depthCounts.simple / total) * 100) },
      { label: "Standard", value: Math.round((localInsights.depthCounts.standard / total) * 100) },
      { label: "Deeper", value: Math.round((localInsights.depthCounts.deeper / total) * 100) },
    ];
  }, [localInsights.depthCounts]);

  const monthlySummary = useMemo(() => {
    const lastThirty = analytics?.heatmapCells.slice(-30) ?? [];
    return {
      minutes: lastThirty.reduce((sum, cell) => sum + cell.minutes, 0),
      chapters: lastThirty.reduce((sum, cell) => sum + cell.chapters, 0),
      activeDays: lastThirty.filter((cell) => cell.minutes > 0).length,
    };
  }, [analytics]);

  // D2: Sparkline data
  const sparklineData = useMemo(
    () => (analytics?.heatmapCells.slice(-30) ?? []).map((c) => c.minutes),
    [analytics]
  );

  // E1: Featured earned + 2 closest locked badges
  const profileBadgeShowcase = useMemo(
    () => badgeSystem.featuredBadges.slice(0, 5),
    [badgeSystem.featuredBadges]
  );

  const closestLockedBadges = useMemo(
    () => [...badgeSystem.lockedBadges]
      .filter((b) => b.targetValue > 0 && b.progressValue > 0)
      .sort((a, b) => (b.progressValue / b.targetValue) - (a.progressValue / a.targetValue))
      .slice(0, 2),
    [badgeSystem.lockedBadges]
  );

  const profileNextMilestone = useMemo(
    () => badgeSystem.nextMilestones[0] ?? null,
    [badgeSystem.nextMilestones]
  );

  const profileBadgeTimeline = useMemo(
    () => badgeSystem.badgeTimeline.slice(0, 4),
    [badgeSystem.badgeTimeline]
  );

  // D4: Grouped timeline entries
  const groupedTimeline = useMemo(() => {
    const allEntries = [...localInsights.activityLog, ...localInsights.recentOpenedChapters]
      .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
      .slice(0, 8);
    const groups: { dateKey: string; label: string; entries: ActivityEntry[] }[] = [];
    for (const entry of allEntries) {
      const key = entry.dateKey;
      const last = groups[groups.length - 1];
      if (last && last.dateKey === key) {
        last.entries.push(entry);
      } else {
        groups.push({ dateKey: key, label: relativeDateLabel(key), entries: [entry] });
      }
    }
    return groups;
  }, [localInsights.activityLog, localInsights.recentOpenedChapters]);

  // G4: Quiz trend
  const quizTrend = useMemo(() => {
    const entries = localInsights.recentQuizEntries.slice(0, 10);
    if (entries.length < 2) return null;
    const avg = entries.reduce((s, e) => s + e.score, 0) / entries.length;
    const firstHalf = entries.slice(Math.floor(entries.length / 2));
    const secondHalf = entries.slice(0, Math.floor(entries.length / 2));
    const avgFirst = firstHalf.reduce((s, e) => s + e.score, 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((s, e) => s + e.score, 0) / (secondHalf.length || 1);
    const direction: "up" | "down" | "steady" = avgSecond > avgFirst + 3 ? "up" : avgSecond < avgFirst - 3 ? "down" : "steady";
    return { avg: Math.round(avg), best: Math.max(...entries.map((e) => e.score)), direction };
  }, [localInsights.recentQuizEntries]);

  // ─── Plan state ───

  const plan = billingState.payload?.entitlement.plan ?? "FREE";
  const isPro = plan === "PRO";
  const isActivePro = isPro && (billingState.payload?.entitlement.proStatus === "active" || billingState.payload?.entitlement.proStatus === "past_due");

  // ─── Handlers ───

  const saveProfile = async (values: Partial<typeof profile>) => {
    patchProfile(values);
    setEditOpen(false);
    showToast("Profile updated", "success");
  };

  const handleBillingAction = async (kind: "upgrade" | "portal") => {
    const message = await launchBillingAction(kind);
    if (message) showToast(message, "error");
  };

  const navigateToSettings = () => router.push("/book/settings");

  const handleSaveTakeaway = useCallback(() => {
    const text = takeawayText.trim();
    if (!text || !currentSnapshot) return;
    const chapterId = currentReadingDetails?.chapterId ?? currentSnapshot.resumeChapterId;
    const storageKey = getChapterReaderStorageKey(currentSnapshot.book.id, chapterId);
    const existing = parseStoredReaderState(window.localStorage.getItem(storageKey));
    const updated = existing
      ? { ...existing, notes: existing.notes ? `${existing.notes}\n\n${text}` : text }
      : {
          activeTab: "summary" as const,
          readingDepth: "standard" as const,
          exampleFilter: "all" as const,
          quizAnswers: {},
          quizResult: null,
          quizRetakeCount: 0,
          quizFailureStreak: 0,
          quizCooldownUntil: null,
          notes: text,
          focusMode: false,
          fontScale: "md" as const,
          showRecap: false,
          explanationOpen: {},
        };
    window.localStorage.setItem(storageKey, JSON.stringify(updated));
    emitBookStorageChanged("profile:takeaway");
    setTakeawayText("");
    showToast("Takeaway saved", "success");
  }, [takeawayText, currentSnapshot, currentReadingDetails, showToast]);

  // ─── Loading state (H5) ───

  if (!onboardingHydrated || !analyticsHydrated || !badgeSystem.hydrated || !profileHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <ProfileSkeleton />
      </main>
    );
  }

  const viewerName = profile.displayName || viewerIdentity.displayName || "Reader";
  const identityLabel = getIdentityLabel(statsSummary.booksCompleted, statsSummary.categoriesCount);
  const streakMicrocopy = getStreakMicrocopy(statsSummary.currentStreak);

  // C4: Personal best streak indicator
  const isPersonalBest = statsSummary.currentStreak > 0 && statsSummary.currentStreak >= statsSummary.longestStreak;
  const streakHelper = isPersonalBest
    ? "🏆 This IS your longest streak — keep pushing!"
    : statsSummary.longestStreak > 0
      ? `Your longest: ${statsSummary.longestStreak} days — ${statsSummary.longestStreak - statsSummary.currentStreak} days to beat it`
      : "Start building your record";

  // F2: Upgrade message
  const upgradeMessage = statsSummary.booksCompleted > 0
    ? `You've completed ${statsSummary.totalChaptersCompleted} chapters. Unlock 93+ more books, advanced quizzes, streak freezes, and full reading analytics with Pro.`
    : "Unlock 93+ more books, advanced quizzes, streak freezes, and full reading analytics.";

  // H4: Last updated
  const lastUpdated = "Stats updated just now";

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        activeTab="profile"
        searchQuery=""
        onSearchChange={() => undefined}
        searchInputRef={{ current: null }}
        showSearch={false}
        logoVariant="dashboard"
      />

      {/* H3: Section dot navigator */}
      <SectionNav sections={SECTION_IDS} activeIndex={activeSectionIdx} onNavigate={handleSectionNav} />

      {/* H7: Consistent spacing — 48px mobile (space-y-12), 64px desktop (lg:space-y-16) */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto w-full max-w-450 space-y-12 px-4 pb-28 pt-7 sm:px-6 lg:space-y-16 lg:px-10 lg:pt-8 xl:px-16"
      >

        {/* ═══ SECTION 1: Identity Hero Banner ═══ */}
        <div ref={heroRef} id="hero">
          <IdentityHeroBanner
            avatar={profile.avatarDataUrl}
            initials={initialsFromName(viewerName)}
            name={viewerName}
            username={profile.username}
            bio={profile.bio || profile.tagline || "Building a sharper reading practice with ChapterFlow."}
            plan={plan}
            identityLabel={identityLabel}
            streakDays={statsSummary.currentStreak}
            streakMicrocopy={streakMicrocopy}
            booksCompleted={statsSummary.booksCompleted}
            totalHours={formatHours(statsSummary.totalReadingMinutes)}
            dailyGoalMinutes={onboarding.dailyGoalMinutes}
            minutesReadToday={statsSummary.minutesReadToday}
            onEdit={() => setEditOpen(true)}
            onSettings={navigateToSettings}
          />
          {/* H4 */}
          <p className="mt-2 text-right text-xs text-(--cf-text-soft)">{lastUpdated}</p>
        </div>

        {/* ═══ SECTION 2: Momentum Zone ═══ */}
        <FadeIn delay={0.05}>
          <div id="momentum">
            <SectionCard
              eyebrow="Momentum"
              title="Pick up where you left off"
              description="The fastest way back into focused reading."
              icon={<BookOpen className="h-5 w-5" />}
            >
              {currentSnapshot && currentReadingDetails ? (
                <div className="space-y-5">
                  {/* B3: Full-width momentum card */}
                  <MomentumCard
                    title={currentSnapshot.book.title}
                    chapterLabel={currentReadingDetails.chapterLabel}
                    mode={currentReadingDetails.mode}
                    progress={currentSnapshot.progressPercent}
                    bookEta={currentReadingDetails.bookEta}
                    chapterMinutes={currentReadingDetails.chapterMinutes}
                    chapterNumber={currentReadingDetails.chapterNumber}
                    totalChapters={currentReadingDetails.totalChapters}
                    completedSteps={currentReadingDetails.completedSteps}
                    dailyGoalMinutes={onboarding.dailyGoalMinutes}
                    onContinue={() =>
                      router.push(
                        `/book/library/${encodeURIComponent(currentSnapshot.book.id)}/chapter/${encodeURIComponent(currentReadingDetails.chapterId)}`
                      )
                    }
                  />

                  {/* 2.1: Up-next suggestion */}
                  {upNextSuggestion ? (
                    <UpNextPreview
                      label={upNextSuggestion.label}
                      bookTitle={upNextSuggestion.title}
                      category={upNextSuggestion.category}
                      onClick={() => router.push(`/book/library/${encodeURIComponent(upNextSuggestion.bookId)}`)}
                    />
                  ) : null}

                  {/* B4: "Also in progress" / up-next preview */}
                  {activeBooks.length > 1 ? (
                    <div className="space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Also in progress</p>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {activeBooks.filter((s) => s.book.id !== currentSnapshot.book.id).slice(0, 2).map((snapshot) => {
                          const progress = parseStoredBookProgress(
                            window.localStorage.getItem(getBookProgressStorageKey(snapshot.book.id))
                          );
                          const chapter = getBookChaptersBundle(snapshot.book.id).chapters.find(
                            (c) => c.id === (progress?.currentChapterId || snapshot.resumeChapterId)
                          );
                          const remainingMinutes = getBookChaptersBundle(snapshot.book.id).chapters
                            .filter((c) => !(progress?.completedChapterIds ?? []).includes(c.id))
                            .reduce((sum, c) => sum + c.minutes, 0);
                          return (
                            <ActiveBookCard
                              key={snapshot.book.id}
                              title={snapshot.book.title}
                              author={snapshot.book.author}
                              bookId={snapshot.book.id}
                              coverImage={snapshot.book.coverImage}
                              icon={snapshot.book.icon}
                              progress={snapshot.progressPercent}
                              chapterLabel={chapter ? `${chapter.code} ${chapter.title}` : snapshot.lastOpenedLabel}
                              eta={formatMinutes(Math.max(remainingMinutes, 10))}
                              onContinue={() =>
                                router.push(
                                  `/book/library/${encodeURIComponent(snapshot.book.id)}/chapter/${encodeURIComponent(progress?.currentChapterId || snapshot.resumeChapterId)}`
                                )
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <MomentumEmptyState onBrowse={() => router.push("/book/library")} />
              )}
            </SectionCard>
          </div>
        </FadeIn>

        {/* ═══ SECTION 3: Performance Dashboard ═══ */}
        <FadeIn delay={0.1}>
          <div id="performance">
            <SectionCard
              eyebrow="Performance"
              title="Reading performance"
              description="Measurable progress across your reading practice."
              icon={<Sparkles className="h-5 w-5" />}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  icon={<Flame className="h-5 w-5" />}
                  label="Current streak"
                  value={`${statsSummary.currentStreak} days`}
                  helper={streakHelper}
                  animate numericValue={statsSummary.currentStreak}
                  formatFn={(v) => `${Math.round(v)} days`}
                  performanceLevel={statsSummary.currentStreak >= 7 ? "strong" : statsSummary.currentStreak > 0 ? "active" : "zero"}
                  accentColor="var(--accent-amber)"
                  valueColorClass={statsSummary.currentStreak > 0 ? "text-[var(--accent-amber)]" : undefined}
                />
                <StatCard
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  label="Books completed"
                  value={statsSummary.booksCompleted}
                  helper={statsSummary.booksCompleted > 0 ? `Across ${statsSummary.categoriesCount} categories` : "Your first finish line is closer than you think"}
                  animate numericValue={statsSummary.booksCompleted}
                  performanceLevel={statsSummary.booksCompleted >= 5 ? "strong" : statsSummary.booksCompleted > 0 ? "active" : "zero"}
                  accentColor="var(--accent-cyan)"
                />
                <StatCard
                  icon={<BookMarked className="h-5 w-5" />}
                  label="Chapters completed"
                  value={statsSummary.totalChaptersCompleted}
                  helper={statsSummary.totalChaptersCompleted > 0 ? `That's ${statsSummary.totalChaptersCompleted} learning loops finished` : "Complete a chapter to start tracking"}
                  animate numericValue={statsSummary.totalChaptersCompleted}
                  performanceLevel={statsSummary.totalChaptersCompleted >= 10 ? "strong" : statsSummary.totalChaptersCompleted > 0 ? "active" : "zero"}
                  accentColor="var(--accent-violet)"
                />
                <StatCard
                  icon={<Target className="h-5 w-5" />}
                  label="Average quiz score"
                  value={formatPercent(statsSummary.averageQuizScore)}
                  helper={getQuizScoreSubtitle(statsSummary.averageQuizScore, statsSummary.quizQuestionsAnswered > 0)}
                  performanceLevel={statsSummary.averageQuizScore >= 80 ? "strong" : statsSummary.averageQuizScore > 0 ? "active" : "zero"}
                  accentColor="var(--accent-emerald)"
                  valueColorClass={
                    statsSummary.averageQuizScore > 70
                      ? "text-[var(--accent-emerald)]"
                      : statsSummary.averageQuizScore >= 50
                        ? "text-[var(--accent-amber)]"
                        : statsSummary.averageQuizScore > 0
                          ? "text-[var(--accent-rose)]"
                          : undefined
                  }
                />
                <StatCard
                  icon={<Clock3 className="h-5 w-5" />}
                  label="Total reading time"
                  value={formatHours(statsSummary.totalReadingMinutes)}
                  helper={statsSummary.totalReadingMinutes >= 300 ? `That's ${Math.floor(statsSummary.totalReadingMinutes / 60)} hours of focused learning` : "Every minute compounds"}
                  performanceLevel={statsSummary.totalReadingMinutes >= 300 ? "strong" : statsSummary.totalReadingMinutes > 0 ? "active" : "zero"}
                  accentColor="var(--accent-cyan)"
                />
                <StatCard
                  icon={<Brain className="h-5 w-5" />}
                  label="Quiz questions answered"
                  value={statsSummary.quizQuestionsAnswered}
                  helper="Knowledge tested and strengthened"
                  animate numericValue={statsSummary.quizQuestionsAnswered}
                  performanceLevel={statsSummary.quizQuestionsAnswered >= 20 ? "strong" : statsSummary.quizQuestionsAnswered > 0 ? "active" : "zero"}
                  accentColor="var(--accent-violet)"
                />
              </div>

              {/* C5: Completion by mode */}
              {(localInsights.depthCounts.simple + localInsights.depthCounts.standard + localInsights.depthCounts.deeper) > 0 ? (
                <div className="mt-6 rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                  <h3 className="text-sm font-semibold text-(--cf-text-1)">Completion by mode</h3>
                  <p className="mt-1 text-sm text-(--cf-text-3)">How you distribute your reading depth</p>
                  <div className="mt-4">
                    <CompletionByModeChart data={completionByMode} counts={localInsights.depthCounts} />
                  </div>
                </div>
              ) : null}

              {/* E2: Knowledge / Category map */}
              {exploredCategories.length > 0 ? (
                <div className="mt-6 rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                  <CategoryMap
                    explored={exploredCategories}
                    totalCategories={21}
                    onCategoryClick={(cat) => router.push(`/book/library?category=${encodeURIComponent(cat)}`)}
                  />
                </div>
              ) : null}
            </SectionCard>
          </div>
        </FadeIn>

        {/* ═══ SECTION 4: Monthly Summary & Activity ═══ */}
        <FadeIn delay={0.15}>
          <div id="activity">
            <SectionCard
              eyebrow="Activity"
              title="Monthly summary"
              icon={<Calendar className="h-5 w-5" />}
              right={<span className="rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Last 30 days</span>}
            >
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                {/* Left: Stats + D3 ring + D2 sparkline + heatmap */}
                <div className="space-y-5">
                  <div className="flex items-start gap-5">
                    {/* D3: Active days ring */}
                    <ActiveDaysRing active={monthlySummary.activeDays} total={30} />
                    <div className="flex-1 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <StatCard icon={<Clock3 className="h-4 w-4" />} label="Reading time" value={formatMinutes(monthlySummary.minutes)} />
                        <StatCard icon={<BookMarked className="h-4 w-4" />} label="Chapters" value={monthlySummary.chapters} />
                      </div>
                      {/* D2: Sparkline */}
                      {sparklineData.some((v) => v > 0) ? (
                        <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface) p-3">
                          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-(--cf-text-soft)">Daily reading</p>
                          <Sparkline data={sparklineData} />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* D1: Heatmap with today indicator */}
                  <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Reading activity</p>
                    <HeatmapCalendar cells={analytics?.heatmapCells ?? []} />
                    {/* E1: This Week strip */}
                    {statsSummary.currentStreak > 0 || monthlySummary.activeDays > 0 ? (
                      <div className="mt-3">
                        <ThisWeekStrip cells={analytics?.heatmapCells ?? []} />
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Right: D4 Grouped activity timeline */}
                <div className="relative rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-(--cf-text-1)">Activity timeline</h3>
                    <span className="text-xs text-(--cf-text-soft)">Last active {analytics?.lastActiveLabel ?? "No activity yet"}</span>
                  </div>
                  <div className="mt-4 max-h-[400px] space-y-4 overflow-y-auto">
                    {groupedTimeline.length > 0 ? (
                      groupedTimeline.map((group) => (
                        <div key={group.dateKey}>
                          <div className="mb-2 flex items-center gap-3">
                            <div className="h-px flex-1 bg-(--cf-border)" />
                            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-(--cf-text-soft)">{group.label}</span>
                            <div className="h-px flex-1 bg-(--cf-border)" />
                          </div>
                          <div className="space-y-2">
                            {group.entries.map((entry) => (
                              <TimelineRow key={entry.id} title={entry.title} detail={entry.detail} meta={entry.meta} />
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm text-(--cf-text-3)">
                        Your reading activity will build a timeline here as you progress through chapters.
                      </p>
                    )}
                  </div>
                  {/* Fade-out gradient at bottom */}
                  {groupedTimeline.length > 2 ? (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 rounded-b-[26px] bg-linear-to-t from-(--cf-surface-muted) to-transparent" />
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>
        </FadeIn>

        {/* ═══ SECTION 5: Achievements & Milestones ═══ */}
        <FadeIn delay={0.2}>
          <div id="achievements">
            <SectionCard
              eyebrow="Milestones"
              title="Achievements"
              description="Celebrate what you've earned and see what's next."
              icon={<Award className="h-5 w-5" />}
              right={<Button variant="secondary" onClick={() => router.push("/book/badges")}>View all achievements</Button>}
            >
              <div className="space-y-6">
                {/* E2: Next milestone */}
                {profileNextMilestone ? (
                  <ProgressToNextBadgeCard
                    milestone={profileNextMilestone}
                    onOpen={() => setSelectedBadge(profileNextMilestone.badge)}
                  />
                ) : null}

                {/* E3: Showcase / Timeline toggle */}
                <div className="flex items-center gap-4 border-b border-(--cf-border) pb-3">
                  <button
                    type="button"
                    onClick={() => setAchievementView("showcase")}
                    className={`text-sm font-medium transition ${achievementView === "showcase" ? "text-(--cf-text-1) underline underline-offset-4" : "text-(--cf-text-soft) hover:text-(--cf-text-2)"}`}
                  >
                    Showcase
                  </button>
                  <button
                    type="button"
                    onClick={() => setAchievementView("timeline")}
                    className={`text-sm font-medium transition ${achievementView === "timeline" ? "text-(--cf-text-1) underline underline-offset-4" : "text-(--cf-text-soft) hover:text-(--cf-text-2)"}`}
                  >
                    Timeline
                  </button>
                </div>

                {achievementView === "showcase" ? (
                  <StaggeredBadgeGrid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {profileBadgeShowcase.length > 0 ? (
                      profileBadgeShowcase.map((badge, index) => (
                        <StaggeredBadgeItem key={badge.id}>
                          <FeaturedBadgeCard
                            badge={badge}
                            subtitle={index < 2 ? "Recent highlight" : "Prestige highlight"}
                            onOpen={() => setSelectedBadge(badge)}
                          />
                        </StaggeredBadgeItem>
                      ))
                    ) : null}
                    {/* E1: Show 2 closest locked badges */}
                    {closestLockedBadges.map((badge) => (
                      <StaggeredBadgeItem key={badge.id}>
                        <div className="relative">
                          <FeaturedBadgeCard
                            badge={badge}
                            subtitle={`${badge.progressValue}/${badge.targetValue} — ${Math.round((badge.progressValue / badge.targetValue) * 100)}%`}
                            onOpen={() => setSelectedBadge(badge)}
                          />
                        </div>
                      </StaggeredBadgeItem>
                    ))}
                    {!profileBadgeShowcase.length && !closestLockedBadges.length ? (
                      <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) p-5 text-sm text-(--cf-text-3) sm:col-span-2 xl:col-span-3">
                        Complete your first chapter to start earning badges. Every reading session brings you closer to your first milestone.
                      </div>
                    ) : null}
                  </StaggeredBadgeGrid>
                ) : (
                  // Timeline view
                  <div className="space-y-3">
                    {profileBadgeTimeline.length > 0 ? (
                      profileBadgeTimeline.map((entry) => (
                        <BadgeTimelineItem
                          key={entry.id}
                          entry={entry}
                          onOpen={() => {
                            const badge = badgeSystem.badges.find((b) => b.id === entry.badgeId);
                            if (badge) setSelectedBadge(badge);
                          }}
                        />
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm text-(--cf-text-3)">
                        Earned milestones will appear here as your reading history grows.
                      </p>
                    )}
                  </div>
                )}

                {/* Achievement stats row */}
                <div className="flex flex-wrap gap-6 rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) px-5 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Earned</p>
                    <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{badgeSystem.earnedCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Locked</p>
                    <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{badgeSystem.lockedBadges.length}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Total</p>
                    <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{badgeSystem.earnedCount} of {badgeSystem.visibleCount}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </FadeIn>

        {/* ═══ SECTION 6: Upgrade / Pro Status ═══ */}
        <FadeIn delay={0.25}>
          <div id="plan">
            {isActivePro ? (
              <ProStatusCard
                renewalDate={
                  billingState.payload?.entitlement.currentPeriodEnd
                    ? new Date(billingState.payload.entitlement.currentPeriodEnd).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                    : "Monthly plan · renews monthly"
                }
                booksAccessedCount={billingState.payload?.entitlement.unlockedBooksCount ?? 0}
                proSinceLabel={profile.createdAt ? `Pro since ${new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : "Pro member"}
                onManage={() => handleBillingAction("portal")}
              />
            ) : !isPro ? (
              <UpgradeCard
                booksUsed={billingState.payload?.entitlement.unlockedBooksCount ?? 0}
                booksTotal={(billingState.payload?.entitlement.unlockedBooksCount ?? 0) + (billingState.payload?.entitlement.remainingFreeStarts ?? 2)}
                personalizedMessage={upgradeMessage}
                onUpgrade={() => handleBillingAction("upgrade")}
              />
            ) : null}
          </div>
        </FadeIn>

        {/* ═══ SECTION 7: Notes & Reflection ═══ */}
        <FadeIn delay={0.3}>
          <div id="reflection">
            <SectionCard
              eyebrow="Reflection"
              title="Notes and saved insights"
              description="Your personal knowledge base grows with every chapter."
              icon={<NotebookPen className="h-5 w-5" />}
              right={
                localInsights.notes.length > 0 ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      currentSnapshot
                        ? router.push(`/book/library/${encodeURIComponent(currentSnapshot.book.id)}/chapter/${encodeURIComponent(currentReadingDetails?.chapterId ?? currentSnapshot.resumeChapterId)}`)
                        : showToast("Open a chapter with notes to continue.", "info")
                    }
                  >
                    Go to notes
                  </Button>
                ) : null
              }
            >
              {localInsights.notes.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatCard icon={<NotebookPen className="h-4 w-4" />} label="Notes saved" value={localInsights.notes.length} helper="Chapters with written notes" />
                    <StatCard icon={<Medal className="h-4 w-4" />} label="Pinned takeaways" value={Math.min(localInsights.notes.length, 3)} helper="Top recent insights" />
                  </div>

                  {/* G2: Pinned takeaways as quote cards */}
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-soft)">Pinned ideas</p>
                    {localInsights.notes.slice(0, 3).map((note) => (
                      <PinnedTakeawayCard key={`${note.id}:pinned`} text={firstLine(note.body)} source={note.title} />
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {localInsights.notes.slice(0, 4).map((note) => (
                      <NotePreviewCard
                        key={note.id}
                        title={note.title}
                        body={note.body}
                        meta={note.meta}
                        actionLabel="Open chapter"
                        onAction={() => router.push(`/book/library/${encodeURIComponent(note.bookId)}/chapter/${encodeURIComponent(note.chapterId)}`)}
                      />
                    ))}
                  </div>
                </div>
              ) : currentSnapshot || statsSummary.totalChaptersCompleted > 0 ? (
                // G1: Inline takeaway prompt (has chapters but no notes)
                <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-6">
                  <p className="text-sm text-(--cf-text-2)">
                    {statsSummary.totalChaptersCompleted > 0
                      ? <>You&apos;ve explored {statsSummary.totalChaptersCompleted} chapter{statsSummary.totalChaptersCompleted !== 1 ? "s" : ""} but haven&apos;t saved any takeaways yet.</>
                      : <>You&apos;re reading but haven&apos;t saved any takeaways yet.</>}
                  </p>
                  <p className="mt-2 text-base font-medium text-(--cf-text-1)">
                    What&apos;s one thing from {currentSnapshot?.book.title ?? "your reading"} that stuck with you?
                  </p>
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a quick takeaway..."
                      value={takeawayText}
                      onChange={(e) => setTakeawayText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && takeawayText.trim() && handleSaveTakeaway()}
                      className="flex-1 rounded-xl border border-(--cf-border) bg-(--cf-surface) px-4 py-2.5 text-sm text-(--cf-text-1) placeholder:text-(--cf-text-soft) outline-none focus:border-(--cf-accent-border)"
                    />
                    <Button
                      variant="primary"
                      onClick={handleSaveTakeaway}
                      disabled={!takeawayText.trim()}
                    >
                      Save takeaway
                    </Button>
                  </div>
                  {currentSnapshot ? (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/book/library/${encodeURIComponent(currentSnapshot.book.id)}/chapter/${encodeURIComponent(currentReadingDetails?.chapterId ?? currentSnapshot.resumeChapterId)}`)
                      }
                      className="mt-3 text-sm text-(--cf-accent) hover:text-(--cf-accent-strong) transition-colors"
                    >
                      Open chapter &rarr;
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-8 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface) text-2xl">📝</div>
                  <h3 className="text-base font-semibold text-(--cf-text-1)">Your reading journal starts here</h3>
                  <p className="mt-2 text-sm text-(--cf-text-3)">
                    Save highlights and takeaways as you read — they&apos;ll build into a personal knowledge base that grows with you.
                  </p>
                  <Button variant="primary" onClick={() => router.push("/book/library")} className="mt-4">Start your first book &rarr;</Button>
                </div>
              )}
            </SectionCard>
          </div>
        </FadeIn>

        {/* ═══ SECTION 8: Reading History ═══ */}
        <FadeIn delay={0.35}>
          <div id="history">
            <SectionCard
              eyebrow="History"
              title="Reading history"
              description="Look back at what you've finished and how far you've come."
              icon={<GraduationCap className="h-5 w-5" />}
            >
              <div className="grid gap-6 lg:grid-cols-2">
                {/* G3: Recently finished books with improved empty state */}
                <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                  <h3 className="text-sm font-semibold text-(--cf-text-1)">Recently finished books</h3>
                  <div className="mt-4 space-y-3">
                    {recentFinishedBooks.length > 0 ? (
                      recentFinishedBooks.map((snapshot) => (
                        <div key={snapshot.book.id} className="flex items-center justify-between gap-3 rounded-2xl border border-(--cf-border) bg-(--cf-surface) px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-(--cf-text-1)">{snapshot.book.title}</p>
                            <p className="mt-1 text-sm text-(--cf-text-soft)">
                              Finished &bull; {new Date(snapshot.lastActivityAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                          </div>
                          <span className="rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-(--cf-success-text)">Completed</span>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center">
                        {/* 3.7: Ghost card placeholder with book outline */}
                        <div className="group mx-auto mb-3 rounded-2xl border border-dashed border-(--cf-border) bg-(--cf-surface)/30 px-4 py-5 transition hover:bg-(--cf-surface)/50">
                          <svg width="40" height="48" viewBox="0 0 40 48" fill="none" className="mx-auto mb-2 text-(--cf-text-soft)/30">
                            <rect x="4" y="4" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <line x1="14" y1="4" x2="14" y2="44" stroke="currentColor" strokeWidth="1" />
                          </svg>
                          <p className="text-sm text-(--cf-text-soft)">Your first completed book</p>
                        </div>
                        <p className="text-sm text-(--cf-text-3)">
                          {currentSnapshot && currentReadingDetails
                            ? <>You&apos;re reading {currentSnapshot.book.title} right now. Finish all chapters to add it here.{" "}
                                <button type="button" onClick={() => router.push(`/book/library/${encodeURIComponent(currentSnapshot.book.id)}/chapter/${encodeURIComponent(currentReadingDetails.chapterId)}`)} className="text-(--cf-accent) hover:underline">Continue reading &rarr;</button>
                              </>
                            : "Pick your first book and read it chapter by chapter."}
                        </p>
                        {!currentSnapshot ? (
                          <Button variant="secondary" onClick={() => router.push("/book/library")} className="mt-3">Browse Library &rarr;</Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* G4 + 2.3: Recent quiz performance with bar chart */}
                <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                  <h3 className="text-sm font-semibold text-(--cf-text-1)">Recent quiz performance</h3>

                  {quizTrend && localInsights.recentQuizEntries.length >= 2 ? (
                    <div className="mt-4">
                      <QuizBarChart
                        scores={localInsights.recentQuizEntries.slice(0, 10).reverse().map((e) => e.score)}
                        avg={quizTrend.avg}
                        best={quizTrend.best}
                        last={localInsights.recentQuizEntries[0]?.score ?? 0}
                        trend={quizTrend.direction}
                      />
                    </div>
                  ) : localInsights.recentQuizEntries.length === 1 ? (
                    <div className="mt-4">
                      <QuizBarChart
                        scores={[localInsights.recentQuizEntries[0].score]}
                        avg={localInsights.recentQuizEntries[0].score}
                        best={localInsights.recentQuizEntries[0].score}
                        last={localInsights.recentQuizEntries[0].score}
                        trend="steady"
                      />
                      <p className="mt-2 text-xs text-(--cf-text-soft)">Complete more quizzes to see your trend</p>
                    </div>
                  ) : statsSummary.quizQuestionsAnswered > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-(--cf-text-1)">Quiz activity</p>
                      <p className="text-3xl font-bold text-(--cf-text-1)">{statsSummary.quizQuestionsAnswered}</p>
                      <p className="text-xs text-(--cf-text-3)">questions answered so far</p>
                      <p className="text-xs text-(--cf-text-soft)">
                        Complete a full chapter quiz to see detailed score trends.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 py-4 text-center text-sm text-(--cf-text-3)">
                      Complete your first quiz to start tracking your retention scores here.
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>
        </FadeIn>
      </motion.section>

      {/* ─── Modals ─── */}
      <EditProfileModal
        open={editOpen}
        profile={profile}
        email={viewerIdentity.email ?? userEmail}
        onClose={() => setEditOpen(false)}
        onSave={saveProfile}
      />

      <InfoModal
        open={Boolean(selectedBadge)}
        title={selectedBadge?.name || "Achievement"}
        onClose={() => setSelectedBadge(null)}
      >
        {selectedBadge ? (
          <BadgeDetailPanel
            badge={selectedBadge}
            nextTier={badgeSystem.badges.find((b) => b.id === selectedBadge.nextTierId) ?? null}
          />
        ) : null}
      </InfoModal>

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />
    </main>
  );
}
