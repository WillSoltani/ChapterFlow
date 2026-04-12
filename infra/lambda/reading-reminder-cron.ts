// Lambda handler for the hourly reading-reminder cron.
// Scans users with readingReminderEnabled, checks if the current UTC hour
// matches their reminderTimeLocal + reminderTimezone, and sends email + in-app
// notifications via the createNotification helper.
//
// Deployed via CDK EventBridge rule → Lambda.
// Env vars: BOOK_TABLE_NAME, SES_SENDER_EMAIL

import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const tableName = process.env.BOOK_TABLE_NAME!;
const senderEmail = process.env.SES_SENDER_EMAIL!;

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

  let lastKey: Record<string, unknown> | undefined;
  let sent = 0;
  let skipped = 0;

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
          await ses.send(
            new SendEmailCommand({
              FromEmailAddress: senderEmail,
              Destination: { ToAddresses: [email] },
              Content: {
                Simple: {
                  Subject: { Data: "Time to read!", Charset: "UTF-8" },
                  Body: {
                    Text: {
                      Data: `Hi ${name},\n\nThis is your daily reading reminder. A few minutes of focused reading can make a real difference.\n\n— ChapterFlow`,
                      Charset: "UTF-8",
                    },
                    Html: {
                      Data: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Time to Read</h2><p>Hi ${name},</p><p>This is your daily reading reminder.</p><p style="color:#888;font-size:12px">— ChapterFlow</p></div>`,
                      Charset: "UTF-8",
                    },
                  },
                },
              },
            })
          );
        } catch (e) {
          console.error(`[reading-reminder-cron] email failed for ${userId.slice(0, 8)}:`, e);
        }
      }

      // Write dedup marker (TTL: 2 days).
      await ddb.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: pk, SK: dedupKey },
          UpdateExpression: "SET createdAt = :now, #ttl = :ttl",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          ExpressionAttributeValues: {
            ":now": now,
            ":ttl": Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60,
          },
        })
      );

      sent++;
    }

    lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`[reading-reminder-cron] Done. Sent: ${sent}, Skipped: ${skipped}`);
  return { sent, skipped };
}
