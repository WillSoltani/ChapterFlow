import { test } from "node:test";
import assert from "node:assert/strict";

import { parseSesSuppressionEvent } from "./ses-suppression-events";

test("permanent bounce → suppress each bounced recipient", () => {
  const event = {
    eventType: "Bounce",
    bounce: {
      bounceType: "Permanent",
      bounceSubType: "General",
      bouncedRecipients: [{ emailAddress: "dead@example.com" }, { emailAddress: "gone@example.com" }],
    },
  };
  assert.deepEqual(parseSesSuppressionEvent(event), [
    { email: "dead@example.com", reason: "bounce", subtype: "General" },
    { email: "gone@example.com", reason: "bounce", subtype: "General" },
  ]);
});

test("transient (soft) bounce → not suppressed", () => {
  const event = {
    eventType: "Bounce",
    bounce: {
      bounceType: "Transient",
      bouncedRecipients: [{ emailAddress: "mailboxfull@example.com" }],
    },
  };
  assert.deepEqual(parseSesSuppressionEvent(event), []);
});

test("complaint → suppress each complained recipient", () => {
  const event = {
    eventType: "Complaint",
    complaint: {
      complaintFeedbackType: "abuse",
      complainedRecipients: [{ emailAddress: "angry@example.com" }],
    },
  };
  assert.deepEqual(parseSesSuppressionEvent(event), [
    { email: "angry@example.com", reason: "complaint", subtype: "abuse" },
  ]);
});

test("accepts a raw JSON string payload (SNS Message)", () => {
  const raw = JSON.stringify({
    eventType: "Complaint",
    complaint: { complainedRecipients: [{ emailAddress: "x@example.com" }] },
  });
  assert.deepEqual(parseSesSuppressionEvent(raw), [
    { email: "x@example.com", reason: "complaint", subtype: undefined },
  ]);
});

test("handles legacy notificationType shape", () => {
  const event = {
    notificationType: "Bounce",
    bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "legacy@example.com" }] },
  };
  assert.deepEqual(parseSesSuppressionEvent(event), [
    { email: "legacy@example.com", reason: "bounce", subtype: undefined },
  ]);
});

test("ignores delivery/other events and malformed input", () => {
  assert.deepEqual(parseSesSuppressionEvent({ eventType: "Delivery" }), []);
  assert.deepEqual(parseSesSuppressionEvent("not json"), []);
  assert.deepEqual(parseSesSuppressionEvent(null), []);
  assert.deepEqual(parseSesSuppressionEvent({ eventType: "Bounce" }), []);
  assert.deepEqual(
    parseSesSuppressionEvent({ eventType: "Complaint", complaint: { complainedRecipients: [{}] } }),
    [],
  );
});
