"use client";

// Canonical shared review-queue hook (WS3-001).

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import { fetchBookJsonCached, invalidateBookCache } from "@/lib/client/book-api-cache";
import type { FSRSCardState, FSRSRating } from "@/app/app/api/book/_lib/types";

const REVIEWS_KEY = "/app/api/book/me/reviews";
// The server's largest page; `hasMore` says whether more cards are due after it.
const SESSION_PAGE_SIZE = 50;

type CardWithRetrievability = FSRSCardState & { retrievability: number };

type DueResponse = {
  cards: CardWithRetrievability[];
  count: number;
  hasMore?: boolean;
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
  const [hasMore, setHasMore] = useState(false);

  const fetchDueCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (bookId) params.set("bookId", bookId);
      params.set("limit", String(SESSION_PAGE_SIZE));
      const { cards: dueCards, hasMore: more } = await fetchBookJsonCached<DueResponse>(
        `${REVIEWS_KEY}?${params.toString()}`
      );
      setCards(dueCards);
      setHasMore(more === true);
      setCurrentIndex(0);
    } catch {
      setCards([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const fetchStats = useCallback(async () => {
    try {
      const { stats: s } = await fetchBookJsonCached<StatsResponse>(
        `${REVIEWS_KEY}?mode=stats`
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
        // Prefix invalidation drops both the due key (any ?bookId= variant) and
        // the stats key so the next mount refetches fresh counts.
        invalidateBookCache(REVIEWS_KEY);
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
    hasMore,
    submitRating,
    refresh: fetchDueCards,
  };
}
