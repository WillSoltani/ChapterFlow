import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { replaceFileAtomic } from "./atomicBookFiles.js";
import { bookPaths, ensureDirectoryWithinBooksRoot, requireBooksRoot, requirePathId } from "./bookPaths.js";
import type { BookWriteLock } from "./leaseTypes.js";

/**
 * Package 2B — durable, cross-run reuse of ONE chapter's editor verdict.
 *
 * The compile stage stages its candidate atomically at the very end, so a compile
 * that dies anywhere fails closed and a fresh compile run redoes the work. The
 * section packs survive that through `sectionPackCache`; without this store the
 * editor would not, and every operator round would re-pay one author call per
 * chapter to re-derive a verdict it had already reached.
 *
 * KEYED ON WHAT THE EDIT WAS A FUNCTION OF, so the entry is served only when
 * re-asking would produce the same question:
 *   - `chapterDigest`  the assembled chapter's own bytes. Any section re-draft, any
 *                      assembly change, mints a new key.
 *   - `briefDigest`    the editor brief and the preservation rule. Editing the
 *                      brief re-edits every chapter instead of replaying edits made
 *                      under the old one.
 *   - `contractDigest` the writing contract (which carries the voice card) and the
 *                      chapter-scoped scars, exactly as rendered into the card.
 *   - `advisoryDigest` the R-166 reader advisories rendered into the card, or null
 *                      when the advisory pass is off. Turning the flag on, or a new
 *                      panel filing different advisories, re-edits.
 *   - `cardDigest`     the EXACT bytes of the attempt-1 task card. R-164's lesson,
 *                      applied here on the day the stage is written rather than
 *                      after it bites: the three digests above key the DATA and the
 *                      BRIEF, and nothing else would key the RENDERER. A change to
 *                      the delivery block, the schema hint, the reader-view
 *                      projection or the span bound would otherwise reach zero
 *                      cached chapters and the run would still report green. It
 *                      subsumes the three above; they are kept because they make a
 *                      stored entry say WHY it is stale.
 *
 * BOTH VERDICTS ARE CACHED. An EDITED chapter replays its edited packs; a SKIPPED
 * chapter replays the skip and its blockers. Caching only success would mean a
 * chapter whose edit was refused twice paid for both attempts again on every
 * resume, which is precisely the spend this store exists to remove. An
 * infrastructure ERROR is deliberately NOT cached: a provider blip is not a
 * verdict, and freezing it would make the next run replay a failure it could have
 * cleared for free.
 */

export const CHAPTER_EDIT_CACHE_SCHEMA_VERSION = "chapter-edit-cache-v1" as const;
const CACHE_DIR_LEAF = "chapter-edit-cache" as const;

export interface ChapterEditCacheKey {
  readonly bookId: string;
  readonly chapterId: string;
  /** sha256 of the assembled chapter bytes the editor read. */
  readonly chapterDigest: string;
  /** sha256 of the editor brief plus the preservation rule. */
  readonly briefDigest: string;
  /** sha256 of the rendered writing contract plus the chapter-scoped scars. */
  readonly contractDigest: string;
  /** sha256 of the rendered reader advisories, or null when none were rendered. */
  readonly advisoryDigest: string | null;
  /** sha256 of the exact attempt-1 editor card (no retry feedback, no advisories).
   *  The prompt itself, not just its inputs — see the header. */
  readonly cardDigest: string;
}

/** What a completed editor pass decided about one chapter. */
export type ChapterEditCacheEntry = Readonly<{
  /** EDITED: `packs` carries the gate-revalidated edit. SKIPPED: the unedited
   *  chapter ships and `blockers` says why. */
  outcome: "EDITED" | "SKIPPED";
  packs?: Record<string, unknown>;
  blockers: readonly string[];
  /** The run-state attempt ids the verdict was reached under, for provenance. */
  attemptIds: readonly string[];
  /** What the R-166 advisory INVOCATION decided, which the chapter's own outcome
   *  does not say: an EDITED chapter may carry a REFUSED advisory edit. Required,
   *  and an entry without it is treated as a MISS rather than replayed with the
   *  advisory verdict guessed — a re-edit costs one call, a guessed provenance
   *  line costs the operator's trust in the file. The union is written out here
   *  rather than imported from `app/chapterEditProvenance`, so this store keeps
   *  its layer direction; the compiler still checks both ends, because the pass
   *  writes its own record type into this field and reads it back out. */
  advisory: Readonly<{ outcome: "NOT_RUN" | "ACCEPTED" | "REFUSED" | "ERROR"; blockers: readonly string[] }>;
}>;

type ChapterEditCacheEnvelope = Readonly<{
  schemaVersion: typeof CHAPTER_EDIT_CACHE_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterDigest: string;
  briefDigest: string;
  contractDigest: string;
  advisoryDigest: string | null;
  cardDigest: string;
  entry: ChapterEditCacheEntry;
}>;

export interface ChapterEditCache {
  /** The cached verdict for this exact identity, or null on any miss (absent,
   *  unreadable, corrupt, or a stored identity that does not match). Never
   *  throws: an unusable cache falls through to a fresh edit. */
  read(key: ChapterEditCacheKey): Promise<ChapterEditCacheEntry | null>;
  /** Persist a verdict under this identity, replacing any prior entry. Throws on
   *  a genuine store failure so the caller can treat caching as best-effort. */
  write(key: ChapterEditCacheKey, entry: ChapterEditCacheEntry): Promise<void>;
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/** The durable chapter-edit-cache directory for a book. Exported so tests can
 *  inspect stored envelopes; the on-disk layout is stable. */
export function chapterEditCacheDir(booksRoot: string, bookId: string): string {
  return resolve(bookPaths(booksRoot, bookId).bookRoot, CACHE_DIR_LEAF);
}

/** Content-addressed filename. Every identity component is hashed into the NAME
 *  (unlike the section-pack cache, which keeps two components out of the name so
 *  legacy entries are superseded rather than orphaned): this store has no legacy
 *  entries, and hashing the whole identity means a superseded entry is simply
 *  never read rather than read and rejected. */
function entryFileName(key: ChapterEditCacheKey): string {
  const hash = createHash("sha256");
  for (const part of [key.chapterId, key.chapterDigest, key.briefDigest, key.contractDigest, key.advisoryDigest ?? "", key.cardDigest]) {
    hash.update(part);
    hash.update("\0");
  }
  return `${hash.digest("hex")}.json`;
}

function entryPath(booksRoot: string, key: ChapterEditCacheKey): string {
  return resolve(chapterEditCacheDir(booksRoot, key.bookId), entryFileName(key));
}

function identityMatches(envelope: ChapterEditCacheEnvelope, key: ChapterEditCacheKey): boolean {
  return envelope.schemaVersion === CHAPTER_EDIT_CACHE_SCHEMA_VERSION
    && envelope.bookId === key.bookId
    && envelope.chapterId === key.chapterId
    && envelope.chapterDigest === key.chapterDigest
    && envelope.briefDigest === key.briefDigest
    && envelope.contractDigest === key.contractDigest
    && (envelope.advisoryDigest ?? null) === key.advisoryDigest
    && envelope.cardDigest === key.cardDigest;
}

const ADVISORY_OUTCOMES: readonly string[] = ["NOT_RUN", "ACCEPTED", "REFUSED", "ERROR"];

function parseEnvelope(raw: unknown): ChapterEditCacheEnvelope | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  for (const field of ["bookId", "chapterId", "chapterDigest", "briefDigest", "contractDigest", "cardDigest"]) {
    if (typeof value[field] !== "string") return null;
  }
  if (!(value.advisoryDigest === null || typeof value.advisoryDigest === "string")) return null;
  const entry = value.entry;
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  if (record.outcome !== "EDITED" && record.outcome !== "SKIPPED") return null;
  if (!Array.isArray(record.blockers) || !record.blockers.every((line) => typeof line === "string")) return null;
  if (!Array.isArray(record.attemptIds) || !record.attemptIds.every((id) => typeof id === "string")) return null;
  const advisory = record.advisory;
  if (typeof advisory !== "object" || advisory === null || Array.isArray(advisory)) return null;
  const advisoryRecord = advisory as Record<string, unknown>;
  if (!ADVISORY_OUTCOMES.includes(advisoryRecord.outcome as string)) return null;
  if (!Array.isArray(advisoryRecord.blockers) || !advisoryRecord.blockers.every((line) => typeof line === "string")) return null;
  // An EDITED entry without packs would replay as "edited, with nothing to apply".
  if (record.outcome === "EDITED" && (typeof record.packs !== "object" || record.packs === null || Array.isArray(record.packs))) {
    return null;
  }
  return value as unknown as ChapterEditCacheEnvelope;
}

class FileChapterEditCache implements ChapterEditCache {
  readonly #booksRoot: string;
  readonly #writeLock: BookWriteLock;

  constructor(options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#writeLock = options.writeLock;
  }

  async read(key: ChapterEditCacheKey): Promise<ChapterEditCacheEntry | null> {
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
    const envelope = parseEnvelope(parsed);
    if (envelope === null || !identityMatches(envelope, key)) return null;
    return envelope.entry;
  }

  async write(key: ChapterEditCacheKey, entry: ChapterEditCacheEntry): Promise<void> {
    requirePathId(key.bookId, "bookId");
    const dir = chapterEditCacheDir(this.#booksRoot, key.bookId);
    const path = entryPath(this.#booksRoot, key);
    const envelope: ChapterEditCacheEnvelope = {
      schemaVersion: CHAPTER_EDIT_CACHE_SCHEMA_VERSION,
      bookId: key.bookId,
      chapterId: key.chapterId,
      chapterDigest: key.chapterDigest,
      briefDigest: key.briefDigest,
      contractDigest: key.contractDigest,
      advisoryDigest: key.advisoryDigest,
      cardDigest: key.cardDigest,
      entry,
    };
    const result = await this.#writeLock.run(key.bookId, async () => {
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, dir);
      await replaceFileAtomic(path, jsonBytes(envelope));
      return { ok: true as const, value: undefined };
    });
    if (!result.ok) {
      throw new Error(`CHAPTER_EDIT_CACHE_WRITE_FAILED:${result.error.code}:${result.error.message}`);
    }
  }
}

export function createFileChapterEditCache(
  options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>,
): ChapterEditCache {
  return new FileChapterEditCache(options);
}
