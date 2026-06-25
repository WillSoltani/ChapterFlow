import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { processWeeklyDigest } from "./weekly-digest";

const ddbMock = mockClient(DynamoDBDocumentClient);
const sesMock = mockClient(SESv2Client);

const TABLE = "ChapterFlowAppTest";

const config = {
  senderEmail: "info@test",
  senderName: "ChapterFlow",
  supportAddress: "support@test",
  postalAddress: "1 St",
  appBaseUrl: "https://app.test",
  secret: "secret",
  configurationSet: "cfg",
};

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
const ses = new SESv2Client({ region: "us-east-1" });

// weekly-digest only runs on Sundays, so the tests pin `Date` to a known instant.
// 2024-01-07 is a Sunday, 2024-01-08 is a Monday.
const RealDate = Date;
function pinDate(iso: string) {
  const fixedMs = RealDate.parse(iso);
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedMs);
      } else {
        // @ts-expect-error forward ctor args to the real Date
        super(...args);
      }
    }
    static now() {
      return fixedMs;
    }
  }
  global.Date = FixedDate as unknown as DateConstructor;
}

beforeEach(() => {
  ddbMock.reset();
  sesMock.reset();
  pinDate("2024-01-07T12:00:00.000Z"); // Sunday
});

afterEach(() => {
  global.Date = RealDate;
});

function userItems(n: number) {
  // Email channel OFF so the best-effort SES path is skipped; the test focuses on
  // the per-user DynamoDB round-trips (the serial cost that blew the timeout).
  return Array.from({ length: n }, (_, i) => ({
    PK: `BOOKUSER#user-${i}`,
    userId: `user-${i}`,
    settings: { notifications: { channels: { email: false } } },
  }));
}

test("processes users concurrently — not one serial await-chain (the F5 regression)", async () => {
  // Make the FIRST read of each user (its dedup GET) hang briefly so we can observe
  // how many users are in flight at once. A serial implementation would never have
  // more than ONE user mid-flight; the parallelized one fans out up to the bound.
  let inFlight = 0;
  let maxInFlight = 0;

  ddbMock.on(GetCommand).callsFake(async (input) => {
    if (String(input.Key?.SK ?? "").startsWith("NUDGE_SENT#weekly_digest#")) {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return { Item: undefined }; // not yet sent this week
    }
    return { Item: undefined }; // STREAK / ENGAGEMENT / PROFILE all empty
  });
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(PutCommand).resolves({});

  const result = await processWeeklyDigest(ddb, ses, TABLE, config, userItems(20) as never);

  assert.equal(result.sent, 20, "every user gets a digest");
  assert.ok(
    maxInFlight > 1,
    `expected concurrent fan-out, but saw max ${maxInFlight} user(s) in flight — still serial`,
  );
});

test("dedup is intact: an already-digested user is skipped with no NOTIF/marker writes", async () => {
  const weekKey = new Date().toISOString().slice(0, 10);
  const dedupSK = `NUDGE_SENT#weekly_digest#${weekKey}`;

  ddbMock.on(GetCommand).callsFake(async (input) => {
    if (input.Key?.SK === dedupSK) {
      return { Item: { PK: input.Key.PK, SK: dedupSK } }; // already sent this week
    }
    return { Item: undefined };
  });
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(PutCommand).resolves({});

  const result = await processWeeklyDigest(ddb, ses, TABLE, config, userItems(3) as never);

  assert.deepEqual(result, { sent: 0, skipped: 3 }, "all three dedup-skip");
  assert.equal(ddbMock.commandCalls(PutCommand).length, 0, "no NOTIF# or dedup-marker writes");
});

test("a single bad user is isolated — the rest of the fan-out still completes", async () => {
  // user-1's dedup GET throws; with per-user isolation the other two still send.
  // The OLD serial loop had no try/catch, so this error would abort the whole pass.
  ddbMock.on(GetCommand).callsFake(async (input) => {
    if (input.Key?.PK === "BOOKUSER#user-1" && String(input.Key?.SK).startsWith("NUDGE_SENT#")) {
      throw new Error("dynamo down for user-1");
    }
    return { Item: undefined };
  });
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(PutCommand).resolves({});

  const result = await processWeeklyDigest(ddb, ses, TABLE, config, userItems(3) as never);

  assert.equal(result.sent, 2, "the two healthy users still get their digest");
});

test("each sent user writes exactly one NOTIF# + one dedup marker (no duplicates)", async () => {
  ddbMock.on(GetCommand).resolves({ Item: undefined });
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(PutCommand).resolves({});

  const result = await processWeeklyDigest(ddb, ses, TABLE, config, userItems(4) as never);

  assert.equal(result.sent, 4);
  const puts = ddbMock.commandCalls(PutCommand);
  const notifPuts = puts.filter((p) =>
    String((p.args[0].input as { Item?: { SK?: string } }).Item?.SK ?? "").startsWith("NOTIF#"),
  );
  const markerPuts = puts.filter((p) =>
    String((p.args[0].input as { Item?: { SK?: string } }).Item?.SK ?? "").startsWith(
      "NUDGE_SENT#weekly_digest#",
    ),
  );
  assert.equal(notifPuts.length, 4, "one NOTIF# per user");
  assert.equal(markerPuts.length, 4, "one dedup marker per user");
});

test("not Sunday → no-op, no per-user IO", async () => {
  pinDate("2024-01-08T12:00:00.000Z"); // Monday

  ddbMock.on(GetCommand).resolves({ Item: undefined });
  ddbMock.on(QueryCommand).resolves({ Items: [] });
  ddbMock.on(PutCommand).resolves({});

  const result = await processWeeklyDigest(ddb, ses, TABLE, config, userItems(5) as never);

  assert.deepEqual(result, { sent: 0, skipped: 0 });
  assert.equal(ddbMock.commandCalls(GetCommand).length, 0, "no per-user IO off-Sunday");
});
