import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { S3Client } from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import {
  chapterBodySegmentS3Key,
  type BodySegmentType,
} from "@/app/app/api/book/_lib/audio-narration-core";
import { AUDIO_GENERATION_DAILY_LIMIT } from "./audio-generation-limit-core";

// Route-level regression coverage for the chapter audio GET. It drives the real
// exported handler; only the outer edges are replaced: the AWS SDK clients'
// `send`, the outbound speech `fetch`, the `server-only` marker and
// `next/headers`. A small synthetic book package is served from the fake S3.
//
// The rule under test: a chapter body part (summary, takeaways, recap) with no
// text for this chapter can never be generated, so it is not missing audio. It
// must not cause 503 when there is no speech key, and it must not reserve a
// daily generation unit when there is one.
//
// getServerEnv remembers a missing name for the life of the process but reads
// process.env first, so the cases without a speech key run first and the key is
// set in process.env for the later cases. node:test runs these in order.

// ── Environment (before the route module is loaded) ──────────────────────────

process.env.DEV_AUTH_BYPASS = "1"; // synthetic signed-in user outside production
process.env.SSM_PARAMETER_PREFIX = "/chapterflow/test";
process.env.BOOK_TABLE_NAME = "test-book-table";
process.env.BOOK_CONTENT_BUCKET = "test-content-bucket";
process.env.AWS_REGION = "us-east-1";
// Plain placeholder credentials so the local presigner can sign ?mode=plan URLs
// offline. Nothing is ever sent anywhere.
process.env.AWS_ACCESS_KEY_ID = "test-access-key-id";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-access-key";
for (const name of ["AWS_PROFILE", "AWS_SESSION_TOKEN", "AWS_XRAY_DAEMON_ADDRESS", "ELEVENLABS_API_KEY"]) {
  delete process.env[name];
}

const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = Module._load;
Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  if (request === "next/headers") {
    const unavailable = async () => {
      throw new Error("next/headers is not available in this test");
    };
    return { cookies: unavailable, headers: unavailable };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// ── Synthetic book package ───────────────────────────────────────────────────

const BOOK_ID = "audio-route-test-book";
const SUMMARY_ONE = "Chapter one explains why small steps add up over a year.";
const SUMMARY_TWO = "Chapter two explains how a plan survives a bad week.";

// Chapter 1 has summary and takeaways text; chapter 2 has a summary only (no
// memorable lines, so no takeaways). Neither has recap text.
const BOOK_PACKAGE = {
  schemaVersion: "chapterflow-v21-authored",
  packageId: "audio-route-test-package",
  book: { bookId: BOOK_ID, title: "Test Book", author: "Test Author" },
  chapters: [
    {
      chapterId: "ch-1",
      number: 1,
      title: "Small steps",
      breakdown: { fastRead: SUMMARY_ONE, deepRead: SUMMARY_ONE, fullRead: SUMMARY_ONE },
      memorableLines: [{ text: "Start smaller than feels useful." }, { text: "Repeat before you improve." }],
    },
    {
      chapterId: "ch-2",
      number: 2,
      title: "Bad weeks",
      breakdown: { fastRead: SUMMARY_TWO, deepRead: SUMMARY_TWO, fullRead: SUMMARY_TWO },
    },
  ],
};

const PACKAGE_KEY = `book-content/packages/${BOOK_ID}.v21.json`;
const CONTENT_PREFIX = `book-content/test-published/${BOOK_ID}/v1`;
const USER_PK = "BOOKUSER#dev-local-user";

function bodyKey(chapter: number, segment: BodySegmentType): string {
  return chapterBodySegmentS3Key(BOOK_ID, chapter, "direct", "medium", segment);
}

// ── Fake state ───────────────────────────────────────────────────────────────

const fake = {
  /** Chapter body clips that exist in storage. */
  presentBodyKeys: new Set<string>(),
  /** Today's daily generation count before the request. */
  dailyCount: 0,
  /** Texts sent to the speech endpoint. */
  speechTexts: [] as string[],
  /** Daily generation counter updates the route attempted. */
  dailyUnitWrites: 0,
  unexpected: [] as string[],
};

function resetFakes(opts: { presentBodyKeys: string[]; dailyCount?: number }): void {
  fake.presentBodyKeys = new Set(opts.presentBodyKeys);
  fake.dailyCount = opts.dailyCount ?? 0;
  fake.speechTexts = [];
  fake.dailyUnitWrites = 0;
  fake.unexpected = [];
}

// Every narration clip (greetings, intros, transitions, closings, per-user
// greetings) is treated as present, so the time of day cannot change the
// outcome. Only the chapter body clips vary per case.
function isPresent(key: string): boolean {
  return key.startsWith("book-content/audio-segments/") || fake.presentBodyKeys.has(key);
}

function clipBytes(key: string): string {
  return `clip:${key}|`;
}

function s3Body(text: string) {
  const bytes = Buffer.from(text);
  return {
    transformToByteArray: async () => new Uint8Array(bytes),
    transformToString: async () => text,
  };
}

function awsError(name: string, httpStatusCode: number): Error {
  return Object.assign(new Error(name), { name, $metadata: { httpStatusCode } });
}

type SdkCommand = { constructor: { name: string }; input: Record<string, unknown> };
type SendFn = (command: SdkCommand) => Promise<unknown>;

function replaceSend(prototype: object, send: SendFn): void {
  (prototype as { send: SendFn }).send = send;
}

// Any AWS client without its own fake below fails loudly instead of reaching AWS.
const smithy = require("@smithy/smithy-client") as { Client: { prototype: object } };
replaceSend(smithy.Client.prototype, async (command) => {
  fake.unexpected.push(`aws ${command.constructor.name}`);
  throw new Error(`AWS command not faked in this test: ${command.constructor.name}`);
});

replaceSend(S3Client.prototype, async (command) => {
  const name = command.constructor.name;
  const key = String(command.input.Key ?? "");
  if (name === "GetObjectCommand") {
    if (key === PACKAGE_KEY) return { Body: s3Body(JSON.stringify(BOOK_PACKAGE)) };
    if (key.startsWith(`${CONTENT_PREFIX}/chapters/`)) {
      return { Body: s3Body(JSON.stringify({ bookId: BOOK_ID })) };
    }
    if (isPresent(key)) return { Body: s3Body(clipBytes(key)) };
    throw awsError("NoSuchKey", 404);
  }
  if (name === "HeadObjectCommand") {
    if (isPresent(key)) return { ContentLength: Buffer.byteLength(clipBytes(key)) };
    throw awsError("NotFound", 404);
  }
  if (name === "PutObjectCommand") return {};
  fake.unexpected.push(`S3 ${name}`);
  throw new Error(`S3 command not faked in this test: ${name}`);
});

// No runtime secret exists in the parameter store.
replaceSend(SSMClient.prototype, async () => {
  throw awsError("ParameterNotFound", 400);
});

function itemFor(sk: string): Record<string, unknown> | undefined {
  if (sk === "ENTITLEMENT") {
    return { PK: USER_PK, SK: sk, plan: "PRO", proStatus: "active", proSource: "admin" };
  }
  if (sk === `PROGRESS#${BOOK_ID}`) {
    return {
      PK: USER_PK,
      SK: sk,
      bookId: BOOK_ID,
      pinnedBookVersion: 1,
      contentPrefix: CONTENT_PREFIX,
      manifestKey: "",
      currentChapterNumber: 1,
      unlockedThroughChapterNumber: 99,
    };
  }
  if (sk === "STREAK") return { PK: USER_PK, SK: sk, currentStreak: 1, longestStreak: 1 };
  if (sk === "TIER") return { PK: USER_PK, SK: sk, totalLoopsCompleted: 2, completedBooksByCategory: {} };
  return undefined; // profile, settings, quiz state, catalog row: absent
}

replaceSend(DynamoDBDocumentClient.prototype, async (command) => {
  const name = command.constructor.name;
  const sk = String((command.input.Key as { SK?: unknown } | undefined)?.SK ?? "");
  if (name === "GetCommand") return { Item: itemFor(sk) };
  if (name === "UpdateCommand" && sk.startsWith("AUDIO_TTS_LIMIT#")) {
    fake.dailyUnitWrites += 1;
    const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
    if (fake.dailyCount >= Number(values[":limit"])) {
      throw new ConditionalCheckFailedException({
        message: "The conditional request failed",
        $metadata: {},
      });
    }
    fake.dailyCount += 1;
    return {};
  }
  fake.unexpected.push(`DynamoDB ${name} ${sk}`);
  throw new Error(`DynamoDB command not faked in this test: ${name} ${sk}`);
});

// Only the speech endpoint answers; any other outbound request fails.
const SPEECH_URL_PREFIX = "https://api.elevenlabs.io/v1/text-to-speech/";
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(SPEECH_URL_PREFIX)) {
    fake.unexpected.push(`fetch ${url}`);
    throw new Error(`unexpected fetch in this test: ${url}`);
  }
  const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string };
  fake.speechTexts.push(body.text ?? "");
  return new Response(Buffer.from(`speech-${fake.speechTexts.length}|`), {
    status: 200,
    headers: { "content-type": "audio/mpeg" },
  });
}) as typeof fetch;

// ── Route under test ─────────────────────────────────────────────────────────

let GET: typeof import("./route").GET;
const logEvents: string[] = [];

before(async () => {
  const { setLogSink } = await import("@/lib/logging/logger");
  setLogSink((_level, line) => {
    logEvents.push(line);
  });
  ({ GET } = await import("./route"));
});

type RouteResult = {
  status: number;
  contentType: string;
  text: string;
  errorCode: string | undefined;
  errorMessage: string | undefined;
  planTypes: string[] | undefined;
};

async function callRoute(chapter: number, opts: { plan?: boolean } = {}): Promise<RouteResult> {
  const qs = `tone=direct&variant=medium${opts.plan ? "&mode=plan" : ""}`;
  const req = new Request(
    `http://localhost:3000/app/api/book/books/${BOOK_ID}/chapters/${chapter}/audio?${qs}`,
  );
  const res = await GET(req, {
    params: Promise.resolve({ bookId: BOOK_ID, chapterNumber: String(chapter) }),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const text = Buffer.from(await res.arrayBuffer()).toString("utf-8");
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let planTypes: string[] | undefined;
  if (contentType.includes("json")) {
    const json = JSON.parse(text) as {
      error?: { code?: string; message?: string };
      segments?: Array<{ type: string }>;
    };
    errorCode = json.error?.code;
    errorMessage = json.error?.message;
    planTypes = json.segments?.map((s) => s.type);
  }
  return { status: res.status, contentType, text, errorCode, errorMessage, planTypes };
}

function assertNoUnexpectedCalls(): void {
  assert.deepEqual(fake.unexpected, []);
}

const NOT_CACHED_MESSAGE =
  "Audio generation is not available — chapter audio has not been cached yet";

// ── No speech key ────────────────────────────────────────────────────────────

test("no speech key: summary and takeaways cached, no recap text → 200 audio", async () => {
  assert.equal(process.env.ELEVENLABS_API_KEY, undefined);
  resetFakes({ presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")] });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(res.contentType, "audio/mpeg");
  assert.ok(res.text.includes(clipBytes(bodyKey(1, "summary"))));
  assert.ok(res.text.includes(clipBytes(bodyKey(1, "takeaways"))));
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
  assertNoUnexpectedCalls();
});

test("no speech key: summary not cached → 503 tts_unavailable", async () => {
  resetFakes({ presentBodyKeys: [bodyKey(1, "takeaways")] });

  const res = await callRoute(1);

  assert.equal(res.status, 503);
  assert.equal(res.errorCode, "tts_unavailable");
  assert.equal(res.errorMessage, NOT_CACHED_MESSAGE);
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
  assertNoUnexpectedCalls();
});

test("no speech key: mode=plan with summary and takeaways cached → 200 plan without recap", async () => {
  resetFakes({ presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")] });

  const res = await callRoute(1, { plan: true });

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.ok(res.planTypes);
  assert.ok(res.planTypes.includes("summary"));
  assert.ok(res.planTypes.includes("takeaways"));
  assert.ok(!res.planTypes.includes("recap"));
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
  assertNoUnexpectedCalls();
});

test("no speech key: chapter without takeaways text, summary cached → 200 audio", async () => {
  resetFakes({ presentBodyKeys: [bodyKey(2, "summary")] });

  const res = await callRoute(2);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(res.contentType, "audio/mpeg");
  assert.ok(res.text.includes(clipBytes(bodyKey(2, "summary"))));
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
  assertNoUnexpectedCalls();
});

test("no speech key: a cached recap clip still plays although the chapter has no recap text", async () => {
  resetFakes({
    presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways"), bodyKey(1, "recap")],
  });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.ok(res.text.includes(clipBytes(bodyKey(1, "recap"))));
  assert.equal(fake.speechTexts.length, 0);
  assertNoUnexpectedCalls();
});

// ── With a speech key ────────────────────────────────────────────────────────

function useSpeechKey(): void {
  process.env.ELEVENLABS_API_KEY = "test-speech-key";
}

test("speech key: summary and takeaways cached → 200, nothing generated, no daily unit used", async () => {
  useSpeechKey();
  resetFakes({ presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")] });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(res.contentType, "audio/mpeg");
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
  assertNoUnexpectedCalls();
});

test("speech key: daily limit reached, summary and takeaways cached → 200", async () => {
  useSpeechKey();
  resetFakes({
    presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")],
    dailyCount: AUDIO_GENERATION_DAILY_LIMIT,
  });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(res.contentType, "audio/mpeg");
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
  assertNoUnexpectedCalls();
});

test("speech key: mode=plan with summary and takeaways cached → 200, no daily unit used", async () => {
  useSpeechKey();
  resetFakes({ presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")] });

  const res = await callRoute(1, { plan: true });

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.ok(res.planTypes);
  assert.ok(!res.planTypes.includes("recap"));
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
  assertNoUnexpectedCalls();
});

test("speech key: summary not cached → 200, only the summary is generated, one daily unit", async () => {
  useSpeechKey();
  resetFakes({ presentBodyKeys: [bodyKey(1, "takeaways")] });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(res.contentType, "audio/mpeg");
  assert.deepEqual(fake.speechTexts, [SUMMARY_ONE]);
  assert.ok(res.text.includes("speech-1|"));
  assert.equal(fake.dailyUnitWrites, 1);
  assertNoUnexpectedCalls();
});

test("speech key: daily limit reached, summary not cached → 429 rate_limited", async () => {
  useSpeechKey();
  resetFakes({
    presentBodyKeys: [bodyKey(1, "takeaways")],
    dailyCount: AUDIO_GENERATION_DAILY_LIMIT,
  });

  const res = await callRoute(1);

  assert.equal(res.status, 429);
  assert.equal(res.errorCode, "rate_limited");
  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 1);
  assertNoUnexpectedCalls();
});
