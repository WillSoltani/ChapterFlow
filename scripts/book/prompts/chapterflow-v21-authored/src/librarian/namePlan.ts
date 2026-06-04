/**
 * Pre-authoring name plan — the structural fix for the parallel-authoring
 * collision class (book-gate F1 / BP13).
 *
 * The library ledger (libraryState.ts) enforces name uniqueness CROSS-book and
 * within-book-AT-INGEST. But chapters authored concurrently in a batch are not
 * ingested until after they exist, so blind parallel agents independently reach
 * for the same protagonist names (verified on Rework: Halvard ch9/12, Yusuf
 * ch12/13/14) and the same stock connectives (BP13). book-gate catches it after
 * the fact; this prevents it before.
 *
 * `planNames` deals each upcoming chapter a DISJOINT slice of protagonist names
 * drawn from config/name-bank.json, after excluding:
 *   - cross-book + within-book-ingested names (getForbiddenNames)
 *   - names already present in this book's authored chapter files
 *     (usedNamesInBook — robust to chapters that exist but were never ingested)
 *
 * Dealing is deterministic (stable bank order, sequential cursor) so the same
 * request always yields the same allocation, and authoring in ascending batches
 * is naturally incremental: later batches exclude earlier chapters' real names
 * and continue past them. Already-authored chapters in a requested range carry
 * their REAL names through (read from the file) and do NOT consume fresh bank
 * names, so a re-plan is idempotent and never re-deals a sibling's name.
 *
 * SCOPE: the name plan prevents NAME collisions (F1) only — it deals disjoint
 * protagonist names. It does NOT by itself prevent BP13, which fires on verbatim
 * 5-token PROSE windows (scenario/whatToDo/whyItMatters) that exclude names.
 * BP13 is addressed separately by the (preventive, non-exhaustive) banned-
 * connectives guidance handed to each agent plus the post-hoc BP13 gate.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { ChapterV21 } from "../types.js";
import { CHAPTERS_DIR, isSiblingFile, normSlug } from "../lib/chapterPaths.js";
import { extractNamesFromText, getForbiddenNames, loadLibraryState } from "./libraryState.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/librarian
const CONFIG_DIR = resolve(__dirname, "../../config");
const NAME_BANK_PATH = resolve(CONFIG_DIR, "name-bank.json");
const BANNED_CONNECTIVES_PATH = resolve(CONFIG_DIR, "banned-connectives.json");
const NAME_PLANS_DIR = resolve(__dirname, "../../state/name-plans");

export type NamePlan = {
  bookId: string;
  fromChapter: number;
  toChapter: number;
  perChapter: number;
  /** chapter number -> allocated protagonist names (disjoint across chapters) */
  allocation: Record<number, string[]>;
  bannedConnectives: string[];
  connectivePrinciple: string;
  diagnostics: {
    bankSize: number;
    excludedCount: number;
    availableCount: number;
    /** chapters that got fewer than perChapter names because the bank ran dry */
    shortChapters: number[];
    /** chapters in [from,to] that already have an authored file (re-planning hazard) */
    alreadyAuthored: number[];
  };
};

/** A name is bankable iff the SAME extractor F1 uses (extractNamesFromText)
 *  returns exactly that name — i.e. it matches /[A-Z][a-z]{2,}/ AND is not a
 *  NAME_STOPWORD. This guarantees every allocated name is one the F1 collision
 *  check can actually see, and silently drops accented/short/stopword entries. */
function isBankable(name: string): boolean {
  const got = extractNamesFromText(name);
  return got.length === 1 && got[0] === name;
}

/** Load + flatten + dedupe (first-occurrence order) + validate the name bank. */
export function loadNameBank(): string[] {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(NAME_BANK_PATH, "utf8")) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`name-bank config unreadable at ${NAME_BANK_PATH}: ${(err as Error).message}`);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("_") || !Array.isArray(val)) continue; // skip _comment etc.
    for (const n of val) {
      if (typeof n !== "string") continue;
      const name = n.trim();
      if (seen.has(name)) continue;
      seen.add(name);
      if (isBankable(name)) out.push(name);
    }
  }
  return out;
}

type BannedConnectivesConfig = { principle: string; bannedConnectives: string[] };

export function loadBannedConnectives(): BannedConnectivesConfig {
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(BANNED_CONNECTIVES_PATH, "utf8"));
  } catch (err) {
    throw new Error(`banned-connectives config unreadable at ${BANNED_CONNECTIVES_PATH}: ${(err as Error).message}`);
  }
  return {
    principle: typeof raw.principle === "string" ? raw.principle : "",
    bannedConnectives: Array.isArray(raw.bannedConnectives) ? raw.bannedConnectives.filter((s: unknown) => typeof s === "string") : [],
  };
}

/** Protagonist names per authored chapter (file-slot number -> names), scenarios
 *  only, matching ingestChapter's extraction. The number is taken from the
 *  FILENAME slot (case-insensitive via isSiblingFile), not chapter.number, so it
 *  stays correct even under the chapterId/filename casing drift. Robust to
 *  chapters on disk that were never ingested into the ledger. A present-but-empty
 *  chapter still registers a key (so it counts as authored). */
export function usedNamesByChapter(bookId: string): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  let files: string[] = [];
  try {
    files = readdirSync(CHAPTERS_DIR).filter((f) => isSiblingFile(f, bookId));
  } catch {
    return out;
  }
  for (const f of files) {
    const m = f.match(/-ch(\d{1,3})\.v21-native\.chapter\.json$/i);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    try {
      const ch = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, f), "utf8")) as ChapterV21;
      const names = new Set<string>();
      for (const ex of ch.examples ?? []) {
        for (const n of extractNamesFromText(ex.scenario ?? "")) names.add(n);
      }
      out[num] = Array.from(names);
    } catch {
      // skip unparseable file (do NOT register a key — we can't carry its names)
    }
  }
  return out;
}

/** Flattened union of usedNamesByChapter — every protagonist name already in
 *  this book's authored chapters. */
export function usedNamesInBook(bookId: string): Set<string> {
  const used = new Set<string>();
  for (const names of Object.values(usedNamesByChapter(bookId))) {
    for (const n of names) used.add(n);
  }
  return used;
}

export function planNames(
  rawBookId: string,
  fromChapter: number,
  toChapter: number,
  perChapter = 7,
  opts: { lookback?: number } = {},
): NamePlan {
  if (toChapter < fromChapter) throw new Error(`toChapter (${toChapter}) < fromChapter (${fromChapter})`);
  if (perChapter < 1) throw new Error(`perChapter must be >= 1 (got ${perChapter})`);
  // Normalize once so getForbiddenNames, usedNamesByChapter (isSiblingFile), and
  // the written plan filename all key off the SAME id (the case-sensitivity
  // asymmetry the review flagged).
  const bookId = normSlug(rawBookId);

  const state = loadLibraryState();
  const usedByChapter = usedNamesByChapter(bookId);
  const usedAll = new Set<string>();
  for (const names of Object.values(usedByChapter)) for (const n of names) usedAll.add(n);

  const excluded = new Set<string>([
    ...getForbiddenNames(state, bookId, opts.lookback ?? 10),
    ...usedAll,
  ]);

  const bank = loadNameBank();
  const available = bank.filter((n) => !excluded.has(n));

  const allocation: Record<number, string[]> = {};
  const shortChapters: number[] = [];
  const alreadyAuthored: number[] = [];
  let cursor = 0;
  for (let ch = fromChapter; ch <= toChapter; ch++) {
    if (usedByChapter[ch] !== undefined) {
      // Authored already: carry its REAL names through (idempotent re-plan) and
      // do NOT consume fresh bank names — so a re-plan can never re-deal a name a
      // sibling already owns (the F1-reintroduction the review flagged).
      allocation[ch] = usedByChapter[ch];
      alreadyAuthored.push(ch);
      continue;
    }
    const slice = available.slice(cursor, cursor + perChapter);
    cursor += perChapter;
    allocation[ch] = slice;
    if (slice.length < perChapter) shortChapters.push(ch);
  }

  const { principle, bannedConnectives } = loadBannedConnectives();

  return {
    bookId,
    fromChapter,
    toChapter,
    perChapter,
    allocation,
    bannedConnectives,
    connectivePrinciple: principle,
    diagnostics: {
      bankSize: bank.length,
      excludedCount: excluded.size,
      availableCount: available.length,
      shortChapters,
      alreadyAuthored,
    },
  };
}

/** Persist the plan so each STEP-2 agent (and re-runs) read one canonical file. */
export function writeNamePlan(plan: NamePlan): string {
  mkdirSync(NAME_PLANS_DIR, { recursive: true });
  const path = resolve(NAME_PLANS_DIR, `${plan.bookId}.name-plan.json`);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return path;
}

/** Human + agent-readable rendering (used by the CLI). */
export function formatNamePlan(plan: NamePlan): string {
  const d = plan.diagnostics;
  const lines: string[] = [];
  lines.push(`Name plan — ${plan.bookId}  ch${plan.fromChapter}–${plan.toChapter}  (${plan.perChapter}/chapter)`);
  lines.push(
    `  bank:${d.bankSize}  excluded:${d.excludedCount}  available:${d.availableCount}` +
      (d.shortChapters.length ? `  ⚠ SHORT (bank dry) in ch: ${d.shortChapters.join(",")}` : "") +
      (d.alreadyAuthored.length ? `  ℹ already-authored in range: ${d.alreadyAuthored.join(",")} (showing their real names; only un-authored chapters get fresh allocations)` : ""),
  );
  lines.push("");
  for (let ch = plan.fromChapter; ch <= plan.toChapter; ch++) {
    lines.push(`  ch${ch}: ${(plan.allocation[ch] ?? []).join(", ")}`);
  }
  lines.push("");
  lines.push(`Banned connectives (do NOT reuse any 5-word run across chapters):`);
  lines.push(`  ${plan.connectivePrinciple}`);
  for (const c of plan.bannedConnectives) lines.push(`    - "${c}"`);
  return lines.join("\n");
}
