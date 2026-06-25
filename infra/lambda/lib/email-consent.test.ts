import { test } from "node:test";
import assert from "node:assert/strict";
import { emailChannelConsented } from "./email-consent";

// Opt-IN consent model: commercial email is sent ONLY when channels.email is
// explicitly `true`. Every other state (missing notifications, missing channels,
// missing key, explicit false) means no consent. This pins the shared gate used
// by all infra/lambda email senders so the opt-OUT regression (undefined treated
// as consent) can't come back.
test("emailChannelConsented: undefined notifications → no consent", () => {
  assert.equal(emailChannelConsented(undefined), false);
});

test("emailChannelConsented: no channels object → no consent", () => {
  assert.equal(emailChannelConsented({}), false);
});

test("emailChannelConsented: channels without email key → no consent", () => {
  assert.equal(emailChannelConsented({ channels: {} }), false);
});

test("emailChannelConsented: channels.email === false → no consent", () => {
  assert.equal(emailChannelConsented({ channels: { email: false } }), false);
});

test("emailChannelConsented: channels.email === true → consent", () => {
  assert.equal(emailChannelConsented({ channels: { email: true } }), true);
});
