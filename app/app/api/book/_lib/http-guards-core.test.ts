import { test } from "node:test";
import assert from "node:assert/strict";
import { isBookApiError } from "./errors";
import {
  evaluateSameOrigin,
  assertWithinSizeLimits,
  assertWithinTotalSize,
  dailyLimitDateKey,
  isWithinDailyLimit,
  originOf,
  shouldEnforceCsrfOrigin,
  SETTINGS_VALUE_MAX_CHARS,
  SETTINGS_TOTAL_MAX_CHARS,
  CHAPTER_NOTES_MAX_CHARS,
} from "./http-guards-core";

const APP = "https://app.chapterflow.ca";

// ─── evaluateSameOrigin (#6) — the decision behind requireSameOrigin ──────────

test("safe methods are never rejected (bypass), even with cross-site headers", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    const d = evaluateSameOrigin({
      method,
      secFetchSite: "cross-site",
      originHeader: "https://evil.example",
      appOrigin: APP,
    });
    assert.equal(d.rejected, false, `${method} must bypass the guard`);
  }
});

test("cross-site Sec-Fetch-Site is rejected (regardless of Origin)", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: "cross-site",
    originHeader: null,
    appOrigin: APP,
  });
  assert.equal(d.rejected, true);
  assert.match((d as { reason: string }).reason, /sec-fetch-site=cross-site/);
});

test("same-site Sec-Fetch-Site (sibling subdomain) is rejected", () => {
  const d = evaluateSameOrigin({
    method: "DELETE",
    secFetchSite: "same-site",
    originHeader: APP,
    appOrigin: APP,
  });
  assert.equal(d.rejected, true);
});

test("unknown Sec-Fetch-Site values fail closed instead of bypassing the Origin check", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: "future-value",
    originHeader: "https://evil.example",
    appOrigin: null,
  });
  assert.deepEqual(d, {
    rejected: true,
    reason: "unsupported sec-fetch-site=future-value",
  });
});

test("same-origin request (matching Origin) is allowed", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: "same-origin",
    originHeader: APP,
    appOrigin: APP,
  });
  assert.equal(d.rejected, false);
});

test("matching Origin with NO Sec-Fetch-Site is allowed (older browsers)", () => {
  const d = evaluateSameOrigin({
    method: "PATCH",
    secFetchSite: null,
    originHeader: APP,
    appOrigin: APP,
  });
  assert.equal(d.rejected, false);
});

test("Origin mismatch is rejected", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: null,
    originHeader: "https://evil.example",
    appOrigin: APP,
  });
  assert.equal(d.rejected, true);
  assert.match((d as { reason: string }).reason, /origin=https:\/\/evil\.example/);
});

test("fallback Origin compare is case-insensitive on host", () => {
  // No Sec-Fetch-Site → Origin fallback; mixed-case Origin still matches.
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: null,
    originHeader: "HTTPS://APP.CHAPTERFLOW.CA",
    appOrigin: APP,
  });
  assert.equal(d.rejected, false);
});

test("Sec-Fetch-Site=same-origin is allowed even when Origin != the pinned app origin (multi-host)", () => {
  // Prod serves apex/www/app off ONE Lambda; a user on the apex sends
  // Origin=https://chapterflow.ca while getAppBaseUrl()=https://app.chapterflow.ca.
  // Sec-Fetch-Site:same-origin (browser-set, unforgeable) proves first-party
  // regardless of the canonical host pin — must NOT 403. (Regression for the
  // multi-host 403-storm BLOCKER.)
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: "same-origin",
    originHeader: "https://chapterflow.ca",
    appOrigin: APP,
  });
  assert.equal(d.rejected, false);
});

test("fallback: a first-party sibling host Origin (same registrable domain) is allowed", () => {
  // Archaic client (no Sec-Fetch-Site) on www; same scheme + registrable domain.
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: null,
    originHeader: "https://www.chapterflow.ca",
    appOrigin: APP, // https://app.chapterflow.ca
  });
  assert.equal(d.rejected, false);
});

test("fallback: a same-domain Origin on a DIFFERENT scheme is rejected", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: null,
    originHeader: "http://www.chapterflow.ca", // http vs https
    appOrigin: APP,
  });
  assert.equal(d.rejected, true);
});

test("literal Origin:'null' with no Sec-Fetch-Site is rejected (strict default, not fail-open)", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: null,
    originHeader: "null",
    appOrigin: APP,
  });
  assert.equal(d.rejected, true);
  assert.match((d as { reason: string }).reason, /no Origin and no Sec-Fetch-Site/);
});

test("STRICT DEFAULT: both Origin and Sec-Fetch-Site absent on unsafe method → rejected", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: null,
    originHeader: null,
    appOrigin: APP,
  });
  assert.equal(d.rejected, true);
  assert.match((d as { reason: string }).reason, /no Origin and no Sec-Fetch-Site/);
});

test("Sec-Fetch-Site=none with no Origin (user-initiated) is allowed", () => {
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: "none",
    originHeader: null,
    appOrigin: APP,
  });
  assert.equal(d.rejected, false);
});

test("an unparseable app origin does not cause a false reject when Origin present", () => {
  // appOrigin null (resolver failed) → we cannot prove a mismatch, so allow.
  const d = evaluateSameOrigin({
    method: "POST",
    secFetchSite: "same-origin",
    originHeader: APP,
    appOrigin: null,
  });
  assert.equal(d.rejected, false);
});

// ─── originOf ─────────────────────────────────────────────────────────────────

test("originOf returns lowercased scheme+host+port, null for junk", () => {
  assert.equal(originOf("https://App.Example.com:8443/path?q=1"), "https://app.example.com:8443");
  assert.equal(originOf("not a url"), null);
  assert.equal(originOf(null), null);
  assert.equal(originOf(undefined), null);
  assert.equal(originOf(""), null);
});

// ─── isCsrfEnforcementOn (flag) ───────────────────────────────────────────────

test("non-production CSRF enforcement defaults ON and only explicit off-switches disable it", () => {
  const decide = (enforcementFlag: string | undefined) =>
    shouldEnforceCsrfOrigin({
      nodeEnvironment: "production",
      deploymentEnvironment: "dev",
      enforcementFlag,
    });

  assert.equal(decide(undefined), true, "unset → ON");
  for (const off of ["0", "false", "off", "no", "FALSE", "Off", " 0 "]) {
    assert.equal(decide(off), false, `"${off}" → observe-only`);
  }
  for (const on of ["1", "true", "on", "yes", "anything"]) {
    assert.equal(decide(on), true, `"${on}" → enforcing`);
  }
});

test("production CSRF enforcement cannot be disabled by any observe-only spelling", () => {
  for (const off of ["0", "false", "off", "no", "FALSE", "Off", " 0 "]) {
    assert.equal(
      shouldEnforceCsrfOrigin({
        nodeEnvironment: "production",
        deploymentEnvironment: "prod",
        enforcementFlag: off,
      }),
      true,
      `prod + "${off}" must enforce`
    );
    assert.equal(
      shouldEnforceCsrfOrigin({
        nodeEnvironment: "production",
        deploymentEnvironment: undefined,
        enforcementFlag: off,
      }),
      true,
      `production fallback + "${off}" must enforce`
    );
  }
});

test("explicit dev and staging deployments may use observe-only while secure defaults stay on", () => {
  for (const deploymentEnvironment of ["dev", "staging"]) {
    assert.equal(
      shouldEnforceCsrfOrigin({
        nodeEnvironment: "production",
        deploymentEnvironment,
        enforcementFlag: "off",
      }),
      false,
      `${deploymentEnvironment} may observe despite the optimized runtime using NODE_ENV=production`
    );
    assert.equal(
      shouldEnforceCsrfOrigin({
        nodeEnvironment: "production",
        deploymentEnvironment,
        enforcementFlag: undefined,
      }),
      true,
      `${deploymentEnvironment} remains enforcing by default`
    );
  }
});

// ─── assertWithinSizeLimits (#8) ──────────────────────────────────────────────

test("assertWithinSizeLimits: under the limit passes", () => {
  assert.doesNotThrow(() =>
    assertWithinSizeLimits({ notes: "x".repeat(100) }, CHAPTER_NOTES_MAX_CHARS, "state")
  );
  // exactly at the limit is allowed (cap is strict >).
  assert.doesNotThrow(() =>
    assertWithinSizeLimits({ v: "y".repeat(SETTINGS_VALUE_MAX_CHARS) }, SETTINGS_VALUE_MAX_CHARS)
  );
});

test("assertWithinSizeLimits: over the limit throws 413 payload_too_large naming the path", () => {
  let thrown: unknown;
  try {
    assertWithinSizeLimits(
      { reading: { fontFamily: "z".repeat(SETTINGS_VALUE_MAX_CHARS + 1) } },
      SETTINGS_VALUE_MAX_CHARS,
      "settings"
    );
  } catch (e) {
    thrown = e;
  }
  assert.ok(isBookApiError(thrown), "must throw a BookApiError");
  const err = thrown as { status: number; code: string; message: string };
  assert.equal(err.status, 413);
  assert.equal(err.code, "payload_too_large");
  assert.match(err.message, /settings\.reading\.fontFamily/);
});

test("assertWithinSizeLimits: walks arrays and nested objects, ignores non-strings", () => {
  assert.doesNotThrow(() =>
    assertWithinSizeLimits(
      { a: [1, 2, { b: "ok" }], c: null, d: true, e: 42 },
      10
    )
  );
  let thrown: unknown;
  try {
    assertWithinSizeLimits({ a: [{ deep: "toolong!!" }] }, 5, "x");
  } catch (e) {
    thrown = e;
  }
  assert.ok(isBookApiError(thrown));
  assert.match((thrown as { message: string }).message, /x\.a\[0\]\.deep/);
});

test("assertWithinSizeLimits: caps recursion depth on adversarial nesting", () => {
  // Build a chain deeper than maxDepth(=3) — should reject as 'nested too deeply'.
  let node: Record<string, unknown> = { leaf: "ok" };
  for (let i = 0; i < 10; i++) node = { next: node };
  let thrown: unknown;
  try {
    assertWithinSizeLimits(node, 100, "deep", 3);
  } catch (e) {
    thrown = e;
  }
  assert.ok(isBookApiError(thrown));
  const err = thrown as { status: number; message: string };
  assert.equal(err.status, 413);
  assert.match(err.message, /nested too deeply/);
});

// ─── assertWithinTotalSize (#8 — aggregate item cap) ──────────────────────────

test("assertWithinTotalSize: an item under the aggregate cap passes", () => {
  assert.doesNotThrow(() =>
    assertWithinTotalSize({ reading: { fontFamily: "serif" }, goals: { weekly: 5 } }, SETTINGS_TOTAL_MAX_CHARS, "settings")
  );
});

test("assertWithinTotalSize: MANY in-limit strings still trip the aggregate cap (the cross-request growth case)", () => {
  // Each value is well under SETTINGS_VALUE_MAX_CHARS, so the per-string guard
  // passes — but the key COUNT blows the aggregate ceiling. This is exactly the
  // additive-merge growth assertWithinSizeLimits cannot catch.
  const extended: Record<string, string> = {};
  for (let i = 0; i < 5000; i++) extended[`k${i}`] = "value";
  let thrown: unknown;
  try {
    assertWithinTotalSize({ extended }, SETTINGS_TOTAL_MAX_CHARS, "settings");
  } catch (e) {
    thrown = e;
  }
  assert.ok(isBookApiError(thrown), "must throw a BookApiError");
  const err = thrown as { status: number; code: string; message: string };
  assert.equal(err.status, 413);
  assert.equal(err.code, "payload_too_large");
  assert.match(err.message, /settings is too large/);
  // Sanity: the same payload's individual strings all PASS the per-string guard,
  // proving the two checks are complementary, not redundant.
  assert.doesNotThrow(() => assertWithinSizeLimits({ extended }, SETTINGS_VALUE_MAX_CHARS, "settings"));
});

test("assertWithinTotalSize: GROWTH-only — an already-over-cap item can still be saved if it does NOT grow (P1)", () => {
  // A user whose stored settings already exceed the cap must not be locked out of
  // editing. previousLength >= the new total means the write isn't growing, so it
  // is allowed even though it breaches the cap.
  const big: Record<string, string> = {};
  for (let i = 0; i < 5000; i++) big[`k${i}`] = "value";
  const total = JSON.stringify({ extended: big }).length;
  assert.ok(total > SETTINGS_TOTAL_MAX_CHARS, "fixture must exceed the cap");
  // Same size (not growing) → allowed.
  assert.doesNotThrow(() =>
    assertWithinTotalSize({ extended: big }, SETTINGS_TOTAL_MAX_CHARS, "settings", total)
  );
  // Shrinking from an even larger prior size → allowed.
  assert.doesNotThrow(() =>
    assertWithinTotalSize({ extended: big }, SETTINGS_TOTAL_MAX_CHARS, "settings", total + 1000)
  );
  // But GROWING past the cap from a smaller prior size → still rejected.
  assert.throws(
    () => assertWithinTotalSize({ extended: big }, SETTINGS_TOTAL_MAX_CHARS, "settings", total - 1),
    (e: unknown) => isBookApiError(e) && (e as { status: number }).status === 413
  );
});

// ─── daily-limit pure helpers (#8) ────────────────────────────────────────────

test("dailyLimitDateKey returns a UTC YYYY-MM-DD bucket", () => {
  // 2026-06-23T23:30:00Z and 2026-06-24T00:30:00Z are different buckets.
  assert.equal(dailyLimitDateKey(Date.parse("2026-06-23T23:30:00Z")), "2026-06-23");
  assert.equal(dailyLimitDateKey(Date.parse("2026-06-24T00:30:00Z")), "2026-06-24");
});

test("isWithinDailyLimit: absent counter, under, and at the cap", () => {
  assert.equal(isWithinDailyLimit(undefined, 5), true, "first of day");
  assert.equal(isWithinDailyLimit(0, 5), true);
  assert.equal(isWithinDailyLimit(4, 5), true, "4 used, 5th allowed");
  assert.equal(isWithinDailyLimit(5, 5), false, "cap reached");
  assert.equal(isWithinDailyLimit(6, 5), false);
});
