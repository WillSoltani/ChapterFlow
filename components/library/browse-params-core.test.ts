import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_BROWSE_PARAMS,
  parseBrowseParams,
  serializeBrowseParams,
} from "./browse-params-core";

// HOME-17: Library browse filters, sort and "Show all" live in the URL, so
// Back restores them.

test("an empty URL gives the defaults", () => {
  assert.deepEqual(parseBrowseParams(new URLSearchParams("")), DEFAULT_BROWSE_PARAMS);
});

test("filters round-trip through the URL", () => {
  const params = {
    status: "in_progress" as const,
    category: "Leadership" as const,
    difficulty: "easy" as const,
    sort: "alphabetical" as const,
    mood: "quick" as const,
    showAll: true,
  };
  const query = serializeBrowseParams(new URLSearchParams(""), params);
  assert.deepEqual(parseBrowseParams(new URLSearchParams(query)), params);
});

test("defaults are left out of the URL and other params are kept", () => {
  const query = serializeBrowseParams(new URLSearchParams("q=habits&completed=deep-work"), {
    ...DEFAULT_BROWSE_PARAMS,
    category: "Psychology",
  });
  const out = new URLSearchParams(query);
  assert.equal(out.get("q"), "habits");
  assert.equal(out.get("completed"), "deep-work");
  assert.equal(out.get("category"), "Psychology");
  for (const key of ["status", "difficulty", "sort", "mood", "all"]) assert.equal(out.has(key), false, key);
});

test("unknown or tampered values fall back to the defaults", () => {
  const parsed = parseBrowseParams(
    new URLSearchParams("status=bogus&category=Cooking&difficulty=extreme&sort=random&mood=x&all=yes"),
  );
  assert.deepEqual(parsed, DEFAULT_BROWSE_PARAMS);
});

test("an initial category applies only when the URL names none", () => {
  assert.equal(parseBrowseParams(new URLSearchParams(""), "Strategy").category, "Strategy");
  assert.equal(
    parseBrowseParams(new URLSearchParams("category=Leadership"), "Strategy").category,
    "Leadership",
  );
});

test("serializing the same state twice gives the same string (no URL-sync loop)", () => {
  const params = { ...DEFAULT_BROWSE_PARAMS, sort: "shortest" as const };
  const once = serializeBrowseParams(new URLSearchParams("q=x"), params);
  const twice = serializeBrowseParams(new URLSearchParams(once), params);
  assert.equal(once, twice);
});
