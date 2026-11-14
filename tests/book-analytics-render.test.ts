import "./_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "./_lib/route-harness";

// PROG-07 / DATA-07: analytics render from the dashboard payload alone; no
// other request may hold them back.
const neverSettles = new Promise<never>(() => {});
const fetchBookJson = makeSpy(async (_url: string) => neverSettles);

const emptyPayload = {
  catalog: [] as unknown[],
  progress: [],
  bookStates: [],
  chapterStates: [],
  readingDays: [],
  badgeAwards: [],
  settings: null,
};
let payload: Record<string, unknown> = emptyPayload;

const harness = installRouteHarness({
  "@/lib/client/book-api": { fetchBookJson },
  "@/hooks/book/useDashboardQuery": {
    useDashboardQuery: () => ({ data: payload, error: undefined, refetch: () => {} }),
  },
});

let useBookAnalytics: typeof import("@/hooks/book/useBookAnalytics").useBookAnalytics;

before(async () => {
  ({ useBookAnalytics } = await import("@/hooks/book/useBookAnalytics"));
});

afterEach(() => {
  cleanup();
  payload = emptyPayload;
});

after(() => {
  harness.restore();
});

test("analytics are set as soon as the dashboard payload is available", async () => {
  const view = renderHook(() => useBookAnalytics([], 10));
  await waitFor(() => assert.notEqual(view.result.current.analytics, null), { timeout: 500 });
  assert.equal(view.result.current.hydrated, true);
  assert.equal(fetchBookJson.calls.length, 0);
});

const EPOCH = "1970-01-01T00:00:00.000Z";
const RECENT = "2026-11-12T09:00:00.000Z";

function catalogBook(id: string, chapterCount: number) {
  return {
    id, title: id, author: "Author", icon: "B", category: "Psychology", categories: ["Psychology"],
    difficulty: "Beginner", estimatedMinutes: 120, chapterCount, synopsis: "", tags: [],
    variantFamily: "EMH", publishedVersion: 1,
  };
}

function bookStateRow(bookId: string, extra: Record<string, unknown> = {}) {
  return {
    userId: "u", bookId, currentChapterId: `${bookId}-ch01`, completedChapterIds: [],
    unlockedChapterIds: [`${bookId}-ch01`], chapterScores: {}, chapterCompletedAt: {},
    lastReadChapterId: `${bookId}-ch01`, lastOpenedAt: EPOCH, createdAt: RECENT, updatedAt: RECENT,
    ...extra,
  };
}

async function snapshotsFor(next: Record<string, unknown>) {
  payload = { ...emptyPayload, ...next };
  const view = renderHook(() => useBookAnalytics([], 10));
  await waitFor(() => assert.notEqual(view.result.current.analytics, null), { timeout: 500 });
  return view.result.current.analytics!;
}

test("PROG-17 / D3: a book only viewed on its book page is not started and never says Browsed", async () => {
  const analytics = await snapshotsFor({
    catalog: [catalogBook("thinking-fast-and-slow", 38)],
    bookStates: [bookStateRow("thinking-fast-and-slow")],
  });
  const snap = analytics.bookSnapshots[0]!;
  assert.equal(snap.status, "not_started");
  assert.notEqual(snap.lastOpenedLabel, "Browsed");
  assert.equal(analytics.engagedBookSnapshots.length, 0);
  assert.equal(analytics.recentlyOpenedSnapshots.length, 0);
});

test("D3 (C5): a progress row with nothing completed is started and resumes chapter 1", async () => {
  const analytics = await snapshotsFor({
    catalog: [catalogBook("atomic-habits", 20)],
    progress: [{ bookId: "atomic-habits", currentChapterNumber: 1, completedChapters: [], bestScoreByChapter: {}, lastActiveAt: RECENT }],
  });
  const snap = analytics.bookSnapshots[0]!;
  assert.equal(snap.status, "in_progress");
  assert.equal(snap.resumeChapterNumber, 1);
  assert.equal(snap.resumeChapterLabel, "CH.01 The Surprising Power of Atomic Habits");
  assert.notEqual(snap.lastOpenedLabel, "Browsed");
  assert.deepEqual(analytics.engagedBookSnapshots.map((s) => s.book.id), ["atomic-habits"]);
});

test("D3 (C5): a chapter-state row alone also counts as started", async () => {
  const analytics = await snapshotsFor({
    catalog: [catalogBook("atomic-habits", 20)],
    chapterStates: [{ bookId: "atomic-habits", chapterNumber: 1, chapterId: "atomic-habits-ch01", state: {} }],
  });
  assert.equal(analytics.bookSnapshots[0]!.status, "in_progress");
  assert.equal(analytics.engagedBookSnapshots.length, 1);
});

test("HOME-15 / C13: total chapters come from the catalog and Continue names the server's current chapter", async () => {
  const analytics = await snapshotsFor({
    catalog: [catalogBook("atomic-habits", 22)],
    progress: [{ bookId: "atomic-habits", currentChapterNumber: 4, completedChapters: [1, 2, 3], bestScoreByChapter: {}, lastActiveAt: RECENT }],
    bookStates: [bookStateRow("atomic-habits", { completedChapterIds: ["atomic-habits-ch01", "atomic-habits-ch02", "atomic-habits-ch03"], lastReadChapterId: "atomic-habits-ch04", lastOpenedAt: RECENT })],
  });
  const snap = analytics.bookSnapshots[0]!;
  assert.equal(snap.totalChapters, 22);
  assert.equal(snap.completedChapters, 3);
  assert.equal(snap.resumeChapterNumber, 4);
  assert.match(snap.resumeChapterLabel, /^CH\.04 /);
});

test("a quiz passed without Finish chapter: the stored book state lags, counts and the resume chapter follow the progress row", async () => {
  // The book state was written when chapter 1 opened; the pass only moved the
  // progress row. Home, Progress and Profile must agree with the Library.
  const analytics = await snapshotsFor({
    catalog: [catalogBook("atomic-habits", 20)],
    progress: [{ bookId: "atomic-habits", currentChapterNumber: 2, completedChapters: [1], bestScoreByChapter: { "1": 100 }, lastActiveAt: RECENT }],
    bookStates: [bookStateRow("atomic-habits", { lastOpenedAt: RECENT })],
  });
  const snap = analytics.bookSnapshots[0]!;
  assert.equal(snap.completedChapters, 1);
  assert.equal(snap.progressPercent, 5);
  assert.equal(snap.status, "in_progress");
  assert.equal(snap.resumeChapterNumber, 2);
  assert.equal(snap.resumeChapterId, "atomic-habits-ch02", "the id names the same chapter as the number");
  assert.equal(analytics.totalCompletedChapters, 1);
});

test("a book finished without Finish chapter on the last quiz counts as completed", async () => {
  const analytics = await snapshotsFor({
    catalog: [catalogBook("atomic-habits", 20)],
    progress: [{ bookId: "atomic-habits", currentChapterNumber: 20, completedChapters: Array.from({ length: 20 }, (_, i) => i + 1), bestScoreByChapter: {}, lastActiveAt: RECENT }],
    bookStates: [bookStateRow("atomic-habits", {
      completedChapterIds: Array.from({ length: 19 }, (_, i) => `atomic-habits-ch${String(i + 1).padStart(2, "0")}`),
      currentChapterId: "atomic-habits-ch20",
      lastOpenedAt: RECENT,
    })],
  });
  const snap = analytics.bookSnapshots[0]!;
  assert.equal(snap.completedChapters, 20);
  assert.equal(snap.status, "completed");
  assert.equal(analytics.booksCompleted, 1);
});

test("PROG-26: analytics carry readingHistoryOff from settings.privacy", async () => {
  const off = await snapshotsFor({ settings: { privacy: { saveReadingHistory: false } } });
  assert.equal(off.readingHistoryOff, true);
  cleanup();
  const on = await snapshotsFor({ settings: { privacy: { saveReadingHistory: true } } });
  assert.equal(on.readingHistoryOff, false);
});
