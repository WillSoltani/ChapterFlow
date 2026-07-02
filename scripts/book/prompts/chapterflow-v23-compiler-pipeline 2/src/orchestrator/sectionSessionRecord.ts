/**
 * sectionSessionRecord — the per-artifact "who authored this section" sidecar.
 *
 * Every section artifact (summary/example/learning/action pack) gets a sibling
 * `<output>.session.json` recording the codex session id(s) that produced it.
 * `stampCompilerAssemblyProvenance` (compilerRun.ts) later collects these into
 * each assembled chapter's `contributorSessionIds`, so the finalize collision
 * guard can prove writer ≠ reviewer independence.
 *
 * WHY THIS MODULE EXISTS SEPARATELY
 * --------------------------------
 * Both the compiler write path (section writers) AND the polish pass
 * (polishPass.ts) need to stamp these records. Keeping the helpers here — a leaf
 * module with no orchestrator imports — lets polishPass.ts contribute a session
 * WITHOUT importing compilerRun.ts (compilerRun already imports polishPass, so a
 * back-import would be a runtime cycle).
 *
 * The record schema is intentionally additive: `sectionSessionId` stays the
 * PRIMARY author (the original section writer); `contributorSessionIds` collects
 * every additional session that edited the artifact (polish passes). The record
 * is audit metadata — a torn sidecar must never sink assembly, so every reader
 * here is fail-soft.
 */

import { existsSync, readFileSync } from "fs";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import { sectionTasks, type SectionTask } from "../sections/sectionTasks.js";

export type CompilerSectionSessionRecord = {
  schemaVersion: "compiler-section-session-v1";
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  sectionKind: SectionTask["kind"];
  /** The PRIMARY author — the original section-writer session. */
  sectionSessionId: string;
  /** Additional sessions that edited this artifact after the writer (polish
   *  passes). Deduped + sorted so provenance is stable across runs. */
  contributorSessionIds?: string[];
  outputPath: string;
  recordedAt: string;
};

export function sectionSessionSidecarPath(task: SectionTask): string {
  return `${task.outputPath}.session.json`;
}

function readRecord(task: SectionTask): CompilerSectionSessionRecord | null {
  const p = sectionSessionSidecarPath(task);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as CompilerSectionSessionRecord;
  } catch {
    return null;
  }
}

/** Stamp the section-WRITER's session id. Called after a section writer produces
 *  the artifact; establishes the primary author and resets any prior contributor
 *  list (a fresh write is a fresh authorship record). No-op if the artifact isn't
 *  on disk (nothing to attribute). */
export function writeSectionSessionRecord(task: SectionTask, sessionId: string): void {
  if (!existsSync(task.outputPath)) return;
  const rec: CompilerSectionSessionRecord = {
    schemaVersion: "compiler-section-session-v1",
    bookId: task.bookId,
    chapterId: task.chapterId,
    chapterNumber: task.chapterNumber,
    sectionKind: task.kind,
    sectionSessionId: sessionId,
    outputPath: task.outputPath,
    recordedAt: new Date().toISOString(),
  };
  writeFileAtomic(sectionSessionSidecarPath(task), JSON.stringify(rec, null, 2) + "\n");
}

/** Append a POLISH session to an artifact's provenance WITHOUT losing the
 *  original writer. The writer stays `sectionSessionId`; the polisher joins
 *  `contributorSessionIds` (deduped + sorted). If no writer record exists yet
 *  (unexpected — polish runs after section write), the polish session becomes the
 *  primary author so provenance is never blank. No-op if the artifact is absent. */
export function recordPolishSession(task: SectionTask, sessionId: string): void {
  if (!existsSync(task.outputPath)) return;
  const prior = readRecord(task);
  const base: CompilerSectionSessionRecord = prior ?? {
    schemaVersion: "compiler-section-session-v1",
    bookId: task.bookId,
    chapterId: task.chapterId,
    chapterNumber: task.chapterNumber,
    sectionKind: task.kind,
    sectionSessionId: sessionId,
    outputPath: task.outputPath,
    recordedAt: new Date().toISOString(),
  };
  const contributors = new Set(base.contributorSessionIds ?? []);
  // Don't double-count the primary author as a contributor.
  if (sessionId !== base.sectionSessionId) contributors.add(sessionId);
  const rec: CompilerSectionSessionRecord = {
    ...base,
    contributorSessionIds: [...contributors].sort(),
    recordedAt: new Date().toISOString(),
  };
  writeFileAtomic(sectionSessionSidecarPath(task), JSON.stringify(rec, null, 2) + "\n");
}

/** Every distinct session id that contributed to a chapter's section artifacts
 *  (writers + polishers), deduped + sorted. Fail-soft per artifact: a torn
 *  sidecar is skipped, never fatal. */
export function contributorSessionIdsForChapter(bookId: string, chapterNumber: number): string[] {
  const ids: string[] = [];
  for (const task of sectionTasks(bookId).filter((t) => t.chapterNumber === chapterNumber)) {
    const rec = readRecord(task);
    if (!rec) continue;
    if (rec.sectionSessionId) ids.push(rec.sectionSessionId);
    for (const c of rec.contributorSessionIds ?? []) if (c) ids.push(c);
  }
  return [...new Set(ids)].sort();
}
