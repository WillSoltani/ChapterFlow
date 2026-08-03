/**
 * WS4-009 — Notebook serial-read pagination regression (integration).
 *
 * Harness: drives the REAL repo modules against DynamoDB Local — modeled
 * exactly on journey.itest.ts. Seeds one user with enough CHAPTERSTATE# and
 * HIGHLIGHT# rows (each padded with a ~4KB filler payload) that a single
 * DynamoDB Query page (1MB) cannot hold them all, then asserts the three
 * Notebook read fns (`queryChapterStatesForNotebook`,
 * `queryCommitmentItemsForNotebook`, `listHighlights`) each return the FULL
 * seeded count — proving they follow `LastEvaluatedKey` to completion rather
 * than silently truncating at the first page.
 *
 * `.itest.ts` suffix so the `*.test.ts` glob (`npm test`) does NOT pick it up;
 * run via `npm run test:integration` (DynamoDB Local service container in CI).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";
import {
  makeAdminClient,
  createBookTable,
  dropTableIfExists,
  assertLoopbackEndpoint,
} from "@/tests/_lib/dynamo-local";

// ── Env MUST be set before importing any module that constructs an AWS client ──
// Always a table of our own: the CI job exports BOOK_TABLE_NAME for the whole
// integration job, and journey.itest.ts creates/drops that shared name — honoring
// it here races both suites' before/after on one table. tsx --test runs each
// file in its own process, so overriding the env stays local to this file.
const TABLE_NAME = "ChapterFlowApp-notebook-itest";
process.env.BOOK_TABLE_NAME = TABLE_NAME;
process.env.AWS_REGION ||= "us-east-1";
process.env.AWS_ENDPOINT_URL_DYNAMODB ||= "http://127.0.0.1:8000";
process.env.AWS_ACCESS_KEY_ID ||= "dummy";
process.env.AWS_SECRET_ACCESS_KEY ||= "dummy";

type BookStateRepoModule = typeof import("./book-state-repo");
type CommitmentRepoModule = typeof import("./commitment-repo");
type NotebookHighlightRepoModule = typeof import("./notebook-highlight-repo");

let bookStateRepo: BookStateRepoModule;
let commitmentRepo: CommitmentRepoModule;
let notebookHighlightRepo: NotebookHighlightRepoModule;

const adminClient = makeAdminClient();

before(async () => {
  assertLoopbackEndpoint();
  await createBookTable(adminClient, TABLE_NAME);

  const restore = installServerOnlyShim();
  bookStateRepo = await import("./book-state-repo");
  commitmentRepo = await import("./commitment-repo");
  notebookHighlightRepo = await import("./notebook-highlight-repo");
  restore();
});

after(async () => {
  await dropTableIfExists(adminClient, TABLE_NAME);
  adminClient.destroy();
});

const BOOK_ID = "atomic-habits";
const ITEM_COUNT = 350; // ~350 * ~4KB filler > 1MB (one Query page's cap)
const FILLER = "x".repeat(4000);

function isoNow(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

test("notebook reads return complete results past one 1MB Query page", async () => {
  const userId = "notebook-pagination-user";

  // Seed CHAPTERSTATE# rows: one per chapter number, each padded past 4KB.
  for (let i = 1; i <= ITEM_COUNT; i++) {
    await bookStateRepo.putUserChapterState(TABLE_NAME, {
      userId,
      bookId: BOOK_ID,
      chapterNumber: i,
      chapterId: `${BOOK_ID}-ch${i}`,
      state: { notes: [{ id: `n${i}`, text: FILLER }] },
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  // Seed HIGHLIGHT# rows, each padded past 4KB via the snippet field.
  for (let i = 1; i <= ITEM_COUNT; i++) {
    await notebookHighlightRepo.createHighlight(TABLE_NAME, {
      userId,
      highlightId: `hl-${i}`,
      bookId: BOOK_ID,
      bookTitle: "Atomic Habits",
      chapterNumber: 1,
      chapterTitle: "Chapter 1",
      color: "yellow",
      snippet: FILLER,
      anchor: {
        variant: "text",
        tone: "default",
        blockIndex: 0,
        blockType: "paragraph",
        startChar: 0,
        endChar: 10,
      },
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  // A handful of commitments — this partition doesn't need to exceed one
  // page to prove the fn is wired into the concurrent fan-out, but the loop
  // itself must still follow LastEvaluatedKey for parity with the other two.
  const COMMITMENT_COUNT = 3;
  for (let i = 1; i <= COMMITMENT_COUNT; i++) {
    await commitmentRepo.createCommitment(TABLE_NAME, {
      userId,
      commitmentId: `commit-${i}`,
      bookId: BOOK_ID,
      chapterNumber: 1,
      ifThenPlan: `If cue ${i}, then habit ${i}`,
      commitDate: isoNow(),
      followUpDate: isoNow(3 * 86400000),
      followUpDays: 3,
      status: "active",
      followThroughReflection: null,
      followThroughSubmittedAt: null,
      ipAwarded: 0,
      notificationSentAt: null,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    });
  }

  const [chapterStates, commitments, highlights] = await Promise.all([
    bookStateRepo.queryChapterStatesForNotebook(TABLE_NAME, userId),
    commitmentRepo.queryCommitmentItemsForNotebook(TABLE_NAME, userId),
    notebookHighlightRepo.listHighlights(TABLE_NAME, userId),
  ]);

  assert.equal(
    chapterStates.length,
    ITEM_COUNT,
    `expected all ${ITEM_COUNT} seeded chapter-state rows, got ${chapterStates.length} (truncated at a 1MB page?)`,
  );
  assert.equal(
    highlights.length,
    ITEM_COUNT,
    `expected all ${ITEM_COUNT} seeded highlight rows, got ${highlights.length} (truncated at a 1MB page?)`,
  );
  assert.equal(commitments.length, COMMITMENT_COUNT);
});
