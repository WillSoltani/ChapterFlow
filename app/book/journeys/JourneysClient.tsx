"use client";

import { useEffect, useState } from "react";
import { Map, ArrowRight, CheckCircle } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { JourneyDefinition, BookUserJourneyItem } from "@/app/app/api/book/_lib/types";

type JourneysResponse = {
  journeys: (JourneyDefinition & { progress?: BookUserJourneyItem })[];
};

export function JourneysClient() {
  const [journeys, setJourneys] = useState<JourneysResponse["journeys"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookJson<JourneysResponse>("/app/api/book/books/journeys")
      .then((data) => setJourneys(data.journeys))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async (journeyId: string) => {
    try {
      await fetchBookJson(`/app/api/book/me/journeys/${journeyId}/start`, {
        method: "POST",
      });
      // Refresh
      const data = await fetchBookJson<JourneysResponse>("/app/api/book/books/journeys");
      setJourneys(data.journeys);
    } catch {}
  };

  return (
    <main className="cf-app-shell">
      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 lg:px-10 xl:px-16">
        <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1)">
          Learning Journeys
        </h1>
        <p className="mt-1 text-sm text-(--cf-text-3)">
          Curated book sequences to master a topic
        </p>

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

              return (
                <div
                  key={journey.journeyId}
                  className="cf-panel overflow-hidden rounded-3xl border border-(--cf-border)"
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
                            style={{ width: `${(completedCount / totalBooks) * 100}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-(--cf-text-3)">
                          {completedCount} of {totalBooks} books completed
                        </p>
                      </div>
                    )}

                    {!journey.progress && (
                      <button
                        type="button"
                        onClick={() => handleStart(journey.journeyId)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                      >
                        Start Journey <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
