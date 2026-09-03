import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import type { SectionKind } from "../artifacts/artifactTypes.js";
import { replaceFileAtomic } from "./atomicBookFiles.js";
import { bookPaths, ensureDirectoryWithinBooksRoot, requireBooksRoot, requirePathId } from "./bookPaths.js";
import type { BookWriteLock } from "./leaseTypes.js";

/**
 * Task 11y — durable cross-compile-run section-pack reuse.
 *
 * Every operator compile retry mints a FRESH compile run that, pre-11y,
 * re-drafted ALL section packs from scratch (finding #31): a gate-PASSED pack in
 * round N was thrown away in round N+1, so convergence was roulette rather than
 * monotone. This cache stores a gate-PASSED section pack keyed by its full
 * content identity — (bookId, chapterId, kind, blueprintDigest, packetDigest) —
 * so the next compile run reuses digest-valid cached packs and drafts only the
 * missing/failed ones. Reuse is the same durable-sidecar pattern the researcher
 * uses for chapters (loadSucceededChapter + manifest digests, Task 11d PART C).
 *
 * Gate-version drift is handled OUTSIDE this store, by the caller: a cached pack
 * is re-validated through the SAME live section gate before acceptance, so a
 * pack that no longer passes current gates falls through to re-draft. The digests
 * key on the drafting inputs (blueprint + source packet); when either changes the
 * key changes and the stale entry is simply never found.
 */

export const SECTION_PACK_CACHE_SCHEMA_VERSION = "section-pack-cache-v1" as const;
const CACHE_DIR_LEAF = "section-pack-cache" as const;

export interface SectionPackCacheKey {
  readonly bookId: string;
  readonly chapterId: string;
  readonly kind: SectionKind;
  /** sha256 of the fully-resolved chapter blueprint the section was drafted and gated against. */
  readonly blueprintDigest: string;
  /** sha256 of the compiled source packet the section was drafted and gated against. */
  readonly packetDigest: string;
  /**
   * sha256 of the book's scars as rendered into the writer prompt, or null when
   * the book has no scar file.
   *
   * Scars are NOT a gate input by design, so a stale pack cannot be caught on
   * reuse: cachedSectionPackIsReusable re-runs the section gate, which never sees
   * them. And buildSectionTaskMarkdown — the only thing that renders a scar — is
   * inside the `!reusedFromCache` loop guard, so a cache hit means the prompt is
   * never built at all. Without this field, adding a panel-blocker SAFETY rule and
   * re-running the documented repair loop would hit cache on every pack, apply
   * nothing, and report green: a silent safety bypass on exactly the path the
   * scar was written for.
   *
   * Deliberately NOT part of entryFileName. Keying the path on it would orphan
   * every existing entry for every book, including the majority that have no scar
   * file and are unaffected. Comparing it in identityMatches instead invalidates
   * only the books whose scars actually changed — and a legacy entry, written
   * before this field existed, reads as null, which is exactly what it was
   * drafted under.
   */
  readonly scarsDigest: string | null;
  /**
   * sha256 of the exact writer task card this pack was drafted against, or null
   * when the entry predates this field.
   *
   * blueprintDigest and packetDigest key the DATA a writer was handed; nothing
   * keyed the PROMPT. `buildSectionTaskMarkdown` is the only place the prompt is
   * built and it lives inside the `!reusedFromCache` guard, so on a hit the card
   * is never rendered at all — which means a contract fix, a new DO NOT line, or
   * a schema-hint change reached ZERO cached packs on a re-run and the run still
   * reported green. Scars were the one prompt input already covered
   * (`scarsDigest`); this covers the rest of the card.
   *
   * Deliberately NOT part of entryFileName, for the same reason scarsDigest is
   * not: keying the path on it would ORPHAN every existing entry instead of
   * superseding it. Compared in identityMatches, a legacy entry reads as null,
   * mismatches the caller's digest, and is re-drafted and REPLACED in place.
   */
  readonly taskCardDigest: string | null;
}

type SectionPackCacheEnvelope = Readonly<{
  schemaVersion: typeof SECTION_PACK_CACHE_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  kind: SectionKind;
  blueprintDigest: string;
  packetDigest: string;
  /** Absent on entries written before the field existed — read as null. */
  scarsDigest?: string | null;
  /** Absent on entries written before the field existed — read as null. */
  taskCardDigest?: string | null;
  pack: Record<string, unknown>;
}>;

export interface SectionPackCache {
  /** Return the cached pack for this exact identity, or null on any miss —
   *  absent file, unreadable/corrupt content, or an identity that does not match
   *  the requested key. Never throws: an unusable cache falls through to a draft. */
  read(key: SectionPackCacheKey): Promise<Record<string, unknown> | null>;
  /** Persist a gate-passed pack under this identity, replacing any prior entry.
   *  Runs under the book write lock, mirroring the other book stores. Throws on a
   *  genuine store failure so the caller can treat caching as best-effort. */
  write(key: SectionPackCacheKey, pack: Record<string, unknown>): Promise<void>;
  /** Task 11aa — remove the cached pack for this exact identity (idempotent: a
   *  missing entry is a no-op). Runs under the book write lock. An assembly
   *  cross-chapter blocker over a durably-cached pack would otherwise be reused
   *  verbatim by the next compile run and re-fail identically forever; evicting
   *  the implicated entry forces a fresh re-draft. Throws on a genuine store
   *  failure. */
  evict(key: SectionPackCacheKey): Promise<void>;
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

/** The durable section-pack-cache directory for a book. Exported so tests can
 *  inspect stored envelopes; the on-disk layout is stable. */
export function sectionPackCacheDir(booksRoot: string, bookId: string): string {
  return resolve(bookPaths(booksRoot, bookId).bookRoot, CACHE_DIR_LEAF);
}

/** Content-addressed filename for a cache entry. bookId is the directory, so the
 *  hash keys only the remaining identity components. Digests are already hex, so
 *  the resulting name is a safe path segment. */
function entryFileName(key: SectionPackCacheKey): string {
  const hash = createHash("sha256");
  hash.update(key.chapterId);
  hash.update("\0");
  hash.update(key.kind);
  hash.update("\0");
  hash.update(key.blueprintDigest);
  hash.update("\0");
  hash.update(key.packetDigest);
  return `${hash.digest("hex")}.json`;
}

function entryPath(booksRoot: string, key: SectionPackCacheKey): string {
  return resolve(sectionPackCacheDir(booksRoot, key.bookId), entryFileName(key));
}

function identityMatches(envelope: SectionPackCacheEnvelope, key: SectionPackCacheKey): boolean {
  return envelope.schemaVersion === SECTION_PACK_CACHE_SCHEMA_VERSION
    && envelope.bookId === key.bookId
    && envelope.chapterId === key.chapterId
    && envelope.kind === key.kind
    && envelope.blueprintDigest === key.blueprintDigest
    && envelope.packetDigest === key.packetDigest
    && (envelope.scarsDigest ?? null) === key.scarsDigest
    && (envelope.taskCardDigest ?? null) === key.taskCardDigest;
}

function parseEnvelope(raw: unknown): SectionPackCacheEnvelope | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.bookId !== "string"
    || typeof value.chapterId !== "string"
    || typeof value.kind !== "string"
    || typeof value.blueprintDigest !== "string"
    || typeof value.packetDigest !== "string"
    // Absent on pre-field entries (read as null by identityMatches); present must
    // be string|null. Anything else is corruption, not a legacy shape.
    || !(value.scarsDigest === undefined || value.scarsDigest === null || typeof value.scarsDigest === "string")
    || !(value.taskCardDigest === undefined || value.taskCardDigest === null || typeof value.taskCardDigest === "string")
    || typeof value.pack !== "object"
    || value.pack === null
    || Array.isArray(value.pack)
  ) {
    return null;
  }
  return value as unknown as SectionPackCacheEnvelope;
}

class FileSectionPackCache implements SectionPackCache {
  readonly #booksRoot: string;
  readonly #writeLock: BookWriteLock;

  constructor(options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>) {
    this.#booksRoot = requireBooksRoot(options.booksRoot);
    this.#writeLock = options.writeLock;
  }

  async read(key: SectionPackCacheKey): Promise<Record<string, unknown> | null> {
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
    return envelope.pack;
  }

  async write(key: SectionPackCacheKey, pack: Record<string, unknown>): Promise<void> {
    requirePathId(key.bookId, "bookId");
    const dir = sectionPackCacheDir(this.#booksRoot, key.bookId);
    const path = entryPath(this.#booksRoot, key);
    const envelope: SectionPackCacheEnvelope = {
      schemaVersion: SECTION_PACK_CACHE_SCHEMA_VERSION,
      bookId: key.bookId,
      chapterId: key.chapterId,
      kind: key.kind,
      blueprintDigest: key.blueprintDigest,
      packetDigest: key.packetDigest,
      scarsDigest: key.scarsDigest,
      taskCardDigest: key.taskCardDigest,
      pack,
    };
    const result = await this.#writeLock.run(key.bookId, async () => {
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, dir);
      await replaceFileAtomic(path, jsonBytes(envelope));
      return { ok: true as const, value: undefined };
    });
    if (!result.ok) {
      throw new Error(`SECTION_PACK_CACHE_WRITE_FAILED:${result.error.code}:${result.error.message}`);
    }
  }

  async evict(key: SectionPackCacheKey): Promise<void> {
    requirePathId(key.bookId, "bookId");
    const path = entryPath(this.#booksRoot, key);
    const result = await this.#writeLock.run(key.bookId, async () => {
      await rm(path, { force: true });
      return { ok: true as const, value: undefined };
    });
    if (!result.ok) {
      throw new Error(`SECTION_PACK_CACHE_EVICT_FAILED:${result.error.code}:${result.error.message}`);
    }
  }
}

export function createFileSectionPackCache(
  options: Readonly<{ booksRoot: string; writeLock: BookWriteLock }>,
): SectionPackCache {
  return new FileSectionPackCache(options);
}
