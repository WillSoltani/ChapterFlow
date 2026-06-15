import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateReferralFraud,
  type ReferralFraudSignals,
} from "./referral-fraud-core";

const clean: ReferralFraudSignals = {
  inviteeEmail: "real@gmail.com",
  crossReferral: false,
  sameDevice: false,
  deviceVelocityCount: 0,
  sameIp: false,
  inviterVelocityCount: 0,
};

test("clean signals → allowed, not flagged", () => {
  assert.deepEqual(evaluateReferralFraud(clean), {
    allowed: true,
    flagForReview: false,
    reason: null,
  });
});

test("disposable email is a hard block (no review) and takes precedence", () => {
  // Even with every other signal also tripping, disposable email wins.
  const r = evaluateReferralFraud({
    ...clean,
    inviteeEmail: "x@mailinator.com",
    crossReferral: true,
    sameDevice: true,
    deviceVelocityCount: 99,
  });
  assert.deepEqual(r, { allowed: false, flagForReview: false, reason: "disposable_email" });
});

test("email domain match is case-insensitive", () => {
  assert.equal(evaluateReferralFraud({ ...clean, inviteeEmail: "x@MailInator.COM" }).reason, "disposable_email");
});

test("cross-referral blocks + flags", () => {
  assert.deepEqual(evaluateReferralFraud({ ...clean, crossReferral: true }), {
    allowed: false,
    flagForReview: true,
    reason: "cross_referral",
  });
});

test("same device blocks + flags", () => {
  assert.equal(evaluateReferralFraud({ ...clean, sameDevice: true }).reason, "device_fingerprint_match");
});

test("2nd account on the inviter's device is blocked BELOW the velocity threshold", () => {
  // M11 regression: a same-device self-referral must be caught at the SECOND
  // activation. At that point only the inviter has prior device events plus the
  // new invitee, so deviceVelocityCount is 1 (well under DEVICE_VELOCITY_THRESHOLD=3).
  // referral-fraud.ts now derives sameDevice=true from the inviter appearing in
  // the invitee's device-event history, so the reward is blocked here, not only
  // once a THIRD account trips deviceVelocity.
  const r = evaluateReferralFraud({ ...clean, sameDevice: true, deviceVelocityCount: 1 });
  assert.equal(r.allowed, false);
  assert.equal(r.flagForReview, true);
  assert.equal(r.reason, "device_fingerprint_match");
});

test("device velocity blocks at >= 3 but not at 2 (boundary)", () => {
  assert.equal(evaluateReferralFraud({ ...clean, deviceVelocityCount: 2 }).allowed, true);
  const r = evaluateReferralFraud({ ...clean, deviceVelocityCount: 3 });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "device_velocity");
});

test("same IP is allowed but flagged for review", () => {
  assert.deepEqual(evaluateReferralFraud({ ...clean, sameIp: true }), {
    allowed: true,
    flagForReview: true,
    reason: "network_match_flagged",
  });
});

test("inviter velocity flags (not blocks) at > 5 but not at 5 (boundary)", () => {
  assert.equal(evaluateReferralFraud({ ...clean, inviterVelocityCount: 5 }).flagForReview, false);
  const r = evaluateReferralFraud({ ...clean, inviterVelocityCount: 6 });
  assert.equal(r.allowed, true);
  assert.equal(r.flagForReview, true);
  assert.equal(r.reason, "inviter_velocity");
});

test("a blocking signal outranks a flag-only signal (device velocity over same IP)", () => {
  const r = evaluateReferralFraud({ ...clean, deviceVelocityCount: 5, sameIp: true });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "device_velocity");
});
