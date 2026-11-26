import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { installRouteHarness } from "@/tests/_lib/route-harness";
import type { ErasureResult } from "./account-erasure";
import type { GreetingAudioErasure } from "./erasure-greeting-audio-core";

// Hard erasure removes the reader's spoken-name greeting clips from the content
// bucket, and a storage failure there never stops the erasure: it is reported as
// a residual warning (without the user id) and marks the erasure partial, and
// the permanent audit item is still written. Every other store succeeds in this
// test, so `partial` reflects the greeting-clip step alone.

const TABLE = "test-book-table";
const ANALYTICS = "test-analytics-table";
const USER_ID = "user-7f3a";
const NAMES = "book-content/audio-segments/names/";

type Command = { constructor: { name: string }; input: Record<string, unknown> };

const fake = {
  /** The greeting-clip step itself rejects (a broken promise, not a storage error). */
  wrapperRejects: false,
  s3Fails: false,
  s3Deletes: [] as string[],
  auditItems: [] as Record<string, unknown>[],
  errorLogs: [] as { event: string; fields: Record<string, unknown> }[],
};

const ddbDoc = {
  async send(command: Command) {
    const name = command.constructor.name;
    if (name === "QueryCommand") return { Items: [] };
    if (name === "BatchWriteCommand") return { UnprocessedItems: {} };
    if (name === "UpdateCommand") return {};
    if (name === "PutCommand") {
      fake.auditItems.push(command.input.Item as Record<string, unknown>);
      return {};
    }
    throw new Error(`unexpected DynamoDB command ${name}`);
  },
};

const s3 = {
  async send(command: Command) {
    const name = command.constructor.name;
    if (fake.s3Fails) {
      throw Object.assign(new Error(`Access Denied for ${String(command.input.Prefix ?? command.input.Key)}`), {
        name: "AccessDenied",
      });
    }
    if (name === "ListObjectVersionsCommand") {
      const prefix = String(command.input.Prefix);
      return prefix.endsWith("-evening.")
        ? { Versions: [{ Key: `${prefix}mp3`, VersionId: "v1" }], IsTruncated: false }
        : { IsTruncated: false };
    }
    if (name === "DeleteObjectCommand") {
      fake.s3Deletes.push(`${String(command.input.Key)}@${String(command.input.VersionId)}`);
      return {};
    }
    throw new Error(`unexpected S3 command ${name}`);
  },
};

const noop = async () => {};

// The real S3 wrapper, loaded through its alias specifier so the relative stub
// key below does not intercept it. The stub passes through to it unless a case
// makes the step reject outright.
let realEraseUserGreetingAudio: (userId: string) => Promise<GreetingAudioErasure>;

const harness = installRouteHarness({
  "@/app/app/api/_lib/aws": { ddbDoc, s3 },
  "@/app/app/api/_lib/server-env": {
    async getServerEnv(name: string) {
      if (name === "COGNITO_USER_POOL_ID") return "test-pool";
      if (name === "EMAIL_UNSUBSCRIBE_SECRET") return "test-secret";
      return null;
    },
  },
  "./env": { getBookContentBucket: async () => "test-content-bucket" },
  "./erasure-greeting-audio": {
    eraseUserGreetingAudio(userId: string) {
      if (fake.wrapperRejects) {
        return Promise.reject(
          Object.assign(new Error(`unexpected failure for ${userId} at ${NAMES}${userId}-morning.mp3`), {
            name: "AccessDenied",
          }),
        );
      }
      return realEraseUserGreetingAudio(userId);
    },
  },
  "./cognito-admin": {
    getCognitoClient: () => ({
      async send(command: Command) {
        if (command.constructor.name === "ListUsersCommand") return { Users: [{ Username: "reader" }] };
        return {};
      },
    }),
  },
  "./stripe-service": { getStripeClient: async () => ({ customers: { del: noop } }) },
  "./repo": { getUserEntitlement: async () => null, setAccountStatus: noop },
  "./ops-failure-repo": { recordOpsFailure: noop },
  "./cloudwatch-metrics": { putOpsMetric: noop },
  "@/lib/logging/logger": {
    logger: {
      info: () => {},
      warn: () => {},
      error: (event: string, fields: Record<string, unknown> = {}) => fake.errorLogs.push({ event, fields }),
    },
  },
});

let eraseUserData: (
  tableName: string,
  analyticsTable: string | undefined,
  userId: string,
  erasedBy: string,
) => Promise<ErasureResult>;

before(async () => {
  ({ eraseUserGreetingAudio: realEraseUserGreetingAudio } = await import(
    "@/app/app/api/book/_lib/erasure-greeting-audio"
  ));
  ({ eraseUserData } = await import("./account-erasure"));
});
after(() => harness.restore());
beforeEach(() => {
  fake.wrapperRejects = false;
  fake.s3Fails = false;
  fake.s3Deletes = [];
  fake.auditItems = [];
  fake.errorLogs = [];
});

test("a storage failure on the greeting clips marks the erasure partial but never stops it", async () => {
  fake.s3Fails = true;

  const result = await eraseUserData(TABLE, ANALYTICS, USER_ID, "admin:op");

  assert.equal(result.greetingAudio, "failed");
  assert.equal(result.partial, true);
  assert.equal(result.cognitoUser, "deleted", "later steps still ran");

  const warning = result.residualWarnings.find((w) => w.startsWith("Spoken-name audio"));
  assert.equal(
    warning,
    "Spoken-name audio clips were NOT fully removed from storage (AccessDenied). Run the erasure again to retry.",
  );

  assert.equal(fake.auditItems.length, 1, "the permanent audit item is still written");
  const audit = JSON.stringify(fake.auditItems[0]);
  assert.ok(!audit.includes(USER_ID), "the audit item never holds the user id");
  assert.ok(!audit.includes(NAMES), "the audit item never holds a clip name");

  const log = fake.errorLogs.find((l) => l.event === "account_erase_greeting_audio_failed");
  assert.deepEqual(log?.fields, { errorName: "AccessDenied" });
});

test("with storage working the greeting clips are deleted and add no warning", async () => {
  const result = await eraseUserData(TABLE, ANALYTICS, USER_ID, "admin:op");

  assert.equal(result.greetingAudio, "deleted");
  assert.deepEqual(fake.s3Deletes, [`${NAMES}${USER_ID}-evening.mp3@v1`]);
  assert.equal(result.partial, false);
  assert.ok(!result.residualWarnings.some((w) => w.includes("Spoken-name")));
  assert.equal(fake.auditItems[0]?.greetingAudio, "deleted");
  assert.equal(fake.errorLogs.length, 0);
});

test("a greeting-clip step that rejects outright never aborts the erasure", async () => {
  fake.wrapperRejects = true;

  const result = await eraseUserData(TABLE, ANALYTICS, USER_ID, "admin:op");

  assert.equal(result.greetingAudio, "failed");
  assert.equal(result.partial, true);
  assert.equal(result.cognitoUser, "deleted", "later steps still ran");

  const warning = result.residualWarnings.find((w) => w.startsWith("Spoken-name audio"));
  assert.equal(
    warning,
    "Spoken-name audio clips were NOT fully removed from storage (unknown). Run the erasure again to retry.",
  );

  assert.equal(fake.auditItems.length, 1, "the permanent audit item is still written");
  const audit = JSON.stringify(fake.auditItems[0]);
  assert.ok(!audit.includes(USER_ID), "the audit item never holds the user id");
  assert.ok(!audit.includes(NAMES), "the audit item never holds a clip name");

  const log = fake.errorLogs.find((l) => l.event === "account_erase_greeting_audio_failed");
  assert.deepEqual(log?.fields, { errorName: "unknown" });
});
