/**
 * Authoring guardrails — one pre-authoring sheet handed to every chapter agent so
 * parallel/blind authors don't independently reach for the same names and the same
 * catalog-wide stock phrases (the F1/BP13 collision class).
 *
 * It consolidates what already exists but was scattered or unwritten:
 *   - a per-chapter RESERVED NAME allocation (namePlan), unique WITHIN this book and
 *     filtered by the shared catalog cooldown policy, so parallel agents never
 *     pick the same protagonist or a recently reserved catalog name;
 *   - a BANNED-PHRASE REGISTRY (genuinely new): the house tics, the book's own
 *     forbiddenMoves, the banned "salting" connectives, and — the catalog tell —
 *     the signature phrases that already recur across shipped books.
 *
 * Written to state/guardrails/<bookId>.guardrails.md; the generation prompt pastes
 * it into every authoring sub-prompt. Same prevention pattern as the voice bible.
 */

import { mkdirSync, readFileSync, readdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createBookWriteLock } from "../books/bookLease.js";
import { assertV4LibrarianWriterPreflight } from "../books/legacyLibrarianStateAdapter.js";
import type { BookWriteLock } from "../books/leaseTypes.js";
import { HOUSE_TICS } from "../critics/catalogAudit.js";
import { findCrossBookTells, runCrossBookSignatureAudit } from "../critics/crossBookSignatureAudit.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { loadBrief } from "../lib/voiceBible.js";
import { planNames } from "./namePlan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const REPO_ROOT = PIPELINE_DIR;
const STATE_DIR = resolve(PIPELINE_DIR, "state");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");

export type AuthoringGuardrailsOptions = {
  chapters?: number;
  stateDir?: string;
  namePlansDir?: string;
};

export type AuthoringGuardrailsV4Options = AuthoringGuardrailsOptions & {
  writeLock?: BookWriteLock;
  legacyWriterEnabled?: boolean;
};

export function guardrailsPath(bookId: string, stateDir = STATE_DIR): string {
  return resolve(stateDir, "guardrails", `${bookId}.guardrails.md`);
}

/** Best-effort chapter count: the index, else chapters already on disk. */
function chapterCount(bookId: string, stateDir = STATE_DIR): number {
  const indexPath = resolve(stateDir, "indexes", `${bookId}.json`);
  if (existsSync(indexPath)) {
    try {
      const idx = JSON.parse(readFileSync(indexPath, "utf8"));
      if (Array.isArray(idx) && idx.length) return idx.length;
    } catch { /* fall through */ }
  }
  try {
    const written = readdirSync(resolve(stateDir, "chapters"))
      .filter((f) => new RegExp(`^${bookId}-ch\\d+\\.v21-native\\.chapter\\.json$`, "i").test(f));
    if (written.length) return written.length;
  } catch { /* none */ }
  return 0;
}

/** The signature phrases already recurring across SHIPPED books — the catalog
 *  voice tells a new book should NOT reproduce. Empty when nothing is shipped. */
function catalogTells(limit = 20): string[] {
  if (!existsSync(BOOK_PACKAGES_DIR)) return [];
  try {
    const tells = findCrossBookTells(runCrossBookSignatureAudit(BOOK_PACKAGES_DIR));
    return tells.slice(0, limit).map((t) => `"${t.phrase}" (in ${t.bookCount} books)`);
  } catch {
    return [];
  }
}

export type AuthoringGuardrails = {
  bookId: string;
  chapters: number;
  allocation: Record<number, string[]>;
  namePolicy: {
    schemaVersion: "name-policy-v1";
    policyId: string;
    description: string;
  };
  bannedPhrases: { houseTics: string[]; forbiddenMoves: string[]; connectives: string[]; catalogTells: string[] };
};

export function buildAuthoringGuardrails(bookId: string, opts: AuthoringGuardrailsOptions = {}): AuthoringGuardrails {
  const stateDir = resolve(opts.stateDir ?? STATE_DIR);
  const count = opts.chapters ?? chapterCount(bookId, stateDir);
  if (count < 1) throw new Error(`Cannot build guardrails for ${bookId}: no chapter index or chapters on disk. Pass --chapters <N>.`);
  // forceFresh so the sheet proposes a clean reserved pool (unique within this
  // book), not an echo of names already on disk.
  const plan = planNames(bookId, 1, count, 7, { forceFresh: true, stateDir: opts.stateDir, namePlansDir: opts.namePlansDir });
  const brief = loadBrief(bookId) as { forbiddenMoves?: string[] } | null;
  return {
    bookId,
    chapters: count,
    allocation: plan.allocation,
    namePolicy: plan.namePolicy,
    bannedPhrases: {
      houseTics: [...HOUSE_TICS],
      forbiddenMoves: brief?.forbiddenMoves ?? [],
      connectives: plan.bannedConnectives,
      catalogTells: catalogTells(),
    },
  };
}

export function formatGuardrails(g: AuthoringGuardrails): string {
  const L: string[] = [];
  L.push(`# Authoring guardrails — ${g.bookId}`);
  L.push("");
  L.push("Hand this to every chapter author BEFORE writing. It keeps parallel authors from");
  L.push("colliding on names and from reproducing the catalog's stock phrases.");
  L.push("");
  L.push("## Reserved protagonist names (per chapter)");
  L.push(`Policy: ${g.namePolicy.policyId}`);
  L.push(g.namePolicy.description);
  L.push("Use ONLY your chapter's row. Do not reuse another chapter's names, recently reserved catalog names, or invented recurring names.");
  for (const [num, names] of Object.entries(g.allocation).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    L.push(`- ch${String(num).padStart(2, "0")}: ${names.join(", ")}`);
  }
  L.push("");
  L.push("## Banned phrases (do NOT use)");
  if (g.bannedPhrases.catalogTells.length) {
    L.push("Catalog signature tells — already overused across shipped books, avoid verbatim:");
    for (const t of g.bannedPhrases.catalogTells) L.push(`  - ${t}`);
  }
  L.push(`House tics: ${g.bannedPhrases.houseTics.map((t) => `"${t}"`).join(", ")}`);
  if (g.bannedPhrases.connectives.length) L.push(`Salting connectives: ${g.bannedPhrases.connectives.map((c) => `"${c}"`).join(", ")}`);
  if (g.bannedPhrases.forbiddenMoves.length) {
    L.push("Book-specific forbidden moves (from the brief):");
    for (const m of g.bannedPhrases.forbiddenMoves) L.push(`  - ${m}`);
  }
  L.push("");
  return L.join("\n");
}

function writeBuiltAuthoringGuardrails(g: AuthoringGuardrails, opts: AuthoringGuardrailsOptions): string {
  const path = guardrailsPath(g.bookId, resolve(opts.stateDir ?? STATE_DIR));
  writeFileAtomic(path, formatGuardrails(g), "utf8");
  return path;
}

export function writeAuthoringGuardrails(bookId: string, opts: AuthoringGuardrailsOptions = {}): string {
  const g = buildAuthoringGuardrails(bookId, opts);
  return writeBuiltAuthoringGuardrails(g, opts);
}

/** V4 authority route. Build stays outside lock; only one atomic replacement runs inside it. */
export async function writeAuthoringGuardrailsV4(
  bookId: string,
  opts: AuthoringGuardrailsV4Options = {},
): Promise<string> {
  assertV4LibrarianWriterPreflight(opts.legacyWriterEnabled);
  const stateDir = resolve(opts.stateDir ?? STATE_DIR);
  const built = buildAuthoringGuardrails(bookId, { ...opts, stateDir });
  mkdirSync(stateDir, { recursive: true });
  const writeLock = opts.writeLock ?? createBookWriteLock({ booksRoot: stateDir, timeoutMs: 1_000, pollMs: 1 });
  const locked = await writeLock.run(bookId, async () => {
    try {
      return { ok: true, value: writeBuiltAuthoringGuardrails(built, { ...opts, stateDir }) } as const;
    } catch (cause) {
      return { ok: false, error: { code: "LIBRARIAN_GUARDRAILS_IO", message: (cause as Error).message } } as const;
    }
  });
  if (!locked.ok) throw new Error(`${locked.error.code}: ${locked.error.message}`);
  return locked.value;
}
