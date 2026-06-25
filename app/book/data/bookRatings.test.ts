import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RATINGS_SOURCE_LABEL,
  formatAttributedRatingsCount,
  formatRatingsCount,
} from "./bookRatings";

// The numbers in bookRatings.ts are a curated Goodreads snapshot, not in-app
// reader ratings. The attribution helper is the single chokepoint that keeps
// every render site honest, so pin its copy here.

test("formatRatingsCount renders compact magnitudes", () => {
  assert.equal(formatRatingsCount(1_180_000), "1.2M");
  assert.equal(formatRatingsCount(92_000), "92k");
  assert.equal(formatRatingsCount(500), "500");
  // 999_500 rounds up to "1.0M", not "1000k".
  assert.equal(formatRatingsCount(999_500), "1.0M");
});

test("RATINGS_SOURCE_LABEL names Goodreads as the source", () => {
  assert.equal(RATINGS_SOURCE_LABEL, "Goodreads");
});

test("formatAttributedRatingsCount always names the source", () => {
  assert.equal(formatAttributedRatingsCount(1_180_000), "1.2M ratings on Goodreads");
  assert.equal(formatAttributedRatingsCount(92_000), "92k ratings on Goodreads");
  assert.equal(formatAttributedRatingsCount(4_200), "4k ratings on Goodreads");
});

test("attributed string never implies an in-app/community reader score", () => {
  const s = formatAttributedRatingsCount(205_000).toLowerCase();
  assert.ok(s.includes("goodreads"), "must attribute Goodreads");
  assert.ok(!s.includes("reader rating"), "must not imply in-app reader ratings");
  assert.ok(!s.includes("chapterflow"), "must not imply a ChapterFlow community score");
});
