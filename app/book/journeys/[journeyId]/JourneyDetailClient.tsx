"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  Map,
  Shield,
  Star,
} from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookUserJourneyItem } from "@/app/app/api/book/_lib/types";

type JourneyBook = {
  bookId: string;
  order: number;
  reason: string;
  title: string;
  author: string;
  coverImage: string | null;
  category: string;
  completed: boolean;
};

type JourneyDetail = {
  journeyId: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  estimatedWeeks: number;
  books: JourneyBook[];
  badge: { badgeId: string; name: string; icon: string } | null;
  bonusIP: number;
  coverGradient: [string, string];
  progress?: BookUserJourneyItem;
};

type JourneyDetailResponse = {
  journey: JourneyDetail;
};

export function JourneyDetailClient() {
  const { journeyId } = useParams<{ journeyId: string }>();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const viewerName = viewerIdentity.displayName || "Reader";

  const [journey, setJourney] = useState<JourneyDetailResponse["journey"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Non-onboarded users get redirected (don't skeleton forever) — same posture
  // as /book/badges. The page is also guarded server-side by requireDashboardAccess.
  useEffect(() => {
    if (onboardingHydrated && !onboarding.setupComplete) router.replace("/book");
  }, [onboardingHydrated, onboarding.setupComplete, router]);

  useEffect(() => {
    fetchBookJson<JourneyDetailResponse>(
      `/app/api/book/me/journeys/${journeyId}`,
    )
      .then((data) => setJourney(data.journey))
      .catch((err) => setError(err?.message ?? "Failed to load journey"))
      .finally(() => setLoading(false));
  }, [journeyId]);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      await fetchBookJson(`/app/api/book/me/journeys/${journeyId}/start`, {
        method: "POST",
      });
      const data = await fetchBookJson<JourneyDetailResponse>(
        `/app/api/book/me/journeys/${journeyId}`,
      );
      setJourney(data.journey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start journey");
    } finally {
      setStarting(false);
    }
  };

  const topNav = (
    <TopNav
      name={viewerName}
      avatarUrl={viewerIdentity.avatarDataUrl}
      activeTab="journeys"
      searchQuery=""
      onSearchChange={() => {}}
      searchInputRef={searchRef}
      showSearch={false}
      logoVariant="dashboard"
    />
  );

  if (!onboardingHydrated || !onboarding.setupComplete || loading) {
    return (
      <main className="cf-app-shell">
        {topNav}
        <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded-xl bg-(--cf-surface-muted)" />
            <div className="h-4 w-72 rounded-lg bg-(--cf-surface-muted)" />
            <div className="mt-6 h-64 rounded-3xl bg-(--cf-surface-muted)" />
          </div>
        </section>
      </main>
    );
  }

  if (error || !journey) {
    return (
      <main className="cf-app-shell">
        {topNav}
        <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
          <Link
            href="/book/journeys"
            className="inline-flex items-center gap-1.5 text-sm text-(--cf-text-3) transition hover:text-(--cf-text-1)"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Journeys
          </Link>
          <div className="cf-panel mt-6 rounded-3xl p-8 text-center">
            <p className="text-sm text-(--cf-text-3)">
              {error ?? "Journey not found"}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const isActive = journey.progress && !journey.progress.completedAt;
  const isComplete = !!journey.progress?.completedAt;
  const completedCount = journey.progress?.completedBookIds.length ?? 0;
  const totalBooks = journey.books.length;
  const progressPercent = totalBooks > 0 ? (completedCount / totalBooks) * 100 : 0;

  return (
    <main className="cf-app-shell">
      {topNav}

      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
        {/* Back link */}
        <Link
          href="/book/journeys"
          className="inline-flex items-center gap-1.5 text-sm text-(--cf-text-3) transition hover:text-(--cf-text-1)"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Journeys
        </Link>

        {/* Header */}
        <div
          className="mt-5 rounded-3xl border border-(--cf-border) p-6"
          style={{
            background: `linear-gradient(135deg, ${journey.coverGradient[0]}22, var(--cf-surface))`,
          }}
        >
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-(--cf-accent)" />
            <span className="text-xs font-semibold uppercase tracking-wider text-(--cf-accent)">
              {journey.category}
            </span>
            {isComplete && (
              <CheckCircle className="ml-auto h-5 w-5 text-(--cf-success-text)" />
            )}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-(--cf-text-1)">
            {journey.title}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-(--cf-text-2)">
            {journey.description}
          </p>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-(--cf-text-3)">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> {totalBooks} books
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> ~{journey.estimatedWeeks} weeks
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5" /> {journey.bonusIP} IP bonus
            </span>
            <span className="rounded-lg bg-(--cf-surface-muted) px-2 py-0.5 text-xs font-medium text-(--cf-text-2)">
              {journey.difficulty}
            </span>
          </div>

          {/* Progress bar */}
          {(isActive || isComplete) && (
            <div className="mt-5">
              <div className="h-2 rounded-full bg-(--cf-surface-muted)">
                <div
                  className="h-2 rounded-full bg-(--cf-accent) transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-(--cf-text-3)">
                {isComplete
                  ? `All ${totalBooks} books completed`
                  : `${completedCount} of ${totalBooks} books completed`}
              </p>
            </div>
          )}

          {/* Start CTA — journeys are started here (not from the list), so
              readers can review the books and reward before committing. */}
          {!journey.progress && (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-5 py-2.5 text-sm font-semibold text-(--cf-accent-contrast) transition hover:brightness-110 disabled:opacity-60"
            >
              {starting ? "Starting…" : "Start Journey"}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Badge reward */}
        {journey.badge && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--cf-accent-soft)">
              <Shield className="h-5 w-5 text-(--cf-accent)" />
            </div>
            <div>
              <p className="text-sm font-semibold text-(--cf-text-1)">
                {journey.badge.name}
              </p>
              <p className="text-xs text-(--cf-text-3)">
                Badge awarded on completion
              </p>
            </div>
          </div>
        )}

        {/* Book list */}
        <h2 className="mt-8 text-lg font-semibold text-(--cf-text-1)">
          Reading Order
        </h2>
        <div className="mt-4 space-y-3">
          {journey.books.map((book, idx) => {
            const isCurrent =
              isActive &&
              !book.completed &&
              (idx === 0 || journey.books[idx - 1].completed);

            return (
              <Link
                key={book.bookId}
                href={`/book/library/${book.bookId}`}
                className="group flex items-start gap-4 rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-4 transition hover:border-(--cf-accent-border) hover:bg-(--cf-accent-muted)"
              >
                {/* Order indicator */}
                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    book.completed
                      ? "bg-(--cf-success-bg) text-(--cf-success-text)"
                      : isCurrent
                        ? "bg-(--cf-accent) text-(--cf-accent-contrast)"
                        : "bg-(--cf-surface-muted) text-(--cf-text-3)",
                  ].join(" ")}
                >
                  {book.completed ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    book.order
                  )}
                </div>

                {/* Book info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-(--cf-text-1) group-hover:text-(--cf-accent)">
                      {book.title}
                    </h3>
                    {isCurrent && (
                      <span className="rounded-md bg-(--cf-accent) px-1.5 py-0.5 text-[10px] font-bold uppercase text-(--cf-accent-contrast)">
                        Up Next
                      </span>
                    )}
                  </div>
                  {book.author && (
                    <p className="text-xs text-(--cf-text-3)">{book.author}</p>
                  )}
                  <p className="mt-1 text-xs leading-relaxed text-(--cf-text-2)">
                    {book.reason}
                  </p>
                </div>

                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-(--cf-text-3) opacity-0 transition group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
