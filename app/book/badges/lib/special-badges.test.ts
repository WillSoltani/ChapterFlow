import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSpecialBadges, SPECIAL_BADGE_CATALOG } from "./special-badges";

test("PROG-11: a journey award becomes a Special badge named from journeys.json", () => {
  const special = buildSpecialBadges([
    { badgeId: "journey-habit-builder", earnedAt: "2026-11-10T09:00:00.000Z" },
  ]);
  assert.equal(special.length, 1);
  assert.deepEqual(special[0], {
    id: "journey-habit-builder",
    name: "Habit Architect",
    icon: "Repeat",
    source: "journey",
    sourceTitle: "Habit Builder",
    earnedAt: "2026-11-10T09:00:00.000Z",
  });
});

test("PROG-11: an event award becomes a Special badge named from events.json", () => {
  const [badge] = buildSpecialBadges([
    { badgeId: "event-habit-sprint-2026", earnedAt: "2026-10-01T09:00:00.000Z" },
  ]);
  assert.equal(badge?.name, "Habit Sprinter");
  assert.equal(badge?.source, "event");
  assert.equal(badge?.sourceTitle, "Habit Sprint");
});

test("PROG-11: regular badge awards and unknown ids are not Special", () => {
  const special = buildSpecialBadges([
    { badgeId: "first-chapter", earnedAt: "2026-10-01T09:00:00.000Z" },
    { badgeId: "journey-does-not-exist", earnedAt: "2026-10-01T09:00:00.000Z" },
  ]);
  assert.deepEqual(special, []);
});

test("PROG-11: newest first, one entry per badge", () => {
  const special = buildSpecialBadges([
    { badgeId: "journey-habit-builder", earnedAt: "2026-09-01T09:00:00.000Z" },
    { badgeId: "event-habit-sprint-2026", earnedAt: "2026-10-01T09:00:00.000Z" },
    { badgeId: "journey-habit-builder", earnedAt: "2026-09-02T09:00:00.000Z" },
  ]);
  assert.deepEqual(special.map((b) => b.id), ["event-habit-sprint-2026", "journey-habit-builder"]);
});

test("PROG-11: every journey and event badge in content is in the catalog", () => {
  const ids = SPECIAL_BADGE_CATALOG.map((b) => b.id);
  assert.ok(ids.includes("journey-first-time-leader"));
  assert.ok(ids.includes("event-leadership-month-2026"));
  assert.equal(new Set(ids).size, ids.length);
});
