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
let failLoad = false;
let failRating = false;
// "pages": a server with 5 due cards served 2 at a time; the due count drops as
// cards are rated, so a stale count would repeat on the second end screen.
let scenario: "default" | "pages" = "default";
let rated = 0;
const PAGED_DUE = 5;
const PAGED_SIZE = 2;
const fetchBookJsonCached = makeSpy(async (url: string, _init?: unknown, _opts?: unknown) => {
  if (failLoad && !url.includes("mode=stats")) throw new Error("offline");
  if (scenario === "pages") {
    const due = PAGED_DUE - rated;
    if (url.includes("mode=stats")) {
      return { stats: { totalCards: 60, dueCards: due, avgRetrievability: 0.8, bookIds: ["atomic-habits"] } };
    }
    const cards = Array.from({ length: Math.min(PAGED_SIZE, due) }, (_, i) =>
      makeCard(`c${rated + i + 1}`),
    );
    return { cards, count: cards.length, hasMore: due > PAGED_SIZE };
  }
  if (url.includes("mode=stats")) {
    return { stats: { totalCards: 60, dueCards: 3, avgRetrievability: 0.8, bookIds: ["atomic-habits"] } };
  }
  page += 1;
  return page === 1
    ? { cards: [makeCard("c1")], count: 1, hasMore: true }
    : { cards: [makeCard("c2")], count: 1, hasMore: false };
});
const fetchBookJson = makeSpy(async (_url: string, _init?: unknown) => {
  if (failRating) throw new Error("server error");
  rated += 1;
  return { card: makeCard("rated") };
});

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
  failLoad = false;
  failRating = false;
  scenario = "default";
  rated = 0;
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

test("PROG-08: after Keep going, the next end screen counts only the cards still due", async () => {
  scenario = "pages";
  const view = render(<ReviewSessionFSRS onClose={() => {}} />);
  await rateCurrentCard(view);
  await rateCurrentCard(view);
  fireEvent.click(await view.findByRole("button", { name: /3 more due · Keep going/ }));
  await view.findByText(/Front c3/);
  await rateCurrentCard(view);
  await rateCurrentCard(view);
  await view.findByRole("button", { name: /1 more due · Keep going/ });
  assert.equal(view.queryByRole("button", { name: /3 more due/ }), null);
});

test("DATA-13: a failed load shows an error with Retry, not All caught up", async () => {
  failLoad = true;
  const view = render(<ReviewSessionFSRS onClose={() => {}} />);
  await view.findByText(/couldn't load your review cards/);
  assert.equal(view.queryByText(/All caught up/), null);
  failLoad = false;
  fireEvent.click(view.getByRole("button", { name: "Retry" }));
  await view.findByText(/Front c1/);
});

test("DATA-13: a failed rating keeps the card and shows a message", async () => {
  const view = render(<ReviewSessionFSRS onClose={() => {}} />);
  failRating = true;
  await rateCurrentCard(view);
  await view.findByText(/rating didn't save/);
  assert.ok(await view.findByText(/Back c1/), "the same card stays, answer showing");
  assert.ok(view.getByRole("button", { name: /Good/ }), "it can be rated again");
});
