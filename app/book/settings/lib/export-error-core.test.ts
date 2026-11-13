import { test } from "node:test";
import assert from "node:assert/strict";
import { exportErrorMessage } from "./export-error-core";

test("429: the daily export limit is named", () => {
  const message = exportErrorMessage(429, {
    error: { code: "rate_limited", message: "Daily limit reached for data exports (5/day). Try again tomorrow." },
  });
  assert.match(message, /^You've reached today's export limit/);
  assert.match(message, /tomorrow/);
});

test("other refusals show the server's message", () => {
  assert.equal(
    exportErrorMessage(400, { error: { code: "invalid_format", message: "format must be json, csv, or markdown" } }),
    "format must be json, csv, or markdown",
  );
});

test("an error with no readable message falls back to a plain retry line", () => {
  assert.equal(exportErrorMessage(500, null), "Export failed. Please try again.");
  assert.equal(exportErrorMessage(500, { error: { message: "  " } }), "Export failed. Please try again.");
  assert.equal(exportErrorMessage(502, "<html>"), "Export failed. Please try again.");
});

test("no response at all says the connection failed", () => {
  assert.match(exportErrorMessage(null, null), /connection/);
});
