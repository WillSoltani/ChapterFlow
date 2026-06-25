import crypto from "node:crypto";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

/**
 * CASL / CAN-SPAM compliance helpers for the reminder/nudge cron emails:
 * signed one-click unsubscribe tokens, `List-Unsubscribe` headers, and the
 * legally-required footer (sender identification + postal address + working
 * unsubscribe link).
 *
 * IMPORTANT: the token format here MUST stay byte-for-byte identical to
 * `app/app/api/book/_lib/email-compliance.ts`, whose public unsubscribe route
 * verifies the tokens minted here.
 */

export type EmailCategory =
  | "reading_reminder"
  | "streak"
  | "weekly_digest"
  | "welcome_back"
  | "celebration"
  | "all";

const TOKEN_TTL_SECONDS = 400 * 24 * 60 * 60;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hmac(body: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(body).digest());
}

export function signUnsubscribeToken(
  userId: string,
  category: EmailCategory,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const exp = nowSeconds + TOKEN_TTL_SECONDS;
  const body = b64url(Buffer.from(`${userId}|${category}|${exp}`, "utf8"));
  return `${body}.${hmac(body, secret)}`;
}

export type EmailConfig = {
  senderEmail: string;
  senderName: string;
  supportAddress: string;
  postalAddress: string;
  appBaseUrl: string;
  secret: string;
  configurationSet: string;
};

/**
 * True if the address was suppressed by a hard bounce or complaint. Replicates
 * the `BOOKSUPPRESS#<email>` key from app/app/api/book/_lib/keys.ts (separate
 * build root). Fails open (returns false) on a lookup error so a transient
 * DynamoDB issue doesn't silently drop all email.
 */
export async function isEmailSuppressed(
  ddb: DynamoDBDocumentClient,
  tableName: string,
  email: string,
): Promise<boolean> {
  if (!email) return false;
  try {
    const res = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `BOOKSUPPRESS#${email.trim().toLowerCase()}`, SK: "SUPPRESSION" },
        ProjectionExpression: "email",
      }),
    );
    return !!res.Item;
  } catch {
    return false;
  }
}

let warnedMissingSecret = false;
let warnedMissingAddress = false;
let warnedMissingAppBaseUrl = false;

export function getEmailConfig(): EmailConfig {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
  if (!secret && !warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      "[email-compliance] EMAIL_UNSUBSCRIBE_SECRET is not set — one-click unsubscribe " +
        "links will not verify. The List-Unsubscribe mailto fallback still works.",
    );
  }
  return {
    senderEmail: process.env.SES_SENDER_EMAIL ?? "",
    senderName: process.env.EMAIL_SENDER_NAME || "ChapterFlow",
    supportAddress: process.env.EMAIL_SUPPORT_ADDRESS || "support@chapterflow.ca",
    postalAddress: process.env.EMAIL_POSTAL_ADDRESS ?? "",
    // No siliconx.ca fallback: the legacy host no longer serves the unsubscribe
    // route. An empty value makes sendCompliantEmail refuse to send (below)
    // rather than mint a non-working one-click-unsubscribe link (CASL violation).
    appBaseUrl: (process.env.APP_BASE_URL || "").replace(/\/+$/, ""),
    secret,
    configurationSet: process.env.SES_CONFIGURATION_SET ?? "",
  };
}

// ── SSM overlay ───────────────────────────────────────────────────────────────
// The owner-provided values (postal address, unsubscribe secret, sender name,
// support) are read at runtime from SSM /chapterflow/<env>/EMAIL_* — the SAME
// params the app reads — so they are configured in ONE place. Resolved once per
// warm container; failures fall back to the process.env/default values above.

let ssmClient: SSMClient | null = null;
const SSM_PREFIX = (process.env.SSM_PARAMETER_PREFIX || "").trim();

async function ssmParam(key: string): Promise<string | undefined> {
  if (!SSM_PREFIX) return undefined;
  try {
    ssmClient ??= new SSMClient({});
    const res = await ssmClient.send(
      new GetParameterCommand({ Name: `${SSM_PREFIX}/${key}`, WithDecryption: true }),
    );
    const value = res.Parameter?.Value?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

let cachedConfig: EmailConfig | null = null;

/** getEmailConfig() with owner values overlaid from SSM. Use this in the cron. */
export async function resolveEmailConfig(): Promise<EmailConfig> {
  if (cachedConfig) return cachedConfig;
  const base = getEmailConfig();
  const [postalAddress, secret, senderName, supportAddress, appBaseUrl] = await Promise.all([
    ssmParam("EMAIL_POSTAL_ADDRESS"),
    ssmParam("EMAIL_UNSUBSCRIBE_SECRET"),
    ssmParam("EMAIL_SENDER_NAME"),
    ssmParam("EMAIL_SUPPORT_ADDRESS"),
    // Owner override for the app host (otherwise the Lambda's APP_BASE_URL env,
    // set from CHAPTERFLOW_APP_BASE_URL at deploy time, is used). Same one-place
    // SSM model as the other EMAIL_* values.
    ssmParam("EMAIL_APP_BASE_URL"),
  ]);
  cachedConfig = {
    ...base,
    postalAddress: postalAddress ?? base.postalAddress,
    secret: secret ?? base.secret,
    senderName: senderName ?? base.senderName,
    supportAddress: supportAddress ?? base.supportAddress,
    appBaseUrl: (appBaseUrl ?? base.appBaseUrl).replace(/\/+$/, ""),
  };
  return cachedConfig;
}

/**
 * Escape the HTML-significant characters so user-controlled values
 * (displayName, commitment text) interpolated into an email `htmlBody` cannot
 * inject markup. The text body never needs this. Exported so the email
 * templates in ./email-templates can reuse the single source of truth used by
 * the compliant footer below.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildUnsubscribeUrl(appBaseUrl: string, token: string): string {
  return `${appBaseUrl.replace(/\/+$/, "")}/app/api/book/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

const REASON_BY_CATEGORY: Record<EmailCategory, string> = {
  reading_reminder:
    "You're receiving this because daily reading reminders are enabled in your ChapterFlow account.",
  streak:
    "You're receiving this because streak reminders are enabled in your ChapterFlow account.",
  weekly_digest:
    "You're receiving this because the weekly digest is enabled in your ChapterFlow account.",
  welcome_back:
    "You're receiving this because return nudges are enabled in your ChapterFlow account.",
  celebration:
    "You're receiving this because achievement emails are enabled in your ChapterFlow account.",
  all: "You're receiving this because email notifications are enabled in your ChapterFlow account.",
};

function emailFooter(
  config: EmailConfig,
  unsubscribeUrl: string,
  category: EmailCategory,
): { text: string; html: string } {
  const reasonLine = REASON_BY_CATEGORY[category];
  const prefsUrl = `${config.appBaseUrl}/book/settings#notifications`;
  const addressLine = config.postalAddress ? `\n${config.postalAddress}` : "";

  const text =
    `\n\n—\n${config.senderName}${addressLine}\n\n` +
    `${reasonLine}\n` +
    `Unsubscribe: ${unsubscribeUrl}\n` +
    `Manage email preferences: ${prefsUrl}`;

  const addressHtml = config.postalAddress ? `<br/>${escapeHtml(config.postalAddress)}` : "";
  const html =
    `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>` +
    `<p style="color:#999;font-size:11px;line-height:1.6;margin:0">` +
    `<strong>${escapeHtml(config.senderName)}</strong>${addressHtml}</p>` +
    `<p style="color:#999;font-size:11px;line-height:1.6;margin:8px 0 0">` +
    `${escapeHtml(reasonLine)}<br/>` +
    `<a href="${unsubscribeUrl}" style="color:#999">Unsubscribe</a> · ` +
    `<a href="${prefsUrl}" style="color:#999">Manage email preferences</a></p>`;

  return { text, html };
}

/**
 * Send a commercial email with full CASL/CAN-SPAM compliance: friendly sender
 * identification, reply-to support, a one-click unsubscribe footer, and the
 * `List-Unsubscribe` / `List-Unsubscribe-Post` headers. The template provides
 * the core body; the compliant footer is appended here.
 */
export async function sendCompliantEmail(
  ses: SESv2Client,
  ddb: DynamoDBDocumentClient,
  tableName: string,
  config: EmailConfig,
  params: {
    to: string;
    userId: string;
    category: EmailCategory;
    subject: string;
    textBody: string;
    htmlBody: string;
  },
): Promise<void> {
  // CASL/CAN-SPAM require a postal address in every commercial email. Without
  // one we must not send (the footer would be non-compliant). This is the
  // automatic kill-switch: set EMAIL_POSTAL_ADDRESS to enable reminder/digest
  // email. Transactional email (e.g. trial-ending) does not use this path.
  if (!config.postalAddress) {
    if (!warnedMissingAddress) {
      warnedMissingAddress = true;
      console.warn(
        "[email-compliance] EMAIL_POSTAL_ADDRESS not set — skipping commercial email " +
          "(CASL/CAN-SPAM require a postal address). Set it to enable reminder/digest email.",
      );
    }
    return;
  }

  // Mirror the postal-address kill-switch for the app host. Without a real app
  // base URL the one-click unsubscribe link, List-Unsubscribe header, and CTA
  // links would point at nothing (or the dead legacy host). A non-working
  // unsubscribe link is itself a CASL/CAN-SPAM violation, so refuse to send.
  if (!config.appBaseUrl) {
    if (!warnedMissingAppBaseUrl) {
      warnedMissingAppBaseUrl = true;
      console.warn(
        "[email-compliance] APP_BASE_URL not set — skipping commercial email " +
          "(one-click unsubscribe + CTA links require the live app host). Set " +
          "CHAPTERFLOW_APP_BASE_URL on the cron Lambda (or EMAIL_APP_BASE_URL in SSM).",
      );
    }
    return;
  }

  // Never email an address that hard-bounced or filed a complaint (deliverability
  // + a complaint is an implied opt-out).
  if (await isEmailSuppressed(ddb, tableName, params.to)) return;

  const token = signUnsubscribeToken(params.userId, params.category, config.secret);
  const unsubscribeUrl = buildUnsubscribeUrl(config.appBaseUrl, token);
  const mailto = `mailto:${config.supportAddress}?subject=unsubscribe`;
  const footer = emailFooter(config, unsubscribeUrl, params.category);

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: config.senderName
        ? `${config.senderName} <${config.senderEmail}>`
        : config.senderEmail,
      ReplyToAddresses: [config.supportAddress],
      ConfigurationSetName: config.configurationSet || undefined,
      Destination: { ToAddresses: [params.to] },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: params.textBody + footer.text, Charset: "UTF-8" },
            Html: { Data: params.htmlBody + footer.html, Charset: "UTF-8" },
          },
          Headers: [
            { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>, <${mailto}>` },
            { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
          ],
        },
      },
    }),
  );
}
