/**
 * Chapter-identity migration — deterministically align a book's loose chapter
 * state so that, for every chapter, `chapterId == filename stem == canonical
 * index entry`. This is the safe repair path for the verified casing/punctuation
 * drift the slot-fill scripts produced (e.g. `Unreasonable-hospitality-chNN`
 * stored in lowercase `unreasonable-hospitality-chNN` files), which silently
 * skips the intra-book critics and forks the library ledger into a phantom
 * capitalized book.
 *
 * Contract:
 *   1. The PLAN is computed first and is read-only.
 *   2. Ambiguous mappings are refused — the plan reports them and applies
 *      nothing (no guessing which of two conflicting files owns a number).
 *   3. Application updates filename, in-file chapterId, and the canonical index
 *      consistently, using atomic temp+rename per file.
 *   4. A migration report is written BEFORE any mutation (recoverable evidence)
 *      and again after success, so an interruption leaves a forensic trail and
 *      the atomic writes guarantee no chapter file is ever torn.
 *   5. Unrelated content is never deleted — index entries are only added or have
 *      their chapterId corrected, never removed.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import { basename, dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

import { createBookWriteLock } from "../books/bookLease.js";
import { assertV4LibrarianWriterPreflight } from "../books/legacyLibrarianStateAdapter.js";
import type { BookWriteLock } from "../books/leaseTypes.js";
import type { Result } from "../contracts/v4Core.js";
import { chapterFileName, chapterIdFromFileName, isSiblingFile, normSlug } from "../lib/chapterPaths.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const REPO_ROOT = PIPELINE_DIR;
const DEFAULT_STATE_DIR = resolve(PIPELINE_DIR, "state");

export type IdentityMigrationStep = {
  chapterNumber: number;
  fromFile: string;
  toFile: string;
  fromChapterId: string;
  toChapterId: string;
  renameFile: boolean;
  rewriteChapterId: boolean;
  updateIndex: boolean;
};

export type IdentityMigrationPlan = {
  bookId: string;
  ok: boolean;
  steps: IdentityMigrationStep[];
  ambiguities: string[];
  indexPath: string;
  indexPresent: boolean;
  changeCount: number;
};

export type IdentityMigrationOptions = {
  stateDir?: string;
  now?: () => number;
  randomSuffix?: () => string;
  /** Throw at a controllable point so the interrupted-migration test can prove
   *  the plan evidence survives and no chapter file is left torn. */
  faultInjection?: Partial<{ beforeFirstRename: boolean; afterFirstRename: boolean; beforeIndex: boolean }>;
};

export type IdentityMigrationV4Options = IdentityMigrationOptions & {
  writeLock?: BookWriteLock;
  legacyWriterEnabled?: boolean;
};

type Paths = { stateDir: string; chaptersDir: string; indexesDir: string; migrationsDir: string };

function pathsFor(opts: IdentityMigrationOptions): Paths {
  const stateDir = opts.stateDir ? resolve(opts.stateDir) : DEFAULT_STATE_DIR;
  return {
    stateDir,
    chaptersDir: resolve(stateDir, "chapters"),
    indexesDir: resolve(stateDir, "indexes"),
    migrationsDir: resolve(stateDir, "_migrations"),
  };
}

function relReport(abs: string): string {
  const rel = relative(REPO_ROOT, abs);
  return rel && !rel.startsWith("..") ? rel : abs;
}

function nowMs(opts: IdentityMigrationOptions): number {
  return opts.now ? opts.now() : Date.now();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fileChapterNumber(fileName: string): number | null {
  const m = basename(fileName).match(/-ch0*(\d{1,3})\.v21-native\.chapter\.json$/i);
  return m ? parseInt(m[1], 10) : null;
}

type IndexEntry = { chapterId: string; chapterNumber: number; chapterTitle: string };

function readIndex(indexPath: string): IndexEntry[] | null {
  if (!existsSync(indexPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(indexPath, "utf8"));
    if (!Array.isArray(raw)) return null;
    return raw as IndexEntry[];
  } catch {
    return null;
  }
}

/**
 * Compute the deterministic alignment plan for one book. Read-only: it never
 * touches disk state. The canonical identity for chapter N is
 * `<bookId>-ch<NN>` with a matching filename and index entry.
 */
export function planChapterIdentityMigration(bookIdInput: string, opts: IdentityMigrationOptions = {}): IdentityMigrationPlan {
  const paths = pathsFor(opts);
  const bookId = normSlug(bookIdInput);
  const indexPath = resolve(paths.indexesDir, `${bookId}.json`);
  const index = readIndex(indexPath);
  const ambiguities: string[] = [];
  const steps: IdentityMigrationStep[] = [];

  const files = existsSync(paths.chaptersDir)
    ? readdirSync(paths.chaptersDir).filter((f) => f.endsWith(".v21-native.chapter.json") && isSiblingFile(f, bookId)).sort()
    : [];
  if (files.length === 0) {
    return { bookId, ok: false, steps, ambiguities: [`no loose chapter files found for "${bookId}" under ${relReport(paths.chaptersDir)}`], indexPath: relReport(indexPath), indexPresent: !!index, changeCount: 0 };
  }

  const targetFileOwners = new Map<string, string>();
  const targetNumbers = new Map<number, string>();
  const indexedNumbers = new Map<number, IndexEntry>();
  for (const entry of index ?? []) {
    if (entry && Number.isInteger(entry.chapterNumber)) indexedNumbers.set(Number(entry.chapterNumber), entry);
  }

  for (const file of files) {
    const abs = resolve(paths.chaptersDir, file);
    let obj: { chapterId?: string; number?: number; title?: string };
    try {
      obj = JSON.parse(readFileSync(abs, "utf8"));
    } catch (err) {
      ambiguities.push(`${file}: unreadable JSON (${(err as Error).message})`);
      continue;
    }
    const inFileNumber = obj.number;
    const nameNumber = fileChapterNumber(file);
    if (!Number.isInteger(inFileNumber)) {
      ambiguities.push(`${file}: missing integer \`number\``);
      continue;
    }
    const chapterNumber = Number(inFileNumber);
    if (nameNumber !== null && nameNumber !== chapterNumber) {
      ambiguities.push(`${file}: filename chapter ${nameNumber} disagrees with in-file number ${chapterNumber} — refusing to guess`);
      continue;
    }
    const priorForNumber = targetNumbers.get(chapterNumber);
    if (priorForNumber) {
      ambiguities.push(`chapter ${chapterNumber} is claimed by both "${priorForNumber}" and "${file}"`);
      continue;
    }
    targetNumbers.set(chapterNumber, file);

    const toChapterId = `${bookId}-ch${pad2(chapterNumber)}`;
    const toFile = chapterFileName(toChapterId);
    const ownerOfTarget = targetFileOwners.get(toFile);
    if (ownerOfTarget && ownerOfTarget !== file) {
      ambiguities.push(`two files would migrate to "${toFile}": "${ownerOfTarget}" and "${file}"`);
      continue;
    }
    targetFileOwners.set(toFile, file);

    const renameFile = basename(file) !== toFile;
    if (renameFile) {
      const targetAbs = resolve(paths.chaptersDir, toFile);
      if (existsSync(targetAbs) && readFileSync(targetAbs, "utf8") !== readFileSync(abs, "utf8")) {
        ambiguities.push(`target file "${toFile}" already exists with different content — refusing to clobber`);
        continue;
      }
    }

    const fromChapterId = typeof obj.chapterId === "string" ? obj.chapterId : "";
    const rewriteChapterId = fromChapterId !== toChapterId;
    const indexEntry = indexedNumbers.get(chapterNumber);
    const updateIndex = index !== null && (!indexEntry || indexEntry.chapterId !== toChapterId);

    if (renameFile || rewriteChapterId || updateIndex) {
      steps.push({
        chapterNumber,
        fromFile: relReport(abs),
        toFile: relReport(resolve(paths.chaptersDir, toFile)),
        fromChapterId,
        toChapterId,
        renameFile,
        rewriteChapterId,
        updateIndex,
      });
    }
  }

  steps.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return {
    bookId,
    ok: ambiguities.length === 0,
    steps,
    ambiguities,
    indexPath: relReport(indexPath),
    indexPresent: index !== null,
    changeCount: steps.length,
  };
}

export type IdentityMigrationResult = {
  bookId: string;
  planPath: string;
  reportPath: string;
  applied: IdentityMigrationStep[];
  indexUpdated: boolean;
};

function writeTemp(targetAbs: string, data: string, opts: IdentityMigrationOptions): string {
  mkdirSync(dirname(targetAbs), { recursive: true });
  const suffix = opts.randomSuffix ? opts.randomSuffix() : randomBytes(4).toString("hex");
  const tmp = `${targetAbs}.migrate-tmp-${suffix}`;
  writeFileSync(tmp, data, "utf8");
  return tmp;
}

/**
 * Apply a previously computed plan. Refuses an un-ok plan. Writes the plan as
 * recoverable evidence before mutating anything, then migrates each chapter
 * file atomically (temp+rename, so an interruption can never tear a file),
 * updates the canonical index atomically, and records a final report.
 */
export function applyChapterIdentityMigration(plan: IdentityMigrationPlan, opts: IdentityMigrationOptions = {}): IdentityMigrationResult {
  if (!plan.ok) {
    throw new Error(`refusing to apply an ambiguous migration for "${plan.bookId}":\n  - ${plan.ambiguities.join("\n  - ")}`);
  }
  const paths = pathsFor(opts);
  const stamp = new Date(nowMs(opts)).toISOString().replace(/[:.]/g, "-");
  mkdirSync(paths.migrationsDir, { recursive: true });

  // 1. Evidence first — the plan is durable before any state mutation.
  const planPath = resolve(paths.migrationsDir, `${plan.bookId}-${stamp}.plan.json`);
  writeFileAtomic(planPath, JSON.stringify({ schemaVersion: "chapter-identity-migration-plan-v1", createdAt: new Date(nowMs(opts)).toISOString(), plan }, null, 2), "utf8");

  const applied: IdentityMigrationStep[] = [];
  let first = true;
  for (const step of plan.steps) {
    // Interrupt BEFORE touching disk for the first chapter: the plan evidence is
    // already durable and every chapter file is still original and intact.
    if (first && opts.faultInjection?.beforeFirstRename) throw new Error("fault injection: beforeFirstRename");
    const fromAbs = resolve(REPO_ROOT, step.fromFile);
    const toAbs = resolve(REPO_ROOT, step.toFile);
    const raw = readFileSync(fromAbs, "utf8");
    const obj = JSON.parse(raw);
    obj.chapterId = step.toChapterId;
    const out = JSON.stringify(obj, null, 2) + (raw.endsWith("\n") ? "\n" : "");
    // A case-only rename (e.g. `Book-ch01` → `book-ch01`) resolves to the SAME
    // inode on a case-insensitive, case-preserving filesystem (macOS). A naive
    // rename-then-unlink-original would delete the just-migrated file. So for a
    // case-only rename, remove the original FIRST (its bytes are safe in `out`),
    // then place the corrected, correctly-cased file.
    const caseOnlyRename = step.renameFile && fromAbs !== toAbs && fromAbs.toLowerCase() === toAbs.toLowerCase();
    if (caseOnlyRename) {
      // Corrected content lands in the temp sidecar FIRST, so a crash after the
      // unlink still leaves the bytes recoverable next to the plan evidence.
      const tmp = writeTemp(toAbs, out, opts);
      unlinkSync(fromAbs);
      renameSync(tmp, toAbs);
    } else {
      const tmp = writeTemp(toAbs, out, opts);
      // rename(2) is the atomic commit: a crash here leaves the temp sidecar and
      // the untouched original, never a torn chapter file.
      renameSync(tmp, toAbs);
      // Only delete a GENUINELY distinct leftover (different inode), never the
      // file we just wrote.
      if (step.renameFile && fromAbs !== toAbs && existsSync(fromAbs) && statSync(fromAbs).ino !== statSync(toAbs).ino) {
        unlinkSync(fromAbs);
      }
    }
    applied.push(step);
    if (first && opts.faultInjection?.afterFirstRename) throw new Error("fault injection: afterFirstRename");
    first = false;
  }

  // 2. Canonical index — atomically rewrite the affected chapterId entries.
  let indexUpdated = false;
  if (plan.indexPresent && plan.steps.some((s) => s.updateIndex)) {
    if (opts.faultInjection?.beforeIndex) throw new Error("fault injection: beforeIndex");
    const indexAbs = resolve(REPO_ROOT, plan.indexPath);
    const index = readIndex(indexAbs) ?? [];
    const byNumber = new Map<number, IndexEntry>();
    for (const e of index) if (Number.isInteger(e.chapterNumber)) byNumber.set(Number(e.chapterNumber), e);
    for (const step of plan.steps) {
      const existing = byNumber.get(step.chapterNumber);
      if (existing) existing.chapterId = step.toChapterId;
      else {
        const fresh: IndexEntry = { chapterId: step.toChapterId, chapterNumber: step.chapterNumber, chapterTitle: "" };
        index.push(fresh);
        byNumber.set(step.chapterNumber, fresh);
      }
    }
    index.sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));
    const tmp = writeTemp(indexAbs, JSON.stringify(index, null, 2) + "\n", opts);
    renameSync(tmp, indexAbs);
    indexUpdated = true;
  }

  // 3. Final report.
  const reportPath = resolve(paths.migrationsDir, `${plan.bookId}-${stamp}.report.json`);
  writeFileAtomic(
    reportPath,
    JSON.stringify({ schemaVersion: "chapter-identity-migration-report-v1", appliedAt: new Date(nowMs(opts)).toISOString(), bookId: plan.bookId, applied, indexUpdated }, null, 2),
    "utf8",
  );
  return { bookId: plan.bookId, planPath: relReport(planPath), reportPath: relReport(reportPath), applied, indexUpdated };
}

/** V4 authority route. Replans under one short same-book lock; replay becomes a no-op. */
export async function applyChapterIdentityMigrationV4(
  plan: IdentityMigrationPlan,
  opts: IdentityMigrationV4Options = {},
): Promise<IdentityMigrationResult> {
  assertV4LibrarianWriterPreflight(opts.legacyWriterEnabled);
  if (!plan.ok) {
    throw new Error(`refusing to apply an ambiguous migration for "${plan.bookId}"`);
  }
  const stateDir = resolve(opts.stateDir ?? DEFAULT_STATE_DIR);
  const writeLock = opts.writeLock ?? createBookWriteLock({ booksRoot: stateDir, timeoutMs: 1_000, pollMs: 1 });
  const locked = await writeLock.run<IdentityMigrationResult>(plan.bookId, async (): Promise<Result<IdentityMigrationResult>> => {
    try {
      const current = planChapterIdentityMigration(plan.bookId, { ...opts, stateDir });
      if (!current.ok) {
        return { ok: false, error: { code: "LIBRARIAN_MIGRATION_AMBIGUOUS", message: current.ambiguities.join("; ") } } as const;
      }
      if (current.changeCount === 0) {
        return {
          ok: true,
          value: { bookId: plan.bookId, planPath: "", reportPath: "", applied: [], indexUpdated: false },
        };
      }
      const expected = JSON.stringify(plan.steps);
      if (JSON.stringify(current.steps) !== expected) {
        return { ok: false, error: { code: "LIBRARIAN_MIGRATION_STALE", message: "identity migration plan changed before lock acquisition" } } as const;
      }
      return { ok: true, value: applyChapterIdentityMigration(current, { ...opts, stateDir }) } as const;
    } catch (cause) {
      return { ok: false, error: { code: "LIBRARIAN_MIGRATION_IO", message: (cause as Error).message } } as const;
    }
  });
  if (!locked.ok) throw new Error(`${locked.error.code}: ${locked.error.message}`);
  return locked.value;
}
