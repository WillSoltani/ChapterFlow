/**
 * Quarantine must be STICKY (Phase 1). Before this, quarantine-book only
 * moved the package file aside — chapters, attestations, and indexes all
 * survived, nothing read the quarantine record, and the next promote or
 * batch --run silently re-shipped the pulled book (verified 2026-06-09).
 */

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { promoteBook } from "../src/promoteBook.js";
import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR, runCli, STATE_CHAPTERS, writeFixtureBook } from "./helpers.js";

const BOOK = "zz-fixture-quarantine";
const QUARANTINE_DIR = resolve(PIPELINE_DIR, "state", "books", "_quarantined");

function cleanup(): void {
  for (const f of readdirSync(STATE_CHAPTERS)) {
    if (f.startsWith(`${BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
  }
  try {
    for (const f of readdirSync(QUARANTINE_DIR)) {
      if (f.startsWith(`${BOOK}.`)) rmSync(resolve(QUARANTINE_DIR, f), { force: true });
    }
  } catch {}
  // The released-tombstone test runs promoteBook, which gets gate-BLOCKED and
  // writes a report + a timestamped _blocked quarantine copy — clean both, or
  // every suite run leaks a file into real state.
  const booksDir = resolve(PIPELINE_DIR, "state", "books");
  rmSync(resolve(booksDir, `${BOOK}.gate.json`), { force: true });
  try {
    for (const f of readdirSync(resolve(booksDir, "_blocked"))) {
      if (f.startsWith(`${BOOK}.`)) rmSync(resolve(booksDir, "_blocked", f), { force: true });
    }
  } catch {}
}

test("promoteBook refuses a quarantined book outright (tombstone is sticky)", () => {
  try {
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1)]);
    mkdirSync(QUARANTINE_DIR, { recursive: true });
    writeFileSync(
      resolve(QUARANTINE_DIR, `${BOOK}.json`),
      JSON.stringify({ bookId: BOOK, reason: "108/108 word-salad quizzes", quarantinedAt: "x", movedTo: "y" }),
      "utf8",
    );
    const result = promoteBook({
      bookId: BOOK,
      title: "Fixture",
      author: "Nobody",
      chapters: [{ chapterId: `${BOOK}-ch01`, chapterNumber: 1, chapterTitle: "One" }] as any,
    });
    assert.equal(result.promoted, false);
    assert.match(result.reason, /QUARANTINED/);
    assert.match(result.reason, /unquarantine-book/, "the operator must be told the release path");
  } finally {
    cleanup();
  }
});

test("unquarantine-book archives the tombstone, after which promote proceeds past Step 0", () => {
  try {
    writeFixtureBook(STATE_CHAPTERS, [makeChapter(BOOK, 1)]);
    mkdirSync(QUARANTINE_DIR, { recursive: true });
    writeFileSync(
      resolve(QUARANTINE_DIR, `${BOOK}.json`),
      JSON.stringify({ bookId: BOOK, reason: "test", quarantinedAt: "x", movedTo: "y" }),
      "utf8",
    );
    const release = runCli(["unquarantine-book", BOOK]);
    assert.equal(release.status, 0, release.out.slice(-400));
    const archived = readdirSync(QUARANTINE_DIR).filter((f) => f.startsWith(`${BOOK}.released.`));
    assert.equal(archived.length, 1, "the record must be archived, not deleted — quarantine history survives");

    // The gate stack still applies — the fixture isn't gate-clean, so promote
    // must now fail on GATES, not on the tombstone.
    const result = promoteBook({
      bookId: BOOK,
      title: "Fixture",
      author: "Nobody",
      chapters: [{ chapterId: `${BOOK}-ch01`, chapterNumber: 1, chapterTitle: "One" }] as any,
    });
    assert.doesNotMatch(result.reason, /QUARANTINED/, "tombstone must be released");
    assert.equal(result.promoted, false, "release does not bypass the gates");
  } finally {
    cleanup();
  }
});

test("unquarantine-book exits 2 when there is no tombstone", () => {
  const r = runCli(["unquarantine-book", BOOK]);
  assert.equal(r.status, 2);
});
