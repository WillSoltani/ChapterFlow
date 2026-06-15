import { test } from "node:test";
import assert from "node:assert/strict";
import { readClientIp, coarseNetworkPrefix } from "./client-ip-core";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://example.com", { headers });
}

test("readClientIp trusts the rightmost X-Forwarded-For hop, not the client-supplied leftmost", () => {
  // Default RATE_LIMIT_TRUSTED_PROXY_HOPS = 1 → the edge-appended (last) entry.
  // A spoofed leftmost token must be ignored.
  assert.equal(
    readClientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" })),
    "203.0.113.7"
  );
  assert.equal(
    readClientIp(reqWith({ "x-forwarded-for": "evil, also-evil, 198.51.100.4" })),
    "198.51.100.4"
  );
});

test("readClientIp handles a single XFF entry", () => {
  assert.equal(readClientIp(reqWith({ "x-forwarded-for": "203.0.113.7" })), "203.0.113.7");
});

test("readClientIp falls back to x-real-ip, then cloudfront-viewer-address", () => {
  assert.equal(readClientIp(reqWith({ "x-real-ip": "203.0.113.9" })), "203.0.113.9");
  // cloudfront-viewer-address is "ip:port" — strip only the final :port.
  assert.equal(
    readClientIp(reqWith({ "cloudfront-viewer-address": "203.0.113.10:54321" })),
    "203.0.113.10"
  );
});

test("readClientIp preserves an IPv6 cloudfront-viewer-address (no colon truncation)", () => {
  assert.equal(
    readClientIp(reqWith({ "cloudfront-viewer-address": "2001:db8::1:443" })),
    "2001:db8::1"
  );
});

test("readClientIp returns null when no source header is present", () => {
  assert.equal(readClientIp(reqWith({})), null);
});

test("coarseNetworkPrefix coarsens IPv4 to /24", () => {
  assert.equal(coarseNetworkPrefix("203.0.113.7"), "203.0.113.0/24");
});

test("coarseNetworkPrefix expands compressed IPv6 to a stable /64 (regression: was null)", () => {
  assert.equal(coarseNetworkPrefix("2001:db8::1"), "2001:db8:0:0::/64");
  // A full address yields the same prefix string as its compressed form's expansion.
  assert.equal(coarseNetworkPrefix("2001:db8:0:0:0:0:0:1"), "2001:db8:0:0::/64");
});

test("coarseNetworkPrefix maps IPv4-mapped IPv6 to the embedded IPv4 /24", () => {
  assert.equal(coarseNetworkPrefix("::ffff:203.0.113.7"), "203.0.113.0/24");
});

test("coarseNetworkPrefix returns null for null and malformed input", () => {
  assert.equal(coarseNetworkPrefix(null), null);
  assert.equal(coarseNetworkPrefix("not-an-ip"), null);
  assert.equal(coarseNetworkPrefix("2001:db8::1::2"), null); // double "::"
  assert.equal(coarseNetworkPrefix("2001:db8:0:0:0:0:0:0:0"), null); // 9 groups
});
