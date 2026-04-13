import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { streakAtRiskEmail } from "./email-templates/streak-at-risk";

type UserSettings = {
  PK: string;
  userId: string;
  settings: {
    notifications?: {
      channels?: { email?: boolean; push?: boolean };
      streakReminderEnabled?: boolean;
    };
  };
};

type StreakItem = {
  currentStreak: number;
  lastActiveDate: string | null;
  lastActiveTimezone: string | null;
};

function getTodayInTimezone(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function processStreakAtRisk(
  ddb: DynamoDBDocumentClient,
  ses: SESv2Client,
  tableName: string,
  senderEmail: string,
  userItems: UserSettings[],
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.streakReminderEnabled === false) {
      skipped++;
      continue;
    }

    const userId = item.PK.replace("BOOKUSER#", "");

    // Get streak state
    const streakResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: item.PK, SK: "STREAK" },
      }),
    );
    const streak = streakResult.Item as StreakItem | undefined;
    if (!streak || !streak.currentStreak || streak.currentStreak < 2 || !streak.lastActiveDate) {
      skipped++;
      continue;
    }

    // Check if last active date is today (already active, no risk)
    // Use the user's timezone so the comparison matches how lastActiveDate was stored
    const tz = streak.lastActiveTimezone || "UTC";
    const today = getTodayInTimezone(tz);
    if (streak.lastActiveDate === today) {
      skipped++;
      continue;
    }

    // Check if already sent today
    const dedupKey = `NUDGE_SENT#streak_at_risk#${today}`;
    const dedupResult = await ddb.send(
      new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: dedupKey } }),
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }

    // Calculate hours remaining (streak resets at midnight in user's timezone)
    let hoursRemaining = 6; // default
    try {
      const nowInTz = new Date().toLocaleTimeString("en-US", { timeZone: tz, hour12: false });
      const currentHour = parseInt(nowInTz.split(":")[0], 10);
      hoursRemaining = Math.max(0, 24 - currentHour);
    } catch {}

    // Only send if within the last 8 hours of the day
    if (hoursRemaining > 8) {
      skipped++;
      continue;
    }

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
          type: "streak_at_risk",
          title: `Your ${streak.currentStreak}-day streak is at risk`,
          body: `You have ${hoursRemaining} hours to complete a chapter and keep your streak alive.`,
          channel: "in_app",
          readAt: null,
          createdAt: now,
        },
      }),
    );

    // Send email notification
    if (notifications?.channels?.email !== false) {
      try {
        const profileResult = await ddb.send(
          new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: "PROFILE" } }),
        );
        const email = (profileResult.Item as { email?: string })?.email;
        const name = (profileResult.Item as { displayName?: string })?.displayName ?? "Reader";
        if (email) {
          const tpl = streakAtRiskEmail({ name, currentStreak: streak.currentStreak, hoursRemaining });
          await ses.send(
            new SendEmailCommand({
              FromEmailAddress: senderEmail,
              Destination: { ToAddresses: [email] },
              Content: {
                Simple: {
                  Subject: { Data: tpl.subject },
                  Body: {
                    Text: { Data: tpl.textBody },
                    Html: { Data: tpl.htmlBody },
                  },
                },
              },
            }),
          );
        }
      } catch (err) {
        console.error(`[streak-at-risk] Failed to send email for ${userId}:`, err);
      }
    }

    // Write dedup marker
    const ttl = Math.floor(Date.now() / 1000) + 2 * 86400;
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: new Date().toISOString(), ttl },
      }),
    );

    sent++;
  }

  return { sent, skipped };
}
