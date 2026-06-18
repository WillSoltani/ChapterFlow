import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { commitmentFollowupEmail } from "./email-templates/commitment-followup";
import { sendCompliantEmail, type EmailConfig } from "./email-compliance";

// Scanned BOOK_USER_SETTINGS rows the cron already has in memory — reused here so
// this handler doesn't trigger a second full-table scan. We only read `channels.email`
// (the in-app nudge always fires: the user explicitly committed AND chose a 3/7-day
// follow-up window, so the reminder is consented; only the optional email second
// channel respects the email-off preference).
type UserSettings = {
  PK: string;
  settings?: {
    notifications?: {
      channels?: { email?: boolean };
      // The best-effort email reuses the "celebration" email category, so it MUST
      // honor that category's unsubscribe flags — otherwise the one-click
      // unsubscribe the email itself carries is a no-op (a CAN-SPAM/CASL gap).
      // The unsubscribe route flips BOTH of these on a "celebration" unsubscribe.
      achievementAlertsEnabled?: boolean;
      badgeCelebrationEnabled?: boolean;
    };
  };
};

type CommitmentRow = {
  commitmentId: string;
  bookId: string;
  chapterNumber: number;
  ifThenPlan: string;
  status: string;
  followUpDate: string;
  notificationSentAt: string | null;
};

/**
 * Proactive day-3 / day-7 commitment follow-up nudge.
 *
 * For every active commitment whose chosen followUpDate has passed and which has
 * not yet been nudged, write ONE in-app notification (the guaranteed channel) plus
 * a best-effort email, then mark it nudged so it never fires twice.
 *
 * Exactly-once write order per commitment (the naive order double-sends):
 *   (A) skip if a dedup marker already exists (defence beyond the notificationSentAt
 *       filter — covers the window where the NOTIF# landed but the commitment update
 *       below failed on a prior run);
 *   (B) write the NOTIF# record directly (cron is standalone-bundled, so it does NOT
 *       go through the app-layer createNotification);
 *   (C) write the per-commitment dedup marker BEFORE the commitment update, so a
 *       step-(D) failure can never re-send;
 *   (D) UpdateCommand SET notificationSentAt = now (also the §7 return-rate
 *       denominator: "commitments that were nudged").
 *
 * Errors are isolated per commitment (log + count + continue); there is no retry
 * loop. When first enabled, the very first run nudges every already-overdue
 * commitment in one burst — intentional and bounded by the count of genuinely-due
 * commitments. If a gentler ramp is wanted, cap `sent` per run here.
 */
export async function processCommitmentFollowup(
  ddb: DynamoDBDocumentClient,
  ses: SESv2Client,
  tableName: string,
  config: EmailConfig,
  userItems: UserSettings[],
): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const nowMs = Date.now();

  for (const item of userItems) {
    const userId = item.PK.replace("BOOKUSER#", "");
    const notifPrefs = item.settings?.notifications;
    // The in-app nudge always fires (the user explicitly committed and chose the
    // 3/7-day window — consented). The EMAIL second channel additionally honors
    // the master email toggle AND the "celebration" category opt-out, so the
    // unsubscribe link on the email actually suppresses it.
    const emailAllowed =
      notifPrefs?.channels?.email !== false &&
      notifPrefs?.achievementAlertsEnabled !== false &&
      notifPrefs?.badgeCelebrationEnabled !== false;

    // This user's commitments (single bounded Query — no GSI on followUpDate; fine
    // for MVP, see PR notes for the sparse-GSI threshold).
    let rows: CommitmentRow[];
    try {
      const res = await ddb.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: { ":pk": item.PK, ":prefix": "COMMITMENT#" },
        }),
      );
      rows = (res.Items ?? []) as CommitmentRow[];
    } catch (err) {
      console.error(`[commitment-followup] query failed for ${userId}:`, err);
      errors++;
      continue;
    }

    const due = rows.filter(
      (c) =>
        c.status === "active" &&
        !c.notificationSentAt &&
        Number.isFinite(Date.parse(c.followUpDate)) &&
        Date.parse(c.followUpDate) <= nowMs,
    );
    if (due.length === 0) continue;

    // Look up the email/name once per user (best-effort; only needed for the email
    // channel). PROFILE is the same record welcome-back-nudge reads.
    let email: string | undefined;
    let name = "Reader";
    if (emailAllowed) {
      try {
        const profile = await ddb.send(
          new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: "PROFILE" } }),
        );
        email = (profile.Item as { email?: string } | undefined)?.email;
        name = (profile.Item as { displayName?: string } | undefined)?.displayName ?? "Reader";
      } catch (err) {
        console.error(`[commitment-followup] profile lookup failed for ${userId}:`, err);
      }
    }

    for (const c of due) {
      try {
        // (A) Already nudged? Per-commitment dedup marker is authoritative.
        const dedupKey = `NUDGE_SENT#commitment_followup#${c.commitmentId}`;
        const dedup = await ddb.send(
          new GetCommand({ TableName: tableName, Key: { PK: item.PK, SK: dedupKey } }),
        );
        if (dedup.Item) {
          skipped++;
          continue;
        }

        const notifId = crypto.randomUUID();
        const now = new Date().toISOString();
        const planPreview =
          c.ifThenPlan.length > 90 ? `${c.ifThenPlan.slice(0, 87)}...` : c.ifThenPlan;

        // (B) In-app notification — the guaranteed channel. metadata.commitmentId
        // drives the NotificationBell deep-link to the exact dashboard check-in.
        await ddb.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: item.PK,
              SK: `NOTIF#${now}#${notifId}`,
              entity: "BOOK_USER_NOTIFICATION",
              userId,
              notificationId: notifId,
              type: "commitment_followup",
              title: "How did it go?",
              body: `Time to reflect on the action you committed to: "${planPreview}"`,
              channel: "in_app",
              readAt: null,
              metadata: { commitmentId: c.commitmentId, bookId: c.bookId },
              createdAt: now,
            },
          }),
        );

        // (C) Dedup marker BEFORE the commitment update (30-day TTL). The marker
        // is what guarantees a successfully-nudged commitment is never re-nudged;
        // notificationSentAt (set in step D) is the durable, app-visible record.
        const ttl = Math.floor(nowMs / 1000) + 30 * 86400;
        await ddb.send(
          new PutCommand({
            TableName: tableName,
            Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: now, ttl },
          }),
        );

        // (D) Mark the commitment nudged.
        await ddb.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: item.PK, SK: `COMMITMENT#${c.commitmentId}` },
            UpdateExpression: "SET notificationSentAt = :now",
            ExpressionAttributeValues: { ":now": now },
          }),
        );

        sent++;

        // Best-effort email (second channel). A send failure is logged, not retried:
        // the in-app notification already counts as the delivered nudge.
        if (email && emailAllowed) {
          try {
            const tpl = commitmentFollowupEmail({
              name,
              ifThenPlan: c.ifThenPlan,
              appBaseUrl: config.appBaseUrl,
              commitmentId: c.commitmentId,
            });
            await sendCompliantEmail(ses, ddb, tableName, config, {
              to: email,
              userId,
              category: "celebration",
              subject: tpl.subject,
              textBody: tpl.textBody,
              htmlBody: tpl.htmlBody,
            });
          } catch (err) {
            console.error(`[commitment-followup] email send failed for ${userId}:`, err);
          }
        }
      } catch (err) {
        console.error(
          `[commitment-followup] nudge failed for commitment ${c.commitmentId} (${userId}):`,
          err,
        );
        errors++;
        continue;
      }
    }
  }

  return { sent, skipped, errors };
}
