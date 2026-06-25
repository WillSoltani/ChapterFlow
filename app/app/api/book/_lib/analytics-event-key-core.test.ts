import { test } from "node:test";
import assert from "node:assert/strict";

import {
  eventSk,
  newEventUniqueId,
  EVENT_SK_PREFIX,
} from "./analytics-event-key-core";

// ─── The core regression: same-millisecond, same-type events must NOT collide ──
// Before the fix, eventSk(iso, eventType) was `EVENT#<iso>#<eventType>` with no
// uniqueness discriminant, so two events of the same type for one user in the
// same millisecond produced a byte-identical SK and the second Put silently
// overwrote the first. These assertions fail against that old builder.

test("two events with identical iso + eventType produce DISTINCT sort keys", () => {
  const iso = "2026-06-24T12:00:00.000Z";
  const a = eventSk(iso, "quiz_explanation_opened");
  const b = eventSk(iso, "quiz_explanation_opened");
  assert.notEqual(a, b, "same-millisecond same-type events must not collide");
});

test("a burst of same-instant same-type events are all unique", () => {
  const iso = "2026-06-24T12:00:00.000Z";
  const keys = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    keys.add(eventSk(iso, "beacon_navigation"));
  }
  assert.equal(keys.size, 1000, "every generated SK in the burst must be unique");
});

// ─── Invariants consumers rely on: prefix + chronological ordering ─────────────

test("SK keeps the EVENT# prefix so begins_with(SK, 'EVENT#') still selects the stream", () => {
  const sk = eventSk("2026-06-24T12:00:00.000Z", "quiz_attempt");
  assert.ok(sk.startsWith(EVENT_SK_PREFIX), "SK must start with EVENT#");
});

test("iso stays the leading segment so lexicographic SK order is chronological", () => {
  const earlier = eventSk("2026-06-24T11:59:59.000Z", "quiz_attempt");
  const later = eventSk("2026-06-24T12:00:00.000Z", "quiz_attempt");
  assert.ok(earlier < later, "earlier event must sort before later event");
});

test("SK has the documented EVENT#<iso>#<eventType>#<uniqueId> shape", () => {
  const iso = "2026-06-24T12:00:00.000Z";
  const sk = eventSk(iso, "quiz_attempt", "abc123");
  assert.equal(sk, `EVENT#${iso}#quiz_attempt#abc123`);
});

// ─── Caller-injected uniqueId is honored (determinism when a domain id exists) ─

test("an injected uniqueId is used verbatim instead of a random one", () => {
  const iso = "2026-06-24T12:00:00.000Z";
  const a = eventSk(iso, "quiz_attempt", "fixed-id");
  const b = eventSk(iso, "quiz_attempt", "fixed-id");
  assert.equal(a, b, "same injected id must reproduce the same SK (idempotent path)");
});

test("an empty injected uniqueId falls back to a generated one (still unique)", () => {
  const iso = "2026-06-24T12:00:00.000Z";
  const a = eventSk(iso, "quiz_attempt", "");
  const b = eventSk(iso, "quiz_attempt", "");
  assert.notEqual(a, b, "empty uniqueId must not produce a collision");
});

// ─── The generator itself ──────────────────────────────────────────────────────

test("newEventUniqueId produces unique, delimiter-free ids", () => {
  const a = newEventUniqueId();
  const b = newEventUniqueId();
  assert.notEqual(a, b);
  assert.ok(!a.includes("-"), "uniqueId must not contain '-'");
  assert.ok(!a.includes("#"), "uniqueId must not contain the SK separator '#'");
  assert.ok(a.length > 0);
});
