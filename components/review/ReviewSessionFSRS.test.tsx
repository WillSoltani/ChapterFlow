import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "../../tests/_lib/route-harness";

// PROG-08: the session asks for a larger page and, when the server says more
// cards are due, ends with "N more due · Keep going" instead of a dead end.

function makeCard(id: string) {
  return {
    userId: "u",
    cardId: id,
    bookId: "atomic-habits",
    chapterNumber: 1,
    stability: 1,
    difficulty: 5,
    elapsedDays: 1,
    scheduledDays: 1,
    reps: 1,
    lapses: 0,
    state: "review",
    dueAt: "2026-11-12T08:00:00.000Z",
    lastReviewAt: "2026-11-11T08:00:00.000Z",
    front: `Front ${id}`,
    back: `Back ${id}`,
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-11T08:00:00.000Z",
    retrievability: 0.8,
  };
}

let page = 0;
const fetchBookJsonCached = makeSpy(async (url: string) => {
  if (url.includes("mode=stats")) {
    return { stats: { totalCards: 60, dueCards: 3, avgRetrievability: 0.8, bookIds: ["atomic-habits"] } };
  }
  page += 1;
  return page === 1
    ? { cards: [makeCard("c1")], count: 1, hasMore: true }
    : { cards: [makeCard("c2")], count: 1, hasMore: false };
});
const fetchBookJson = makeSpy(async (_url: string, _init?: unknown) => ({ card: makeCard("rated") }));

const harness = installRouteHarness({
  "@/lib/client/book-api": { fetchBookJson },
  "@/lib/client/book-api-cache": {
    fetchBookJsonCached,
    invalidateBookCache: () => {},
  },
});

let ReviewSessionFSRS: typeof import("./ReviewSessionFSRS").ReviewSessionFSRS;

before(async () => {
  ({ ReviewSessionFSRS } = await import("./ReviewSessionFSRS"));
});

afterEach(() => {
  cleanup();
  page = 0;
  fetchBookJsonCached.calls.length = 0;
});

after(() => harness.restore());

async function rateCurrentCard(view: ReturnType<typeof render>) {
  fireEvent.click(await view.findByText(/Front c\d/));
  fireEvent.click(await view.findByRole("button", { name: /Good/ }));
}

test("PROG-08: the session asks for up to 50 due cards", async () => {
  const view = render(<ReviewSessionFSRS onClose={() => {}} />);
  await view.findByText(/Front c1/);
  const dueCall = fetchBookJsonCached.calls.find(([url]) => !url.includes("mode="));
  assert.ok(dueCall, "the due cards are requested");
  assert.match(dueCall[0], /[?&]limit=50\b/);
});

test("PROG-08: when more are due, the end screen offers Keep going and loads the next cards", async () => {
  const view = render(<ReviewSessionFSRS onClose={() => {}} />);
  await rateCurrentCard(view);
  const keepGoing = await view.findByRole("button", { name: /2 more due · Keep going/ });
  fireEvent.click(keepGoing);
  await view.findByText(/Front c2/);
  await rateCurrentCard(view);
  await waitFor(() => assert.ok(view.getByText(/Session Complete!/)));
  assert.equal(view.queryByRole("button", { name: /Keep going/ }), null);
});
