import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { chapterContentHash, type QcAttestation, type QcFinding } from "../../critics/qcAttestation.js";
import type { ChapterV21 } from "../../types.js";
import { CANONICAL_STATE } from "../../lib/chapterPaths.js";
import type { ValidatedBarReadSubmission, ValidatedConfirmReadSubmission } from "./schemas.js";

export const QC_ORCHESTRATOR_DIR = resolve(CANONICAL_STATE, "qc-orchestrator");

export function orchestratorRoundDir(bookId: string, roundId: string): string {
  return resolve(QC_ORCHESTRATOR_DIR, bookId, roundId);
}

export function submissionsDir(bookId: string, roundId: string, role?: string): string {
  return role ? resolve(orchestratorRoundDir(bookId, roundId), "submissions", role) : resolve(orchestratorRoundDir(bookId, roundId), "submissions");
}

export function taskCardsDir(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "task-cards");
}

export function roundRecordPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "round.json");
}

export function repairLedgerPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "repair-ledger.jsonl");
}

export function repairBriefPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "repair-brief.md");
}

export function repairPromptPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "repair-prompt.md");
}

export function qcSummaryPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "qc-summary.json");
}

export function evidenceMatrixPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "evidence-matrix.json");
}

export function confirmCandidatesPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "confirm-candidates.json");
}

/** Self-consistency tiebreak variants: the extra independent bar reads of a
 *  borderline chapter, stored alongside the primary read without overwriting it. */
export type BarReadVariant = "t2" | "t3";
export const BAR_READ_VARIANTS: readonly BarReadVariant[] = ["t2", "t3"];

export function barArtifactPath(bookId: string, roundId: string, chapterNumber: number, variant?: BarReadVariant): string {
  const suffix = variant ? `-${variant}` : "";
  return resolve(submissionsDir(bookId, roundId, "bar"), `ch${String(chapterNumber).padStart(2, "0")}.bar-read${suffix}.json`);
}

export function confirmArtifactPath(bookId: string, roundId: string, chapterNumber: number): string {
  return resolve(submissionsDir(bookId, roundId, "confirm"), `ch${String(chapterNumber).padStart(2, "0")}.confirm-read.json`);
}

function readJson(path: string): any | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function writeBarReadArtifact(submission: ValidatedBarReadSubmission, variant?: BarReadVariant): string {
  const path = barArtifactPath(submission.bookId, submission.roundId, submission.chapterNumber, variant);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ ...submission, storedAt: new Date().toISOString() }, null, 2), "utf8");
  return path;
}

export function writeConfirmReadArtifact(submission: ValidatedConfirmReadSubmission): string {
  const path = confirmArtifactPath(submission.bookId, submission.roundId, submission.chapterNumber);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ ...submission, storedAt: new Date().toISOString() }, null, 2), "utf8");
  return path;
}

export function loadBarReadArtifact(bookId: string, roundId: string, chapterNumber: number, variant?: BarReadVariant): ValidatedBarReadSubmission | null {
  const raw = readJson(barArtifactPath(bookId, roundId, chapterNumber, variant));
  return raw?.schemaVersion === "qc-bar-read-v1" || raw?.schemaVersion === "qc-bar-read-v2" ? raw as ValidatedBarReadSubmission : null;
}

/** The primary bar read plus any present tiebreak variants, for the self-consistency
 *  combine. Returns [] when no primary read exists. */
export function loadAllBarReads(bookId: string, roundId: string, chapterNumber: number): ValidatedBarReadSubmission[] {
  const primary = loadBarReadArtifact(bookId, roundId, chapterNumber);
  if (!primary) return [];
  const out = [primary];
  for (const v of BAR_READ_VARIANTS) {
    const r = loadBarReadArtifact(bookId, roundId, chapterNumber, v);
    if (r) out.push(r);
  }
  return out;
}

export function loadConfirmReadArtifact(bookId: string, roundId: string, chapterNumber: number): ValidatedConfirmReadSubmission | null {
  const raw = readJson(confirmArtifactPath(bookId, roundId, chapterNumber));
  return raw?.schemaVersion === "qc-confirm-read-v1" ? raw as ValidatedConfirmReadSubmission : null;
}

export function hasFreshBarReadArtifact(bookId: string, roundId: string, chapter: ChapterV21): boolean {
  const art = loadBarReadArtifact(bookId, roundId, chapter.number);
  return !!art && art.chapterId === chapter.chapterId && art.contentHash === chapterContentHash(chapter);
}

export function hasFreshConfirmReadArtifact(bookId: string, roundId: string, chapter: ChapterV21): boolean {
  const art = loadConfirmReadArtifact(bookId, roundId, chapter.number);
  return !!art && art.chapterId === chapter.chapterId && art.contentHash === chapterContentHash(chapter);
}

export function checkBarConfirmArtifactsForPublishable(chapter: ChapterV21, att: QcAttestation, enforce: boolean): QcFinding[] {
  const sev = enforce ? "blocker" : "advisory";
  if (att.verdict !== "PUBLISHABLE") return [];
  if (!att.roundId) {
    return [{ checkId: "QC0.no_api_artifacts_missing", severity: sev, message: `PUBLISHABLE attestation for ${chapter.chapterId} has no roundId, so bar/confirm artifacts cannot be verified.` }];
  }
  const findings: QcFinding[] = [];
  const bookId = att.bookId;
  const bar = loadBarReadArtifact(bookId, att.roundId, chapter.number);
  if (!bar) {
    findings.push({ checkId: "QC0.bar_read_missing", severity: sev, message: `Missing fresh bar-read artifact for ${chapter.chapterId}: ${barArtifactPath(bookId, att.roundId, chapter.number)}` });
  } else if (bar.chapterId !== chapter.chapterId || bar.contentHash !== chapterContentHash(chapter)) {
    findings.push({ checkId: "QC0.bar_read_stale", severity: sev, message: `Bar-read artifact is stale for ${chapter.chapterId}; regenerate the bar read after edits.` });
  }
  const confirm = loadConfirmReadArtifact(bookId, att.roundId, chapter.number);
  if (!confirm) {
    findings.push({ checkId: "QC0.confirm_read_missing", severity: sev, message: `Missing fresh confirm-read artifact for ${chapter.chapterId}: ${confirmArtifactPath(bookId, att.roundId, chapter.number)}` });
  } else if (confirm.chapterId !== chapter.chapterId || confirm.contentHash !== chapterContentHash(chapter)) {
    findings.push({ checkId: "QC0.confirm_read_stale", severity: sev, message: `Confirm-read artifact is stale for ${chapter.chapterId}; re-confirm after edits.` });
  } else if (confirm.decision !== "PUBLISHABLE") {
    findings.push({ checkId: "QC0.confirm_read_not_publishable", severity: sev, message: `Confirm-read decision for ${chapter.chapterId} is ${confirm.decision}, not PUBLISHABLE.` });
  }
  return findings;
}
