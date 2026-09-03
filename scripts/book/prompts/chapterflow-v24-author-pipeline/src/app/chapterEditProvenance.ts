/**
 * Package 2B — what the editor pass did to each chapter, as the candidate carries
 * it and as the release sidecar summarizes it.
 *
 * Its own module because it has two readers on opposite sides of the pipeline:
 * `compilerApplicationPort` WRITES the file into the compiled candidate, and
 * `release/canonicalPackageAdapter` READS it out of the same candidate's evidence
 * to build `provenance.editing`. Neither should have to import the other, and a
 * literal path copied into the second would drift the day the first moved.
 */

/** Where the compile records what the editor did to every chapter. Emitted ONLY
 *  when the editor is composed, so a candidate without it was compiled by a
 *  pipeline that had no editor at all, which is a different fact from an editor
 *  that ran and was disabled. */
export const CHAPTER_EDIT_PROVENANCE_LOGICAL_PATH = "compiler/chapter-edit-provenance.json";

export const CHAPTER_EDIT_PROVENANCE_SCHEMA_VERSION = "chapter-edit-provenance-v1" as const;

/**
 * One chapter's editor record.
 *
 * EDITED   the edit passed the section gates, the preservation guard AND the
 *          whole-book assembly, and is what shipped.
 * SKIPPED  two attempts were refused; the drafted chapter shipped unchanged.
 * REVERTED the edit passed its own chapter's gates and was withdrawn because the
 *          edited BOOK would not assemble. A different fact from SKIPPED, and
 *          recorded as one.
 * ERROR    an infrastructure failure (transient, timeout, schema rejection) never
 *          produced a usable edit. Never a manufactured verdict, and never cached.
 * DISABLED CHAPTERFLOW_EDITOR_PASS=0.
 */
export type ChapterEditProvenanceStatus = "EDITED" | "SKIPPED" | "REVERTED" | "ERROR" | "DISABLED";

export type ChapterEditProvenanceEntry = Readonly<{
  chapterNumber: number;
  chapterId: string;
  status: ChapterEditProvenanceStatus;
  replayed: boolean;
  attemptIds: readonly string[];
  blockers: readonly string[];
  advisory: Readonly<{ applied: boolean; reviewId: string | null; count: number }>;
}>;

export type ChapterEditProvenanceFile = Readonly<{
  schemaVersion: typeof CHAPTER_EDIT_PROVENANCE_SCHEMA_VERSION;
  bookId: string;
  runId: string;
  /** Model attempts THIS run admitted for the editor. A chapter replayed from the
   *  durable edit cache contributes zero, and its own `attemptIds` still name the
   *  run that reached the verdict, so "what this run spent" and "what produced
   *  this edit" stay separable. */
  attempts: number;
  chapters: readonly ChapterEditProvenanceEntry[];
}>;

/** The release sidecar's summary of the same file: how many chapters ended in
 *  each state, and what the compile spent. Counts rather than per-chapter detail,
 *  because the sidecar is a release record and the candidate keeps the detail. */
export type ReleaseEditingProvenance = Readonly<{
  runId?: string;
  attempts: number;
  edited: number;
  skipped: number;
  reverted: number;
  error: number;
  disabled: number;
  /** True when at least one chapter's edit was steered by reader advisories. */
  advisoryApplied: boolean;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Summarize a candidate's edit-provenance file for the release sidecar.
 *
 * Returns undefined for a candidate that carries no such file, or one whose file
 * is not the shape this module writes — never a guess, and never a partially
 * believed record. Mirrors `researchProvenance`'s policy exactly.
 */
export function summarizeChapterEditProvenance(bytes: Uint8Array | undefined): ReleaseEditingProvenance | undefined {
  if (bytes === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  if (parsed.schemaVersion !== CHAPTER_EDIT_PROVENANCE_SCHEMA_VERSION) return undefined;
  if (!Array.isArray(parsed.chapters)) return undefined;
  const counts: Record<ChapterEditProvenanceStatus, number> = {
    EDITED: 0,
    SKIPPED: 0,
    REVERTED: 0,
    ERROR: 0,
    DISABLED: 0,
  };
  let advisoryApplied = false;
  for (const entry of parsed.chapters) {
    if (!isRecord(entry)) return undefined;
    const status = entry.status;
    if (typeof status !== "string" || !(status in counts)) return undefined;
    counts[status as ChapterEditProvenanceStatus] += 1;
    if (isRecord(entry.advisory) && entry.advisory.applied === true) advisoryApplied = true;
  }
  return {
    ...(typeof parsed.runId === "string" && parsed.runId.length > 0 ? { runId: parsed.runId } : {}),
    attempts: typeof parsed.attempts === "number" && Number.isFinite(parsed.attempts) ? parsed.attempts : 0,
    edited: counts.EDITED,
    skipped: counts.SKIPPED,
    reverted: counts.REVERTED,
    error: counts.ERROR,
    disabled: counts.DISABLED,
    advisoryApplied,
  };
}
