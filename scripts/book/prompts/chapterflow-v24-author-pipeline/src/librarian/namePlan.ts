/**
 * Pre-authoring name plan — the structural fix for the parallel-authoring
 * collision class (book-gate F1 / BP13).
 *
 * Chapters authored concurrently in a batch are blind to each other, so parallel
 * agents independently reach for the same protagonist names (verified on Rework:
 * Halvard ch9/12, Yusuf ch12/13/14) and the same stock connectives (BP13).
 * book-gate catches it after the fact; this prevents it before.
 *
 * `planNames` deals each upcoming chapter a DISJOINT slice of protagonist names
 * drawn from config/name-bank.json under config/name-policy.json. Names are unique
 * within the current book and blocked by a catalog cooldown budget across recent
 * ledgered books. A per-book rotation offset still gives different books
 * different opening casts.
 *
 * Dealing is deterministic (stable bank order, sequential cursor) so the same
 * request always yields the same allocation, and authoring in ascending batches
 * is naturally incremental: later batches exclude earlier planned allocations
 * and continue past them. Already-planned chapters in a requested range carry
 * their RESERVED names through and do NOT consume fresh bank names, so a re-plan
 * is idempotent and never re-deals a sibling's name.
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
import { C7_BANNED_NAMES } from "../critics/finalGate.js";
import { extractNamesFromText, loadLibraryState, type LibraryStateOptions } from "./libraryState.js";
import { findSourceSidecar } from "./sourceSidecars.js";
import { fnv1a } from "../lib/fnv1a.js";
import { forbiddenNamesByPolicy, loadNamePolicy, type NamePolicyV1 } from "./namePolicy.js";

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
  namePolicy: {
    schemaVersion: "name-policy-v1";
    policyId: string;
    description: string;
  };
  diagnostics: {
    bankSize: number;
    excludedCount: number;
    /** bank names that also appear in OTHER chapter files — audit signal only.
     *  Policy enforcement comes from the ledger cooldown below. */
    crossBookReused: number;
    availableCount: number;
    /** chapters that got fewer than perChapter names because the bank ran dry */
    shortChapters: number[];
    /** chapters in [from,to] that already have an authored file (re-planning hazard) */
    alreadyAuthored: number[];
    /** bank names excluded because this book's source sidecars use them for source figures/cases. */
    sourceFigureExcluded: number;
    /** bank names excluded by the shared catalog cooldown policy. */
    policyExcluded: number;
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

/** Deterministic FNV-1a hash — used to scatter the bank so adjacent (= same
 *  chapter) names don't share an origin or an initial. Stable across runs (no
 *  Math.random) so allocations stay reproducible. */

/** Load + dedupe + validate + DE-CLUSTER the name bank.
 *
 *  The bank is grouped by tradition and roughly alphabetical within each group.
 *  Dealing it in that order clustered same-culture names into consecutive
 *  chapters (ch16-21 all Nordic) AND produced alphabetical name runs within a
 *  chapter (ch16: Asbjorn, Astrid, Bodil, Brage, Dagny… — a C9-ish scaffold a
 *  reader can spot) — both flagged by the ch16-23 QC. Sorting by a stable hash
 *  scatters origin and initial, so each chapter's disjoint slice reads like a
 *  varied real-world cast. Deterministic → allocations remain reproducible and
 *  re-plan stays idempotent. `path` defaults to the real committed config and
 *  is only overridden by tests (e.g. WP-602's doctor preflight corrupt-fixture
 *  coverage) so they never touch the real file. */
export function loadNameBank(path: string = NAME_BANK_PATH): string[] {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`name-bank config unreadable at ${path}: ${(err as Error).message}`);
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
  // Scatter: hash primary, name secondary (stable tie-break on hash collision).
  out.sort((a, b) => fnv1a(a) - fnv1a(b) || (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

type BannedConnectivesConfig = { principle: string; bannedConnectives: string[] };

export function loadBannedConnectives(path: string = BANNED_CONNECTIVES_PATH): BannedConnectivesConfig {
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`banned-connectives config unreadable at ${path}: ${(err as Error).message}`);
  }
  return {
    principle: typeof raw.principle === "string" ? raw.principle : "",
    bannedConnectives: Array.isArray(raw.bannedConnectives) ? raw.bannedConnectives.filter((s: unknown) => typeof s === "string") : [],
  };
}

/** Audit-only capitalized-word names per authored chapter (file-slot number -> names),
 *  scenarios only. The number is taken from the
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

/** Flattened audit union of usedNamesByChapter. Not a policy/accounting source. */
export function usedNamesInBook(bookId: string): Set<string> {
  const used = new Set<string>();
  for (const names of Object.values(usedNamesByChapter(bookId))) {
    for (const n of names) used.add(n);
  }
  return used;
}

/** Bank names already used by any OTHER book in state/chapters — INFORMATIONAL
 *  ONLY (the diagnostics.crossBookReused count). Policy exclusion comes from the
 *  ledger cooldown, not this heuristic scan. Only BANK members count: junk
 *  capitalized tokens from prose must not poison the audit signal. */
export function bankNamesUsedByOtherBooks(bookId: string): Set<string> {
  const bank = new Set(loadNameBank());
  const used = new Set<string>();
  let files: string[] = [];
  try {
    files = readdirSync(CHAPTERS_DIR).filter((f) => f.endsWith(".chapter.json"));
  } catch {
    return used;
  }
  for (const f of files) {
    if (isSiblingFile(f, bookId)) continue; // this book's own names are handled separately
    try {
      const ch = JSON.parse(readFileSync(resolve(CHAPTERS_DIR, f), "utf8")) as ChapterV21;
      for (const ex of ch.examples ?? []) {
        for (const n of extractNamesFromText(ex.scenario ?? "")) {
          if (bank.has(n)) used.add(n);
        }
      }
    } catch {
      // unreadable chapter — skip
    }
  }
  return used;
}

function plannedNamesByChapter(bookId: string, opts: Pick<LibraryStateOptions, "stateDir" | "namePlansDir"> = {}): Record<number, string[]> {
  const stateDir = opts.stateDir ? resolve(opts.stateDir) : resolve(__dirname, "../../state");
  const dir = opts.namePlansDir ? resolve(opts.namePlansDir) : resolve(stateDir, "name-plans");
  const path = resolve(dir, `${bookId}.name-plan.json`);
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(raw) || !isRecord(raw.allocation)) return {};
    const out: Record<number, string[]> = {};
    for (const [chapter, names] of Object.entries(raw.allocation)) {
      const n = Number(chapter);
      if (!Number.isInteger(n) || !Array.isArray(names)) continue;
      out[n] = [...new Set(names.filter((name): name is string => typeof name === "string").map((name) => name.trim()).filter(Boolean))].sort();
    }
    return out;
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sidecarNameTexts(sidecar: unknown): string[] {
  const texts: string[] = [];
  if (!isRecord(sidecar)) return texts;
  const namedExamples = Array.isArray(sidecar.namedExamples) ? sidecar.namedExamples : [];
  for (const entry of namedExamples) {
    if (typeof entry === "string") {
      texts.push(entry);
      continue;
    }
    if (!isRecord(entry)) continue;
    if (typeof entry.label === "string") texts.push(entry.label);
    if (typeof entry.summary === "string") texts.push(entry.summary);
    if (Array.isArray(entry.hardSpecifics)) {
      for (const specific of entry.hardSpecifics) {
        if (typeof specific === "string") texts.push(specific);
      }
    }
  }
  if (Array.isArray(sidecar.properNouns)) {
    for (const properNoun of sidecar.properNouns) {
      if (typeof properNoun === "string") texts.push(properNoun);
    }
  }
  return texts;
}

function sourceFigureBankNames(bookId: string, fromChapter: number, toChapter: number, bank: Set<string>): Set<string> {
  const excluded = new Set<string>();
  for (let chapter = fromChapter; chapter <= toChapter; chapter++) {
    const path = findSourceSidecar(bookId, chapter);
    if (!path) {
      console.warn(`name-plan: no source sidecar for "${bookId}" ch${String(chapter).padStart(2, "0")}; source-figure name exclusion skipped for this chapter.`);
      continue;
    }
    let sidecar: unknown;
    try {
      sidecar = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      console.warn(`name-plan: unreadable source sidecar for "${bookId}" ch${String(chapter).padStart(2, "0")}: ${(err as Error).message}`);
      continue;
    }
    for (const text of sidecarNameTexts(sidecar)) {
      for (const name of extractNamesFromText(text)) {
        if (bank.has(name)) excluded.add(name);
      }
    }
  }
  return excluded;
}

export function planNames(
  rawBookId: string,
  fromChapter: number,
  toChapter: number,
  perChapter = 7,
  opts: {
    lookback?: number;
    /** Deal fresh names even for already-planned chapters. The refresh path
     *  needs this to produce rename maps instead of carrying the prior reserved
     *  allocation through unchanged. */
    forceFresh?: boolean;
    stateDir?: string;
    namePlansDir?: string;
    namePolicy?: NamePolicyV1;
  } = {},
): NamePlan {
  if (toChapter < fromChapter) throw new Error(`toChapter (${toChapter}) < fromChapter (${fromChapter})`);
  if (perChapter < 1) throw new Error(`perChapter must be >= 1 (got ${perChapter})`);
  // Normalize once so usedNamesByChapter (isSiblingFile) and the written plan
  // filename key off the SAME id (the case-sensitivity asymmetry the review flagged).
  const bookId = normSlug(rawBookId);

  const usedByChapter = plannedNamesByChapter(bookId, opts);
  const usedAll = new Set<string>();
  for (const names of Object.values(usedByChapter)) for (const n of names) usedAll.add(n);

  const policy = opts.namePolicy ?? loadNamePolicy();
  const ledger = loadLibraryState({ stateDir: opts.stateDir, namePlansDir: opts.namePlansDir, namePolicy: policy });
  const policyForbidden = forbiddenNamesByPolicy(
    Object.values(ledger.books).map((book) => ({ bookId: book.bookId, generatedAt: book.generatedAt, namesUsed: book.namesUsed })),
    bookId,
    opts.lookback === undefined
      ? policy
      : { ...policy, catalogCooldown: { ...policy.catalogCooldown, lookbackBooks: opts.lookback } },
  );

  // The shared policy blocks current-book planned names plus recent catalog
  // cooldown names. Capitalized-word extraction is only a diagnostic/audit signal.
  const bank = loadNameBank();
  const bankSet = new Set(bank);
  const sourceFigures = sourceFigureBankNames(bookId, fromChapter, toChapter, bankSet);
  const crossBook = bankNamesUsedByOtherBooks(bookId);
  const offset = bank.length ? fnv1a(bookId) % bank.length : 0;
  const rotated = bank.slice(offset).concat(bank.slice(0, offset));
  // Never DEAL a name the C7 ship-gate bans (single source of truth: C7_BANNED_NAMES).
  // The gate only LICENSES a freshly-dealt banned name, and that license evaporates once
  // the chapter is on disk (the echo-loophole) — so a dealt banned name becomes a
  // guaranteed late blocker. Subtracting it here keeps deal↔gate consistent up front.
  const bannedC7 = new Set(C7_BANNED_NAMES);
  const available = rotated.filter((n) => !usedAll.has(n) && !sourceFigures.has(n) && !bannedC7.has(n) && !policyForbidden.has(n));
  const needed = perChapter * Math.max(0, toChapter - fromChapter + 1);
  if (available.length < needed) {
    console.warn(
        `name-plan: only ${available.length}/${needed} names available for "${bookId}" after applying ${policy.policyId} — ` +
        `grow config/name-bank.json or adjust config/name-policy.json.`,
    );
  }

  const allocation: Record<number, string[]> = {};
  const shortChapters: number[] = [];
  const alreadyAuthored: number[] = [];
  // forceFresh (the `--all` re-dispatch path) keys the slice to the chapter's
  // position in the BOOK, not the call's range, so chapter N always gets
  // available[(N-1)*perChapter ...]. Without this, a per-chapter re-dispatch
  // (`fanout --from N --to N --all`, what the barrier prints) starts cursor at 0
  // and deals available[0:perChapter] — so two offenders dealt in SEPARATE calls
  // collide on the same fresh names, an F1 reintroduction. A whole-book forceFresh
  // (fromChapter=1) is unchanged (cursor 0, advances normally). Clamp so a chapter
  // past the bank degrades to a short slice/warn rather than an out-of-range start.
  let cursor = opts.forceFresh ? Math.min((fromChapter - 1) * perChapter, Math.max(0, available.length - perChapter)) : 0;
  for (let ch = fromChapter; ch <= toChapter; ch++) {
    if (!opts.forceFresh && usedByChapter[ch] !== undefined) {
      // Planned already: carry its RESERVED names through (idempotent re-plan)
      // and do NOT consume fresh bank names — so a re-plan can never re-deal a
      // name a sibling already owns.
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
    namePolicy: {
      schemaVersion: policy.schemaVersion,
      policyId: policy.policyId,
      description: policy.description,
    },
    diagnostics: {
      bankSize: bank.length,
      excludedCount: usedAll.size,
      crossBookReused: crossBook.size,
      availableCount: available.length,
      shortChapters,
      alreadyAuthored,
      sourceFigureExcluded: sourceFigures.size,
      policyExcluded: [...policyForbidden].filter((n) => bankSet.has(n)).length,
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
      (d.sourceFigureExcluded ? `  source-figures-excluded:${d.sourceFigureExcluded}` : "") +
      (d.policyExcluded ? `  policy-excluded:${d.policyExcluded}` : "") +
      (d.shortChapters.length ? `  ⚠ SHORT (bank dry) in ch: ${d.shortChapters.join(",")}` : "") +
      (d.alreadyAuthored.length ? `  ℹ already-planned in range: ${d.alreadyAuthored.join(",")} (showing reserved names; only unplanned chapters get fresh allocations)` : ""),
  );
  lines.push(`  policy: ${plan.namePolicy.policyId} — ${plan.namePolicy.description}`);
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
