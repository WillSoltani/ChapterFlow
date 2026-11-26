import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { S3Client } from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import {
  buildTakeawayText,
  chapterBodyClipS3Key,
  getUserGreetingScript,
  splitSpeechText,
  userGreetingS3Key,
  SPEECH_SETTINGS,
  TTS_UNAVAILABLE_MESSAGE,
  type BodySegmentType,
} from "@/app/app/api/book/_lib/audio-narration-core";
import { AUDIO_GENERATION_DAILY_LIMIT } from "./audio-generation-limit-core";

// Route-level regression coverage for the chapter audio GET. It drives the real
// exported handler; only the outer edges are replaced: the AWS SDK clients'
// `send`, the outbound speech `fetch`, the `server-only` marker and
// `next/headers`. A small synthetic book package is served from the fake S3.
//
// Rules under test:
// - A chapter body part (summary, takeaways, recap) with no text for this
//   chapter can never be generated, so it is not missing audio: it never causes
//   503 and never reserves a daily generation unit.
// - Body clips are stored under a name derived from the exact text sent to
//   speech, so every tone and variant that plays the same text shares one clip.
// - A body part with text that cannot be produced answers 503 tts_unavailable;
//   every write of generated audio is awaited.
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
const USER_ID = "dev-local-user"; // the synthetic signed-in user
const READER_NAME = "Quillon Readwell"; // display name from the reader's profile
const SUMMARY_ONE = "Chapter one explains why small steps add up over a year.";
const SUMMARY_TWO = "Chapter two explains how a plan survives a bad week.";
const LINES_ONE = ["Start smaller than feels useful.", "Repeat before you improve."];
// The takeaways text the route builds for chapter 1 from its memorable lines.
const TAKEAWAYS_ONE = buildTakeawayText(LINES_ONE.map((point) => ({ point, moreDetails: "" })));

function words(prefix: string, length: number): string {
  let out = "";
  for (let i = 0; out.length < length; i += 1) out += `${out ? " " : ""}${prefix}${i}`;
  return out.slice(0, length).trim();
}

// Chapter 3's summary is longer than one speech call: two paragraphs, two chunks.
const SUMMARY_THREE_PART_ONE = words("week", 3000);
const SUMMARY_THREE_PART_TWO = words("month", 3000);
const SUMMARY_THREE = `${SUMMARY_THREE_PART_ONE}\n\n${SUMMARY_THREE_PART_TWO}`;

// Chapter 1 has summary and takeaways text; chapter 2 has a summary only (no
// memorable lines, so no takeaways); chapter 3 has a two-chunk summary only;
// chapter 4 has no summary text at all. None has recap text.
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
      memorableLines: LINES_ONE.map((text) => ({ text })),
    },
    {
      chapterId: "ch-2",
      number: 2,
      title: "Bad weeks",
      breakdown: { fastRead: SUMMARY_TWO, deepRead: SUMMARY_TWO, fullRead: SUMMARY_TWO },
    },
    {
      chapterId: "ch-3",
      number: 3,
      title: "Long view",
      breakdown: { fastRead: SUMMARY_THREE, deepRead: SUMMARY_THREE, fullRead: SUMMARY_THREE },
    },
    {
      chapterId: "ch-4",
      number: 4,
      title: "Empty",
    },
  ],
};

const PACKAGE_KEY = `book-content/packages/${BOOK_ID}.v21.json`;
const CONTENT_PREFIX = `book-content/test-published/${BOOK_ID}/v1`;
const USER_PK = `BOOKUSER#${USER_ID}`;
const GREETING_PREFIX = "book-content/audio-segments/names/";

const BODY_TEXT: Record<number, Partial<Record<BodySegmentType, string>>> = {
  1: { summary: SUMMARY_ONE, takeaways: TAKEAWAYS_ONE },
  2: { summary: SUMMARY_TWO },
  3: { summary: SUMMARY_THREE },
};

function bodyKey(chapter: number, segment: BodySegmentType): string {
  const text = BODY_TEXT[chapter]?.[segment];
  assert.ok(text, `no ${segment} text for chapter ${chapter} in this test`);
  return chapterBodyClipS3Key(BOOK_ID, chapter, segment, splitSpeechText(text));
}

// The name a body clip had before clips were named by their content.
function oldStyleBodyKey(chapter: number, segment: BodySegmentType): string {
  return `book-content/audio/${BOOK_ID}/ch${String(chapter).padStart(4, "0")}.direct.medium.${segment}.mp3`;
}

const TIMES_OF_DAY = ["morning", "afternoon", "evening"] as const;

// The name a greeting clip had before clips were named by their content.
function oldStyleGreetingKeys(): string[] {
  return TIMES_OF_DAY.map((tod) => `${GREETING_PREFIX}${USER_ID}-${tod}.mp3`);
}

// The names of the three greeting clips for a display name.
function greetingKeys(name: string = READER_NAME): string[] {
  return TIMES_OF_DAY.map((tod) => userGreetingS3Key(USER_ID, tod, name));
}

// ── Fake state ───────────────────────────────────────────────────────────────

type SpeechFailure = { status: number } | "throw" | "empty" | null;

const fake = {
  /** Chapter body clips that exist in storage before the request. */
  presentBodyKeys: new Set<string>(),
  /** Objects the route wrote (the write completed), by key. */
  stored: new Map<string, Buffer>(),
  /** Keys of completed writes, in completion order. */
  writes: [] as string[],
  /** Every S3 write fails. */
  failWrites: false,
  /** The per-user greeting clips are absent from storage. */
  greetingsAbsent: false,
  /** When set, exactly these greeting clips exist in storage (overrides greetingsAbsent). */
  presentGreetingKeys: null as Set<string> | null,
  /** Today's daily generation count before the request. */
  dailyCount: 0,
  /** Texts sent to the speech endpoint, in call order. */
  speechTexts: [] as string[],
  /** Decides whether the Nth speech call (1-based) for this text fails. */
  speechFailure: null as ((text: string, call: number) => SpeechFailure) | null,
  /** Daily generation counter updates the route attempted. */
  dailyUnitWrites: 0,
  unexpected: [] as string[],
};

function resetFakes(opts: {
  presentBodyKeys?: string[];
  dailyCount?: number;
  failWrites?: boolean;
  greetingsAbsent?: boolean;
  presentGreetingKeys?: string[];
  speechFailure?: (text: string, call: number) => SpeechFailure;
}): void {
  fake.presentBodyKeys = new Set(opts.presentBodyKeys ?? []);
  fake.stored = new Map();
  fake.writes = [];
  fake.failWrites = opts.failWrites ?? false;
  fake.greetingsAbsent = opts.greetingsAbsent ?? false;
  fake.presentGreetingKeys = opts.presentGreetingKeys ? new Set(opts.presentGreetingKeys) : null;
  fake.dailyCount = opts.dailyCount ?? 0;
  fake.speechTexts = [];
  fake.speechFailure = opts.speechFailure ?? null;
  fake.dailyUnitWrites = 0;
  fake.unexpected = [];
}

// Every narration clip (greetings, intros, transitions, closings, per-user
// greetings unless switched off) is treated as present, so the time of day
// cannot change the outcome. Only the chapter body clips vary per case.
function isPresent(key: string): boolean {
  if (fake.stored.has(key)) return true;
  if (key.startsWith(GREETING_PREFIX)) {
    return fake.presentGreetingKeys ? fake.presentGreetingKeys.has(key) : !fake.greetingsAbsent;
  }
  return key.startsWith("book-content/audio-segments/") || fake.presentBodyKeys.has(key);
}

function clipBytes(key: string): string {
  return `clip:${key}|`;
}

function objectBytes(key: string): Buffer {
  return fake.stored.get(key) ?? Buffer.from(clipBytes(key));
}

function s3Body(text: string | Buffer) {
  const bytes = Buffer.from(text);
  return {
    transformToByteArray: async () => new Uint8Array(bytes),
    transformToString: async () => bytes.toString("utf-8"),
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
    if (isPresent(key)) return { Body: s3Body(objectBytes(key)) };
    throw awsError("NoSuchKey", 404);
  }
  if (name === "HeadObjectCommand") {
    if (isPresent(key)) return { ContentLength: objectBytes(key).length };
    throw awsError("NotFound", 404);
  }
  if (name === "PutObjectCommand") {
    // A write takes a little time, so a write that is not awaited has not
    // completed when the response is returned.
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (fake.failWrites) throw awsError("InternalError", 500);
    fake.stored.set(key, Buffer.from(command.input.Body as Buffer));
    fake.writes.push(key);
    return {};
  }
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
  if (sk === "PROFILE") return { PK: USER_PK, SK: sk, profile: { displayName: READER_NAME } };
  if (sk === "STREAK") return { PK: USER_PK, SK: sk, currentStreak: 1, longestStreak: 1 };
  if (sk === "TIER") return { PK: USER_PK, SK: sk, totalLoopsCompleted: 2, completedBooksByCategory: {} };
  return undefined; // settings, quiz state, catalog row: absent
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

// Only the speech endpoint answers; any other outbound request fails. Every
// speech request must use the one set of speech settings (voice, output format,
// model and voice settings); a request that differs is recorded as unexpected.
const SPEECH_URL_PREFIX = "https://api.elevenlabs.io/v1/text-to-speech/";
const SPEECH_URL = `${SPEECH_URL_PREFIX}${SPEECH_SETTINGS.voiceId}?output_format=${SPEECH_SETTINGS.outputFormat}`;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(SPEECH_URL_PREFIX)) {
    fake.unexpected.push(`fetch ${url}`);
    throw new Error(`unexpected fetch in this test: ${url}`);
  }
  if (url !== SPEECH_URL) fake.unexpected.push(`speech url ${url}`);
  const body = JSON.parse(String(init?.body ?? "{}")) as {
    text?: string;
    model_id?: unknown;
    voice_settings?: unknown;
  };
  if (body.model_id !== SPEECH_SETTINGS.modelId) {
    fake.unexpected.push(`speech model ${String(body.model_id)}`);
  }
  try {
    assert.deepEqual(body.voice_settings, SPEECH_SETTINGS.voiceSettings);
  } catch {
    fake.unexpected.push(`speech voice settings ${JSON.stringify(body.voice_settings)}`);
  }
  const text = body.text ?? "";
  fake.speechTexts.push(text);
  const call = fake.speechTexts.length;
  const failure = fake.speechFailure?.(text, call) ?? null;
  if (failure === "throw") throw new TypeError("fetch failed");
  if (failure === "empty") {
    return new Response(new Uint8Array(0), { status: 200, headers: { "content-type": "audio/mpeg" } });
  }
  if (failure) return new Response("speech service error", { status: failure.status });
  return new Response(Buffer.from(`speech-${call}|`), {
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
  /** type → S3 key each plan URL points at. */
  planKeys: Record<string, string> | undefined;
  /** type → caption text of each plan segment that has one. */
  planTexts: Record<string, string> | undefined;
  /** Keys whose write had completed when the handler returned its response. */
  writesAtResponse: string[];
  /** Log lines written during this request. */
  logs: string[];
};

async function callRoute(
  chapter: number,
  opts: { plan?: boolean; tone?: string; variant?: string } = {},
): Promise<RouteResult> {
  const qs = `tone=${opts.tone ?? "direct"}&variant=${opts.variant ?? "medium"}${opts.plan ? "&mode=plan" : ""}`;
  const req = new Request(
    `http://localhost:3000/app/api/book/books/${BOOK_ID}/chapters/${chapter}/audio?${qs}`,
  );
  const logStart = logEvents.length;
  const res = await GET(req, {
    params: Promise.resolve({ bookId: BOOK_ID, chapterNumber: String(chapter) }),
  });
  const writesAtResponse = [...fake.writes];
  const contentType = res.headers.get("content-type") ?? "";
  const text = Buffer.from(await res.arrayBuffer()).toString("utf-8");
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let planTypes: string[] | undefined;
  let planKeys: Record<string, string> | undefined;
  let planTexts: Record<string, string> | undefined;
  if (contentType.includes("json")) {
    const json = JSON.parse(text) as {
      error?: { code?: string; message?: string };
      segments?: Array<{ type: string; url: string; text?: string }>;
    };
    errorCode = json.error?.code;
    errorMessage = json.error?.message;
    planTypes = json.segments?.map((s) => s.type);
    if (json.segments) {
      planTexts = Object.fromEntries(
        json.segments.flatMap((s) => (s.text === undefined ? [] : [[s.type, s.text] as const])),
      );
      planKeys = Object.fromEntries(
        json.segments.map((s) => [s.type, decodeURIComponent(new URL(s.url).pathname.slice(1))]),
      );
    }
  }
  return {
    status: res.status,
    contentType,
    text,
    errorCode,
    errorMessage,
    planTypes,
    planKeys,
    planTexts,
    writesAtResponse,
    logs: logEvents.slice(logStart),
  };
}

function assertNoUnexpectedCalls(): void {
  assert.deepEqual(fake.unexpected, []);
}

function logsOf(res: RouteResult, event: string): Array<Record<string, unknown>> {
  return res.logs
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((entry) => entry.event === event);
}

function assertTtsUnavailable(res: RouteResult): void {
  assert.equal(res.status, 503, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(res.errorCode, "tts_unavailable");
  assert.equal(res.errorMessage, TTS_UNAVAILABLE_MESSAGE);
}

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

  assertTtsUnavailable(res);
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

test("no speech key: clips stored under the previous names are not used → 503 on both paths", async () => {
  const oldNames = [
    oldStyleBodyKey(1, "summary"),
    oldStyleBodyKey(1, "takeaways"),
    oldStyleBodyKey(1, "recap"),
  ];
  resetFakes({ presentBodyKeys: oldNames });

  const stream = await callRoute(1);
  assertTtsUnavailable(stream);
  assert.ok(!stream.text.includes("clip:book-content/audio/"));

  const plan = await callRoute(1, { plan: true });
  assertTtsUnavailable(plan);

  assert.equal(fake.speechTexts.length, 0);
  assert.equal(fake.dailyUnitWrites, 0);
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
  assert.deepEqual(res.writesAtResponse, [bodyKey(1, "summary")]);
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

test("speech key: mode=plan, daily limit reached, summary not cached → 429 rate_limited", async () => {
  useSpeechKey();
  resetFakes({
    presentBodyKeys: [bodyKey(1, "takeaways")],
    dailyCount: AUDIO_GENERATION_DAILY_LIMIT,
  });

  const res = await callRoute(1, { plan: true });

  assert.equal(res.status, 429, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(res.errorCode, "rate_limited");
  assert.equal(fake.speechTexts.length, 0);
  assertNoUnexpectedCalls();
});

// ── Clips named by content ───────────────────────────────────────────────────

test("first listen: body clips are generated and stored under the name of the text sent to speech", async () => {
  useSpeechKey();
  resetFakes({});

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(fake.speechTexts.length, 2);
  assert.deepEqual([...fake.speechTexts].sort(), [SUMMARY_ONE, TAKEAWAYS_ONE].sort());
  // The stored key of each segment is the key function over the chunks of the
  // exact text that went to speech.
  const summaryText = fake.speechTexts.find((t) => t === SUMMARY_ONE)!;
  const takeawaysText = fake.speechTexts.find((t) => t !== SUMMARY_ONE)!;
  const expected = [
    chapterBodyClipS3Key(BOOK_ID, 1, "summary", splitSpeechText(summaryText)),
    chapterBodyClipS3Key(BOOK_ID, 1, "takeaways", splitSpeechText(takeawaysText)),
  ];
  assert.deepEqual([...res.writesAtResponse].sort(), [...expected].sort());
  assert.deepEqual(expected, [bodyKey(1, "summary"), bodyKey(1, "takeaways")]);
  for (const key of res.writesAtResponse) {
    assert.match(key, /^book-content\/audio\/audio-route-test-book\/ch0001\.(summary|takeaways)\.[0-9a-f]{16}\.mp3$/);
  }
  assert.equal(fake.dailyUnitWrites, 1);
  assertNoUnexpectedCalls();
});

test("sharing: another tone and another variant name with the same text reuse the stored clips", async () => {
  useSpeechKey();
  resetFakes({});

  const first = await callRoute(1);
  assert.equal(first.status, 200, `got ${first.status} ${first.errorCode ?? ""}`);
  assert.equal(fake.speechTexts.length, 2);
  assert.equal(fake.dailyUnitWrites, 1);

  for (const opts of [
    { tone: "gentle" },
    { tone: "competitive" },
    { variant: "balanced" }, // no such variant in the package: plays the medium text
    { tone: "gentle", variant: "balanced" },
  ]) {
    const res = await callRoute(1, opts);
    assert.equal(res.status, 200, `${JSON.stringify(opts)}: got ${res.status} ${res.errorCode ?? ""}`);
    assert.ok(res.text.includes("speech-1|"));
    assert.ok(res.text.includes("speech-2|"));
  }
  assert.equal(fake.speechTexts.length, 2, "no further speech calls");
  assert.equal(fake.dailyUnitWrites, 1, "no further daily units");
  assertNoUnexpectedCalls();
});

test("cross-path: clips generated by the stream are reused by mode=plan", async () => {
  useSpeechKey();
  resetFakes({});

  const stream = await callRoute(1);
  assert.equal(stream.status, 200, `got ${stream.status} ${stream.errorCode ?? ""}`);
  const speechCalls = fake.speechTexts.length;
  const units = fake.dailyUnitWrites;

  const plan = await callRoute(1, { plan: true });

  assert.equal(plan.status, 200, `got ${plan.status} ${plan.errorCode ?? ""}`);
  assert.equal(fake.speechTexts.length, speechCalls);
  assert.equal(fake.dailyUnitWrites, units);
  assert.ok(plan.planKeys);
  assert.equal(plan.planKeys.summary, bodyKey(1, "summary"));
  assert.equal(plan.planKeys.takeaways, bodyKey(1, "takeaways"));
  assertNoUnexpectedCalls();
});

// ── Speech or storage failures ───────────────────────────────────────────────

const failSummary = (status: number) => (text: string) =>
  text === SUMMARY_ONE ? { status } : null;

for (const plan of [false, true]) {
  const path = plan ? "mode=plan" : "stream";

  test(`${path}: speech answers non-2xx for the summary → 503, takeaways stored, one unit`, async () => {
    useSpeechKey();
    resetFakes({ speechFailure: failSummary(500) });

    const res = await callRoute(1, { plan });

    assertTtsUnavailable(res);
    assert.deepEqual(res.writesAtResponse, [bodyKey(1, "takeaways")]);
    assert.ok(!fake.stored.has(bodyKey(1, "summary")));
    assert.equal(fake.dailyUnitWrites, 1);
    const failed = logsOf(res, "audio_tts_failed");
    assert.equal(failed.length, 1);
    assert.equal(failed[0]!.segment, "summary");
    assert.equal(failed[0]!.kind, "http");
    assert.equal(failed[0]!.status, 500);
    assert.equal(failed[0]!.chunk, 0);
    for (const line of res.logs) {
      assert.ok(!line.includes("speech service error"), "no log line carries the speech service's answer");
    }
    assertNoUnexpectedCalls();
  });

  test(`${path}: the speech call fails on the network → 503`, async () => {
    useSpeechKey();
    resetFakes({ speechFailure: (text) => (text === SUMMARY_ONE ? "throw" : null) });

    const res = await callRoute(1, { plan });

    assertTtsUnavailable(res);
    assert.ok(!fake.stored.has(bodyKey(1, "summary")));
    assert.ok(fake.stored.has(bodyKey(1, "takeaways")));
    assert.equal(fake.dailyUnitWrites, 1);
    const failed = logsOf(res, "audio_tts_failed");
    assert.equal(failed.length, 1);
    assert.equal(failed[0]!.kind, "network");
    assert.equal(failed[0]!.status, undefined);
    assertNoUnexpectedCalls();
  });

  test(`${path}: speech answers 2xx with no audio → 503, nothing stored for it`, async () => {
    useSpeechKey();
    resetFakes({ speechFailure: (text) => (text === SUMMARY_ONE ? "empty" : null) });

    const res = await callRoute(1, { plan });

    assertTtsUnavailable(res);
    assert.ok(!fake.stored.has(bodyKey(1, "summary")));
    assert.ok(fake.stored.has(bodyKey(1, "takeaways")));
    assert.equal(fake.dailyUnitWrites, 1);
    const failed = logsOf(res, "audio_tts_failed");
    assert.equal(failed.length, 1);
    assert.equal(failed[0]!.segment, "summary");
    assert.equal(failed[0]!.kind, "empty");
    assert.equal(failed[0]!.status, 200);
    assertNoUnexpectedCalls();
  });

  test(`${path}: the second chunk of a two-chunk summary fails → 503, nothing stored for it`, async () => {
    useSpeechKey();
    resetFakes({ speechFailure: (text) => (text === SUMMARY_THREE_PART_TWO ? { status: 502 } : null) });

    const res = await callRoute(3, { plan });

    assertTtsUnavailable(res);
    assert.deepEqual(fake.speechTexts, [SUMMARY_THREE_PART_ONE, SUMMARY_THREE_PART_TWO]);
    assert.deepEqual(res.writesAtResponse, []);
    assert.ok(!fake.stored.has(bodyKey(3, "summary")));
    const failed = logsOf(res, "audio_tts_failed");
    assert.equal(failed.length, 1);
    assert.equal(failed[0]!.chunk, 1);
    assertNoUnexpectedCalls();
  });
}

test("two-chunk summary: both chunks are spoken and stored as one clip", async () => {
  useSpeechKey();
  resetFakes({});

  const res = await callRoute(3);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.deepEqual(fake.speechTexts, [SUMMARY_THREE_PART_ONE, SUMMARY_THREE_PART_TWO]);
  assert.deepEqual(res.writesAtResponse, [bodyKey(3, "summary")]);
  assert.equal(fake.stored.get(bodyKey(3, "summary"))?.toString("utf-8"), "speech-1|speech-2|");
  assertNoUnexpectedCalls();
});

test("stream: the clip write fails → 200 with the full audio, failure logged", async () => {
  useSpeechKey();
  resetFakes({ failWrites: true });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.ok(res.text.includes("speech-1|"));
  assert.ok(res.text.includes("speech-2|"));
  const failed = logsOf(res, "audio_s3_cache_write_failed");
  assert.equal(failed.length, 2);
  assert.deepEqual(failed.map((e) => e.segment).sort(), ["summary", "takeaways"]);
  assertNoUnexpectedCalls();
});

test("mode=plan: the clip write fails → 503", async () => {
  useSpeechKey();
  resetFakes({ failWrites: true });

  const res = await callRoute(1, { plan: true });

  assertTtsUnavailable(res);
  assert.equal(logsOf(res, "audio_s3_cache_write_failed").length, 2);
  assertNoUnexpectedCalls();
});

// ── Per-user greeting ────────────────────────────────────────────────────────

// Covers every log line of the request, debug lines included.
function assertNoPersonalData(res: RouteResult): void {
  for (const line of res.logs) {
    assert.ok(!line.includes(USER_ID), `log line carries the user id: ${line}`);
    assert.ok(!line.includes(READER_NAME), `log line carries the name: ${line}`);
  }
}

test("stream: missing greeting clips are generated and all three writes complete before the response", async () => {
  useSpeechKey();
  resetFakes({
    presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")],
    greetingsAbsent: true,
  });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.equal(fake.speechTexts.length, 3);
  assert.ok(fake.speechTexts.every((t) => t.includes(READER_NAME)));
  assert.deepEqual([...res.writesAtResponse].sort(), greetingKeys().sort());
  assert.ok(res.text.includes("speech-"));
  assert.equal(fake.dailyUnitWrites, 1);
  assert.equal(logsOf(res, "audio_tts_ok").length, 3);
  assertNoPersonalData(res);
  assertNoUnexpectedCalls();
});

test("mode=plan: a missing greeting clip is generated and stored before the response", async () => {
  useSpeechKey();
  resetFakes({
    presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")],
    greetingsAbsent: true,
  });

  const res = await callRoute(1, { plan: true });

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  assert.ok(res.planTypes?.includes("userGreeting"));
  assert.equal(res.writesAtResponse.length, 1);
  assert.ok(greetingKeys().includes(res.writesAtResponse[0]!));
  assert.equal(fake.dailyUnitWrites, 1);
  assertNoPersonalData(res);
  assertNoUnexpectedCalls();
});

for (const plan of [false, true]) {
  const path = plan ? "mode=plan" : "stream";

  test(`${path}: a greeting clip stored for another name is not used`, async () => {
    useSpeechKey();
    const otherName = "Someone Else";
    const otherClips = greetingKeys(otherName);
    resetFakes({
      presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")],
      presentGreetingKeys: [...oldStyleGreetingKeys(), ...otherClips],
    });
    const mine = greetingKeys();
    const myGreetings = TIMES_OF_DAY.map((tod) => getUserGreetingScript(READER_NAME, tod));

    const res = await callRoute(1, { plan });

    assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
    assert.ok(fake.speechTexts.length > 0);
    assert.ok(fake.speechTexts.every((t) => myGreetings.includes(t)));
    if (plan) {
      assert.equal(res.writesAtResponse.length, 1);
      const written = res.writesAtResponse[0]!;
      assert.ok(mine.includes(written));
      assert.equal(res.planKeys?.userGreeting, written);
      assert.ok(myGreetings.includes(res.planTexts?.userGreeting ?? ""));
    } else {
      assert.deepEqual([...res.writesAtResponse].sort(), [...mine].sort());
      assert.ok(res.text.includes("speech-"));
      for (const key of [...otherClips, ...oldStyleGreetingKeys()]) {
        assert.ok(!res.text.includes(clipBytes(key)), `answer carries the clip ${key}`);
      }
    }
    assertNoPersonalData(res);
    assertNoUnexpectedCalls();
  });

  test(`${path}: daily limit reached, greeting missing, body clips stored → 200 without the greeting`, async () => {
    useSpeechKey();
    resetFakes({
      presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")],
      greetingsAbsent: true,
      dailyCount: AUDIO_GENERATION_DAILY_LIMIT,
    });

    const res = await callRoute(1, { plan });

    assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
    assert.equal(fake.speechTexts.length, 0);
    assert.deepEqual(res.writesAtResponse, []);
    if (plan) {
      assert.ok(res.planTypes);
      assert.ok(!res.planTypes.includes("userGreeting"));
      assert.ok(res.planTypes.includes("summary"));
    } else {
      assert.ok(!res.text.includes(GREETING_PREFIX));
      assert.ok(res.text.includes(clipBytes(bodyKey(1, "summary"))));
    }
    assertNoUnexpectedCalls();
  });

  test(`${path}: the greeting speech call fails → 200 without the greeting`, async () => {
    useSpeechKey();
    resetFakes({
      presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")],
      greetingsAbsent: true,
      speechFailure: () => ({ status: 503 }),
    });

    const res = await callRoute(1, { plan });

    assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
    assert.deepEqual(res.writesAtResponse, []);
    if (plan) assert.ok(!res.planTypes?.includes("userGreeting"));
    assertNoPersonalData(res);
    assertNoUnexpectedCalls();
  });

  test(`${path}: the greeting write fails → 200, failure logged with the time of day only`, async () => {
    useSpeechKey();
    resetFakes({
      presentBodyKeys: [bodyKey(1, "summary"), bodyKey(1, "takeaways")],
      greetingsAbsent: true,
      failWrites: true,
    });

    const res = await callRoute(1, { plan });

    assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
    assert.deepEqual(res.writesAtResponse, []);
    if (plan) assert.ok(!res.planTypes?.includes("userGreeting"));
    const failed = logsOf(res, "audio_s3_cache_write_failed");
    assert.equal(failed.length, plan ? 1 : 3);
    for (const entry of failed) {
      assert.equal(entry.segment, "userGreeting");
      assert.ok(["morning", "afternoon", "evening"].includes(String(entry.timeOfDay)));
    }
    assertNoPersonalData(res);
    assertNoUnexpectedCalls();
  });
}

// ── Chapter without summary text ─────────────────────────────────────────────

for (const plan of [false, true]) {
  test(`${plan ? "mode=plan" : "stream"}: chapter without summary text → 404 no_audio, nothing generated`, async () => {
    useSpeechKey();
    resetFakes({});

    const res = await callRoute(4, { plan });

    assert.equal(res.status, 404, `got ${res.status} ${res.errorCode ?? ""}`);
    assert.equal(res.errorCode, "no_audio");
    assert.equal(res.errorMessage, "No audio segments available");
    assert.equal(fake.speechTexts.length, 0);
    assert.equal(fake.dailyUnitWrites, 0);
    assertNoUnexpectedCalls();
  });
}

// ── Measuring logs ───────────────────────────────────────────────────────────

test("a generated clip logs audio_tts_ok with segment, chunks, characters and milliseconds, and no text", async () => {
  useSpeechKey();
  resetFakes({ presentBodyKeys: [bodyKey(1, "takeaways")] });

  const res = await callRoute(1);

  assert.equal(res.status, 200, `got ${res.status} ${res.errorCode ?? ""}`);
  const ok = logsOf(res, "audio_tts_ok");
  assert.equal(ok.length, 1);
  assert.equal(ok[0]!.level, "info");
  assert.equal(ok[0]!.segment, "summary");
  assert.equal(ok[0]!.chunks, 1);
  assert.equal(ok[0]!.characters, SUMMARY_ONE.length);
  assert.equal(typeof ok[0]!.ms, "number");
  for (const line of res.logs) {
    assert.ok(!line.includes(SUMMARY_ONE), "no log line carries the text");
    assert.ok(!line.includes("test-speech-key"), "no log line carries the speech key");
  }
  assertNoUnexpectedCalls();
});
