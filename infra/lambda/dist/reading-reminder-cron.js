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
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_client_sesv2 = require("@aws-sdk/client-sesv2");
var tableName = process.env.BOOK_TABLE_NAME;
var senderEmail = process.env.SES_SENDER_EMAIL;
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
var ses = new import_client_sesv2.SESv2Client({});
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
      new import_lib_dynamodb.ScanCommand({
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
        new import_lib_dynamodb.GetCommand({
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
        new import_lib_dynamodb.GetCommand({
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
        new import_lib_dynamodb.UpdateCommand({
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
            new import_client_sesv2.SendEmailCommand({
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
        new import_lib_dynamodb.UpdateCommand({
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
  console.log(`[reading-reminder-cron] Done. Sent: ${sent}, Skipped: ${skipped}`);
  return { sent, skipped };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
