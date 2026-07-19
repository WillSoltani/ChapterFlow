import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AUTH_CACHE_GENERATION_COOKIE,
  normalizeAuthCacheGeneration,
  readCookieValue,
} from "./auth-cache-generation";

const GENERATION = "123e4567-e89b-42d3-a456-426614174000";

test("auth cache generations accept UUIDs and reject identity-like or malformed values", () => {
  assert.equal(normalizeAuthCacheGeneration(GENERATION), GENERATION);
  assert.equal(
    normalizeAuthCacheGeneration(GENERATION.toUpperCase()),
    GENERATION,
    "normalization keeps comparisons stable",
  );
  assert.equal(normalizeAuthCacheGeneration("user-sub-123"), null);
  assert.equal(normalizeAuthCacheGeneration(""), null);
  assert.equal(normalizeAuthCacheGeneration(null), null);
});

test("cookie parsing reads only the named opaque generation", () => {
  const cookies = `id_token=secret; ${AUTH_CACHE_GENERATION_COOKIE}=${GENERATION}; theme=dark`;
  assert.equal(readCookieValue(cookies, AUTH_CACHE_GENERATION_COOKIE), GENERATION);
  assert.equal(readCookieValue(cookies, "missing"), null);
  assert.equal(readCookieValue("malformed; no-equals", AUTH_CACHE_GENERATION_COOKIE), null);
});
