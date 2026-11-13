import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { installRouteHarness, makeSpy } from "@/tests/_lib/route-harness";

// HOME-01 / DATA-12: viewing a book must not write progress. Only the setters
// (a chapter opened, completed or made current) may PATCH the book state.
const fetchBookJson = makeSpy(async (_url: string, _init?: { method?: string; body?: string }) => ({}));
const serverState = {
  currentChapterId: "ch02",
  completedChapterIds: ["ch01"],
  unlockedChapterIds: ["ch01", "ch02"],
  chapterScores: { ch01: 90 },
  chapterCompletedAt: { ch01: "2026-11-01T10:00:00.000Z" },
  lastReadChapterId: "ch02",
  lastOpenedAt: "2026-11-01T10:00:00.000Z",
};
type StatePayload = { state: typeof serverState };
const defaultGet = async (_url: string): Promise<StatePayload> => ({ state: serverState });
let getImpl = defaultGet;
const fetchBookJsonCached = makeSpy((url: string) => getImpl(url));

const harness = installRouteHarness({
  "@/app/book/_lib/book-api": { fetchBookJson },
  "@/lib/client/book-api-cache": {
    fetchBookJsonCached,
    invalidateBookCache: () => {},
  },
});

let useBookProgress: typeof import("./useBookProgress").useBookProgress;

before(async () => {
  ({ useBookProgress } = await import("./useBookProgress"));
});

beforeEach(() => {
  getImpl = defaultGet;
  fetchBookJson.calls.length = 0;
  fetchBookJsonCached.calls.length = 0;
  window.localStorage.clear();
});

afterEach(cleanup);

after(() => {
  harness.restore();
});

const chapters = ["ch01", "ch02", "ch03"].map((id) => ({ id }));

// Several short act() scopes: React flushes the state set by the resolved GET
// when a scope ends, and the debounced PATCH timer starts only after that.
async function settle() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  }
}

function patches() {
  return fetchBookJson.calls.filter(([, init]) => init?.method === "PATCH");
}

test("mounting the hook and merging the server copy sends no PATCH", async () => {
  const view = renderHook(() => useBookProgress("book-1", chapters));
  await settle();
  assert.equal(fetchBookJsonCached.calls.length, 1);
  assert.equal(view.result.current.progress.currentChapterId, "ch02");
  assert.equal(patches().length, 0);
});

test("setLastReadChapter sends exactly one PATCH", async () => {
  const view = renderHook(() => useBookProgress("book-1", chapters));
  await settle();
  assert.equal(patches().length, 0);
  act(() => {
    view.result.current.setLastReadChapter("ch02");
  });
  await settle();
  assert.equal(patches().length, 1);
  const body = JSON.parse(patches()[0]?.[1]?.body ?? "{}") as {
    state?: { lastReadChapterId?: string; completedChapterIds?: string[] };
  };
  assert.equal(body.state?.lastReadChapterId, "ch02");
  assert.deepEqual(body.state?.completedChapterIds, ["ch01"]);
});

test("serverReady is false after local hydration and true once the server copy is merged (C6)", async () => {
  let release: (value: StatePayload) => void = () => {};
  getImpl = () =>
    new Promise<StatePayload>((resolve) => {
      release = resolve;
    });
  const view = renderHook(() => useBookProgress("book-1", chapters));
  await settle();
  assert.equal(view.result.current.hydrated, true);
  assert.equal(view.result.current.serverReady, false);
  assert.equal(view.result.current.progress.currentChapterId, "ch01");

  await act(async () => {
    release({ state: serverState });
  });
  await settle();
  assert.equal(view.result.current.serverReady, true);
  assert.equal(view.result.current.progress.currentChapterId, "ch02");
  assert.equal(patches().length, 0);
});

test("a failed server read still ends the wait (serverReady true, no PATCH)", async () => {
  getImpl = async () => {
    throw new Error("offline");
  };
  const view = renderHook(() => useBookProgress("book-1", chapters));
  await settle();
  assert.equal(view.result.current.serverReady, true);
  assert.equal(patches().length, 0);
});
