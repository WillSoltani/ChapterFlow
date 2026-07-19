"use client";

// Canonical shared review-queue hook (WS3-001).

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import type { FSRSCardState, FSRSRating } from "@/app/app/api/book/_lib/types";

type CardWithRetrievability = FSRSCardState & { retrievability: number };

type DueResponse = {
  cards: CardWithRetrievability[];
  count: number;
};

type ReviewResponse = {
  card: CardWithRetrievability;
};

type StatsResponse = {
  stats: {
    totalCards: number;
    dueCards: number;
    avgRetrievability: number;
    bookIds: string[];
  };
};

export function useReviewQueue(bookId?: string) {
  const [cards, setCards] = useState<CardWithRetrievability[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsResponse["stats"] | null>(null);

  const fetchDueCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (bookId) params.set("bookId", bookId);
      const { cards: dueCards } = await fetchBookJson<DueResponse>(
        `/app/api/book/me/reviews?${params.toString()}`
      );
      setCards(dueCards);
      setCurrentIndex(0);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const fetchStats = useCallback(async () => {
    try {
      const { stats: s } = await fetchBookJson<StatsResponse>(
        "/app/api/book/me/reviews?mode=stats"
      );
      setStats(s);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    fetchDueCards();
    fetchStats();
  }, [fetchDueCards, fetchStats]);

  const submittingRef = useRef(false);

  const submitRating = useCallback(
    async (rating: FSRSRating) => {
      if (submittingRef.current) return;
      const card = cards[currentIndex];
      if (!card) return;

      submittingRef.current = true;
      try {
        const { card: updated } = await fetchBookJson<ReviewResponse>(
          `/app/api/book/me/reviews/${encodeURIComponent(card.cardId)}`,
          {
            method: "POST",
            body: JSON.stringify({ rating }),
          }
        );

        setCards((prev) => {
          const next = [...prev];
          next[currentIndex] = updated;
          return next;
        });

        setCurrentIndex((i) => i + 1);
      } catch (err) {
        console.error("Failed to submit review:", err);
      } finally {
        submittingRef.current = false;
      }
    },
    [cards, currentIndex]
  );

  const currentCard = cards[currentIndex] ?? null;
  const isComplete = currentIndex >= cards.length;
  const remaining = Math.max(0, cards.length - currentIndex);

  return {
    cards,
    currentCard,
    currentIndex,
    isComplete,
    remaining,
    loading,
    stats,
    submitRating,
    refresh: fetchDueCards,
  };
}
