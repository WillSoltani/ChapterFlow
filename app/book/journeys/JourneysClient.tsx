"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Map, ArrowRight, CheckCircle } from "lucide-react";
import { TopNav } from "@/app/book/home/components/TopNav";
import { useOnboardingState } from "@/app/book/hooks/useOnboardingState";
import { useBookViewer } from "@/app/book/hooks/useBookViewer";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { JourneyDefinition, BookUserJourneyItem } from "@/app/app/api/book/_lib/types";

type JourneysResponse = {
  journeys: (JourneyDefinition & { progress?: BookUserJourneyItem })[];
};

export function JourneysClient() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { state: onboarding, hydrated: onboardingHydrated } = useOnboardingState();
  const { identity: viewerIdentity } = useBookViewer();
  const viewerName = viewerIdentity.displayName || "Reader";

  const [journeys, setJourneys] = useState<JourneysResponse["journeys"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Non-onboarded users get redirected (don't skeleton forever) — same posture
  // as /book/badges. The page is also guarded server-side by requireDashboardAccess.
  useEffect(() => {
    if (onboardingHydrated && !onboarding.setupComplete) router.replace("/book");
  }, [onboardingHydrated, onboarding.setupComplete, router]);

  useEffect(() => {
    fetchBookJson<JourneysResponse>("/app/api/book/books/journeys")
      .then((data) => setJourneys(data.journeys))
      .catch((err) => setError(err?.message ?? "Failed to load journeys"))
      .finally(() => setLoading(false));
  }, []);

  if (!onboardingHydrated || !onboarding.setupComplete) {
    return (
      <main className="cf-app-shell">
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
        <section className="mx-auto w-full max-w-450 animate-pulse px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
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
        activeTab="journeys"
        searchQuery=""
        onSearchChange={() => {}}
        searchInputRef={searchRef}
        showSearch={false}
        logoVariant="dashboard"
      />

      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16">
        <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1)">
          Learning Journeys
        </h1>
        <p className="mt-1 text-sm text-(--cf-text-3)">
          Curated book sequences to master a topic
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
                <div key={i} className="h-48 rounded-3xl bg-(--cf-surface-muted)" />
              ))}
            </div>
          ) : journeys.length === 0 ? (
            <div className="cf-panel rounded-3xl p-8 text-center">
              <Map className="mx-auto h-8 w-8 text-(--cf-text-3)" />
              <p className="mt-3 text-sm text-(--cf-text-3)">
                Learning journeys coming soon
              </p>
            </div>
          ) : (
            journeys.map((journey) => {
              const isActive = journey.progress && !journey.progress.completedAt;
              const isComplete = journey.progress?.completedAt;
              const completedCount = journey.progress?.completedBookIds.length ?? 0;
              const totalBooks = journey.books.length;
              const hasProgress = !!journey.progress;

              return (
                <Link
                  key={journey.journeyId}
                  href={`/book/journeys/${journey.journeyId}`}
                  className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border)"
                >
                  <div
                    className="cf-panel overflow-hidden rounded-3xl border border-(--cf-border) transition group-hover:border-(--cf-accent-border)"
                    style={{
                      background: `linear-gradient(135deg, ${journey.coverGradient[0]}22, var(--cf-surface))`,
                    }}
                  >
                    <div className="p-6">
                      <div className="flex items-center gap-2">
                        <Map className="h-4 w-4 text-(--cf-accent)" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-(--cf-accent)">
                          {journey.category}
                        </span>
                        {isComplete && (
                          <CheckCircle className="ml-auto h-4 w-4 text-(--cf-success-text)" />
                        )}
                      </div>
                      <h2 className="mt-2 text-xl font-semibold text-(--cf-text-1)">
                        {journey.title}
                      </h2>
                      <p className="mt-1 text-sm text-(--cf-text-2)">
                        {journey.description}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-(--cf-text-3)">
                        <span>{totalBooks} books</span>
                        <span>~{journey.estimatedWeeks} weeks</span>
                        <span>{journey.bonusIP} IP bonus</span>
                      </div>

                      {isActive && (
                        <div className="mt-4">
                          <div className="h-2 rounded-full bg-(--cf-surface-muted)">
                            <div
                              className="h-2 rounded-full bg-(--cf-accent)"
                              style={{ width: totalBooks > 0 ? `${(completedCount / totalBooks) * 100}%` : "0%" }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-(--cf-text-3)">
                            {completedCount} of {totalBooks} books completed
                          </p>
                        </div>
                      )}

                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-(--cf-accent)">
                        {isComplete
                          ? "View journey"
                          : hasProgress
                            ? "Continue journey"
                            : "Explore journey"}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
