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
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
    const tz = streak.lastActiveTimezone || "UTC";
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
    if (notifications?.channels?.email !== false) {
      try {
        const profileResult = await ddb2.send(
          new import_lib_dynamodb.GetCommand({ TableName: tableName2, Key: { PK: item.PK, SK: "PROFILE" } })
        );
        const email = profileResult.Item?.email;
        if (email) {
          await ses2.send(
            new import_client_sesv2.SendEmailCommand({
              FromEmailAddress: senderEmail2,
              Destination: { ToAddresses: [email] },
              Content: {
                Simple: {
                  Subject: { Data: `Your ${streak.currentStreak}-day streak ends in ${hoursRemaining} hours` },
                  Body: {
                    Text: {
                      Data: `Your ${streak.currentStreak}-day reading streak ends tonight. Open ChapterFlow and complete one chapter to keep it alive.`
                    },
                    Html: {
                      Data: `<p>Your <strong>${streak.currentStreak}-day</strong> reading streak ends in <strong>${hoursRemaining} hours</strong>.</p><p>Open ChapterFlow and complete one chapter to keep it alive.</p>`
                    }
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
    if (notifications?.weeklyDigestEnabled === false || notifications?.channels?.email === false) {
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
    if (!email) {
      skipped++;
      continue;
    }
    try {
      await ses2.send(
        new import_client_sesv22.SendEmailCommand({
          FromEmailAddress: senderEmail2,
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: `Your ChapterFlow Week: ${chaptersCompleted} chapters completed` },
              Body: {
                Html: {
                  Data: `
<h2>Hey ${name}, here's your week in review</h2>
<ul>
  <li><strong>${chaptersCompleted}</strong> chapters completed</li>
  <li><strong>${currentStreak}</strong> day streak</li>
  <li><strong>${ipBalance}</strong> Insight Points balance</li>
</ul>
<p>${chaptersCompleted > 0 ? "Great progress this week! Keep the momentum going." : "Take 15 minutes today to get back on track."}</p>
<p><a href="https://chapterflow.siliconx.ca/dashboard">Open ChapterFlow</a></p>
                  `.trim()
                },
                Text: {
                  Data: `Your ChapterFlow week: ${chaptersCompleted} chapters, ${currentStreak}-day streak, ${ipBalance} IP. ${chaptersCompleted > 0 ? "Keep it up!" : "Jump back in today."}`
                }
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
async function processWelcomeBackNudge(ddb2, ses2, tableName2, senderEmail2, userItems) {
  let sent = 0;
  let skipped = 0;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  for (const item of userItems) {
    const notifications = item.settings?.notifications;
    if (notifications?.welcomeBackEnabled === false || notifications?.channels?.email === false) {
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
    const dedupKey = `NUDGE_SENT#welcome_back#${today}`;
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
    if (!email) {
      skipped++;
      continue;
    }
    try {
      await ses2.send(
        new import_client_sesv23.SendEmailCommand({
          FromEmailAddress: senderEmail2,
          Destination: { ToAddresses: [email] },
          Content: {
            Simple: {
              Subject: { Data: `We saved your spot, ${name}` },
              Body: {
                Html: {
                  Data: `
<h2>Welcome back, ${name}!</h2>
<p>It's been ${daysSinceActive} days since your last reading session. Your progress is right where you left it.</p>
<p>Jump back in and earn <strong>30 Insight Points</strong> just for returning.</p>
<p><a href="https://chapterflow.siliconx.ca/dashboard">Pick up where you left off</a></p>
                  `.trim()
                },
                Text: {
                  Data: `Hey ${name}, it's been ${daysSinceActive} days. Your ChapterFlow progress is waiting. Return now and earn 30 IP.`
                }
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
          await ses.send(
            new import_client_sesv24.SendEmailCommand({
              FromEmailAddress: senderEmail,
              Destination: { ToAddresses: [email] },
              Content: {
                Simple: {
                  Subject: { Data: "Time to read!", Charset: "UTF-8" },
                  Body: {
                    Text: {
                      Data: `Hi ${name},

This is your daily reading reminder. A few minutes of focused reading can make a real difference.

\u2014 ChapterFlow`,
                      Charset: "UTF-8"
                    },
                    Html: {
                      Data: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#6366f1">Time to Read</h2><p>Hi ${name},</p><p>This is your daily reading reminder.</p><p style="color:#888;font-size:12px">\u2014 ChapterFlow</p></div>`,
                      Charset: "UTF-8"
                    }
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
        new import_lib_dynamodb4.UpdateCommand({
          TableName: tableName,
          Key: { PK: pk, SK: dedupKey },
          UpdateExpression: "SET createdAt = :now, #ttl = :ttl",
          ExpressionAttributeNames: { "#ttl": "ttl" },
          ExpressionAttributeValues: {
            ":now": now,
            ":ttl": Math.floor(Date.now() / 1e3) + 2 * 24 * 60 * 60
          }
        })
      );
      sent++;
    }
    lastKey = scan.LastEvaluatedKey;
  } while (lastKey);
  console.log(`[reading-reminder-cron] Reminders done. Sent: ${sent}, Skipped: ${skipped}`);
  const allUserItems = [];
  let nudgeLastKey;
  do {
    const scan = await ddb.send(
      new import_lib_dynamodb4.ScanCommand({
        TableName: tableName,
        FilterExpression: "entity = :entity",
        ExpressionAttributeValues: { ":entity": "BOOK_USER_SETTINGS" },
        ProjectionExpression: "PK, userId, settings",
        ExclusiveStartKey: nudgeLastKey
      })
    );
    for (const item of scan.Items ?? []) {
      allUserItems.push(item);
    }
    nudgeLastKey = scan.LastEvaluatedKey;
  } while (nudgeLastKey);
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
