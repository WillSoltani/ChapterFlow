import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname } from "path";

import { chapterContentHash } from "../../critics/qcAttestation.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { loadBookChapters } from "../manualKeyJudge.js";
import { repairLedgerPath } from "./artifacts.js";
import { evidenceSourceRef, type EvidenceSourceKind } from "./evidenceSource.js";
import { citesNonexistentField, quoteGroundedInChapter, searchableChapterText } from "./findingValidity.js";
import { findingsFromSubmission, type SubmissionFinding, type SubmissionRole, type ValidatedSubmission } from "./schemas.js";
import { sweepFamilyForRepairClass, sweepFindingBlocks } from "../sweep.js";
import { withQcTransaction } from "./transaction.js";

export type LedgerStatus =
  | "open"
  | "stale_after_repair"
  | "still_open"
  | "needs_qc_rerun"
  | "dismissed_non_gating"
  | "superseded_by_effective_decision";

export type LedgerSource = {
  sourceRole: SubmissionRole | "finalizer";
  submissionFile: string;
  sourceId?: string;
  sourceKind?: EvidenceSourceKind;
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

export type LedgerIntegrityIssue = {
  path: string;
  lineNumber: number;
  rawLine: string;
  message: string;
};

export class LedgerIntegrityError extends Error {
  readonly issues: LedgerIntegrityIssue[];

  constructor(issues: LedgerIntegrityIssue[]) {
    super(`Malformed QC repair ledger:\n${issues.map((issue) => `${issue.path}:${issue.lineNumber}: ${issue.message}`).join("\n")}`);
    this.name = "LedgerIntegrityError";
    this.issues = issues;
  }
}

function normalizeForId(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function stableFindingId(
  bookId: string,
  roundId: string,
  finding: Pick<SubmissionFinding, "chapterNumber" | "chapters" | "unitId" | "repairClass" | "quote">,
  authority: "raw" | "effective" = "raw",
): string {
  const chapterKey = finding.chapterNumber !== undefined
    ? String(finding.chapterNumber)
    : (finding.chapters ?? []).slice().sort((a, b) => a - b).join(",");
  const raw = [
    normalizeForId(authority),
    normalizeForId(bookId),
    normalizeForId(roundId),
    normalizeForId(chapterKey),
    normalizeForId(finding.unitId),
    normalizeForId(finding.repairClass),
    normalizeForId(finding.quote),
  ].join("\n");
  return `qcf-${createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 16)}`;
}

function isLedgerEvent(value: unknown): value is LedgerEvent {
  if (!value || typeof value !== "object") return false;
  const rec = value as Partial<LedgerEvent>;
  if (rec.schemaVersion !== "qc-repair-ledger-event-v1") return false;
  return rec.event === "finding" || rec.event === "source" || rec.event === "status";
}

function parseJsonlStrict(path: string, text: string): { events: LedgerEvent[]; issues: LedgerIntegrityIssue[] } {
  const events: LedgerEvent[] = [];
  const issues: LedgerIntegrityIssue[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (!isLedgerEvent(parsed)) {
        issues.push({ path, lineNumber: index + 1, rawLine: line, message: "invalid ledger event schema" });
        return;
      }
      events.push(parsed);
    } catch (err) {
      issues.push({ path, lineNumber: index + 1, rawLine: line, message: `malformed JSON (${(err as Error).message})` });
    }
  });
  return { events, issues };
}

function readLedgerParseResult(bookId: string, roundId: string): { path: string; events: LedgerEvent[]; issues: LedgerIntegrityIssue[] } {
  const path = repairLedgerPath(bookId, roundId);
  if (!existsSync(path)) return { path, events: [], issues: [] };
  const parsed = parseJsonlStrict(path, readFileSync(path, "utf8"));
  return { path, ...parsed };
}

export function quarantineMalformedLedger(bookId: string, roundId: string, options: { confirm?: boolean; now?: Date } = {}): {
  ok: boolean;
  ledgerPath: string;
  quarantinePath?: string;
  issues: LedgerIntegrityIssue[];
  eventsPreserved: number;
  error?: string;
} {
  return withQcTransaction(bookId, roundId, "repair-ledger-quarantine", () => {
    const parsed = readLedgerParseResult(bookId, roundId);
    if (parsed.issues.length === 0) return { ok: true, ledgerPath: parsed.path, issues: [], eventsPreserved: parsed.events.length };
    if (!options.confirm) {
      return {
        ok: false,
        ledgerPath: parsed.path,
        issues: parsed.issues,
        eventsPreserved: parsed.events.length,
        error: "Refusing to rewrite a malformed ledger without explicit operator confirmation.",
      };
    }
    const stamp = (options.now ?? new Date()).toISOString().replace(/[^0-9A-Za-z]/g, "");
    const quarantinePath = `${parsed.path}.quarantine-${stamp}.jsonl`;
    const quarantineLines = parsed.issues.map((issue) => JSON.stringify({
      schemaVersion: "qc-repair-ledger-quarantine-v1",
      bookId,
      roundId,
      originalLedgerPath: parsed.path,
      lineNumber: issue.lineNumber,
      rawLine: issue.rawLine,
      message: issue.message,
      quarantinedAt: (options.now ?? new Date()).toISOString(),
    })).join("\n") + "\n";
    mkdirSync(dirname(parsed.path), { recursive: true });
    writeFileAtomic(quarantinePath, quarantineLines);
    writeFileAtomic(parsed.path, parsed.events.map((event) => JSON.stringify(event)).join("\n") + (parsed.events.length ? "\n" : ""));
    return { ok: true, ledgerPath: parsed.path, quarantinePath, issues: parsed.issues, eventsPreserved: parsed.events.length };
  });
}

export function readLedgerEvents(bookId: string, roundId: string): LedgerEvent[] {
  const parsed = readLedgerParseResult(bookId, roundId);
  if (parsed.issues.length > 0) throw new LedgerIntegrityError(parsed.issues);
  return parsed.events;
}

/**
 * effectiveLedger for the UNATTENDED conductor path. A malformed/torn repair-ledger line makes the
 * strict effectiveLedger throw LedgerIntegrityError, which is uncaught across finalize/collect/publish
 * and HALTs the run with manual-only recovery (quarantineMalformedLedger --confirm) the conductor never
 * runs — the W2 wedge. Here a corrupt ledger AUTO-quarantines (raw lines preserved in a sibling
 * .quarantine file, never lost) and the VALID events are returned, so the run self-heals. The
 * supervised audit/CLI keeps the strict {@link effectiveLedger} so corruption is surfaced as a blocker,
 * not silently healed.
 */
export function effectiveLedgerResilient(bookId: string, roundId: string, onQuarantine?: (msg: string) => void): EffectiveLedgerFinding[] {
  try {
    return effectiveLedger(bookId, roundId);
  } catch (err) {
    if (!(err instanceof LedgerIntegrityError)) throw err;
    const repaired = quarantineMalformedLedger(bookId, roundId, { confirm: true });
    onQuarantine?.(repaired.ok
      ? `auto-quarantined ${repaired.issues.length} malformed repair-ledger line(s) for ${bookId}/${roundId} → ${repaired.quarantinePath} (preserved ${repaired.eventsPreserved} valid event(s))`
      : `repair-ledger for ${bookId}/${roundId} is malformed and could not be auto-quarantined: ${repaired.error}`);
    return repaired.ok ? effectiveLedger(bookId, roundId) : [];
  }
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
          if (!existing.sources.some((s) => sourceKey(s) === sourceKey(source))) existing.sources.push(source);
        }
      }
    } else if (event.event === "source") {
      const existing = byId.get(event.findingId);
      if (existing && !existing.sources.some((s) => sourceKey(s) === sourceKey(event.source))) {
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

function sourceKey(source: Pick<LedgerSource, "sourceRole" | "submissionFile" | "sourceId">): string {
  return source.sourceId ?? `${source.sourceRole}\0${source.submissionFile}`;
}

function appendLedgerEvents(bookId: string, roundId: string, events: LedgerEvent[]): void {
  if (events.length === 0) return;
  withQcTransaction(bookId, roundId, "status", () => {
    const path = repairLedgerPath(bookId, roundId);
    mkdirSync(dirname(path), { recursive: true });
    // Atomic append: a bare appendFileSync KILLED mid-write leaves a torn partial line that then
    // hard-throws (LedgerIntegrityError) across every later finalize/collect/publish read — a halt with
    // manual-only recovery during the multi-hour unattended run. Read + concatenate + writeFileAtomic
    // (temp + rename) makes the append all-or-nothing. The enclosing status-lock transaction serializes
    // the read-modify-write so concurrent appends can't interleave or lose events.
    const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
    const prefix = existing.length === 0 || existing.endsWith("\n") ? existing : existing + "\n";
    writeFileAtomic(path, prefix + events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  });
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

const RAW_SEMANTIC_ROLES = new Set<SubmissionRole>(["sweep", "bar", "confirm", "keyA", "keyB"]);

function activeStatus(status: LedgerStatus): boolean {
  return status === "open" || status === "still_open" || status === "needs_qc_rerun";
}

export function isRawSemanticLedgerFinding(finding: Pick<EffectiveLedgerFinding, "sources">): boolean {
  if (finding.sources.some((s) => s.sourceRole === "finalizer")) return false;
  return finding.sources.some((s) => RAW_SEMANTIC_ROLES.has(s.sourceRole as SubmissionRole));
}

export function hasBlockingAuthority(finding: Pick<EffectiveLedgerFinding, "status" | "sources">): boolean {
  return activeStatus(finding.status) && !isRawSemanticLedgerFinding(finding);
}

export function migrateRawSemanticLedgerFindings(bookId: string, roundId: string): number {
  const updates = effectiveLedger(bookId, roundId)
    .filter((f) => activeStatus(f.status) && isRawSemanticLedgerFinding(f))
    .map((f) => ({
      findingId: f.findingId,
      status: "dismissed_non_gating" as const,
      reason: "raw reviewer submission is immutable audit evidence only; blocking repair authority is rebuilt from effective finalizer decisions",
      validation: {
        sourceRoles: f.sources.map((s) => s.sourceRole),
        sourceIds: f.sources.map((s) => s.sourceId).filter(Boolean),
      },
    }));
  return appendStatusEvents(bookId, roundId, updates);
}

export function supersedeMissingEffectiveFindings(bookId: string, roundId: string, currentFindingIds: Iterable<string>): number {
  const current = new Set(currentFindingIds);
  const updates = effectiveLedger(bookId, roundId)
    .filter((f) => activeStatus(f.status) && f.sources.some((s) => s.sourceRole === "finalizer") && !current.has(f.findingId))
    .map((f) => ({
      findingId: f.findingId,
      status: "superseded_by_effective_decision" as const,
      reason: "this effective finding was not emitted by the latest finalizer decision rebuild for the round",
      validation: { currentEffectiveFindingIds: [...current].sort() },
    }));
  return appendStatusEvents(bookId, roundId, updates);
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
  // Drop fabricated findings before they can pollute the repair ledger / repair prompt:
  // a model reviewer that cites a chapter field which does not exist, OR a sweep finding
  // whose quote appears in none of the chapters it names (a paraphrased composite). The
  // ledger filter must mirror finalize's gate, or finalize clears REVISE while the ledger
  // keeps carrying the same finding OPEN and REVISE persists.
  const ledgerChapterText = new Map<number, string>();
  for (const ch of loadBookChapters(args.bookId)) ledgerChapterText.set(ch.number, searchableChapterText(ch));
  const getChapterText = (n: number) => ledgerChapterText.get(n);
  // A sweep submission finding reaches the ledger with its repairClass remapped to a remediation VERB
  // ("vary_scene_engine"), losing the family the gate guards key on. Recover it the way the sweep
  // record does — but ONLY for role "sweep": sweepFamilyForRepairClass DEFAULTS to repeated_unit, so
  // calling it on a bar/key finding would misclassify it and could drop a legitimate short-quote bar
  // finding. The finalizer path re-emits sweep findings only when checks.sweep === "FAIL", which the
  // sweep gate + finalize groundedness already suppress for non-distinctive / ungrounded findings.
  const sweepFamilyOf = (f: SubmissionFinding) => (args.role === "sweep" ? sweepFamilyForRepairClass(f.repairClass) : null);
  const findings = args.findings
    // Drop field-path fabrications + sweep findings whose quote appears in NONE of the named chapters.
    .filter((f) => citesNonexistentField(f, { getChapterText }) === null)
    // Mirror the sweep GATE (sweepChapterStatus / checkSweep): a non-distinctive repetition quote
    // (e.g. the tense auxiliary "had already") is non-gating everywhere, so it must never be dispatched
    // for repair. Without this the finding is cleared at the sweep gate yet kept OPEN in the ledger,
    // and ledger=OPEN_FINDINGS keeps the chapter REVISE forever (the-undoing-project run #3: a sweep
    // 'has already' demoted exactly the 7 chapters it named, all sweep=PASS).
    .filter((f) => {
      const fam = sweepFamilyOf(f);
      if (!fam) return true;
      return sweepFindingBlocks({
        family: fam,
        severity: f.severity === "blocker" || f.severity === "major" ? "blocker" : "advisory",
        chapters: f.chapters ?? (f.chapterNumber !== undefined ? [f.chapterNumber] : []),
        unitId: f.unitId,
        quote: f.quote,
        problem: f.problem,
        expectedFix: f.expectedFix,
      });
    })
    // Mirror finalize's per-chapter GROUNDEDNESS: a cross-chapter sweep finding is only carried OPEN
    // for the chapters its quote is actually grounded in. An over-named finding ('in the Hebrew
    // University seminar room' claimed across 12, present in 1) must not keep the 11 ungrounded
    // chapters REVISE after finalize's sweep gate cleared them. quoteGroundedInChapter is fail-closed,
    // so short quotes (persona NAMES, venues) trim nothing and behave as before.
    .map((f) => {
      if (!sweepFamilyOf(f) || !Array.isArray(f.chapters) || f.chapters.length === 0) return f;
      const grounded = f.chapters.filter((n) => quoteGroundedInChapter(f.quote ?? "", getChapterText(n) ?? ""));
      return grounded.length === f.chapters.length ? f : { ...f, chapters: grounded };
    })
    .filter((f) => { const fam = sweepFamilyOf(f); return !fam || !Array.isArray(f.chapters) || f.chapters.length > 0; });
  if (findings.length === 0) return { appended: 0, duplicates: 0, findingIds: [] };
  const existing = new Set(effectiveLedger(args.bookId, args.roundId).map((f) => f.findingId));
  const chapterHashes = hashByChapter(args.bookId);
  const now = new Date().toISOString();
  const events: LedgerEvent[] = [];
  let appended = 0;
  let duplicates = 0;
  const findingIds: string[] = [];
  for (const finding of findings) {
    const authority = args.role === "finalizer" ? "effective" : "raw";
    const findingId = stableFindingId(args.bookId, args.roundId, finding, authority);
    findingIds.push(findingId);
    const primary = evidenceSourceRef({
      bookId: args.bookId,
      roundId: args.roundId,
      sourceRole: args.role,
      submissionFile: args.submissionFile,
      sourceKind: args.role === "finalizer" ? "effective_decision" : "raw_submission",
    });
    const sources: LedgerSource[] = [{
      sourceRole: primary.sourceRole,
      submissionFile: primary.submissionFile,
      sourceId: primary.sourceId,
      sourceKind: primary.sourceKind,
      observedAt: now,
    }];
    for (const raw of finding.provenanceSources ?? []) {
      const ref = raw.sourceId
        ? { sourceRole: raw.sourceRole, submissionFile: raw.submissionFile, sourceId: raw.sourceId, sourceKind: raw.sourceKind ?? "raw_submission" as const }
        : evidenceSourceRef({
            bookId: args.bookId,
            roundId: args.roundId,
            sourceRole: raw.sourceRole,
            submissionFile: raw.submissionFile,
            sourceKind: raw.sourceKind ?? "raw_submission",
          });
      const source: LedgerSource = {
        sourceRole: ref.sourceRole,
        submissionFile: ref.submissionFile,
        sourceId: ref.sourceId,
        sourceKind: ref.sourceKind,
        observedAt: now,
      };
      if (!sources.some((s) => sourceKey(s) === sourceKey(source))) sources.push(source);
    }
    if (existing.has(findingId)) {
      duplicates++;
      for (const source of sources) events.push({ schemaVersion: "qc-repair-ledger-event-v1", event: "source", findingId, bookId: args.bookId, roundId: args.roundId, source });
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
      sources,
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
