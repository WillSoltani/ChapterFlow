import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedPushEndpoint } from "./push-endpoint-allowlist";

test("accepts real push-service endpoints (exact host and subdomains)", () => {
  for (const url of [
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://fcm.googleapis.com/wp/abc",
    "https://web.push.apple.com/QABC",
    "https://updates.push.services.mozilla.com/wpush/v2/xyz",
    "https://autopush-1.push.services.mozilla.com/wpush/v2/xyz",
    "https://abc.notify.windows.com/w/?token=xyz",
    "https://push.apple.com/abc",
  ]) {
    assert.equal(isAllowedPushEndpoint(url), true, `should allow ${url}`);
  }
});

test("rejects non-HTTPS schemes (incl. SSRF-y ones)", () => {
  for (const url of [
    "http://fcm.googleapis.com/fcm/send/abc", // http downgrade
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "file:///etc/passwd",
    "gopher://internal/",
    "https://169.254.169.254/", // metadata over https, not a push host
    "https://localhost/", // internal
    "https://10.0.0.5/internal",
  ]) {
    assert.equal(isAllowedPushEndpoint(url), false, `should reject ${url}`);
  }
});

test("rejects look-alike / suffix-spoofing hosts", () => {
  for (const url of [
    "https://evil.com/",
    "https://fcm.googleapis.com.evil.com/", // suffix is .evil.com
    "https://evil-fcm.googleapis.com/", // no dot boundary
    "https://notfcm.googleapis.com.attacker.net/",
    "https://attacker.com/?x=fcm.googleapis.com",
  ]) {
    assert.equal(isAllowedPushEndpoint(url), false, `should reject ${url}`);
  }
});

test("rejects malformed input", () => {
  assert.equal(isAllowedPushEndpoint(""), false);
  assert.equal(isAllowedPushEndpoint("not a url"), false);
  assert.equal(isAllowedPushEndpoint("//fcm.googleapis.com/x"), false);
});
