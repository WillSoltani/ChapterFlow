import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import type { SectionKind } from "../artifacts/artifactTypes.js";
import { replaceFileAtomic } from "./atomicBookFiles.js";
import { bookPaths, ensureDirectoryWithinBooksRoot, requireBooksRoot, requirePathId } from "./bookPaths.js";
import type { BookWriteLock } from "./leaseTypes.js";

/**
 * Task 11aa — durable cross-chapter assembly-avoid context.
 *
 * The cross-chapter anti-sameness gates (SEC93 venue stamping, SEC85 action
 * containers, …) run at ASSEMBLY, over independently-drafted section packs. A
 * single section writer sees only its own chapter, so a re-draft of the colliding
 * pack gets NO signal about the phrase(s) other chapters already spent — even a
 * fresh draft can re-collide, and the assembly re-fails forever (finding #36's
 * "no cross-chapter feedback" defect).
 *
 * This store is the sibling of the section-pack cache: when assembly evicts a
 * colliding pack (see planAssemblyEvictions), it records here, keyed by
 * (bookId, chapterId, kind), the concrete phrase(s) the KEPT chapters retain and
 * a human line the section task builder renders into the re-draft prompt. The
 * entry is CLEARED once its re-draft clears assembly, so avoid-context never
 * outlives the collision it describes.
 */

export const SECTION_AVOID_CONTEXT_SCHEMA_VERSION = "section-avoid-context-v1" as const;
const AVOID_DIR_LEAF = "section-avoid-context" as const;

export interface SectionAvoidKey {
  readonly bookId: string;
  readonly chapterId: string;
  readonly kind: SectionKind;
}

/** One cross-chapter collision the re-draft must design away from. */
export interface SectionAvoidEntry {
  /** The assembly gate that flagged the collision, e.g. "SEC93.example_venue_stamping". */
  readonly checkId: string;
  /** The concrete colliding phrase, e.g. "kitchen table". */
  readonly phrase: string;
  /** The chapter numbers that KEEP the phrase (this chapter must pick another). */
  readonly keptByChapters: readonly number[];
  /** The rendered human line for the re-draft task card. */
  readonly message: string;
}

export interface SectionAvoidContext {
  readonly entries: readonly SectionAvoidEntry[];
}

export interface SectionAvoidStore {
  /** Return the durable avoid-context for this section, or null on any miss —
   *  absent file, unreadable/corrupt content, or a stored identity that does not
   *  match the requested key. Never throws. */
  read(key: SectionAvoidKey): Promise<SectionAvoidContext | null>;
  /** Persist the avoid-context for this section, replacing any prior entry.
   *  Runs under the book write lock. Throws on a genuine store failure. */
  write(key: SectionAvoidKey, context: SectionAvoidContext): Promise<void>;
  /** Remove any avoid-context for this section (idempotent — a missing entry is a
   *  no-op). Runs under the book write lock. Throws on a genuine store failure. */
  clear(key: SectionAvoidKey): Promise<void>;
}

type SectionAvoidEnvelope = Readonly<{
  schemaVersion: typeof SECTION_AVOID_CONTEXT_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  kind: SectionKind;
  entries: readonly SectionAvoidEntry[];
}>;

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/** The durable avoid-context directory for a book — a sibling of the section-pack
 *  cache under the same book root. Exported so tests can inspect stored envelopes. */
export function sectionAvoidStoreDir(booksRoot: string, bookId: string): string {
  return resolve(bookPaths(booksRoot, bookId).bookRoot, AVOID_DIR_LEAF);
}

/** Content-addressed filename for a section's avoid-context. bookId is the
 *  directory, so the hash keys only (chapterId, kind). */
function entryFileName(key: SectionAvoidKey): string {
  const hash = createHash("sha256");
  hash.update(key.chapterId);
  hash.update("\0");
  hash.update(key.kind);
  return `${hash.digest("hex")}.json`;
}

function entryPath(booksRoot: string, key: SectionAvoidKey): string {
  return resolve(sectionAvoidStoreDir(booksRoot, key.bookId), entryFileName(key));
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function parseEntry(raw: unknown): SectionAvoidEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.checkId !== "string"
    || typeof value.phrase !== "string"
    || typeof value.message !== "string"
    || !isNumberArray(value.keptByChapters)
  ) {
    return null;
  }
  return {
    checkId: value.checkId,
    phrase: value.phrase,
    keptByChapters: [...value.keptByChapters],
    message: value.message,
  };
}

function parseEnvelope(raw: unknown): SectionAvoidEnvelope | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    value.schemaVersion !== SECTION_AVOID_CONTEXT_SCHEMA_VERSION
    || typeof value.bookId !== "string"
    || typeof value.chapterId !== "string"
    || typeof value.kind !== "string"
    || !Array.isArray(value.entries)
  ) {
    return null;
  }
  const entries: SectionAvoidEntry[] = [];
  for (const item of value.entries) {
    const entry = parseEntry(item);
    if (entry === null) return null;
    entries.push(entry);
  }
  return {
    schemaVersion: SECTION_AVOID_CONTEXT_SCHEMA_VERSION,
    bookId: value.bookId,
    chapterId: value.chapterId,
    kind: value.kind as SectionKind,
    entries,
  };
}

function identityMatches(envelope: SectionAvoidEnvelope, key: SectionAvoidKey): boolean {
  return envelope.bookId === key.bookId
    && envelope.chapterId === key.chapterId
    && envelope.kind === key.kind;
}

class FileSectionAvoidStore implements SectionAvoidStore {
  readonly #booksRoot: string;
  readonly #writeLock: BookWriteLock;

  constructor(options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#writeLock = options.writeLock;
  }

  async read(key: SectionAvoidKey): Promise<SectionAvoidContext | null> {
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
    if (envelope === null || !identityMatches(envelope, key) || envelope.entries.length === 0) return null;
    return { entries: envelope.entries };
  }

  async write(key: SectionAvoidKey, context: SectionAvoidContext): Promise<void> {
    requirePathId(key.bookId, "bookId");
    const dir = sectionAvoidStoreDir(this.#booksRoot, key.bookId);
    const path = entryPath(this.#booksRoot, key);
    const envelope: SectionAvoidEnvelope = {
      schemaVersion: SECTION_AVOID_CONTEXT_SCHEMA_VERSION,
      bookId: key.bookId,
      chapterId: key.chapterId,
      kind: key.kind,
      entries: context.entries,
    };
    const result = await this.#writeLock.run(key.bookId, async () => {
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, dir);
      await replaceFileAtomic(path, jsonBytes(envelope));
      return { ok: true as const, value: undefined };
    });
    if (!result.ok) {
      throw new Error(`SECTION_AVOID_WRITE_FAILED:${result.error.code}:${result.error.message}`);
    }
  }

  async clear(key: SectionAvoidKey): Promise<void> {
    requirePathId(key.bookId, "bookId");
    const path = entryPath(this.#booksRoot, key);
    const result = await this.#writeLock.run(key.bookId, async () => {
      await rm(path, { force: true });
      return { ok: true as const, value: undefined };
    });
    if (!result.ok) {
      throw new Error(`SECTION_AVOID_CLEAR_FAILED:${result.error.code}:${result.error.message}`);
    }
  }
}

export function createFileSectionAvoidStore(
  options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>,
): SectionAvoidStore {
  return new FileSectionAvoidStore(options);
}
