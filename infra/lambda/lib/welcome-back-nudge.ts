import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { welcomeBackEmail } from "./email-templates/welcome-back";
import { sendCompliantEmail, type EmailConfig } from "./email-compliance";

type UserSettings = {
  PK: string;
  userId: string;
  settings: {
    notifications?: {
      channels?: { email?: boolean };
      welcomeBackEnabled?: boolean;
    };
  };
};

export async function processWelcomeBackNudge(
  ddb: DynamoDBDocumentClient,
  ses: SESv2Client,
  tableName: string,
  config: EmailConfig,
  userItems: UserSettings[],
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.welcomeBackEnabled === false) {
      skipped++;
      continue;
    }

    const userId = item.PK.replace("BOOKUSER#", "");

    // Get streak to find last active date
    const streakResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: "STREAK" } }),
    );
    const lastActiveDate = (streakResult.Item as { lastActiveDate?: string })?.lastActiveDate;

    if (!lastActiveDate) {
      skipped++;
      continue;
    }

    // Only nudge users inactive for 7+ days
    const daysSinceActive = Math.floor(
      (Date.now() - new Date(lastActiveDate).getTime()) / 86400000,
    );
    if (daysSinceActive < 7) {
      skipped++;
      continue;
    }

    // Check dedup — don't send more than once per 30 days (non-rotating key + 30-day TTL)
    const dedupKey = `NUDGE_SENT#welcome_back`;
    const dedupResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: dedupKey } }),
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }

    // Get current book progress for "pick up where you left off" context
    const progressResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: "PROFILE" } }),
    );
    const email = (progressResult.Item as { email?: string })?.email;
    const name = (progressResult.Item as { displayName?: string })?.displayName ?? "Reader";

    // Write in-app notification
    const notifId = crypto.randomUUID();
    const now = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: item.PK,
          SK: `NOTIF#${now}#${notifId}`,
          entity: "BOOK_USER_NOTIFICATION",
          userId,
          notificationId: notifId,
          type: "welcome_back_nudge",
          title: `We saved your spot, ${name}`,
          body: `It's been ${daysSinceActive} days. Jump back in and earn 30 Insight Points.`,
          channel: "in_app",
          readAt: null,
          createdAt: now,
        },
      }),
    );

    // The in-app notification above is the guaranteed nudge channel and has been
    // delivered, so record the 30-day dedup marker NOW — exactly-once. The email
    // below is a best-effort second channel; its failure must not leave the
    // marker unwritten, or the next cron run would re-send a duplicate in-app
    // nudge every hour until the email finally succeeds.
    const ttl = Math.floor(Date.now() / 1000) + 30 * 86400;
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: now, ttl },
      }),
    );
    sent++;

    // Best-effort email (second channel). A send failure is logged but not
    // retried: the in-app notification already counts as the delivered nudge.
    if (email && notifications?.channels?.email !== false) {
      try {
        const tpl = welcomeBackEmail({ name, daysSinceActive, appBaseUrl: config.appBaseUrl });
        await sendCompliantEmail(ses, ddb, tableName, config, {
          to: email,
          userId,
          category: "welcome_back",
          subject: tpl.subject,
          textBody: tpl.textBody,
          htmlBody: tpl.htmlBody,
        });
      } catch (err) {
        console.error(`[welcome-back] email send failed for ${userId}:`, err);
      }
    }
  }

  return { sent, skipped };
}
