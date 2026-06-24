import { test } from "node:test";
import assert from "node:assert/strict";

import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
  unsubscribeHeaders,
  emailFooter,
  isEmailCategoryEnabled,
  TOKEN_TTL_SECONDS,
  type EmailCategory,
  type EmailComplianceConfig,
} from "./email-compliance-core";

const SECRET = "unit-test-secret";

test("sign → verify round-trips userId and category", () => {
  const token = signUnsubscribeToken("user-abc", "reading_reminder", SECRET, 1_000_000);
  const claim = verifyUnsubscribeToken(token, SECRET, 1_000_000);
  assert.deepEqual(claim, { userId: "user-abc", category: "reading_reminder" });
});

test("golden vector — token format must match the infra/lambda copy", () => {
  // If this value changes, the Lambda's signUnsubscribeToken (a byte-identical
  // copy) must change too, or cron-minted unsubscribe links will stop verifying.
  const token = signUnsubscribeToken("user-abc", "weekly_digest", SECRET, 1_000_000);
  assert.equal(
    token,
    "dXNlci1hYmN8d2Vla2x5X2RpZ2VzdHwzNTU2MDAwMA.s06CEKXx64Zts8s2u-b2LZeq6RUwaYuXKLR2gibFdYo",
  );
});

test("rejects a tampered signature", () => {
  const token = signUnsubscribeToken("user-abc", "all", SECRET, 1_000_000);
  const [body] = token.split(".");
  const forged = `${body}.${"A".repeat(43)}`;
  assert.equal(verifyUnsubscribeToken(forged, SECRET, 1_000_000), null);
});

test("rejects a tampered payload (re-encoded category)", () => {
  const token = signUnsubscribeToken("user-abc", "reading_reminder", SECRET, 1_000_000);
  const sig = token.split(".")[1];
  const swappedBody = Buffer.from("user-abc|all|35560000", "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  assert.equal(verifyUnsubscribeToken(`${swappedBody}.${sig}`, SECRET, 1_000_000), null);
});

test("rejects a token signed with a different secret", () => {
  const token = signUnsubscribeToken("user-abc", "streak", SECRET, 1_000_000);
  assert.equal(verifyUnsubscribeToken(token, "other-secret", 1_000_000), null);
});

test("rejects an expired token", () => {
  const issuedAt = 1_000_000;
  const token = signUnsubscribeToken("user-abc", "streak", SECRET, issuedAt);
  const afterExpiry = issuedAt + TOKEN_TTL_SECONDS + 1;
  assert.equal(verifyUnsubscribeToken(token, SECRET, afterExpiry), null);
  // still valid one second before expiry
  assert.ok(verifyUnsubscribeToken(token, SECRET, issuedAt + TOKEN_TTL_SECONDS - 1));
});

test("rejects empty/missing secret or token", () => {
  assert.equal(verifyUnsubscribeToken("", SECRET, 1_000_000), null);
  const token = signUnsubscribeToken("u", "all", SECRET, 1_000_000);
  assert.equal(verifyUnsubscribeToken(token, "", 1_000_000), null);
});

test("List-Unsubscribe headers include the URL and a one-click POST", () => {
  const url = buildUnsubscribeUrl("https://app.example.com", "tok123");
  const headers = unsubscribeHeaders(url, "mailto:support@chapterflow.ca?subject=unsubscribe");
  assert.equal(headers[0].Name, "List-Unsubscribe");
  assert.ok(headers[0].Value.includes(url));
  assert.ok(headers[0].Value.includes("mailto:support@chapterflow.ca"));
  assert.deepEqual(headers[1], {
    Name: "List-Unsubscribe-Post",
    Value: "List-Unsubscribe=One-Click",
  });
});

test("buildUnsubscribeUrl trims a trailing slash and url-encodes the token", () => {
  assert.equal(
    buildUnsubscribeUrl("https://app.example.com/", "a/b+c"),
    "https://app.example.com/app/api/book/email/unsubscribe?token=a%2Fb%2Bc",
  );
});

test("emailFooter includes sender, postal address, reason and unsubscribe", () => {
  const config: EmailComplianceConfig = {
    senderEmail: "info@chapterflow.ca",
    senderName: "ChapterFlow",
    supportAddress: "support@chapterflow.ca",
    postalAddress: "123 Example St, Toronto, ON",
    appBaseUrl: "https://app.example.com",
    secret: SECRET,
    configurationSet: "",
  };
  const footer = emailFooter({
    config,
    unsubscribeUrl: "https://app.example.com/unsub?token=x",
    reasonLine: "You enabled reminders.",
  });
  for (const part of [footer.text, footer.html]) {
    assert.ok(part.includes("ChapterFlow"));
    assert.ok(part.includes("123 Example St, Toronto, ON"));
    assert.ok(part.includes("You enabled reminders."));
    assert.ok(part.includes("https://app.example.com/unsub?token=x"));
  }
});

test("emailFooter omits the address line when no postal address is set", () => {
  const config: EmailComplianceConfig = {
    senderEmail: "info@chapterflow.ca",
    senderName: "ChapterFlow",
    supportAddress: "support@chapterflow.ca",
    postalAddress: "",
    appBaseUrl: "https://app.example.com",
    secret: SECRET,
    configurationSet: "",
  };
  const footer = emailFooter({
    config,
    unsubscribeUrl: "https://app.example.com/unsub?token=x",
    reasonLine: "You enabled reminders.",
  });
  assert.ok(!footer.html.includes("<br/></strong>"));
  assert.ok(footer.text.includes("ChapterFlow\n\nYou enabled reminders."));
});

// isEmailCategoryEnabled is the gate that makes a one-click category unsubscribe
// actually stop emails. It MUST be the inverse of `applyUnsubscribe` in
// app/app/api/book/email/unsubscribe/route.ts. If the two maps drift, the
// unsubscribe link silently stops working — a CASL/CAN-SPAM violation.

const ALL_CATEGORIES: readonly EmailCategory[] = [
  "reading_reminder",
  "streak",
  "weekly_digest",
  "welcome_back",
  "celebration",
  "all",
];

test("isEmailCategoryEnabled defaults every category to enabled when no flag is set", () => {
  for (const category of ALL_CATEGORIES) {
    assert.equal(isEmailCategoryEnabled({}, category), true, category);
  }
});

test("isEmailCategoryEnabled honors a one-click category unsubscribe (mirrors applyUnsubscribe)", () => {
  // Each row is the exact flag state `applyUnsubscribe` writes for that category;
  // the email gate must then report the category disabled.
  assert.equal(
    isEmailCategoryEnabled({ readingReminderEnabled: false }, "reading_reminder"),
    false,
  );
  assert.equal(isEmailCategoryEnabled({ streakReminderEnabled: false }, "streak"), false);
  assert.equal(
    isEmailCategoryEnabled({ weeklyDigestEnabled: false }, "weekly_digest"),
    false,
  );
  assert.equal(
    isEmailCategoryEnabled({ welcomeBackEnabled: false }, "welcome_back"),
    false,
  );
  // "celebration" unsubscribe sets BOTH flags false.
  assert.equal(
    isEmailCategoryEnabled(
      { badgeCelebrationEnabled: false, achievementAlertsEnabled: false },
      "celebration",
    ),
    false,
  );
});

test("isEmailCategoryEnabled suppresses celebration when EITHER flag is false", () => {
  assert.equal(
    isEmailCategoryEnabled({ badgeCelebrationEnabled: false }, "celebration"),
    false,
  );
  assert.equal(
    isEmailCategoryEnabled({ achievementAlertsEnabled: false }, "celebration"),
    false,
  );
  assert.equal(
    isEmailCategoryEnabled(
      { badgeCelebrationEnabled: true, achievementAlertsEnabled: true },
      "celebration",
    ),
    true,
  );
});

test("isEmailCategoryEnabled does not cross-suppress unrelated categories", () => {
  // Opting out of streak must not silence celebration emails, and vice-versa.
  assert.equal(isEmailCategoryEnabled({ streakReminderEnabled: false }, "celebration"), true);
  assert.equal(isEmailCategoryEnabled({ badgeCelebrationEnabled: false }, "streak"), true);
});
