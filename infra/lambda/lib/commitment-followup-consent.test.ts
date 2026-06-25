import { test } from "node:test";
import assert from "node:assert/strict";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SESv2Client } from "@aws-sdk/client-sesv2";
import type { EmailConfig } from "./email-compliance";
import { processCommitmentFollowup } from "./commitment-followup";

// Regression guard for the email-consent leak (opt-IN). The commercial-email
// second channel of the nudge handlers must fire ONLY when the user has
// EXPLICITLY opted into the email channel (channels.email === true) — the
// canonical convention in notifications-repo.ts + the reading-reminder cron.
//
// Before the fix this handler gated on `channels?.email !== false`, so an
// undefined channel (≈ every real user, since no UI ever sets it) was treated
// as consent: the PROFILE was read and a CASL/CAN-SPAM commercial email was
// sent to someone who never opted in. This test FAILS on the pre-fix handler
// and PASSES after the opt-IN flip. It uses hand-rolled fakes (no
// aws-sdk-client-mock — that dep is not installed in this repo).

// A complete config so the pre-fix code path actually reaches ses.send (the
// postalAddress + appBaseUrl are CASL kill-switches in sendCompliantEmail).
const config: EmailConfig = {
  senderEmail: "info@chapterflow.ca",
  senderName: "ChapterFlow",
  supportAddress: "support@chapterflow.ca",
  postalAddress: "123 Example St, Toronto, ON",
  appBaseUrl: "https://chapterflow.ca",
  secret: "test-secret",
  configurationSet: "cfg",
};

type Cmd = { input: Record<string, unknown> };

function dueCommitment() {
  return {
    commitmentId: "c1",
    bookId: "b1",
    chapterNumber: 1,
    ifThenPlan: "When I finish lunch, I will read one chapter.",
    status: "active",
    followUpDate: "2020-01-01T00:00:00.000Z", // safely in the past → due
    notificationSentAt: null,
  };
}

/** Fake doc client: records every command, returns canned data so the handler
 *  reaches its email gate with exactly one due commitment. PROFILE returns a
 *  real email and the suppression lookup returns "not suppressed", so the
 *  pre-fix path genuinely sends (proving the leak). */
function makeDdb() {
  const commands: Cmd[] = [];
  const ddb = {
    send: async (command: Cmd) => {
      commands.push(command);
      const input = command.input ?? {};
      if (input.KeyConditionExpression) return { Items: [dueCommitment()] }; // COMMITMENT# query
      const sk = (input.Key as { SK?: string } | undefined)?.SK;
      if (sk === "PROFILE") return { Item: { email: "reader@example.com", displayName: "Reader" } };
      return {}; // dedup claim Put / NOTIF Put / Update / suppression Get (→ not suppressed)
    },
  } as unknown as DynamoDBDocumentClient;
  return { ddb, commands };
}

function makeSes() {
  const sends: unknown[] = [];
  const ses = { send: async (c: unknown) => { sends.push(c); return {}; } } as unknown as SESv2Client;
  return { ses, sends };
}

const profileWasRead = (commands: Cmd[]) =>
  commands.some((c) => (c.input?.Key as { SK?: string } | undefined)?.SK === "PROFILE");

test("commitment-followup: channels.email UNDEFINED → no email, no PROFILE read (opt-IN)", async () => {
  const { ddb, commands } = makeDdb();
  const { ses, sends } = makeSes();
  // channels present but `email` unset — the real-world default for ~every user.
  const userItems = [{ PK: "BOOKUSER#u1", settings: { notifications: { channels: {} } } }];

  const result = await processCommitmentFollowup(ddb, ses, "table", config, userItems);

  assert.equal(result.sent, 1, "in-app nudge still fires (separate, consented channel)");
  assert.equal(profileWasRead(commands), false, "PROFILE must not be read without email consent");
  assert.equal(sends.length, 0, "no commercial email may be sent without explicit email opt-in");
});

test("commitment-followup: channels.email === true → email second channel fires", async () => {
  const { ddb, commands } = makeDdb();
  const { ses, sends } = makeSes();
  const userItems = [{ PK: "BOOKUSER#u1", settings: { notifications: { channels: { email: true } } } }];

  const result = await processCommitmentFollowup(ddb, ses, "table", config, userItems);

  assert.equal(result.sent, 1, "in-app nudge fires");
  assert.equal(profileWasRead(commands), true, "PROFILE is read when the user opted into email");
  assert.equal(sends.length, 1, "the opted-in user still receives the email");
});
