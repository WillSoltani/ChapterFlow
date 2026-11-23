"use client";

// Canonical shared review-queue hook (WS3-001).

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBookJson } from "@/lib/client/book-api";
import { fetchBookJsonCached, invalidateBookCache } from "@/lib/client/book-api-cache";
import type { FSRSCardState, FSRSRating } from "@/app/app/api/book/_lib/types";

const REVIEWS_KEY = "/app/api/book/me/reviews";
// The server's largest page; `hasMore` says whether more cards are due after it.
const SESSION_PAGE_SIZE = 50;
const LOAD_ERROR = "We couldn't load your review cards.";
const RATING_ERROR = "That rating didn't save. Check your connection and try again.";

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
  // Load failure (never shown as "all caught up") and the last failed rating.
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const fetchDueCards = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (bookId) params.set("bookId", bookId);
      params.set("limit", String(SESSION_PAGE_SIZE));
      const { cards: dueCards, hasMore: more } = await fetchBookJsonCached<DueResponse>(
        `${REVIEWS_KEY}?${params.toString()}`,
        undefined,
        force ? { forceRevalidate: true } : undefined
      );
      setCards(dueCards);
      setHasMore(more === true);
      setCurrentIndex(0);
      setError(null);
      setRatingError(null);
    } catch {
      setCards([]);
      setHasMore(false);
      setError(LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  const fetchStats = useCallback(async (force = false) => {
    try {
      const { stats: s } = await fetchBookJsonCached<StatsResponse>(
        `${REVIEWS_KEY}?mode=stats`,
        undefined,
        force ? { forceRevalidate: true } : undefined
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
    async (rating: FSRSRating): Promise<boolean> => {
      if (submittingRef.current) return false;
      const card = cards[currentIndex];
      if (!card) return false;

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
        setRatingError(null);
        // Prefix invalidation drops both the due key (any ?bookId= variant) and
        // the stats key so the next mount refetches fresh counts.
        invalidateBookCache(REVIEWS_KEY);
        return true;
      } catch (err) {
        // Keep the card on screen so the reader can rate it again.
        console.error("Failed to submit review:", err);
        setRatingError(RATING_ERROR);
        return false;
      } finally {
        submittingRef.current = false;
      }
    },
    [cards, currentIndex]
  );

  const retry = useCallback(() => fetchDueCards(true), [fetchDueCards]);
  // "Keep going": re-read the due count too, so the next end screen's
  // "N more due" counts only the cards still waiting after this page.
  const refresh = useCallback(
    () => Promise.all([fetchDueCards(), fetchStats(true)]).then(() => undefined),
    [fetchDueCards, fetchStats]
  );

  const currentCard = cards[currentIndex] ?? null;
  const isComplete = error === null && currentIndex >= cards.length;
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
    refresh,
    error,
    ratingError,
    retry,
  };
}
