import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planProgressVersionUpgrade,
  type UpgradeManifestLike,
  type UpgradeProgressInput,
} from "./version-upgrade-core";

// Build a manifest from an ordered list of chapterIds (number = index + 1).
const manifest = (ids: string[]): UpgradeManifestLike => ({
  chapters: ids.map((chapterId, index) => ({ chapterId, number: index + 1 })),
});

const progress = (over: Partial<UpgradeProgressInput> = {}): UpgradeProgressInput => ({
  pinnedBookVersion: 1,
  unlockedThroughChapterNumber: 3,
  currentChapterNumber: 3,
  completedChapters: [1, 2],
  bestScoreByChapter: { "1": 100, "2": 80 },
  ...over,
});

const plan = (oldIds: string[], newIds: string[], over: Partial<UpgradeProgressInput> = {}) =>
  planProgressVersionUpgrade({
    newVersion: 2,
    newContentPrefix: "books/x/v2",
    newManifestKey: "books/x/v2/manifest.json",
    oldManifest: manifest(oldIds),
    newManifest: manifest(newIds),
    progress: progress(over),
  });

test("content correction (identical structure) → upgrade, progress unchanged", () => {
  const result = plan(["a", "b", "c", "d"], ["a", "b", "c", "d"]);
  assert.ok(result, "expected an upgrade plan");
  assert.equal(result.pinnedBookVersion, 2);
  assert.equal(result.contentPrefix, "books/x/v2");
  assert.equal(result.manifestKey, "books/x/v2/manifest.json");
  // Stored progress is preserved exactly (prefix identity ⇒ identity remap).
  assert.equal(result.unlockedThroughChapterNumber, 3);
  assert.equal(result.currentChapterNumber, 3);
  assert.deepEqual(result.completedChapters, [1, 2]);
  assert.deepEqual(result.bestScoreByChapter, { "1": 100, "2": 80 });
});

test("no upgrade when the new version is not newer", () => {
  assert.equal(
    planProgressVersionUpgrade({
      newVersion: 1,
      newContentPrefix: "books/x/v1",
      newManifestKey: "books/x/v1/manifest.json",
      oldManifest: manifest(["a", "b", "c"]),
      newManifest: manifest(["a", "b", "c"]),
      progress: progress({ pinnedBookVersion: 1 }),
    }),
    null
  );
});

test("no upgrade when the target prefix or manifest key is empty", () => {
  assert.equal(
    planProgressVersionUpgrade({
      newVersion: 2,
      newContentPrefix: "",
      newManifestKey: "books/x/v2/manifest.json",
      oldManifest: manifest(["a", "b", "c"]),
      newManifest: manifest(["a", "b", "c"]),
      progress: progress(),
    }),
    null
  );
  assert.equal(
    planProgressVersionUpgrade({
      newVersion: 2,
      newContentPrefix: "books/x/v2",
      newManifestKey: "",
      oldManifest: manifest(["a", "b", "c"]),
      newManifest: manifest(["a", "b", "c"]),
      progress: progress(),
    }),
    null
  );
});

test("append a chapter ABOVE the unlocked region → safe upgrade", () => {
  // Reader unlocked 1..3 (a,b,c); v2 adds 'e' at the end.
  const result = plan(["a", "b", "c", "d"], ["a", "b", "c", "d", "e"]);
  assert.ok(result, "appending beyond the unlocked region is safe");
  assert.equal(result.unlockedThroughChapterNumber, 3);
});

test("remove a chapter ABOVE the unlocked region → safe upgrade", () => {
  // Reader unlocked 1..3 (a,b,c); v2 drops 'd' (which they had not unlocked).
  const result = plan(["a", "b", "c", "d"], ["a", "b", "c"]);
  assert.ok(result, "removing a not-yet-unlocked chapter is safe");
  assert.deepEqual(result.completedChapters, [1, 2]);
});

test("reorder WITHIN the unlocked region → keep pin (no upgrade)", () => {
  // a,b,c all unlocked; v2 swaps b and c → b's number changes under the reader.
  assert.equal(plan(["a", "b", "c", "d"], ["a", "c", "b", "d"]), null);
});

test("insert BEFORE the unlocked region → keep pin (don't renumber a live reader)", () => {
  // v2 inserts 'z' at position 1 → a,b,c all shift up under the reader.
  assert.equal(plan(["a", "b", "c"], ["z", "a", "b", "c"]), null);
});

test("delete an already-unlocked chapter → keep pin (would lose access)", () => {
  // 'b' was unlocked (number 2) but is gone in v2.
  assert.equal(plan(["a", "b", "c"], ["a", "c"]), null);
});

test("new version has fewer chapters than the unlocked depth → keep pin", () => {
  // Reader unlocked through 3 but v2 only has 2 chapters.
  assert.equal(plan(["a", "b", "c"], ["a", "b"]), null);
});

test("old manifest missing a number within the unlocked region → keep pin", () => {
  // Corrupt/degraded old manifest: only chapter 1 present though U=3.
  assert.equal(
    planProgressVersionUpgrade({
      newVersion: 2,
      newContentPrefix: "books/x/v2",
      newManifestKey: "books/x/v2/manifest.json",
      oldManifest: { chapters: [{ chapterId: "a", number: 1 }] },
      newManifest: manifest(["a", "b", "c"]),
      progress: progress({ unlockedThroughChapterNumber: 3 }),
    }),
    null
  );
});

test("just-started reader (U=1) gets a chapter-1 correction", () => {
  // Only chapter 1 unlocked; v2 fixes chapter 1 content (same ids) → upgrade.
  const result = plan(["a", "b", "c"], ["a", "b", "c"], {
    unlockedThroughChapterNumber: 1,
    currentChapterNumber: 1,
    completedChapters: [],
    bestScoreByChapter: {},
  });
  assert.ok(result, "a just-started reader still receives a chapter-1 fix");
  assert.equal(result.unlockedThroughChapterNumber, 1);
});

test("reorder above the unlocked region (changes only locked chapters) → safe upgrade", () => {
  // Reader unlocked 1..2 (a,b); v2 swaps the still-locked c and d.
  const result = plan(["a", "b", "c", "d"], ["a", "b", "d", "c"], {
    unlockedThroughChapterNumber: 2,
    currentChapterNumber: 2,
    completedChapters: [1],
    bestScoreByChapter: { "1": 90 },
  });
  assert.ok(result, "reordering only locked chapters is safe");
  assert.equal(result.unlockedThroughChapterNumber, 2);
});

test("rollback (newVersion < pinnedBookVersion) → no downgrade", () => {
  assert.equal(
    planProgressVersionUpgrade({
      newVersion: 1,
      newContentPrefix: "books/x/v1",
      newManifestKey: "books/x/v1/manifest.json",
      oldManifest: manifest(["a", "b", "c"]),
      newManifest: manifest(["a", "b", "c"]),
      progress: progress({ pinnedBookVersion: 2 }),
    }),
    null
  );
});

test("reader unlocked ALL old chapters, new manifest has more → safe upgrade", () => {
  const result = plan(["a", "b", "c"], ["a", "b", "c", "d", "e"], {
    unlockedThroughChapterNumber: 3,
    currentChapterNumber: 3,
    completedChapters: [1, 2],
    bestScoreByChapter: { "1": 100, "2": 90 },
  });
  assert.ok(result, "extending the manifest beyond the unlocked depth is safe");
  assert.equal(result.unlockedThroughChapterNumber, 3);
});

test("all chapters reordered (same count) → keep pin", () => {
  assert.equal(plan(["a", "b", "c"], ["b", "a", "c"]), null);
});

test("corrupt row: a completed chapter ABOVE unlockedThrough that MOVED → keep pin", () => {
  // U=2 but completedChapters has 5 (legacy/corrupt). v2 inserts 'X' at pos 5,
  // shifting 'e' to 6 — completed chapter 5 would now point to different content.
  assert.equal(
    plan(["a", "b", "c", "d", "e"], ["a", "b", "c", "d", "X", "e"], {
      unlockedThroughChapterNumber: 2,
      currentChapterNumber: 2,
      completedChapters: [1, 2, 5],
      bestScoreByChapter: { "1": 100, "2": 90, "5": 80 },
    }),
    null
  );
});

test("a referenced chapter ABOVE unlockedThrough that stayed put → safe upgrade", () => {
  // Same corrupt shape, but v2 only appends 'f' — chapter 5 ('e') keeps position.
  const result = plan(["a", "b", "c", "d", "e"], ["a", "b", "c", "d", "e", "f"], {
    unlockedThroughChapterNumber: 2,
    currentChapterNumber: 2,
    completedChapters: [1, 2, 5],
    bestScoreByChapter: { "1": 100, "2": 90, "5": 80 },
  });
  assert.ok(result, "every referenced chapter still maps to the same content");
  assert.deepEqual(result.completedChapters, [1, 2, 5]);
});

test("gapped chapter numbering in old manifest → keep pin", () => {
  assert.equal(
    planProgressVersionUpgrade({
      newVersion: 2,
      newContentPrefix: "books/x/v2",
      newManifestKey: "books/x/v2/manifest.json",
      oldManifest: {
        chapters: [
          { chapterId: "a", number: 1 },
          { chapterId: "b", number: 2 },
          { chapterId: "d", number: 4 },
          { chapterId: "e", number: 5 },
        ],
      },
      newManifest: manifest(["a", "b", "c", "d", "e"]),
      progress: progress({ unlockedThroughChapterNumber: 4, completedChapters: [1, 2] }),
    }),
    null
  );
});

test("non-integer unlockedThrough is floored and still upgrades", () => {
  const result = plan(["a", "b", "c"], ["a", "b", "c"], {
    unlockedThroughChapterNumber: 1.7,
    currentChapterNumber: 1,
    completedChapters: [1],
    bestScoreByChapter: { "1": 100 },
  });
  assert.ok(result, "a fractional unlock depth is tolerated");
});

test("unlockedThrough < 1 falls back to verifying chapter 1", () => {
  const result = plan(["a", "b", "c"], ["a", "b", "c"], {
    unlockedThroughChapterNumber: 0,
    currentChapterNumber: 1,
    completedChapters: [],
    bestScoreByChapter: {},
  });
  assert.ok(result, "a degenerate unlock depth still verifies chapter 1 and upgrades");
});

test("malformed manifest (no chapters array) → keep pin", () => {
  assert.equal(
    planProgressVersionUpgrade({
      newVersion: 2,
      newContentPrefix: "books/x/v2",
      newManifestKey: "books/x/v2/manifest.json",
      oldManifest: {} as unknown as ReturnType<typeof manifest>,
      newManifest: manifest(["a", "b", "c"]),
      progress: progress(),
    }),
    null
  );
});
