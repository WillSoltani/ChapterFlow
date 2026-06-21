import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { runShipGate, QC_ENFORCED_MAJORS } from "../critics/finalGate.js";
import { runBookGate } from "../critics/bookGate.js";
import { loadBookChapters } from "./manualKeyJudge.js";
import { loadQcRound, type QcRoundRole } from "./qcRound.js";

export const WAIVERS_DIR = resolve(CANONICAL_STATE, "waivers");

export type MajorFindingSnapshot = {
  id: string;
  scope: string;
  checkId: string;
  message: string;
  evidence?: string;
};

export const CURRENT_MAJOR_DISPOSITION_STATUSES = ["open", "waived_false_positive", "waived_accepted_debt"] as const;
export const LEGACY_MAJOR_DISPOSITION_STATUSES = ["resolved", "waived"] as const;
export type CurrentMajorDispositionStatus = typeof CURRENT_MAJOR_DISPOSITION_STATUSES[number];
export type LegacyMajorDispositionStatus = typeof LEGACY_MAJOR_DISPOSITION_STATUSES[number];
export type MajorDispositionStatus = CurrentMajorDispositionStatus | LegacyMajorDispositionStatus;

export type MajorDisposition = {
  findingId: string;
  status: MajorDispositionStatus;
  reason: string;
  reviewer: string;
  roundId: string;
  roundRole?: Extract<QcRoundRole, "major" | "confirm">;
  timestamp: string;
};
export type CurrentMajorDisposition = Omit<MajorDisposition, "status"> & { status: CurrentMajorDispositionStatus };

export type WaiverFile = {
  schemaVersion: "major-waivers-v1";
  bookId: string;
  dispositions: MajorDisposition[];
};

function shortHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

function findingId(scope: string, checkId: string, message: string, evidence?: string): string {
  return shortHash(`${scope}\n${checkId}\n${message}\n${evidence ?? ""}`);
}

export function currentMajorFindings(bookId: string, chapters = loadBookChapters(bookId)): MajorFindingSnapshot[] {
  const out: MajorFindingSnapshot[] = [];
  for (const ch of chapters) {
    const gate = runShipGate(ch);
    for (const f of gate.majors) {
      const scope = `chapter:${ch.number}:${f.unit}`;
      out.push({ id: findingId(scope, f.catalogId, f.message, f.evidence), scope, checkId: f.catalogId, message: f.message, evidence: f.evidence });
    }
  }
  const bookGate = runBookGate(bookId, chapters);
  for (const f of bookGate.findings.filter((x) => x.severity === "major")) {
    const scope = "book";
    out.push({ id: findingId(scope, f.catalogId, f.message, f.evidence), scope, checkId: f.catalogId, message: f.message, evidence: f.evidence });
  }
  return out;
}

export function waiverPath(bookId: string): string {
  return resolve(WAIVERS_DIR, `${bookId}.json`);
}

export function loadWaivers(bookId: string): WaiverFile {
  const p = waiverPath(bookId);
  if (!existsSync(p)) return { schemaVersion: "major-waivers-v1", bookId, dispositions: [] };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as WaiverFile;
    return { schemaVersion: "major-waivers-v1", bookId, dispositions: parsed.dispositions ?? [] };
  } catch {
    return { schemaVersion: "major-waivers-v1", bookId, dispositions: [] };
  }
}

export function writeDisposition(bookId: string, disposition: CurrentMajorDisposition): string {
  const file = loadWaivers(bookId);
  file.dispositions = [...file.dispositions.filter((d) => d.findingId !== disposition.findingId), disposition];
  mkdirSync(WAIVERS_DIR, { recursive: true });
  const p = waiverPath(bookId);
  writeFileSync(p, JSON.stringify(file, null, 2), "utf8");
  return p;
}

function dispositionClosesCurrentMajor(status: MajorDispositionStatus): boolean {
  return status === "waived_false_positive" ||
    status === "waived_accepted_debt" ||
    status === "resolved" ||
    status === "waived";
}

function dispositionIsRoundBacked(bookId: string, disposition: MajorDisposition): boolean {
  const round = loadQcRound(bookId, disposition.roundId);
  if (!round) return false;
  if (disposition.roundRole && round.roles?.[disposition.roundRole]) return true;
  return !!(round.roles?.major || round.roles?.confirm);
}

/**
 * The majors that actually BLOCK the QC verdict (REVISE / governance halt). This is
 * `currentMajorFindings` narrowed to `QC_ENFORCED_MAJORS` (an empty allowlist — see
 * finalGate.ts), then minus any waived/disposed finding. Deterministic majors stay
 * VISIBLE via `currentMajorFindings`/`formatMajorStatus` (human review + the conductor's
 * regression scan); they're just not, by themselves, a hard QC gate — every one of them
 * fires on the clean/gold corpus, so blocking on them is the documented convergence-killer
 * (SC9 et al.). Semantic quality is gated by the model QC (bar/sweep/confirm) + blockers.
 */
export function unresolvedMajors(bookId: string, chapters = loadBookChapters(bookId), requireRoundBacked = false): MajorFindingSnapshot[] {
  const dispositions = new Map(loadWaivers(bookId).dispositions.map((d) => [d.findingId, d]));
  return currentMajorFindings(bookId, chapters).filter((f) => {
    if (!QC_ENFORCED_MAJORS.has(f.checkId)) return false; // advisory-at-QC → never blocks
    const d = dispositions.get(f.id);
    if (!d || !dispositionClosesCurrentMajor(d.status)) return true;
    if (requireRoundBacked && !dispositionIsRoundBacked(bookId, d)) return true;
    return false;
  });
}

export function formatMajorStatus(bookId: string, chapters = loadBookChapters(bookId)): string {
  const current = currentMajorFindings(bookId, chapters);
  const dispositions = new Map(loadWaivers(bookId).dispositions.map((d) => [d.findingId, d]));
  const lines = [`major-status: ${current.length === 0 ? "PASS" : "CHECK"} (${current.length} current major(s))`];
  for (const f of current) {
    const d = dispositions.get(f.id);
    lines.push(`  [${d ? d.status.toUpperCase() : "UNRESOLVED"}] ${f.id} ${f.scope} ${f.checkId}: ${f.message.slice(0, 180)}`);
  }
  return lines.join("\n");
}
