// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  emailSuppressionPk,
  emailSuppressionSk,
  nowIso,
  trialEndingEmailPk,
  trialEndingEmailSk,
} from "./keys";
import { isAddressSuppressed } from "./email-compliance-core";
import {
  isConditionalCheckFailed,
  readStr,
} from "./repo-shared";

/**
 * Atomically claim the right to send the transactional "trial ends soon" email
 * for a (customer, trial_end) pair. Returns true exactly once: the first caller
 * wins via a ConditionExpression, every redelivery loses and gets false (skip
 * the send). This prevents duplicate pre-charge notices when the
 * customer.subscription.trial_will_end webhook is retried after a successful
 * send but a later step (completeStripeWebhookEvent / metrics) fails (L12).
 */
export async function markTrialEndingEmailSent(
  tableName: string,
  customerId: string,
  trialEndUnix: number
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: trialEndingEmailPk(customerId),
          SK: trialEndingEmailSk(trialEndUnix),
          entity: "BOOK_TRIAL_ENDING_EMAIL",
          customerId,
          trialEndUnix,
          createdAt: nowIso(),
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

/**
 * Release a trial-ending-email claim taken by {@link markTrialEndingEmailSent}
 * when the send did NOT succeed, so a later Stripe redelivery of
 * trial_will_end can re-attempt the (card-network-required) pre-charge notice
 * instead of being permanently suppressed by the dedup marker. Best-effort:
 * a failed release just leaves the marker (the pre-fix behavior). Mirrors
 * releaseStripeWebhookClaim's release-on-failure discipline (L12).
 */
export async function releaseTrialEndingEmailClaim(
  tableName: string,
  customerId: string,
  trialEndUnix: number
): Promise<void> {
  try {
    await ddbDoc.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          PK: trialEndingEmailPk(customerId),
          SK: trialEndingEmailSk(trialEndUnix),
        },
      })
    );
  } catch {
    // Best-effort — leaving the marker is the safe-ish pre-fix default.
  }
}

// ── Email suppression (bounce/complaint deliverability) ───────────────────────

export type EmailSuppressionRecord = {
  email: string;
  reason: "bounce" | "complaint";
  subtype?: string;
  source?: string;
  createdAt: string;
};

/**
 * True if the address has been suppressed by a hard bounce or complaint.
 *
 * FAILS CLOSED: a read error returns `true` (treat as suppressed) so a transient
 * DynamoDB blip cannot re-enable sends to a hard-bounced/complained address —
 * an implied opt-out is compliance-critical (CASL/CAN-SPAM) and re-mailing it is
 * a violation + deliverability hazard. We skip the individual send and log,
 * rather than swallow the error and send (the previous, fail-open behavior).
 * Mirrors `infra/lambda/lib/email-compliance.ts:isEmailSuppressed`.
 */
export async function isEmailSuppressed(
  tableName: string,
  email: string
): Promise<boolean> {
  if (!email) return false;
  try {
    const res = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: emailSuppressionPk(email), SK: emailSuppressionSk() },
        ProjectionExpression: "email",
      })
    );
    return isAddressSuppressed({ ok: true, itemFound: !!res.Item });
  } catch (error) {
    console.error(
      "[repo] email suppression lookup failed — failing CLOSED (treating address as suppressed, skipping this send)",
      error
    );
    return isAddressSuppressed({ ok: false, error });
  }
}

export async function getEmailSuppression(
  tableName: string,
  email: string
): Promise<EmailSuppressionRecord | null> {
  if (!email) return null;
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: emailSuppressionPk(email), SK: emailSuppressionSk() },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    email: readStr(item.email) || email.trim().toLowerCase(),
    reason: readStr(item.reason) === "complaint" ? "complaint" : "bounce",
    subtype: readStr(item.subtype) || undefined,
    source: readStr(item.source) || undefined,
    createdAt: readStr(item.createdAt) || "",
  };
}

/** Add or refresh a suppression record (used by ops/admin tooling and tests). */
export async function putEmailSuppression(
  tableName: string,
  params: { email: string; reason: "bounce" | "complaint"; subtype?: string; source?: string }
): Promise<void> {
  const email = params.email.trim().toLowerCase();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: emailSuppressionPk(email),
        SK: emailSuppressionSk(),
        entity: "BOOK_EMAIL_SUPPRESSION",
        email,
        reason: params.reason,
        subtype: params.subtype,
        source: params.source,
        createdAt: nowIso(),
      },
    })
  );
}
