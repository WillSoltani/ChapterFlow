import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyBookProgressFloor,
  type PersistedBookProgress,
} from "@/app/book/library/hooks/useBookProgress";

const chapters = ["ch01", "ch02", "ch03", "ch04"].map((id) => ({ id }));

function progress(overrides: Partial<PersistedBookProgress> = {}): PersistedBookProgress {
  return {
    currentChapterId: "ch01",
    completedChapterIds: [],
    unlockedChapterIds: ["ch01"],
    chapterScores: {},
    chapterCompletedAt: {},
    lastReadChapterId: "ch01",
    lastOpenedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

test("an attested server snapshot is a floor local storage cannot reduce", () => {
  assert.deepEqual(
    applyBookProgressFloor(
      progress(),
      {
        currentChapterId: "ch02",
        completedChapterIds: ["ch01"],
        unlockedChapterIds: ["ch01", "ch02", "ch03"],
      },
      chapters,
    ),
    progress({
      currentChapterId: "ch02",
      completedChapterIds: ["ch01"],
      unlockedChapterIds: ["ch01", "ch02", "ch03"],
      lastReadChapterId: "ch02",
    }),
  );
});

test("the server floor preserves genuinely newer local progress", () => {
  const local = progress({
    currentChapterId: "ch04",
    completedChapterIds: ["ch01", "ch02", "ch03"],
    unlockedChapterIds: ["ch01", "ch02", "ch03", "ch04"],
    lastReadChapterId: "ch04",
  });
  assert.deepEqual(
    applyBookProgressFloor(
      local,
      {
        currentChapterId: "ch02",
        completedChapterIds: ["ch01"],
        unlockedChapterIds: ["ch01", "ch02"],
      },
      chapters,
    ),
    local,
  );
});
