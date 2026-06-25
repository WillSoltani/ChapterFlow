import { test } from "node:test";
import assert from "node:assert/strict";

import { resolvePinnedManifestChapters } from "./pinned-manifest-core";
import type { BookManifestChapter } from "./types";

function chapter(number: number, chapterId: string): BookManifestChapter {
  return {
    number,
    chapterId,
    title: `Chapter ${number}`,
    readingTimeMinutes: 5,
    chapterKey: `k/${number}.json`,
    quizKey: `q/${number}.json`,
  };
}

test("uses the live manifest (no extra read) when the pin matches the live version", async () => {
  let pinnedReads = 0;
  const live = [chapter(1, "v2-a"), chapter(2, "v2-b")];
  const chapters = await resolvePinnedManifestChapters({
    pinnedBookVersion: 2,
    liveVersion: 2,
    liveManifest: { chapters: live },
    readPinnedManifest: async () => {
      pinnedReads += 1;
      return { chapters: [chapter(1, "v3-a")] };
    },
  });
  assert.deepEqual(chapters, live);
  assert.equal(pinnedReads, 0, "pinned manifest must not be read when versions match");
});

test("no progress (pin=null): falls back to the live manifest without an extra read", async () => {
  let pinnedReads = 0;
  const live = [chapter(1, "v5-a")];
  const chapters = await resolvePinnedManifestChapters({
    pinnedBookVersion: null,
    liveVersion: 5,
    liveManifest: { chapters: live },
    readPinnedManifest: async () => {
      pinnedReads += 1;
      return { chapters: [] };
    },
  });
  assert.deepEqual(chapters, live);
  assert.equal(pinnedReads, 0, "never-started reader has no pin to read");
});

test("pin diverges from live (republish reordered chapterIds): maps through the PINNED chapter list", async () => {
  // Reader is pinned to v1, where number 2 → "old-2". The catalog has since
  // republished to v2 where number 2 → "new-2". The state routes turn progress
  // NUMBERS into chapterIds; they must use the pinned ids, or a reader's
  // unlocked/completed chapter 2 silently points at the wrong content.
  let pinnedReads = 0;
  const pinned = [chapter(1, "old-1"), chapter(2, "old-2")];
  const chapters = await resolvePinnedManifestChapters({
    pinnedBookVersion: 1,
    liveVersion: 2,
    liveManifest: { chapters: [chapter(1, "new-1"), chapter(2, "new-2")] },
    readPinnedManifest: async () => {
      pinnedReads += 1;
      return { chapters: pinned };
    },
  });
  assert.deepEqual(chapters, pinned);
  const byNumber = new Map(chapters.map((c) => [c.number, c.chapterId]));
  assert.equal(byNumber.get(2), "old-2", "must resolve chapter 2 to the PINNED id, not the live one");
  assert.equal(pinnedReads, 1, "pinned manifest must be read when versions diverge");
});
