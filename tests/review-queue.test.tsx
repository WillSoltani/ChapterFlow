import "./_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "./_lib/route-harness";

// PROG-19 / DATA-13: a failed load is an error (never "all caught up"), a
// failed rating keeps the card, and retry loads again.

function makeCard(id: string) {
  return {
    userId: "u", cardId: id, bookId: "atomic-habits", chapterNumber: 1, stability: 1, difficulty: 5,
    elapsedDays: 1, scheduledDays: 1, reps: 1, lapses: 0, state: "review",
    dueAt: "2026-11-12T08:00:00.000Z", lastReviewAt: "2026-11-11T08:00:00.000Z",
    front: `Front ${id}`, back: `Back ${id}`, createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-11T08:00:00.000Z", retrievability: 0.8,
  };
}

let failLoads = 0;
const cachedCalls: Array<{ url: string; force: boolean }> = [];
const fetchBookJsonCached = makeSpy(async (url: string, _init?: unknown, opts?: { forceRevalidate?: boolean }) => {
  cachedCalls.push({ url, force: opts?.forceRevalidate === true });
  if (url.includes("mode=stats")) {
    return { stats: { totalCards: 2, dueCards: 2, avgRetrievability: 0.8, bookIds: [] } };
  }
  if (failLoads > 0) {
    failLoads -= 1;
    throw new Error("Network down");
  }
  return { cards: [makeCard("c1"), makeCard("c2")], count: 2, hasMore: false };
});

let failRatings = 0;
const fetchBookJson = makeSpy(async (_url: string, _init?: unknown) => {
  if (failRatings > 0) {
    failRatings -= 1;
    throw new Error("Server error");
  }
  return { card: makeCard("rated") };
});

// Generous waits: the suite runs many files in parallel.
const WAIT = { timeout: 5000 };

const harness = installRouteHarness({
  "@/lib/client/book-api": { fetchBookJson },
  "@/lib/client/book-api-cache": { fetchBookJsonCached, invalidateBookCache: () => {} },
});

let useReviewQueue: typeof import("@/hooks/book/useReviewQueue").useReviewQueue;

before(async () => {
  ({ useReviewQueue } = await import("@/hooks/book/useReviewQueue"));
});

afterEach(() => {
  cleanup();
  failLoads = 0;
  failRatings = 0;
  cachedCalls.length = 0;
});

after(() => harness.restore());

test("a failed load sets error and is not a finished session", async () => {
  failLoads = 1;
  const view = renderHook(() => useReviewQueue());
  await waitFor(() => assert.equal(view.result.current.loading, false), WAIT);
  assert.ok(view.result.current.error, "error is set");
  assert.equal(view.result.current.isComplete, false);
});

test("retry loads the cards again, past the cache", async () => {
  failLoads = 1;
  const view = renderHook(() => useReviewQueue());
  await waitFor(() => assert.ok(view.result.current.error), WAIT);
  await act(async () => {
    await view.result.current.retry();
  });
  await waitFor(() => assert.equal(view.result.current.cards.length, 2), WAIT);
  assert.equal(view.result.current.error, null);
  const dueLoads = cachedCalls.filter((c) => !c.url.includes("mode=stats"));
  assert.equal(dueLoads.at(-1)?.force, true);
});

test("a failed rating keeps the card and says so; a later rating moves on", async () => {
  const view = renderHook(() => useReviewQueue());
  await waitFor(() => assert.equal(view.result.current.cards.length, 2), WAIT);
  failRatings = 1;
  await act(async () => {
    await view.result.current.submitRating(3);
  });
  assert.equal(view.result.current.currentIndex, 0);
  assert.equal(view.result.current.currentCard?.cardId, "c1");
  assert.ok(view.result.current.ratingError, "rating error is shown");
  await act(async () => {
    await view.result.current.submitRating(3);
  });
  assert.equal(view.result.current.currentIndex, 1);
  assert.equal(view.result.current.ratingError, null);
});
