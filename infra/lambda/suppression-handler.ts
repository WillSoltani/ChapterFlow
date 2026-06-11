// SES bounce/complaint → DynamoDB suppression handler.
//
// Triggered by SNS (the SES configuration-set event destination for Bounce +
// Complaint). Writes one suppression record per hard-bounced / complained
// address; commercial sends check this before emailing. Env: BOOK_TABLE_NAME.
//
// NOTE: `parseSesSuppressionEvent` and the `BOOKSUPPRESS#<email>` key format are
// replicated from app/app/api/book/_lib/{ses-suppression-events,keys}.ts
// (separate build root). Keep them in sync —
// `ses-suppression-events.test.ts` pins the parser behavior.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const tableName = process.env.BOOK_TABLE_NAME!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

type SuppressionEntry = { email: string; reason: "bounce" | "complaint"; subtype?: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function recipientEmails(recipients: unknown): string[] {
  if (!Array.isArray(recipients)) return [];
  return recipients
    .map((r) => asRecord(r)?.emailAddress)
    .filter((e): e is string => typeof e === "string" && e.length > 0);
}

function parseSesSuppressionEvent(raw: unknown): SuppressionEntry[] {
  let msg: unknown = raw;
  if (typeof raw === "string") {
    try {
      msg = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const root = asRecord(msg);
  if (!root) return [];

  const type = root.eventType ?? root.notificationType;

  if (type === "Bounce") {
    const bounce = asRecord(root.bounce);
    if (!bounce || bounce.bounceType !== "Permanent") return [];
    const subtype = typeof bounce.bounceSubType === "string" ? bounce.bounceSubType : undefined;
    return recipientEmails(bounce.bouncedRecipients).map((email) => ({
      email,
      reason: "bounce" as const,
      subtype,
    }));
  }

  if (type === "Complaint") {
    const complaint = asRecord(root.complaint);
    if (!complaint) return [];
    const subtype =
      typeof complaint.complaintFeedbackType === "string"
        ? complaint.complaintFeedbackType
        : undefined;
    return recipientEmails(complaint.complainedRecipients).map((email) => ({
      email,
      reason: "complaint" as const,
      subtype,
    }));
  }

  return [];
}

type SnsEvent = { Records?: Array<{ Sns?: { Message?: string } }> };

export async function handler(event: SnsEvent) {
  let suppressed = 0;
  for (const record of event.Records ?? []) {
    const message = record.Sns?.Message;
    if (!message) continue;
    for (const entry of parseSesSuppressionEvent(message)) {
      const email = entry.email.trim().toLowerCase();
      try {
        await ddb.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              PK: `BOOKSUPPRESS#${email}`,
              SK: "SUPPRESSION",
              entity: "BOOK_EMAIL_SUPPRESSION",
              email,
              reason: entry.reason,
              subtype: entry.subtype,
              source: "ses",
              createdAt: new Date().toISOString(),
            },
          }),
        );
        suppressed++;
        console.log(`[suppression] ${entry.reason} suppressed ${email.slice(0, 3)}***`);
      } catch (e) {
        console.error("[suppression] write failed:", e);
      }
    }
  }
  console.log(`[suppression] processed ${event.Records?.length ?? 0} records, suppressed ${suppressed}`);
  return { suppressed };
}
