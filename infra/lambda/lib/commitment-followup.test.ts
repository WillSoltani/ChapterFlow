import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { processCommitmentFollowup } from "./commitment-followup";

const ddbMock = mockClient(DynamoDBDocumentClient);
const sesMock = mockClient(SESv2Client);

const TABLE = "ChapterFlowAppTest";
const PK = "BOOKUSER#user-1";

const config = {
  senderEmail: "info@test",
  senderName: "ChapterFlow",
  supportAddress: "support@test",
  postalAddress: "1 St",
  appBaseUrl: "https://app.test",
  secret: "secret",
  configurationSet: "cfg",
};

// A real DynamoDBDocumentClient / SESv2Client — the mockClient intercepts their sends.
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
const ses = new SESv2Client({ region: "us-east-1" });

// One settings row, email channel OFF so the best-effort email path is skipped and
// the test focuses on the in-app NOTIF + dedup-marker + notificationSentAt writes.
const userItems = [
  { PK, settings: { notifications: { channels: { email: false } } } },
];

const pastIso = new Date(Date.now() - 5 * 86400000).toISOString();
const futureIso = new Date(Date.now() + 5 * 86400000).toISOString();

function dueActiveCommitment() {
  return {
    PK,
    SK: "COMMITMENT#c-1",
    commitmentId: "c-1",
    bookId: "atomic-habits",
    chapterNumber: 2,
    ifThenPlan: "If it is 9am, then I will write one sentence.",
    status: "active",
    followUpDate: pastIso,
    notificationSentAt: null,
  };
}

beforeEach(() => {
  ddbMock.reset();
  sesMock.reset();
});

test("due active commitment writes NOTIF# + dedup marker + notificationSentAt, in that order", async () => {
  ddbMock.on(QueryCommand).resolves({ Items: [dueActiveCommitment()] });
  // PROFILE lookup → no email; dedup marker → absent.
  ddbMock.on(GetCommand).callsFake((input) => {
    const sk = String(input.Key?.SK ?? "");
    if (sk.startsWith("NUDGE_SENT#")) return { Item: undefined };
    return { Item: undefined }; // PROFILE
  });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});

  const result = await processCommitmentFollowup(ddb, ses, TABLE, config, userItems as never);

  assert.deepEqual(result, { sent: 1, skipped: 0, errors: 0 });

  const puts = ddbMock.commandCalls(PutCommand);
  assert.equal(puts.length, 2, "one NOTIF# put + one dedup-marker put");

  const notifPut = puts[0].args[0].input as { Item: Record<string, unknown> };
  assert.equal(notifPut.Item.type, "commitment_followup");
  assert.equal((notifPut.Item.SK as string).startsWith("NOTIF#"), true);
  assert.deepEqual(notifPut.Item.metadata, { commitmentId: "c-1", bookId: "atomic-habits" });
  assert.equal(notifPut.Item.readAt, null);

  const markerPut = puts[1].args[0].input as { Item: Record<string, unknown> };
  assert.equal(markerPut.Item.SK, "NUDGE_SENT#commitment_followup#c-1");
  assert.equal(typeof markerPut.Item.ttl, "number");

  const updates = ddbMock.commandCalls(UpdateCommand);
  assert.equal(updates.length, 1, "notificationSentAt set once");
  const upd = updates[0].args[0].input as unknown as {
    UpdateExpression: string;
    Key: { SK: string };
  };
  assert.match(upd.UpdateExpression, /notificationSentAt/);
  assert.equal(upd.Key.SK, "COMMITMENT#c-1");

  // Order: NOTIF put → marker put → commitment update. The marker MUST precede the
  // commitment update so a step-(D) failure cannot cause a re-send.
  const ordered = ddbMock.calls().map((c) => c.args[0].constructor.name);
  const notifIdx = ordered.indexOf("PutCommand");
  const markerIdx = ordered.indexOf("PutCommand", notifIdx + 1);
  const updateIdx = ordered.indexOf("UpdateCommand");
  assert.ok(notifIdx < markerIdx, "NOTIF# before marker");
  assert.ok(markerIdx < updateIdx, "marker before notificationSentAt update");
});

test("second run no-ops when the dedup marker already exists (no NOTIF/marker/update writes)", async () => {
  // notificationSentAt is still null here, so the row passes the due filter — the
  // dedup marker is what must stop the re-send.
  ddbMock.on(QueryCommand).resolves({ Items: [dueActiveCommitment()] });
  ddbMock.on(GetCommand).callsFake((input) => {
    const sk = String(input.Key?.SK ?? "");
    if (sk.startsWith("NUDGE_SENT#")) return { Item: { SK: sk } }; // marker EXISTS
    return { Item: undefined };
  });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});

  const result = await processCommitmentFollowup(ddb, ses, TABLE, config, userItems as never);

  assert.deepEqual(result, { sent: 0, skipped: 1, errors: 0 });
  assert.equal(ddbMock.commandCalls(PutCommand).length, 0, "no writes on the second run");
  assert.equal(ddbMock.commandCalls(UpdateCommand).length, 0);
});

test("completed and not-yet-due commitments are skipped (no writes)", async () => {
  ddbMock.on(QueryCommand).resolves({
    Items: [
      { ...dueActiveCommitment(), commitmentId: "c-done", SK: "COMMITMENT#c-done", status: "completed" },
      { ...dueActiveCommitment(), commitmentId: "c-future", SK: "COMMITMENT#c-future", followUpDate: futureIso },
      { ...dueActiveCommitment(), commitmentId: "c-sent", SK: "COMMITMENT#c-sent", notificationSentAt: pastIso },
    ],
  });
  ddbMock.on(GetCommand).resolves({ Item: undefined });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});

  const result = await processCommitmentFollowup(ddb, ses, TABLE, config, userItems as never);

  assert.deepEqual(result, { sent: 0, skipped: 0, errors: 0 });
  assert.equal(ddbMock.commandCalls(PutCommand).length, 0);
  assert.equal(ddbMock.commandCalls(UpdateCommand).length, 0);
});

test("celebration-category email opt-out is honored: no email send, but the in-app nudge still fires", async () => {
  // Email channel ON, but the "celebration" category is unsubscribed (the flags the
  // unsubscribe link sets). The email MUST be suppressed; the in-app nudge still fires.
  const optedOut = [
    {
      PK,
      settings: {
        notifications: { channels: { email: true }, achievementAlertsEnabled: false },
      },
    },
  ];
  ddbMock.on(QueryCommand).resolves({ Items: [dueActiveCommitment()] });
  ddbMock.on(GetCommand).resolves({ Item: undefined }); // dedup marker absent
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});

  const result = await processCommitmentFollowup(ddb, ses, TABLE, config, optedOut as never);

  assert.equal(result.sent, 1, "in-app nudge still fires");
  assert.equal(sesMock.commandCalls(SendEmailCommand).length, 0, "no email sent when celebration is unsubscribed");
  // The email path (incl. the PROFILE lookup) is skipped entirely, so the only Get
  // is the dedup-marker check — never a PROFILE read.
  const profileGets = ddbMock
    .commandCalls(GetCommand)
    .filter((c) => (c.args[0].input as { Key?: { SK?: string } }).Key?.SK === "PROFILE");
  assert.equal(profileGets.length, 0, "PROFILE not read when the email channel is suppressed");
});

test("a per-commitment write failure is isolated (errors++ , other commitments still nudge)", async () => {
  ddbMock.on(QueryCommand).resolves({
    Items: [
      dueActiveCommitment(),
      { ...dueActiveCommitment(), commitmentId: "c-2", SK: "COMMITMENT#c-2" },
    ],
  });
  ddbMock.on(GetCommand).resolves({ Item: undefined });
  // First NOTIF put (c-1) throws; subsequent puts succeed.
  let putCount = 0;
  ddbMock.on(PutCommand).callsFake(() => {
    putCount += 1;
    if (putCount === 1) throw new Error("ddb down");
    return {};
  });
  ddbMock.on(UpdateCommand).resolves({});

  const result = await processCommitmentFollowup(ddb, ses, TABLE, config, userItems as never);

  assert.equal(result.errors, 1, "the failing commitment is counted as an error");
  assert.equal(result.sent, 1, "the other commitment still nudges");
});
