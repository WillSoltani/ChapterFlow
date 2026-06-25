import { existsSync, readFileSync } from "fs";

import { normSlug, parseChapterId } from "./chapterPaths.js";

export const TOC_SCHEMA_VERSION = "chapterflow.toc.v1" as const;

export type TocChapter = {
  id: string;
  number: number;
  title: string;
};

export type CanonicalToc = {
  schemaVersion: typeof TOC_SCHEMA_VERSION;
  bookId: string;
  title: string;
  author: string;
  edition?: Record<string, unknown>;
  introduction?: unknown;
  thesis?: unknown;
  teachingArc?: unknown;
  authorVoice?: unknown;
  confidence?: unknown;
  notes?: unknown;
  categories?: unknown;
  tags?: unknown;
  flatChapters: TocChapter[];
};

export type TocLegacyShape = "canonical" | "flatChapters" | "chapters" | "sections";

export type TocIssue = {
  code: string;
  message: string;
  path?: string;
  actual?: unknown;
  expected?: unknown;
};

export type TocMigrationReport = {
  inputShape: TocLegacyShape | "mixed-identical";
  changed: boolean;
  chapterCount: number;
  warnings: string[];
};

export type TocParseResult =
  | { ok: true; toc: CanonicalToc; chapters: TocChapter[]; migration: TocMigrationReport; issues: [] }
  | { ok: false; issues: TocIssue[] };

export class TocContractError extends Error {
  readonly issues: TocIssue[];

  constructor(issues: TocIssue[]) {
    super(issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "));
    this.name = "TocContractError";
    this.issues = issues;
  }
}

export function canonicalChapterId(bookId: string, chapterNumber: number): string {
  return `${normSlug(bookId)}-ch${String(chapterNumber).padStart(2, "0")}`;
}

export function flattenTocChapters(raw: unknown, args: { bookId: string; path?: string }): TocChapter[] {
  const parsed = parseToc(raw, args);
  if (!parsed.ok) throw new TocContractError(parsed.issues);
  return parsed.chapters;
}

export function parseToc(raw: unknown, args: { bookId: string; path?: string }): TocParseResult {
  const bookId = normSlug(args.bookId);
  const issues: TocIssue[] = [];
  if (!isRecord(raw)) {
    return { ok: false, issues: [issue("TOC.malformed", "TOC must be a JSON object.", args.path, raw)] };
  }

  if (typeof raw.bookId === "string" && normSlug(raw.bookId) !== bookId) {
    issues.push(issue("TOC.book_mismatch", `TOC bookId "${raw.bookId}" does not match "${bookId}".`, args.path, raw.bookId, bookId));
  }

  const candidates = collectChapterCandidates(raw, bookId, args.path);
  issues.push(...candidates.flatMap((candidate) => candidate.issues));
  const validCandidates = candidates.filter((candidate) => candidate.issues.length === 0);
  if (validCandidates.length === 0) {
    if (issues.length === 0) issues.push(issue("TOC.no_chapters", "TOC has no supported chapter list shape.", args.path));
    return { ok: false, issues };
  }

  const canonicalCandidate = validCandidates.find((candidate) => candidate.shape === "canonical");
  let selected = canonicalCandidate ?? validCandidates[0];
  let inputShape: TocMigrationReport["inputShape"] = selected.shape;
  const warnings: string[] = [];

  if (validCandidates.length > 1) {
    const [first, ...rest] = validCandidates;
    const allIdentical = rest.every((candidate) => sameChapters(first.chapters, candidate.chapters));
    if (!allIdentical) {
      issues.push(issue(
        "TOC.mixed_ambiguous",
        `TOC carries multiple chapter shapes with different logical content (${validCandidates.map((c) => c.shape).join(", ")}).`,
        args.path,
      ));
      return { ok: false, issues };
    }
    selected = canonicalCandidate ?? first;
    inputShape = "mixed-identical";
    warnings.push(`Multiple chapter shapes were present but flattened identically: ${validCandidates.map((c) => c.shape).join(", ")}.`);
  }

  if (issues.length > 0) return { ok: false, issues };

  const toc = canonicalizeRecord(raw, bookId, selected.chapters);
  const migration: TocMigrationReport = {
    inputShape,
    changed: inputShape !== "canonical" || raw.schemaVersion !== TOC_SCHEMA_VERSION || !sameChapters(readCanonicalFlat(raw), selected.chapters),
    chapterCount: selected.chapters.length,
    warnings,
  };
  return { ok: true, toc, chapters: toc.flatChapters, migration, issues: [] };
}

export function parseTocFile(path: string, args: { bookId: string }): TocParseResult {
  if (!existsSync(path)) {
    return { ok: false, issues: [issue("TOC.missing", `TOC file is missing at ${path}.`, path)] };
  }
  try {
    return parseToc(JSON.parse(readFileSync(path, "utf8")), { bookId: args.bookId, path });
  } catch (err) {
    return { ok: false, issues: [issue("TOC.unreadable", `TOC file at ${path} is not valid JSON: ${(err as Error).message}`, path)] };
  }
}

export function buildCanonicalToc(args: {
  bookId: string;
  title: string;
  author: string;
  edition?: Record<string, unknown>;
  introduction?: unknown;
  thesis?: unknown;
  teachingArc?: unknown;
  authorVoice?: unknown;
  confidence?: unknown;
  notes?: unknown;
  categories?: unknown;
  tags?: unknown;
  chapters: Array<{ id?: string; number: number; title: string }>;
}): CanonicalToc {
  const bookId = normSlug(args.bookId);
  const raw = {
    schemaVersion: TOC_SCHEMA_VERSION,
    bookId,
    title: args.title,
    author: args.author,
    edition: args.edition,
    introduction: args.introduction,
    thesis: args.thesis,
    teachingArc: args.teachingArc,
    authorVoice: args.authorVoice,
    confidence: args.confidence,
    notes: args.notes,
    categories: args.categories,
    tags: args.tags,
    flatChapters: args.chapters.map((chapter) => ({
      id: chapter.id ?? canonicalChapterId(bookId, chapter.number),
      number: chapter.number,
      title: chapter.title,
    })),
  };
  const parsed = parseToc(raw, { bookId });
  if (!parsed.ok) throw new TocContractError(parsed.issues);
  return parsed.toc;
}

export function formatTocIssues(issues: TocIssue[]): string {
  return issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
}

function collectChapterCandidates(
  raw: Record<string, unknown>,
  bookId: string,
  path?: string,
): Array<{ shape: TocLegacyShape; chapters: TocChapter[]; issues: TocIssue[] }> {
  const candidates: Array<{ shape: TocLegacyShape; chapters: TocChapter[]; issues: TocIssue[] }> = [];

  if (Array.isArray(raw.flatChapters)) {
    candidates.push({
      shape: raw.schemaVersion === TOC_SCHEMA_VERSION ? "canonical" : "flatChapters",
      ...normalizeChapterArray(raw.flatChapters, bookId, "flatChapters", path),
    });
  }

  if (Array.isArray(raw.chapters)) {
    candidates.push({
      shape: "chapters",
      ...normalizeChapterArray(raw.chapters, bookId, "chapters", path),
    });
  }

  if (Array.isArray(raw.sections)) {
    const sectionIssues: TocIssue[] = [];
    const chapters: unknown[] = [];
    raw.sections.forEach((section, sectionIndex) => {
      if (!isRecord(section)) {
        sectionIssues.push(issue("TOC.section_malformed", `sections[${sectionIndex}] must be an object.`, path, section));
        return;
      }
      if (!Array.isArray(section.chapters)) {
        sectionIssues.push(issue("TOC.section_chapters_missing", `sections[${sectionIndex}].chapters must be an array.`, path, section.chapters));
        return;
      }
      chapters.push(...section.chapters);
    });
    const normalized = normalizeChapterArray(chapters, bookId, "sections[].chapters", path);
    candidates.push({
      shape: "sections",
      chapters: normalized.chapters,
      issues: [...sectionIssues, ...normalized.issues],
    });
  }

  return candidates;
}

function normalizeChapterArray(
  rawChapters: unknown[],
  bookId: string,
  label: string,
  path?: string,
): { chapters: TocChapter[]; issues: TocIssue[] } {
  const chapters: TocChapter[] = [];
  const issues: TocIssue[] = [];
  const seenIds = new Map<string, number>();
  const seenNumbers = new Map<number, string>();
  let previousNumber = 0;

  if (rawChapters.length === 0) {
    issues.push(issue("TOC.empty", `${label} must contain at least one chapter.`, path));
  }

  rawChapters.forEach((raw, index) => {
    const itemPath = `${label}[${index}]`;
    if (!isRecord(raw)) {
      issues.push(issue("TOC.chapter_malformed", `${itemPath} must be an object.`, path, raw));
      return;
    }

    const number = raw.number;
    const title = raw.title;
    const idRaw = raw.id ?? raw.chapterId;

    if (!Number.isInteger(number) || (number as number) < 1) {
      issues.push(issue("TOC.chapter_number_invalid", `${itemPath}.number must be a positive integer.`, path, number));
      return;
    }
    if (typeof title !== "string" || title.trim().length === 0) {
      issues.push(issue("TOC.chapter_title_empty", `${itemPath}.title must be a nonempty string.`, path, title));
      return;
    }

    const chapterNumber = number as number;
    if (chapterNumber <= previousNumber) {
      issues.push(issue("TOC.chapter_order", `${itemPath}.number ${chapterNumber} is not after previous chapter number ${previousNumber}.`, path, chapterNumber));
    }
    previousNumber = chapterNumber;

    const id = typeof idRaw === "string" && idRaw.trim().length > 0 ? idRaw.trim() : canonicalChapterId(bookId, chapterNumber);
    const parsed = parseChapterId(id);
    if (!parsed) {
      issues.push(issue("TOC.chapter_id_malformed", `${itemPath}.id "${id}" must look like <bookId>-chNN.`, path, id));
    } else {
      if (parsed.bookId !== bookId) {
        issues.push(issue("TOC.chapter_id_book_mismatch", `${itemPath}.id "${id}" belongs to "${parsed.bookId}", not "${bookId}".`, path, parsed.bookId, bookId));
      }
      if (parsed.num !== chapterNumber) {
        issues.push(issue("TOC.chapter_id_number_mismatch", `${itemPath}.id "${id}" encodes chapter ${parsed.num}, but number is ${chapterNumber}.`, path, parsed.num, chapterNumber));
      }
    }

    const priorId = seenIds.get(id);
    if (priorId !== undefined) {
      issues.push(issue("TOC.chapter_duplicate_id", `${label} duplicates id "${id}" at positions ${priorId} and ${index}.`, path, id));
    } else {
      seenIds.set(id, index);
    }

    const priorNumberId = seenNumbers.get(chapterNumber);
    if (priorNumberId) {
      issues.push(issue("TOC.chapter_duplicate_number", `${label} duplicates chapter number ${chapterNumber} in ${priorNumberId} and ${id}.`, path, chapterNumber));
    } else {
      seenNumbers.set(chapterNumber, id);
    }

    chapters.push({ id, number: chapterNumber, title: title.trim() });
  });

  return { chapters, issues };
}

function canonicalizeRecord(raw: Record<string, unknown>, bookId: string, chapters: TocChapter[]): CanonicalToc {
  const toc: CanonicalToc = {
    schemaVersion: TOC_SCHEMA_VERSION,
    bookId,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : bookId,
    author: typeof raw.author === "string" ? raw.author : "",
    flatChapters: chapters.map((chapter) => ({ ...chapter })),
  };
  copyIfPresent(raw, toc, "edition");
  copyIfPresent(raw, toc, "introduction");
  copyIfPresent(raw, toc, "thesis");
  copyIfPresent(raw, toc, "teachingArc");
  copyIfPresent(raw, toc, "authorVoice");
  copyIfPresent(raw, toc, "confidence");
  copyIfPresent(raw, toc, "notes");
  copyIfPresent(raw, toc, "categories");
  copyIfPresent(raw, toc, "tags");
  return toc;
}

function copyIfPresent(raw: Record<string, unknown>, toc: Record<string, unknown>, key: string): void {
  if (raw[key] !== undefined) toc[key] = raw[key];
}

function readCanonicalFlat(raw: Record<string, unknown>): TocChapter[] {
  if (raw.schemaVersion !== TOC_SCHEMA_VERSION || !Array.isArray(raw.flatChapters)) return [];
  const parsed = normalizeChapterArray(raw.flatChapters, typeof raw.bookId === "string" ? raw.bookId : "", "flatChapters");
  return parsed.issues.length === 0 ? parsed.chapters : [];
}

function sameChapters(a: TocChapter[], b: TocChapter[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((chapter, i) => chapter.id === b[i].id && chapter.number === b[i].number && chapter.title === b[i].title);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(code: string, message: string, path?: string, actual?: unknown, expected?: unknown): TocIssue {
  return { code, message, path, actual, expected };
}
