import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { weeklyDigestEmail } from "./email-templates/weekly-digest";
import { sendCompliantEmail, type EmailConfig } from "./email-compliance";

type UserSettings = {
  PK: string;
  userId: string;
  settings: {
    notifications?: {
      channels?: { email?: boolean };
      weeklyDigestEnabled?: boolean;
    };
  };
};

export async function processWeeklyDigest(
  ddb: DynamoDBDocumentClient,
  ses: SESv2Client,
  tableName: string,
  config: EmailConfig,
  userItems: UserSettings[],
): Promise<{ sent: number; skipped: number }> {
  // Only run on Sundays
  if (new Date().getUTCDay() !== 0) {
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weekKey = new Date().toISOString().slice(0, 10);

  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.weeklyDigestEnabled === false) {
      skipped++;
      continue;
    }

    const userId = item.PK.replace("BOOKUSER#", "");

    // Check dedup
    const dedupKey = `NUDGE_SENT#weekly_digest#${weekKey}`;
    const dedupResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: dedupKey } }),
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }

    // Count loops completed in last 7 days
    const loopsResult = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        FilterExpression: "completedAt >= :weekAgo",
        ExpressionAttributeValues: {
          ":pk": item.PK,
          ":prefix": "LOOP#",
          ":weekAgo": weekAgo,
        },
      }),
    );
    const chaptersCompleted = loopsResult.Items?.length ?? 0;

    // Get streak
    const streakResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: "STREAK" } }),
    );
    const currentStreak = (streakResult.Item as { currentStreak?: number })?.currentStreak ?? 0;

    // Get IP balance
    const engResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: "ENGAGEMENT" } }),
    );
    const ipBalance = (engResult.Item as { points?: number })?.points ?? 0;

    // Get profile email
    const profileResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: "PROFILE" } }),
    );
    const email = (profileResult.Item as { email?: string })?.email;
    const name = (profileResult.Item as { displayName?: string })?.displayName ?? "Reader";

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
          type: "weekly_digest",
          title: "Your week in review",
          body: `${chaptersCompleted} chapters completed · ${currentStreak}-day streak · ${ipBalance} IP`,
          channel: "in_app",
          readAt: null,
          createdAt: now,
        },
      }),
    );

    if (!email || notifications?.channels?.email === false) {
      // In-app was written; skip email send, write dedup and continue
      const ttl = Math.floor(Date.now() / 1000) + 8 * 86400;
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: now, ttl },
        }),
      );
      sent++;
      continue;
    }

    // Send email digest
    try {
      const tpl = weeklyDigestEmail({
        name,
        chaptersCompleted,
        currentStreak,
        ipBalance,
        appBaseUrl: config.appBaseUrl,
      });
      await sendCompliantEmail(ses, ddb, tableName, config, {
        to: email,
        userId,
        category: "weekly_digest",
        subject: tpl.subject,
        textBody: tpl.textBody,
        htmlBody: tpl.htmlBody,
      });
      sent++;
    } catch (err) {
      console.error(`[weekly-digest] Failed for ${userId}:`, err);
      skipped++;
    }

    // Write dedup
    const ttl = Math.floor(Date.now() / 1000) + 8 * 86400;
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: new Date().toISOString(), ttl },
      }),
    );
  }

  return { sent, skipped };
}
