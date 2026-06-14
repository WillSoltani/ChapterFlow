/**
 * Authoring guardrails — one pre-authoring sheet handed to every chapter agent so
 * parallel/blind authors don't independently reach for the same names and the same
 * catalog-wide stock phrases (the F1/BP13 collision class).
 *
 * It consolidates what already exists but was scattered or unwritten:
 *   - a per-chapter RESERVED NAME allocation (namePlan), unique WITHIN this book, so
 *     two parallel agents never pick the same protagonist (names MAY repeat across
 *     DIFFERENT books — owner policy; only within-book uniqueness is enforced);
 *   - a BANNED-PHRASE REGISTRY (genuinely new): the house tics, the book's own
 *     forbiddenMoves, the banned "salting" connectives, and — the catalog tell —
 *     the signature phrases that already recur across shipped books.
 *
 * Written to state/guardrails/<bookId>.guardrails.md; the generation prompt pastes
 * it into every authoring sub-prompt. Same prevention pattern as the voice bible.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { HOUSE_TICS } from "../critics/catalogAudit.js";
import { findCrossBookTells, runCrossBookSignatureAudit } from "../critics/crossBookSignatureAudit.js";
import { loadBrief } from "../lib/voiceBible.js";
import { planNames } from "./namePlan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const REPO_ROOT = resolve(PIPELINE_DIR, "../../../..");
const STATE_DIR = resolve(PIPELINE_DIR, "state");
const BOOK_PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const GUARDRAILS_DIR = resolve(STATE_DIR, "guardrails");

export function guardrailsPath(bookId: string): string {
  return resolve(GUARDRAILS_DIR, `${bookId}.guardrails.md`);
}

/** Best-effort chapter count: the index, else chapters already on disk. */
function chapterCount(bookId: string): number {
  const indexPath = resolve(STATE_DIR, "indexes", `${bookId}.json`);
  if (existsSync(indexPath)) {
    try {
      const idx = JSON.parse(readFileSync(indexPath, "utf8"));
      if (Array.isArray(idx) && idx.length) return idx.length;
    } catch { /* fall through */ }
  }
  try {
    const written = readdirSync(resolve(STATE_DIR, "chapters"))
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
  bannedPhrases: { houseTics: string[]; forbiddenMoves: string[]; connectives: string[]; catalogTells: string[] };
};

export function buildAuthoringGuardrails(bookId: string, opts: { chapters?: number } = {}): AuthoringGuardrails {
  const count = opts.chapters ?? chapterCount(bookId);
  if (count < 1) throw new Error(`Cannot build guardrails for ${bookId}: no chapter index or chapters on disk. Pass --chapters <N>.`);
  // forceFresh so the sheet proposes a clean reserved pool (unique within this
  // book), not an echo of names already on disk.
  const plan = planNames(bookId, 1, count, 7, { forceFresh: true });
  const brief = loadBrief(bookId) as { forbiddenMoves?: string[] } | null;
  return {
    bookId,
    chapters: count,
    allocation: plan.allocation,
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
  L.push("## Reserved protagonist names (per chapter — unique within this book)");
  L.push("Names are American/Canadian and disjoint across this book's chapters (they may repeat in OTHER books — that's fine).");
  L.push("Use ONLY your chapter's row. Do not reuse another chapter's names or invent recurring ones.");
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

export function writeAuthoringGuardrails(bookId: string, opts: { chapters?: number } = {}): string {
  const g = buildAuthoringGuardrails(bookId, opts);
  mkdirSync(GUARDRAILS_DIR, { recursive: true });
  const path = guardrailsPath(bookId);
  writeFileSync(path, formatGuardrails(g), "utf8");
  return path;
}
