import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { installRouteHarness } from "@/tests/_lib/route-harness";
import type { GreetingAudioErasure } from "./erasure-greeting-audio-core";

// Seam test for the S3 binding of the greeting-clip erasure step: which bucket
// and prefixes it lists, that it follows list pagination, that it deletes every
// version and delete marker by version id, and that every storage failure comes
// back as `failed` instead of throwing. The decision logic is covered by
// erasure-greeting-audio-core.test.ts.

const BUCKET = "test-content-bucket";
const USER_ID = "user-7f3a";
const NAMES = "book-content/audio-segments/names/";

type Sent = { name: string; input: Record<string, unknown>; abortSignal: unknown };
type Page = {
  Versions?: { Key?: string; VersionId?: string }[];
  DeleteMarkers?: { Key?: string; VersionId?: string }[];
  IsTruncated?: boolean;
  NextKeyMarker?: string;
  NextVersionIdMarker?: string;
};

const fake = {
  sent: [] as Sent[],
  /** Pages per prefix, served in order. */
  pages: new Map<string, Page[]>(),
  listError: null as Error | null,
  deleteError: null as Error | null,
  bucketError: null as Error | null,
};

const s3 = {
  async send(command: { constructor: { name: string }; input: Record<string, unknown> }, opts?: { abortSignal?: unknown }) {
    const name = command.constructor.name;
    fake.sent.push({ name, input: command.input, abortSignal: opts?.abortSignal });
    if (name === "ListObjectVersionsCommand") {
      if (fake.listError) throw fake.listError;
      const prefix = String(command.input.Prefix);
      const pages = fake.pages.get(prefix) ?? [];
      const index = command.input.KeyMarker ? Number(String(command.input.KeyMarker).split("#")[1]) : 0;
      return pages[index] ?? {};
    }
    if (name === "DeleteObjectCommand") {
      if (fake.deleteError) throw fake.deleteError;
      return {};
    }
    throw new Error(`unexpected command ${name}`);
  },
};

const harness = installRouteHarness({
  "@/app/app/api/_lib/aws": { s3 },
  "./env": {
    async getBookContentBucket() {
      if (fake.bucketError) throw fake.bucketError;
      return BUCKET;
    },
  },
});

let eraseUserGreetingAudio: (userId: string) => Promise<GreetingAudioErasure>;

before(async () => {
  ({ eraseUserGreetingAudio } = await import("./erasure-greeting-audio"));
});
after(() => harness.restore());
beforeEach(() => {
  fake.sent = [];
  fake.pages = new Map();
  fake.listError = null;
  fake.deleteError = null;
  fake.bucketError = null;
});

test("lists the three prefixes on the content bucket and deletes every version and delete marker by id, across pages", async () => {
  const morning = `${NAMES}${USER_ID}-morning.`;
  fake.pages.set(morning, [
    {
      Versions: [{ Key: `${morning}mp3`, VersionId: "v1" }, { Key: `${morning}mp3` }],
      DeleteMarkers: [{ Key: `${morning}mp3`, VersionId: "m1" }],
      IsTruncated: true,
      NextKeyMarker: `${morning}page#1`,
      NextVersionIdMarker: "vm-1",
    },
    {
      Versions: [{ Key: `${morning}0123456789abcdef.mp3`, VersionId: "v2" }, { VersionId: "orphan" }],
      DeleteMarkers: [{ Key: `${morning}0123456789abcdef.mp3`, VersionId: "m2" }],
      IsTruncated: false,
    },
  ]);

  const result = await eraseUserGreetingAudio(USER_ID);

  assert.equal(result.outcome, "deleted");
  assert.equal(result.versionsDeleted, 4);

  const lists = fake.sent.filter((s) => s.name === "ListObjectVersionsCommand");
  assert.ok(lists.every((s) => s.input.Bucket === BUCKET));
  assert.deepEqual(
    [...new Set(lists.map((s) => s.input.Prefix))].sort(),
    [`${NAMES}${USER_ID}-afternoon.`, `${NAMES}${USER_ID}-evening.`, morning].sort(),
  );
  const secondPage = lists.find((s) => s.input.KeyMarker);
  assert.deepEqual(
    { prefix: secondPage?.input.Prefix, key: secondPage?.input.KeyMarker, version: secondPage?.input.VersionIdMarker },
    { prefix: morning, key: `${morning}page#1`, version: "vm-1" },
  );

  const deletes = fake.sent.filter((s) => s.name === "DeleteObjectCommand");
  assert.deepEqual(
    deletes.map((s) => `${s.input.Bucket}|${s.input.Key}|${s.input.VersionId}`).sort(),
    [
      `${BUCKET}|${morning}mp3|v1`,
      `${BUCKET}|${morning}mp3|m1`,
      `${BUCKET}|${morning}0123456789abcdef.mp3|v2`,
      `${BUCKET}|${morning}0123456789abcdef.mp3|m2`,
    ].sort(),
  );
  assert.ok(fake.sent.every((s) => s.abortSignal instanceof AbortSignal), "every call gets the abort signal");
});

test("a storage error comes back as failed without throwing", async () => {
  fake.listError = Object.assign(new Error(`Access Denied on ${NAMES}${USER_ID}-morning.`), {
    name: "AccessDenied",
  });

  const result = await eraseUserGreetingAudio(USER_ID);

  assert.equal(result.outcome, "failed");
  assert.equal(result.errorName, "AccessDenied");
  assert.ok(!(result.warning ?? "").includes(USER_ID));
});

test("a failed delete comes back as failed", async () => {
  const evening = `${NAMES}${USER_ID}-evening.`;
  fake.pages.set(evening, [{ Versions: [{ Key: `${evening}mp3`, VersionId: "v1" }] }]);
  fake.deleteError = Object.assign(new Error("denied"), { name: "AccessDenied" });

  const result = await eraseUserGreetingAudio(USER_ID);

  assert.equal(result.outcome, "failed");
  assert.equal(result.versionsDeleted, 0);
});

test("a missing bucket setting comes back as failed without throwing", async () => {
  fake.bucketError = new Error("Missing required server env BOOK_CONTENT_BUCKET");

  const result = await eraseUserGreetingAudio(USER_ID);

  assert.equal(result.outcome, "failed");
  assert.equal(fake.sent.length, 0);
});
