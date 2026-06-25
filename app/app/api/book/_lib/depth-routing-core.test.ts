import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDepthRecommendation,
  computeNextDepthModel,
  depthModelDataPoints,
  depthModelKey,
} from "./depth-routing-core";
import type { BookUserDepthModelItem } from "./types";

test("depthModelKey uses uppercase PK/SK to match the table schema", () => {
  const key = depthModelKey("user-123", "book-abc");

  // The app table key schema is uppercase PK/SK. Lowercase keys make DynamoDB
  // reject Get/Put with a ValidationException (the depth-recommendation route
  // then 500s). Guard against that casing regression.
  assert.ok("PK" in key, "key must have an uppercase PK attribute");
  assert.ok("SK" in key, "key must have an uppercase SK attribute");
  assert.ok(!("pk" in key), "key must NOT have a lowercase pk attribute");
  assert.ok(!("sk" in key), "key must NOT have a lowercase sk attribute");
});

test("depthModelKey builds the per-user / per-book key values", () => {
  const key = depthModelKey("user-123", "book-abc");

  assert.equal(key.PK, "BOOKUSER#user-123");
  assert.equal(key.SK, "DEPTHMODEL#book-abc");
});

// ── Adaptive depth-routing model update (the writer the route depends on) ─────
// Before the fix updateDepthModel was never called and there was no pure update
// seam to test; the recommendation route therefore always returned the cold-start
// fallback. These guard that (a) the model can actually be built from a quiz
// outcome and (b) the data-point counter — not the chapter number — gates the
// recommendation.

test("computeNextDepthModel folds the FIRST chapter outcome (dataPoints=1, EMA seed)", () => {
  const item = computeNextDepthModel({
    userId: "u1",
    bookId: "b1",
    chapterNumber: 1,
    quizScore: 92,
    readingTimeMinutes: 8,
    expectedReadingTimeMinutes: 10,
    existing: null,
    now: "2026-06-24T00:00:00.000Z",
  });

  // First data point seeds the averages directly (no prior to blend with).
  assert.equal(item.featureVector.avgQuizScore, 92);
  assert.equal(item.featureVector.avgReadingTimeRatio, 0.8);
  assert.equal(item.dataPoints, 1, "first pass counts as one data point");
  assert.equal(item.lastUpdatedChapter, 1);
  // One data point is below the gate → cold-start 'easy', regardless of score.
  assert.equal(item.recommendedDepth, "easy");
  assert.equal(item.confidence, 0.3);
});

test("computeNextDepthModel increments dataPoints and blends via EMA on the second pass", () => {
  const first = computeNextDepthModel({
    userId: "u1",
    bookId: "b1",
    chapterNumber: 1,
    quizScore: 92,
    readingTimeMinutes: 8,
    expectedReadingTimeMinutes: 10,
    existing: null,
    now: "2026-06-24T00:00:00.000Z",
  });

  const second = computeNextDepthModel({
    userId: "u1",
    bookId: "b1",
    chapterNumber: 2,
    quizScore: 96,
    readingTimeMinutes: 9,
    expectedReadingTimeMinutes: 10,
    existing: first,
    now: "2026-06-24T01:00:00.000Z",
  });

  assert.equal(second.dataPoints, 2, "second pass advances the data-point count");
  // EMA alpha=0.4: 0.4*96 + 0.6*92 = 93.6
  assert.equal(second.featureVector.avgQuizScore, 93.6);
  // Two data points clears the gate → a real (non-cold-start) recommendation.
  assert.notEqual(second.confidence, 0.3);
  assert.equal(second.recommendedDepth, "hard");
});

test("dataPoints counter is driven by passes, NOT the chapter number (the H11 conflation)", () => {
  // A reader who jumps straight to chapter 5 has only ONE data point, so the
  // recommendation must still be the cold-start 'easy' default — not a confident
  // recommendation as if 5 chapters were scored.
  const jumpedAhead = computeNextDepthModel({
    userId: "u1",
    bookId: "b1",
    chapterNumber: 5,
    quizScore: 100,
    readingTimeMinutes: 4,
    expectedReadingTimeMinutes: 10,
    existing: null,
    now: "2026-06-24T00:00:00.000Z",
  });

  assert.equal(jumpedAhead.lastUpdatedChapter, 5);
  assert.equal(jumpedAhead.dataPoints, 1, "one pass = one data point even at chapter 5");
  assert.equal(jumpedAhead.recommendedDepth, "easy");
  assert.equal(jumpedAhead.confidence, 0.3);
});

test("depthModelDataPoints prefers the stored counter and falls back to lastUpdatedChapter", () => {
  const withCounter: Pick<
    BookUserDepthModelItem,
    "dataPoints" | "lastUpdatedChapter"
  > = { dataPoints: 3, lastUpdatedChapter: 7 };
  assert.equal(depthModelDataPoints(withCounter), 3);

  // Legacy item (written before the counter existed) → fall back to the chapter.
  const legacy: Pick<BookUserDepthModelItem, "dataPoints" | "lastUpdatedChapter"> = {
    lastUpdatedChapter: 4,
  };
  assert.equal(depthModelDataPoints(legacy), 4);
});

test("computeDepthRecommendation still cold-starts under the data-point gate", () => {
  const rec = computeDepthRecommendation(
    { avgQuizScore: 99, avgReadingTimeRatio: 0.5, recentScoreTrend: 5, reviewCardRecall: 1 },
    1
  );
  assert.equal(rec.depth, "easy");
  assert.equal(rec.confidence, 0.3);
});
