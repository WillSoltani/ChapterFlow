"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  BookMarked,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  Flame,
  Globe,
  GraduationCap,
  KeyRound,
  LayoutGrid,
  LineChart,
  Medal,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserCircle2,
  Users,
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
import { BOOK_STORAGE_EVENT } from "@/app/book/hooks/bookStorageEvents";
import { useBadgeSystem } from "@/app/book/hooks/useBadgeSystem";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useBookEntitlements } from "@/app/book/hooks/useBookEntitlements";
import { useBookProfile } from "@/app/book/hooks/useBookProfile";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useToast } from "@/app/book/hooks/useToast";
import {
  BadgeDetailPanel,
  BadgeTimelineItem,
  FeaturedBadgeCard,
  ProgressToNextBadgeCard,
} from "@/app/book/badges/components/BadgeSystemCards";
import { EditProfileModal } from "@/app/book/profile/components/EditProfileModal";
import {
  ActiveBookCard,
  NotePreviewCard,
  PrivacyRow,
  ProfileHeroCard,
  SectionCard,
  StatCard,
  SubscriptionSummaryCard,
  TimelineRow,
} from "@/app/book/profile/components/ProfilePrimitives";

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
};

type QuizEntry = {
  id: string;
  label: string;
  score: number;
  sortAt: string;
};

function formatMinutes(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
  }
  return `${minutes} min`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatJoinDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function visibilityLabel(value: string) {
  if (value === "public") return "Public";
  if (value === "friends") return "Friends only";
  return "Private";
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
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export function BookProfileClient({ userEmail, appVersion }: BookProfileClientProps) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);
  const { toast, showToast } = useToast();

  const { state: onboarding, hydrated: onboardingHydrated, setName, setPronoun } = useOnboardingState();
  const { analytics, hydrated: analyticsHydrated } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );
  const { state: profile, hydrated: profileHydrated, patch: patchProfile } = useBookProfile({
    displayName: onboarding.name || "Reader",
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

  useEffect(() => {
    function onStorageChange() {
      setRevision((value) => value + 1);
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

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  const localInsights = useMemo(() => {
    if (!analyticsHydrated) {
      return {
        quizQuestionsAnswered: 0,
        notes: [] as NoteEntry[],
        recentQuizEntries: [] as QuizEntry[],
        activityLog: [] as ActivityEntry[],
        depthCounts: { simple: 0, standard: 0, deeper: 0 },
        exampleCounts: { personal: 0, school: 0, work: 0, all: 0 },
        recentOpenedChapters: [] as ActivityEntry[],
      };
    }

    const notes: NoteEntry[] = [];
    const recentQuizEntries: QuizEntry[] = [];
    const activityLog: ActivityEntry[] = [];
    const recentOpenedChapters: ActivityEntry[] = [];
    const depthCounts = { simple: 0, standard: 0, deeper: 0 };
    const exampleCounts = { personal: 0, school: 0, work: 0, all: 0 };
    let quizQuestionsAnswered = 0;
    void revision;

    for (const snapshot of analytics?.bookSnapshots ?? []) {
      const progress = parseStoredBookProgress(
        window.localStorage.getItem(getBookProgressStorageKey(snapshot.book.id))
      );
      const chapters = getBookChaptersBundle(snapshot.book.id).chapters;
      const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));

      if (progress?.lastReadChapterId) {
        const chapter = chapterMap.get(progress.lastReadChapterId);
        recentOpenedChapters.push({
          id: `${snapshot.book.id}:${progress.lastReadChapterId}:opened`,
          title: chapter ? `${snapshot.book.title} • ${chapter.code}` : `${snapshot.book.title} • Recent chapter`,
          detail: chapter ? chapter.title : "Recent chapter activity",
          meta: new Date(progress.lastOpenedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          sortAt: progress.lastOpenedAt,
        });
      }

      Object.entries(progress?.chapterCompletedAt ?? {}).forEach(([chapterId, completedAt]) => {
        const chapter = chapterMap.get(chapterId);
        if (!chapter) return;
        activityLog.push({
          id: `${snapshot.book.id}:${chapterId}:completed`,
          title: `${snapshot.book.title} • ${chapter.code}`,
          detail: `Completed ${chapter.title}`,
          meta: new Date(completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          sortAt: completedAt,
        });
      });

      for (const chapter of chapters) {
        const reader = parseStoredReaderState(
          window.localStorage.getItem(
            getChapterReaderStorageKey(snapshot.book.id, chapter.id)
          )
        );
        if (!reader) continue;
        depthCounts[reader.readingDepth] += 1;
        exampleCounts[reader.exampleFilter] += 1;
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

    notes.sort((left, right) => right.sortAt.localeCompare(left.sortAt));
    recentQuizEntries.sort((left, right) => right.sortAt.localeCompare(left.sortAt));
    activityLog.sort((left, right) => right.sortAt.localeCompare(left.sortAt));
    recentOpenedChapters.sort((left, right) => right.sortAt.localeCompare(left.sortAt));

    return {
      quizQuestionsAnswered,
      notes,
      recentQuizEntries,
      activityLog,
      depthCounts,
      exampleCounts,
      recentOpenedChapters,
    };
  }, [analytics, analyticsHydrated, revision]);

  const profileBadgeShowcase = useMemo(
    () => badgeSystem.featuredBadges.slice(0, 6),
    [badgeSystem.featuredBadges]
  );

  const profileNextMilestone = useMemo(
    () => badgeSystem.nextMilestones[0] ?? null,
    [badgeSystem.nextMilestones]
  );

  const profileBadgeTimeline = useMemo(
    () => badgeSystem.badgeTimeline.slice(0, 4),
    [badgeSystem.badgeTimeline]
  );

  const statsSummary = useMemo(() => {
    const booksInProgress = analytics?.bookSnapshots.filter((item) => item.status === "in_progress").length ?? 0;
    const totalReadingMinutes = analytics?.heatmapCells.reduce((sum, cell) => sum + cell.minutes, 0) ?? 0;
    return {
      currentStreak: analytics?.streakDays ?? 0,
      longestStreak: analytics?.longestStreak ?? 0,
      booksCompleted: analytics?.booksCompleted ?? 0,
      booksInProgress,
      totalChaptersCompleted: analytics?.totalCompletedChapters ?? 0,
      quizQuestionsAnswered: localInsights.quizQuestionsAnswered,
      averageQuizScore: analytics?.avgQuizScore ?? 0,
      totalReadingMinutes,
      currentDailyGoal: onboarding.dailyGoalMinutes,
      preferredMode: mapLearningStyle(onboarding.learningStyle),
    };
  }, [analytics, localInsights.quizQuestionsAnswered, onboarding.dailyGoalMinutes, onboarding.learningStyle]);

  const currentSnapshot = useMemo(() => {
    const sorted = [...(analytics?.bookSnapshots ?? [])].sort((left, right) => {
      const leftRank = left.status === "in_progress" ? 0 : left.status === "not_started" ? 1 : 2;
      const rightRank = right.status === "in_progress" ? 0 : right.status === "not_started" ? 1 : 2;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return right.lastActivityAt.localeCompare(left.lastActivityAt);
    });
    return sorted[0] ?? null;
  }, [analytics]);

  const activeBooks = useMemo(
    () =>
      [...(analytics?.bookSnapshots ?? [])]
        .filter((snapshot) => snapshot.status === "in_progress")
        .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))
        .slice(0, 4),
    [analytics]
  );

  const recentFinishedBooks = useMemo(
    () =>
      [...(analytics?.bookSnapshots ?? [])]
        .filter((snapshot) => snapshot.status === "completed")
        .sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt))
        .slice(0, 4),
    [analytics]
  );

  const currentReadingDetails = useMemo(() => {
    if (!currentSnapshot) return null;
    void revision;
    const progress = parseStoredBookProgress(
      window.localStorage.getItem(getBookProgressStorageKey(currentSnapshot.book.id))
    );
    const chapters = getBookChaptersBundle(currentSnapshot.book.id).chapters;
    const currentChapterId = progress?.currentChapterId || currentSnapshot.resumeChapterId || chapters[0]?.id || "";
    const chapter = chapters.find((item) => item.id === currentChapterId) ?? chapters[0];
    const completedSet = new Set(progress?.completedChapterIds ?? []);
    const remainingMinutes = chapters
      .filter((item) => !completedSet.has(item.id))
      .reduce((sum, item) => sum + item.minutes, 0);
    const reader = chapter
      ? parseStoredReaderState(
          window.localStorage.getItem(
            getChapterReaderStorageKey(currentSnapshot.book.id, chapter.id)
          )
        )
      : null;
    return {
      chapterLabel: chapter ? `${chapter.code} ${chapter.title}` : "Ready to start",
      mode: reader ? depthLabel(reader.readingDepth) : mapLearningStyle(onboarding.learningStyle),
      eta: formatMinutes(Math.max(remainingMinutes, 10)),
      chapterId: chapter?.id ?? currentSnapshot.resumeChapterId,
    };
  }, [currentSnapshot, onboarding.learningStyle, revision]);

  const preferredExampleCategory = useMemo(() => {
    const counts = [
      { label: "Personal", value: localInsights.exampleCounts.personal },
      { label: "School", value: localInsights.exampleCounts.school },
      { label: "Work", value: localInsights.exampleCounts.work },
    ].sort((left, right) => right.value - left.value);
    return counts[0]?.value ? counts[0].label : "All contexts";
  }, [localInsights.exampleCounts.personal, localInsights.exampleCounts.school, localInsights.exampleCounts.work]);

  const completionByMode = useMemo(() => {
    const total = localInsights.depthCounts.simple + localInsights.depthCounts.standard + localInsights.depthCounts.deeper;
    if (!total) {
      return [
        { label: "Simple", value: 0 },
        { label: "Standard", value: 0 },
        { label: "Deeper", value: 0 },
      ];
    }
    return [
      { label: "Simple", value: Math.round((localInsights.depthCounts.simple / total) * 100) },
      { label: "Standard", value: Math.round((localInsights.depthCounts.standard / total) * 100) },
      { label: "Deeper", value: Math.round((localInsights.depthCounts.deeper / total) * 100) },
    ];
  }, [localInsights.depthCounts]);

  const revisitSuggestions = useMemo(
    () =>
      [...(analytics?.bookSnapshots ?? [])]
        .filter((snapshot) => snapshot.avgScore > 0 && snapshot.avgScore < 80)
        .sort((left, right) => left.avgScore - right.avgScore)
        .slice(0, 3),
    [analytics]
  );

  const monthlySummary = useMemo(() => {
    const lastThirty = analytics?.heatmapCells.slice(-30) ?? [];
    return {
      minutes: lastThirty.reduce((sum, cell) => sum + cell.minutes, 0),
      chapters: lastThirty.reduce((sum, cell) => sum + cell.chapters, 0),
      activeDays: lastThirty.filter((cell) => cell.minutes > 0).length,
    };
  }, [analytics]);

  const saveProfile = async (values: Partial<typeof profile>) => {
    patchProfile(values);
    if (typeof values.displayName === "string") setName(values.displayName);
    if (typeof values.pronouns === "string") setPronoun(values.pronouns as typeof onboarding.pronoun);
    setEditOpen(false);
    showToast("Profile updated", "success");
  };

  const handleBillingAction = async (kind: "upgrade" | "portal") => {
    const message = await launchBillingAction(kind);
    if (message) showToast(message, "error");
  };

  if (!onboardingHydrated || !analyticsHydrated || !badgeSystem.hydrated || !profileHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cf-text-2)">
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={profile.displayName || onboarding.name || "Reader"}
        activeTab="profile"
        searchQuery=""
        onSearchChange={() => undefined}
        searchInputRef={{ current: null }}
        showSearch={false}
      />

      <section className="mx-auto w-full max-w-[1500px] space-y-6 px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pt-8">
        <ProfileHeroCard
          avatar={profile.avatarDataUrl}
          initials={initialsFromName(profile.displayName || onboarding.name || "Reader")}
          accent={profile.avatarAccent}
          name={profile.displayName || onboarding.name || "Reader"}
          username={profile.username}
          tagline={profile.tagline}
          plan={billingState.payload?.entitlement.plan === "PRO" ? "Pro" : "Free"}
          streakLabel={`${statsSummary.currentStreak} day streak`}
          joinDate={formatJoinDate(profile.createdAt)}
          readingGoal={formatMinutes(onboarding.dailyGoalMinutes)}
          onEdit={() => setEditOpen(true)}
          onShare={() => showToast("Shareable profile preview copied", "success")}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <SectionCard
              eyebrow="Overview"
              title="Quick stats"
              description="A compact view of how you read, how you retain, and how consistent the habit has become."
              icon={<Sparkles className="h-5 w-5" />}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard icon={<Flame className="h-5 w-5" />} label="Current streak" value={statsSummary.currentStreak} helper="Days in a row" />
                <StatCard icon={<Trophy className="h-5 w-5" />} label="Longest streak" value={statsSummary.longestStreak} helper="Best run so far" />
                <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Books completed" value={statsSummary.booksCompleted} helper="Finished end to end" />
                <StatCard icon={<LayoutGrid className="h-5 w-5" />} label="Books in progress" value={statsSummary.booksInProgress} helper="Active paths right now" />
                <StatCard icon={<BookMarked className="h-5 w-5" />} label="Chapters completed" value={statsSummary.totalChaptersCompleted} helper="Across your library" />
                <StatCard icon={<Brain className="h-5 w-5" />} label="Quiz questions answered" value={statsSummary.quizQuestionsAnswered} helper="Tracked from chapter attempts" />
                <StatCard icon={<Target className="h-5 w-5" />} label="Average quiz score" value={formatPercent(statsSummary.averageQuizScore)} helper="Retention trend" />
                <StatCard icon={<Clock3 className="h-5 w-5" />} label="Total reading time" value={formatMinutes(statsSummary.totalReadingMinutes)} helper="Logged chapter activity" />
                <StatCard icon={<Calendar className="h-5 w-5" />} label="Daily goal" value={formatMinutes(statsSummary.currentDailyGoal)} helper="Current target" />
                <StatCard icon={<Star className="h-5 w-5" />} label="Preferred mode" value={statsSummary.preferredMode} helper="Default reading style" />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Momentum"
              title="Current reading status"
              description="Jump back into the exact place that deserves your next session."
              icon={<BookOpen className="h-5 w-5" />}
              right={
                currentSnapshot && currentReadingDetails ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      router.push(
                        `/book/library/${encodeURIComponent(currentSnapshot.book.id)}/chapter/${encodeURIComponent(currentReadingDetails.chapterId)}`
                      )
                    }
                  >
                    Continue reading
                  </Button>
                ) : null
              }
            >
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4 rounded-[30px] border border-(--cf-accent-border) bg-(--cf-accent-soft) p-5 shadow-sm">
                  {currentSnapshot && currentReadingDetails ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-(--cf-accent-border) bg-(--cf-surface) px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-(--cf-info-text)">Currently reading</span>
                        <span className="inline-flex rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-(--cf-text-2)">{currentReadingDetails.mode}</span>
                      </div>
                      <h3 className="mt-4 text-3xl font-semibold tracking-tight text-(--cf-text-1)">{currentSnapshot.book.title}</h3>
                      <p className="mt-2 text-sm text-(--cf-text-2)">{currentReadingDetails.chapterLabel}</p>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-(--cf-border)">
                        <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${currentSnapshot.progressPercent}%` }} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <StatCard icon={<Clock3 className="h-4 w-4" />} label="Time remaining" value={currentReadingDetails.eta} helper="Approximate" />
                        <StatCard icon={<LineChart className="h-4 w-4" />} label="Progress" value={formatPercent(currentSnapshot.progressPercent)} helper="Current book" />
                        <StatCard icon={<Target className="h-4 w-4" />} label="Next session" value={formatMinutes(Math.max(10, Math.min(onboarding.dailyGoalMinutes, 35)))} helper="Suggested block" />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-5 text-sm text-(--cf-text-2)">
                      Start a book to turn this section into your active reading hub.
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {activeBooks.length ? (
                    activeBooks.map((snapshot) => {
                      const progress = parseStoredBookProgress(
                        window.localStorage.getItem(
                          getBookProgressStorageKey(snapshot.book.id)
                        )
                      );
                      const chapter = getBookChaptersBundle(snapshot.book.id).chapters.find((item) => item.id === (progress?.currentChapterId || snapshot.resumeChapterId));
                      const remainingMinutes = getBookChaptersBundle(snapshot.book.id).chapters
                        .filter((item) => !(progress?.completedChapterIds ?? []).includes(item.id))
                        .reduce((sum, item) => sum + item.minutes, 0);
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
                    })
                  ) : (
                    <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5 text-sm text-(--cf-text-2)">
                      Active books will appear here once you start moving through chapters.
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Milestones"
              title="Badges, achievements, and milestones"
              description="Progress should feel tangible and refined. Earned badges stay celebratory without becoming noisy."
              icon={<Award className="h-5 w-5" />}
              right={<Button variant="secondary" onClick={() => router.push("/book/badges")}>View all achievements</Button>}
            >
              <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {profileBadgeShowcase.map((badge, index) => (
                      <FeaturedBadgeCard
                        key={badge.id}
                        badge={badge}
                        subtitle={index < 2 ? "Recent highlight" : "Prestige highlight"}
                        onOpen={() => setSelectedBadge(badge)}
                      />
                    ))}
                  </div>
                  <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-3)">Recent achievement feed</p>
                        <h3 className="mt-2 text-lg font-semibold text-(--cf-text-1)">Timeline</h3>
                      </div>
                      <span className="rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">
                        {badgeSystem.earnedCount} earned
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {profileBadgeTimeline.length ? (
                        profileBadgeTimeline.map((entry) => (
                          <BadgeTimelineItem
                            key={entry.id}
                            entry={entry}
                            onOpen={() => {
                              const badge = badgeSystem.badges.find((item) => item.id === entry.badgeId);
                              if (badge) setSelectedBadge(badge);
                            }}
                          />
                        ))
                      ) : (
                        <div className="rounded-[22px] border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-4 text-sm leading-6 text-(--cf-text-3)">
                          Earned milestones will stack here as your reading history grows.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <ProgressToNextBadgeCard
                    milestone={profileNextMilestone}
                    onOpen={profileNextMilestone ? () => setSelectedBadge(profileNextMilestone.badge) : undefined}
                    secondary={
                      <div className="grid gap-3">
                        {[
                          { label: "First book completed", done: statsSummary.booksCompleted >= 1 },
                          { label: "Seven day streak", done: statsSummary.currentStreak >= 7 },
                          { label: "Perfect quiz score", done: (analytics?.maxQuizScore ?? 0) >= 100 },
                          { label: "First ten chapters completed", done: statsSummary.totalChaptersCompleted >= 10 },
                        ].map((milestone) => (
                          <div key={milestone.label} className="flex items-center justify-between rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 text-sm">
                            <span className="text-(--cf-text-2)">{milestone.label}</span>
                            <span className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${milestone.done ? "bg-(--cf-success-soft) text-(--cf-success-text)" : "bg-(--cf-surface-muted) text-(--cf-text-3)"}`}>
                              {milestone.done ? "Done" : "In progress"}
                            </span>
                          </div>
                        ))}
                      </div>
                    }
                  />
                  <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-(--cf-text-3)">System view</p>
                    <h3 className="mt-2 text-lg font-semibold text-(--cf-text-1)">Why this layer matters</h3>
                    <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">
                      Badges are tied to consistency, depth, and mastery. The profile view surfaces progress without turning your learning history into noise.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <StatCard icon={<Trophy className="h-4 w-4" />} label="Featured" value={profileBadgeShowcase.length} helper="Visible profile highlights" />
                      <StatCard icon={<Medal className="h-4 w-4" />} label="Locked" value={badgeSystem.lockedBadges.length} helper="Progressive reveal still ahead" />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="History"
              title="Reading history"
              description="Look back at what you finished, what you opened most recently, and how the recent month has moved."
              icon={<Calendar className="h-5 w-5" />}
            >
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-(--cf-text-1)">Monthly summary</h3>
                      <span className="rounded-full border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Last 30 days</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <StatCard icon={<Clock3 className="h-4 w-4" />} label="Reading time" value={formatMinutes(monthlySummary.minutes)} />
                      <StatCard icon={<BookMarked className="h-4 w-4" />} label="Chapters" value={monthlySummary.chapters} />
                      <StatCard icon={<Flame className="h-4 w-4" />} label="Active days" value={monthlySummary.activeDays} />
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                    <h3 className="text-lg font-semibold text-(--cf-text-1)">Recently finished books</h3>
                    <div className="mt-4 space-y-3">
                      {recentFinishedBooks.length ? recentFinishedBooks.map((snapshot) => (
                        <div key={snapshot.book.id} className="flex items-center justify-between gap-3 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-(--cf-text-1)">{snapshot.book.title}</p>
                            <p className="mt-1 text-sm text-(--cf-text-soft)">Finished • {new Date(snapshot.lastActivityAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                          </div>
                          <span className="rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-(--cf-success-text)">Completed</span>
                        </div>
                      )) : <p className="text-sm text-(--cf-text-soft)">Finished books will appear here as you complete them.</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-(--cf-text-1)">Activity timeline</h3>
                    <span className="text-sm text-(--cf-text-soft)">Last active {analytics?.lastActiveLabel ?? "No activity yet"}</span>
                  </div>
                  <div className="space-y-3">
                    {[...localInsights.activityLog, ...localInsights.recentOpenedChapters]
                      .sort((left, right) => right.sortAt.localeCompare(left.sortAt))
                      .slice(0, 8)
                      .map((entry) => (
                        <TimelineRow key={entry.id} title={entry.title} detail={entry.detail} meta={entry.meta} />
                      ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Performance"
              title="Learning performance"
              description="This is a reading product built around retention and understanding, not only completion."
              icon={<GraduationCap className="h-5 w-5" />}
            >
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <StatCard icon={<Target className="h-4 w-4" />} label="Average quiz score" value={formatPercent(analytics?.avgQuizScore ?? 0)} helper="Across completed chapter quizzes" />
                    <StatCard icon={<Trophy className="h-4 w-4" />} label="Best score streak" value={analytics?.maxQuizScore === 100 ? "Perfect pass unlocked" : `${analytics?.maxQuizScore ?? 0}% best`} helper="Highest recorded score" />
                    <StatCard icon={<LineChart className="h-4 w-4" />} label="Preferred examples" value={preferredExampleCategory} helper="Most used context" />
                    <StatCard icon={<Star className="h-4 w-4" />} label="Current mode bias" value={completionByMode.sort((a,b)=>b.value-a.value)[0]?.label ?? "Standard"} helper="Most used depth" />
                  </div>

                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                    <h3 className="text-lg font-semibold text-(--cf-text-1)">Recent quiz performance</h3>
                    <div className="mt-4 space-y-3">
                      {localInsights.recentQuizEntries.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="grid grid-cols-[1fr_90px] items-center gap-3">
                          <div>
                            <p className="text-sm font-medium text-(--cf-text-1)">{entry.label}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">{new Date(entry.sortAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-(--cf-border)">
                              <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${entry.score}%` }} />
                            </div>
                            <span className="w-10 text-right text-sm font-medium text-(--cf-text-1)">{entry.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                    <h3 className="text-lg font-semibold text-(--cf-text-1)">Completion by mode</h3>
                    <div className="mt-4 space-y-3">
                      {completionByMode.map((entry) => (
                        <div key={entry.label}>
                          <div className="flex items-center justify-between gap-3 text-sm text-(--cf-text-2)">
                            <span>{entry.label}</span>
                            <span>{entry.value}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--cf-border)">
                            <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${entry.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                    <h3 className="text-lg font-semibold text-(--cf-text-1)">Revisit suggestions</h3>
                    <div className="mt-4 space-y-3">
                      {revisitSuggestions.length ? revisitSuggestions.map((snapshot) => (
                        <div key={snapshot.book.id} className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                          <p className="text-sm font-medium text-(--cf-text-1)">{snapshot.book.title}</p>
                          <p className="mt-1 text-sm text-(--cf-text-soft)">Average score {snapshot.avgScore}% • revisit examples and takeaways</p>
                        </div>
                      )) : <p className="text-sm text-(--cf-text-soft)">No weak areas stand out right now. Keep your current pace.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Reflection"
              title="Notes and saved insights"
              description="Your profile should also feel like a record of what you noticed and what mattered."
              icon={<NotebookPen className="h-5 w-5" />}
              right={<Button variant="secondary" onClick={() => currentSnapshot ? router.push(`/book/library/${encodeURIComponent(currentSnapshot.book.id)}/chapter/${encodeURIComponent(currentReadingDetails?.chapterId ?? currentSnapshot.resumeChapterId)}`) : showToast("Open a chapter with notes to continue.", "info")}>Go to notes</Button>}
            >
              <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-4 rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatCard icon={<NotebookPen className="h-4 w-4" />} label="Notes saved" value={localInsights.notes.length} helper="Chapters with written notes" />
                    <StatCard icon={<Medal className="h-4 w-4" />} label="Pinned takeaways" value={Math.min(localInsights.notes.length, 3)} helper="Top recent note lines" />
                  </div>
                  <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4">
                    <p className="text-sm font-medium text-(--cf-text-1)">Pinned ideas</p>
                    <div className="mt-3 space-y-2">
                      {localInsights.notes.slice(0, 3).map((note) => (
                        <div key={`${note.id}:pinned`} className="rounded-xl border border-(--cf-border) bg-(--cf-surface) px-3 py-2 text-sm text-(--cf-text-2)">
                          {firstLine(note.body)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
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
                  {!localInsights.notes.length ? (
                    <div className="rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5 text-sm text-(--cf-text-2) md:col-span-2">
                      Notes saved from chapter summaries and drawers will show up here once you start capturing ideas.
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-6">
            <SectionCard
              eyebrow="Identity"
              title="Personal information"
              description="Visible account details stay clear without taking over the whole page."
              icon={<UserCircle2 className="h-5 w-5" />}
              right={<Button variant="secondary" onClick={() => setEditOpen(true)}>Edit profile</Button>}
            >
              <div className="space-y-3">
                {[
                  { label: "Display name", value: profile.displayName },
                  { label: "Username", value: `@${profile.username}` },
                  { label: "Email", value: userEmail ?? "Signed in" },
                  { label: "Timezone", value: profile.timezone },
                  { label: "Country or region", value: profile.country || "Not set" },
                  { label: "Preferred pronouns", value: profile.pronouns || "Not set" },
                  { label: "Account created", value: formatJoinDate(profile.createdAt) },
                  { label: "Login method", value: "Secure account session" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">{item.label}</p>
                    <p className="mt-2 text-sm text-(--cf-text-1)">{item.value}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Bio</p>
                  <p className="mt-2 text-sm leading-6 text-(--cf-text-2)">{profile.bio}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Privacy"
              title="Public profile and privacy preview"
              description="Control what a future public profile could reveal before social features exist."
              icon={<Globe className="h-5 w-5" />}
              right={<Button variant="secondary" onClick={() => showToast("Public profile preview is reserved for a later social release.", "info")}>Preview public profile</Button>}
            >
              <div className="space-y-3">
                <PrivacyRow
                  label="Profile visibility"
                  description="Choose whether your profile stays private, limited to friends, or available publicly later."
                  control={
                    <select
                      value={profile.profileVisibility}
                      onChange={(event) => patchProfile({ profileVisibility: event.target.value as typeof profile.profileVisibility })}
                      className="cf-input rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="private">Private</option>
                      <option value="friends">Friends only</option>
                      <option value="public">Public</option>
                    </select>
                  }
                />
                <PrivacyRow
                  label="Show reading stats publicly"
                  description="Allow streaks, reading totals, and progress metrics to appear on a public profile later."
                  control={<Button variant="secondary" size="sm" onClick={() => patchProfile({ showReadingStatsPublic: !profile.showReadingStatsPublic })}>{profile.showReadingStatsPublic ? "On" : "Off"}</Button>}
                />
                <PrivacyRow
                  label="Show badges publicly"
                  description="Allow earned badges and milestones to appear in a future shareable profile."
                  control={<Button variant="secondary" size="sm" onClick={() => patchProfile({ showBadgesPublic: !profile.showBadgesPublic })}>{profile.showBadgesPublic ? "On" : "Off"}</Button>}
                />
                <PrivacyRow
                  label="Show reading history publicly"
                  description="Allow completed books and recent activity to appear in a future public profile."
                  control={<Button variant="secondary" size="sm" onClick={() => patchProfile({ showReadingHistoryPublic: !profile.showReadingHistoryPublic })}>{profile.showReadingHistoryPublic ? "On" : "Off"}</Button>}
                />
                <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Profile URL preview</p>
                  <p className="mt-2 text-sm text-(--cf-text-1)">book-accelerator.app/u/{profile.username}</p>
                  <p className="mt-2 text-sm text-(--cf-text-soft)">Current visibility: {visibilityLabel(profile.profileVisibility)}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Plan"
              title="Subscription and plan preview"
              description="A premium subscription center that already feels real, even before full billing detail wiring is complete."
              icon={<CreditCard className="h-5 w-5" />}
            >
              <SubscriptionSummaryCard
                plan={billingState.payload?.entitlement.plan === "PRO" ? "Pro" : "Free"}
                status={billingState.payload?.entitlement.proStatus ?? "inactive"}
                priceLabel={billingState.payload?.paywall.price ?? "$12 / month"}
                used={billingState.payload?.entitlement.unlockedBooksCount ?? 0}
                remaining={billingState.payload?.entitlement.remainingFreeStarts ?? 0}
                onUpgrade={() => handleBillingAction("upgrade")}
                onManage={() => handleBillingAction("portal")}
              />
              <div className="mt-4 space-y-3 rounded-[26px] border border-(--cf-border) bg-(--cf-surface-muted) p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Renewal date</p>
                    <p className="mt-2 text-sm text-(--cf-text-1)">Shown in billing portal</p>
                  </div>
                  <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Billing cycle</p>
                    <p className="mt-2 text-sm text-(--cf-text-1)">Monthly placeholder</p>
                  </div>
                  <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Payment method</p>
                    <p className="mt-2 text-sm text-(--cf-text-1)">Future payment method preview</p>
                  </div>
                  <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">Invoices</p>
                    <p className="mt-2 text-sm text-(--cf-text-1)">Future invoice history</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-4 text-sm leading-6 text-(--cf-text-2)">
                  <p>Upgrade adds unlimited access starts and makes room for richer synced learning features as they ship.</p>
                  <p className="mt-3">If you cancel, paid renewal stops and the account returns to the Free entitlement model after the current paid period ends.</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => showToast("Plan comparison will expand here.", "info")}>Compare plans</Button>
                  <Button variant="secondary" onClick={() => showToast(billingState.error || "Billing details are available through the existing routes.", billingState.error ? "error" : "info")}>Billing details</Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Security"
              title="Account summary and security preview"
              description="Account ownership and session trust should feel stable and serious."
              icon={<ShieldCheck className="h-5 w-5" />}
            >
              <div className="space-y-3">
                {[
                  { label: "Current plan", value: billingState.payload?.entitlement.plan ?? "Free" },
                  { label: "Connected sign in", value: userEmail ?? "Secure session" },
                  { label: "Authentication", value: "Managed account login" },
                  { label: "Current device", value: "This browser session" },
                  { label: "App version", value: `v${appVersion}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-(--cf-text-3)">{item.label}</p>
                    <p className="mt-2 text-sm text-(--cf-text-1)">{item.value}</p>
                  </div>
                ))}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="secondary" onClick={() => showToast("Security center placeholder opened.", "info")}>
                    <KeyRound className="h-4 w-4" />
                    Account security
                  </Button>
                  <Button variant="secondary" onClick={() => showToast("Sign out all devices placeholder opened.", "info")}>
                    <Users className="h-4 w-4" />
                    Sign out all devices
                  </Button>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </section>

      <EditProfileModal
        open={editOpen}
        profile={profile}
        email={userEmail}
        onClose={() => setEditOpen(false)}
        onSave={saveProfile}
      />

      <InfoModal open={Boolean(selectedBadge)} title={selectedBadge?.name || "Achievement"} onClose={() => setSelectedBadge(null)}>
        {selectedBadge ? (
          <BadgeDetailPanel
            badge={selectedBadge}
            nextTier={badgeSystem.badges.find((badge) => badge.id === selectedBadge.nextTierId) ?? null}
          />
        ) : null}
      </InfoModal>

      <Toast open={toast.open} message={toast.message} tone={toast.tone} />
    </main>
  );
}
