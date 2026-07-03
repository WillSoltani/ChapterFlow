import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDeviceRegistration,
  parseDeviceUnregistration,
  isValidApnsToken,
  normalizeApnsToken,
} from "./device-register-core";

const HEX64 = "a".repeat(64);

test("web registration (explicit platform) parses endpoint + keys", () => {
  const r = parseDeviceRegistration({
    platform: "web",
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: { p256dh: "pub", auth: "auth" },
  });
  assert.equal(r.ok, true);
  assert.ok(r.ok && r.platform === "web");
  assert.ok(r.ok && r.identifier === "https://fcm.googleapis.com/fcm/send/abc");
});

test("web registration with NO platform field still works (back-compat)", () => {
  const r = parseDeviceRegistration({
    endpoint: "https://updates.push.services.mozilla.com/wpush/v2/xyz",
    keys: { p256dh: "pub", auth: "auth" },
  });
  assert.ok(r.ok && r.platform === "web");
});

test("web registration without keys is a SOFT rejection (not a 400)", () => {
  const r = parseDeviceRegistration({ endpoint: "https://x/y", keys: { p256dh: "pub" } });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && "soft" in r && r.soft === true && r.reason === "missing_keys");
});

test("web registration without an endpoint is rejected", () => {
  const r = parseDeviceRegistration({ platform: "web", keys: { p256dh: "p", auth: "a" } });
  assert.ok(!r.ok && r.reason === "missing_endpoint");
});

test("ios registration parses + normalizes the apns token as the identifier", () => {
  const r = parseDeviceRegistration({ platform: "ios", apnsToken: HEX64.toUpperCase() });
  assert.ok(r.ok && r.platform === "ios");
  assert.ok(r.ok && r.apnsToken === HEX64); // lowercased
  assert.ok(r.ok && r.identifier === HEX64);
});

test("ios registration accepts the <....> description format and cleans it", () => {
  const wrapped = `<${HEX64.slice(0, 32)} ${HEX64.slice(32)}>`;
  const r = parseDeviceRegistration({ platform: "ios", apnsToken: wrapped });
  assert.ok(r.ok && r.platform === "ios" && r.apnsToken === HEX64);
});

test("ios registration rejects a non-hex / too-short token", () => {
  assert.ok(!parseDeviceRegistration({ platform: "ios", apnsToken: "not-hex!!!" }).ok);
  assert.ok(!parseDeviceRegistration({ platform: "ios", apnsToken: "abcd" }).ok);
  const bad = parseDeviceRegistration({ platform: "ios", apnsToken: "zz".repeat(40) });
  assert.ok(!bad.ok && bad.reason === "invalid_apns_token");
});

test("an unknown platform is rejected", () => {
  const r = parseDeviceRegistration({ platform: "android", apnsToken: HEX64 });
  assert.ok(!r.ok && r.reason === "invalid_platform");
});

test("isValidApnsToken accepts 64–200 hex, rejects odd/short/garbage", () => {
  assert.ok(isValidApnsToken(HEX64));
  assert.ok(isValidApnsToken("f".repeat(160)));
  assert.ok(!isValidApnsToken("f".repeat(63)));
  assert.ok(!isValidApnsToken("f".repeat(201)));
  assert.ok(!isValidApnsToken(123));
  assert.ok(!isValidApnsToken(undefined));
});

test("normalizeApnsToken strips brackets/space and lowercases", () => {
  assert.equal(normalizeApnsToken("<AB CD>"), "abcd");
});

test("unregister by web endpoint", () => {
  const r = parseDeviceUnregistration({ endpoint: "https://x/y" });
  assert.deepEqual(r, { identifier: "https://x/y" });
});

test("unregister by ios apns token normalizes to match the register SK", () => {
  const r = parseDeviceUnregistration({ platform: "ios", apnsToken: HEX64.toUpperCase() });
  assert.deepEqual(r, { identifier: HEX64 });
});

test("unregister with neither identifier returns null", () => {
  assert.equal(parseDeviceUnregistration({}), null);
});
