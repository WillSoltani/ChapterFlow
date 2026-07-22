import test from "node:test";
import assert from "node:assert/strict";
import {
  SETTINGS_KEY,
  ENTITLEMENTS_KEY,
  COMMITMENTS_KEY,
} from "./book-read-keys";

test("settings readers share one cache key", () => {
  assert.equal(SETTINGS_KEY, "/app/api/book/me/settings");
});

test("entitlements readers share one cache key", () => {
  assert.equal(ENTITLEMENTS_KEY, "/app/api/book/me/entitlements");
});

test("commitments readers share one cache key", () => {
  assert.equal(COMMITMENTS_KEY, "/app/api/book/me/commitments");
});
