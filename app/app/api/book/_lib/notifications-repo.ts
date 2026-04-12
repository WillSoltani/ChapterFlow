import "server-only";

import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, notificationSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { getUserSettingsItem } from "@/app/app/api/book/_lib/repo";
import { getServerEnv } from "@/app/app/api/_lib/server-env";
import { sendEmail } from "@/app/app/api/book/_lib/email-service";
import type { BookUserNotificationItem, NotificationPreferences } from "@/app/app/api/book/_lib/types";

type CreateNotificationParams = {
  userId: string;
  type: BookUserNotificationItem["type"];
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  userEmail?: string;
  userName?: string;
};

export async function createNotification(
  tableName: string,
  params: CreateNotificationParams
): Promise<{ created: boolean; emailSent?: boolean; pushSent?: boolean }> {
  const settings = await getUserSettingsItem(tableName, params.userId);
  const notifPrefs = (settings?.settings?.notifications ?? {}) as Partial<NotificationPreferences>;

  let inAppCreated = false;
  let emailSent = false;

  // In-app notification.
  if (notifPrefs.channels?.inApp !== false) {
    const now = nowIso();
    const notificationId = crypto.randomUUID();

    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(params.userId),
          SK: notificationSk(now, notificationId),
          entity: "BOOK_USER_NOTIFICATION",
          userId: params.userId,
          notificationId,
          type: params.type,
          title: params.title,
          body: params.body,
          channel: "in_app",
          readAt: null,
          metadata: params.metadata ?? {},
          createdAt: now,
        },
      })
    );
    inAppCreated = true;
  }

  // Email notification (if enabled and email available).
  if (notifPrefs.channels?.email === true && params.userEmail) {
    const senderEmail = await getServerEnv("SES_SENDER_EMAIL");
    if (senderEmail) {
      const result = await sendEmail({
        to: params.userEmail,
        subject: params.title,
        textBody: params.body,
        htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">${params.title}</h2><p>${params.body}</p><p style="color:#888;font-size:12px">— ChapterFlow</p></div>`,
        senderEmail,
      });
      emailSent = result.sent;
    }
  }

  // Push notification (if enabled — looks up device tokens from DDB).
  let pushSent = false;
  if (notifPrefs.channels?.push === true) {
    try {
      const { sendPushNotification } = await import("@/app/app/api/book/_lib/push-service");
      const { deviceTokenSk: _dtSk, ..._ } = await import("@/app/app/api/book/_lib/keys");
      const deviceRes = await ddbDoc.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: {
            ":pk": bookUserPk(params.userId),
            ":prefix": "DEVICE#",
          },
        })
      );
      for (const device of deviceRes.Items ?? []) {
        const endpoint = device.endpoint as string;
        const keys = device.keys as { p256dh: string; auth: string };
        if (endpoint && keys?.p256dh && keys?.auth) {
          const result = await sendPushNotification(
            { endpoint, keys },
            { title: params.title, body: params.body }
          );
          if (result.sent) pushSent = true;
        }
      }
    } catch (e) {
      console.error("[notifications-repo] push send failed:", e);
    }
  }

  return { created: inAppCreated, emailSent, pushSent };
}

export async function listNotifications(
  tableName: string,
  userId: string,
  limit = 50
): Promise<BookUserNotificationItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "NOTIF#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (res.Items ?? []).map((item) => ({
    userId,
    notificationId: String(item.notificationId ?? ""),
    type: String(item.type ?? "badge_earned") as BookUserNotificationItem["type"],
    title: String(item.title ?? ""),
    body: String(item.body ?? ""),
    channel: (item.channel as BookUserNotificationItem["channel"]) ?? "in_app",
    readAt: typeof item.readAt === "string" ? item.readAt : null,
    metadata: (item.metadata as Record<string, unknown>) ?? {},
    createdAt: String(item.createdAt ?? ""),
  }));
}

export async function markNotificationRead(
  tableName: string,
  userId: string,
  sk: string
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: sk },
      UpdateExpression: "SET readAt = :now",
      ExpressionAttributeValues: { ":now": nowIso() },
    })
  );
}

export async function markAllNotificationsRead(
  tableName: string,
  userId: string
): Promise<number> {
  const items = await listNotifications(tableName, userId, 200);
  const unread = items.filter((n) => !n.readAt);
  const now = nowIso();

  for (const n of unread) {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: bookUserPk(userId),
          SK: notificationSk(n.createdAt, n.notificationId),
        },
        UpdateExpression: "SET readAt = :now",
        ExpressionAttributeValues: { ":now": now },
      })
    );
  }

  return unread.length;
}
