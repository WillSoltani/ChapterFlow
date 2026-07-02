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
};

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
  if (typeof obj.bookId !== "string" || obj.bookId.trim().length === 0) fail(expectedBookId, "bookId must be a non-empty string");
  if (normSlug(obj.bookId) !== normSlug(expectedBookId)) fail(expectedBookId, `bookId "${obj.bookId}" does not match its filename`);
  return {
    bookId: normSlug(obj.bookId),
    phrases: stringArray(obj.phrases, expectedBookId, "phrases"),
    frames: stringArray(obj.frames, expectedBookId, "frames"),
    notes: stringArray(obj.notes, expectedBookId, "notes"),
  };
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
  if (scars.phrases.length === 0 && scars.frames.length === 0 && scars.notes.length === 0) {
    fail(slug, "scar file exists but has no phrases, frames, or notes");
  }
  _cache.set(slug, scars);
  return scars;
}
