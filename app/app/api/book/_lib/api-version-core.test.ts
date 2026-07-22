import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveApiVersion } from "./api-version-core";

// WS4-006: Accept-header API versioning. See docs/API-VERSIONING.md for the
// policy this module implements — v1 is the only supported version today;
// absent/plain/browser Accept headers all default to v1 so existing web and
// native clients are unaffected. Only a PRESENT `application/vnd.chapterflow.v{N}+json`
// media type with N !== 1 is rejected.

test("absent Accept header resolves to v1", () => {
  assert.deepEqual(resolveApiVersion(null), { supported: true, version: 1 });
});

test("plain application/json resolves to v1", () => {
  assert.deepEqual(resolveApiVersion("application/json"), { supported: true, version: 1 });
});

test("*/* and browser text/html Accept resolve to v1", () => {
  assert.deepEqual(resolveApiVersion("text/html,application/xhtml+xml,*/*"), {
    supported: true,
    version: 1,
  });
});

test("application/vnd.chapterflow.v1+json resolves to v1", () => {
  assert.deepEqual(resolveApiVersion("application/vnd.chapterflow.v1+json"), {
    supported: true,
    version: 1,
  });
});

test("application/vnd.chapterflow.v2+json is unsupported", () => {
  assert.deepEqual(resolveApiVersion("application/vnd.chapterflow.v2+json"), {
    supported: false,
    requested: "application/vnd.chapterflow.v2+json",
  });
});

test("vendor type embedded in a multi-range Accept list is detected", () => {
  assert.equal(
    resolveApiVersion("application/json, application/vnd.chapterflow.v3+json").supported,
    false
  );
});
