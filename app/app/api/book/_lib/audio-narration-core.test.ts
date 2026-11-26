import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSegmentPlan,
  getSegmentKeys,
  buildTakeawayText,
  chapterBodyClipS3Key,
  splitSpeechText,
  userGreetingS3Key,
  getUserGreetingScript,
  getSegmentDescriptors,
  selectBodySegmentsToGenerate,
  BODY_SEGMENT_TYPES,
  SPEECH_RECIPE_VERSION,
  SPEECH_CHUNK_MAX_CHARS,
  type BodySegmentType,
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

// Body clip keys as the route computes them: one per segment that has text.
const BODY_KEYS: Record<BodySegmentType, string> = {
  summary: chapterBodyClipS3Key("crucial-conversations", 4, "summary", ["Summary text."]),
  takeaways: chapterBodyClipS3Key("crucial-conversations", 4, "takeaways", ["Takeaways text."]),
  recap: chapterBodyClipS3Key("crucial-conversations", 4, "recap", ["Recap text."]),
};

test("getSegmentKeys: full plan produces the documented order (with name + score)", () => {
  const ctx = makeCtx();
  const plan = makePlan();
  const keys = getSegmentKeys(plan, ctx, BODY_KEYS);

  assert.deepEqual(keys, [
    // 1. per-user greeting clip ("Good evening, Ada.")
    userGreetingS3Key("user-123", "evening", "Ada"),
    // 2. contextual greeting
    "book-content/audio-segments/greetings/ctx-weekend.mp3",
    // 3. book intro (title + author)
    "book-content/audio-segments/books/crucial-conversations.mp3",
    // 4. score callout
    "book-content/audio-segments/scores/score-90.mp3",
    // 5. chapter-number lead-in
    "book-content/audio-segments/chapters/chapter-4.mp3",
    // 6. SUMMARY body (speech clip named by its content)
    BODY_KEYS.summary,
    // 7. transition
    "book-content/audio-segments/transitions/ctx-challenge.mp3",
    // 8. TAKEAWAYS body
    BODY_KEYS.takeaways,
    // 9. RECAP body
    BODY_KEYS.recap,
    // 10. closing CTA
    "book-content/audio-segments/closings/generic-01.mp3",
  ]);
});

test("getSegmentKeys: no userName omits the leading per-user greeting clip", () => {
  const keys = getSegmentKeys(makePlan(), makeCtx({ userName: null }), BODY_KEYS);
  assert.equal(keys.length, 9);
  assert.ok(
    !keys.some((k) => k.startsWith("book-content/audio-segments/names/")),
    "no per-user greeting key when userName is null",
  );
  // The contextual greeting is now first.
  assert.equal(keys[0], "book-content/audio-segments/greetings/ctx-weekend.mp3");
});

test("getSegmentKeys: null scoreId omits the score callout", () => {
  const keys = getSegmentKeys(makePlan({ scoreId: null }), makeCtx(), BODY_KEYS);
  assert.equal(keys.length, 9);
  assert.ok(
    !keys.some((k) => k.startsWith("book-content/audio-segments/scores/")),
    "no score key when plan.scoreId is null",
  );
});

test("getSegmentKeys: the given body keys are used as is, in body order", () => {
  const keys = getSegmentKeys(makePlan(), makeCtx(), BODY_KEYS);
  const bodyKeys = keys.filter((k) => k.startsWith("book-content/audio/"));
  assert.deepEqual(
    bodyKeys,
    BODY_SEGMENT_TYPES.map((seg) => BODY_KEYS[seg]),
  );
});

test("getSegmentKeys: a body segment without a key has no entry", () => {
  const keys = getSegmentKeys(makePlan(), makeCtx(), {
    summary: BODY_KEYS.summary,
    takeaways: BODY_KEYS.takeaways,
  });
  assert.equal(keys.length, 9);
  const bodyKeys = keys.filter((k) => k.startsWith("book-content/audio/"));
  assert.deepEqual(bodyKeys, [BODY_KEYS.summary, BODY_KEYS.takeaways]);

  const summaryOnly = getSegmentKeys(makePlan(), makeCtx(), { summary: BODY_KEYS.summary });
  assert.deepEqual(
    summaryOnly.filter((k) => k.startsWith("book-content/audio/")),
    [BODY_KEYS.summary],
  );
});

// ── chapterBodyClipS3Key: body clips are named by their content ─────────────

const GOLDEN_CHUNKS = ["First paragraph.", "Second paragraph."];

test("chapterBodyClipS3Key: a fixed input gives one exact key", () => {
  assert.equal(SPEECH_RECIPE_VERSION, 1);
  assert.equal(
    chapterBodyClipS3Key("golden-book", 7, "summary", GOLDEN_CHUNKS),
    "book-content/audio/golden-book/ch0007.summary.e3c8b2418c4c29ea.mp3",
  );
});

test("chapterBodyClipS3Key: text, segment, chapter and recipe number each change the key", () => {
  const golden = chapterBodyClipS3Key("golden-book", 7, "summary", GOLDEN_CHUNKS);
  const variants = [
    chapterBodyClipS3Key("golden-book", 7, "summary", ["First paragraph!", "Second paragraph."]),
    chapterBodyClipS3Key("golden-book", 7, "summary", ["First paragraph.", "Second paragraph"]),
    chapterBodyClipS3Key("golden-book", 7, "summary", ["First paragraph.\n\nSecond paragraph."]),
    chapterBodyClipS3Key("golden-book", 7, "takeaways", GOLDEN_CHUNKS),
    chapterBodyClipS3Key("golden-book", 8, "summary", GOLDEN_CHUNKS),
    chapterBodyClipS3Key("golden-book", 7, "summary", GOLDEN_CHUNKS, SPEECH_RECIPE_VERSION + 1),
  ];
  for (const key of variants) assert.notEqual(key, golden);
  assert.equal(new Set(variants).size, variants.length);
  // The same input always gives the same key.
  assert.equal(chapterBodyClipS3Key("golden-book", 7, "summary", [...GOLDEN_CHUNKS]), golden);
});

test("chapterBodyClipS3Key: zero-padded chapter, .mp3 ending, no tone or variant", () => {
  const key = chapterBodyClipS3Key("b", 123, "recap", ["Some recap."]);
  assert.match(key, /^book-content\/audio\/b\/ch0123\.recap\.[0-9a-f]{16}\.mp3$/);
  for (const word of ["gentle", "direct", "competitive", "easy", "medium", "hard", "precise", "balanced", "challenging"]) {
    assert.ok(!key.includes(word), `key must not carry ${word}`);
  }
});

// ── splitSpeechText: the text chunks sent to speech ─────────────────────────

// The splitting loop the route used before body clips were named by content,
// kept as a reference: the new function must give exactly the same chunks.
function referenceSplit(ttsText: string): string[] {
  const MAX_CHUNK = 4096;
  const textChunks: string[] = [];
  if (ttsText.length <= MAX_CHUNK) {
    textChunks.push(ttsText);
  } else {
    const paragraphs = ttsText.split("\n\n");
    let current = "";
    for (const para of paragraphs) {
      if (current && (current.length + para.length + 2) > MAX_CHUNK) {
        textChunks.push(current.trim());
        current = para;
      } else {
        current = current ? `${current}\n\n${para}` : para;
      }
    }
    if (current.trim()) textChunks.push(current.trim());
  }
  return textChunks;
}

function words(prefix: string, length: number): string {
  let out = "";
  let i = 0;
  while (out.length < length) {
    out += `${out ? " " : ""}${prefix}${i}`;
    i += 1;
  }
  return out.slice(0, length).trim();
}

test("splitSpeechText: text within the limit is one chunk", () => {
  assert.equal(SPEECH_CHUNK_MAX_CHARS, 4096);
  assert.deepEqual(splitSpeechText("One paragraph.\n\nTwo paragraph."), [
    "One paragraph.\n\nTwo paragraph.",
  ]);
  const exact = "x".repeat(4096);
  assert.deepEqual(splitSpeechText(exact), [exact]);
});

test("splitSpeechText: a long text splits on blank lines into trimmed chunks within the limit", () => {
  const a = words("alpha", 2500);
  const b = words("beta", 2500);
  const c = words("gamma", 1000);
  const chunks = splitSpeechText(`${a}\n\n ${b}\n\n${c}  `);
  assert.deepEqual(chunks, [a, `${b}\n\n${c}`]);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 4096);
    assert.equal(chunk, chunk.trim());
  }
});

test("splitSpeechText: a single paragraph over the limit stays whole", () => {
  const big = words("long", 5000);
  assert.deepEqual(splitSpeechText(big), [big]);
  const small = words("small", 100);
  assert.deepEqual(splitSpeechText(`${small}\n\n${big}`), [small, big]);
});

test("splitSpeechText: same chunks as the previous splitting loop", () => {
  const p = (prefix: string, n: number) => words(prefix, n);
  const cases = [
    "",
    "short",
    "x".repeat(4096),
    "x".repeat(4097),
    `${p("a", 2047)}\n\n${p("b", 2047)}`,
    `${p("a", 2047)}\n\n${p("b", 2048)}`,
    `${p("a", 3000)}\n\n${p("b", 3000)}\n\n${p("c", 3000)}`,
    `${p("a", 4000)}\n\n\n\n${p("b", 200)}`,
    `${p("a", 100)}\n\n${p("b", 9000)}\n\n${p("c", 100)}`,
    `  ${p("a", 3000)}  \n\n  ${p("b", 3000)}  `,
    `${p("a", 1500)}\n\n${p("b", 1500)}\n\n${p("c", 1500)}\n\n${p("d", 1500)}\n\n${p("e", 1500)}`,
  ];
  for (const text of cases) {
    assert.deepEqual(splitSpeechText(text), referenceSplit(text), `length ${text.length}`);
  }
});

const GREETING_KEY_SHAPE =
  /^book-content\/audio-segments\/names\/user-123-morning\.[0-9a-f]{16}\.mp3$/;

function greetingHash(key: string): string {
  const match = /\.([0-9a-f]{16})\.mp3$/.exec(key);
  assert.ok(match, `no hash in ${key}`);
  return match[1]!;
}

test("userGreetingS3Key: has the shape names/<userId>-<timeOfDay>.<16 hex>.mp3", () => {
  assert.match(userGreetingS3Key("user-123", "morning", "Ada"), GREETING_KEY_SHAPE);
});

test("userGreetingS3Key: its hash is the one chapter clips get for the same chunk list", () => {
  const chapterKey = chapterBodyClipS3Key("b", 1, "summary", [
    getUserGreetingScript("Ada", "morning"),
  ]);
  assert.equal(
    greetingHash(userGreetingS3Key("user-123", "morning", "Ada")),
    greetingHash(chapterKey),
  );
});

test("userGreetingS3Key: the same input gives the same name", () => {
  assert.equal(
    userGreetingS3Key("user-123", "morning", "Ada"),
    userGreetingS3Key("user-123", "morning", "Ada"),
  );
});

test("userGreetingS3Key: pinned name for a fixed input", () => {
  assert.equal(
    userGreetingS3Key("user-123", "morning", "Ada"),
    "book-content/audio-segments/names/user-123-morning.94dde59a54515750.mp3",
  );
});

test("userGreetingS3Key: a different display name gives a different name", () => {
  assert.notEqual(
    userGreetingS3Key("user-123", "morning", "Ada"),
    userGreetingS3Key("user-123", "morning", "Grace"),
  );
});

test("userGreetingS3Key: a different time of day gives a different name", () => {
  assert.notEqual(
    userGreetingS3Key("user-123", "morning", "Ada"),
    userGreetingS3Key("user-123", "evening", "Ada"),
  );
});

test("userGreetingS3Key: a different user gives a different name", () => {
  assert.notEqual(
    userGreetingS3Key("user-123", "morning", "Ada"),
    userGreetingS3Key("user-456", "morning", "Ada"),
  );
});

test("userGreetingS3Key: a different recipe number gives a different name", () => {
  assert.notEqual(
    userGreetingS3Key("user-123", "morning", "Ada", SPEECH_RECIPE_VERSION),
    userGreetingS3Key("user-123", "morning", "Ada", SPEECH_RECIPE_VERSION + 1),
  );
});

test("getSegmentDescriptors: the per-user greeting is keyed by the user's display name", () => {
  const ctx = makeCtx();
  const plan = makePlan();
  const first = getSegmentDescriptors(plan, ctx, BODY_KEYS)[0]!;
  assert.equal(first.type, "userGreeting");
  assert.equal(first.key, userGreetingS3Key(ctx.userId, plan.timeOfDay, "Ada"));
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
  assert.ok(blocks[0]!.includes("The first key takeaway"));
  assert.ok(blocks[0]!.includes("because reasons"));
  assert.ok(blocks[2]!.includes("And the last one"));
  assert.ok(blocks[2]!.includes("final detail"));
});

test("buildTakeawayText: empty list yields empty string", () => {
  assert.equal(buildTakeawayText([]), "");
});

// ── selectBodySegmentsToGenerate ─────────────────────────────────────────────
//
// The stream path generates a body segment only when it has no cached clip AND
// the chapter has text for it; a segment without text can never be produced.

type Loaded = { key: string; buffer: Buffer | null; bodyType: BodySegmentType | null };

function makeLoaded(): Loaded[] {
  return [
    { key: "greeting", buffer: null, bodyType: null },
    { key: "summary", buffer: null, bodyType: "summary" },
    { key: "transition", buffer: Buffer.from("t"), bodyType: null },
    { key: "takeaways", buffer: null, bodyType: "takeaways" },
    { key: "recap", buffer: null, bodyType: "recap" },
  ];
}

test("selectBodySegmentsToGenerate: missing body segments with text are picked, in order", () => {
  const loaded = makeLoaded();
  const picked = selectBodySegmentsToGenerate(loaded, {
    summary: "summary text",
    takeaways: "takeaways text",
    recap: "recap text",
  });
  assert.deepEqual(picked.map((r) => r.key), ["summary", "takeaways", "recap"]);
  // The same objects come back, so the caller can patch generated bytes in place.
  assert.equal(picked[0], loaded[1]);
});

test("selectBodySegmentsToGenerate: a missing body segment without text is not picked", () => {
  const picked = selectBodySegmentsToGenerate(makeLoaded(), {
    summary: "summary text",
    takeaways: "takeaways text",
    recap: "",
  });
  assert.deepEqual(picked.map((r) => r.key), ["summary", "takeaways"]);

  const noRecapEntry = selectBodySegmentsToGenerate(makeLoaded(), { summary: "summary text" });
  assert.deepEqual(noRecapEntry.map((r) => r.key), ["summary"]);
});

test("selectBodySegmentsToGenerate: cached body segments and non-body segments are never picked", () => {
  const loaded = makeLoaded().map((r) =>
    r.bodyType === null ? r : { ...r, buffer: Buffer.from(r.key) },
  );
  const picked = selectBodySegmentsToGenerate(loaded, {
    summary: "summary text",
    takeaways: "takeaways text",
    recap: "recap text",
  });
  assert.deepEqual(picked, []);
});

test("selectBodySegmentsToGenerate: no text at all → nothing to generate", () => {
  assert.deepEqual(selectBodySegmentsToGenerate(makeLoaded(), {}), []);
});
