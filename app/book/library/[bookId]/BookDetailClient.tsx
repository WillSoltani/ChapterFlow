"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Search } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { InfoModal } from "@/app/book/home/components/InfoModal";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { useSavedBooks } from "@/app/book/hooks/useSavedBooks";
import { getLibraryBookById } from "@/app/book/data/mockUserLibraryState";
import { getBookSynopsis } from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle, type BookChapter } from "@/app/book/data/mockChapters";
import { useBookProgress } from "@/app/book/library/hooks/useBookProgress";
import { BookOverviewPanel } from "@/app/book/library/[bookId]/components/BookOverviewPanel";
import { ChapterRow, type ChapterRowState } from "@/app/book/library/[bookId]/components/ChapterRow";
import { ResetProgressModal } from "@/app/book/library/[bookId]/components/ResetProgressModal";

type ChapterFilter = "all" | "completed" | "locked";

const chapterFilterOptions: Array<{ id: ChapterFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "locked", label: "Locked" },
];

export function BookDetailClient({ bookId }: { bookId: string }) {
  const router = useRouter();
  const chapterSearchRef = useRef<HTMLInputElement | null>(null);

  const [chapterQuery, setChapterQuery] = useState("");
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>("all");
  const [lockedToast, setLockedToast] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { savedSet, toggleSaved, hydrated: savedHydrated } = useSavedBooks(
    onboarding.setupComplete
  );

  const entry = useMemo(() => getLibraryBookById(bookId), [bookId]);
  const bundle = useMemo(() => getBookChaptersBundle(bookId), [bookId]);
  const chapters = bundle.chapters;
  const {
    hydrated,
    progress,
    currentChapter,
    completedCount,
    totalCount,
    unlockedCount,
    progressPercent,
    avgScore,
    getChapterState,
    setLastReadChapter,
    resetProgress,
  } = useBookProgress(bookId, chapters);

  useKeyboardShortcut(
    "/",
    (event) => {
      event.preventDefault();
      chapterSearchRef.current?.focus();
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
    if (!entry) {
      router.replace("/book/library");
    }
  }, [entry, router]);

  useEffect(() => {
    if (!lockedToast) return;
    const timeout = window.setTimeout(() => setLockedToast(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [lockedToast]);

  const filteredChapters = useMemo(() => {
    const query = chapterQuery.trim().toLowerCase();
    return chapters.filter((chapter) => {
      const state = getChapterState(chapter.id);
      if (chapterFilter === "completed" && state !== "completed") return false;
      if (chapterFilter === "locked" && state !== "locked") return false;
      if (!query) return true;
      const searchable = `${chapter.title} ${chapter.code}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [chapterFilter, chapterQuery, chapters, getChapterState]);

  const openChapter = (chapter: BookChapter, options?: { sessionMode?: boolean }) => {
    const state = getChapterState(chapter.id);
    if (state === "locked") {
      setLockedToast("Locked. Pass the current chapter quiz to unlock.");
      return;
    }

    setLastReadChapter(chapter.id);
    const route = `/book/library/${encodeURIComponent(bookId)}/chapter/${encodeURIComponent(chapter.id)}`;
    router.push(options?.sessionMode ? `${route}?session=1` : route);
  };

  if (!entry || !onboardingHydrated || !hydrated || !savedHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
        <div className="mx-auto flex min-h-screen items-center justify-center px-4 text-(--cf-text-2)">
          Loading book details...
        </div>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
      <TopNav
        name={onboarding.name || "Reader"}
        activeTab="library"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={chapterSearchRef}
        showSearch={false}
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-24">
        <div className="mb-5 flex items-center gap-2 text-sm text-(--cf-text-2)">
          <Link href="/book/library" className="hover:text-(--cf-text-1)">
            Library
          </Link>
          <ChevronRight className="h-4 w-4 text-(--cf-text-3)" />
          <span className="text-(--cf-text-1)">{entry.title}</span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[420px_1fr]">
          <BookOverviewPanel
            entry={entry}
            pages={bundle.pages}
            synopsis={getBookSynopsis(entry.id)}
            estimatedDaysToFinish={Math.max(
              1,
              Math.ceil(Math.max(bundle.pages / 2.8, 120) / Math.max(onboarding.dailyGoalMinutes, 10))
            )}
            progressPercent={progressPercent}
            avgScore={avgScore}
            unlockedCount={unlockedCount}
            completedCount={completedCount}
            totalCount={totalCount}
            currentChapterOrder={currentChapter?.order ?? 1}
            currentChapterMinutes={currentChapter?.minutes ?? 10}
            onContinue={() =>
              currentChapter &&
              openChapter(currentChapter, { sessionMode: progressPercent === 0 })
            }
            isSaved={savedSet.has(entry.id)}
            onToggleSaved={() => void toggleSaved(entry.id, { source: "book-detail" })}
            onResetProgress={() => setShowResetModal(true)}
            onRemoveFromLibrary={() => setShowRemoveModal(true)}
          />

          <section className="cf-panel rounded-[30px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold tracking-[0.1em] text-(--cf-text-1)">
                CHAPTERS
              </h2>
              <p className="text-sm text-(--cf-text-3)">
                {completedCount}/{totalCount} completed
              </p>
            </div>

            <div className="cf-banner cf-banner-info mt-4 rounded-2xl p-3">
              <p className="cf-kicker text-(--cf-accent)">Resume</p>
              <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">
                {currentChapter?.code} {currentChapter?.title}
              </p>
              <button
                type="button"
                onClick={() =>
                  currentChapter &&
                  openChapter(currentChapter, { sessionMode: progressPercent === 0 })
                }
                className="cf-btn cf-btn-primary mt-2 rounded-xl px-3 py-1.5 text-sm"
              >
                {completedCount > 0 ? "Continue" : "Start"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--cf-text-3)" />
                <input
                  ref={chapterSearchRef}
                  type="search"
                  value={chapterQuery}
                  onChange={(event) => setChapterQuery(event.target.value)}
                  placeholder="Search chapters..."
                  className="cf-input w-full rounded-xl px-10 py-2.5 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {chapterFilterOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setChapterFilter(option.id)}
                    className={[
                      "rounded-full px-3 py-1.5 text-sm transition",
                      chapterFilter === option.id
                        ? "cf-chip cf-chip-active"
                        : "cf-chip hover:border-(--cf-border-strong) hover:text-(--cf-text-1)",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2.5 lg:max-h-[calc(100vh-13.5rem)] lg:overflow-y-auto lg:pr-1">
              {filteredChapters.map((chapter) => {
                const state = getChapterState(chapter.id) as ChapterRowState;
                return (
                  <ChapterRow
                    key={chapter.id}
                    chapter={chapter}
                    state={state}
                    score={progress.chapterScores[chapter.id]}
                    hint="Complete the current chapter quiz to unlock"
                    onClick={() => openChapter(chapter)}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </section>

      {currentChapter ? (
        <div className="fixed bottom-20 left-4 right-4 z-50 lg:hidden">
          <button
            type="button"
            onClick={() =>
              openChapter(currentChapter, { sessionMode: progressPercent === 0 })
            }
            className="cf-btn cf-btn-primary w-full rounded-2xl px-4 py-3 text-base"
          >
            {completedCount > 0
              ? `Continue Chapter ${currentChapter.order}`
              : `Start Chapter ${currentChapter.order}`}
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </div>
      ) : null}

      <ResetProgressModal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={() => {
          resetProgress();
          setShowResetModal(false);
        }}
      />

      <InfoModal
        open={showRemoveModal}
        title="Remove from library?"
        onClose={() => setShowRemoveModal(false)}
      >
        <p>Removing this book will clear your reading progress for this title. This cannot be undone.</p>
        <button
          type="button"
          onClick={() => setShowRemoveModal(false)}
          className="cf-btn cf-btn-secondary mt-4 rounded-xl px-4 py-2 text-sm"
        >
          Close
        </button>
      </InfoModal>

      {lockedToast ? (
        <div className="cf-panel-strong fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl px-3 py-2 text-sm text-(--cf-text-1)">
          {lockedToast}
        </div>
      ) : null}
    </main>
  );
}
