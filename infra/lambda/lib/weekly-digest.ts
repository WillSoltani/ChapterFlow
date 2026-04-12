import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

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
  senderEmail: string,
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
    if (notifications?.weeklyDigestEnabled === false || notifications?.channels?.email === false) {
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

    if (!email) {
      skipped++;
      continue;
    }

    // Send digest
    try {
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: senderEmail,
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: `Your ChapterFlow Week: ${chaptersCompleted} chapters completed` },
              Body: {
                Html: {
                  Data: `
<h2>Hey ${name}, here's your week in review</h2>
<ul>
  <li><strong>${chaptersCompleted}</strong> chapters completed</li>
  <li><strong>${currentStreak}</strong> day streak</li>
  <li><strong>${ipBalance}</strong> Insight Points balance</li>
</ul>
<p>${chaptersCompleted > 0 ? "Great progress this week! Keep the momentum going." : "Take 15 minutes today to get back on track."}</p>
<p><a href="https://chapterflow.siliconx.ca/dashboard">Open ChapterFlow</a></p>
                  `.trim(),
                },
                Text: {
                  Data: `Your ChapterFlow week: ${chaptersCompleted} chapters, ${currentStreak}-day streak, ${ipBalance} IP. ${chaptersCompleted > 0 ? "Keep it up!" : "Jump back in today."}`,
                },
              },
            },
          },
        }),
      );
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
