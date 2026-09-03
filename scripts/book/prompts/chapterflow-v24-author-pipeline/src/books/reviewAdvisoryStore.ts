import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { replaceFileAtomic } from "./atomicBookFiles.js";
import { bookPaths, ensureDirectoryWithinBooksRoot, requireBooksRoot, requirePathId } from "./bookPaths.js";
import type { BookWriteLock } from "./leaseTypes.js";

/**
 * R-166 — the WARN advisories a PASSING review files, kept instead of discarded.
 *
 * THE DEFECT. `bookRunApplicationService`'s repair lane is reachable only from a
 * review FAIL (`while (… review.value.outcome === "FAIL")`), and `reviewService`
 * refuses a PASS only when it carries a BLOCKER. So on a PASS every WARN is
 * dropped on the floor: the shipped Franklin revision's canonical review is
 * outcome PASS with 94 issues, 92 of them WARN, and every one of the 92 names
 * exactly one chapter. Ninety-two reader-decidable, chapter-scoped judgements,
 * produced at reader-panel cost, consumed by nothing.
 *
 * WHAT THIS STORE DOES. It is the carrier, and only the carrier. When the
 * operator sets CHAPTERFLOW_EDITOR_ADVISORY_PASS=1, the book run records a PASS
 * review's WARN advisories here, keyed by (bookId, chapterId), and the compile
 * stage's editor pass reads them and spends ONE extra bounded author call per
 * chapter that has them. The flag is off by default, so the default spend profile
 * is unchanged and no advisory is ever acted on without the operator asking.
 *
 * WHY A DURABLE STORE RATHER THAN AN IN-RUN HANDOFF. Compile happens BEFORE
 * review inside one book run, so the advisories a run's own panel files cannot
 * reach that run's editor. Re-compiling after the review to consume them would
 * pay for the entire compile a second time, which is the spend R-157 is about.
 * Written durably, they reach the editor on the next compile of the same book,
 * which is the loop the operator is already running when they set the flag.
 *
 * BOUNDED BY CONSTRUCTION. At most {@link MAX_ADVISORIES_PER_CHAPTER} entries per
 * chapter, each clamped to {@link MAX_ADVISORY_CHARS}, so the card cannot grow
 * with the panel's verbosity.
 */

export const REVIEW_ADVISORY_SCHEMA_VERSION = "review-advisory-context-v1" as const;
const ADVISORY_DIR_LEAF = "review-advisories" as const;

/** How many advisories one chapter's editor card may carry. The live Franklin
 *  panel filed up to 30 WARNs against a single chapter; a card that rendered all
 *  of them would spend more on advisories than on the chapter. Twelve is the
 *  number a single bounded edit can plausibly act on. */
export const MAX_ADVISORIES_PER_CHAPTER = 12;

/** Per-advisory character clamp. Panel messages are model output and are not
 *  length-bounded at the source. */
export const MAX_ADVISORY_CHARS = 400;

export interface ReviewAdvisoryKey {
  readonly bookId: string;
  readonly chapterId: string;
}

/** One reader advisory, reduced to what the editor card renders. */
export interface ReviewAdvisoryEntry {
  /** The panel issue code, e.g. "READER.CHURN". */
  readonly code: string;
  /** The advisory text, already clamped. */
  readonly message: string;
}

export interface ReviewAdvisoryContext {
  readonly entries: readonly ReviewAdvisoryEntry[];
  /** The review the advisories came from, so provenance can name it. */
  readonly reviewId: string;
}

export interface ReviewAdvisoryStore {
  /** The stored advisories for this chapter, or null on any miss. Never throws:
   *  an unusable store simply means the editor runs without advisories. */
  read(key: ReviewAdvisoryKey): Promise<ReviewAdvisoryContext | null>;
  /** Replace this chapter's advisories. Throws on a genuine store failure so the
   *  caller can treat recording as best-effort. */
  write(key: ReviewAdvisoryKey, context: ReviewAdvisoryContext): Promise<void>;
  /** Remove this chapter's advisories (idempotent). */
  clear(key: ReviewAdvisoryKey): Promise<void>;
}

type ReviewAdvisoryEnvelope = Readonly<{
  schemaVersion: typeof REVIEW_ADVISORY_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  reviewId: string;
  entries: readonly ReviewAdvisoryEntry[];
}>;

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/** Clamp a panel message to the per-advisory budget, marking any cut. */
export function boundAdvisoryMessage(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_ADVISORY_CHARS) return collapsed;
  return `${collapsed.slice(0, MAX_ADVISORY_CHARS).trimEnd()}…`;
}

/**
 * Reduce a review's issues to the bounded per-chapter advisory list this store
 * holds. Pure, so the service's selection policy is testable without a store.
 *
 * Only WARN issues are carried: an INFO is not a defect and a BLOCKER never
 * reaches a PASS. Order is the panel's own, truncated at the cap, so the
 * advisories a chapter keeps are the ones the panel filed first rather than an
 * arbitrary subset.
 */
export function boundedChapterAdvisories(
  issues: readonly Readonly<{ code: string; severity: string; message: string }>[],
): ReviewAdvisoryEntry[] {
  const entries: ReviewAdvisoryEntry[] = [];
  for (const issue of issues) {
    if (issue.severity !== "WARN") continue;
    if (entries.length >= MAX_ADVISORIES_PER_CHAPTER) break;
    entries.push({ code: issue.code, message: boundAdvisoryMessage(issue.message) });
  }
  return entries;
}

export function reviewAdvisoryDir(booksRoot: string, bookId: string): string {
  return resolve(bookPaths(booksRoot, bookId).bookRoot, ADVISORY_DIR_LEAF);
}

/** Content-addressed filename. bookId is the directory (and is validated as one
 *  safe path segment); the chapterId is HASHED rather than used as a segment, the
 *  same way the section-avoid store does it, so an id this store does not own the
 *  shape of can never become a path. */
function entryPath(booksRoot: string, key: ReviewAdvisoryKey): string {
  const name = createHash("sha256").update(key.chapterId).digest("hex");
  return resolve(reviewAdvisoryDir(booksRoot, key.bookId), `${name}.json`);
}

function parseEnvelope(raw: unknown, key: ReviewAdvisoryKey): ReviewAdvisoryEnvelope | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== REVIEW_ADVISORY_SCHEMA_VERSION) return null;
  if (value.bookId !== key.bookId || value.chapterId !== key.chapterId) return null;
  if (typeof value.reviewId !== "string" || value.reviewId.length === 0) return null;
  if (!Array.isArray(value.entries)) return null;
  const entries: ReviewAdvisoryEntry[] = [];
  for (const item of value.entries) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.code !== "string" || typeof entry.message !== "string") return null;
    entries.push({ code: entry.code, message: entry.message });
  }
  return { schemaVersion: REVIEW_ADVISORY_SCHEMA_VERSION, bookId: key.bookId, chapterId: key.chapterId, reviewId: value.reviewId, entries };
}

class FileReviewAdvisoryStore implements ReviewAdvisoryStore {
  readonly #booksRoot: string;
  readonly #writeLock: BookWriteLock;

  constructor(options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#writeLock = options.writeLock;
  }

  async read(key: ReviewAdvisoryKey): Promise<ReviewAdvisoryContext | null> {
    let path: string;
    try {
      requirePathId(key.bookId, "bookId");
      path = entryPath(this.#booksRoot, key);
    } catch {
      return null;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch {
      return null;
    }
    const envelope = parseEnvelope(parsed, key);
    if (envelope === null) return null;
    // Re-clamp on READ as well as on write: the bound must hold for an entry
    // written by an older build, and the card's size must not depend on when the
    // file was produced.
    return {
      reviewId: envelope.reviewId,
      entries: envelope.entries.slice(0, MAX_ADVISORIES_PER_CHAPTER).map((entry) => ({
        code: entry.code,
        message: boundAdvisoryMessage(entry.message),
      })),
    };
  }

  async write(key: ReviewAdvisoryKey, context: ReviewAdvisoryContext): Promise<void> {
    requirePathId(key.bookId, "bookId");
    const dir = reviewAdvisoryDir(this.#booksRoot, key.bookId);
    const path = entryPath(this.#booksRoot, key);
    const envelope: ReviewAdvisoryEnvelope = {
      schemaVersion: REVIEW_ADVISORY_SCHEMA_VERSION,
      bookId: key.bookId,
      chapterId: key.chapterId,
      reviewId: context.reviewId,
      entries: context.entries.slice(0, MAX_ADVISORIES_PER_CHAPTER).map((entry) => ({
        code: entry.code,
        message: boundAdvisoryMessage(entry.message),
      })),
    };
    const result = await this.#writeLock.run(key.bookId, async () => {
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, dir);
      await replaceFileAtomic(path, jsonBytes(envelope));
      return { ok: true as const, value: undefined };
    });
    if (!result.ok) {
      throw new Error(`REVIEW_ADVISORY_WRITE_FAILED:${result.error.code}:${result.error.message}`);
    }
  }

  async clear(key: ReviewAdvisoryKey): Promise<void> {
    requirePathId(key.bookId, "bookId");
    const path = entryPath(this.#booksRoot, key);
    const result = await this.#writeLock.run(key.bookId, async () => {
      await rm(path, { force: true });
      return { ok: true as const, value: undefined };
    });
    if (!result.ok) {
      throw new Error(`REVIEW_ADVISORY_CLEAR_FAILED:${result.error.code}:${result.error.message}`);
    }
  }
}

export function createFileReviewAdvisoryStore(
  options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>,
): ReviewAdvisoryStore {
  return new FileReviewAdvisoryStore(options);
}
