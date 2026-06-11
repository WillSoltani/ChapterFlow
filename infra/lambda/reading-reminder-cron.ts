// Lambda handler for the hourly reading-reminder + habit nudge cron.
// Scans users with readingReminderEnabled, checks if the current UTC hour
// matches their reminderTimeLocal + reminderTimezone, and sends email + in-app
// notifications. Also dispatches streak-at-risk, weekly digest, and
// welcome-back nudge sub-handlers.
//
// Deployed via CDK EventBridge rule → Lambda.
// Env vars: BOOK_TABLE_NAME, SES_SENDER_EMAIL

import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { processStreakAtRisk } from "./lib/streak-at-risk";
import { processWeeklyDigest } from "./lib/weekly-digest";
import { processWelcomeBackNudge } from "./lib/welcome-back-nudge";
import { readingReminderEmail } from "./lib/email-templates/reading-reminder";
import { resolveEmailConfig, sendCompliantEmail } from "./lib/email-compliance";

const tableName = process.env.BOOK_TABLE_NAME!;

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

export async function handler() {
  console.log(`[reading-reminder-cron] Running at ${new Date().toISOString()}`);

  // Owner email config (postal address, unsubscribe secret, …) is read from SSM.
  const emailConfig = await resolveEmailConfig();

  let lastKey: Record<string, unknown> | undefined;
  let sent = 0;
  let skipped = 0;

  // Accumulate all user items during the scan for nudge sub-handlers (avoids a second scan).
  const allUserItems: Array<{ PK: string; userId: string; settings: Record<string, unknown> }> = [];

  do {
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

      // Dedup: check if reminder already sent today.
      const today = new Date().toISOString().slice(0, 10);
      const dedupKey = `REMINDER_SENT#${today}`;
      const pk = item.PK as string;

      const dedupCheck = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: pk, SK: dedupKey },
          ProjectionExpression: "PK",
        })
      );

      if (dedupCheck.Item) {
        skipped++;
        continue;
      }

      // Get user profile for name.
      const profileRes = await ddb.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: pk, SK: "PROFILE" },
          ProjectionExpression: "displayName, email",
        })
      );
      const name = (profileRes.Item?.displayName as string) ?? "Reader";
      const email = profileRes.Item?.email as string;

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
        })
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
        })
      );

      sent++;
    }

    lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`[reading-reminder-cron] Reminders done. Sent: ${sent}, Skipped: ${skipped}`);

  // ── Dispatch habit nudge sub-handlers ──────────────────────────────────
  const [streakResult, digestResult, welcomeResult] = await Promise.allSettled([
    processStreakAtRisk(ddb, ses, tableName, emailConfig, allUserItems as never),
    processWeeklyDigest(ddb, ses, tableName, emailConfig, allUserItems as never),
    processWelcomeBackNudge(ddb, ses, tableName, emailConfig, allUserItems as never),
  ]);

  console.log("[reading-reminder-cron] Nudge results:", {
    streakAtRisk: streakResult.status === "fulfilled" ? streakResult.value : "failed",
    weeklyDigest: digestResult.status === "fulfilled" ? digestResult.value : "failed",
    welcomeBack: welcomeResult.status === "fulfilled" ? welcomeResult.value : "failed",
  });

  return { sent, skipped };
}
