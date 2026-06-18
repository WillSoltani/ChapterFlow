"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, ArrowRight, Trophy, Check } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { EventDefinition, EventParticipationItem } from "@/app/app/api/book/_lib/types";

type ActiveEventWithParticipation = EventDefinition & {
  participation?: EventParticipationItem;
};

type EventsResponse = { events: ActiveEventWithParticipation[] };

export function EventsClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const viewerName = viewerIdentity.displayName || "Reader";

  const [events, setEvents] = useState<ActiveEventWithParticipation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Non-onboarded users get redirected (don't skeleton forever) — same posture
  // as /book/badges. The page is also guarded server-side by requireDashboardAccess.
  useEffect(() => {
    if (onboardingHydrated && !onboarding.setupComplete) router.replace("/book");
  }, [onboardingHydrated, onboarding.setupComplete, router]);

  useEffect(() => {
    fetchBookJson<EventsResponse>("/app/api/book/events/active")
      .then((data) => setEvents(data.events))
      .catch(() => setError("Something went wrong loading events. Please try again later."))
      .finally(() => setLoading(false));
  }, []);

  if (!onboardingHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
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
        <section id="main" tabIndex={-1} className="mx-auto w-full max-w-450 animate-pulse px-4 pb-28 pt-7 focus:outline-none sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
          <div className="h-9 w-48 rounded-xl bg-(--cf-surface-muted)" />
          <div className="mt-2 h-5 w-72 rounded-xl bg-(--cf-surface)" />
          <div className="mt-6 space-y-4">
            <div className="h-48 rounded-3xl bg-(--cf-surface-muted)" />
            <div className="h-48 rounded-3xl bg-(--cf-surface-muted)" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cf-app-shell">
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

      <section id="main" tabIndex={-1} className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 focus:outline-none sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
        <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1)">
          Reading Events
        </h1>
        <p className="mt-1 text-sm text-(--cf-text-3)">
          Time-limited reading challenges with exclusive rewards
        </p>

        {error && (
          <div className="mt-4 rounded-2xl border border-(--cf-danger-border) bg-(--cf-danger-bg) px-4 py-3 text-sm text-(--cf-danger-text)">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-3xl bg-(--cf-surface-muted)"
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="cf-panel rounded-3xl p-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-(--cf-text-3)" />
              <p className="mt-3 text-sm text-(--cf-text-3)">
                No active events right now. Check back soon!
              </p>
            </div>
          ) : (
            events.map((event) => {
              const now = new Date();
              const end = new Date(event.endDate);
              const daysLeft = Math.max(
                0,
                Math.ceil((end.getTime() - now.getTime()) / 86400000),
              );
              const joined = !!event.participation;
              const completed = event.participation?.completed ?? false;
              const progress = event.participation?.totalChaptersCompleted ?? 0;
              const progressPercent = event.targetChapters > 0
                ? Math.min(100, Math.round((progress / event.targetChapters) * 100))
                : 0;
              const card = (
                <div className="group cf-panel overflow-hidden rounded-3xl border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface))] transition hover:shadow-lg">
                  <div className="p-6">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-(--cf-accent)" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-(--cf-accent)">
                        {completed ? "Completed" : `${daysLeft} days left`}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-(--cf-text-1)">
                      {event.title}
                    </h2>
                    <p className="mt-1 text-sm text-(--cf-text-2)">
                      {event.description}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-(--cf-text-3)">
                      <span>{event.books.length} books</span>
                      <span>
                        {event.dailyChapterTarget} chapter
                        {event.dailyChapterTarget !== 1 ? "s" : ""}/day
                      </span>
                      <span>{event.bonusIP} IP reward</span>
                    </div>

                    {joined && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-(--cf-text-3)">
                          <span>{progress} / {event.targetChapters} chapters</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-(--cf-surface-strong)">
                          <div
                            className="h-full rounded-full bg-(--cf-accent) transition-[width] duration-500"
                            style={{ width: `${Math.max(4, progressPercent)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-4 text-sm font-semibold">
                      {completed ? (
                        <span className="inline-flex items-center gap-1.5 text-(--cf-success-text)">
                          <Check className="h-4 w-4" /> Completed
                        </span>
                      ) : joined ? (
                        <span className="inline-flex items-center gap-1.5 text-(--cf-accent)">
                          <Check className="h-4 w-4" /> Joined — view progress
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-(--cf-accent)">
                          View event
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              // Always link to the detail page — join lives there, so readers can
              // inspect an event (books, schedule, reward) before committing.
              return (
                <Link
                  key={event.eventId}
                  href={`/book/events/${event.eventId}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) rounded-3xl"
                >
                  {card}
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
