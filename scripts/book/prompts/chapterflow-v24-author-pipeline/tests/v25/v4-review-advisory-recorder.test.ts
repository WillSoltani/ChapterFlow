/**
 * R-166 — a PASSING review's WARN advisories, kept instead of dropped, and the
 * edit provenance the release sidecar reads.
 *
 * The shipped Franklin revision's canonical review is outcome PASS with 94
 * issues: 92 WARN, 2 INFO, every WARN naming exactly one chapter, and nothing in
 * the pipeline reads any of them. These cases pin the carrier: which issues are
 * selected, how they are scoped and bounded, that the operator flag gates the
 * whole thing, and that a store failure can never turn a passing book into a
 * failed run.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  advisoryChaptersFromCandidate,
  advisoryChaptersOfIssue,
  chapterAdvisoriesFromReview,
  recordReviewAdvisories,
  type AdvisoryIssue,
} from "../../src/app/reviewAdvisoryRecorder.js";
import {
  CHAPTER_EDIT_PROVENANCE_SCHEMA_VERSION,
  summarizeChapterEditProvenance,
} from "../../src/app/chapterEditProvenance.js";
import { CHAPTER_EDITOR_ADVISORY_ENV } from "../../src/app/chapterEditorPass.js";
import {
  MAX_ADVISORIES_PER_CHAPTER,
  MAX_ADVISORY_CHARS,
  createFileReviewAdvisoryStore,
  type ReviewAdvisoryStore,
} from "../../src/books/reviewAdvisoryStore.js";
import { createBookWriteLock } from "../../src/books/bookLease.js";
import type { CandidateSnapshot } from "../../src/books/candidateTypes.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "advisory-book";
const ON = { [CHAPTER_EDITOR_ADVISORY_ENV]: "1" } as const;

function chapterFile(chapterNumber: number): CandidateSnapshot["files"][number] {
  const chapterId = `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}`;
  const bytes = Buffer.from(JSON.stringify({ chapterId, number: chapterNumber, title: `Chapter ${chapterNumber}` }));
  return {
    kind: "CHAPTER",
    mediaType: "application/json",
    logicalPath: `content/chapters/${chapterId}.v21-native.chapter.json`,
    bytes,
    byteLength: bytes.byteLength,
  };
}

function candidate(chapterCount = 3): CandidateSnapshot {
  const files = [
    { kind: "SIDECAR" as const, mediaType: "application/json" as const, logicalPath: "compiler/book-design.json", bytes: Buffer.from("{}"), byteLength: 2 },
    ...Array.from({ length: chapterCount }, (_, index) => chapterFile(index + 1)),
  ];
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: "candidate-1",
      createdByRunId: "run-1",
      entries: files.map(({ bytes: _bytes, ...file }) => file),
      manifestDigest: "a".repeat(64),
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    files,
  };
}

function issue(code: string, severity: string, message: string, location?: string): AdvisoryIssue {
  return { code, severity, message, ...(location === undefined ? {} : { location }) };
}

function store(context: TestContext, suffix: string): { store: ReviewAdvisoryStore; booksRoot: string } {
  const booksRoot = resolve(context.roots.tempRoot, `advisory-books-${suffix}`);
  mkdirSync(booksRoot, { recursive: true });
  return { store: createFileReviewAdvisoryStore({ booksRoot, writeLock: createBookWriteLock({ booksRoot }) }), booksRoot };
}

requiredTest("A1 chapters are read off the candidate's own chapter artifacts", () => {
  assert.deepEqual(advisoryChaptersFromCandidate(candidate(2)), [
    { chapterNumber: 1, chapterId: `${BOOK}-ch01` },
    { chapterNumber: 2, chapterId: `${BOOK}-ch02` },
  ]);
  // A candidate whose chapters cannot be parsed simply records nothing.
  const source = candidate(1);
  const broken: CandidateSnapshot = {
    manifest: source.manifest,
    files: source.files.map((file) => (file.kind === "CHAPTER" ? { ...file, bytes: Buffer.from("not json") } : file)),
  };
  assert.deepEqual(advisoryChaptersFromCandidate(broken), []);
});

requiredTest("A2 an issue is scoped by the same boundary class a multi-chapter finding needs", () => {
  const chapters = advisoryChaptersFromCandidate(candidate(3));
  assert.deepEqual(advisoryChaptersOfIssue(issue("R", "WARN", "m", "ch02"), chapters), [2]);
  assert.deepEqual(advisoryChaptersOfIssue(issue("R", "WARN", "m", `${BOOK}-ch03/seat-a/quiz`), chapters), [3]);
  // A book-wide advisory that NAMES its chapters is scoped to all of them.
  assert.deepEqual(advisoryChaptersOfIssue(issue("R", "WARN", "m", "ch01,ch02, ch03"), chapters), [1, 2, 3]);
  // No location, or a location naming no chapter, is unscoped.
  assert.deepEqual(advisoryChaptersOfIssue(issue("R", "WARN", "m"), chapters), []);
  assert.deepEqual(advisoryChaptersOfIssue(issue("R", "WARN", "m", "book"), chapters), []);
  // A bare number must not match a different chapter by substring.
  assert.deepEqual(advisoryChaptersOfIssue(issue("R", "WARN", "m", "ch012"), chapters), []);
});

requiredTest("A3 only WARNs are carried, per chapter, bounded in count and in length", () => {
  const chapters = advisoryChaptersFromCandidate(candidate(2));
  const long = "x".repeat(MAX_ADVISORY_CHARS + 200);
  const issues: AdvisoryIssue[] = [
    issue("READER.CHURN", "WARN", "ch01 repeats the same specific in every tier.", "ch01"),
    issue("READER.CARD", "WARN", long, "ch01"),
    issue("READER.NOTE", "INFO", "ch01 reads well overall.", "ch01"),
    issue("READER.BLOCK", "BLOCKER", "ch01 contradicts itself.", "ch01"),
    issue("READER.UNSCOPED", "WARN", "the book is uneven.", undefined),
    ...Array.from({ length: MAX_ADVISORIES_PER_CHAPTER + 5 }, (_, index) =>
      issue(`READER.X${index}`, "WARN", `ch02 advisory ${index}`, "ch02")),
  ];
  const grouped = chapterAdvisoriesFromReview(issues, chapters);
  const first = grouped.get(`${BOOK}-ch01`);
  assert.ok(first);
  assert.deepEqual(first.map((entry) => entry.code), ["READER.CHURN", "READER.CARD"]);
  assert.equal(first[1].message.length, MAX_ADVISORY_CHARS + 1, "an over-long advisory is clamped and marked");
  assert.equal(grouped.get(`${BOOK}-ch02`)?.length, MAX_ADVISORIES_PER_CHAPTER);
  assert.equal(grouped.size, 2, "an advisory that names no chapter is dropped, never broadcast");
});

requiredTest("A4 nothing is recorded unless the operator asks, and nothing without a store", async (context) => {
  const { store: advisories } = store(context, "flag");
  const issues = [issue("READER.CHURN", "WARN", "ch01 repeats itself.", "ch01")];

  const off = await recordReviewAdvisories({
    store: advisories, env: {}, bookId: BOOK, reviewId: "review-1", issues, candidate: candidate(1),
  });
  assert.deepEqual(off, { recorded: 0, advisories: 0, reason: "disabled" });
  assert.equal(await advisories.read({ bookId: BOOK, chapterId: `${BOOK}-ch01` }), null);

  const noStore = await recordReviewAdvisories({
    env: ON, bookId: BOOK, reviewId: "review-1", issues, candidate: candidate(1),
  });
  assert.deepEqual(noStore, { recorded: 0, advisories: 0, reason: "no-store" });
});

requiredTest("A5 with the flag on, a chapter's advisories are stored and a chapter that no longer has any is cleared", async (context) => {
  const { store: advisories } = store(context, "record");
  const first = await recordReviewAdvisories({
    store: advisories,
    env: ON,
    bookId: BOOK,
    reviewId: "review-pass-1",
    issues: [
      issue("READER.CHURN", "WARN", "ch01 repeats the same specific in every tier.", "ch01"),
      issue("READER.CARD", "WARN", "ch02 card backs announce their own angle.", "ch02"),
    ],
    candidate: candidate(2),
  });
  assert.deepEqual(first, { recorded: 2, advisories: 2, reason: "recorded" });
  const stored = await advisories.read({ bookId: BOOK, chapterId: `${BOOK}-ch01` });
  assert.ok(stored);
  assert.equal(stored.reviewId, "review-pass-1");
  assert.deepEqual(stored.entries, [{ code: "READER.CHURN", message: "ch01 repeats the same specific in every tier." }]);

  // A later panel that no longer flags ch02 must not leave the old judgement
  // standing for the next compile's editor to act on.
  const second = await recordReviewAdvisories({
    store: advisories,
    env: ON,
    bookId: BOOK,
    reviewId: "review-pass-2",
    issues: [issue("READER.CHURN", "WARN", "ch01 still repeats itself.", "ch01")],
    candidate: candidate(2),
  });
  assert.deepEqual(second, { recorded: 1, advisories: 1, reason: "recorded" });
  assert.equal(await advisories.read({ bookId: BOOK, chapterId: `${BOOK}-ch02` }), null);
  assert.equal(
    (await advisories.read({ bookId: BOOK, chapterId: `${BOOK}-ch01` }))?.entries[0].message,
    "ch01 still repeats itself.",
  );
});

requiredTest("A6 a store failure is swallowed: recording can never fail a passing book", async () => {
  const failing: ReviewAdvisoryStore = {
    async read() { throw new Error("read exploded"); },
    async write() { throw new Error("write exploded"); },
    async clear() { throw new Error("clear exploded"); },
  };
  const result = await recordReviewAdvisories({
    store: failing,
    env: ON,
    bookId: BOOK,
    reviewId: "review-1",
    issues: [issue("READER.CHURN", "WARN", "ch01 repeats itself.", "ch01")],
    candidate: candidate(1),
  });
  assert.deepEqual(result, { recorded: 0, advisories: 0, reason: "none" });
});

requiredTest("A7 the release sidecar summarizes an edit-provenance file, and believes nothing else", () => {
  const file = {
    schemaVersion: CHAPTER_EDIT_PROVENANCE_SCHEMA_VERSION,
    bookId: BOOK,
    runId: "run-9",
    attempts: 7,
    chapters: [
      { chapterNumber: 1, chapterId: "a", status: "EDITED", replayed: false, attemptIds: ["x"], blockers: [], advisory: { applied: true, reviewId: "r", count: 2 } },
      { chapterNumber: 2, chapterId: "b", status: "SKIPPED", replayed: false, attemptIds: ["y"], blockers: ["SEC3"], advisory: { applied: false, reviewId: null, count: 0 } },
      { chapterNumber: 3, chapterId: "c", status: "REVERTED", replayed: false, attemptIds: ["z"], blockers: ["assembly"], advisory: { applied: false, reviewId: null, count: 0 } },
      { chapterNumber: 4, chapterId: "d", status: "ERROR", replayed: false, attemptIds: [], blockers: ["socket hang up"], advisory: { applied: false, reviewId: null, count: 0 } },
      { chapterNumber: 5, chapterId: "e", status: "DISABLED", replayed: false, attemptIds: [], blockers: [], advisory: { applied: false, reviewId: null, count: 0 } },
    ],
  };
  assert.deepEqual(summarizeChapterEditProvenance(Buffer.from(JSON.stringify(file))), {
    runId: "run-9",
    attempts: 7,
    edited: 1,
    skipped: 1,
    reverted: 1,
    error: 1,
    disabled: 1,
    advisoryApplied: true,
  });

  assert.equal(summarizeChapterEditProvenance(undefined), undefined, "no file, no block");
  assert.equal(summarizeChapterEditProvenance(Buffer.from("not json")), undefined);
  assert.equal(
    summarizeChapterEditProvenance(Buffer.from(JSON.stringify({ ...file, schemaVersion: "chapter-edit-provenance-v0" }))),
    undefined,
    "a schema this build does not write is not partially believed",
  );
  assert.equal(
    summarizeChapterEditProvenance(Buffer.from(JSON.stringify({
      ...file,
      chapters: [{ chapterNumber: 1, chapterId: "a", status: "IMPROVED" }],
    }))),
    undefined,
    "an unknown status is not counted as anything",
  );
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
