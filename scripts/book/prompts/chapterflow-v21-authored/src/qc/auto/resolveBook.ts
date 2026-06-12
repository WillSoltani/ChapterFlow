import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, resolve } from "path";

import { CANONICAL_STATE, CHAPTERS_DIR, REPO_ROOT, isSiblingFile, normSlug } from "../../lib/chapterPaths.js";

export type BookResolveSource = "exact-book-id" | "slug" | "index" | "package" | "catalog";

export type ResolvedBook =
  | {
      ok: true;
      bookId: string;
      title?: string;
      source: BookResolveSource;
    }
  | {
      ok: false;
      reason: "not_found" | "ambiguous";
      candidates?: Array<{ bookId: string; title?: string; source: string }>;
      message: string;
    };

type Candidate = { bookId: string; title?: string; source: BookResolveSource };

const INDEX_DIR = resolve(CANONICAL_STATE, "indexes");
const PACKAGES_DIR = resolve(REPO_ROOT, "book-packages");
const CATALOG_PATH = resolve(REPO_ROOT, "app/book/data/booksCatalog.metadata.json");

function safeReadDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function safeJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function uniqueCandidates(candidates: Candidate[]): Candidate[] {
  const byBook = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = byBook.get(c.bookId);
    if (!existing) byBook.set(c.bookId, c);
    else if (!existing.title && c.title) byBook.set(c.bookId, { ...existing, title: c.title });
  }
  return [...byBook.values()].sort((a, b) => a.bookId.localeCompare(b.bookId));
}

function indexCandidates(): Candidate[] {
  return safeReadDir(INDEX_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ bookId: basename(f, ".json"), source: "index" as const }));
}

function chapterCandidates(): Candidate[] {
  const ids = new Set<string>();
  for (const f of safeReadDir(CHAPTERS_DIR)) {
    const m = f.match(/^(.+)-ch\d{1,3}\.v21-native\.chapter\.json$/i);
    if (m) ids.add(normSlug(m[1]));
  }
  return [...ids].map((bookId) => ({ bookId, source: "slug" as const }));
}

function packageCandidates(): Candidate[] {
  return safeReadDir(PACKAGES_DIR)
    .filter((f) => f.endsWith(".v21.json"))
    .map((f) => {
      const bookId = basename(f, ".v21.json");
      const pkg = safeJson(resolve(PACKAGES_DIR, f));
      const title = typeof pkg?.book?.title === "string" ? pkg.book.title : typeof pkg?.title === "string" ? pkg.title : undefined;
      return { bookId, title, source: "package" as const };
    });
}

function catalogCandidates(): Candidate[] {
  const raw = safeJson(CATALOG_PATH);
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.books) ? raw.books : Array.isArray(raw?.items) ? raw.items : [];
  return rows.flatMap((entry: any) => {
    const bookId = typeof entry?.bookId === "string" ? entry.bookId : typeof entry?.id === "string" ? entry.id : "";
    if (!bookId) return [];
    const title = typeof entry?.title === "string" ? entry.title : typeof entry?.book?.title === "string" ? entry.book.title : undefined;
    return [{ bookId: normSlug(bookId), title, source: "catalog" as const }];
  });
}

function allCandidates(): Candidate[] {
  return uniqueCandidates([...indexCandidates(), ...chapterCandidates(), ...packageCandidates(), ...catalogCandidates()]);
}

function exactBookExists(bookId: string): boolean {
  if (existsSync(resolve(INDEX_DIR, `${bookId}.json`))) return true;
  if (safeReadDir(CHAPTERS_DIR).some((f) => isSiblingFile(f, bookId))) return true;
  if (existsSync(resolve(PACKAGES_DIR, `${bookId}.v21.json`))) return true;
  return false;
}

export function resolveBookIdentifier(input: string): ResolvedBook {
  const normalized = normSlug(input.trim());
  if (!normalized) {
    return { ok: false, reason: "not_found", message: "Book name/id is required." };
  }

  if (exactBookExists(normalized)) {
    return { ok: true, bookId: normalized, source: "exact-book-id" };
  }

  const candidates = allCandidates();
  const slugMatches = candidates.filter((c) => normSlug(c.bookId) === normalized);
  if (slugMatches.length === 1) return { ok: true, bookId: slugMatches[0].bookId, title: slugMatches[0].title, source: "slug" };
  if (slugMatches.length > 1) {
    return { ok: false, reason: "ambiguous", candidates: slugMatches, message: `Book id "${input}" is ambiguous.` };
  }

  const titleMatches = candidates.filter((c) => c.title && normSlug(c.title) === normalized);
  if (titleMatches.length === 1) {
    const match = titleMatches[0];
    return { ok: true, bookId: match.bookId, title: match.title, source: match.source === "catalog" ? "catalog" : match.source === "package" ? "package" : "index" };
  }
  if (titleMatches.length > 1) {
    return { ok: false, reason: "ambiguous", candidates: titleMatches, message: `Book title "${input}" is ambiguous.` };
  }

  const looseMatches = candidates.filter((c) => c.title && normSlug(c.title).includes(normalized));
  const uniqueLoose = uniqueCandidates(looseMatches);
  if (uniqueLoose.length === 1) {
    const match = uniqueLoose[0];
    return { ok: true, bookId: match.bookId, title: match.title, source: match.source === "catalog" ? "catalog" : match.source === "package" ? "package" : "index" };
  }
  if (uniqueLoose.length > 1) {
    return { ok: false, reason: "ambiguous", candidates: uniqueLoose, message: `Book name "${input}" matched multiple books.` };
  }

  return { ok: false, reason: "not_found", message: `Could not find a book matching "${input}".` };
}
