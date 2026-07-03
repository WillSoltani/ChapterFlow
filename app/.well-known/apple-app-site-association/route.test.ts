import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "./route";
import {
  DEFAULT_IOS_BUNDLE_ID,
  IOS_TEAM_ID_PLACEHOLDER,
  IOS_UNIVERSAL_LINK_PATHS,
} from "@/app/_lib/apple-app-site-association";

// A real route-handler test: invokes the Next.js GET handler in-process and
// asserts the AASA contract Apple depends on — JSON shape, content-type, and
// that the response is a direct 200 (never a redirect).

test("GET /.well-known/apple-app-site-association is a direct 200 (no redirect)", async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  assert.ok(res.status < 300 || res.status >= 400, "must not be a 3xx redirect");
  assert.equal(res.headers.get("location"), null); // no redirect target
});

test("serves application/json with a cache-control header", async () => {
  const res = await GET();
  const contentType = res.headers.get("content-type") ?? "";
  assert.ok(
    contentType.includes("application/json"),
    `expected application/json, got "${contentType}"`,
  );
  assert.ok(
    (res.headers.get("cache-control") ?? "").includes("max-age"),
    "AASA should be cacheable",
  );
});

test("body has the applinks + webcredentials shape with matching appID and paths", async () => {
  const savedTeam = process.env.IOS_APP_TEAM_ID;
  const savedBundle = process.env.IOS_APP_BUNDLE_ID;
  delete process.env.IOS_APP_TEAM_ID; // exercise the documented placeholder
  delete process.env.IOS_APP_BUNDLE_ID;
  try {
    const res = await GET();
    const body = await res.json();
    const expectedAppId = `${IOS_TEAM_ID_PLACEHOLDER}.${DEFAULT_IOS_BUNDLE_ID}`;

    // applinks
    assert.deepEqual(body.applinks.apps, []);
    assert.equal(body.applinks.details.length, 1);
    const detail = body.applinks.details[0];
    assert.equal(detail.appID, expectedAppId);
    assert.deepEqual(detail.appIDs, [expectedAppId]);
    assert.deepEqual(detail.paths, [...IOS_UNIVERSAL_LINK_PATHS]);
    // the exact paths the product covers
    assert.deepEqual(detail.paths, [
      "/book/*",
      "/pair/accept/*",
      "/gift/*",
      "/ref/*",
      "/review",
    ]);

    // webcredentials — same appID, enables iOS password autofill
    assert.deepEqual(body.webcredentials.apps, [expectedAppId]);
  } finally {
    if (savedTeam === undefined) delete process.env.IOS_APP_TEAM_ID;
    else process.env.IOS_APP_TEAM_ID = savedTeam;
    if (savedBundle === undefined) delete process.env.IOS_APP_BUNDLE_ID;
    else process.env.IOS_APP_BUNDLE_ID = savedBundle;
  }
});

test("appID reflects IOS_APP_TEAM_ID / IOS_APP_BUNDLE_ID when set", async () => {
  const savedTeam = process.env.IOS_APP_TEAM_ID;
  const savedBundle = process.env.IOS_APP_BUNDLE_ID;
  process.env.IOS_APP_TEAM_ID = "ABCDE12345";
  process.env.IOS_APP_BUNDLE_ID = "com.example.custom";
  try {
    const res = await GET();
    const body = await res.json();
    assert.equal(body.applinks.details[0].appID, "ABCDE12345.com.example.custom");
    assert.deepEqual(body.webcredentials.apps, ["ABCDE12345.com.example.custom"]);
  } finally {
    if (savedTeam === undefined) delete process.env.IOS_APP_TEAM_ID;
    else process.env.IOS_APP_TEAM_ID = savedTeam;
    if (savedBundle === undefined) delete process.env.IOS_APP_BUNDLE_ID;
    else process.env.IOS_APP_BUNDLE_ID = savedBundle;
  }
});
