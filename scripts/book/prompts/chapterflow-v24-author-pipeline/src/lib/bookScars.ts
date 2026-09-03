/**
 * bookScars — loader for per-book "scar" files (config/book-scars/<bookId>.json).
 *
 * The four section-writer contracts used to carry hundreds of never/avoid clauses,
 * and a chunk of them named a phrase, prop, or venue from ONE book ("red phone by
 * the pool" from the-power-of-moments; "tradeoff memo" / "prospectus packet" from
 * the-intelligent-investor). Baked into a universal contract, one book's scar tissue
 * became a house-voice force in every OTHER book (churn HIGH). P07 moves that
 * book-specific material here: the section-task builder renders a book's scars ONLY
 * into that book's writer prompts.
 *
 * These lists are WRITER GUIDANCE, not a gate input — over-use is still enforced
 * deterministically by the section/book gates (SEC80–SEC118, AS5–AS13). Data flows
 * one way (config -> task); it never reaches a gate.
 *
 * Loader convention mirrors src/metrics/rubricThresholds.ts: read JSON, hand-validate
 * the shape, THROW on drift (there is no ajv here). The one difference: a MISSING file
 * is not an error — most books have no scar file, so loadBookScars returns null and the
 * task builder omits the section entirely (same "no empty scaffolding" rule as the
 * voice card).
 */

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { normSlug } from "./chapterPaths.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/lib
const SCARS_DIR = resolve(__dirname, "../../config/book-scars");

export type BookScars = {
  bookId: string;
  /** Verbatim case-identifying phrases this book reuses; each belongs in one teaching unit book-wide. */
  phrases: string[];
  /** Scene engines / prop containers / connective frames this book defaults to and must vary. */
  frames: string[];
  /** Free-text reminders specific to this book. */
  notes: string[];
  /**
   * NON-NEGOTIABLE rules for this book — safety verdicts from a reader panel, and
   * fact pins where surfaces contradicted each other.
   *
   * A separate channel because `phrases`/`frames`/`notes` render under an OVER-USE
   * header that grants a quota of one and tells the writer to paraphrase the item
   * everywhere else. That is right for scar tissue and exactly inverted for a
   * prohibition: it would instruct the model to restate an unsafe line in other
   * words. as-a-man-thinketh's panel-blocker safety rules shipped in `notes` and
   * were rendered that way. Prohibitions render in their own block, first, as
   * absolute rules with no quota.
   */
  prohibitions: string[];
};

/**
 * The chapters a rule governs, read from the rule's own LABEL — the text before
 * its first colon — as parenthesised `chNN` markers. "FACT PIN (ch03): …" governs
 * chapter 3 only; "SAFETY: …" governs the whole book; "TIER CONTRACT: the tiers
 * are standalone (ch01: the brother-break …)" governs the whole book too, because
 * the marker sits in the BODY, where it is an illustration rather than a scope.
 * An empty result means book-wide.
 *
 * The scope is derived from the rule text instead of a new schema field on
 * purpose. The 18 chapter-scoped rules in the shipped Franklin file already SAY
 * which chapter they govern; a parallel `chapters` array would have to be kept in
 * agreement with that sentence by hand, and the two could disagree silently. It
 * also keeps the on-the-wire shape of `prohibitions` a list of strings, which is
 * what the section-task sidecar carries and what compilerApplicationPort
 * re-validates, so no staged candidate becomes unreadable. Re-scoping a rule is
 * therefore an edit to its own label: drop "(ch03)" and it governs every chapter.
 */
export function bookRuleChapters(rule: string): number[] {
  const label = rule.split(":", 1)[0];
  const chapters = new Set<number>();
  for (const group of label.matchAll(/\(([^)]*)\)/g)) {
    for (const marker of group[1].matchAll(/\bch0*(\d{1,3})\b/gi)) {
      const chapterNumber = Number(marker[1]);
      if (Number.isInteger(chapterNumber) && chapterNumber > 0) chapters.add(chapterNumber);
    }
  }
  return [...chapters].sort((a, b) => a - b);
}

/** True when `rule` applies to the chapter being written: either it names no
 *  chapter in its label (book-wide) or it names this one. */
export function bookRuleGovernsChapter(rule: string, chapterNumber: number): boolean {
  const chapters = bookRuleChapters(rule);
  return chapters.length === 0 || chapters.includes(chapterNumber);
}

function fail(bookId: string, msg: string): never {
  throw new Error(`book-scars for ${bookId} invalid: ${msg}`);
}

function stringArray(raw: unknown, bookId: string, where: string): string[] {
  if (!Array.isArray(raw)) fail(bookId, `${where} must be an array`);
  return (raw as unknown[]).map((v, i) => {
    if (typeof v !== "string" || v.trim().length === 0) fail(bookId, `${where}[${i}] must be a non-empty string`);
    return v as string;
  });
}

/** Validate a parsed book-scars object, throwing on any drift. Exported so tests can
 *  validate synthetic objects without touching disk. `$schema` / `_comment` are
 *  documentation-only and ignored. */
export function validateBookScars(raw: unknown, expectedBookId: string): BookScars {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail(expectedBookId, "root must be an object");
  const obj = raw as Record<string, unknown>;
  // Reject unknown keys. The schema declares additionalProperties:false but NOTHING
  // executes it — validateAllConfigFiles reads config/ non-recursively, so
  // config/book-scars/ is never reached. Without this, misspelling `prohibitions`
  // as `prohibition` silently drops every safety rule in the file while the rest
  // still loads, and the "no actionable content" guard below does not fire either:
  // exactly the silent no-op class the near-miss filename guard exists to kill.
  const KNOWN_KEYS = ["$schema", "_comment", "bookId", "phrases", "frames", "notes", "prohibitions"];
  const unknown = Object.keys(obj).filter((k) => !KNOWN_KEYS.includes(k));
  if (unknown.length > 0) {
    fail(expectedBookId, `unknown key(s): ${unknown.join(", ")} — known keys are ${KNOWN_KEYS.join(", ")}`);
  }
  if (typeof obj.bookId !== "string" || obj.bookId.trim().length === 0) fail(expectedBookId, "bookId must be a non-empty string");
  if (normSlug(obj.bookId) !== normSlug(expectedBookId)) fail(expectedBookId, `bookId "${obj.bookId}" does not match its filename`);
  return {
    bookId: normSlug(obj.bookId),
    phrases: stringArray(obj.phrases, expectedBookId, "phrases"),
    frames: stringArray(obj.frames, expectedBookId, "frames"),
    notes: stringArray(obj.notes, expectedBookId, "notes"),
    // Optional so the four scar files that predate this channel stay valid; absent
    // means "this book has no hard rules", not "unknown".
    prohibitions: obj.prohibitions === undefined ? [] : stringArray(obj.prohibitions, expectedBookId, "prohibitions"),
  };
}

/** Leading articles a bookId slug may or may not carry. `v4BookId` slugifies the
 *  title verbatim, so "The Autobiography of Benjamin Franklin" becomes
 *  `the-autobiography-…` while a hand-named scar file may drop the article. */
const LEADING_ARTICLES = ["the-", "a-", "an-"] as const;

function articleVariants(slug: string): string[] {
  const bare = LEADING_ARTICLES.reduce((s, a) => (s.startsWith(a) ? s.slice(a.length) : s), slug);
  return [...new Set([bare, ...LEADING_ARTICLES.map((a) => `${a}${bare}`)])].filter((s) => s !== slug);
}

/**
 * A scar file that differs from the requested bookId only by a leading article is
 * almost certainly meant for this book, and silence is the worst outcome: a
 * missing file is a legitimate no-op for most books, so a misnamed one produced
 * NO signal at all. autobiography-of-benjamin-franklin.json sat unread for the
 * whole canary while its book compiled as the-autobiography-of-benjamin-franklin,
 * including a fact pin written straight off a panel FAIL. Fail loud instead.
 *
 * Deliberate trade-off: if two DISTINCT books ever have slugs differing only by a
 * leading article ("brief-history" and "the-brief-history"), the one without a
 * scar file will throw here even though nothing is wrong. That is accepted — the
 * scar directory is a hand-maintained config of a handful of files, the error
 * names both paths and the two ways out, and an ambiguous pairing is itself worth
 * surfacing. Silent misapplication of a safety rule is the worse failure.
 */
function assertNoNearMissScarFile(slug: string): void {
  for (const candidate of articleVariants(slug)) {
    if (existsSync(resolve(SCARS_DIR, `${candidate}.json`))) {
      fail(
        slug,
        `no ${slug}.json, but ${candidate}.json exists — a scar file whose name differs only by a leading article would silently never load; rename it to ${slug}.json (and set its bookId to match) or delete it`,
      );
    }
  }
}

/**
 * sha256 over a book's scar content, or null when it has none.
 *
 * Field-tagged and order-sensitive: reordering `prohibitions` changes the rendered
 * writer block, so it must change the digest too. Two consumers depend on it —
 * the section-pack cache identity (a pack drafted without a rule must not be
 * served under it) and the repair port's divergence check (the candidate's frozen
 * rules versus what is on disk now). One definition so those cannot disagree.
 */
export function bookScarsDigest(scars: BookScars | null): string | null {
  if (scars === null) return null;
  const hash = createHash("sha256");
  hash.update(scars.bookId);
  for (const [field, values] of [
    ["prohibitions", scars.prohibitions],
    ["phrases", scars.phrases],
    ["frames", scars.frames],
    ["notes", scars.notes],
  ] as const) {
    hash.update(`\0${field}\0`);
    for (const value of values) {
      hash.update(value);
      hash.update("\0");
    }
  }
  return hash.digest("hex");
}

const _cache = new Map<string, BookScars | null>();

/** The scars for a book, or null when the book has no scar file. Cached per bookId.
 *  Throws only when a file EXISTS but is malformed (fail-loud, like the config loaders). */
export function loadBookScars(bookId: string): BookScars | null {
  const slug = normSlug(bookId);
  const cached = _cache.get(slug);
  if (cached !== undefined) return cached;
  const path = resolve(SCARS_DIR, `${slug}.json`);
  if (!existsSync(path)) {
    assertNoNearMissScarFile(slug);
    _cache.set(slug, null);
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    fail(slug, `unreadable/invalid JSON at ${path}: ${(err as Error).message}`);
  }
  const scars = validateBookScars(raw, slug);
  // A file that exists but carries nothing actionable is a mistake worth surfacing.
  if (scars.phrases.length === 0 && scars.frames.length === 0 && scars.notes.length === 0 && scars.prohibitions.length === 0) {
    fail(slug, "scar file exists but has no phrases, frames, notes, or prohibitions");
  }
  _cache.set(slug, scars);
  return scars;
}
