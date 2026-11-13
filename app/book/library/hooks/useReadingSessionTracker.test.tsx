import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "@/tests/_lib/route-harness";

// API-04: each reading-session POST carries the reader's local calendar day.
let postReply: unknown = {};
const fetchBookJson = makeSpy(async (_url: string, _init?: { body?: string }) => postReply);

const harness = installRouteHarness({
  "@/app/book/_lib/book-api": { fetchBookJson },
});

let useReadingSessionTracker: typeof import("./useReadingSessionTracker").useReadingSessionTracker;

before(async () => {
  ({ useReadingSessionTracker } = await import("./useReadingSessionTracker"));
});

afterEach(() => {
  cleanup();
  postReply = {};
  fetchBookJson.calls.length = 0;
  window.localStorage.clear();
});

after(() => {
  harness.restore();
});

test("a flushed session sends localDay as the reader's local YYYY-MM-DD", async () => {
  const view = renderHook(() =>
    useReadingSessionTracker({ bookId: "book-1", chapterId: "book-1-ch01" })
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
  view.unmount(); // cleanup flushes the elapsed time

  assert.equal(fetchBookJson.calls.length, 1);
  const body = JSON.parse(fetchBookJson.calls[0]?.[1]?.body ?? "{}") as {
    occurredAt?: string;
    localDay?: string;
  };
  const occurred = new Date(body.occurredAt ?? "");
  const expected = `${occurred.getFullYear()}-${String(occurred.getMonth() + 1).padStart(2, "0")}-${String(occurred.getDate()).padStart(2, "0")}`;
  assert.equal(body.localDay, expected);
});

const CELEBRATED_KEY = "book-accelerator:daily-goal-celebrated:v1";

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("READER-17: the goal counts today's minutes from every chapter and device (server total)", async () => {
  postReply = { readingDay: localDayKey(), trackedMinutesToday: 25 };
  const view = renderHook(() =>
    useReadingSessionTracker({ bookId: "book-1", chapterId: "book-1-ch02", dailyGoalMinutes: 20 })
  );
  await waitFor(() => assert.equal(view.result.current.hydrated, true));
  assert.equal(view.result.current.dailyGoalReached, false);
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  assert.equal(fetchBookJson.calls.length, 1);
  assert.equal(view.result.current.dailyGoalReached, true);
});

test("READER-17: a server total from another day does not count toward today", async () => {
  postReply = { readingDay: "2000-01-01", trackedMinutesToday: 99 };
  const view = renderHook(() =>
    useReadingSessionTracker({ bookId: "book-1", chapterId: "book-1-ch02", dailyGoalMinutes: 20 })
  );
  await waitFor(() => assert.equal(view.result.current.hydrated, true));
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  assert.equal(view.result.current.dailyGoalReached, false);
});

test("READER-17: the goal message is claimed once per day, also across chapters", async () => {
  const first = renderHook(() =>
    useReadingSessionTracker({ bookId: "book-1", chapterId: "book-1-ch01", dailyGoalMinutes: 20 })
  );
  assert.equal(first.result.current.claimDailyGoalCelebration(), true);
  assert.equal(window.localStorage.getItem(CELEBRATED_KEY), localDayKey());
  assert.equal(first.result.current.claimDailyGoalCelebration(), false);
  first.unmount();
  const second = renderHook(() =>
    useReadingSessionTracker({ bookId: "book-2", chapterId: "book-2-ch04", dailyGoalMinutes: 20 })
  );
  assert.equal(second.result.current.claimDailyGoalCelebration(), false);
  window.localStorage.setItem(CELEBRATED_KEY, "2000-01-01");
  assert.equal(second.result.current.claimDailyGoalCelebration(), true);
});
