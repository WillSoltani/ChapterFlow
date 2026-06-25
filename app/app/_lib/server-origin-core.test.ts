import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePublicOriginCore,
  trustedHostsFromEnv,
  type ResolveOriginEnv,
} from "./server-origin-core";

function env(overrides: Partial<ResolveOriginEnv> = {}): ResolveOriginEnv {
  return {
    nodeEnv: "production",
    trustedHosts: new Set<string>(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Configured base URL always wins (and loopback is dropped in prod).
// ---------------------------------------------------------------------------

test("prod: configured CHAPTERFLOW_APP_BASE_URL wins over the request host", () => {
  const origin = resolvePublicOriginCore(
    { hostHeader: "evil.example.com", forwardedHostHeader: "evil.example.com" },
    env({ chapterFlowAppBaseUrl: "https://app.chapterflow.ca/" })
  );
  assert.equal(origin, "https://app.chapterflow.ca");
});

test("prod: a loopback configured base URL is ignored, then falls through", () => {
  // No request host, no fallback → prod throws rather than returning localhost.
  assert.throws(
    () =>
      resolvePublicOriginCore(
        {},
        env({ appBaseUrl: "http://localhost:3000" })
      ),
    /Unable to resolve public origin/
  );
});

// ---------------------------------------------------------------------------
// F13: when NO base URL is configured, an attacker-controllable host header
// must NOT be echoed into the resolved origin unless it is a trusted host.
// ---------------------------------------------------------------------------

test("F13 prod: an untrusted forwarded host is NOT trusted (falls back to caller origin)", () => {
  const origin = resolvePublicOriginCore(
    {
      hostHeader: "app.chapterflow.ca",
      forwardedHostHeader: "attacker.evil.com",
      forwardedProtoHeader: "https",
      fallbackOrigin: "https://app.chapterflow.ca",
    },
    env({ trustedHosts: new Set(["app.chapterflow.ca"]) })
  );
  // The spoofed x-forwarded-host must be ignored; we fall back to the explicit
  // caller-provided origin instead of `https://attacker.evil.com`.
  assert.equal(origin, "https://app.chapterflow.ca");
});

test("F13 prod: an untrusted Host header with NO fallback throws rather than echoing it", () => {
  assert.throws(
    () =>
      resolvePublicOriginCore(
        { hostHeader: "attacker.evil.com", forwardedProtoHeader: "https" },
        env({ trustedHosts: new Set(["app.chapterflow.ca"]) })
      ),
    /Unable to resolve public origin/
  );
});

test("F13 prod: a TRUSTED forwarded host IS honoured", () => {
  const origin = resolvePublicOriginCore(
    {
      forwardedHostHeader: "app.chapterflow.ca",
      forwardedProtoHeader: "https",
    },
    env({ trustedHosts: new Set(["app.chapterflow.ca"]) })
  );
  assert.equal(origin, "https://app.chapterflow.ca");
});

test("F13 prod: a trusted host wins even when a malicious host is also present", () => {
  // forwarded-host takes precedence over Host; if forwarded is trusted, honour it.
  const origin = resolvePublicOriginCore(
    {
      hostHeader: "attacker.evil.com",
      forwardedHostHeader: "app.chapterflow.ca",
      forwardedProtoHeader: "https",
    },
    env({ trustedHosts: new Set(["app.chapterflow.ca"]) })
  );
  assert.equal(origin, "https://app.chapterflow.ca");
});

test("F13 prod: untrusted forwarded host falls through to a trusted Host? No — forwarded wins, so it's rejected", () => {
  // forwarded-host is consulted first; when it is untrusted we reject the whole
  // derivation (we do NOT silently downgrade to the Host header, which is also
  // client-controlled). With a fallback we land there.
  const origin = resolvePublicOriginCore(
    {
      hostHeader: "app.chapterflow.ca",
      forwardedHostHeader: "attacker.evil.com",
      forwardedProtoHeader: "https",
      fallbackOrigin: "https://app.chapterflow.ca",
    },
    env({ trustedHosts: new Set(["app.chapterflow.ca"]) })
  );
  assert.equal(origin, "https://app.chapterflow.ca");
});

// ---------------------------------------------------------------------------
// Dev / loopback behaviour preserved.
// ---------------------------------------------------------------------------

test("dev: with no trusted hosts configured, the request host is still honoured", () => {
  const origin = resolvePublicOriginCore(
    { hostHeader: "localhost:3001" },
    env({ nodeEnv: "development", trustedHosts: new Set() })
  );
  assert.equal(origin, "http://localhost:3001");
});

test("dev: defaults to http://localhost:3000 when nothing resolves", () => {
  const origin = resolvePublicOriginCore({}, env({ nodeEnv: "development", trustedHosts: new Set() }));
  assert.equal(origin, "http://localhost:3000");
});

test("F13 prod: a trusted host with an explicit default port still matches", () => {
  // Host: app.chapterflow.ca:443 must match a configured https://app.chapterflow.ca.
  const origin = resolvePublicOriginCore(
    { forwardedHostHeader: "app.chapterflow.ca:443", forwardedProtoHeader: "https" },
    env({ trustedHosts: new Set(["app.chapterflow.ca"]) })
  );
  assert.equal(origin, "https://app.chapterflow.ca:443");
});

test("any env: a loopback request host is always trusted (local dev / health checks)", () => {
  const origin = resolvePublicOriginCore(
    { hostHeader: "127.0.0.1:3000", forwardedProtoHeader: "http" },
    env({ nodeEnv: "production", trustedHosts: new Set(["app.chapterflow.ca"]) })
  );
  assert.equal(origin, "http://127.0.0.1:3000");
});

// ---------------------------------------------------------------------------
// trustedHostsFromEnv derives the allowlist from the same env vars returnTo uses.
// ---------------------------------------------------------------------------

test("trustedHostsFromEnv: collects hosts from all configured origin vars", () => {
  const hosts = trustedHostsFromEnv({
    APP_BASE_URL: "https://app.chapterflow.ca",
    NEXT_PUBLIC_SITE_URL: "https://chapterflow.ca",
    // Non-default port is preserved in URL.host; default ports (e.g. :443 on
    // https) are normalized away by the URL parser — match that.
    CHAPTERFLOW_AUTH_BASE_URL: "https://auth.chapterflow.ca:8443",
    UNRELATED: "https://nope.example.com",
  });
  assert.ok(hosts.has("app.chapterflow.ca"));
  assert.ok(hosts.has("chapterflow.ca"));
  assert.ok(hosts.has("auth.chapterflow.ca:8443"));
  assert.ok(!hosts.has("nope.example.com"));
});

test("trustedHostsFromEnv: ignores blank and unparseable values", () => {
  const hosts = trustedHostsFromEnv({
    APP_BASE_URL: "   ",
    CHAPTERFLOW_APP_BASE_URL: "not a url",
  });
  assert.equal(hosts.size, 0);
});
