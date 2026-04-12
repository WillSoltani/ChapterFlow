"use client";

import { useEffect, useState } from "react";
import { Calendar, Users, ArrowRight, Trophy } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { EventDefinition } from "@/app/app/api/book/_lib/types";

type EventsResponse = { events: EventDefinition[] };

export function EventsClient() {
  const [events, setEvents] = useState<EventDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookJson<EventsResponse>("/app/api/book/events/active")
      .then((data) => setEvents(data.events))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async (eventId: string) => {
    try {
      await fetchBookJson(`/app/api/book/me/events/${eventId}/join`, {
        method: "POST",
      });
    } catch {}
  };

  return (
    <main className="cf-app-shell">
      <section className="mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 lg:px-10 xl:px-16">
        <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1)">
          Reading Events
        </h1>
        <p className="mt-1 text-sm text-(--cf-text-3)">
          Time-limited reading challenges with exclusive rewards
        </p>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-48 rounded-3xl bg-(--cf-surface-muted)" />
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
              const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));

              return (
                <div
                  key={event.eventId}
                  className="cf-panel overflow-hidden rounded-3xl border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface))]"
                >
                  <div className="p-6">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-(--cf-accent)" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-(--cf-accent)">
                        {daysLeft} days left
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
                      <span>{event.dailyChapterTarget} chapter{event.dailyChapterTarget !== 1 ? "s" : ""}/day</span>
                      <span>{event.bonusIP} IP reward</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoin(event.eventId)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Join Event <ArrowRight className="h-4 w-4" />
                    </button>
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
