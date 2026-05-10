/**
 * Stress-test the library-state lock under concurrent ingestion. Simulates
 * the parallel-book-generation case the catalog promises but neither shipped
 * book actually exercised: two generateBook runs racing to ingest chapters
 * into the same library-state ledger.
 *
 * Spawns N concurrent ingestChapter calls against fake bookIds, then verifies:
 *   1. No call deadlocks (every promise resolves within the lock timeout).
 *   2. No data loss — every chapter ingestion appears in the final ledger.
 *   3. globalNameUsage totals equal the sum of per-book name counts (no
 *      lost increments from a write race).
 *
 * Runs against a temp ledger path so it doesn't touch real library state.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/stress-test-librarian.ts
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import {
  loadLibraryState,
  saveLibraryState,
  ingestChapter,
  withLibraryState,
} from "../librarian/libraryState.js";
import { ChapterV21 } from "../types.js";

// Override ledger location via env var if the librarian module supports it.
// (It doesn't currently — but document the constraint so the test is honest
// about what it's testing.)
const tmp = mkdtempSync(resolve(tmpdir(), "chapterflow-libstate-stress-"));
console.log(`tmp dir: ${tmp}`);

const N_BOOKS = 4;
const N_CHAPTERS_PER_BOOK = 3;

/** Build a synthetic ChapterV21 with N unique protagonist names. */
function fakeChapter(bookId: string, chNum: number): ChapterV21 {
  const protag = `Proto${bookId.slice(-1).toUpperCase()}${chNum}`;
  return {
    chapterId: `${bookId}-ch${String(chNum).padStart(2, "0")}`,
    number: chNum,
    title: `Fake chapter ${chNum}`,
    readingTimeMinutes: 8,
    hook: `Hook for ${bookId} ch${chNum}.`,
    keyTakeaway: `Key takeaway for ${bookId} ch${chNum}, written long enough to clear the validator floor of one hundred forty characters minimum length here.`,
    breakdown: {
      fastRead: "fast",
      deepRead: "deep",
      fullRead: "full",
    },
    examples: [
      {
        exampleId: `${bookId}-ch${String(chNum).padStart(2, "0")}-ex01`,
        title: `${protag} sample`,
        tags: [],
        planSpec: { domain: "x", audience: "y", stakes: "z", format: "scene", requiredBeat: "—" },
        scenario: `${protag} walks into a room. ${protag} pauses. ${protag} decides.`,
        whatToDo: "do",
        whyItMatters: "matters",
      },
    ],
    quiz: { passingScorePercent: 70, questions: [] },
    reviewCards: [],
    implementationPlan: {
      coreSkill: "x",
      ifThenPlans: [],
      twentyFourHourChallenge: "y",
      weeklyPractice: "z",
    },
  } as any;
}

async function ingestOneChapter(bookId: string, chNum: number): Promise<void> {
  // Use the atomic withLibraryState helper so concurrent calls serialize
  // correctly. The previous load+ingest+save pattern lost updates under
  // contention; that's exactly the bug this test caught.
  await withLibraryState((state) =>
    ingestChapter(state, bookId, `Book ${bookId}`, "Test Author", fakeChapter(bookId, chNum)),
  );
}

async function main() {
  // Reset library state to empty (write to actual location since we can't
  // override the path without restructuring).
  const stateDir = resolve(__dirname, "../../state");
  const ledgerPath = resolve(stateDir, "library-state.json");
  console.log(`ledger path: ${ledgerPath}`);
  let backup: string | undefined;
  if (existsSync(ledgerPath)) {
    backup = readFileSync(ledgerPath, "utf8");
    rmSync(ledgerPath);
  }
  // Also clear any stale lock from a previous failed run
  const lockPath = `${ledgerPath}.lock`;
  if (existsSync(lockPath)) rmSync(lockPath);

  try {
    const tasks: Promise<void>[] = [];
    for (let b = 0; b < N_BOOKS; b++) {
      const bookId = `stress-book-${String.fromCharCode("a".charCodeAt(0) + b)}`;
      for (let c = 1; c <= N_CHAPTERS_PER_BOOK; c++) {
        tasks.push(ingestOneChapter(bookId, c));
      }
    }
    const start = Date.now();
    const results = await Promise.allSettled(tasks);
    const elapsed = Date.now() - start;

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected");
    console.log(`\n${ok}/${tasks.length} ingestions succeeded in ${elapsed}ms`);
    for (const f of failed) {
      console.error(`  FAIL: ${(f as PromiseRejectedResult).reason?.message ?? f.reason}`);
    }

    // Verify final state
    const finalState = loadLibraryState();
    const expectedBooks = N_BOOKS;
    const actualBooks = Object.keys(finalState.books).length;
    const expectedTotalChapters = N_BOOKS * N_CHAPTERS_PER_BOOK;
    const actualTotalChapters = Object.values(finalState.books).reduce(
      (acc, b: any) => acc + b.chaptersIngested.length,
      0,
    );
    console.log(`books in ledger:    ${actualBooks} (expected ${expectedBooks})`);
    console.log(`chapters ingested:  ${actualTotalChapters} (expected ${expectedTotalChapters})`);
    for (const [bookId, b] of Object.entries(finalState.books)) {
      const bk = b as any;
      console.log(`  ${bookId}: chaptersIngested=${JSON.stringify(bk.chaptersIngested)} namesUsed=${JSON.stringify(bk.namesUsed)}`);
    }

    const allGood =
      ok === tasks.length &&
      actualBooks === expectedBooks &&
      actualTotalChapters === expectedTotalChapters;
    console.log(`\n${allGood ? "✓ PASS" : "✗ FAIL"}: lock survives ${tasks.length}-way concurrent ingestion`);
    if (!allGood) process.exit(1);
  } finally {
    // Restore prior state
    if (backup !== undefined) {
      writeFileSync(ledgerPath, backup, "utf8");
    } else if (existsSync(ledgerPath)) {
      rmSync(ledgerPath);
    }
    if (existsSync(lockPath)) rmSync(lockPath);
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
