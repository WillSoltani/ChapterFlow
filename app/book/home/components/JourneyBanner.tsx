"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Map, ArrowRight } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { JourneyDefinition, BookUserJourneyItem } from "@/app/app/api/book/_lib/types";

type JourneyWithProgress = JourneyDefinition & { progress?: BookUserJourneyItem };
type JourneysResponse = { journeys: JourneyWithProgress[] };

function isDismissed(journeyId: string): boolean {
  try {
    return localStorage.getItem(`cf-journey-dismissed-${journeyId}`) === "1";
  } catch {
    return false;
  }
}

function persistDismiss(journeyId: string) {
  try {
    localStorage.setItem(`cf-journey-dismissed-${journeyId}`, "1");
  } catch {}
}

export function JourneyBanner({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [journey, setJourney] = useState<JourneyWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchBookJson<JourneysResponse>("/app/api/book/books/journeys")
      .then((data) => {
        const active = data.journeys.find(
          (j) => j.progress && !j.progress.completedAt,
        );
        if (!active) return;
        if (isDismissed(active.journeyId)) {
          setDismissed(true);
          return;
        }
        setJourney(active);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  if (loading || !journey || dismissed) return null;

  const completedCount = journey.progress?.completedBookIds.length ?? 0;
  const totalBooks = journey.books.length;
  const progressPercent = totalBooks > 0 ? (completedCount / totalBooks) * 100 : 0;

  return (
    <div
      className="cf-panel relative mb-5 overflow-hidden rounded-[22px] border border-(--cf-accent-border)"
      style={{
        background: `linear-gradient(135deg, ${journey.coverGradient[0]}18, var(--cf-surface))`,
      }}
    >
      <button
        type="button"
        onClick={() => {
          persistDismiss(journey.journeyId);
          setDismissed(true);
        }}
        className="absolute right-3 top-3 text-xs text-(--cf-text-3) hover:text-(--cf-text-1)"
        aria-label="Dismiss"
      >
        &times;
      </button>
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--cf-accent-soft)">
          <Map className="h-6 w-6 text-(--cf-accent)" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-(--cf-text-1)">
            {journey.title}
          </p>
          <p className="mt-0.5 text-xs text-(--cf-text-3)">
            {journey.description}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-(--cf-text-3)">
            <span>{completedCount} of {totalBooks} books done</span>
            <span>{journey.bonusIP} IP reward</span>
          </div>
          {/* Mini progress bar */}
          <div className="mt-2 h-1.5 w-full max-w-48 rounded-full bg-(--cf-surface-muted)">
            <div
              className="h-1.5 rounded-full bg-(--cf-accent)"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/book/journeys/${journey.journeyId}`)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-4 py-2 text-sm font-semibold text-white shadow transition hover:brightness-110"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
