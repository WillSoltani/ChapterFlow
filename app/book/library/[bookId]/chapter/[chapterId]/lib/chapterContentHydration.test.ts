import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildChapterSeedKey,
  decideChapterContentFetch,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterContentHydration";

test("buildChapterSeedKey encodes chapter number and refetch key", () => {
  assert.equal(buildChapterSeedKey(3, 0), "3:0");
  assert.equal(buildChapterSeedKey(12, 2), "12:2");
});

test("serves the server seed instead of fetching when it is present (no client fetch)", () => {
  // The core WS3-024 guarantee: a hydrated entry chapter is served from the
  // initial payload, so no network fetch fires.
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 0,
    seedKey: buildChapterSeedKey(1, 0),
    servedSeedKey: null,
  });
  assert.equal(decision, "serve-seed");
});

test("does not re-fetch after a seed for the same (chapter, refetch) was applied", () => {
  const seedKey = buildChapterSeedKey(1, 0);
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 0,
    seedKey,
    servedSeedKey: seedKey, // already served (mount lazy-init or prior re-seed)
  });
  assert.equal(decision, "skip-served");
});

test("fetches when there is no usable seed (un-hydrated / not-started / locked chapter)", () => {
  const decision = decideChapterContentFetch({
    hasUsableSeed: false,
    refetchKey: 0,
    seedKey: buildChapterSeedKey(4, 0),
    servedSeedKey: null,
  });
  assert.equal(decision, "fetch");
});

test("a retry (refetchKey > 0) always fetches, even with a seed present", () => {
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 1,
    seedKey: buildChapterSeedKey(1, 1),
    servedSeedKey: buildChapterSeedKey(1, 0), // the mount seed, a different key
  });
  assert.equal(decision, "fetch");
});

test("navigation to a different hydrated chapter serves that chapter's seed", () => {
  // Same hook instance, chapterNumber advanced 1 -> 2 with a fresh matching seed.
  const decision = decideChapterContentFetch({
    hasUsableSeed: true,
    refetchKey: 0,
    seedKey: buildChapterSeedKey(2, 0),
    servedSeedKey: buildChapterSeedKey(1, 0), // seed already served for chapter 1
  });
  assert.equal(decision, "serve-seed");
});
