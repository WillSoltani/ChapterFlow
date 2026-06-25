import "server-only";

import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { MAX_PUSH_FANOUT } from "@/app/app/api/book/_lib/device-cap-core";
import { bookUserPk, notificationSk, nowIso } from "@/app/app/api/book/_lib/keys";
import { getUserSettingsItem, isEmailSuppressed } from "@/app/app/api/book/_lib/repo";
import { sendEmail } from "@/app/app/api/book/_lib/email-service";
import {
  buildUnsubscribeUrl,
  canSendCommercialEmail,
  emailFooter,
  getEmailComplianceConfig,
  isEmailCategoryEnabled,
  reasonLineForCategory,
  signUnsubscribeToken,
  unsubscribeHeaders,
  type EmailCategory,
} from "@/app/app/api/book/_lib/email-compliance";
import type { BookUserNotificationItem, NotificationPreferences } from "@/app/app/api/book/_lib/types";

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException"
  );
}

/** Map an in-app notification type to the unsubscribe category for its email. */
function emailCategoryForNotificationType(type: string): EmailCategory {
  if (type.includes("reading_reminder")) return "reading_reminder";
  if (type.includes("streak")) return "streak";
  if (type.includes("welcome_back")) return "welcome_back";
  if (type.includes("digest")) return "weekly_digest";
  return "celebration";
}

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

  // Email notification (if enabled and email available). These are commercial
  // (engagement) emails, so they carry full CASL/CAN-SPAM compliance: sender
  // identification, reply-to, a postal-address footer, and a working one-click
  // unsubscribe + List-Unsubscribe headers. The gate honors BOTH the master
  // channel toggle AND the per-category preference — `isEmailCategoryEnabled`
  // is the inverse of the unsubscribe route's `applyUnsubscribe`, so a one-click
  // category opt-out actually stops these emails (CASL §6 / CAN-SPAM §5(a)(4)).
  const category = emailCategoryForNotificationType(params.type);
  if (
    notifPrefs.channels?.email === true &&
    isEmailCategoryEnabled(notifPrefs, category) &&
    params.userEmail
  ) {
    const config = await getEmailComplianceConfig();
    // Commercial email requires a sender, a postal address (CASL/CAN-SPAM), AND a
    // live app host for the one-click unsubscribe link. Without all three we skip
    // sending — set SES_SENDER_EMAIL / EMAIL_POSTAL_ADDRESS / CHAPTERFLOW_APP_BASE_URL
    // to enable. This is the SAME kill-switch the cron Lambda's sendCompliantEmail
    // enforces; mirroring it here prevents the app from emitting a non-working
    // unsubscribe link pointing at the dead legacy host. (Transactional email, e.g.
    // trial-ending, uses a separate path and is exempt.) Also skip addresses
    // suppressed by a hard bounce or complaint.
    const canSend = canSendCommercialEmail(config);
    const suppressed = canSend && (await isEmailSuppressed(tableName, params.userEmail));
    if (canSend && !suppressed) {
      const token = signUnsubscribeToken(params.userId, category, config.secret);
      const unsubscribeUrl = buildUnsubscribeUrl(config.appBaseUrl, token);
      const mailto = `mailto:${config.supportAddress}?subject=unsubscribe`;
      const footer = emailFooter({
        config,
        unsubscribeUrl,
        reasonLine: reasonLineForCategory(category),
      });
      const coreHtml = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">${params.title}</h2><p>${params.body}</p></div>`;
      const result = await sendEmail({
        to: params.userEmail,
        subject: params.title,
        textBody: params.body + footer.text,
        htmlBody: coreHtml + footer.html,
        senderEmail: config.senderName
          ? `${config.senderName} <${config.senderEmail}>`
          : config.senderEmail,
        replyTo: config.supportAddress,
        headers: unsubscribeHeaders(unsubscribeUrl, mailto),
        configurationSet: config.configurationSet,
      });
      emailSent = result.sent;
    }
  }

  // Push notification (if enabled — looks up device tokens from DDB).
  let pushSent = false;
  if (notifPrefs.channels?.push === true) {
    try {
      const { sendPushNotification } = await import("@/app/app/api/book/_lib/push-service");
      // Bound the fan-out (E4): cap how many device rows we POST to per
      // notification. The register route caps a user at MAX_DEVICES_PER_USER
      // rows, but legacy partitions may still hold more (a register only prunes
      // on its own write), so `Limit` bounds the read and the loop bound below
      // is belt-and-suspenders if a page returns more than the cap.
      const deviceRes = await ddbDoc.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: {
            ":pk": bookUserPk(params.userId),
            ":prefix": "DEVICE#",
          },
          Limit: MAX_PUSH_FANOUT,
        })
      );
      const devices = (deviceRes.Items ?? []).slice(0, MAX_PUSH_FANOUT);
      for (const device of devices) {
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
  // Cap on the number of items returned. When omitted, the full partition is
  // paginated so the unread count / read-all sweep cover every notification
  // (a single Query Limit is only a per-page hint and undercounts older items).
  limit?: number
): Promise<BookUserNotificationItem[]> {
  const items: Record<string, unknown>[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": bookUserPk(userId),
          ":prefix": "NOTIF#",
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    items.push(...(res.Items ?? []));
    lastEvaluatedKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey && (limit === undefined || items.length < limit));

  const capped = limit === undefined ? items : items.slice(0, limit);

  return capped.map((item) => ({
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

// The notification bell caps its badge at "99+" (see NotificationBell.tsx), so
// an exact lifetime unread count is never displayed. Notifications have no TTL
// and the NOTIF# partition grows for the life of the account, so paginating the
// whole partition with Select:COUNT made the per-poll (60s) read cost O(account
// lifetime). Instead, count unread only within the newest UNREAD_COUNT_SCAN_LIMIT
// items: `Limit` bounds the items DynamoDB reads (RCU), the unread filter is
// applied to that bounded page, and res.Count is the exact unread total below
// the cap or saturates at the cap — exactly what the "99+" badge needs, at O(1)
// read cost regardless of partition size.
//
// Trade-off: unread items older than the newest ~100 are not counted. That only
// undercounts for a user who has read their newest 100+ notifications but left
// older ones unread (atypical), and it errs low — the badge never over-promises.
// If an exact lifetime count is ever needed, switch to a denormalized counter
// maintained on create / markRead / markAll.
const UNREAD_COUNT_SCAN_LIMIT = 100;

export async function countUnreadNotifications(
  tableName: string,
  userId: string
): Promise<number> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "attribute_not_exists(readAt) OR readAt = :null",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "NOTIF#",
        ":null": null,
      },
      Select: "COUNT",
      ScanIndexForward: false,
      Limit: UNREAD_COUNT_SCAN_LIMIT,
    })
  );

  return res.Count ?? 0;
}

export async function markNotificationRead(
  tableName: string,
  userId: string,
  sk: string
): Promise<void> {
  try {
    await ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: sk },
        // Only update an existing notification — without this guard the Update
        // would upsert a phantom NOTIF# row from client-supplied createdAt/id.
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        UpdateExpression: "SET readAt = :now",
        ExpressionAttributeValues: { ":now": nowIso() },
      })
    );
  } catch (error) {
    // No such notification: treat marking a non-existent item as a no-op.
    if (!isConditionalCheckFailed(error)) throw error;
  }
}

export async function markAllNotificationsRead(
  tableName: string,
  userId: string
): Promise<number> {
  // No limit: mark every unread notification, including ones beyond the newest
  // page (a capped read left older items permanently unread).
  const items = await listNotifications(tableName, userId);
  const unread = items.filter((n) => !n.readAt);
  const now = nowIso();

  for (const n of unread) {
    try {
      await ddbDoc.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            PK: bookUserPk(userId),
            SK: notificationSk(n.createdAt, n.notificationId),
          },
          // Guard like markNotificationRead: a row whose createdAt/notificationId
          // didn't round-trip cleanly would otherwise upsert a phantom NOTIF#.
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
          UpdateExpression: "SET readAt = :now",
          ExpressionAttributeValues: { ":now": now },
        })
      );
    } catch (error) {
      if (!isConditionalCheckFailed(error)) throw error;
    }
  }

  return unread.length;
}
