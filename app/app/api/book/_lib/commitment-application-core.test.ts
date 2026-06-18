import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveChapterApplicationState,
  reduceBookApplicationStates,
  toChapterIdKeyedApplicationStates,
  aggregateBookApplicationStates,
} from "./commitment-application-core";
import type {
  BookUserCommitmentItem,
  CommitmentStatus,
  CommitmentOutcome,
} from "./types";

/**
 * Two-axis completion (feedback #4) — the APPLICATION axis.
 *
 * These guard the DERIVED, read-only application state: it must be computed from the
 * FULL unfiltered commitment list, must be outcome-independent (helped/partly/didnt
 * all count as `applied`), and must take precedence by status-strength
 * (applied > committed > none), NOT recency. The aggregator must hit the lister
 * exactly once per book read (no N+1 per chapter).
 */

let seq = 0;
function mk(
  overrides: Partial<BookUserCommitmentItem> & {
    bookId: string;
    chapterNumber: number;
    status: CommitmentStatus;
  },
): BookUserCommitmentItem {
  seq += 1;
  return {
    userId: "u1",
    commitmentId: `c${seq}`,
    ifThenPlan: "If X then Y",
    commitDate: "2026-06-01T00:00:00.000Z",
    followUpDate: "2026-06-04T00:00:00.000Z",
    followUpDays: 3,
    followThroughReflection: null,
    followThroughSubmittedAt: null,
    outcome: null,
    ipAwarded: 0,
    notificationSentAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const B = "bookA";

// ── deriveChapterApplicationState ────────────────────────────────────────────

test("derive: none when no commitments", () => {
  assert.equal(deriveChapterApplicationState([], B, 1), "none");
});

test("derive: none when only skipped or expired", () => {
  const list = [
    mk({ bookId: B, chapterNumber: 1, status: "skipped" }),
    mk({ bookId: B, chapterNumber: 1, status: "expired" }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "none");
});

test("derive: committed for a single active", () => {
  const list = [mk({ bookId: B, chapterNumber: 1, status: "active" })];
  assert.equal(deriveChapterApplicationState(list, B, 1), "committed");
});

test("derive: an overdue-but-not-expired active still counts as committed", () => {
  // The repo flips truly-expired actives to "expired" before this runs; an active
  // that is merely past its follow-up date (within grace) arrives here as "active".
  const list = [
    mk({
      bookId: B,
      chapterNumber: 1,
      status: "active",
      followUpDate: "2020-01-01T00:00:00.000Z",
    }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "committed");
});

test("derive: applied when completed + followThroughSubmittedAt", () => {
  const list = [
    mk({
      bookId: B,
      chapterNumber: 1,
      status: "completed",
      followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
    }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "applied");
});

test("derive: completed WITHOUT followThroughSubmittedAt is NOT applied", () => {
  const list = [
    mk({
      bookId: B,
      chapterNumber: 1,
      status: "completed",
      followThroughSubmittedAt: null,
    }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "none");
});

test("derive: precedence applied > committed (active + completed → applied)", () => {
  const list = [
    mk({ bookId: B, chapterNumber: 1, status: "active" }),
    mk({
      bookId: B,
      chapterNumber: 1,
      status: "completed",
      followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
    }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "applied");
});

test("derive: status-strength beats recency (older completed + newer active → applied)", () => {
  const list = [
    mk({
      bookId: B,
      chapterNumber: 1,
      status: "completed",
      followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
      createdAt: "2026-06-01T00:00:00.000Z",
    }),
    mk({
      bookId: B,
      chapterNumber: 1,
      status: "active",
      createdAt: "2026-06-10T00:00:00.000Z",
    }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "applied");
});

test("derive: skipped then active → committed", () => {
  const list = [
    mk({ bookId: B, chapterNumber: 1, status: "skipped" }),
    mk({ bookId: B, chapterNumber: 1, status: "active" }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "committed");
});

test("derive: outcome is irrelevant — undefined/null/'didnt'/'partly'/'helped' all → applied", () => {
  const outcomes: Array<CommitmentOutcome | null | undefined> = [
    undefined,
    null,
    "didnt",
    "partly",
    "helped",
  ];
  for (const outcome of outcomes) {
    const list = [
      mk({
        bookId: B,
        chapterNumber: 1,
        status: "completed",
        followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
        outcome,
      }),
    ];
    assert.equal(
      deriveChapterApplicationState(list, B, 1),
      "applied",
      `outcome=${String(outcome)}`,
    );
  }
});

test("derive: wrong book/chapter excluded", () => {
  const list = [
    mk({
      bookId: "otherBook",
      chapterNumber: 1,
      status: "completed",
      followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
    }),
    mk({
      bookId: B,
      chapterNumber: 99,
      status: "completed",
      followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
    }),
  ];
  assert.equal(deriveChapterApplicationState(list, B, 1), "none");
});

// ── reduceBookApplicationStates (sparse map) ─────────────────────────────────

test("reduce: sparse map omits 'none' chapters and other books", () => {
  const list = [
    mk({ bookId: B, chapterNumber: 1, status: "active" }), // committed
    mk({
      bookId: B,
      chapterNumber: 2,
      status: "completed",
      followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
    }), // applied
    mk({ bookId: B, chapterNumber: 3, status: "skipped" }), // none → omitted
    mk({ bookId: "otherBook", chapterNumber: 4, status: "active" }), // other book
  ];
  const map = reduceBookApplicationStates(list, B);
  assert.deepEqual(map, { 1: "committed", 2: "applied" });
});

test("reduce: empty list → empty map", () => {
  assert.deepEqual(reduceBookApplicationStates([], B), {});
});

// ── toChapterIdKeyedApplicationStates ────────────────────────────────────────

test("remap: chapterNumber → chapterId, drops numbers not in the manifest map", () => {
  const byNumber = {
    1: "committed" as const,
    2: "applied" as const,
    5: "applied" as const,
  };
  const ids = new Map<number, string>([
    [1, "bookA:ch1"],
    [2, "bookA:ch2"],
    // 5 intentionally absent
  ]);
  assert.deepEqual(toChapterIdKeyedApplicationStates(byNumber, ids), {
    "bookA:ch1": "committed",
    "bookA:ch2": "applied",
  });
});

test("remap: empty → empty (graceful degradation, the {} read)", () => {
  assert.deepEqual(toChapterIdKeyedApplicationStates({}, new Map()), {});
});

// ── aggregateBookApplicationStates (one query per book, no N+1) ──────────────

test("aggregator: exactly ONE lister call, no status filter", async () => {
  const calls: Array<unknown[]> = [];
  const fakeLister = async (...args: unknown[]) => {
    calls.push(args);
    return [
      mk({ bookId: B, chapterNumber: 1, status: "active" }),
      mk({
        bookId: B,
        chapterNumber: 2,
        status: "completed",
        followThroughSubmittedAt: "2026-06-05T00:00:00.000Z",
      }),
      mk({ bookId: "otherBook", chapterNumber: 1, status: "active" }),
    ] as BookUserCommitmentItem[];
  };

  const map = await aggregateBookApplicationStates(fakeLister, "table", "u1", B);

  assert.equal(calls.length, 1, "lister must be called exactly once per book");
  assert.deepEqual(calls[0], ["table", "u1"], "called with no status filter");
  assert.deepEqual(map, { 1: "committed", 2: "applied" });
});
