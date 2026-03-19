"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Flame,
  GraduationCap,
  Target,
} from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { Card } from "@/app/book/components/ui/Card";
import { Button } from "@/app/book/components/ui/Button";
import { ChipButton } from "@/app/book/components/ui/Chip";
import { InfoModal } from "@/app/book/home/components/InfoModal";
import { ErrorBanner } from "@/app/book/components/ui/ErrorBanner";

function ringStyle(percent: number): CSSProperties {
  const clamped = Math.max(0, Math.min(100, percent));
  return {
    background: `conic-gradient(var(--cf-accent) ${clamped * 3.6}deg, var(--cf-border) 0deg)`,
  };
}

type HeatmapMode = "minutes" | "chapters";
type ProgressFilter = "all" | "in_progress" | "completed";

function levelClass(level: number) {
  if (level <= 0) return "bg-(--cf-surface-muted) border-(--cf-border)";
  if (level === 1) return "bg-(--cf-accent-muted) border-(--cf-accent-border)";
  if (level === 2) return "bg-(--cf-accent-soft) border-(--cf-accent-border)";
  if (level === 3) return "bg-(--cf-accent-border) border-(--cf-accent-border)";
  return "bg-(--cf-success-soft) border-(--cf-success-border)";
}

function formatRelativeDate(isoDate: string): string {
  if (!isoDate || isoDate === new Date(0).toISOString()) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTotalMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function statusBadgeClass(status: "completed" | "in_progress" | "not_started") {
  if (status === "completed") return "text-(--cf-success-text) bg-(--cf-success-soft) border border-(--cf-success-border)";
  if (status === "in_progress") return "text-(--cf-info-text) bg-(--cf-accent-soft) border border-(--cf-accent-border)";
  return "text-(--cf-text-3) bg-(--cf-surface-muted) border border-(--cf-border)";
}

function statusLabel(status: "completed" | "in_progress" | "not_started") {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export function BookProgressClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<HeatmapMode>("minutes");
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all");
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const { hydrated, analytics } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );
  const viewerName = viewerIdentity.displayName || "Reader";

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      searchRef.current?.focus();
    },
    { ignoreWhenTyping: true }
  );

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (!onboarding.setupComplete) {
      router.replace("/book");
    }
  }, [onboarding.setupComplete, onboardingHydrated, router]);

  const filteredRows = useMemo(() => {
    if (!analytics) return [];
    let rows = analytics.engagedBookSnapshots;

    if (progressFilter === "in_progress") {
      rows = rows.filter((s) => s.status === "in_progress" || s.status === "not_started");
    } else if (progressFilter === "completed") {
      rows = rows.filter((s) => s.status === "completed");
    }

    const search = query.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((snapshot) => {
      const haystack = `${snapshot.book.title} ${snapshot.book.author}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [analytics, query, progressFilter]);

  const selectedCell = useMemo(() => {
    if (!analytics || !hoveredCell) return null;
    return analytics.heatmapCells.find((cell) => cell.key === hoveredCell) ?? null;
  }, [analytics, hoveredCell]);

  if (!onboardingHydrated || !hydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cf-text-2)">
          Loading progress dashboard...
        </div>
      </main>
    );
  }

  if (!analytics) {
    return (
      <main className="cf-app-shell">
        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <ErrorBanner message="We couldn't load your analytics right now. Please refresh." />
        </section>
      </main>
    );
  }

  const dailyProgressPercent = analytics.dailyGoalMinutes
    ? Math.min(
        100,
        Math.round((analytics.minutesReadToday / analytics.dailyGoalMinutes) * 100)
      )
    : 0;

  const topResume = analytics.recentlyOpenedSnapshots[0] ?? null;

  const inProgressCount = analytics.engagedBookSnapshots.filter(
    (s) => s.status === "in_progress" || s.status === "not_started"
  ).length;
  const completedCount = analytics.engagedBookSnapshots.filter(
    (s) => s.status === "completed"
  ).length;

  return (
    <main className="cf-app-shell">
      <TopNav
        name={viewerName}
        activeTab="progress"
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={searchRef}
        searchPlaceholder="Search by title or author..."
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-(--cf-text-1) sm:text-5xl">Progress</h1>
          <p className="mt-2 text-lg text-(--cf-text-2)">Your learning journey at a glance.</p>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {/* Daily goal ring */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">Today&apos;s Goal</p>
              <Target className="h-4 w-4 text-(--cf-accent)" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 rounded-full" style={ringStyle(dailyProgressPercent)}>
                <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-(--cf-surface-strong) text-xs font-bold text-(--cf-text-1)">
                  {Math.max(0, dailyProgressPercent)}%
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums text-(--cf-text-1)">
                  {analytics.minutesReadToday}<span className="text-sm font-normal text-(--cf-text-3)">m</span>
                </p>
                <p className="text-xs text-(--cf-text-3)">of {analytics.dailyGoalMinutes} min goal</p>
              </div>
            </div>
          </Card>

          {/* Streak */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">Streak</p>
              <Flame className="h-4 w-4 text-(--cf-warning-text) opacity-60" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-(--cf-warning-text)">
              {analytics.streakDays}
              <span className="ml-1 text-lg font-normal text-(--cf-text-3)">days</span>
            </p>
            <p className="mt-1 text-xs text-(--cf-text-3)">
              Last active: {analytics.lastActiveLabel}
            </p>
          </Card>

          {/* Total time read */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">Time Read</p>
              <Clock className="h-4 w-4 text-(--cf-accent) opacity-70" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-(--cf-text-1)">
              {formatTotalMinutes(analytics.totalMinutesRead)}
            </p>
            <p className="mt-1 text-xs text-(--cf-text-3)">All-time reading</p>
          </Card>

          {/* Books completed */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">Completed</p>
              <GraduationCap className="h-4 w-4 text-(--cf-success-text) opacity-60" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-(--cf-success-text)">
              {analytics.booksCompleted}
              <span className="ml-1 text-lg font-normal text-(--cf-text-3)">books</span>
            </p>
            <p className="mt-1 text-xs text-(--cf-text-3)">
              {analytics.totalCompletedChapters} chapters total
            </p>
          </Card>
        </div>

        {/* Continue Learning */}
        {topResume && (
          <Card className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-(--cf-text-1)">Continue learning</h2>
              <BookOpen className="h-4 w-4 text-(--cf-accent) opacity-70" />
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-(--cf-text-1)">{topResume.book.title}</p>
                <p className="mt-0.5 text-xs text-(--cf-text-3)">{topResume.book.author}</p>
                <div className="mt-2 flex items-center gap-3">
                  {/* Progress bar */}
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--cf-border)">
                    <div
                      className="h-full rounded-full bg-(--cf-accent) transition-[width]"
                      style={{ width: `${topResume.progressPercent}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-(--cf-text-3)">
                    {topResume.completedChapters}/{topResume.totalChapters} chapters
                  </span>
                </div>
                {topResume.lastOpenedLabel !== "Not started" && (
                  <p className="mt-1.5 text-xs text-(--cf-text-3)">
                    Last read: <span className="text-(--cf-text-2)">{topResume.lastOpenedLabel}</span>
                    {" · "}{formatRelativeDate(topResume.lastActivityAt)}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  router.push(
                    topResume.completedChapters > 0
                      ? `/book/library/${encodeURIComponent(topResume.book.id)}/chapter/${encodeURIComponent(topResume.resumeChapterId)}`
                      : `/book/library/${encodeURIComponent(topResume.book.id)}`
                  )
                }
              >
                {topResume.completedChapters > 0 ? "Resume" : "Start"}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Secondary resume suggestions */}
            {analytics.recentlyOpenedSnapshots.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-(--cf-border) pt-3">
                {analytics.recentlyOpenedSnapshots.slice(1).map((item) => (
                  <button
                    key={item.book.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        item.completedChapters > 0
                          ? `/book/library/${encodeURIComponent(item.book.id)}/chapter/${encodeURIComponent(item.resumeChapterId)}`
                          : `/book/library/${encodeURIComponent(item.book.id)}`
                      )
                    }
                    className="flex min-w-0 max-w-[200px] items-center gap-2 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-left transition hover:border-(--cf-accent-border) hover:bg-(--cf-accent-soft)"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-(--cf-text-1)">{item.book.title}</p>
                      <p className="text-[10px] text-(--cf-text-3)">{item.progressPercent}% · {formatRelativeDate(item.lastActivityAt)}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0 text-(--cf-text-3)" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          {/* Heatmap */}
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-(--cf-text-1)">Reading activity</h2>
              <div className="flex gap-2">
                <ChipButton tone={mode === "minutes" ? "sky" : "neutral"} active={mode === "minutes"} onClick={() => setMode("minutes")}>
                  Minutes
                </ChipButton>
                <ChipButton tone={mode === "chapters" ? "sky" : "neutral"} active={mode === "chapters"} onClick={() => setMode("chapters")}>
                  Chapters
                </ChipButton>
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex gap-2">
                <div className="grid grid-rows-7 gap-1.5 select-none" style={{ gridAutoRows: "1rem" }}>
                  {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                    <span key={i} className="flex h-4 items-center text-[9px] leading-none text-(--cf-text-3) w-6 justify-end pr-1">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="inline-grid grid-flow-col grid-rows-7 gap-1.5">
                  {analytics.heatmapCells.map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      onMouseEnter={() => setHoveredCell(cell.key)}
                      onFocus={() => setHoveredCell(cell.key)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={[
                        "h-4 w-4 rounded-[5px] border transition",
                        levelClass(mode === "minutes" ? cell.level : Math.min(cell.chapters, 4)),
                      ].join(" ")}
                      aria-label={`${cell.dateLabel}: ${cell.minutes} minutes, ${cell.chapters} chapters`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-(--cf-text-3)">
                {selectedCell
                  ? `${selectedCell.dateLabel} · ${selectedCell.minutes} min · ${selectedCell.chapters} chapters`
                  : "Hover a day to inspect activity details."}
              </p>
              <div className="flex shrink-0 items-center gap-1 text-[9px] text-(--cf-text-3)">
                <span>Less</span>
                <span className="h-3 w-3 rounded-sm border border-(--cf-border) bg-(--cf-surface-muted)" />
                <span className="h-3 w-3 rounded-sm border border-(--cf-accent-border) bg-(--cf-accent-muted)" />
                <span className="h-3 w-3 rounded-sm border border-(--cf-accent-border) bg-(--cf-accent-soft)" />
                <span className="h-3 w-3 rounded-sm border border-(--cf-accent-border) bg-(--cf-accent-border)" />
                <span className="h-3 w-3 rounded-sm border border-(--cf-success-border) bg-(--cf-success-soft)" />
                <span>More</span>
              </div>
            </div>
          </Card>

          {/* Upcoming reviews */}
          <Card>
            <h2 className="text-xl font-semibold text-(--cf-text-1)">Upcoming reviews</h2>
            {analytics.upcomingReviews.length ? (
              <div className="mt-3 space-y-2">
                {analytics.upcomingReviews.map((item) => (
                  <div key={item.id} className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
                    <p className="text-sm text-(--cf-text-1)">{item.prompt}</p>
                    <p className="mt-1 text-xs text-(--cf-text-soft)">Due {item.dueLabel}</p>
                  </div>
                ))}
                <Button variant="primary" className="mt-2" fullWidth onClick={() => setShowReviewModal(true)}>
                  Start Review Session
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-(--cf-text-soft)">Complete a chapter to generate review prompts.</p>
            )}
          </Card>
        </div>

        {/* Book Progress */}
        <Card className="mt-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-(--cf-text-1)">Book progress</h2>
            {analytics.hasAnyEngagement && (
              <div className="flex gap-1.5">
                <ChipButton
                  tone={progressFilter === "all" ? "sky" : "neutral"}
                  active={progressFilter === "all"}
                  onClick={() => setProgressFilter("all")}
                >
                  All {analytics.engagedBookSnapshots.length > 0 && `(${analytics.engagedBookSnapshots.length})`}
                </ChipButton>
                <ChipButton
                  tone={progressFilter === "in_progress" ? "sky" : "neutral"}
                  active={progressFilter === "in_progress"}
                  onClick={() => setProgressFilter("in_progress")}
                >
                  Active {inProgressCount > 0 && `(${inProgressCount})`}
                </ChipButton>
                <ChipButton
                  tone={progressFilter === "completed" ? "sky" : "neutral"}
                  active={progressFilter === "completed"}
                  onClick={() => setProgressFilter("completed")}
                >
                  Done {completedCount > 0 && `(${completedCount})`}
                </ChipButton>
              </div>
            )}
          </div>

          {!analytics.hasAnyEngagement ? (
            <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-8 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-(--cf-text-3) opacity-50" />
              <p className="mt-3 text-lg font-medium text-(--cf-text-1)">No books opened yet</p>
              <p className="mt-2 text-sm text-(--cf-text-2)">Open a book and your progress will appear here automatically.</p>
              <Link href="/book/library" className="mt-5 inline-flex rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-2 text-sm font-medium text-(--cf-info-text) hover:bg-(--cf-accent-muted)">
                Browse library
              </Link>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-5 text-center">
              <p className="text-base font-medium text-(--cf-text-1)">
                {query
                  ? "No books match this search"
                  : progressFilter === "completed"
                    ? "No completed books yet"
                    : "No active books"}
              </p>
              <p className="mt-1.5 text-sm text-(--cf-text-2)">
                {query
                  ? "Try a different title or clear the search."
                  : progressFilter === "completed"
                    ? "Finish a book to see it here."
                    : "All your books are completed."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((row) => (
                <div
                  key={row.book.id}
                  className="group rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 transition hover:border-(--cf-accent-border)"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-(--cf-text-1)">{row.book.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-(--cf-text-3)">{row.book.author}</p>

                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--cf-border)">
                          <div
                            className="h-full rounded-full bg-(--cf-accent) transition-[width]"
                            style={{ width: `${row.progressPercent}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[10px] tabular-nums text-(--cf-text-3)">
                          {row.completedChapters}/{row.totalChapters}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-(--cf-text-3)">
                        {row.bestScore > 0 && (
                          <span>Best score: <span className="font-medium text-(--cf-text-2)">{row.bestScore}%</span></span>
                        )}
                        {row.lastOpenedLabel !== "Not started" && (
                          <span>Last: <span className="text-(--cf-text-2)">{row.lastOpenedLabel}</span></span>
                        )}
                        <span>{formatRelativeDate(row.lastActivityAt)}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-0.5 shrink-0"
                      onClick={() =>
                        router.push(
                          row.status === "completed"
                            ? `/book/library/${encodeURIComponent(row.book.id)}`
                            : row.completedChapters > 0
                              ? `/book/library/${encodeURIComponent(row.book.id)}/chapter/${encodeURIComponent(row.resumeChapterId)}`
                              : `/book/library/${encodeURIComponent(row.book.id)}`
                        )
                      }
                    >
                      {row.status === "completed" ? "Review" : row.completedChapters > 0 ? "Resume" : "Start"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <InfoModal
        open={showReviewModal}
        title="Review Session"
        onClose={() => setShowReviewModal(false)}
      >
        <p className="text-sm text-(--cf-text-2)">
          Review mode will combine spaced repetition cards and adaptive quiz prompts.
        </p>
        <div className="mt-3 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 text-sm text-(--cf-text-2)">
          <p className="flex items-center gap-2 text-(--cf-text-1)">
            <Target className="h-4 w-4 text-(--cf-accent)" />
            Adaptive review with spaced repetition.
          </p>
          <p className="mt-2">You already have {analytics.upcomingReviews.length} items queued.</p>
        </div>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setShowReviewModal(false)}>
            Close
          </Button>
        </div>
      </InfoModal>

      {analytics.avgQuizScore >= 90 ? (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden rounded-xl border border-(--cf-success-border) bg-(--cf-success-soft) px-3 py-1.5 text-xs text-(--cf-success-text) md:inline-flex md:items-center md:gap-1.5">
          <GraduationCap className="h-4 w-4" />
          Quiz momentum is strong this week
        </div>
      ) : null}
    </main>
  );
}
