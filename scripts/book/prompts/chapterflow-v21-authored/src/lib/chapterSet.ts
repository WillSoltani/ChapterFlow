import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import type { ChapterSpec } from "../generateChapter.js";
import type { ChapterV21 } from "../types.js";
import { CANONICAL_STATE, normSlug, parseChapterId } from "./chapterPaths.js";

export type ChapterSetBlocker = {
  checkId: string;
  severity: "blocker";
  message: string;
  index?: number;
  expected?: unknown;
  actual?: unknown;
};

export type ChapterRef = {
  chapterId?: unknown;
  chapterNumber?: unknown;
  number?: unknown;
  chapterTitle?: unknown;
  title?: unknown;
};

type NormalizedChapterRef = {
  chapterId: string;
  chapterNumber: number;
  order: number;
};

export type CanonicalChapterIndexResult =
  | { ok: true; bookId: string; path: string; chapters: ChapterSpec[]; refs: NormalizedChapterRef[]; blockers: [] }
  | { ok: false; bookId: string; path: string; chapters: []; refs: []; blockers: ChapterSetBlocker[] };

export type ChapterSetComparison = {
  ok: boolean;
  bookId: string;
  actualLabel: string;
  expected: NormalizedChapterRef[];
  actual: NormalizedChapterRef[];
  blockers: ChapterSetBlocker[];
};

export function canonicalChapterIndexPath(bookId: string, stateRoot = CANONICAL_STATE): string {
  return resolve(stateRoot, "indexes", `${normSlug(bookId)}.json`);
}

export function readCanonicalChapterIndex(bookId: string, stateRoot = CANONICAL_STATE): CanonicalChapterIndexResult {
  const normalizedBookId = normSlug(bookId);
  const path = canonicalChapterIndexPath(normalizedBookId, stateRoot);
  if (!existsSync(path)) {
    return {
      ok: false,
      bookId: normalizedBookId,
      path,
      chapters: [],
      refs: [],
      blockers: [blocker("CHSET.index_missing", `Canonical chapter index is missing at ${path}. Existing chapter files are not an inferred production index.`)],
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return {
      ok: false,
      bookId: normalizedBookId,
      path,
      chapters: [],
      refs: [],
      blockers: [blocker("CHSET.index_malformed", `Canonical chapter index at ${path} is not valid JSON: ${(err as Error).message}`)],
    };
  }

  if (!Array.isArray(raw)) {
    return {
      ok: false,
      bookId: normalizedBookId,
      path,
      chapters: [],
      refs: [],
      blockers: [blocker("CHSET.index_malformed", `Canonical chapter index at ${path} must be a JSON array of ChapterSpec objects.`)],
    };
  }
  if (raw.length === 0) {
    return {
      ok: false,
      bookId: normalizedBookId,
      path,
      chapters: [],
      refs: [],
      blockers: [blocker("CHSET.index_empty", `Canonical chapter index at ${path} is empty. Production promotion requires at least one indexed chapter.`)],
    };
  }

  const parsed = normalizeRefs(normalizedBookId, raw as ChapterRef[], "canonical index", "index");
  if (parsed.blockers.length > 0) {
    return { ok: false, bookId: normalizedBookId, path, chapters: [], refs: [], blockers: parsed.blockers };
  }

  const chapters = (raw as ChapterRef[]).map((entry, i) => ({
    chapterId: parsed.refs[i].chapterId,
    chapterNumber: parsed.refs[i].chapterNumber,
    chapterTitle: typeof entry.chapterTitle === "string" ? entry.chapterTitle : typeof entry.title === "string" ? entry.title : "",
  }));

  return { ok: true, bookId: normalizedBookId, path, chapters, refs: parsed.refs, blockers: [] };
}

export function loadCanonicalChapterIndex(bookId: string, stateRoot = CANONICAL_STATE): ChapterSpec[] {
  const result = readCanonicalChapterIndex(bookId, stateRoot);
  if (!result.ok) throw new Error(formatChapterSetBlockers(result.blockers));
  return result.chapters;
}

export function compareChapterSetToCanonical(args: {
  bookId: string;
  canonical: ChapterSpec[];
  actual: ChapterRef[] | ChapterV21[];
  actualLabel?: string;
}): ChapterSetComparison {
  const bookId = normSlug(args.bookId);
  const actualLabel = args.actualLabel ?? "chapter set";
  const expected = normalizeRefs(bookId, args.canonical, "canonical index", "index");
  const actual = normalizeRefs(bookId, args.actual as ChapterRef[], actualLabel, "actual");
  const blockers = [...expected.blockers, ...actual.blockers];

  if (expected.refs.length > 0 || actual.refs.length > 0) {
    blockers.push(...compareNormalizedRefs(expected.refs, actual.refs, actualLabel));
  }

  return {
    ok: blockers.length === 0,
    bookId,
    actualLabel,
    expected: expected.refs,
    actual: actual.refs,
    blockers,
  };
}

export function formatChapterSetBlockers(blockers: ChapterSetBlocker[]): string {
  return blockers.map((b) => `${b.checkId}: ${b.message}`).join("; ");
}

function normalizeRefs(
  bookId: string,
  refs: ChapterRef[],
  label: string,
  role: "index" | "actual",
): { refs: NormalizedChapterRef[]; blockers: ChapterSetBlocker[] } {
  const out: NormalizedChapterRef[] = [];
  const blockers: ChapterSetBlocker[] = [];
  const seenIds = new Map<string, number>();
  const seenNumbers = new Map<number, string>();

  refs.forEach((ref, i) => {
    const order = i + 1;
    if (!ref || typeof ref !== "object") {
      blockers.push(blocker(`CHSET.${role}_malformed`, `${label}[${i}] must be an object.`, { index: i, actual: ref }));
      return;
    }

    const chapterId = typeof ref.chapterId === "string" ? ref.chapterId.trim() : "";
    const numRaw = typeof ref.chapterNumber === "number" ? ref.chapterNumber : ref.number;
    if (!chapterId) {
      blockers.push(blocker(`CHSET.${role}_missing_id`, `${label}[${i}] is missing chapterId.`, { index: i, actual: ref }));
    }
    if (!Number.isInteger(numRaw) || (numRaw as number) < 1) {
      blockers.push(blocker(`CHSET.${role}_missing_number`, `${label}[${i}] has invalid chapterNumber ${JSON.stringify(numRaw)}.`, { index: i, actual: ref }));
    }
    if (!chapterId || !Number.isInteger(numRaw) || (numRaw as number) < 1) return;

    const chapterNumber = numRaw as number;
    const parsed = parseChapterId(chapterId);
    if (!parsed) {
      blockers.push(blocker(`CHSET.${role}_id_malformed`, `${label}[${i}] chapterId "${chapterId}" must look like <bookId>-chNN.`, { index: i, actual: chapterId }));
    } else {
      if (parsed.bookId !== bookId) {
        blockers.push(blocker(`CHSET.${role}_book_mismatch`, `${label}[${i}] chapterId "${chapterId}" belongs to normalized book "${parsed.bookId}", not "${bookId}".`, { index: i, expected: bookId, actual: parsed.bookId }));
      }
      if (parsed.num !== chapterNumber) {
        blockers.push(blocker(`CHSET.${role}_id_number_mismatch`, `${label}[${i}] chapterId "${chapterId}" encodes chapter ${parsed.num}, but chapterNumber is ${chapterNumber}.`, { index: i, expected: parsed.num, actual: chapterNumber }));
      }
    }

    const priorIdOrder = seenIds.get(chapterId);
    if (priorIdOrder !== undefined) {
      blockers.push(blocker(`CHSET.${role}_duplicate_id`, `${label} duplicates chapterId "${chapterId}" at positions ${priorIdOrder} and ${order}.`, { index: i, actual: chapterId }));
    } else {
      seenIds.set(chapterId, order);
    }

    const priorNumberId = seenNumbers.get(chapterNumber);
    if (priorNumberId) {
      blockers.push(blocker(`CHSET.${role}_duplicate_number`, `${label} duplicates chapterNumber ${chapterNumber} in ${priorNumberId} and ${chapterId}.`, { index: i, actual: chapterNumber }));
    } else {
      seenNumbers.set(chapterNumber, chapterId);
    }

    out.push({ chapterId, chapterNumber, order });
  });

  return { refs: out, blockers };
}

function compareNormalizedRefs(expected: NormalizedChapterRef[], actual: NormalizedChapterRef[], actualLabel: string): ChapterSetBlocker[] {
  const blockers: ChapterSetBlocker[] = [];
  if (actual.length !== expected.length) {
    blockers.push(blocker(
      "CHSET.count_mismatch",
      `${actualLabel} has ${actual.length} chapter(s), but the canonical index has ${expected.length}.`,
      { expected: expected.length, actual: actual.length },
    ));
  }

  const expectedById = new Map(expected.map((ref) => [ref.chapterId, ref]));
  const actualById = new Map(actual.map((ref) => [ref.chapterId, ref]));
  for (const ref of expected) {
    if (!actualById.has(ref.chapterId)) {
      blockers.push(blocker("CHSET.missing_chapter", `${actualLabel} is missing canonical chapter ${ref.chapterId} (chapter ${ref.chapterNumber}).`, { expected: ref.chapterId }));
    }
  }
  for (const ref of actual) {
    if (!expectedById.has(ref.chapterId)) {
      blockers.push(blocker("CHSET.extra_chapter", `${actualLabel} includes non-canonical chapter ${ref.chapterId} (chapter ${ref.chapterNumber}).`, { actual: ref.chapterId }));
    }
  }

  const max = Math.min(expected.length, actual.length);
  for (let i = 0; i < max; i++) {
    const exp = expected[i];
    const act = actual[i];
    if (exp.chapterId !== act.chapterId || exp.chapterNumber !== act.chapterNumber) {
      blockers.push(blocker(
        "CHSET.position_mismatch",
        `${actualLabel}[${i}] is ${act.chapterId}#${act.chapterNumber}, but canonical index[${i}] is ${exp.chapterId}#${exp.chapterNumber}. Chapter order must exactly match the canonical index.`,
        { index: i, expected: exp, actual: act },
      ));
    }
  }

  return blockers;
}

function blocker(checkId: string, message: string, extra: Partial<ChapterSetBlocker> = {}): ChapterSetBlocker {
  return { checkId, severity: "blocker", message, ...extra };
}
