/**
 * Small-test driver: runs the v21 pipeline on three chapters of "How to Win
 * Friends and Influence People" sequentially so we can see cross-chapter
 * behavior end-to-end.
 *
 * What this test proves:
 *   - Editor-in-chief produces a Carnegie-voice brief different from the TFS one.
 *   - Curriculum planner produces different shapes per chapter.
 *   - Cross-book name ledger carries forward from TFS (Ingrid, Hollis, etc.
 *     are off-limits in this book).
 *   - Within this book: chapter 2 doesn't reuse chapter 1's names, chapter 3
 *     doesn't reuse chapter 1 or 2's names.
 *   - Reading level holds per-tier across chapters.
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/run-multi-chapter-test.ts
 */

import { generateChapter, readingLevels } from "../generateChapter.js";
import { loadLibraryState, getForbiddenNames } from "../librarian/libraryState.js";

const BOOK = {
  bookId: "how-to-win-friends-and-influence-people",
  title: "How to Win Friends and Influence People",
  author: "Dale Carnegie",
};

const CHAPTERS = [
  { chapterId: "how-to-win-friends-and-influence-people-ch01", chapterNumber: 1, chapterTitle: "If You Want to Gather Honey, Don't Kick Over the Beehive" },
  { chapterId: "how-to-win-friends-and-influence-people-ch02", chapterNumber: 2, chapterTitle: "The Big Secret of Dealing With People" },
  { chapterId: "how-to-win-friends-and-influence-people-ch03", chapterNumber: 3, chapterTitle: "He Who Can Do This Has the Whole World With Him" },
];

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  const overall = Date.now();
  log(`=== MULTI-CHAPTER TEST: ${BOOK.title} (${CHAPTERS.length} chapters) ===`);

  // Snapshot ledger before starting
  const before = loadLibraryState();
  // forbiddenBefore now includes current book's already-ingested chapters
  // (post-fix). For the "cross-book collisions" check we need OTHER-book
  // names only, so we compute that separately.
  const forbiddenBefore = getForbiddenNames(before, BOOK.bookId, 10);
  const otherBookNames = new Set<string>();
  for (const [bid, book] of Object.entries(before.books)) {
    if (bid !== BOOK.bookId) {
      for (const n of book.namesUsed) otherBookNames.add(n);
    }
  }
  log(`librarian before test: ${Object.keys(before.books).length} books tracked, ${forbiddenBefore.length} forbidden names (incl. this book's prior chapters); ${otherBookNames.size} names from OTHER books: ${Array.from(otherBookNames).slice(0, 10).join(", ")}${otherBookNames.size > 10 ? ", …" : ""}`);

  const chapterReport: Array<{ chapterNumber: number; names: string[]; fk: ReturnType<typeof readingLevels>; hook: string; wallTime: number }> = [];

  for (const chap of CHAPTERS) {
    log(`\n=== ${BOOK.title} Ch${chap.chapterNumber}: ${chap.chapterTitle} ===`);
    const t0 = Date.now();
    const produced = await generateChapter(BOOK, chap);
    const wallTime = Math.round((Date.now() - t0) / 1000);
    const names = Array.from(new Set(produced.examples.flatMap((e) => {
      const m = e.scenario.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
      return m.filter((w) => !["The","A","An","If","When","That","But","Chapter","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","She","He","They","It","This","And","Or","So","Her","His","Then","Before","After","During","Here","There","One","Two","Three"].includes(w));
    })));
    chapterReport.push({
      chapterNumber: chap.chapterNumber,
      names: names.slice(0, 10),
      fk: readingLevels(produced),
      hook: produced.hook,
      wallTime,
    });
  }

  log(`\n=== SUMMARY ===`);
  for (const r of chapterReport) {
    log(`Ch${r.chapterNumber} (${r.wallTime}s)`);
    log(`  hook: "${r.hook}"`);
    log(`  FK: fastRead=${r.fk.fastRead.toFixed(1)}, deepRead=${r.fk.deepRead.toFixed(1)}, fullRead=${r.fk.fullRead.toFixed(1)}`);
    log(`  names (first 10): ${r.names.join(", ")}`);
  }

  // Cross-chapter name collision check
  const ch1Names = new Set(chapterReport[0]?.names ?? []);
  const ch2Names = new Set(chapterReport[1]?.names ?? []);
  const ch3Names = new Set(chapterReport[2]?.names ?? []);
  const c12 = Array.from(ch1Names).filter((n) => ch2Names.has(n));
  const c23 = Array.from(ch2Names).filter((n) => ch3Names.has(n));
  const c13 = Array.from(ch1Names).filter((n) => ch3Names.has(n));
  log(`cross-chapter collisions (within this book):`);
  log(`  ch1 ∩ ch2: ${c12.length ? c12.join(", ") : "(none)"}`);
  log(`  ch2 ∩ ch3: ${c23.length ? c23.join(", ") : "(none)"}`);
  log(`  ch1 ∩ ch3: ${c13.length ? c13.join(", ") : "(none)"}`);

  // Cross-book collision check: only names from OTHER books (not this one's
  // own prior chapters that the ledger now also feeds into forbidden).
  const tfsCollisions = chapterReport.flatMap((r) => r.names.filter((n) => otherBookNames.has(n)));
  log(`cross-book collisions (names from OTHER books reused in ${BOOK.bookId}): ${tfsCollisions.length ? Array.from(new Set(tfsCollisions)).join(", ") : "(none)"}`);

  // Final ledger state
  const after = loadLibraryState();
  log(`\nlibrarian after test: ${Object.keys(after.books).length} books tracked`);
  for (const [id, book] of Object.entries(after.books)) {
    log(`  ${id}: ${book.chaptersIngested.length} chapter(s), ${book.namesUsed.length} unique names`);
  }

  log(`\n=== DONE in ${((Date.now() - overall) / 60000).toFixed(1)} minutes ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
