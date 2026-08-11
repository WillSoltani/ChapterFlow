/**
 * Per-book design pools (P14).
 *
 * Before P14 every variety pool the blueprint deals from — scene frames, beats, venues, practice
 * constraints/forms, action mechanisms, weekly forms — was a single global constant shared by every
 * book (chapterBlueprint.ts). That produced two failures the rubric panel flagged: catalog-level
 * SAMENESS (every book reads from one voice/pool) and genre MISMATCH (a PMBOK chapter dealt "a
 * stranger's small gesture"; any book dealt the twelve INVESTING documents as fallback venues).
 *
 * This module makes those pools per-book while keeping blueprints DETERMINISTIC: the pools are a
 * compiled, hash-pinned artifact (BookDesignV1, like a source packet), not runtime model output.
 * Derivation instantiates GENRE-tagged static templates with the book's OWN research material
 * (mined from the compiled source packets), then tops up from the genre static pools to reach the
 * required floors. NO LLM in this path — a future enrichment step can add a gated model pass.
 *
 * Consumption (resolvePools) is byte-compat-first: a book WITHOUT a design artifact and mapped to
 * the `generic` genre resolves to the caller's LEGACY in-code constants unchanged, so every book
 * compiled before P14 (and every existing test fixture) stays byte-identical.
 */
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { normSlug } from "../lib/chapterPaths.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import { readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { C7_BANNED_NAMES } from "../critics/finalGate.js";
import { loadVenuePalette, planVenuesFromPalette } from "../librarian/venuePlan.js";
import {
  bookDesignPath,
  readJsonFile,
  sourcePacketPath,
  writeJsonFile,
  type CompilerStoreRoots,
} from "../artifacts/artifactStore.js";
import {
  BOOK_DESIGN_SCHEMA_VERSION,
  type BookDesignPools,
  type BookDesignV1,
  type SourcePacketV1,
} from "../artifacts/artifactTypes.js";
import { properNounTokens, uniq } from "./sourcePacketFacts.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/compiler
const GENRE_POOLS_PATH = resolve(__dirname, "../../config/genre-pools.json");
const BOOKS_JSON_PATH = resolve(__dirname, "../../books.json");
const EXAMPLE_SLOT_COUNT = 6;

// ── Genres ───────────────────────────────────────────────────────────────────

export const GENRES = ["generic", "business-decision", "experience-design", "investing", "process-standard", "habits-psychology"] as const;
export type Genre = (typeof GENRES)[number];

/** books.json category (Title Case, config/categories.json taxonomy) → genre. Every category maps
 *  to SOME genre; anything unlisted (and every book with no category, which is all of books.json
 *  today) defaults to `generic`, i.e. the legacy byte-compat pool. Adding a `category` to a
 *  books.json entry is the opt-in that routes a NEW book onto genre pools. */
const CATEGORY_TO_GENRE: Record<string, Genre> = {
  "Investing": "investing",
  "Business": "business-decision",
  "Management": "business-decision",
  "Strategy": "business-decision",
  "Decision Making": "business-decision",
  "Leadership": "business-decision",
  "Negotiation": "business-decision",
  "Entrepreneurship": "business-decision",
  "Innovation": "experience-design",
  "Psychology": "habits-psychology",
  "Behavioral Economics": "habits-psychology",
  "Self-Help": "habits-psychology",
  "Relationships": "habits-psychology",
  "Communication": "habits-psychology",
  "Productivity": "generic",
  "Learning": "generic",
  "Philosophy": "generic",
};

function normalizeGenre(value: unknown): Genre {
  return (GENRES as readonly string[]).includes(value as string) ? (value as Genre) : "generic";
}

let cachedBooks: Array<{ bookId?: string; category?: string; categories?: string[] }> | null = null;
function loadBooks(): Array<{ bookId?: string; category?: string; categories?: string[] }> {
  if (cachedBooks) return cachedBooks;
  try {
    cachedBooks = readJsonFile<Array<{ bookId?: string; category?: string; categories?: string[] }>>(BOOKS_JSON_PATH);
  } catch {
    cachedBooks = [];
  }
  return cachedBooks ?? [];
}

/** Resolve a book's genre. Explicit `opts.genre` wins (test injection / caller override); else the
 *  book's category (explicit `opts.category`, then a `category`/`categories[0]` field on its
 *  books.json entry) is mapped via CATEGORY_TO_GENRE; else `generic`. */
export function genreForBook(bookId: string, opts: { genre?: string; category?: string } = {}): Genre {
  if (opts.genre) return normalizeGenre(opts.genre);
  const category = opts.category
    ?? (() => {
      const entry = loadBooks().find((b) => b.bookId && normSlug(b.bookId) === normSlug(bookId));
      return entry?.category ?? entry?.categories?.[0];
    })();
  if (category && CATEGORY_TO_GENRE[category]) return CATEGORY_TO_GENRE[category];
  return "generic";
}

// ── Genre static pools ─────────────────────────────────────────────────────────

type GenrePoolConfig = { genres: Record<string, BookDesignPools> };
let cachedGenrePools: GenrePoolConfig | null = null;
function genrePoolsConfig(): GenrePoolConfig {
  if (cachedGenrePools) return cachedGenrePools;
  cachedGenrePools = readJsonFile<GenrePoolConfig>(GENRE_POOLS_PATH);
  return cachedGenrePools;
}

let cachedGlobalPalette: string[] | null = null;
function globalNeutralVenues(): string[] {
  if (cachedGlobalPalette) return cachedGlobalPalette;
  try {
    cachedGlobalPalette = loadVenuePalette();
  } catch {
    cachedGlobalPalette = [];
  }
  return cachedGlobalPalette ?? [];
}

/** Per-pool minimum sizes. Frames/constraints match the prompt's floors (≥24 decision frames, ≥12
 *  experiential, ≥24 constraints); the smaller shape pools carry modest floors so a genre with a
 *  short static list is always topped up enough to deal a whole book without a monoculture. Venues
 *  are floored separately (chapter-count dependent). */
export const POOL_FLOORS = {
  sceneFramesDecision: 24,
  sceneFramesExperiential: 12,
  beatsDecision: 8,
  beatsExperiential: 6,
  practiceConstraints: 24,
  practiceForms: 8,
  actionMechanisms: 6,
  weeklyForms: 6,
} as const;

/** Venue floor: enough venues to keep venuePlan's cap-2 math holding across the book. A cap-2
 *  allocation of PER_CHAPTER=6 venues over C chapters needs L ≥ 3·C (6·C ≤ 2·L). Capped at 34
 *  chapters (venuePlan's own ceiling) and floored at 12 (venuePlan needs > 2·6-1 to keep adjacent
 *  chapters disjoint). Matches the prompt's `max(12, 6·min(chapters,34)/2)`. */
export function venueFloor(chapters: number): number {
  return Math.max(12, 3 * Math.min(Math.max(chapters, 1), 34));
}

/** uniq(primary) verbatim (ALL of it, even past the floor), then top up from `topups` only until
 *  `floor` is reached. Keeping all of primary preserves genre/derived FLAVOR at the head of the
 *  pool; the top-up merely guarantees the floor. Trims/dedupes blank + duplicate entries. */
function buildPool(primary: readonly string[], topups: readonly (readonly string[])[], floor: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (x: string): void => {
    const v = (x ?? "").trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  for (const x of primary) push(x);
  for (const src of topups) {
    for (const x of src) {
      if (out.length >= floor) return out;
      push(x);
    }
  }
  return out;
}

/** The genre-tagged static pools for `genre`, each topped up from the `generic` neutral superset
 *  (venues additionally from the global neutral palette) to its floor. This is the base every
 *  derived pool prepends its mined entries onto, and the whole pool set the genre-fallback path
 *  (no design artifact) resolves to. */
export function buildGenrePools(genre: Genre, chapters: number): BookDesignPools {
  const cfg = genrePoolsConfig().genres;
  const gp = cfg[genre] ?? cfg.generic;
  const gen = cfg.generic;
  return {
    sceneFramesDecision: buildPool(gp.sceneFramesDecision, [gen.sceneFramesDecision], POOL_FLOORS.sceneFramesDecision),
    sceneFramesExperiential: buildPool(gp.sceneFramesExperiential, [gen.sceneFramesExperiential], POOL_FLOORS.sceneFramesExperiential),
    beatsDecision: buildPool(gp.beatsDecision, [gen.beatsDecision], POOL_FLOORS.beatsDecision),
    beatsExperiential: buildPool(gp.beatsExperiential, [gen.beatsExperiential], POOL_FLOORS.beatsExperiential),
    venues: buildPool(gp.venues, [gen.venues, globalNeutralVenues()], venueFloor(chapters)),
    practiceConstraints: buildPool(gp.practiceConstraints, [gen.practiceConstraints], POOL_FLOORS.practiceConstraints),
    practiceForms: buildPool(gp.practiceForms, [gen.practiceForms], POOL_FLOORS.practiceForms),
    actionMechanisms: buildPool(gp.actionMechanisms, [gen.actionMechanisms], POOL_FLOORS.actionMechanisms),
    weeklyForms: buildPool(gp.weeklyForms, [gen.weeklyForms], POOL_FLOORS.weeklyForms),
  };
}

/** The investing document venues, sourced from the config so BD5.genre_mismatch and the
 *  consumption-time guard agree on exactly which venues are investing-only. */
export function investingVenues(): string[] {
  return (genrePoolsConfig().genres.investing?.venues ?? []).map((v) => v.trim()).filter(Boolean);
}

// ── Banned-content screen (shared by derivation + BD4 gate) ─────────────────────

const C7_LOWER = C7_BANNED_NAMES.map((n) => n.toLowerCase());

function containsWord(haystackLower: string, needleLower: string): boolean {
  return new RegExp(`\\b${needleLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystackLower);
}

/** Reason `entry` is unfit for a design pool, or null if clean. Screens: C7 protagonist names,
 *  anchor-seam " / " leakage, jammed CamelCase labels, source-note ids (fact.1 / case.2), and
 *  named-case labels from the book's packets (cross-chapter source leakage). Used to DROP derived
 *  entries at compile time AND to FLAG any that slip through at BD4 gate time. */
export function bannedContentReason(entry: string, caseLabelsLower: readonly string[] = []): string | null {
  const lower = entry.toLowerCase();
  for (const name of C7_LOWER) if (containsWord(lower, name)) return `C7 protagonist name`;
  if (entry.includes(" / ")) return `anchor-seam ' / '`;
  if (/[a-z][A-Z]/.test(entry)) return `jammed CamelCase label`;
  if (/\b(?:fact|case|anchor|framework|concept)\.\d/i.test(entry)) return `source-note id`;
  for (const label of caseLabelsLower) if (label && label.length >= 4 && containsWord(lower, label)) return `named-case leakage "${label}"`;
  return null;
}

// ── Deterministic derivation from the book's own material ────────────────────────

/** A short, generic-topic phrase from a hardSpecific: lowercased, punctuation-collapsed, 2–5 words,
 *  no digits, no proper nouns. Returns null for anything that would carry a distinctive source
 *  identifier (proper noun, number) into a book-wide pool entry. */
/** Heads that cannot open a NOUN phrase. The derived templates slot the mined
 *  topic into a noun position — "a working note on X", "a first attempt at X",
 *  "two stakeholders disagree about X" — but hardSpecifics are arbitrary
 *  fragments, and one led by a preposition, conjunction or bare participle
 *  renders as garbage. Live on the Franklin canary: 8 of 24 examples carried
 *  domains like "a working note on about wagons" and "two stakeholders disagree
 *  about compared to original before deciding". Rejecting the fragment simply
 *  falls through to the genre base, which carries the pool floors. */
const NON_NOMINAL_TOPIC_HEADS = new Set([
  // prepositions
  "about", "above", "across", "after", "against", "along", "among", "around", "at",
  "before", "behind", "below", "beneath", "beside", "between", "beyond", "by",
  "despite", "down", "during", "except", "for", "from", "in", "inside", "into",
  "near", "of", "off", "on", "onto", "outside", "over", "past", "per", "through",
  "throughout", "to", "toward", "towards", "under", "underneath", "until", "up",
  "upon", "via", "with", "within", "without",
  // conjunctions / subordinators / determinative fragments
  "and", "as", "because", "but", "if", "nor", "once", "or", "since", "so", "than",
  "that", "then", "though", "unless", "when", "whenever", "where", "whereas",
  "whether", "which", "while", "who", "whose", "why",
  // bare participles that read as clause fragments in a noun slot
  "compared", "given", "based", "beginning", "having", "being", "slipped",
  "taken", "seen", "made", "held", "left", "put", "set", "written", "drawn",
]);

/** True when a mined topic can grammatically fill the templates' noun slot.
 *  Exported for the test that pins the live failure shape. */
export function topicFillsNounSlot(phrase: string): boolean {
  const head = phrase.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return head.length > 0 && !NON_NOMINAL_TOPIC_HEADS.has(head);
}

function cleanTopicPhrase(raw: string): string | null {
  if (!raw) return null;
  if (properNounTokens(raw).length > 0) return null; // reject proper-noun-bearing specifics
  const t = raw.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 5) return null;
  // The templates need a noun phrase; a fragment head renders ungrammatically.
  if (!topicFillsNounSlot(t)) return null;
  return t;
}

function minedTopics(packets: SourcePacketV1[]): string[] {
  const raw: string[] = [];
  for (const p of packets) {
    for (const c of p.namedCases) for (const s of c.hardSpecifics) raw.push(s);
  }
  return uniq(raw.map(cleanTopicPhrase).filter((x): x is string => !!x)).sort();
}

type DerivedEntries = { framesDecision: string[]; framesExperiential: string[]; venues: string[]; constraints: string[] };

/** Slot mined topics into genre-neutral frame/venue/constraint TEMPLATES. Deterministic (sorted
 *  input, fixed slice sizes). Bounded — the derived head gives the book its own flavor; the genre
 *  base behind it carries the bulk and guarantees the floors. */
function buildDerivedEntries(topics: string[], caseLabelsLower: string[]): DerivedEntries {
  const clean = (xs: string[]): string[] => xs.filter((e) => bannedContentReason(e, caseLabelsLower) === null);
  const framesDecision = clean(
    topics.slice(0, 8).flatMap((p) => [
      `a first attempt at ${p} that gets corrected`,
      `two stakeholders disagree about ${p} before deciding`,
    ]),
  ).slice(0, 8);
  const framesExperiential = clean(topics.slice(0, 4).map((p) => `a first encounter with ${p} that sets a benchmark`)).slice(0, 4);
  const venues = clean(topics.slice(0, 10).map((p) => `a working note on ${p}`)).slice(0, 8);
  const constraints = clean(topics.slice(0, 4).map((p) => `tie the move to ${p} before acting`)).slice(0, 4);
  return { framesDecision, framesExperiential, venues, constraints };
}

function loadPacketsForBook(bookId: string, roots: CompilerStoreRoots): { packets: SourcePacketV1[]; chapters: number } {
  const normalized = normSlug(bookId);
  const index = readCanonicalChapterIndex(normalized, roots.stateRoot);
  const chapters = index.ok ? index.chapters.length : 0;
  const packets: SourcePacketV1[] = [];
  if (index.ok) {
    for (const chapter of index.chapters) {
      const p = sourcePacketPath(normalized, chapter.chapterNumber, roots);
      if (!existsSync(p)) continue;
      try {
        packets.push(readJsonFile<SourcePacketV1>(p));
      } catch {
        /* skip unreadable packet — derivation is best-effort over available material */
      }
    }
  }
  return { packets, chapters };
}

/** Derive the per-book design artifact. Pure over (packets, genre, genre static config). NO LLM.
 *  `opts.packets`/`opts.chapters`/`opts.genre` are injectable so a test drives derivation without
 *  touching disk; otherwise packets are loaded from the compiled source packets under `roots`. */
export function deriveBookDesign(
  bookId: string,
  opts: { roots?: CompilerStoreRoots; genre?: string; category?: string; packets?: SourcePacketV1[]; chapters?: number } = {},
): BookDesignV1 {
  const roots = opts.roots ?? {};
  const loaded = opts.packets ? { packets: opts.packets, chapters: opts.chapters ?? opts.packets.length } : loadPacketsForBook(bookId, roots);
  const packets = loaded.packets;
  const chapters = opts.chapters ?? loaded.chapters ?? packets.length;
  const genre = genreForBook(bookId, { genre: opts.genre, category: opts.category });
  const base = buildGenrePools(genre, chapters);

  const caseLabelsLower = uniq(packets.flatMap((p) => p.namedCases.map((c) => c.label))).map((l) => l.toLowerCase());
  const topics = minedTopics(packets);
  const derived = buildDerivedEntries(topics, caseLabelsLower);

  const pools: BookDesignPools = {
    sceneFramesDecision: buildPool([...derived.framesDecision, ...base.sceneFramesDecision], [], POOL_FLOORS.sceneFramesDecision),
    sceneFramesExperiential: buildPool([...derived.framesExperiential, ...base.sceneFramesExperiential], [], POOL_FLOORS.sceneFramesExperiential),
    beatsDecision: base.beatsDecision,
    beatsExperiential: base.beatsExperiential,
    venues: buildPool([...derived.venues, ...base.venues], [], venueFloor(chapters)),
    practiceConstraints: buildPool([...derived.constraints, ...base.practiceConstraints], [], POOL_FLOORS.practiceConstraints),
    practiceForms: base.practiceForms,
    actionMechanisms: base.actionMechanisms,
    weeklyForms: base.weeklyForms,
  };

  const derivedCount = derived.framesDecision.length + derived.framesExperiential.length + derived.venues.length + derived.constraints.length;
  const derivedFrom = uniq(packets.flatMap((p) => p.namedCases.map((c) => c.id))).sort();
  return {
    schemaVersion: BOOK_DESIGN_SCHEMA_VERSION,
    bookId: normSlug(bookId),
    genre,
    pools,
    provenance: {
      source: derivedCount > 0 ? "derived" : "genre-fallback",
      ...(derivedCount > 0 && derivedFrom.length ? { derivedFrom } : {}),
    },
  };
}

export type CompileBookDesignResult = { bookId: string; written: string | null; findings: string[] };

/** Compile + persist the book design artifact (verb `compile-book-design`). Writes
 *  state/book-design/<bookId>.design.json. */
export function compileBookDesign(bookId: string, roots: CompilerStoreRoots = {}): CompileBookDesignResult {
  const normalized = normSlug(bookId);
  const design = deriveBookDesign(normalized, { roots });
  const out = bookDesignPath(normalized, roots);
  writeJsonFile(out, design);
  return { bookId: normalized, written: out, findings: [] };
}

// ── Gate (BD1–BD5), shared by the verb and consumption-time clean-check ─────────

export type BookDesignFinding = { checkId: string; severity: "blocker" | "advisory"; message: string; path?: string };

const POOL_KEYS: (keyof BookDesignPools)[] = [
  "sceneFramesDecision", "sceneFramesExperiential", "beatsDecision", "beatsExperiential",
  "venues", "practiceConstraints", "practiceForms", "actionMechanisms", "weeklyForms",
];

/** Validate a design artifact against BD1–BD5. `chapters` sets the venue floor (venueFloor). Pure —
 *  no disk. Fail-closed at the gate: any blocker fails the verb and makes resolvePools ignore the
 *  artifact (falling back to genre/legacy). */
export function validateBookDesign(design: unknown, chapters: number): BookDesignFinding[] {
  const findings: BookDesignFinding[] = [];
  const push = (checkId: string, severity: BookDesignFinding["severity"], message: string, path?: string) => findings.push({ checkId, severity, message, path });
  const d = design as Partial<BookDesignV1> | null;

  // BD1.schema
  if (!d || typeof d !== "object") { push("BD1.schema", "blocker", "design artifact is not an object"); return findings; }
  if (d.schemaVersion !== BOOK_DESIGN_SCHEMA_VERSION) push("BD1.schema", "blocker", `schemaVersion must be ${BOOK_DESIGN_SCHEMA_VERSION}`, "/schemaVersion");
  if (!d.bookId) push("BD1.schema", "blocker", "missing bookId", "/bookId");
  if (!d.genre || !(GENRES as readonly string[]).includes(d.genre)) push("BD1.schema", "blocker", `genre must be one of ${GENRES.join(", ")}`, "/genre");
  const pools = d.pools;
  if (!pools || typeof pools !== "object") { push("BD1.schema", "blocker", "missing pools", "/pools"); return findings; }
  for (const key of POOL_KEYS) {
    if (!Array.isArray((pools as BookDesignPools)[key])) push("BD1.schema", "blocker", `pools.${key} must be an array`, `/pools/${key}`);
  }
  if (findings.some((f) => f.checkId === "BD1.schema")) return findings;

  const floors: Record<keyof BookDesignPools, number> = { ...POOL_FLOORS, venues: venueFloor(chapters) };
  for (const key of POOL_KEYS) {
    const arr = (pools as BookDesignPools)[key];
    // BD2.pool_floor
    if (arr.length < floors[key]) push("BD2.pool_floor", "blocker", `pools.${key} has ${arr.length} entries; floor is ${floors[key]}`, `/pools/${key}`);
    // BD3.duplicate_entries
    if (new Set(arr).size !== arr.length) push("BD3.duplicate_entries", "blocker", `pools.${key} contains duplicate entries`, `/pools/${key}`);
    // BD4.banned_content
    for (const [i, entry] of arr.entries()) {
      const reason = bannedContentReason(entry);
      if (reason) push("BD4.banned_content", "blocker", `pools.${key}[${i}] "${entry}" contains ${reason}`, `/pools/${key}/${i}`);
    }
  }
  // BD5.genre_mismatch — investing document venues in a non-investing book.
  if (d.genre !== "investing") {
    const inv = new Set(investingVenues());
    const leaked = (pools as BookDesignPools).venues.filter((v) => inv.has(v.trim()));
    if (leaked.length) push("BD5.genre_mismatch", "blocker", `${d.genre} book carries investing-only venues: ${leaked.join(", ")}`, "/pools/venues");
  }
  return findings;
}

export type BookDesignGateReport = { bookId: string; passed: boolean; findings: BookDesignFinding[] };

/** Read + validate the on-disk design artifact for a book. Used by the `book-design-gate` verb. */
export function checkBookDesignGate(bookId: string, roots: CompilerStoreRoots = {}): BookDesignGateReport {
  const normalized = normSlug(bookId);
  const p = bookDesignPath(normalized, roots);
  const { chapters } = loadPacketsForBook(normalized, roots);
  if (!existsSync(p)) {
    return { bookId: normalized, passed: false, findings: [{ checkId: "BD0.missing", severity: "blocker", message: `no design artifact at ${p} — run compile-book-design first`, path: p }] };
  }
  let design: unknown;
  try {
    design = readJsonFile(p);
  } catch (err) {
    return { bookId: normalized, passed: false, findings: [{ checkId: "BD0.malformed", severity: "blocker", message: `unreadable design artifact: ${(err as Error).message}`, path: p }] };
  }
  const findings = validateBookDesign(design, chapters);
  return { bookId: normalized, passed: !findings.some((f) => f.severity === "blocker"), findings };
}

export function formatBookDesignGateReport(report: BookDesignGateReport): string {
  const blockers = report.findings.filter((f) => f.severity === "blocker").length;
  const advisories = report.findings.filter((f) => f.severity === "advisory").length;
  const lines = [`book-design-gate: ${report.passed ? "PASS" : "BLOCK"} (${blockers} blocker(s), ${advisories} advisory)`];
  for (const f of report.findings) lines.push(`  [${f.severity.toUpperCase()} ${f.checkId}] ${f.message}${f.path ? ` (${f.path})` : ""}`);
  return lines.join("\n");
}

// ── Consumption: resolved pools + per-book pool sizes ───────────────────────────

/** The pools a blueprint compile actually deals from, plus venue closures. The 9 designable pool
 *  arrays are spread in from a BookDesignPools (design or genre) or the caller's legacy constants. */
export type ResolvedPools = BookDesignPools & {
  source: "derived" | "genre-fallback" | "legacy";
  genre: string;
  designHash?: string;
  /** The 6-venue palette for a chapter (design/genre = planVenuesFromPalette over `venues`;
   *  legacy = the caller's plannedVenuePalette). */
  venuePaletteFor: (chapterNumber: number) => string[];
  /** Up to 4 forbidden venues given a chapter's palette (venues from the resolved pool set NOT in
   *  this chapter's palette; legacy = the investing FALLBACK_VENUES minus the palette). */
  forbiddenVenuesFor: (venuePalette: string[]) => string[];
};

function buildVenueClosures(bookId: string, venues: string[]): Pick<ResolvedPools, "venuePaletteFor" | "forbiddenVenuesFor"> {
  const pickVenues = (offset: number): string[] => {
    const out: string[] = [];
    const L = Math.max(1, venues.length);
    for (let i = 0; i < EXAMPLE_SLOT_COUNT; i++) out.push(venues[((offset + i) % L + L) % L]);
    return out;
  };
  const venuePaletteFor = (chapterNumber: number): string[] => {
    const L = venues.length;
    const maxCh = Math.min(34, Math.floor(L / 3)); // cap-2: 6·maxCh ≤ 2·L
    if (chapterNumber >= 1 && chapterNumber <= maxCh && maxCh >= 1) {
      try {
        return planVenuesFromPalette(bookId, 1, maxCh, [...venues]).allocation[chapterNumber] ?? pickVenues(chapterNumber - 1);
      } catch {
        return pickVenues(chapterNumber - 1);
      }
    }
    return pickVenues(chapterNumber - 1);
  };
  const forbiddenVenuesFor = (venuePalette: string[]): string[] => venues.filter((v) => !venuePalette.includes(v)).slice(0, 4);
  return { venuePaletteFor, forbiddenVenuesFor };
}

function resolvedFromPools(source: "derived" | "genre-fallback", genre: string, pools: BookDesignPools, bookId: string, designHash?: string): ResolvedPools {
  return { ...pools, source, genre, ...(designHash ? { designHash } : {}), ...buildVenueClosures(bookId, pools.venues) };
}

/** The on-disk design artifact for a book IF it exists AND passes the gate (no blockers). Returns
 *  null (fall back) on any error — a corrupt/blocked artifact must never crash a compile. */
function readCleanBookDesign(bookId: string, roots: CompilerStoreRoots): BookDesignV1 | null {
  const p = bookDesignPath(bookId, roots);
  if (!existsSync(p)) return null;
  try {
    const design = readJsonFile<BookDesignV1>(p);
    const { chapters } = loadPacketsForBook(bookId, roots);
    if (validateBookDesign(design, chapters).some((f) => f.severity === "blocker")) return null;
    return design;
  } catch {
    return null;
  }
}

/**
 * Resolve the pools a blueprint compile should deal from:
 *   1. the book's design artifact, if present AND gate-clean → `derived` (hash-pinned);
 *   2. else, if the book maps to a non-generic genre → `genre-fallback` (genre static + top-up);
 *   3. else the caller's LEGACY in-code constants unchanged → `legacy` (byte-identical).
 * `legacy` is passed in by chapterBlueprint (its own constants + plannedVenuePalette closures) so
 * this module owns no legacy duplication and the legacy path is provably a pass-through.
 */
export function resolvePools(bookId: string, roots: CompilerStoreRoots, legacy: ResolvedPools): ResolvedPools {
  const normalized = normSlug(bookId);
  const design = readCleanBookDesign(normalized, roots);
  if (design) return resolvedFromPools("derived", design.genre, design.pools, normalized, canonicalJsonSha256(design));
  const genre = genreForBook(normalized);
  if (genre !== "generic") {
    const { chapters } = loadPacketsForBook(normalized, roots);
    return resolvedFromPools("genre-fallback", genre, buildGenrePools(genre, chapters), normalized);
  }
  return legacy;
}
