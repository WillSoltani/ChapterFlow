"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ArrowRight, Clock } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { EventDefinition, EventParticipationItem } from "@/app/app/api/book/_lib/types";

type ActiveEventWithParticipation = EventDefinition & {
  participation?: EventParticipationItem;
};

type EventsResponse = { events: ActiveEventWithParticipation[] };

function isDismissed(eventId: string): boolean {
  try {
    return localStorage.getItem(`cf-event-dismissed-${eventId}`) === "1";
  } catch {
    return false;
  }
}

function persistDismiss(eventId: string) {
  try {
    localStorage.setItem(`cf-event-dismissed-${eventId}`, "1");
  } catch {}
}

export function EventBanner({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [event, setEvent] = useState<ActiveEventWithParticipation | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchBookJson<EventsResponse>("/app/api/book/events/active")
      .then((data) => {
        if (data.events.length > 0) {
          const sorted = data.events.sort(
            (a, b) =>
              new Date(a.endDate).getTime() - new Date(b.endDate).getTime(),
          );
          const top = sorted[0];

          if (isDismissed(top.eventId)) {
            setDismissed(true);
            return;
          }

          setEvent(top);
        }
      })
      .catch(() => {/* fetching events failed — banner just stays hidden */})
      .finally(() => setLoading(false));
  }, [enabled]);

  if (loading || !event || dismissed) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(event.endDate).getTime() - Date.now()) / 86400000),
  );

  const joined = !!event.participation;

  return (
    <div className="cf-panel relative mb-5 overflow-hidden rounded-[22px] border border-(--cf-accent-border) bg-[linear-gradient(135deg,var(--cf-accent-soft),var(--cf-surface))]">
      <button
        type="button"
        onClick={() => {
          persistDismiss(event.eventId);
          setDismissed(true);
        }}
        className="absolute right-3 top-3 text-xs text-(--cf-text-3) hover:text-(--cf-text-1)"
        aria-label="Dismiss"
      >
        &times;
      </button>
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--cf-accent-soft)">
          <Trophy className="h-6 w-6 text-(--cf-accent)" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-(--cf-text-1)">
            {event.title}
          </p>
          <p className="mt-0.5 text-xs text-(--cf-text-3)">
            {event.description}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-(--cf-text-3)">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
            </span>
            {joined ? (
              <span>
                {event.participation!.totalChaptersCompleted} chapter
                {event.participation!.totalChaptersCompleted !== 1 ? "s" : ""} done
              </span>
            ) : (
              <span>{event.bonusIP} IP reward</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/book/events")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-110"
        >
          {joined ? "Continue" : "Join"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
