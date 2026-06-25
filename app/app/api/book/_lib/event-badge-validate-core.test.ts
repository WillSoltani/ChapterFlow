import { test } from "node:test";
import assert from "node:assert/strict";

import { validateEventBadge } from "./event-badge-validate-core";
import { BookApiError, isBookApiError } from "./errors";

const VALID = { badgeId: "summer-2026", name: "Summer Sprint", icon: "sun" };

function expectInvalidBadge(raw: unknown): void {
  let thrown: unknown;
  try {
    validateEventBadge(raw);
  } catch (err) {
    thrown = err;
  }
  assert.ok(isBookApiError(thrown), `expected BookApiError, got ${String(thrown)}`);
  const err = thrown as BookApiError;
  assert.equal(err.status, 400);
  assert.equal(err.code, "invalid_badge");
}

test("accepts a well-formed badge and trims whitespace", () => {
  const out = validateEventBadge({ ...VALID });
  assert.deepEqual(out, VALID);

  const trimmed = validateEventBadge({
    badgeId: "  summer-2026  ",
    name: "  Summer Sprint  ",
    icon: "  sun  ",
  });
  assert.deepEqual(trimmed, VALID);
});

test("rejects an empty object (the H12 PATCH bypass)", () => {
  // This is the exact payload the old PATCH handler accepted:
  // `badge: {} && typeof {} === "object"` was truthy, so {} overwrote the badge.
  expectInvalidBadge({});
});

test("rejects a partial badge missing any required field", () => {
  expectInvalidBadge({ name: "x" });
  expectInvalidBadge({ badgeId: "id", name: "x" }); // missing icon
  expectInvalidBadge({ badgeId: "id", icon: "i" }); // missing name
  expectInvalidBadge({ name: "x", icon: "i" }); // missing badgeId
});

test("rejects empty-string and whitespace-only fields", () => {
  expectInvalidBadge({ badgeId: "", name: "x", icon: "i" });
  expectInvalidBadge({ badgeId: "   ", name: "x", icon: "i" });
  expectInvalidBadge({ badgeId: "id", name: "  ", icon: "i" });
});

test("rejects non-string field types", () => {
  expectInvalidBadge({ badgeId: 1, name: "x", icon: "i" });
  expectInvalidBadge({ badgeId: "id", name: true, icon: "i" });
  expectInvalidBadge({ badgeId: "id", name: "x", icon: null });
});

test("rejects non-object payloads (null, array, primitives)", () => {
  expectInvalidBadge(null);
  expectInvalidBadge(undefined);
  expectInvalidBadge("badge");
  expectInvalidBadge(42);
  expectInvalidBadge([VALID]);
});
