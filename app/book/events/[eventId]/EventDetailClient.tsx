"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  Calendar,
  Check,
  Clock,
  Loader2,
  Trophy,
} from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { getBookById } from "@/app/book/data/booksCatalog";
import type { EventDefinition, EventParticipationItem } from "@/app/app/api/book/_lib/types";

type ActiveEventWithParticipation = EventDefinition & {
  participation?: EventParticipationItem;
};

type EventsResponse = { events: ActiveEventWithParticipation[] };
type JoinResponse = { participation: EventParticipationItem; isNew: boolean };

export function EventDetailClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const viewerName = viewerIdentity.displayName || "Reader";

  const [event, setEvent] = useState<ActiveEventWithParticipation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Non-onboarded users get redirected (don't skeleton forever) — same posture
  // as /book/badges. The page is also guarded server-side by requireDashboardAccess.
  useEffect(() => {
    if (onboardingHydrated && !onboarding.setupComplete) router.replace("/book");
  }, [onboardingHydrated, onboarding.setupComplete, router]);

  useEffect(() => {
    fetchBookJson<EventsResponse>("/app/api/book/events/active")
      .then((data) => {
        const match = data.events.find((e) => e.eventId === eventId) ?? null;
        setEvent(match);
        if (!match) setError("Event not found or no longer active.");
      })
      .catch(() => setError("Failed to load event details."))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleJoin = async () => {
    if (!event) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetchBookJson<JoinResponse>(
        `/app/api/book/me/events/${encodeURIComponent(eventId)}/join`,
        { method: "POST" },
      );
      setEvent((prev) =>
        prev ? { ...prev, participation: res.participation } : prev,
      );
    } catch {
      setError("Failed to join event. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const topNav = (
    <TopNav
      name={viewerName}
      avatarUrl={viewerIdentity.avatarDataUrl}
      activeTab="events"
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
        <section className="mx-auto w-full max-w-450 animate-pulse px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
          <div className="h-5 w-32 rounded-lg bg-(--cf-surface-muted)" />
          <div className="mt-6 h-64 rounded-3xl bg-(--cf-surface-muted)" />
        </section>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="cf-app-shell">
        {topNav}
        <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
          <Link
            href="/book/events"
            className="inline-flex items-center gap-1.5 text-sm text-(--cf-text-3) hover:text-(--cf-text-1)"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Events
          </Link>
          <div className="cf-panel mt-6 rounded-3xl p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-(--cf-text-3)" />
            <p className="mt-3 text-sm text-(--cf-text-3)">
              {error ?? "Event not found."}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const now = new Date();
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const elapsedDays = Math.max(0, totalDays - daysLeft);

  const joined = !!event.participation;
  const completed = event.participation?.completed ?? false;
  const progress = event.participation?.totalChaptersCompleted ?? 0;
  const progressPercent = event.targetChapters > 0
    ? Math.min(100, Math.round((progress / event.targetChapters) * 100))
    : 0;

  const expectedPercent = Math.round((elapsedDays / totalDays) * 100);
  const onTrack = progressPercent >= expectedPercent;

  const barGradient = onTrack
    ? "linear-gradient(90deg, var(--cf-accent), var(--accent-cyan))"
    : "linear-gradient(90deg, var(--accent-amber), var(--accent-rose))";

  return (
    <main className="cf-app-shell">
      {topNav}

      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
        <Link
          href="/book/events"
          className="inline-flex items-center gap-1.5 text-sm text-(--cf-text-3) hover:text-(--cf-text-1)"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Link>

        {error && (
          <div className="mt-4 rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-bg) px-4 py-3 text-sm text-(--cf-danger-text)">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="cf-panel mt-6 overflow-hidden rounded-3xl border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface))]">
          <div className="p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-(--cf-accent)" />
              <span className="text-xs font-semibold uppercase tracking-wider text-(--cf-accent)">
                {completed ? "Completed" : `${daysLeft} days left`}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-(--cf-text-1)">
              {event.title}
            </h1>
            <p className="mt-1 text-sm text-(--cf-text-2)">
              {event.description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-(--cf-text-3)">
              <span className="inline-flex items-center gap-1">
                <Book className="h-3.5 w-3.5" />
                {event.books.length} books
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {event.dailyChapterTarget} chapter{event.dailyChapterTarget !== 1 ? "s" : ""}/day
              </span>
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                {event.bonusIP} IP reward
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {totalDays} day challenge
              </span>
            </div>

            {/* Progress section */}
            {joined && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-(--cf-text-1)">
                    {progress} / {event.targetChapters} chapters
                  </span>
                  <span className="text-(--cf-text-3)">{progressPercent}%</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-(--cf-surface-strong)">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.max(4, progressPercent)}%`,
                      background: barGradient,
                    }}
                  />
                </div>
                {!completed && (
                  <p className="mt-1.5 text-xs text-(--cf-text-3)">
                    {onTrack
                      ? "You're on track! Keep it up."
                      : "You're a bit behind — pick up the pace!"}
                  </p>
                )}
              </div>
            )}

            {/* Action button */}
            <div className="mt-5">
              {completed ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-success-soft) px-5 py-2.5 text-sm font-semibold text-(--cf-success-text)">
                  <Check className="h-4 w-4" /> Event Completed — {event.bonusIP} IP earned
                </span>
              ) : joined ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent-soft) px-5 py-2.5 text-sm font-semibold text-(--cf-accent)">
                  <Check className="h-4 w-4" /> Joined
                </span>
              ) : (
                <button
                  type="button"
                  disabled={joining}
                  onClick={handleJoin}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {joining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {joining ? "Joining..." : "Join Event"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Eligible books */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-(--cf-text-1)">
            Eligible Books
          </h2>
          <p className="mt-1 text-xs text-(--cf-text-3)">
            Complete chapters from these books to earn progress
          </p>
          <div className="mt-3 space-y-2">
            {event.books.map((bookId) => {
              const book = getBookById(bookId);
              return (
                <Link
                  key={bookId}
                  href={`/book/library/${bookId}`}
                  className="cf-panel flex items-center gap-3 rounded-2xl p-3 transition hover:bg-(--cf-accent-muted)"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--cf-surface-strong)">
                    <Book className="h-5 w-5 text-(--cf-text-3)" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-(--cf-text-1)">
                      {book?.title ?? bookId}
                    </span>
                    {book?.author && (
                      <span className="block truncate text-xs text-(--cf-text-3)">
                        {book.author}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Daily progress */}
        {joined && event.participation && Object.keys(event.participation.dailyProgress).length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-(--cf-text-1)">
              Daily Progress
            </h2>
            <div className="mt-3 space-y-2">
              {Object.entries(event.participation.dailyProgress)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, chapters]) => (
                  <div
                    key={date}
                    className="cf-panel flex items-center justify-between rounded-2xl px-4 py-3"
                  >
                    <span className="text-sm text-(--cf-text-2)">{date}</span>
                    <span className="text-sm font-medium text-(--cf-accent)">
                      {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
