"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Flame, GraduationCap, Target } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookAnalytics } from "@/app/book/hooks/useBookAnalytics";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
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

function levelClass(level: number) {
  if (level <= 0) return "bg-(--cf-surface-muted) border-(--cf-border)";
  if (level === 1) return "bg-(--cf-accent-muted) border-(--cf-accent-border)";
  if (level === 2) return "bg-(--cf-accent-soft) border-(--cf-accent-border)";
  if (level === 3) return "bg-(--cf-accent-border) border-(--cf-accent-border)";
  return "bg-(--cf-success-soft) border-(--cf-success-border)";
}

function progressStatusLabel(status: "completed" | "in_progress" | "not_started") {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in progress";
  return "active";
}

export function BookProgressClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<HeatmapMode>("minutes");
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { hydrated, analytics } = useBookAnalytics(
    onboarding.selectedBookIds,
    onboarding.dailyGoalMinutes
  );

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
    const search = query.trim().toLowerCase();
    if (!search) return analytics.engagedBookSnapshots;
    return analytics.engagedBookSnapshots.filter((snapshot) => {
      const haystack = `${snapshot.book.title} ${snapshot.book.author}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [analytics, query]);

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

  return (
    <main className="cf-app-shell">
      <TopNav
        name={onboarding.name || "Reader"}
        activeTab="progress"
        searchQuery={query}
        onSearchChange={setQuery}
        searchInputRef={searchRef}
        searchPlaceholder="Search by title or author..."
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-(--cf-text-1) sm:text-5xl">Progress</h1>
          <p className="mt-2 text-lg text-(--cf-text-2)">Your reading momentum at a glance.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                <p className="text-xs text-(--cf-text-3)">of {analytics.dailyGoalMinutes} min tracked today</p>
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
              Last progress: {analytics.lastActiveLabel}
            </p>
          </Card>

          {/* Books */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">Completed</p>
              <GraduationCap className="h-4 w-4 text-(--cf-success-text) opacity-60" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-(--cf-success-text)">
              {analytics.booksCompleted}
              <span className="ml-1 text-lg font-normal text-(--cf-text-3)">books</span>
            </p>
            <p className="mt-1 text-xs text-(--cf-text-3)">Across your library</p>
          </Card>

          {/* Quiz */}
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">Quiz Avg</p>
              <Target className="h-4 w-4 text-(--cf-accent)" />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-(--cf-info-text)">
              {analytics.avgQuizScore}
              <span className="ml-0.5 text-lg font-normal text-(--cf-text-3)">%</span>
            </p>
            <p className="mt-1 text-xs text-(--cf-text-3)">Best: {analytics.maxQuizScore}%</p>
          </Card>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
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

        <Card className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-(--cf-text-1)">Book progress</h2>
            <p className="text-xs uppercase tracking-[0.14em] text-(--cf-text-soft)">Meaningful activity only</p>
          </div>

          {!analytics.hasAnyEngagement ? (
            <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-5 text-center">
              <p className="text-lg font-medium text-(--cf-text-1)">No books in progress yet</p>
              <p className="mt-2 text-sm text-(--cf-text-2)">Start reading a book and your progress will show up here.</p>
              <Link href="/book/library" className="mt-4 inline-flex rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-4 py-2 text-sm text-(--cf-info-text) hover:bg-(--cf-accent-muted)">
                Browse library
              </Link>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-5 text-center">
              <p className="text-lg font-medium text-(--cf-text-1)">No engaged books match this search</p>
              <p className="mt-2 text-sm text-(--cf-text-2)">Try another title or clear the search to see the books you have actually worked on.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((row) => (
                <div key={row.book.id} className="grid gap-2 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) p-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-center">
                  <div>
                    <p className="text-sm font-medium text-(--cf-text-1)">{row.book.title}</p>
                    <p className="text-xs text-(--cf-text-soft)">{row.book.author}</p>
                  </div>
                  <p className="text-xs text-(--cf-text-2)">{progressStatusLabel(row.status)}</p>
                  <p className="text-xs text-(--cf-text-2)">{row.completedChapters}/{row.totalChapters} chapters</p>
                  <p className="text-xs text-(--cf-text-2)">Best {row.bestScore}%</p>
                  <p className="text-xs truncate text-(--cf-text-2)">{row.lastOpenedLabel}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      router.push(
                        row.status === "completed"
                          ? `/book/library/${encodeURIComponent(row.book.id)}`
                          : `/book/library/${encodeURIComponent(row.book.id)}/chapter/${encodeURIComponent(row.resumeChapterId)}`
                      )
                    }
                  >
                    {row.status === "completed" ? "Open" : row.status === "in_progress" ? "Resume" : "Continue"}
                  </Button>
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
