"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/reading-reminder-cron.ts
var reading_reminder_cron_exports = {};
__export(reading_reminder_cron_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(reading_reminder_cron_exports);
var import_lib_dynamodb4 = require("@aws-sdk/lib-dynamodb");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_client_sesv24 = require("@aws-sdk/client-sesv2");

// lambda/lib/streak-at-risk.ts
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_sesv2 = require("@aws-sdk/client-sesv2");

// lambda/lib/email-templates/streak-at-risk.ts
var UNSUB_URL = "https://chapterflow.siliconx.ca/book/settings#notifications";
function streakAtRiskEmail(params) {
  return {
    subject: `Your ${params.currentStreak}-day streak ends in ${params.hoursRemaining} hours`,
    textBody: `Hi ${params.name},

Your ${params.currentStreak}-day reading streak ends tonight. Open ChapterFlow and complete one chapter to keep it alive.

\u2014 ChapterFlow

Manage email preferences: ${UNSUB_URL}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">${params.currentStreak}-Day Streak at Risk</h2><p>Hi ${params.name},</p><p>Your <strong>${params.currentStreak}-day</strong> reading streak ends in <strong>${params.hoursRemaining} hours</strong>.</p><p>Open ChapterFlow and complete one chapter to keep it alive.</p><p><a href="https://chapterflow.siliconx.ca/book/home" style="color:#6366f1">Keep your streak alive</a></p><p style="color:#999;font-size:11px;margin-top:24px">\u2014 ChapterFlow \xB7 <a href="${UNSUB_URL}" style="color:#999">Manage email preferences</a></p></div>`
  };
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
async function processStreakAtRisk(ddb2, ses2, tableName2, senderEmail2, userItems) {
  let sent = 0;
  let skipped = 0;
  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.streakReminderEnabled === false) {
      skipped++;
      continue;
    }
    const userId = item.PK.replace("BOOKUSER#", "");
    const streakResult = await ddb2.send(
      new import_lib_dynamodb.GetCommand({
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
      new import_lib_dynamodb.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: dedupKey } })
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
      new import_lib_dynamodb.PutCommand({
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
          new import_lib_dynamodb.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "PROFILE" } })
        );
        const email = profileResult.Item?.email;
        const name = profileResult.Item?.displayName ?? "Reader";
        if (email) {
          const tpl = streakAtRiskEmail({ name, currentStreak: streak.currentStreak, hoursRemaining });
          await ses2.send(
            new import_client_sesv2.SendEmailCommand({
              FromEmailAddress: senderEmail2,
              Destination: { ToAddresses: [email] },
              Content: {
                Simple: {
                  Subject: { Data: tpl.subject },
                  Body: {
                    Text: { Data: tpl.textBody },
                    Html: { Data: tpl.htmlBody }
                  }
                }
              }
            })
          );
        }
      } catch (err) {
        console.error(`[streak-at-risk] Failed to send email for ${userId}:`, err);
      }
    }
    const ttl = Math.floor(Date.now() / 1e3) + 2 * 86400;
    await ddb2.send(
      new import_lib_dynamodb.PutCommand({
        TableName: tableName2,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: (/* @__PURE__ */ new Date()).toISOString(), ttl }
      })
    );
    sent++;
  }
  return { sent, skipped };
}

// lambda/lib/weekly-digest.ts
var import_lib_dynamodb2 = require("@aws-sdk/lib-dynamodb");
var import_client_sesv22 = require("@aws-sdk/client-sesv2");

// lambda/lib/email-templates/weekly-digest.ts
var UNSUB_URL2 = "https://chapterflow.siliconx.ca/book/settings#notifications";
function weeklyDigestEmail(params) {
  const encouragement = params.chaptersCompleted > 0 ? "Great progress this week! Keep the momentum going." : "Take 15 minutes today to get back on track.";
  return {
    subject: `Your ChapterFlow Week: ${params.chaptersCompleted} chapters completed`,
    textBody: `Hi ${params.name},

Your ChapterFlow week: ${params.chaptersCompleted} chapters, ${params.currentStreak}-day streak, ${params.ipBalance} IP. ${encouragement}

\u2014 ChapterFlow

Manage email preferences: ${UNSUB_URL2}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Your Week in Review</h2><p>Hi ${params.name},</p><ul><li><strong>${params.chaptersCompleted}</strong> chapters completed</li><li><strong>${params.currentStreak}</strong>-day streak</li><li><strong>${params.ipBalance}</strong> Insight Points</li></ul><p>${encouragement}</p><p><a href="https://chapterflow.siliconx.ca/book/home" style="color:#6366f1">Open ChapterFlow</a></p><p style="color:#999;font-size:11px;margin-top:24px">\u2014 ChapterFlow \xB7 <a href="${UNSUB_URL2}" style="color:#999">Manage email preferences</a></p></div>`
  };
}

// lambda/lib/weekly-digest.ts
async function processWeeklyDigest(ddb2, ses2, tableName2, senderEmail2, userItems) {
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
      new import_lib_dynamodb2.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: dedupKey } })
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }
    const loopsResult = await ddb2.send(
      new import_lib_dynamodb2.QueryCommand({
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
      new import_lib_dynamodb2.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "STREAK" } })
    );
    const currentStreak = streakResult.Item?.currentStreak ?? 0;
    const engResult = await ddb2.send(
      new import_lib_dynamodb2.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "ENGAGEMENT" } })
    );
    const ipBalance = engResult.Item?.points ?? 0;
    const profileResult = await ddb2.send(
      new import_lib_dynamodb2.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "PROFILE" } })
    );
    const email = profileResult.Item?.email;
    const name = profileResult.Item?.displayName ?? "Reader";
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
        new import_lib_dynamodb2.PutCommand({
          TableName: tableName2,
          Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: now, ttl: ttl2 }
        })
      );
      sent++;
      continue;
    }
    try {
      const tpl = weeklyDigestEmail({ name, chaptersCompleted, currentStreak, ipBalance });
      await ses2.send(
        new import_client_sesv22.SendEmailCommand({
          FromEmailAddress: senderEmail2,
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: tpl.subject },
              Body: {
                Text: { Data: tpl.textBody },
                Html: { Data: tpl.htmlBody }
              }
            }
          }
        })
      );
      sent++;
    } catch (err) {
      console.error(`[weekly-digest] Failed for ${userId}:`, err);
      skipped++;
    }
    const ttl = Math.floor(Date.now() / 1e3) + 8 * 86400;
    await ddb2.send(
      new import_lib_dynamodb2.PutCommand({
        TableName: tableName2,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: (/* @__PURE__ */ new Date()).toISOString(), ttl }
      })
    );
  }
  return { sent, skipped };
}

// lambda/lib/welcome-back-nudge.ts
var import_lib_dynamodb3 = require("@aws-sdk/lib-dynamodb");
var import_client_sesv23 = require("@aws-sdk/client-sesv2");

// lambda/lib/email-templates/welcome-back.ts
var UNSUB_URL3 = "https://chapterflow.siliconx.ca/book/settings#notifications";
function welcomeBackEmail(params) {
  return {
    subject: `We saved your spot, ${params.name}`,
    textBody: `Hi ${params.name},

It's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.

Jump back in and earn 30 Insight Points just for returning.

\u2014 ChapterFlow

Manage email preferences: ${UNSUB_URL3}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Welcome Back, ${params.name}</h2><p>It's been ${params.daysSinceActive} days since your last reading session. Your progress is right where you left it.</p><p>Jump back in and earn <strong>30 Insight Points</strong> just for returning.</p><p><a href="https://chapterflow.siliconx.ca/book/home" style="color:#6366f1">Pick up where you left off</a></p><p style="color:#999;font-size:11px;margin-top:24px">\u2014 ChapterFlow \xB7 <a href="${UNSUB_URL3}" style="color:#999">Manage email preferences</a></p></div>`
  };
}

// lambda/lib/welcome-back-nudge.ts
async function processWelcomeBackNudge(ddb2, ses2, tableName2, senderEmail2, userItems) {
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
      new import_lib_dynamodb3.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "STREAK" } })
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
      new import_lib_dynamodb3.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: dedupKey } })
    );
    if (dedupResult.Item) {
      skipped++;
      continue;
    }
    const progressResult = await ddb2.send(
      new import_lib_dynamodb3.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "PROFILE" } })
    );
    const email = progressResult.Item?.email;
    const name = progressResult.Item?.displayName ?? "Reader";
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
      const ttl2 = Math.floor(Date.now() / 1e3) + 30 * 86400;
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
      const tpl = welcomeBackEmail({ name, daysSinceActive });
      await ses2.send(
        new import_client_sesv23.SendEmailCommand({
          FromEmailAddress: senderEmail2,
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: tpl.subject },
              Body: {
                Text: { Data: tpl.textBody },
                Html: { Data: tpl.htmlBody }
              }
            }
          }
        })
      );
      sent++;
    } catch (err) {
      console.error(`[welcome-back] Failed for ${userId}:`, err);
      skipped++;
    }
    const ttl = Math.floor(Date.now() / 1e3) + 30 * 86400;
    await ddb2.send(
      new import_lib_dynamodb3.PutCommand({
        TableName: tableName2,
        Item: { PK: item.PK, SK: dedupKey, entity: "NUDGE_DEDUP", createdAt: (/* @__PURE__ */ new Date()).toISOString(), ttl }
      })
    );
  }
  return { sent, skipped };
}

// lambda/lib/email-templates/reading-reminder.ts
var UNSUB_URL4 = "https://chapterflow.siliconx.ca/book/settings#notifications";
function readingReminderEmail(params) {
  return {
    subject: "Time to read!",
    textBody: `Hi ${params.name},

This is your daily reading reminder. A few minutes of focused reading can make a real difference.

\u2014 ChapterFlow

Manage email preferences: ${UNSUB_URL4}`,
    htmlBody: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Time to Read</h2><p>Hi ${params.name},</p><p>This is your daily reading reminder. A few minutes of focused reading can make a real difference.</p><p style="color:#999;font-size:11px;margin-top:24px">\u2014 ChapterFlow \xB7 <a href="${UNSUB_URL4}" style="color:#999">Manage email preferences</a></p></div>`
  };
}

// lambda/reading-reminder-cron.ts
var tableName = process.env.BOOK_TABLE_NAME;
var senderEmail = process.env.SES_SENDER_EMAIL;
var ddb = import_lib_dynamodb4.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
var ses = new import_client_sesv24.SESv2Client({});
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
async function handler() {
  console.log(`[reading-reminder-cron] Running at ${(/* @__PURE__ */ new Date()).toISOString()}`);
  let lastKey;
  let sent = 0;
  let skipped = 0;
  const allUserItems = [];
  do {
    const scan = await ddb.send(
      new import_lib_dynamodb4.ScanCommand({
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
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const dedupKey = `REMINDER_SENT#${today}`;
      const pk = item.PK;
      const dedupCheck = await ddb.send(
        new import_lib_dynamodb4.GetCommand({
          TableName: tableName,
          Key: { PK: pk, SK: dedupKey },
          ProjectionExpression: "PK"
        })
      );
      if (dedupCheck.Item) {
        skipped++;
        continue;
      }
      const profileRes = await ddb.send(
        new import_lib_dynamodb4.GetCommand({
          TableName: tableName,
          Key: { PK: pk, SK: "PROFILE" },
          ProjectionExpression: "displayName, email"
        })
      );
      const name = profileRes.Item?.displayName ?? "Reader";
      const email = profileRes.Item?.email;
      const notifId = crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await ddb.send(
        new import_lib_dynamodb4.UpdateCommand({
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
          const tpl = readingReminderEmail({ name });
          await ses.send(
            new import_client_sesv24.SendEmailCommand({
              FromEmailAddress: senderEmail,
              Destination: { ToAddresses: [email] },
              Content: {
                Simple: {
                  Subject: { Data: tpl.subject, Charset: "UTF-8" },
                  Body: {
                    Text: { Data: tpl.textBody, Charset: "UTF-8" },
                    Html: { Data: tpl.htmlBody, Charset: "UTF-8" }
                  }
                }
              }
            })
          );
        } catch (e) {
          console.error(`[reading-reminder-cron] email failed for ${userId.slice(0, 8)}:`, e);
        }
      }
      await ddb.send(
        new import_lib_dynamodb4.PutCommand({
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
      sent++;
    }
    lastKey = scan.LastEvaluatedKey;
  } while (lastKey);
  console.log(`[reading-reminder-cron] Reminders done. Sent: ${sent}, Skipped: ${skipped}`);
  const [streakResult, digestResult, welcomeResult] = await Promise.allSettled([
    processStreakAtRisk(ddb, ses, tableName, senderEmail, allUserItems),
    processWeeklyDigest(ddb, ses, tableName, senderEmail, allUserItems),
    processWelcomeBackNudge(ddb, ses, tableName, senderEmail, allUserItems)
  ]);
  console.log("[reading-reminder-cron] Nudge results:", {
    streakAtRisk: streakResult.status === "fulfilled" ? streakResult.value : "failed",
    weeklyDigest: digestResult.status === "fulfilled" ? digestResult.value : "failed",
    welcomeBack: welcomeResult.status === "fulfilled" ? welcomeResult.value : "failed"
  });
  return { sent, skipped };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
