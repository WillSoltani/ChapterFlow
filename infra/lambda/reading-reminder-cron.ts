// Lambda handler for the hourly reading-reminder + habit nudge cron.
// Scans users with readingReminderEnabled, checks if the current UTC hour
// matches their reminderTimeLocal + reminderTimezone, and sends email + in-app
// notifications. Also dispatches streak-at-risk, weekly digest, and
// welcome-back nudge sub-handlers.
//
// Deployed via CDK EventBridge rule → Lambda.
// Env vars: BOOK_TABLE_NAME, SES_SENDER_EMAIL
//
// Throughput model (H16): the reminder pass no longer processes users one
// serial await-chain at a time (a Get + a Get + an Update + an optional SES
// send + a Put per user, strictly in order). On a few thousand users that
// O(users) round-trip depth blew the 5-minute Lambda timeout and silently
// dropped whichever users the scan reached last. Instead the scan only
// classifies users (cheap, IO-free), then the due users are processed with
// bounded concurrency (REMINDER_CONCURRENCY in flight), each one issuing a
// single BatchGet for its dedup marker + profile rather than two serial Gets.
// A failure on one user is isolated (logged + counted) so it can no longer
// abort the whole run.
//
// KNOWN REMAINING WORK (needs files outside this Lambda — see H16 handoff):
//   - The hourly full-table ScanCommand below still scans every row and filters
//     entity = BOOK_USER_SETTINGS after RCU is spent: there is no GSI on
//     `entity`. The real fix is a sparse GSI keyed on `entity` (or a
//     reminder-hour GSI) added in infra/lib/chapterflow-backend-stack.ts so
//     this becomes a Query; that file is out of scope here.
//   - Sharing the PROFILE/STREAK reads with the three nudge sub-handlers (which
//     re-Get them per user) requires changing their signatures in
//     infra/lambda/lib/*, also out of scope here.
//   - Raising the 5-minute timeout + adding a CloudWatch duration/timeout alarm
//     (so any future silent drop is visible) lives in the backend stack too.

import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { processStreakAtRisk } from "./lib/streak-at-risk";
import { processWeeklyDigest } from "./lib/weekly-digest";
import { processWelcomeBackNudge } from "./lib/welcome-back-nudge";
import { processCommitmentFollowup } from "./lib/commitment-followup";
import { readingReminderEmail } from "./lib/email-templates/reading-reminder";
import {
  resolveEmailConfig,
  sendCompliantEmail,
  type EmailConfig,
} from "./lib/email-compliance";

const tableName = process.env.BOOK_TABLE_NAME!;

// Max users processed simultaneously in the reminder pass. Bounds fan-out so a
// large active-user base doesn't open thousands of concurrent DynamoDB/SES
// calls, while keeping the pass far shallower than the old one-per-user serial
// chain. On-demand (PAY_PER_REQUEST) tables absorb this comfortably.
const REMINDER_CONCURRENCY = 8;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const ses = new SESv2Client({});

function resolveHour(timeLocal: string, timezone: string): number {
  try {
    const [h] = timeLocal.split(":").map(Number);
    const now = new Date();
    const localStr = now.toLocaleTimeString("en-US", { timeZone: timezone, hour12: false });
    const currentLocalHour = parseInt(localStr.split(":")[0], 10);
    return h === currentLocalHour ? h : -1;
  } catch {
    return -1;
  }
}

/**
 * Run `task` over `items` with at most `limit` promises in flight at once.
 * Workers pull from a shared cursor; because the increment is synchronous
 * (no await between read and bump) no two workers ever take the same index.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * BatchGet `keys` from the app table with one request, retrying only the
 * throttled (UnprocessedKeys) remainder. For the 2-key reads here throttling is
 * effectively never hit, but BatchGet surfaces partial results as a successful
 * response (the SDK does not auto-retry them), so handle it explicitly.
 */
async function batchGetByKeys(
  keys: Array<{ PK: string; SK: string }>,
  projection: string,
): Promise<Array<Record<string, unknown>>> {
  const collected: Array<Record<string, unknown>> = [];
  let pending = keys;
  for (let attempt = 0; attempt < 4 && pending.length > 0; attempt++) {
    const res = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [tableName]: { Keys: pending, ProjectionExpression: projection },
        },
      }),
    );
    collected.push(...((res.Responses?.[tableName] as Array<Record<string, unknown>>) ?? []));
    pending = (res.UnprocessedKeys?.[tableName]?.Keys as Array<{ PK: string; SK: string }>) ?? [];
    if (pending.length > 0) {
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  if (pending.length > 0) {
    console.warn(
      `[reading-reminder-cron] batchGet left ${pending.length} key(s) unprocessed after retries`,
    );
  }
  return collected;
}

type DueUser = { pk: string; userId: string; notifPrefs: Record<string, unknown> };

/**
 * Send (or skip) the reading reminder for a single due user. Reads its dedup
 * marker + profile in one BatchGet, writes the in-app notification, optionally
 * emails, then writes the dedup marker. Failures are caught and reported as
 * "error" so one bad user never aborts the concurrent batch.
 */
async function processReminderUser(
  user: DueUser,
  today: string,
  emailConfig: EmailConfig,
): Promise<"sent" | "skipped" | "error"> {
  const { pk, userId, notifPrefs } = user;
  const dedupKey = `REMINDER_SENT#${today}`;

  try {
    // Dedup marker + profile in a single request (was two serial Gets).
    const rows = await batchGetByKeys(
      [
        { PK: pk, SK: dedupKey },
        { PK: pk, SK: "PROFILE" },
      ],
      "PK, SK, displayName, email",
    );

    // Dedup: reminder already sent today.
    if (rows.some((r) => r.SK === dedupKey)) {
      return "skipped";
    }

    const profile = rows.find((r) => r.SK === "PROFILE");
    const name = (profile?.displayName as string) ?? "Reader";
    const email = profile?.email as string | undefined;

    // Send in-app notification.
    const notifId = crypto.randomUUID();
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: `NOTIF#${now}#${notifId}` },
        UpdateExpression:
          "SET entity = :e, userId = :uid, notificationId = :nid, #type = :type, title = :title, body = :body, channel = :ch, readAt = :null, createdAt = :now",
        ExpressionAttributeNames: { "#type": "type" },
        ExpressionAttributeValues: {
          ":e": "BOOK_USER_NOTIFICATION",
          ":uid": userId,
          ":nid": notifId,
          ":type": "reading_reminder",
          ":title": "Time to read!",
          ":body": "A few minutes of focused reading can make a real difference.",
          ":ch": "in_app",
          ":null": null,
          ":now": now,
        },
      }),
    );

    // Send email if available.
    if (email && (notifPrefs.channels as Record<string, unknown>)?.email === true) {
      try {
        const tpl = readingReminderEmail({ name, appBaseUrl: emailConfig.appBaseUrl });
        await sendCompliantEmail(ses, ddb, tableName, emailConfig, {
          to: email,
          userId,
          category: "reading_reminder",
          subject: tpl.subject,
          textBody: tpl.textBody,
          htmlBody: tpl.htmlBody,
        });
      } catch (e) {
        console.error(`[reading-reminder-cron] email failed for ${userId.slice(0, 8)}:`, e);
      }
    }

    // Write dedup marker (TTL: 2 days).
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: pk,
          SK: dedupKey,
          entity: "NUDGE_DEDUP",
          createdAt: now,
          ttl: Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60,
        },
      }),
    );

    return "sent";
  } catch (e) {
    console.error(`[reading-reminder-cron] reminder failed for ${userId.slice(0, 8)}:`, e);
    return "error";
  }
}

export async function handler() {
  console.log(`[reading-reminder-cron] Running at ${new Date().toISOString()}`);

  // Owner email config (postal address, unsubscribe secret, …) is read from SSM.
  const emailConfig = await resolveEmailConfig();

  let lastKey: Record<string, unknown> | undefined;
  // Skips decided during the scan with no IO (reminder disabled / wrong hour).
  let skipped = 0;

  // Accumulate all user items during the scan for nudge sub-handlers (avoids a second scan).
  const allUserItems: Array<{ PK: string; userId: string; settings: Record<string, unknown> }> = [];
  // Users due a reminder this hour — processed concurrently after the scan.
  const dueUsers: DueUser[] = [];
  // Single run date so every user in this invocation dedups against the same day.
  const today = new Date().toISOString().slice(0, 10);

  do {
    // NOTE (H16): still a full-table Scan — there is no GSI on `entity`, so the
    // FilterExpression runs after RCU is already consumed. Replacing this with a
    // Query needs a GSI in the backend stack (out of scope here; see handoff).
    const scan = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "BOOK_USER_SETTINGS" },
        ProjectionExpression: "PK, userId, settings",
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of scan.Items ?? []) {
      const userId = item.userId as string;
      const settings = item.settings as Record<string, unknown> | undefined;

      // Accumulate for nudge handlers
      allUserItems.push({ PK: item.PK as string, userId, settings: settings ?? {} });

      const notifPrefs = (settings?.notifications ?? {}) as Record<string, unknown>;

      if (!notifPrefs.readingReminderEnabled) {
        skipped++;
        continue;
      }

      const timeLocal = (notifPrefs.reminderTimeLocal as string) ?? "20:00";
      const timezone = (notifPrefs.reminderTimezone as string) ?? "UTC";

      if (resolveHour(timeLocal, timezone) < 0) {
        skipped++;
        continue;
      }

      // Due this hour — defer the IO-heavy send to the bounded-concurrency pass.
      dueUsers.push({ pk: item.PK as string, userId, notifPrefs });
    }

    lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  // Process due users concurrently (bounded) instead of one serial await chain.
  const outcomes = await runWithConcurrency(dueUsers, REMINDER_CONCURRENCY, (u) =>
    processReminderUser(u, today, emailConfig),
  );
  const sent = outcomes.filter((o) => o === "sent").length;
  const errors = outcomes.filter((o) => o === "error").length;
  skipped += outcomes.filter((o) => o === "skipped").length;

  console.log(
    `[reading-reminder-cron] Reminders done. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`
  );

  // ── Dispatch habit nudge sub-handlers ──────────────────────────────────
  // Commitment follow-up ships dark behind a kill-switch (default off) so it can
  // be enabled independently of a code deploy. Convention matches soft-decay.ts.
  const commitmentFollowupEnabled =
    process.env.BOOK_ENABLE_COMMITMENT_FOLLOWUP === "true" ||
    process.env.BOOK_ENABLE_COMMITMENT_FOLLOWUP === "1";

  const [streakResult, digestResult, welcomeResult, commitmentResult] =
    await Promise.allSettled([
      processStreakAtRisk(ddb, ses, tableName, emailConfig, allUserItems as never),
      processWeeklyDigest(ddb, ses, tableName, emailConfig, allUserItems as never),
      processWelcomeBackNudge(ddb, ses, tableName, emailConfig, allUserItems as never),
      commitmentFollowupEnabled
        ? processCommitmentFollowup(ddb, ses, tableName, emailConfig, allUserItems as never)
        : Promise.resolve("disabled" as const),
    ]);

  console.log("[reading-reminder-cron] Nudge results:", {
    streakAtRisk: streakResult.status === "fulfilled" ? streakResult.value : "failed",
    weeklyDigest: digestResult.status === "fulfilled" ? digestResult.value : "failed",
    welcomeBack: welcomeResult.status === "fulfilled" ? welcomeResult.value : "failed",
    commitmentFollowup:
      commitmentResult.status === "fulfilled" ? commitmentResult.value : "failed",
  });

  return { sent, skipped, errors };
}
