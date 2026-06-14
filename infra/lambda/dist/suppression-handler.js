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

// lambda/suppression-handler.ts
var suppression_handler_exports = {};
__export(suppression_handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(suppression_handler_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var tableName = process.env.BOOK_TABLE_NAME;
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
function asRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}
function recipientEmails(recipients) {
  if (!Array.isArray(recipients)) return [];
  return recipients.map((r) => asRecord(r)?.emailAddress).filter((e) => typeof e === "string" && e.length > 0);
}
function parseSesSuppressionEvent(raw) {
  let msg = raw;
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
    const subtype = typeof bounce.bounceSubType === "string" ? bounce.bounceSubType : void 0;
    return recipientEmails(bounce.bouncedRecipients).map((email) => ({
      email,
      reason: "bounce",
      subtype
    }));
  }
  if (type === "Complaint") {
    const complaint = asRecord(root.complaint);
    if (!complaint) return [];
    const subtype = typeof complaint.complaintFeedbackType === "string" ? complaint.complaintFeedbackType : void 0;
    return recipientEmails(complaint.complainedRecipients).map((email) => ({
      email,
      reason: "complaint",
      subtype
    }));
  }
  return [];
}
async function handler(event) {
  let suppressed = 0;
  for (const record of event.Records ?? []) {
    const message = record.Sns?.Message;
    if (!message) continue;
    for (const entry of parseSesSuppressionEvent(message)) {
      const email = entry.email.trim().toLowerCase();
      try {
        await ddb.send(
          new import_lib_dynamodb.PutCommand({
            TableName: tableName,
            Item: {
              PK: `BOOKSUPPRESS#${email}`,
              SK: "SUPPRESSION",
              entity: "BOOK_EMAIL_SUPPRESSION",
              email,
              reason: entry.reason,
              subtype: entry.subtype,
              source: "ses",
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          })
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
