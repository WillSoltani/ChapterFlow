/**
 * Venue plan — prevents one location stamp from becoming the default setting
 * across a book while keeping six distinct example venues per chapter.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, rmdirSync, rmSync } from "fs";
import { resolve } from "path";

import { loadVenuePalette, planVenues } from "../src/librarian/venuePlan.js";
import { test } from "./harness.js";
import { PIPELINE_DIR, runCli } from "./helpers.js";

const BOOK = "zz-fixture-venues";

test("venue palette has the capacity required by the cap-2 invariant", () => {
  const venues = loadVenuePalette();
  assert.equal(venues.length, 103, "planner proof assumes a 103-entry prime-length palette");
  assert.equal(new Set(venues).size, venues.length, "venue ids/nouns must be unique");
  for (const venue of venues) {
    assert.ok(venue.startsWith("a ") || venue.startsWith("an "), `${venue} should be a noun phrase with an article`);
    assert.ok(!/[.!?]$/.test(venue), `${venue} should not be scene wording`);
  }
});

test("venue-plan deals six distinct venues per chapter", () => {
  const plan = planVenues(BOOK, 1, 34);
  for (const [chapter, venues] of Object.entries(plan.allocation)) {
    assert.equal(venues.length, 6, `ch${chapter} must have six venues`);
    assert.equal(new Set(venues).size, venues.length, `ch${chapter} has duplicate venues`);
  }
});

test("venue-plan has zero overlap between consecutive chapters", () => {
  const plan = planVenues(BOOK, 1, 34);
  for (let chapter = 1; chapter < 34; chapter++) {
    const current = plan.allocation[chapter];
    const next = plan.allocation[chapter + 1];
    const shared = current.filter((venue) => next.includes(venue));
    assert.deepEqual(shared, [], `ch${chapter}->ch${chapter + 1} share venues: ${shared.join(", ")}`);
  }
});

test("venue-plan keeps every venue at <=2 chapters across a 34-chapter book", () => {
  const plan = planVenues(BOOK, 1, 34);
  const counts = new Map<string, Set<number>>();
  for (const [chapter, venues] of Object.entries(plan.allocation)) {
    for (const venue of venues) {
      const chapters = counts.get(venue) ?? new Set<number>();
      chapters.add(Number(chapter));
      counts.set(venue, chapters);
    }
  }
  const over = Array.from(counts.entries()).filter(([, chapters]) => chapters.size > 2);
  assert.deepEqual(over, [], `venues over cap: ${over.map(([venue, chapters]) => `${venue}:${chapters.size}`).join(", ")}`);
});

test("venue-plan is deterministic per book and varies across books", () => {
  const a1 = planVenues("zz-venue-alpha", 1, 10);
  const a2 = planVenues("zz-venue-alpha", 1, 10);
  assert.deepEqual(a1.allocation, a2.allocation);
  const b = planVenues("zz-venue-beta", 1, 10);
  assert.notDeepEqual(a1.allocation[1], b.allocation[1], "different books should start at different venue offsets");
});

test("venue-plan CLI writes the plan and prints allocations", () => {
  const planParent = resolve(PIPELINE_DIR, "state", "venue-plans");
  const planParentExisted = existsSync(planParent);
  const planPath = resolve(planParent, `${BOOK}.venue-plan.json`);
  try {
    const { status, out } = runCli(["venue-plan", BOOK, "--from", "1", "--to", "3"]);
    assert.equal(status, 0, out.slice(-400));
    assert.match(out, /Venue plan/);
    assert.match(out, /ch01:/);
    assert.match(out, /Written:/);
  } finally {
    rmSync(planPath, { force: true });
    if (!planParentExisted && existsSync(planParent) && readdirSync(planParent).length === 0) rmdirSync(planParent);
  }
});
