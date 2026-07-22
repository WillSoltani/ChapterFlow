import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findDuplicateTitleGroups,
  normalizeTitle,
  type CatalogRecordLike,
} from "./catalog-integrity";

// PROD-DUP / DUP-OLD-DEGRADED: catches same-title sibling catalog records (a
// forked slug serving a degraded duplicate) — both the known forks and any
// future one. The reconcile script reports these; this pins the detection.

test("normalizeTitle collapses case and whitespace", () => {
  assert.equal(normalizeTitle("  The   Art  of War "), "the art of war");
  assert.equal(normalizeTitle("THE ART OF WAR"), "the art of war");
});

test("flags a known fork: art-of-war (orphan) vs the-art-of-war (canonical)", () => {
  const records: CatalogRecordLike[] = [
    {
      bookId: "the-art-of-war",
      title: "The Art of War",
      author: "Sunzi",
      status: "PUBLISHED",
      currentPublishedVersion: 4,
      variantFamily: "PBC",
      cover: { emoji: "📜" },
    },
    {
      bookId: "art-of-war",
      title: "The Art of War",
      author: "Sun Tzu",
      status: "PUBLISHED",
      currentPublishedVersion: 1,
      variantFamily: "EMH",
      cover: { emoji: "📘" },
    },
    { bookId: "atomic-habits", title: "Atomic Habits", status: "PUBLISHED" },
  ];

  const groups = findDuplicateTitleGroups(records);
  assert.equal(groups.length, 1);
  const group = groups[0]!;
  // The non-orphan, highest-version record is kept; the orphan is flagged.
  assert.equal(group.canonicalBookId, "the-art-of-war");
  assert.deepEqual(group.orphanBookIds, ["art-of-war"]);
  // Divergence across the siblings is surfaced (this is what makes the fork visible).
  assert.deepEqual(group.divergentFields.sort(), ["author", "cover", "variantFamily"]);
});

test("no false positive when only one record per title", () => {
  const records: CatalogRecordLike[] = [
    { bookId: "the-art-of-war", title: "The Art of War" },
    { bookId: "atomic-habits", title: "Atomic Habits" },
    { bookId: "deep-work", title: "Deep Work" },
  ];
  assert.deepEqual(findDuplicateTitleGroups(records), []);
});

test("the same bookId listed twice (META + CATALOG mirror) is not a fork", () => {
  const records: CatalogRecordLike[] = [
    { bookId: "the-art-of-war", title: "The Art of War" },
    { bookId: "the-art-of-war", title: "The Art of War" },
  ];
  assert.deepEqual(findDuplicateTitleGroups(records), []);
});

test("picks the highest published version when none/both slugs are known orphans", () => {
  const records: CatalogRecordLike[] = [
    { bookId: "deep-work-v1", title: "Deep Work", currentPublishedVersion: 1 },
    { bookId: "deep-work-v3", title: "Deep Work", currentPublishedVersion: 3 },
  ];
  const groups = findDuplicateTitleGroups(records);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.canonicalBookId, "deep-work-v3");
  assert.deepEqual(groups[0]!.orphanBookIds, ["deep-work-v1"]);
});
