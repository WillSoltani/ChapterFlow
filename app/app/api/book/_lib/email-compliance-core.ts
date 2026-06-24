import crypto from "node:crypto";

/**
 * Pure (no server-only, no env) CASL/CAN-SPAM email-compliance primitives:
 * signed one-click unsubscribe tokens, `List-Unsubscribe` headers, and the
 * legally-required footer. Kept dependency-free so it can be unit-tested.
 *
 * IMPORTANT: the token format here MUST stay byte-for-byte identical to
 * `infra/lambda/lib/email-compliance.ts`, which signs the same tokens from the
 * reminder cron. The public unsubscribe route verifies tokens minted by both.
 * `email-compliance-core.test.ts` pins a golden token vector for this contract.
 */

/** Email categories a user can unsubscribe from. Each maps to a notification preference. */
export type EmailCategory =
  | "reading_reminder"
  | "streak"
  | "weekly_digest"
  | "welcome_back"
  | "celebration"
  | "all";

export const EMAIL_CATEGORIES: ReadonlySet<string> = new Set<EmailCategory>([
  "reading_reminder",
  "streak",
  "weekly_digest",
  "welcome_back",
  "celebration",
  "all",
]);

// Unsubscribe links live inside emails that persist for years, and CASL requires
// the unsubscribe mechanism to keep working for at least 60 days. Use a long TTL.
export const TOKEN_TTL_SECONDS = 400 * 24 * 60 * 60;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function hmac(body: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(body).digest());
}

/** Mint a signed unsubscribe token for `userId` + `category`. */
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

/** Verify a token. Returns the userId + category, or null if invalid/expired. */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): { userId: string; category: EmailCategory } | null {
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = hmac(body, secret);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const raw = b64urlDecode(body).toString("utf8");
  const [userId, category, expStr] = raw.split("|");
  const exp = Number(expStr);
  if (!userId || !category || !Number.isFinite(exp) || nowSeconds > exp) return null;
  if (!EMAIL_CATEGORIES.has(category)) return null;
  return { userId, category: category as EmailCategory };
}

export type EmailComplianceConfig = {
  senderEmail: string;
  senderName: string;
  supportAddress: string;
  postalAddress: string;
  appBaseUrl: string;
  secret: string;
  /** SES configuration set name (for bounce/complaint event tracking). */
  configurationSet: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build the one-click unsubscribe URL for a token. */
export function buildUnsubscribeUrl(appBaseUrl: string, token: string): string {
  return `${appBaseUrl.replace(/\/+$/, "")}/app/api/book/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** RFC 2369 / RFC 8058 List-Unsubscribe headers for SESv2 Simple content. */
export function unsubscribeHeaders(
  unsubscribeUrl: string,
  mailto: string,
): Array<{ Name: string; Value: string }> {
  return [
    { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>, <${mailto}>` },
    { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
  ];
}

/**
 * Build the legally-required email footer (sender identification, postal
 * address, reason-for-receipt, and a working unsubscribe link). Appended to the
 * body of every commercial email.
 */
export function emailFooter(params: {
  config: EmailComplianceConfig;
  unsubscribeUrl: string;
  reasonLine: string;
}): { text: string; html: string } {
  const { config, unsubscribeUrl, reasonLine } = params;
  const prefsUrl = `${config.appBaseUrl}/book/settings#notifications`;
  const addressLine = config.postalAddress ? `\n${config.postalAddress}` : "";

  const text =
    `\n\n—\n${config.senderName}${addressLine}\n\n` +
    `${reasonLine}\n` +
    `Unsubscribe: ${unsubscribeUrl}\n` +
    `Manage email preferences: ${prefsUrl}`;

  const addressHtml = config.postalAddress
    ? `<br/>${escapeHtml(config.postalAddress)}`
    : "";
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

export function reasonLineForCategory(category: EmailCategory): string {
  return REASON_BY_CATEGORY[category];
}

/**
 * The per-category notification preference flags that gate whether a commercial
 * email in each {@link EmailCategory} may be sent. A flag defaults to ENABLED:
 * only an explicit `false` suppresses (matching the cron nudge handlers and the
 * unsubscribe route's `applyUnsubscribe`, which writes `false` on opt-out).
 */
export type EmailCategoryPreferences = {
  readingReminderEnabled?: boolean;
  streakReminderEnabled?: boolean;
  weeklyDigestEnabled?: boolean;
  welcomeBackEnabled?: boolean;
  badgeCelebrationEnabled?: boolean;
  achievementAlertsEnabled?: boolean;
};

/**
 * Whether the user's per-category preference permits an email in `category`.
 * This is the INVERSE of `applyUnsubscribe` in the unsubscribe route: a one-click
 * category unsubscribe writes the matching flag(s) to `false`, so every
 * email-sending path MUST consult this or the legally-required opt-out is ignored
 * (CASL §6 / CAN-SPAM §5(a)(4)). The master `channels.email` toggle (the "all"
 * unsubscribe) is checked separately by the caller.
 */
export function isEmailCategoryEnabled(
  prefs: EmailCategoryPreferences,
  category: EmailCategory,
): boolean {
  switch (category) {
    case "reading_reminder":
      return prefs.readingReminderEnabled !== false;
    case "streak":
      return prefs.streakReminderEnabled !== false;
    case "weekly_digest":
      return prefs.weeklyDigestEnabled !== false;
    case "welcome_back":
      return prefs.welcomeBackEnabled !== false;
    case "celebration":
      // The "celebration" unsubscribe sets BOTH flags false, so either one being
      // false means the user opted out of this category.
      return (
        prefs.badgeCelebrationEnabled !== false &&
        prefs.achievementAlertsEnabled !== false
      );
    case "all":
      // "all" maps to the master channels.email toggle, gated by the caller.
      return true;
  }
}
