import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOK_SLUG_ALIASES,
  CANONICAL_BOOK_SLUGS,
  ORPHAN_BOOK_SLUGS,
  evaluatePublishGuard,
  isOrphanBookSlug,
  orphanSlugsForCanonical,
  resolveCanonicalBookSlug,
} from "./book-slug-aliases";

// PROD-DUP: this map is the single source of truth shared by the publish dedupe
// guard, the orphan→canonical redirects, and the reconcile script. These tests
// pin the six confirmed dup-sets and the guard's reject/supersede behavior so a
// regression can't silently re-open the duplicate-records bug.

const CONFIRMED_PAIRS: Array<[orphan: string, canonical: string]> = [
  ["cant-hurt-me", "you-cant-hurt-me"],
  ["you-can't-hurt-me", "you-cant-hurt-me"],
  ["Getting-Things-Done", "getting-things-done"],
  ["friends-and-influence", "how-to-win-friends-and-influence-people"],
  ["friends-and-influence-student-edition", "how-to-win-friends-and-influence-people"],
  ["33-strategies-of-war", "the-33-strategies-of-war"],
  ["art-of-war", "the-art-of-war"],
  ["laws-of-human-nature", "the-laws-of-human-nature"],
];

test("alias map contains exactly the 8 confirmed orphan slugs", () => {
  assert.equal(ORPHAN_BOOK_SLUGS.length, 8);
  for (const [orphan, canonical] of CONFIRMED_PAIRS) {
    assert.equal(BOOK_SLUG_ALIASES[orphan], canonical, `${orphan} → ${canonical}`);
  }
});

test("the 6 canonical slugs are distinct and never themselves orphans", () => {
  assert.equal(CANONICAL_BOOK_SLUGS.length, 6);
  for (const canonical of CANONICAL_BOOK_SLUGS) {
    assert.equal(isOrphanBookSlug(canonical), false, `${canonical} must not be an orphan`);
  }
});

test("resolveCanonicalBookSlug maps orphans and is idempotent on canonical/unknown", () => {
  assert.equal(resolveCanonicalBookSlug("art-of-war"), "the-art-of-war");
  // Idempotent: a canonical slug resolves to itself (re-resolving never loops).
  assert.equal(resolveCanonicalBookSlug("the-art-of-war"), "the-art-of-war");
  // Unknown slug passes through untouched.
  assert.equal(resolveCanonicalBookSlug("atomic-habits"), "atomic-habits");
});

test("orphanSlugsForCanonical returns all old slugs of a canonical", () => {
  assert.deepEqual(orphanSlugsForCanonical("you-cant-hurt-me").sort(), [
    "cant-hurt-me",
    "you-can't-hurt-me",
  ]);
  assert.deepEqual(orphanSlugsForCanonical("how-to-win-friends-and-influence-people").sort(), [
    "friends-and-influence",
    "friends-and-influence-student-edition",
  ]);
  assert.deepEqual(orphanSlugsForCanonical("atomic-habits"), []);
});

test("guard REJECTS publishing under any orphan slug", () => {
  for (const [orphan, canonical] of CONFIRMED_PAIRS) {
    const decision = evaluatePublishGuard(orphan);
    assert.equal(decision.action, "reject", `${orphan} must be rejected`);
    if (decision.action === "reject") {
      assert.equal(decision.code, "orphan_slug");
      assert.equal(decision.canonicalSlug, canonical);
      assert.match(decision.message, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});

test("guard PUBLISHES a canonical slug and supersedes its old records (a rename retires the old record)", () => {
  const decision = evaluatePublishGuard("the-art-of-war");
  assert.equal(decision.action, "publish");
  if (decision.action === "publish") {
    assert.deepEqual(decision.supersedeSlugs, ["art-of-war"]);
  }

  const friends = evaluatePublishGuard("how-to-win-friends-and-influence-people");
  assert.equal(friends.action, "publish");
  if (friends.action === "publish") {
    assert.deepEqual(friends.supersedeSlugs.sort(), [
      "friends-and-influence",
      "friends-and-influence-student-edition",
    ]);
  }
});

test("guard allows an unrelated book with nothing to supersede", () => {
  const decision = evaluatePublishGuard("atomic-habits");
  assert.equal(decision.action, "publish");
  if (decision.action === "publish") {
    assert.deepEqual(decision.supersedeSlugs, []);
  }
});
