import "server-only";

import type Stripe from "stripe";
import { sendEmail } from "@/app/app/api/book/_lib/email-service";
import { getEmailComplianceConfig } from "@/app/app/api/book/_lib/email-compliance";
import { isEmailSuppressed, markTrialEndingEmailSent } from "@/app/app/api/book/_lib/repo";

/**
 * Sends the "your free trial ends soon" reminder when Stripe fires
 * `customer.subscription.trial_will_end` (~3 days before the first charge).
 *
 * This is a TRANSACTIONAL email — it warns of an imminent charge and is exempt
 * from CASL/CAN-SPAM unsubscribe requirements, so it carries sender
 * identification + a support reply-to but NO unsubscribe link (a user cannot opt
 * out of being told they're about to be billed). Card-network rules for
 * free-trial → paid conversions expect this pre-charge reminder.
 */

type TrialEndingSubscription = {
  customer: string;
  trial_end?: number | null;
  items?: {
    data?: Array<{
      price?: {
        unit_amount?: number | null;
        currency?: string | null;
        recurring?: { interval?: string | null } | null;
      } | null;
    }>;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(unitAmount: number, currency: string): string {
  return `$${(unitAmount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(unixSeconds * 1000));
}

export async function sendTrialEndingEmail(
  stripe: Stripe,
  tableName: string,
  subscription: TrialEndingSubscription,
): Promise<{ sent: boolean; reason?: string }> {
  if (!subscription.customer || !subscription.trial_end) {
    return { sent: false, reason: "no_trial" };
  }

  const customer = (await stripe.customers.retrieve(subscription.customer)) as {
    deleted?: boolean;
    email?: string | null;
    name?: string | null;
  };
  if (!customer || customer.deleted) return { sent: false, reason: "no_customer" };
  const email = customer.email;
  if (!email) return { sent: false, reason: "no_email" };
  // A hard-bounced or complained address can't (or shouldn't) receive mail.
  if (await isEmailSuppressed(tableName, email)) return { sent: false, reason: "suppressed" };
  const name = customer.name?.trim() || "there";

  const price = subscription.items?.data?.[0]?.price;
  const amount =
    price?.unit_amount != null && price.currency
      ? formatMoney(price.unit_amount, price.currency)
      : null;
  const intervalSuffix =
    price?.recurring?.interval === "year"
      ? "/year"
      : price?.recurring?.interval === "month"
        ? "/month"
        : "";
  const renewalClause = amount ? ` at ${amount}${intervalSuffix}` : "";
  const endDate = formatDate(subscription.trial_end);

  const config = await getEmailComplianceConfig();
  const settingsUrl = `${config.appBaseUrl}/book/settings#subscription`;

  const subject = "Your ChapterFlow free trial ends soon";
  const textBody =
    `Hi ${name},\n\n` +
    `Your ChapterFlow Pro free trial ends on ${endDate}. After that, your subscription renews ` +
    `automatically${renewalClause} unless you cancel.\n\n` +
    `To avoid being charged, cancel anytime before ${endDate} from your account settings:\n` +
    `${settingsUrl}\n\n` +
    `If you'd like to keep Pro, no action is needed — thanks for reading with us.\n\n` +
    `— ChapterFlow\n` +
    `Questions? Just reply to this email or contact ${config.supportAddress}.`;

  const htmlBody =
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">` +
    `<h2 style="color:#6366f1">Your free trial ends soon</h2>` +
    `<p>Hi ${escapeHtml(name)},</p>` +
    `<p>Your ChapterFlow Pro free trial ends on <strong>${endDate}</strong>. After that, your ` +
    `subscription renews automatically${renewalClause ? ` <strong>${amount}${intervalSuffix}</strong>` : ""} ` +
    `unless you cancel.</p>` +
    `<p>To avoid being charged, cancel anytime before ${endDate}:</p>` +
    `<p><a href="${settingsUrl}" style="color:#6366f1">Manage your subscription</a></p>` +
    `<p>If you'd like to keep Pro, no action is needed — thanks for reading with us.</p>` +
    `<p style="color:#999;font-size:12px;margin-top:24px">ChapterFlow · ` +
    `Questions? Reply to this email or contact ${config.supportAddress}.</p></div>`;

  if (!config.senderEmail) return { sent: false, reason: "no_sender" };

  // Per-(customer, trial_end) dedup (L12). Claim the send marker conditionally
  // BEFORE dispatching so a webhook redelivery of trial_will_end (e.g. after a
  // successful send but a failing recordStripeWebhookEvent) cannot re-send this
  // transactional pre-charge notice. The loser of the claim skips the send.
  const claimed = await markTrialEndingEmailSent(
    tableName,
    subscription.customer,
    subscription.trial_end,
  );
  if (!claimed) return { sent: false, reason: "already_sent" };

  const result = await sendEmail({
    to: email,
    subject,
    textBody,
    htmlBody,
    senderEmail: config.senderName
      ? `${config.senderName} <${config.senderEmail}>`
      : config.senderEmail,
    replyTo: config.supportAddress,
    configurationSet: config.configurationSet,
  });
  return { sent: result.sent };
}
