import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

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
  senderEmail: string,
  userItems: UserSettings[],
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.welcomeBackEnabled === false || notifications?.channels?.email === false) {
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

    // Check dedup — don't send more than once per 30 days
    const dedupKey = `NUDGE_SENT#welcome_back#${today}`;
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

    if (!email) {
      skipped++;
      continue;
    }

    try {
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: senderEmail,
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: `We saved your spot, ${name}` },
              Body: {
                Html: {
                  Data: `
<h2>Welcome back, ${name}!</h2>
<p>It's been ${daysSinceActive} days since your last reading session. Your progress is right where you left it.</p>
<p>Jump back in and earn <strong>30 Insight Points</strong> just for returning.</p>
<p><a href="https://chapterflow.siliconx.ca/dashboard">Pick up where you left off</a></p>
                  `.trim(),
                },
                Text: {
                  Data: `Hey ${name}, it's been ${daysSinceActive} days. Your ChapterFlow progress is waiting. Return now and earn 30 IP.`,
                },
              },
            },
          },
        }),
      );
      sent++;
    } catch (err) {
      console.error(`[welcome-back] Failed for ${userId}:`, err);
      skipped++;
    }

    // Write dedup (30 day TTL)
    const ttl = Math.floor(Date.now() / 1000) + 30 * 86400;
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: new Date().toISOString(), ttl },
      }),
    );
  }

  return { sent, skipped };
}
