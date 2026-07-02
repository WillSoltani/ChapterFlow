import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSegmentPlan,
  getSegmentKeys,
  buildTakeawayText,
  chapterBodySegmentS3Key,
  userGreetingS3Key,
  BODY_SEGMENT_TYPES,
  type NarrationContext,
  type SegmentPlan,
} from "@/app/app/api/book/_lib/audio-narration-core";

// The audio endpoint stitches per-segment MP3s in a FIXED order. These tests
// pin the documented order/shape (docs/ios/AUDIO-CONTRACT.md §"Segment order")
// so a future reorder fails here and forces the contract doc to be updated in
// lockstep. The route returns a single stitched MP3, but this ordered key list
// is exactly what determines that stream's internal structure.

function makeCtx(overrides: Partial<NarrationContext> = {}): NarrationContext {
  return {
    userName: "Ada",
    userId: "user-123",
    bookId: "crucial-conversations",
    bookTitle: "Crucial Conversations",
    authorName: "Joseph Grenny",
    chapterNumber: 4,
    totalChapters: 10,
    previousChapterScore: 90,
    previousChapterScoreBefore: 85,
    currentStreak: 2,
    daysSinceLastSession: 1,
    totalChaptersCompleted: 3,
    booksCompleted: 1,
    learningMode: "challenge",
    isFirstEverChapter: false,
    isFirstChapterOfBook: false,
    isLastChapterOfBook: false,
    isHalfwayThroughBook: false,
    isWeekend: false,
    isLateNight: false,
    timeOfDay: "evening",
    ...overrides,
  };
}

// A fixed plan so getSegmentKeys is fully deterministic (buildSegmentPlan uses
// Math.random for the generic fallbacks; the ordering under test does not).
function makePlan(overrides: Partial<SegmentPlan> = {}): SegmentPlan {
  return {
    timeOfDay: "evening",
    greetingId: "ctx-weekend",
    scoreId: "score-90",
    transitionId: "ctx-challenge",
    closingId: "generic-01",
    ...overrides,
  };
}

test("getSegmentKeys: full plan produces the documented order (with name + score)", () => {
  const ctx = makeCtx();
  const plan = makePlan();
  const keys = getSegmentKeys(plan, ctx, "direct", "medium");

  assert.deepEqual(keys, [
    // 1. per-user greeting clip ("Good evening, Ada.")
    "book-content/audio-segments/names/user-123-evening.mp3",
    // 2. contextual greeting
    "book-content/audio-segments/greetings/ctx-weekend.mp3",
    // 3. book intro (title + author)
    "book-content/audio-segments/books/crucial-conversations.mp3",
    // 4. score callout
    "book-content/audio-segments/scores/score-90.mp3",
    // 5. chapter-number lead-in
    "book-content/audio-segments/chapters/chapter-4.mp3",
    // 6. SUMMARY body (TTS, tone+variant scoped)
    "book-content/audio/crucial-conversations/ch0004.direct.medium.summary.mp3",
    // 7. transition
    "book-content/audio-segments/transitions/ctx-challenge.mp3",
    // 8. TAKEAWAYS body
    "book-content/audio/crucial-conversations/ch0004.direct.medium.takeaways.mp3",
    // 9. RECAP body
    "book-content/audio/crucial-conversations/ch0004.direct.medium.recap.mp3",
    // 10. closing CTA
    "book-content/audio-segments/closings/generic-01.mp3",
  ]);
});

test("getSegmentKeys: no userName omits the leading per-user greeting clip", () => {
  const keys = getSegmentKeys(makePlan(), makeCtx({ userName: null }), "direct", "medium");
  assert.equal(keys.length, 9);
  assert.ok(
    !keys.some((k) => k.startsWith("book-content/audio-segments/names/")),
    "no per-user greeting key when userName is null",
  );
  // The contextual greeting is now first.
  assert.equal(keys[0], "book-content/audio-segments/greetings/ctx-weekend.mp3");
});

test("getSegmentKeys: null scoreId omits the score callout", () => {
  const keys = getSegmentKeys(makePlan({ scoreId: null }), makeCtx(), "direct", "medium");
  assert.equal(keys.length, 9);
  assert.ok(
    !keys.some((k) => k.startsWith("book-content/audio-segments/scores/")),
    "no score key when plan.scoreId is null",
  );
});

test("getSegmentKeys: tone/variant flow into the three body-segment keys only", () => {
  const keys = getSegmentKeys(makePlan(), makeCtx(), "gentle", "hard");
  const bodyKeys = keys.filter((k) => k.startsWith("book-content/audio/"));
  assert.deepEqual(
    bodyKeys,
    BODY_SEGMENT_TYPES.map((seg) =>
      chapterBodySegmentS3Key("crucial-conversations", 4, "gentle", "hard", seg),
    ),
  );
  // Pre-generated segments (greetings/scores/etc.) are tone/variant-agnostic.
  const segmentKeys = keys.filter((k) => k.startsWith("book-content/audio-segments/"));
  assert.ok(segmentKeys.every((k) => !k.includes("gentle") && !k.includes("hard")));
});

test("chapterBodySegmentS3Key: chapter number is zero-padded to 4 digits", () => {
  assert.equal(
    chapterBodySegmentS3Key("b", 4, "direct", "medium", "summary"),
    "book-content/audio/b/ch0004.direct.medium.summary.mp3",
  );
  assert.equal(
    chapterBodySegmentS3Key("b", 123, "direct", "medium", "recap"),
    "book-content/audio/b/ch0123.direct.medium.recap.mp3",
  );
});

test("userGreetingS3Key: keyed by userId + time-of-day", () => {
  assert.equal(
    userGreetingS3Key("user-123", "morning"),
    "book-content/audio-segments/names/user-123-morning.mp3",
  );
});

test("buildSegmentPlan: context-driven branches are deterministic", () => {
  // First-ever chapter forces the greeting; first chapter forces the score id.
  const firstEver = buildSegmentPlan(
    makeCtx({ isFirstEverChapter: true, isFirstChapterOfBook: true }),
  );
  assert.equal(firstEver.greetingId, "ctx-first-ever");
  assert.equal(firstEver.scoreId, "first-chapter");

  // learningMode drives the transition; last chapter drives the closing.
  const challenge = buildSegmentPlan(makeCtx({ learningMode: "challenge" }));
  assert.equal(challenge.transitionId, "ctx-challenge");
  const guided = buildSegmentPlan(makeCtx({ learningMode: "guided" }));
  assert.equal(guided.transitionId, "ctx-guided");
  const last = buildSegmentPlan(makeCtx({ isLastChapterOfBook: true }));
  assert.equal(last.closingId, "ctx-last-chapter");

  // timeOfDay is passed straight through onto the plan.
  assert.equal(buildSegmentPlan(makeCtx({ timeOfDay: "morning" })).timeOfDay, "morning");
});

test("buildSegmentPlan: score callout reflects delta vs the prior chapter", () => {
  assert.equal(
    buildSegmentPlan(makeCtx({ previousChapterScore: 90, previousChapterScoreBefore: 85 })).scoreId,
    "score-90-improved",
  );
  assert.equal(
    buildSegmentPlan(makeCtx({ previousChapterScore: 90, previousChapterScoreBefore: 95 })).scoreId,
    "score-90-dipped",
  );
  assert.equal(
    buildSegmentPlan(makeCtx({ previousChapterScore: 90, previousChapterScoreBefore: 90 })).scoreId,
    "score-90",
  );
  // No prior chapter score → the "first chapter" callout.
  assert.equal(
    buildSegmentPlan(makeCtx({ isFirstChapterOfBook: false, previousChapterScore: null })).scoreId,
    "first-chapter",
  );
});

test("buildTakeawayText: single takeaway uses the opener connector", () => {
  const out = buildTakeawayText([{ point: "Start small", moreDetails: "" }]);
  assert.ok(out.startsWith("The first key takeaway from this chapter — Start small."));
});

test("buildTakeawayText: 3+ takeaways close with the wrap-up connector; details are interpolated", () => {
  const out = buildTakeawayText([
    { point: "A", moreDetails: "because reasons" },
    { point: "B", moreDetails: "" },
    { point: "C", moreDetails: "final detail" },
  ]);
  const blocks = out.split("\n\n");
  assert.equal(blocks.length, 3);
  assert.ok(blocks[0].includes("The first key takeaway"));
  assert.ok(blocks[0].includes("because reasons"));
  assert.ok(blocks[2].includes("And the last one"));
  assert.ok(blocks[2].includes("final detail"));
});

test("buildTakeawayText: empty list yields empty string", () => {
  assert.equal(buildTakeawayText([]), "");
});
