import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CANONICAL_STATE } from "../lib/chapterPaths.js";
import { runShipGate } from "../critics/finalGate.js";
import { runBookGate } from "../critics/bookGate.js";
import { isApprovedReviewer, chapterContentHash } from "../critics/qcAttestation.js";
import { canonicalJsonSha256 } from "../lib/canonicalJson.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { loadBookChapters } from "./manualKeyJudge.js";
import { loadQcRound, type QcRoundRole } from "./qcRound.js";

export const WAIVERS_DIR = resolve(CANONICAL_STATE, "waivers");
export const MAJOR_WAIVER_FILE_SCHEMA_VERSION = "major-waivers-v2" as const;
export const MAJOR_WAIVER_RECORD_SCHEMA_VERSION = "major-waiver-v2" as const;
export const MAJOR_WAIVER_CHAPTER_HASH_VERSION = "chapter-content-hash-v2" as const;
export const MAJOR_WAIVER_BOOK_HASH_VERSION = "book-major-content-hash-v1" as const;

export type MajorFindingSnapshot = {
  id: string;
  scope: string;
  checkId: string;
  message: string;
  evidence?: string;
  contentHash: string;
  contentHashVersion: typeof MAJOR_WAIVER_CHAPTER_HASH_VERSION | typeof MAJOR_WAIVER_BOOK_HASH_VERSION;
  findingHash: string;
};

export const CURRENT_MAJOR_DISPOSITION_STATUSES = ["open", "waived_false_positive", "waived_accepted_debt"] as const;
export const LEGACY_MAJOR_DISPOSITION_STATUSES = ["resolved", "waived"] as const;
export type CurrentMajorDispositionStatus = typeof CURRENT_MAJOR_DISPOSITION_STATUSES[number];
export type LegacyMajorDispositionStatus = typeof LEGACY_MAJOR_DISPOSITION_STATUSES[number];
export type MajorDispositionStatus = CurrentMajorDispositionStatus | LegacyMajorDispositionStatus;

export type MajorDisposition = {
  schemaVersion?: typeof MAJOR_WAIVER_RECORD_SCHEMA_VERSION;
  findingId: string;
  status: MajorDispositionStatus;
  checkId?: string;
  scope?: string;
  reason: string;
  reviewer: string;
  reviewerSessionId?: string;
  roundId: string;
  roundRole?: Extract<QcRoundRole, "major" | "confirm">;
  timestamp: string;
  contentHash?: string;
  contentHashVersion?: typeof MAJOR_WAIVER_CHAPTER_HASH_VERSION | typeof MAJOR_WAIVER_BOOK_HASH_VERSION;
  findingHash?: string;
  expiresAt?: string;
};
export type CurrentMajorDisposition = Omit<MajorDisposition, "status"> & { status: CurrentMajorDispositionStatus };

export type WaiverFile = {
  schemaVersion: "major-waivers-v1" | typeof MAJOR_WAIVER_FILE_SCHEMA_VERSION;
  bookId: string;
  dispositions: MajorDisposition[];
};

export type MajorDispositionDecision =
  | "open"
  | "waived"
  | "waiver_expired"
  | "waiver_stale"
  | "waiver_unbound"
  | "waiver_unapproved_reviewer"
  | "waiver_missing_round"
  | "waiver_mismatch";

export type MajorPolicyDecision = {
  finding: MajorFindingSnapshot;
  disposition?: MajorDisposition;
  decision: MajorDispositionDecision;
  blocking: boolean;
  reason: string;
};

export type MajorCleanlinessOptions = {
  requireRoundBacked?: boolean;
  requireContentBound?: boolean;
  now?: Date;
};

export type MajorCleanlinessResult = {
  ok: boolean;
  current: MajorFindingSnapshot[];
  decisions: MajorPolicyDecision[];
  unresolved: MajorFindingSnapshot[];
};

function shortHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

function findingId(scope: string, checkId: string, message: string, evidence?: string): string {
  return shortHash(`${scope}\n${checkId}\n${message}\n${evidence ?? ""}`);
}

function bookContentHash(chapters: ChapterV21[]): string {
  return canonicalJsonSha256(chapters
    .map((ch) => ({ chapterId: ch.chapterId, number: ch.number, contentHash: chapterContentHash(ch) }))
    .sort((a, b) => a.number - b.number || a.chapterId.localeCompare(b.chapterId)));
}

function bindingForScope(scope: string, chapters: ChapterV21[]): { contentHash: string; contentHashVersion: MajorFindingSnapshot["contentHashVersion"] } {
  const chapterNumber = Number(scope.match(/^chapter:(\d+):/)?.[1] ?? NaN);
  const chapter = Number.isFinite(chapterNumber) ? chapters.find((ch) => ch.number === chapterNumber) : undefined;
  if (chapter) {
    return { contentHash: chapterContentHash(chapter), contentHashVersion: MAJOR_WAIVER_CHAPTER_HASH_VERSION };
  }
  return { contentHash: bookContentHash(chapters), contentHashVersion: MAJOR_WAIVER_BOOK_HASH_VERSION };
}

function snapshotFinding(scope: string, checkId: string, message: string, evidence: string | undefined, chapters: ChapterV21[]): MajorFindingSnapshot {
  const binding = bindingForScope(scope, chapters);
  const id = findingId(scope, checkId, message, evidence);
  return {
    id,
    scope,
    checkId,
    message,
    evidence,
    ...binding,
    findingHash: shortHash(`${id}\n${binding.contentHash}\n${binding.contentHashVersion}`),
  };
}

export function currentMajorFindings(bookId: string, chapters = loadBookChapters(bookId)): MajorFindingSnapshot[] {
  const out: MajorFindingSnapshot[] = [];
  for (const ch of chapters) {
    const gate = runShipGate(ch);
    for (const f of gate.majors) {
      const scope = `chapter:${ch.number}:${f.unit}`;
      out.push(snapshotFinding(scope, f.catalogId, f.message, f.evidence, chapters));
    }
  }
  const bookGate = runBookGate(bookId, chapters);
  for (const f of bookGate.findings.filter((x) => x.severity === "major")) {
    const scope = "book";
    out.push(snapshotFinding(scope, f.catalogId, f.message, f.evidence, chapters));
  }
  return out;
}

export function waiverPath(bookId: string): string {
  return resolve(WAIVERS_DIR, `${bookId}.json`);
}

export function loadWaivers(bookId: string): WaiverFile {
  const p = waiverPath(bookId);
  if (!existsSync(p)) return { schemaVersion: MAJOR_WAIVER_FILE_SCHEMA_VERSION, bookId, dispositions: [] };
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as WaiverFile;
    return {
      schemaVersion: parsed.schemaVersion === MAJOR_WAIVER_FILE_SCHEMA_VERSION ? MAJOR_WAIVER_FILE_SCHEMA_VERSION : "major-waivers-v1",
      bookId,
      dispositions: Array.isArray(parsed.dispositions) ? parsed.dispositions : [],
    };
  } catch {
    return { schemaVersion: MAJOR_WAIVER_FILE_SCHEMA_VERSION, bookId, dispositions: [] };
  }
}

export function writeDisposition(bookId: string, disposition: CurrentMajorDisposition): string {
  const file = loadWaivers(bookId);
  const finding = currentMajorFindings(bookId).find((f) => f.id === disposition.findingId);
  const enriched: CurrentMajorDisposition = {
    ...disposition,
    schemaVersion: MAJOR_WAIVER_RECORD_SCHEMA_VERSION,
    checkId: disposition.checkId ?? finding?.checkId,
    scope: disposition.scope ?? finding?.scope,
    reviewerSessionId: disposition.reviewerSessionId ?? process.env.CHAPTERFLOW_SESSION_ID,
    contentHash: disposition.contentHash ?? finding?.contentHash,
    contentHashVersion: disposition.contentHashVersion ?? finding?.contentHashVersion,
    findingHash: disposition.findingHash ?? finding?.findingHash,
  };
  file.schemaVersion = MAJOR_WAIVER_FILE_SCHEMA_VERSION;
  file.dispositions = [...file.dispositions.filter((d) => d.findingId !== disposition.findingId), enriched];
  mkdirSync(WAIVERS_DIR, { recursive: true });
  const p = waiverPath(bookId);
  writeFileAtomic(p, JSON.stringify(file, null, 2) + "\n");
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

function normalizeOptions(options: boolean | MajorCleanlinessOptions | undefined): Required<MajorCleanlinessOptions> {
  if (typeof options === "boolean") {
    return { requireRoundBacked: options, requireContentBound: true, now: new Date() };
  }
  return {
    requireRoundBacked: options?.requireRoundBacked ?? false,
    requireContentBound: options?.requireContentBound ?? true,
    now: options?.now ?? new Date(),
  };
}

function effectiveDisposition(bookId: string, finding: MajorFindingSnapshot, disposition: MajorDisposition | undefined, options: Required<MajorCleanlinessOptions>): MajorPolicyDecision {
  if (!disposition || !dispositionClosesCurrentMajor(disposition.status)) {
    return { finding, disposition, decision: "open", blocking: true, reason: "No closing waiver is recorded for this current major." };
  }
  if (!isApprovedReviewer(disposition.reviewer)) {
    return { finding, disposition, decision: "waiver_unapproved_reviewer", blocking: true, reason: `Waiver reviewer ${JSON.stringify(disposition.reviewer)} is not approved.` };
  }
  if (options.requireRoundBacked && !dispositionIsRoundBacked(bookId, disposition)) {
    return { finding, disposition, decision: "waiver_missing_round", blocking: true, reason: "Waiver is not backed by an open QC round role." };
  }
  if (disposition.expiresAt && Date.parse(disposition.expiresAt) <= options.now.getTime()) {
    return { finding, disposition, decision: "waiver_expired", blocking: true, reason: `Waiver expired at ${disposition.expiresAt}.` };
  }
  if (options.requireContentBound) {
    if (disposition.schemaVersion !== MAJOR_WAIVER_RECORD_SCHEMA_VERSION || !disposition.contentHash || !disposition.contentHashVersion || !disposition.checkId || !disposition.scope) {
      return { finding, disposition, decision: "waiver_unbound", blocking: true, reason: "Waiver is legacy or missing its content/check binding." };
    }
    if (disposition.checkId !== finding.checkId || disposition.scope !== finding.scope) {
      return { finding, disposition, decision: "waiver_mismatch", blocking: true, reason: "Waiver check/scope no longer matches the current finding." };
    }
    if (disposition.contentHashVersion !== finding.contentHashVersion || disposition.contentHash !== finding.contentHash) {
      return { finding, disposition, decision: "waiver_stale", blocking: true, reason: "Waiver content hash is stale against current reader content." };
    }
    if (disposition.findingHash && disposition.findingHash !== finding.findingHash) {
      return { finding, disposition, decision: "waiver_mismatch", blocking: true, reason: "Waiver finding hash no longer matches the current finding." };
    }
  }
  return { finding, disposition, decision: "waived", blocking: false, reason: `${disposition.status} by ${disposition.reviewer}.` };
}

export function evaluateMajorCleanliness(bookId: string, chapters = loadBookChapters(bookId), options?: boolean | MajorCleanlinessOptions): MajorCleanlinessResult {
  const opts = normalizeOptions(options);
  const dispositions = new Map(loadWaivers(bookId).dispositions.map((d) => [d.findingId, d]));
  const current = currentMajorFindings(bookId, chapters);
  const decisions = current.map((f) => effectiveDisposition(bookId, f, dispositions.get(f.id), opts));
  const unresolved = decisions.filter((d) => d.blocking).map((d) => d.finding);
  return { ok: unresolved.length === 0, current, decisions, unresolved };
}

/**
 * Current production policy: every current major blocks unless a narrow,
 * reviewer-attributed, round-backed (when requested), content-bound waiver closes
 * that exact finding on the exact current reader content. Minors and advisories
 * never enter this list.
 */
export function unresolvedMajors(bookId: string, chapters = loadBookChapters(bookId), options?: boolean | MajorCleanlinessOptions): MajorFindingSnapshot[] {
  return evaluateMajorCleanliness(bookId, chapters, options).unresolved;
}

export function formatMajorStatus(bookId: string, chapters = loadBookChapters(bookId)): string {
  const policy = evaluateMajorCleanliness(bookId, chapters);
  const lines = [`major-status: ${policy.ok ? "PASS" : "CHECK"} (${policy.current.length} current major(s), ${policy.unresolved.length} unresolved)`];
  for (const d of policy.decisions) {
    const marker = d.blocking ? d.decision.toUpperCase() : "WAIVED";
    lines.push(`  [${marker}] ${d.finding.id} ${d.finding.scope} ${d.finding.checkId}: ${d.finding.message.slice(0, 180)}${d.blocking ? ` (${d.reason})` : ""}`);
  }
  return lines.join("\n");
}
