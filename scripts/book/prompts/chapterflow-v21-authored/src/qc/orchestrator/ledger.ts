import { createHash } from "crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname } from "path";

import { chapterContentHash } from "../../critics/qcAttestation.js";
import { loadBookChapters } from "../manualKeyJudge.js";
import { repairLedgerPath } from "./artifacts.js";
import { citesNonexistentField } from "./findingValidity.js";
import { findingsFromSubmission, type SubmissionFinding, type SubmissionRole, type ValidatedSubmission } from "./schemas.js";

export type LedgerStatus = "open" | "stale_after_repair" | "still_open" | "needs_qc_rerun";

export type LedgerSource = {
  sourceRole: SubmissionRole | "finalizer";
  submissionFile: string;
  observedAt: string;
};

export type LedgerFindingEvent = {
  schemaVersion: "qc-repair-ledger-event-v1";
  event: "finding";
  findingId: string;
  bookId: string;
  roundId: string;
  chapterNumber?: number;
  chapters?: number[];
  unitId: string;
  repairClass: string;
  severity: SubmissionFinding["severity"];
  quote: string;
  problem: string;
  expectedFix: string;
  globalTheme: string;
  status: "open";
  contentHashAtFinding?: string;
  sources: LedgerSource[];
  createdAt: string;
};

export type LedgerSourceEvent = {
  schemaVersion: "qc-repair-ledger-event-v1";
  event: "source";
  findingId: string;
  bookId: string;
  roundId: string;
  source: LedgerSource;
};

export type LedgerStatusEvent = {
  schemaVersion: "qc-repair-ledger-event-v1";
  event: "status";
  findingId: string;
  bookId: string;
  roundId: string;
  status: Exclude<LedgerStatus, "open">;
  reason: string;
  validation?: Record<string, unknown>;
  updatedAt: string;
};

export type LedgerEvent = LedgerFindingEvent | LedgerSourceEvent | LedgerStatusEvent;

export type EffectiveLedgerFinding = Omit<LedgerFindingEvent, "event" | "schemaVersion" | "status" | "sources"> & {
  status: LedgerStatus;
  statusReason?: string;
  statusUpdatedAt?: string;
  sources: LedgerSource[];
};

function normalizeForId(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function stableFindingId(bookId: string, roundId: string, finding: Pick<SubmissionFinding, "chapterNumber" | "chapters" | "unitId" | "repairClass" | "quote">): string {
  const chapterKey = finding.chapterNumber !== undefined
    ? String(finding.chapterNumber)
    : (finding.chapters ?? []).slice().sort((a, b) => a - b).join(",");
  const raw = [
    normalizeForId(bookId),
    normalizeForId(roundId),
    normalizeForId(chapterKey),
    normalizeForId(finding.unitId),
    normalizeForId(finding.repairClass),
    normalizeForId(finding.quote),
  ].join("\n");
  return `qcf-${createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 16)}`;
}

function parseJsonl(text: string): LedgerEvent[] {
  return text.split(/\r?\n/).filter((line) => line.trim()).flatMap((line) => {
    try {
      const parsed = JSON.parse(line) as LedgerEvent;
      return parsed?.schemaVersion === "qc-repair-ledger-event-v1" ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

export function readLedgerEvents(bookId: string, roundId: string): LedgerEvent[] {
  const p = repairLedgerPath(bookId, roundId);
  if (!existsSync(p)) return [];
  return parseJsonl(readFileSync(p, "utf8"));
}

export function effectiveLedger(bookId: string, roundId: string): EffectiveLedgerFinding[] {
  const byId = new Map<string, EffectiveLedgerFinding>();
  for (const event of readLedgerEvents(bookId, roundId)) {
    if (event.event === "finding") {
      if (!byId.has(event.findingId)) {
        const { schemaVersion: _schema, event: _event, status: _status, sources, ...rest } = event;
        byId.set(event.findingId, { ...rest, status: "open", sources: [...sources] });
      } else {
        const existing = byId.get(event.findingId)!;
        for (const source of event.sources) {
          if (!existing.sources.some((s) => s.sourceRole === source.sourceRole && s.submissionFile === source.submissionFile)) existing.sources.push(source);
        }
      }
    } else if (event.event === "source") {
      const existing = byId.get(event.findingId);
      if (existing && !existing.sources.some((s) => s.sourceRole === event.source.sourceRole && s.submissionFile === event.source.submissionFile)) {
        existing.sources.push(event.source);
      }
    } else if (event.event === "status") {
      const existing = byId.get(event.findingId);
      if (existing) {
        existing.status = event.status;
        existing.statusReason = event.reason;
        existing.statusUpdatedAt = event.updatedAt;
      }
    }
  }
  return [...byId.values()];
}

function appendLedgerEvents(bookId: string, roundId: string, events: LedgerEvent[]): void {
  if (events.length === 0) return;
  const path = repairLedgerPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
}

export function appendStatusEvents(bookId: string, roundId: string, updates: Array<{ findingId: string; status: Exclude<LedgerStatus, "open">; reason: string; validation?: Record<string, unknown> }>): number {
  const now = new Date().toISOString();
  const events: LedgerStatusEvent[] = updates.map((u) => ({
    schemaVersion: "qc-repair-ledger-event-v1",
    event: "status",
    findingId: u.findingId,
    bookId,
    roundId,
    status: u.status,
    reason: u.reason,
    validation: u.validation,
    updatedAt: now,
  }));
  appendLedgerEvents(bookId, roundId, events);
  return events.length;
}

function hashByChapter(bookId: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const ch of loadBookChapters(bookId)) out.set(ch.number, chapterContentHash(ch));
  return out;
}

export function appendFindings(args: {
  bookId: string;
  roundId: string;
  role: SubmissionRole | "finalizer";
  submissionFile: string;
  findings: SubmissionFinding[];
}): { appended: number; duplicates: number; findingIds: string[] } {
  if (args.findings.length === 0) return { appended: 0, duplicates: 0, findingIds: [] };
  // Drop fabricated findings (a model reviewer that cites a chapter field which
  // does not exist) before they can pollute the repair ledger / repair prompt.
  const findings = args.findings.filter((f) => citesNonexistentField(f) === null);
  if (findings.length === 0) return { appended: 0, duplicates: 0, findingIds: [] };
  const existing = new Set(effectiveLedger(args.bookId, args.roundId).map((f) => f.findingId));
  const chapterHashes = hashByChapter(args.bookId);
  const now = new Date().toISOString();
  const events: LedgerEvent[] = [];
  let appended = 0;
  let duplicates = 0;
  const findingIds: string[] = [];
  for (const finding of findings) {
    const findingId = stableFindingId(args.bookId, args.roundId, finding);
    findingIds.push(findingId);
    const source: LedgerSource = { sourceRole: args.role, submissionFile: args.submissionFile, observedAt: now };
    if (existing.has(findingId)) {
      duplicates++;
      events.push({ schemaVersion: "qc-repair-ledger-event-v1", event: "source", findingId, bookId: args.bookId, roundId: args.roundId, source });
      continue;
    }
    existing.add(findingId);
    appended++;
    events.push({
      schemaVersion: "qc-repair-ledger-event-v1",
      event: "finding",
      findingId,
      bookId: args.bookId,
      roundId: args.roundId,
      chapterNumber: finding.chapterNumber,
      chapters: finding.chapters,
      unitId: finding.unitId,
      repairClass: finding.repairClass,
      severity: finding.severity,
      quote: finding.quote,
      problem: finding.problem,
      expectedFix: finding.expectedFix,
      globalTheme: finding.globalTheme ?? finding.repairClass,
      status: "open",
      contentHashAtFinding: finding.chapterNumber !== undefined ? chapterHashes.get(finding.chapterNumber) : undefined,
      sources: [source],
      createdAt: now,
    });
  }
  appendLedgerEvents(args.bookId, args.roundId, events);
  return { appended, duplicates, findingIds };
}

export function appendFindingsFromSubmission(args: {
  bookId: string;
  roundId: string;
  role: SubmissionRole;
  submissionFile: string;
  submission: ValidatedSubmission;
}): { appended: number; duplicates: number; findingIds: string[] } {
  return appendFindings({
    bookId: args.bookId,
    roundId: args.roundId,
    role: args.role,
    submissionFile: args.submissionFile,
    findings: findingsFromSubmission(args.submission),
  });
}

export function ledgerStatusSummary(bookId: string, roundId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const finding of effectiveLedger(bookId, roundId)) out[finding.status] = (out[finding.status] ?? 0) + 1;
  return out;
}
