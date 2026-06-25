import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPinnedChapterCountMap,
  isBookCompleted,
  resolvePinnedChapterCount,
} from "./book-completion-core";

test("uses the live manifest (no extra read) when the pin matches the live version", async () => {
  let pinnedReads = 0;
  const count = await resolvePinnedChapterCount({
    pinnedBookVersion: 2,
    liveVersion: 2,
    liveManifest: { chapterCount: 5 },
    readPinnedManifest: async () => {
      pinnedReads += 1;
      return { chapterCount: 7 };
    },
  });
  assert.equal(count, 5);
  assert.equal(pinnedReads, 0, "pinned manifest must not be read when versions match");
});

test("catalog grew (pin v1 cc=5, live v2 cc=7): judges against the PINNED count, not live", async () => {
  let pinnedReads = 0;
  const count = await resolvePinnedChapterCount({
    pinnedBookVersion: 1,
    liveVersion: 2,
    liveManifest: { chapterCount: 7 },
    readPinnedManifest: async () => {
      pinnedReads += 1;
      return { chapterCount: 5 };
    },
  });
  // A user who finished all 5 pinned chapters must be credited (5 >= 5),
  // even though the live catalog now has 7 chapters.
  assert.equal(count, 5);
  assert.equal(pinnedReads, 1, "pinned manifest must be read when versions diverge");
});

test("catalog shrank (pin v1 cc=5, live v2 cc=4): judges against the PINNED count, not live", async () => {
  const count = await resolvePinnedChapterCount({
    pinnedBookVersion: 1,
    liveVersion: 2,
    liveManifest: { chapterCount: 4 },
    readPinnedManifest: async () => ({ chapterCount: 5 }),
  });
  // Completing pinned chapter 4 must NOT falsely flag the book complete (4 < 5),
  // even though the live catalog shrank to 4 chapters.
  assert.equal(count, 5);
});

// --- isBookCompleted -------------------------------------------------------

test("isBookCompleted: A11 regression — a sequentially finished book is completed with the real count", () => {
  // A 3-chapter book read in order. buildProgressAfterQuizPass advances
  // currentChapterNumber past the last completed chapter (4 = 3 + 1), which is
  // exactly what broke the old count-free heuristic.
  const progress = { completedChapters: [1, 2, 3], currentChapterNumber: 4 };
  assert.equal(isBookCompleted(progress, 3), true);
});

test("isBookCompleted: A11 regression — without a count, a finished book is NOT crashed into 'incomplete' by guessing complete", () => {
  // The old fallback `completedChapters.length > 0 && currentChapterNumber <= length`
  // could never be true here (4 <= 3 is false). The new core returns false too,
  // but for the correct reason: completion is unknowable without a count. The fix
  // is that the route now SUPPLIES the count so this path isn't hit in practice.
  const finished = { completedChapters: [1, 2, 3], currentChapterNumber: 4 };
  assert.equal(isBookCompleted(finished, undefined), false);
});

test("isBookCompleted: NEVER reports an unfinished book as complete (no count)", () => {
  const midBook = { completedChapters: [1, 2], currentChapterNumber: 3 };
  assert.equal(isBookCompleted(midBook, undefined), false);
});

test("isBookCompleted: not complete when chapters remain (exact count)", () => {
  const midBook = { completedChapters: [1, 2], currentChapterNumber: 3 };
  assert.equal(isBookCompleted(midBook, 5), false);
});

test("isBookCompleted: out-of-order completion is exact (all 4 done, regardless of currentChapterNumber)", () => {
  const outOfOrder = { completedChapters: [4, 1, 3, 2], currentChapterNumber: 2 };
  assert.equal(isBookCompleted(outOfOrder, 4), true);
});

test("isBookCompleted: a never-started book (no completed chapters) is not complete", () => {
  const fresh = { completedChapters: [], currentChapterNumber: 1 };
  assert.equal(isBookCompleted(fresh, 3), false);
  assert.equal(isBookCompleted(fresh, undefined), false);
});

// --- buildPinnedChapterCountMap -------------------------------------------

test("buildPinnedChapterCountMap: maps each book to its pinned manifest's chapter count", async () => {
  const byKey: Record<string, number> = { "books/a/v1/manifest.json": 3, "books/b/v2/manifest.json": 7 };
  const map = await buildPinnedChapterCountMap({
    entries: [
      { bookId: "a", manifestKey: "books/a/v1/manifest.json" },
      { bookId: "b", manifestKey: "books/b/v2/manifest.json" },
    ],
    readManifestChapterCount: async (key) => byKey[key],
  });
  assert.equal(map.get("a"), 3);
  assert.equal(map.get("b"), 7);
});

test("buildPinnedChapterCountMap: de-dupes by manifestKey (one read per pinned manifest)", async () => {
  let reads = 0;
  const map = await buildPinnedChapterCountMap({
    entries: [
      { bookId: "a", manifestKey: "shared/manifest.json" },
      { bookId: "a", manifestKey: "shared/manifest.json" },
    ],
    readManifestChapterCount: async () => {
      reads += 1;
      return 4;
    },
  });
  assert.equal(reads, 1, "the shared manifest key must be read once");
  assert.equal(map.get("a"), 4);
});

test("buildPinnedChapterCountMap: a failing read omits only that book (others still mapped)", async () => {
  const map = await buildPinnedChapterCountMap({
    entries: [
      { bookId: "ok", manifestKey: "ok.json" },
      { bookId: "broken", manifestKey: "broken.json" },
    ],
    readManifestChapterCount: async (key) => {
      if (key === "broken.json") throw new Error("S3 down");
      return 5;
    },
  });
  assert.equal(map.get("ok"), 5);
  assert.equal(map.has("broken"), false, "a failed read must not appear in the map");
});

test("buildPinnedChapterCountMap: skips rows with no manifestKey and rejects non-positive counts", async () => {
  const map = await buildPinnedChapterCountMap({
    entries: [
      { bookId: "no-key", manifestKey: "" },
      { bookId: "zero", manifestKey: "zero.json" },
      { bookId: "nan", manifestKey: "nan.json" },
      { bookId: "good", manifestKey: "good.json" },
    ],
    readManifestChapterCount: async (key) => {
      if (key === "zero.json") return 0;
      if (key === "nan.json") return Number.NaN;
      return 6;
    },
  });
  assert.equal(map.has("no-key"), false);
  assert.equal(map.has("zero"), false);
  assert.equal(map.has("nan"), false);
  assert.equal(map.get("good"), 6);
});
