/**
 * Library state — persistent JSON ledger that tracks what has been generated
 * across every book in the library. The sole purpose is to enforce cross-book
 * uniqueness: names, phrases, answer-position balance.
 *
 * Stored at state/library-state.json. Loaded at the start of each run,
 * updated after each chapter is assembled, saved back atomically.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, "../../state");
const LEDGER_PATH = resolve(STATE_DIR, "library-state.json");

export type BookLedgerEntry = {
  bookId: string;
  title: string;
  author: string;
  generatedAt: string;
  chapterCount: number;
  chaptersIngested: number[];     // chapter numbers ingested so far
  namesUsed: string[];             // protagonists that appeared in examples
  phrasesFlagged: Record<string, number>;  // soft-banned phrases seen, per-book count
  answerPositionCounts: [number, number, number];  // total across all quiz questions
};

export type LibraryState = {
  version: "1.0.0";
  lastUpdatedAt: string;
  books: Record<string, BookLedgerEntry>;
  // Derived totals (kept in sync by update operations)
  globalNameUsage: Record<string, { books: string[]; total: number }>;
  globalPhraseUsage: Record<string, { books: string[]; total: number }>;
  globalAnswerPositionCounts: [number, number, number];
};

const NAME_STOPWORDS = new Set([
  "The","A","An","If","When","That","But","Chapter","Monday","Tuesday","Wednesday",
  "Thursday","Friday","Saturday","Sunday","She","He","They","It","This","And","Or",
  "So","Her","His","Then","Because","Before","After","While","Once","During","Without",
  "Within","Even","Only","Often","Now","Whenever","Here","There","Judge","Dr",
  "Morning","Evening","Today","Tomorrow","Yesterday",
  // Pronouns that can appear at sentence start with capital letter
  "You","Your","Yours","We","Us","Our","Ours","My","Mine","Their","Theirs",
  "I","Me","Myself","Yourself","Ourselves","Themselves","Himself","Herself","Itself",
  "Him","Them","Who","Whom","Whose","Which","What",
  "One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
  "Both","Neither","Either","Each","Every","Some","Another","Other",
  "Bed","Room","Desk","Office","Floor","Table","Counter","Kitchen","Lab",
  "Rereading","Reading","Looking","Walking","Sitting","Standing",
  "Reject","Accept","Call","Ask","Start","Stop","Wait","Keep","Pull","Push",
  "Yes","No","Okay","Maybe","Actually","Really","Truly","Simply","Perhaps",
  "Hospital","School","Court","Dept","Department","Team","Board","Committee",
  "Weber","Finzi","Mozart","Bach","Beethoven","Brahms","Stravinsky","Ravel",
  "Garamond","Helvetica","Arial","Times","Courier",
  "EMR","MAR","NIH","EU","USA","UK","CEO","VP","PM","HR","IT","EU",
  // Capitalized verbs/nouns that leak in from title-case sentences
  "Finish","Proposal","Civic","Excerpt","Swallows","Drafts","Hands","Replays",
  "Weighs","Called","Listens","Finishes","Meets","Thanks","Reads","Writes",
  "Tastes","Tosses","Rereading","Has","Heard","Too","Been","Made",
  // Honorifics without a following name shouldn't count as names
  "Mr","Mrs","Ms","Mx","Sir","Madam",
]);

// The model-voice phrases we watch for in generated content. This is a small
// curated list; the per-chapter critic has a larger banned list in config/.
const TRACKED_PHRASES = [
  "I fall for it",
  "the effect is real and the effect is modest",
  "I am reporting a tendency",
  "the feeling is not evidence",
  "ease disarms",
  "difficulty alerts",
  "neither do I",
  "knowing is not the same as",
];

function emptyState(): LibraryState {
  return {
    version: "1.0.0",
    lastUpdatedAt: new Date().toISOString(),
    books: {},
    globalNameUsage: {},
    globalPhraseUsage: {},
    globalAnswerPositionCounts: [0, 0, 0],
  };
}

export function loadLibraryState(): LibraryState {
  if (!existsSync(LEDGER_PATH)) return emptyState();
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as LibraryState;
  } catch (err) {
    throw new Error(`Could not parse library state at ${LEDGER_PATH}: ${(err as Error).message}`);
  }
}

const LOCK_PATH = `${LEDGER_PATH}.lock`;
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_POLL_MS = 50;

/** Acquire a simple advisory file-lock. Used to serialize library state
 *  writes when multiple book runs execute concurrently. The lock is best-
 *  effort (NFS / case-insensitive FS edge cases not handled). */
async function acquireLock(): Promise<void> {
  const { writeFileSync, existsSync } = await import("fs");
  const start = Date.now();
  while (existsSync(LOCK_PATH)) {
    if (Date.now() - start > LOCK_TIMEOUT_MS) {
      // If the lock is older than the timeout, assume the holder crashed
      // and steal it. This is the only race we accept.
      try {
        const { unlinkSync } = await import("fs");
        unlinkSync(LOCK_PATH);
        break;
      } catch {
        throw new Error(`library state lock at ${LOCK_PATH} timed out and could not be cleared`);
      }
    }
    await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
  }
  writeFileSync(LOCK_PATH, `${process.pid}\n${new Date().toISOString()}`, "utf8");
}

function releaseLock(): void {
  try {
    const { unlinkSync, existsSync } = require("fs");
    if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH);
  } catch {
    // best-effort
  }
}

export async function saveLibraryState(state: LibraryState): Promise<void> {
  mkdirSync(STATE_DIR, { recursive: true });
  await acquireLock();
  try {
    state.lastUpdatedAt = new Date().toISOString();
    const tmp = `${LEDGER_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    renameSync(tmp, LEDGER_PATH);
  } finally {
    releaseLock();
  }
}

/** Synchronous variant kept for places that haven't been awaited. New code
 *  should call the async version. */
export function saveLibraryStateSync(state: LibraryState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  state.lastUpdatedAt = new Date().toISOString();
  const tmp = `${LEDGER_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, LEDGER_PATH);
}

/** Extract plausible protagonist names from a scenario text. */
export function extractNamesFromText(text: string): string[] {
  const matches = Array.from(text.matchAll(/\b[A-Z][a-z]{2,}\b/g)).map((m) => m[0]);
  return matches.filter((w) => !NAME_STOPWORDS.has(w));
}

/** Ingest a single chapter into the ledger. Updates both the book's entry and
 *  the global counters. Idempotent per (bookId, chapterNumber): calling twice
 *  with the same chapter does not double-count. */
export function ingestChapter(
  state: LibraryState,
  bookId: string,
  title: string,
  author: string,
  chapter: ChapterV21,
): LibraryState {
  // Load or create book entry
  let book = state.books[bookId];
  if (!book) {
    book = {
      bookId,
      title,
      author,
      generatedAt: new Date().toISOString(),
      chapterCount: 0,
      chaptersIngested: [],
      namesUsed: [],
      phrasesFlagged: {},
      answerPositionCounts: [0, 0, 0],
    };
    state.books[bookId] = book;
  }
  // Idempotency guard
  if (book.chaptersIngested.includes(chapter.number)) return state;
  book.chaptersIngested.push(chapter.number);
  book.chapterCount = Math.max(book.chapterCount, chapter.number);

  // Names from examples — scenarios only, not titles. Titles use title-case
  // and would add noise words like "Weighs", "Has", "Heard".
  const newNames = new Set<string>();
  for (const ex of chapter.examples) {
    for (const n of extractNamesFromText(ex.scenario)) newNames.add(n);
  }
  for (const n of newNames) {
    if (!book.namesUsed.includes(n)) book.namesUsed.push(n);
    if (!state.globalNameUsage[n]) {
      state.globalNameUsage[n] = { books: [], total: 0 };
    }
    if (!state.globalNameUsage[n].books.includes(bookId)) {
      state.globalNameUsage[n].books.push(bookId);
    }
    state.globalNameUsage[n].total += 1;
  }

  // Tracked phrases across all free-text fields
  const allText = [
    chapter.hook,
    chapter.counterintuition ?? "",
    chapter.keyTakeaway,
    chapter.breakdown.fastRead,
    chapter.breakdown.deepRead,
    chapter.breakdown.fullRead,
    ...chapter.examples.flatMap((e) => [e.scenario, e.whatToDo, e.whyItMatters]),
    ...chapter.quiz.questions.flatMap((q) => [q.prompt, q.explanation, ...q.choices]),
    ...chapter.reviewCards.flatMap((c) => [c.front, c.back]),
  ].join(" \n ").toLowerCase();
  for (const phrase of TRACKED_PHRASES) {
    const re = new RegExp(phrase.toLowerCase().replace(/[^a-z0-9 ]/g, "\\$&"), "g");
    const count = (allText.match(re) ?? []).length;
    if (count > 0) {
      book.phrasesFlagged[phrase] = (book.phrasesFlagged[phrase] ?? 0) + count;
      if (!state.globalPhraseUsage[phrase]) state.globalPhraseUsage[phrase] = { books: [], total: 0 };
      if (!state.globalPhraseUsage[phrase].books.includes(bookId)) state.globalPhraseUsage[phrase].books.push(bookId);
      state.globalPhraseUsage[phrase].total += count;
    }
  }

  // Answer-position counters
  for (const q of chapter.quiz.questions) {
    const idx = q.correctIndex;
    if (idx === 0 || idx === 1 || idx === 2) {
      book.answerPositionCounts[idx] += 1;
      state.globalAnswerPositionCounts[idx] += 1;
    }
  }

  return state;
}

/** Names the writer must not reuse. Includes:
 *   - Names used in the N most-recently-ingested OTHER books (cross-book uniqueness)
 *   - Names already used in the CURRENT book's ingested chapters (within-book uniqueness)
 *
 *  Calling this mid-book means chapter N sees chapters 1..N-1's names as
 *  off-limits automatically, without the driver having to thread state by hand. */
export function getForbiddenNames(
  state: LibraryState,
  currentBookId: string,
  lookback: number = 10,
): string[] {
  const otherBooks = Object.values(state.books)
    .filter((b) => b.bookId !== currentBookId)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, lookback);
  const names = new Set<string>();
  for (const book of otherBooks) {
    for (const n of book.namesUsed) names.add(n);
  }
  // Also exclude names already used in the current book's prior chapters.
  const currentBook = state.books[currentBookId];
  if (currentBook) {
    for (const n of currentBook.namesUsed) names.add(n);
  }
  return Array.from(names).sort();
}

export function getLedgerPath(): string {
  return LEDGER_PATH;
}
