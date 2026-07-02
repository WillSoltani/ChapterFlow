import { test } from "node:test";
import assert from "node:assert/strict";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  buildAudioPlan,
  getSegmentDescriptors,
  getSegmentKeys,
  type AudioPlanSegment,
  type BuildAudioPlanDeps,
  type NarrationContext,
  type SegmentDescriptor,
  type SegmentPlan,
} from "@/app/app/api/book/_lib/audio-narration-core";

// These tests pin the `?mode=plan` manifest contract (docs/ios/AUDIO-CONTRACT.md
// §8): the ordered descriptor list (which the stitched stream ALSO derives its
// keys from, so any drift breaks both) and the pure plan-builder that turns
// those descriptors into per-segment presigned Range-capable URLs + metadata.
// The route wiring is a thin adapter over `buildAudioPlan`; the repo tests the
// pure core behind the `server-only` shim rather than the route itself.

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

// A fixed plan keeps getSegmentDescriptors deterministic (buildSegmentPlan uses
// Math.random for the generic fallbacks; the ordering/ids under test do not).
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

const META = {
  bookId: "crucial-conversations",
  chapterNumber: 4,
  tone: "direct",
  variant: "medium",
};

const NOW_MS = Date.UTC(2026, 6, 2, 12, 0, 0); // 2026-07-02T12:00:00Z
const TTL = 6 * 60 * 60; // 6h

// A HEAD fake that reports a byte length for keys in `present`, else null.
function fakeHead(present: Record<string, number>): BuildAudioPlanDeps["headContentLength"] {
  return async (key: string) => (key in present ? present[key] : null);
}

function fakePresign(): BuildAudioPlanDeps["presign"] {
  return async (key: string) => `https://s3.test/${encodeURIComponent(key)}?sig=fake&X-Amz-Expires=21600`;
}

// Give every descriptor's key a length so the happy path is fully populated.
function allPresent(descriptors: SegmentDescriptor[], bytes = 32000): Record<string, number> {
  return Object.fromEntries(descriptors.map((d) => [d.key, bytes]));
}

// ── getSegmentDescriptors: order / ids / types / text ────────────────────────

test("getSegmentDescriptors: full plan → documented order, stable ids, types, captions", () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");

  assert.deepEqual(
    descriptors.map((d) => d.type),
    [
      "userGreeting",
      "greeting",
      "bookIntro",
      "score",
      "chapterNumber",
      "summary",
      "transition",
      "takeaways",
      "recap",
      "closing",
    ],
  );

  assert.deepEqual(
    descriptors.map((d) => d.segmentId),
    [
      "greeting-user-evening",
      "greeting-ctx-weekend",
      "book-intro",
      "score-90", // "score-" prefix not doubled
      "chapter-number-4",
      "summary",
      "transition-ctx-challenge",
      "takeaways",
      "recap",
      "closing-generic-01",
    ],
  );

  // Narration segments carry caption text; long-form body segments do not.
  const byType = new Map(descriptors.map((d) => [d.type, d]));
  assert.equal(byType.get("userGreeting")!.text, "Good evening, Ada.");
  assert.equal(byType.get("bookIntro")!.text, "Crucial Conversations by Joseph Grenny.");
  assert.equal(byType.get("chapterNumber")!.text, "Let's see what chapter 4 has for us.");
  assert.ok((byType.get("greeting")!.text ?? "").length > 0);
  assert.equal(byType.get("summary")!.text, undefined);
  assert.equal(byType.get("takeaways")!.text, undefined);
  assert.equal(byType.get("recap")!.text, undefined);
});

test("getSegmentDescriptors: score segmentId stays clean for the first-chapter callout", () => {
  const [score] = getSegmentDescriptors(
    makePlan({ scoreId: "first-chapter" }),
    makeCtx(),
    "direct",
    "medium",
  ).filter((d) => d.type === "score");
  assert.equal(score.segmentId, "score-first-chapter");
});

test("getSegmentKeys is exactly getSegmentDescriptors().map(key) — stream keys unchanged", () => {
  for (const [ctx, plan] of [
    [makeCtx(), makePlan()],
    [makeCtx({ userName: null }), makePlan()],
    [makeCtx(), makePlan({ scoreId: null })],
  ] as const) {
    assert.deepEqual(
      getSegmentKeys(plan, ctx, "gentle", "hard"),
      getSegmentDescriptors(plan, ctx, "gentle", "hard").map((d) => d.key),
    );
  }
});

test("getSegmentDescriptors: no userName drops the leading user-greeting descriptor", () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx({ userName: null }), "direct", "medium");
  assert.equal(descriptors.length, 9);
  assert.equal(descriptors[0].type, "greeting");
  assert.ok(!descriptors.some((d) => d.type === "userGreeting"));
});

// ── buildAudioPlan: happy path ───────────────────────────────────────────────

test("buildAudioPlan: all present → ordered manifest, presigned URLs, CBR durations, expiry", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const present = allPresent(descriptors, 32000);

  let generateCalls = 0;
  const result = await buildAudioPlan(
    descriptors,
    META,
    {
      headContentLength: fakeHead(present),
      presign: fakePresign(),
      generate: async () => {
        generateCalls += 1;
        return null;
      },
      canGenerate: true,
    },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const plan = result.plan;

  // Top-level shape.
  assert.equal(plan.version, 1);
  assert.equal(plan.bookId, "crucial-conversations");
  assert.equal(plan.chapterNumber, 4);
  assert.equal(plan.tone, "direct");
  assert.equal(plan.variant, "medium");
  assert.equal(plan.expiresAt, new Date(NOW_MS + TTL * 1000).toISOString());
  assert.equal(plan.expiresAt, "2026-07-02T18:00:00.000Z");

  // Nothing was generated (everything already existed).
  assert.equal(generateCalls, 0);

  // Order preserved, ids stable, all 10 segments present.
  assert.deepEqual(
    plan.segments.map((s) => s.segmentId),
    descriptors.map((d) => d.segmentId),
  );
  assert.equal(plan.segments.length, 10);

  // TTL is at least 6 hours out.
  assert.ok(Date.parse(plan.expiresAt) - NOW_MS >= 6 * 60 * 60 * 1000);

  for (const seg of plan.segments) {
    assert.equal(seg.contentLength, 32000);
    assert.equal(seg.rangeSupported, true);
    assert.match(seg.url, /^https:\/\/s3\.test\//);
    assert.ok(seg.url.includes("X-Amz-Expires=21600"));
  }

  // durationSeconds ONLY on the 128kbps-CBR (ElevenLabs) segments: 32000/16000 = 2.0.
  const cbr = new Set(["userGreeting", "summary", "takeaways", "recap"]);
  for (const seg of plan.segments) {
    if (cbr.has(seg.type)) {
      assert.equal(seg.durationSeconds, 2.0);
    } else {
      assert.equal(seg.durationSeconds, undefined);
    }
  }

  // Captions are echoed for narration segments, omitted for bodies.
  const summary = plan.segments.find((s) => s.type === "summary")!;
  assert.equal(summary.text, undefined);
  const bookIntro = plan.segments.find((s) => s.type === "bookIntro")!;
  assert.equal(bookIntro.text, "Crucial Conversations by Joseph Grenny.");
});

test("buildAudioPlan: URL matches the presign closure output for that exact key", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const present = allPresent(descriptors);
  const presign = fakePresign();
  const result = await buildAudioPlan(
    descriptors,
    META,
    { headContentLength: fakeHead(present), presign, generate: async () => null, canGenerate: true },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (let i = 0; i < descriptors.length; i += 1) {
    assert.equal(result.plan.segments[i].url, await presign(descriptors[i].key));
  }
});

// ── buildAudioPlan: generation on cache-miss ─────────────────────────────────

test("buildAudioPlan: a missing BODY segment is generated, awaited, and sized", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const summaryKey = descriptors.find((d) => d.type === "summary")!.key;
  const present = allPresent(descriptors);
  delete present[summaryKey]; // summary is absent → must be generated

  const generated: SegmentDescriptor[] = [];
  const result = await buildAudioPlan(
    descriptors,
    META,
    {
      headContentLength: fakeHead(present),
      presign: fakePresign(),
      generate: async (d) => {
        generated.push(d);
        return 48000; // 48000 / 16000 = 3.0s
      },
      canGenerate: true,
    },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Only the missing summary was generated.
  assert.deepEqual(generated.map((d) => d.type), ["summary"]);
  const summary = result.plan.segments.find((s) => s.type === "summary")!;
  assert.equal(summary.contentLength, 48000);
  assert.equal(summary.durationSeconds, 3.0);
  assert.equal(result.plan.segments.length, 10);
});

test("buildAudioPlan: a missing NON-generatable clip is dropped, never generated", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const scoreKey = descriptors.find((d) => d.type === "score")!.key;
  const present = allPresent(descriptors);
  delete present[scoreKey]; // pre-generated score clip absent → drop it

  let generateCalls = 0;
  const result = await buildAudioPlan(
    descriptors,
    META,
    {
      headContentLength: fakeHead(present),
      presign: fakePresign(),
      generate: async () => {
        generateCalls += 1;
        return 1;
      },
      canGenerate: true,
    },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(generateCalls, 0); // score is not a generatable type
  assert.ok(!result.plan.segments.some((s) => s.type === "score"));
  assert.equal(result.plan.segments.length, 9);
});

test("buildAudioPlan: a generatable body that fails to generate is dropped", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const takeawaysKey = descriptors.find((d) => d.type === "takeaways")!.key;
  const present = allPresent(descriptors);
  delete present[takeawaysKey];

  const result = await buildAudioPlan(
    descriptors,
    META,
    {
      headContentLength: fakeHead(present),
      presign: fakePresign(),
      generate: async () => null, // e.g. empty chapter section / TTS failure
      canGenerate: true,
    },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!result.plan.segments.some((s) => s.type === "takeaways"));
  assert.equal(result.plan.segments.length, 9);
});

// ── buildAudioPlan: fail-closed parity with the stream ───────────────────────

test("buildAudioPlan: missing body + no TTS key → 503 tts_unavailable", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const recapKey = descriptors.find((d) => d.type === "recap")!.key;
  const present = allPresent(descriptors);
  delete present[recapKey];

  const result = await buildAudioPlan(
    descriptors,
    META,
    {
      headContentLength: fakeHead(present),
      presign: fakePresign(),
      generate: async () => 1,
      canGenerate: false, // no ELEVENLABS_API_KEY
    },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 503);
  assert.equal(result.code, "tts_unavailable");
});

test("buildAudioPlan: nothing available → 404 no_audio", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const result = await buildAudioPlan(
    descriptors,
    META,
    {
      headContentLength: async () => null, // every object absent
      presign: fakePresign(),
      generate: async () => null, // and nothing can be generated
      canGenerate: true, // avoid the 503 branch so we reach the 404 path
    },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 404);
  assert.equal(result.code, "no_audio");
});

// ── Real SigV4 presigning (no network) ───────────────────────────────────────

test("getSignedUrl: produces a valid, Range-capable, 6h presigned GET URL", async () => {
  // Dummy, non-AWS-format credentials → SigV4 is a pure HMAC over these strings,
  // so any non-empty pair signs offline with no network/metadata call (and no
  // AKIA-shaped literal for the secret scanner to flag).
  const client = new S3Client({
    region: "us-east-1",
    credentials: { accessKeyId: "test-access-key-id", secretAccessKey: "test-secret-access-key" },
  });
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: "content-bucket", Key: "book-content/audio/x/ch0004.direct.medium.summary.mp3" }),
    { expiresIn: TTL },
  );

  assert.match(url, /^https:\/\/content-bucket\.s3\.us-east-1\.amazonaws\.com\//);
  assert.ok(url.includes("X-Amz-Algorithm=AWS4-HMAC-SHA256"));
  assert.ok(url.includes("X-Amz-Signature="));
  assert.ok(url.includes(`X-Amz-Expires=${TTL}`)); // 21600 = 6h ≥ contract minimum
});

// Guard: the manifest never advertises a segment as non-Range-capable, because
// every URL points at a native S3 object. (The live 206 proof is in the
// opt-in integration test audio-plan.itest.ts.)
test("buildAudioPlan: every emitted segment advertises rangeSupported: true", async () => {
  const descriptors = getSegmentDescriptors(makePlan(), makeCtx(), "direct", "medium");
  const result = await buildAudioPlan(
    descriptors,
    META,
    {
      headContentLength: fakeHead(allPresent(descriptors)),
      presign: fakePresign(),
      generate: async () => null,
      canGenerate: true,
    },
    { ttlSeconds: TTL, nowMs: NOW_MS },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.plan.segments.every((s: AudioPlanSegment) => s.rangeSupported === true));
});
