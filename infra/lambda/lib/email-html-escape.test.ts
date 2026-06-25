import { test } from "node:test";
import assert from "node:assert/strict";

import { readingReminderEmail } from "./email-templates/reading-reminder";
import { welcomeBackEmail } from "./email-templates/welcome-back";
import { streakAtRiskEmail } from "./email-templates/streak-at-risk";
import { weeklyDigestEmail } from "./email-templates/weekly-digest";
import { commitmentFollowupEmail } from "./email-templates/commitment-followup";

// Regression for the self-targeted HTML-injection defect: every email template
// interpolated the user-controlled displayName (and, for commitment-followup,
// the user-authored if-then plan) straight into htmlBody. A name containing
// markup rendered raw in the email. These tests pin that user fields are now
// HTML-escaped in the html body (the text body is plain and intentionally not
// escaped).

const XSS_NAME = `<img src=x onerror="alert(1)">`;
const ESCAPED_NAME = "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;";

// The injectable structure (the raw tag opener) must never survive into the
// html body. The attribute-name substring "onerror=" is harmless once its
// surrounding "<img ...>" is escaped to "&lt;img ...&gt;", so we assert on the
// tag opener, which is the actual injection vector.
function assertNoRawMarkup(htmlBody: string) {
  assert.ok(
    !htmlBody.includes("<img"),
    `htmlBody must not contain the raw <img tag; got: ${htmlBody}`,
  );
  assert.ok(
    !/<img[^>]*onerror=/i.test(htmlBody),
    `htmlBody must not contain a live <img onerror=...> handler; got: ${htmlBody}`,
  );
}

test("readingReminderEmail escapes displayName in htmlBody", () => {
  const { htmlBody, textBody } = readingReminderEmail({
    name: XSS_NAME,
    appBaseUrl: "https://app.example.com",
  });
  assertNoRawMarkup(htmlBody);
  assert.ok(htmlBody.includes(ESCAPED_NAME));
  // Text body is plain text and stays raw.
  assert.ok(textBody.includes(XSS_NAME));
});

test("welcomeBackEmail escapes displayName in htmlBody", () => {
  const { htmlBody } = welcomeBackEmail({
    name: XSS_NAME,
    daysSinceActive: 5,
    appBaseUrl: "https://app.example.com",
  });
  assertNoRawMarkup(htmlBody);
  assert.ok(htmlBody.includes(`Welcome Back, ${ESCAPED_NAME}`));
});

test("streakAtRiskEmail escapes displayName in htmlBody", () => {
  const { htmlBody } = streakAtRiskEmail({
    name: XSS_NAME,
    currentStreak: 7,
    hoursRemaining: 4,
    appBaseUrl: "https://app.example.com",
  });
  assertNoRawMarkup(htmlBody);
  assert.ok(htmlBody.includes(ESCAPED_NAME));
});

test("weeklyDigestEmail escapes displayName in htmlBody", () => {
  const { htmlBody } = weeklyDigestEmail({
    name: XSS_NAME,
    chaptersCompleted: 3,
    currentStreak: 2,
    ipBalance: 120,
    appBaseUrl: "https://app.example.com",
  });
  assertNoRawMarkup(htmlBody);
  assert.ok(htmlBody.includes(ESCAPED_NAME));
});

test("commitmentFollowupEmail escapes displayName AND the if-then plan in htmlBody", () => {
  const { htmlBody } = commitmentFollowupEmail({
    name: XSS_NAME,
    ifThenPlan: `<script>alert('plan')</script>`,
    appBaseUrl: "https://app.example.com",
    commitmentId: "c-1",
  });
  assertNoRawMarkup(htmlBody);
  assert.ok(
    !htmlBody.includes("<script>"),
    `htmlBody must not contain a raw <script> tag from the if-then plan; got: ${htmlBody}`,
  );
  assert.ok(htmlBody.includes(`How did it go, ${ESCAPED_NAME}?`));
  assert.ok(htmlBody.includes("&lt;script&gt;"));
});

test("benign displayName renders unchanged (no over-escaping of plain text)", () => {
  const { htmlBody } = readingReminderEmail({
    name: "Ada Lovelace",
    appBaseUrl: "https://app.example.com",
  });
  assert.ok(htmlBody.includes("Hi Ada Lovelace,"));
});
