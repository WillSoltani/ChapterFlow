import { test } from "node:test";
import assert from "node:assert/strict";

import { resolvePinnedChapterCount } from "./book-completion-core";

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
