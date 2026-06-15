"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/reading-reminder-cron.ts
var reading_reminder_cron_exports = {};
__export(reading_reminder_cron_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(reading_reminder_cron_exports);
var import_lib_dynamodb5 = require("@aws-sdk/lib-dynamodb");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_client_sesv22 = require("@aws-sdk/client-sesv2");

// lambda/lib/streak-at-risk.ts
var import_lib_dynamodb2 = require("@aws-sdk/lib-dynamodb");

// lambda/lib/email-templates/streak-at-risk.ts
function streakAtRiskEmail(params) {
  const cta = `${params.appBaseUrl}/dashboard`;
  return {
    subject: `Your ${params.currentStreak}-day streak ends in ${params.hoursRemaining} hours`,
    textBody: `Hi ${params.name},

Your ${params.currentStreak}-day reading streak ends tonight. Open ChapterFlow and complete one chapter to keep it alive.

Keep your streak alive: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">${params.currentStreak}-Day Streak at Risk</h2><p>Hi ${params.name},</p><p>Your <strong>${params.currentStreak}-day</strong> reading streak ends in <strong>${params.hoursRemaining} hours</strong>.</p><p>Open ChapterFlow and complete one chapter to keep it alive.</p><p><a href="${cta}" style="color:#6366f1">Keep your streak alive</a></p></div>`
  };
}

// lambda/lib/email-compliance.ts
var import_node_crypto = __toESM(require("node:crypto"));
var import_client_sesv2 = require("@aws-sdk/client-sesv2");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_ssm = require("@aws-sdk/client-ssm");
var TOKEN_TTL_SECONDS = 400 * 24 * 60 * 60;
function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function hmac(body, secret) {
  return b64url(import_node_crypto.default.createHmac("sha256", secret).update(body).digest());
}
function signUnsubscribeToken(userId, category, secret, nowSeconds = Math.floor(Date.now() / 1e3)) {
  const exp = nowSeconds + TOKEN_TTL_SECONDS;
  const body = b64url(Buffer.from(`${userId}|${category}|${exp}`, "utf8"));
  return `${body}.${hmac(body, secret)}`;
}
async function isEmailSuppressed(ddb2, tableName2, email) {
  if (!email) return false;
  try {
    const res = await ddb2.send(
      new import_lib_dynamodb.GetCommand({
        TableName: tableName2,
        Key: { PK: `BOOKSUPPRESS#${email.trim().toLowerCase()}`, SK: "SUPPRESSION" },
        ProjectionExpression: "email"
      })
    );
    return !!res.Item;
  } catch {
    return false;
  }
}
var warnedMissingSecret = false;
var warnedMissingAddress = false;
var warnedMissingAppBaseUrl = false;
function getEmailConfig() {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "";
  if (!secret && !warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      "[email-compliance] EMAIL_UNSUBSCRIBE_SECRET is not set \u2014 one-click unsubscribe links will not verify. The List-Unsubscribe mailto fallback still works."
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
    configurationSet: process.env.SES_CONFIGURATION_SET ?? ""
  };
}
var ssmClient = null;
var SSM_PREFIX = (process.env.SSM_PARAMETER_PREFIX || "").trim();
async function ssmParam(key) {
  if (!SSM_PREFIX) return void 0;
  try {
    ssmClient ??= new import_client_ssm.SSMClient({});
    const res = await ssmClient.send(
      new import_client_ssm.GetParameterCommand({ Name: `${SSM_PREFIX}/${key}`, WithDecryption: true })
    );
    const value = res.Parameter?.Value?.trim();
    return value || void 0;
  } catch {
    return void 0;
  }
}
var cachedConfig = null;
async function resolveEmailConfig() {
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
    ssmParam("EMAIL_APP_BASE_URL")
  ]);
  cachedConfig = {
    ...base,
    postalAddress: postalAddress ?? base.postalAddress,
    secret: secret ?? base.secret,
    senderName: senderName ?? base.senderName,
    supportAddress: supportAddress ?? base.supportAddress,
    appBaseUrl: (appBaseUrl ?? base.appBaseUrl).replace(/\/+$/, "")
  };
  return cachedConfig;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function buildUnsubscribeUrl(appBaseUrl, token) {
  return `${appBaseUrl.replace(/\/+$/, "")}/app/api/book/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
var REASON_BY_CATEGORY = {
  reading_reminder: "You're receiving this because daily reading reminders are enabled in your ChapterFlow account.",
  streak: "You're receiving this because streak reminders are enabled in your ChapterFlow account.",
  weekly_digest: "You're receiving this because the weekly digest is enabled in your ChapterFlow account.",
  welcome_back: "You're receiving this because return nudges are enabled in your ChapterFlow account.",
  celebration: "You're receiving this because achievement emails are enabled in your ChapterFlow account.",
  all: "You're receiving this because email notifications are enabled in your ChapterFlow account."
};
function emailFooter(config, unsubscribeUrl, category) {
  const reasonLine = REASON_BY_CATEGORY[category];
  const prefsUrl = `${config.appBaseUrl}/book/settings#notifications`;
  const addressLine = config.postalAddress ? `
${config.postalAddress}` : "";
  const text = `

\u2014
${config.senderName}${addressLine}

${reasonLine}
Unsubscribe: ${unsubscribeUrl}
Manage email preferences: ${prefsUrl}`;
  const addressHtml = config.postalAddress ? `<br/>${escapeHtml(config.postalAddress)}` : "";
  const html = `<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/><p style="color:#999;font-size:11px;line-height:1.6;margin:0"><strong>${escapeHtml(config.senderName)}</strong>${addressHtml}</p><p style="color:#999;font-size:11px;line-height:1.6;margin:8px 0 0">${escapeHtml(reasonLine)}<br/><a href="${unsubscribeUrl}" style="color:#999">Unsubscribe</a> \xB7 <a href="${prefsUrl}" style="color:#999">Manage email preferences</a></p>`;
  return { text, html };
}
async function sendCompliantEmail(ses2, ddb2, tableName2, config, params) {
  if (!config.postalAddress) {
    if (!warnedMissingAddress) {
      warnedMissingAddress = true;
      console.warn(
        "[email-compliance] EMAIL_POSTAL_ADDRESS not set \u2014 skipping commercial email (CASL/CAN-SPAM require a postal address). Set it to enable reminder/digest email."
      );
    }
    return;
  }
  if (!config.appBaseUrl) {
    if (!warnedMissingAppBaseUrl) {
      warnedMissingAppBaseUrl = true;
      console.warn(
        "[email-compliance] APP_BASE_URL not set \u2014 skipping commercial email (one-click unsubscribe + CTA links require the live app host). Set CHAPTERFLOW_APP_BASE_URL on the cron Lambda (or EMAIL_APP_BASE_URL in SSM)."
      );
    }
    return;
  }
  if (await isEmailSuppressed(ddb2, tableName2, params.to)) return;
  const token = signUnsubscribeToken(params.userId, params.category, config.secret);
  const unsubscribeUrl = buildUnsubscribeUrl(config.appBaseUrl, token);
  const mailto = `mailto:${config.supportAddress}?subject=unsubscribe`;
  const footer = emailFooter(config, unsubscribeUrl, params.category);
  await ses2.send(
    new import_client_sesv2.SendEmailCommand({
      FromEmailAddress: config.senderName ? `${config.senderName} <${config.senderEmail}>` : config.senderEmail,
      ReplyToAddresses: [config.supportAddress],
      ConfigurationSetName: config.configurationSet || void 0,
      Destination: { ToAddresses: [params.to] },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: params.textBody + footer.text, Charset: "UTF-8" },
            Html: { Data: params.htmlBody + footer.html, Charset: "UTF-8" }
          },
          Headers: [
            { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>, <${mailto}>` },
            { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" }
          ]
        }
      }
    })
  );
}

// lambda/lib/streak-at-risk.ts
function getTodayInTimezone(tz) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(/* @__PURE__ */ new Date());
  } catch {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
}
async function processStreakAtRisk(ddb2, ses2, tableName2, config, userItems) {
  let sent = 0;
  let skipped = 0;
  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.streakReminderEnabled === false) {
      skipped++;
      continue;
    }
    if (item.settings?.extended?.streakMode === "off") {
      skipped++;
      continue;
    }
    const userId = item.PK.replace("BOOKUSER#", "");
    const streakResult = await ddb2.send(
      new import_lib_dynamodb2.GetCommand({
        TableName: tableName2,
        Key: { PK: item.PK, SK: "STREAK" }
      })
    );
    const streak = streakResult.Item;
    if (!streak || !streak.currentStreak || streak.currentStreak < 2 || !streak.lastActiveDate) {
      skipped++;
      continue;
    }
    const tz = streak.lastActiveTimezone || "UTC";
    const today = getTodayInTimezone(tz);
    if (streak.lastActiveDate === today) {
      skipped++;
      continue;
    }
    const dedupKey = `NUDGE_SENT#streak_at_risk#${today}`;
    const dedupResult = await ddb2.send(
      new import_lib_dynamodb2.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: dedupKey } })
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }
    let hoursRemaining = 6;
    try {
      const nowInTz = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { timeZone: tz, hour12: false });
      const currentHour = parseInt(nowInTz.split(":")[0], 10);
      hoursRemaining = Math.max(0, 24 - currentHour);
    } catch {
    }
    if (hoursRemaining > 8) {
      skipped++;
      continue;
    }
    const notifId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await ddb2.send(
      new import_lib_dynamodb2.PutCommand({
        TableName: tableName2,
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
          createdAt: now
        }
      })
    );
    if (notifications?.channels?.email !== false) {
      try {
        const profileResult = await ddb2.send(
          new import_lib_dynamodb2.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "PROFILE" } })
        );
        const email = profileResult.Item?.email;
        const name = profileResult.Item?.displayName ?? "Reader";
        if (email) {
          const tpl = streakAtRiskEmail({
            name,
            currentStreak: streak.currentStreak,
            hoursRemaining,
            appBaseUrl: config.appBaseUrl
          });
          await sendCompliantEmail(ses2, ddb2, tableName2, config, {
            to: email,
            userId,
            category: "streak",
            subject: tpl.subject,
            textBody: tpl.textBody,
            htmlBody: tpl.htmlBody
          });
        }
      } catch (err) {
        console.error(`[streak-at-risk] Failed to send email for ${userId}:`, err);
      }
    }
    const ttl = Math.floor(Date.now() / 1e3) + 2 * 86400;
    await ddb2.send(
      new import_lib_dynamodb2.PutCommand({
        TableName: tableName2,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: (/* @__PURE__ */ new Date()).toISOString(), ttl }
      })
    );
    sent++;
  }
  return { sent, skipped };
}

// lambda/lib/weekly-digest.ts
var import_lib_dynamodb3 = require("@aws-sdk/lib-dynamodb");

// lambda/lib/email-templates/weekly-digest.ts
function weeklyDigestEmail(params) {
  const encouragement = params.chaptersCompleted > 0 ? "Great progress this week! Keep the momentum going." : "Take 15 minutes today to get back on track.";
  const cta = `${params.appBaseUrl}/dashboard`;
  return {
    subject: `Your ChapterFlow Week: ${params.chaptersCompleted} chapters completed`,
    textBody: `Hi ${params.name},

Your ChapterFlow week: ${params.chaptersCompleted} chapters, ${params.currentStreak}-day streak, ${params.ipBalance} IP. ${encouragement}

Open ChapterFlow: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Your Week in Review</h2><p>Hi ${params.name},</p><ul><li><strong>${params.chaptersCompleted}</strong> chapters completed</li><li><strong>${params.currentStreak}</strong>-day streak</li><li><strong>${params.ipBalance}</strong> Insight Points</li></ul><p>${encouragement}</p><p><a href="${cta}" style="color:#6366f1">Open ChapterFlow</a></p></div>`
  };
}

// lambda/lib/weekly-digest.ts
async function processWeeklyDigest(ddb2, ses2, tableName2, config, userItems) {
  if ((/* @__PURE__ */ new Date()).getUTCDay() !== 0) {
    return { sent: 0, skipped: 0 };
  }
  let sent = 0;
  let skipped = 0;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const weekKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.weeklyDigestEnabled === false) {
      skipped++;
      continue;
    }
    const userId = item.PK.replace("BOOKUSER#", "");
    const dedupKey = `NUDGE_SENT#weekly_digest#${weekKey}`;
    const dedupResult = await ddb2.send(
      new import_lib_dynamodb3.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: dedupKey } })
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }
    const loopsResult = await ddb2.send(
      new import_lib_dynamodb3.QueryCommand({
        TableName: tableName2,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        FilterExpression: "completedAt >= :weekAgo",
        ExpressionAttributeValues: {
          ":pk": item.PK,
          ":prefix": "LOOP#",
          ":weekAgo": weekAgo
        }
      })
    );
    const chaptersCompleted = loopsResult.Items?.length ?? 0;
    const streakResult = await ddb2.send(
      new import_lib_dynamodb3.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "STREAK" } })
    );
    const currentStreak = streakResult.Item?.currentStreak ?? 0;
    const engResult = await ddb2.send(
      new import_lib_dynamodb3.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "ENGAGEMENT" } })
    );
    const ipBalance = engResult.Item?.points ?? 0;
    const profileResult = await ddb2.send(
      new import_lib_dynamodb3.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "PROFILE" } })
    );
    const email = profileResult.Item?.email;
    const name = profileResult.Item?.displayName ?? "Reader";
    const notifId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await ddb2.send(
      new import_lib_dynamodb3.PutCommand({
        TableName: tableName2,
        Item: {
          PK: item.PK,
          SK: `NOTIF#${now}#${notifId}`,
          entity: "BOOK_USER_NOTIFICATION",
          userId,
          notificationId: notifId,
          type: "weekly_digest",
          title: "Your week in review",
          body: `${chaptersCompleted} chapters completed \xB7 ${currentStreak}-day streak \xB7 ${ipBalance} IP`,
          channel: "in_app",
          readAt: null,
          createdAt: now
        }
      })
    );
    if (!email || notifications?.channels?.email === false) {
      const ttl2 = Math.floor(Date.now() / 1e3) + 8 * 86400;
      await ddb2.send(
        new import_lib_dynamodb3.PutCommand({
          TableName: tableName2,
          Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: now, ttl: ttl2 }
        })
      );
      sent++;
      continue;
    }
    try {
      const tpl = weeklyDigestEmail({
        name,
        chaptersCompleted,
        currentStreak,
        ipBalance,
        appBaseUrl: config.appBaseUrl
      });
      await sendCompliantEmail(ses2, ddb2, tableName2, config, {
        to: email,
        userId,
        category: "weekly_digest",
        subject: tpl.subject,
        textBody: tpl.textBody,
        htmlBody: tpl.htmlBody
      });
      sent++;
    } catch (err) {
      console.error(`[weekly-digest] Failed for ${userId}:`, err);
      skipped++;
    }
    const ttl = Math.floor(Date.now() / 1e3) + 8 * 86400;
    await ddb2.send(
      new import_lib_dynamodb3.PutCommand({
        TableName: tableName2,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: (/* @__PURE__ */ new Date()).toISOString(), ttl }
      })
    );
  }
  return { sent, skipped };
}

// lambda/lib/welcome-back-nudge.ts
var import_lib_dynamodb4 = require("@aws-sdk/lib-dynamodb");

// lambda/lib/email-templates/welcome-back.ts
function welcomeBackEmail(params) {
  const cta = `${params.appBaseUrl}/dashboard`;
  return {
    subject: `We saved your spot, ${params.name}`,
    textBody: `Hi ${params.name},

It's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.

Jump back in and earn 30 Insight Points just for returning.

Pick up where you left off: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Welcome Back, ${params.name}</h2><p>It's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.</p><p>Jump back in and earn <strong>30 Insight Points</strong> just for returning.</p><p><a href="${cta}" style="color:#6366f1">Pick up where you left off</a></p></div>`
  };
}

// lambda/lib/welcome-back-nudge.ts
async function processWelcomeBackNudge(ddb2, ses2, tableName2, config, userItems) {
  let sent = 0;
  let skipped = 0;
  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.welcomeBackEnabled === false) {
      skipped++;
      continue;
    }
    const userId = item.PK.replace("BOOKUSER#", "");
    const streakResult = await ddb2.send(
      new import_lib_dynamodb4.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "STREAK" } })
    );
    const lastActiveDate = streakResult.Item?.lastActiveDate;
    if (!lastActiveDate) {
      skipped++;
      continue;
    }
    const daysSinceActive = Math.floor(
      (Date.now() - new Date(lastActiveDate).getTime()) / 864e5
    );
    if (daysSinceActive < 7) {
      skipped++;
      continue;
    }
    const dedupKey = `NUDGE_SENT#welcome_back`;
    const dedupResult = await ddb2.send(
      new import_lib_dynamodb4.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: dedupKey } })
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }
    const progressResult = await ddb2.send(
      new import_lib_dynamodb4.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "PROFILE" } })
    );
    const email = progressResult.Item?.email;
    const name = progressResult.Item?.displayName ?? "Reader";
    const notifId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await ddb2.send(
      new import_lib_dynamodb4.PutCommand({
        TableName: tableName2,
        Item: {
          PK: item.PK,
          SK: `NOTIF#${now}#${notifId}`,
          entity: "BOOK_USER_NOTIFICATION",
          userId,
          notificationId: notifId,
          type: "welcome_back_nudge",
          title: `We saved your spot, ${name}`,
          body: `It's been ${daysSinceActive} days. Jump back in and earn 30 Insight Points.`,
          channel: "in_app",
          readAt: null,
          createdAt: now
        }
      })
    );
    if (!email || notifications?.channels?.email === false) {
      const ttl = Math.floor(Date.now() / 1e3) + 30 * 86400;
      await ddb2.send(
        new import_lib_dynamodb4.PutCommand({
          TableName: tableName2,
          Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: now, ttl }
        })
      );
      sent++;
      continue;
    }
    try {
      const tpl = welcomeBackEmail({ name, daysSinceActive, appBaseUrl: config.appBaseUrl });
      await sendCompliantEmail(ses2, ddb2, tableName2, config, {
        to: email,
        userId,
        category: "welcome_back",
        subject: tpl.subject,
        textBody: tpl.textBody,
        htmlBody: tpl.htmlBody
      });
      const ttl = Math.floor(Date.now() / 1e3) + 30 * 86400;
      await ddb2.send(
        new import_lib_dynamodb4.PutCommand({
          TableName: tableName2,
          Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: (/* @__PURE__ */ new Date()).toISOString(), ttl }
        })
      );
      sent++;
    } catch (err) {
      console.error(`[welcome-back] Failed for ${userId}:`, err);
      skipped++;
    }
  }
  return { sent, skipped };
}

// lambda/lib/email-templates/reading-reminder.ts
function readingReminderEmail(params) {
  const cta = `${params.appBaseUrl}/dashboard`;
  return {
    subject: "Time to read!",
    textBody: `Hi ${params.name},

This is your daily reading reminder. A few minutes of focused reading can make a real difference.

Open ChapterFlow: ${cta}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Time to Read</h2><p>Hi ${params.name},</p><p>This is your daily reading reminder. A few minutes of focused reading can make a real difference.</p><p><a href="${cta}" style="color:#6366f1">Open ChapterFlow</a></p></div>`
  };
}

// lambda/reading-reminder-cron.ts
var tableName = process.env.BOOK_TABLE_NAME;
var REMINDER_CONCURRENCY = 8;
var ddb = import_lib_dynamodb5.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
var ses = new import_client_sesv22.SESv2Client({});
function resolveHour(timeLocal, timezone) {
  try {
    const [h] = timeLocal.split(":").map(Number);
    const now = /* @__PURE__ */ new Date();
    const localStr = now.toLocaleTimeString("en-US", { timeZone: timezone, hour12: false });
    const currentLocalHour = parseInt(localStr.split(":")[0], 10);
    return h === currentLocalHour ? h : -1;
  } catch {
    return -1;
  }
}
async function runWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
async function batchGetByKeys(keys, projection) {
  const collected = [];
  let pending = keys;
  for (let attempt = 0; attempt < 4 && pending.length > 0; attempt++) {
    const res = await ddb.send(
      new import_lib_dynamodb5.BatchGetCommand({
        RequestItems: {
          [tableName]: { Keys: pending, ProjectionExpression: projection }
        }
      })
    );
    collected.push(...res.Responses?.[tableName] ?? []);
    pending = res.UnprocessedKeys?.[tableName]?.Keys ?? [];
    if (pending.length > 0) {
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  if (pending.length > 0) {
    console.warn(
      `[reading-reminder-cron] batchGet left ${pending.length} key(s) unprocessed after retries`
    );
  }
  return collected;
}
async function processReminderUser(user, today, emailConfig) {
  const { pk, userId, notifPrefs } = user;
  const dedupKey = `REMINDER_SENT#${today}`;
  try {
    const rows = await batchGetByKeys(
      [
        { PK: pk, SK: dedupKey },
        { PK: pk, SK: "PROFILE" }
      ],
      "PK, SK, displayName, email"
    );
    if (rows.some((r) => r.SK === dedupKey)) {
      return "skipped";
    }
    const profile = rows.find((r) => r.SK === "PROFILE");
    const name = profile?.displayName ?? "Reader";
    const email = profile?.email;
    const notifId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await ddb.send(
      new import_lib_dynamodb5.UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: `NOTIF#${now}#${notifId}` },
        UpdateExpression: "SET entity = :e, userId = :uid, notificationId = :nid, #type = :type, title = :title, body = :body, channel = :ch, readAt = :null, createdAt = :now",
        ExpressionAttributeNames: { "#type": "type" },
        ExpressionAttributeValues: {
          ":e": "BOOK_USER_NOTIFICATION",
          ":uid": userId,
          ":nid": notifId,
          ":type": "reading_reminder",
          ":title": "Time to read!",
          ":body": "A few minutes of focused reading can make a real difference.",
          ":ch": "in_app",
          ":null": null,
          ":now": now
        }
      })
    );
    if (email && notifPrefs.channels?.email === true) {
      try {
        const tpl = readingReminderEmail({ name, appBaseUrl: emailConfig.appBaseUrl });
        await sendCompliantEmail(ses, ddb, tableName, emailConfig, {
          to: email,
          userId,
          category: "reading_reminder",
          subject: tpl.subject,
          textBody: tpl.textBody,
          htmlBody: tpl.htmlBody
        });
      } catch (e) {
        console.error(`[reading-reminder-cron] email failed for ${userId.slice(0, 8)}:`, e);
      }
    }
    await ddb.send(
      new import_lib_dynamodb5.PutCommand({
        TableName: tableName,
        Item: {
          PK: pk,
          SK: dedupKey,
          entity: "NUDGE_DEDUP",
          createdAt: now,
          ttl: Math.floor(Date.now() / 1e3) + 2 * 24 * 60 * 60
        }
      })
    );
    return "sent";
  } catch (e) {
    console.error(`[reading-reminder-cron] reminder failed for ${userId.slice(0, 8)}:`, e);
    return "error";
  }
}
async function handler() {
  console.log(`[reading-reminder-cron] Running at ${(/* @__PURE__ */ new Date()).toISOString()}`);
  const emailConfig = await resolveEmailConfig();
  let lastKey;
  let skipped = 0;
  const allUserItems = [];
  const dueUsers = [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  do {
    const scan = await ddb.send(
      new import_lib_dynamodb5.ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "BOOK_USER_SETTINGS" },
        ProjectionExpression: "PK, userId, settings",
        ExclusiveStartKey: lastKey
      })
    );
    for (const item of scan.Items ?? []) {
      const userId = item.userId;
      const settings = item.settings;
      allUserItems.push({ PK: item.PK, userId, settings: settings ?? {} });
      const notifPrefs = settings?.notifications ?? {};
      if (!notifPrefs.readingReminderEnabled) {
        skipped++;
        continue;
      }
      const timeLocal = notifPrefs.reminderTimeLocal ?? "20:00";
      const timezone = notifPrefs.reminderTimezone ?? "UTC";
      if (resolveHour(timeLocal, timezone) < 0) {
        skipped++;
        continue;
      }
      dueUsers.push({ pk: item.PK, userId, notifPrefs });
    }
    lastKey = scan.LastEvaluatedKey;
  } while (lastKey);
  const outcomes = await runWithConcurrency(
    dueUsers,
    REMINDER_CONCURRENCY,
    (u) => processReminderUser(u, today, emailConfig)
  );
  const sent = outcomes.filter((o) => o === "sent").length;
  const errors = outcomes.filter((o) => o === "error").length;
  skipped += outcomes.filter((o) => o === "skipped").length;
  console.log(
    `[reading-reminder-cron] Reminders done. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`
  );
  const [streakResult, digestResult, welcomeResult] = await Promise.allSettled([
    processStreakAtRisk(ddb, ses, tableName, emailConfig, allUserItems),
    processWeeklyDigest(ddb, ses, tableName, emailConfig, allUserItems),
    processWelcomeBackNudge(ddb, ses, tableName, emailConfig, allUserItems)
  ]);
  console.log("[reading-reminder-cron] Nudge results:", {
    streakAtRisk: streakResult.status === "fulfilled" ? streakResult.value : "failed",
    weeklyDigest: digestResult.status === "fulfilled" ? digestResult.value : "failed",
    welcomeBack: welcomeResult.status === "fulfilled" ? welcomeResult.value : "failed"
  });
  return { sent, skipped, errors };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
