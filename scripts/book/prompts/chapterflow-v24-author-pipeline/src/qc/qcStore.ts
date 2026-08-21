import { randomBytes } from "node:crypto";
import { link, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { replaceFileAtomic, type AtomicBookFileSeams } from "../books/atomicBookFiles.js";
import {
  bookPaths,
  ensureDirectoryWithinBooksRoot,
  readRegularFileWithinBooksRoot,
  requireBooksRoot,
  requirePathId,
} from "../books/bookPaths.js";
import type { Result, UtcIso } from "../contracts/v4Core.js";
import type { QcDiagnosis, QcDiagnosisIndex, QcIssue, QcRoundResult } from "./qcTypes.js";

export interface QcLedgerRoundEvent {
  readonly schemaVersion: "1";
  readonly kind: "ROUND";
  readonly revision: number;
  readonly round: QcRoundResult;
}

export interface QcLedgerRepairEvent {
  readonly schemaVersion: "1";
  readonly kind: "REPAIR";
  readonly revision: number;
  readonly repairId: string;
  readonly beforeRevision: number;
  readonly repairedAt: UtcIso;
}

export type QcLedgerEvent = QcLedgerRoundEvent | QcLedgerRepairEvent;

export interface ParsedQcLedger {
  readonly events: readonly QcLedgerEvent[];
  readonly issues: readonly string[];
}

export interface QcStoragePaths {
  readonly qcRoot: string;
  readonly ledger: string;
  readonly round: (roundId: string) => string;
  readonly diagnosesRoot: string;
  readonly diagnosis: (diagnosisId: string) => string;
  readonly preservedRoot: string;
  readonly preserved: (repairId: string) => string;
}

export interface QcStore extends QcDiagnosisIndex {
  getRound(bookId: string, roundId: string): Promise<Result<QcRoundResult>>;
  commitRound(bookId: string, round: QcRoundResult): Promise<Result<QcRoundResult>>;
  getDiagnosis(bookId: string, diagnosisId: string): Promise<Result<QcDiagnosis>>;
  createDiagnosis(bookId: string, diagnosis: QcDiagnosis): Promise<Result<QcDiagnosis>>;
  readLedger(bookId: string): Promise<Result<readonly QcLedgerEvent[]>>;
  readLedgerRaw(bookId: string): Promise<Result<Buffer>>;
  paths(bookId: string): Result<QcStoragePaths>;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isCanonicalUtc(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function safeQcId(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    [...value].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)
  ) {
    throw new Error(`${label} must be one safe opaque path segment`);
  }
  return value;
}

function parseIssue(value: unknown): QcIssue | null {
  if (!isRecord(value)) return null;
  const expected = value.location === undefined
    ? ["code", "message", "severity"]
    : ["code", "location", "message", "severity"];
  if (
    !exactKeys(value, expected) ||
    typeof value.code !== "string" ||
    value.code.length === 0 ||
    (value.severity !== "WARN" && value.severity !== "BLOCKER") ||
    typeof value.message !== "string" ||
    value.message.length === 0 ||
    (value.location !== undefined && (typeof value.location !== "string" || value.location.length === 0))
  ) {
    return null;
  }
  return {
    code: value.code,
    severity: value.severity,
    message: value.message,
    ...(value.location === undefined ? {} : { location: value.location as string }),
  };
}

function parseCandidate(value: unknown): { readonly candidateId: string; readonly manifestDigest: string } | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["candidateId", "manifestDigest"]) ||
    typeof value.candidateId !== "string" ||
    typeof value.manifestDigest !== "string" ||
    value.manifestDigest.length === 0
  ) {
    return null;
  }
  try {
    requirePathId(value.candidateId, "candidateId");
  } catch {
    return null;
  }
  return { candidateId: value.candidateId, manifestDigest: value.manifestDigest };
}

export function parseQcRound(value: unknown, roundId?: string): QcRoundResult | null {
  if (!isRecord(value) || !exactKeys(value, ["candidate", "completedAt", "issues", "outcome", "reviewId", "roundId", "schemaVersion"])) {
    return null;
  }
  if (
    value.schemaVersion !== "1" ||
    typeof value.roundId !== "string" ||
    (roundId !== undefined && value.roundId !== roundId) ||
    typeof value.reviewId !== "string" ||
    (value.outcome !== "PASS" && value.outcome !== "FAIL" && value.outcome !== "ERROR") ||
    !isCanonicalUtc(value.completedAt) ||
    !Array.isArray(value.issues)
  ) {
    return null;
  }
  try {
    safeQcId(value.roundId, "roundId");
    safeQcId(value.reviewId, "reviewId");
  } catch {
    return null;
  }
  const candidate = parseCandidate(value.candidate);
  const issues = value.issues.map(parseIssue);
  if (!candidate || issues.some((issue) => issue === null)) return null;
  return {
    schemaVersion: "1",
    roundId: value.roundId,
    candidate,
    reviewId: value.reviewId,
    outcome: value.outcome,
    issues: issues as QcIssue[],
    completedAt: value.completedAt,
  };
}

function parseDiagnosis(value: unknown, diagnosisId: string): QcDiagnosis | null {
  if (!isRecord(value) || !exactKeys(value, ["candidate", "createdAt", "diagnosisId", "issues", "roundId"])) return null;
  if (
    value.diagnosisId !== diagnosisId ||
    typeof value.roundId !== "string" ||
    !isCanonicalUtc(value.createdAt) ||
    !Array.isArray(value.issues)
  ) {
    return null;
  }
  try {
    safeQcId(value.diagnosisId, "diagnosisId");
    safeQcId(value.roundId, "roundId");
  } catch {
    return null;
  }
  const candidate = parseCandidate(value.candidate);
  const issues = value.issues.map(parseIssue);
  if (!candidate || issues.some((issue) => issue === null)) return null;
  return {
    diagnosisId,
    roundId: value.roundId,
    candidate,
    issues: issues as QcIssue[],
    createdAt: value.createdAt,
  };
}

function parseLedgerEvent(value: unknown): QcLedgerEvent | null {
  if (!isRecord(value) || value.schemaVersion !== "1" || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1) {
    return null;
  }
  if (value.kind === "ROUND") {
    if (!exactKeys(value, ["kind", "revision", "round", "schemaVersion"])) return null;
    const round = parseQcRound(value.round);
    return round ? { schemaVersion: "1", kind: "ROUND", revision: value.revision as number, round } : null;
  }
  if (value.kind === "REPAIR") {
    if (!exactKeys(value, ["beforeRevision", "kind", "repairId", "repairedAt", "revision", "schemaVersion"])) return null;
    if (
      typeof value.repairId !== "string" ||
      !Number.isSafeInteger(value.beforeRevision) ||
      (value.beforeRevision as number) < 0 ||
      value.revision !== (value.beforeRevision as number) + 1 ||
      !isCanonicalUtc(value.repairedAt)
    ) {
      return null;
    }
    try {
      safeQcId(value.repairId, "repairId");
    } catch {
      return null;
    }
    return {
      schemaVersion: "1",
      kind: "REPAIR",
      revision: value.revision as number,
      repairId: value.repairId,
      beforeRevision: value.beforeRevision as number,
      repairedAt: value.repairedAt,
    };
  }
  return null;
}

export function parseLedgerBytes(bytes: Uint8Array): ParsedQcLedger {
  const events: QcLedgerEvent[] = [];
  const issues: string[] = [];
  const lines = Buffer.from(bytes).toString("utf8").split(/\r?\n/);
  let expectedRevision = 1;
  lines.forEach((line, index) => {
    if (line.trim().length === 0) return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (cause) {
      issues.push(`line ${index + 1}: malformed JSON (${(cause as Error).message})`);
      return;
    }
    const event = parseLedgerEvent(value);
    if (!event) {
      issues.push(`line ${index + 1}: invalid QC ledger event`);
      return;
    }
    if (event.revision !== expectedRevision) {
      issues.push(`line ${index + 1}: expected revision ${expectedRevision}, found ${event.revision}`);
      return;
    }
    events.push(event);
    expectedRevision += 1;
  });
  return { events, issues };
}

export function serializeLedger(events: readonly QcLedgerEvent[]): Buffer {
  return Buffer.from(events.map((event) => JSON.stringify(event)).join("\n") + (events.length > 0 ? "\n" : ""), "utf8");
}

export function equivalentRound(left: QcRoundResult, right: QcRoundResult): boolean {
  return left.roundId === right.roundId &&
    left.candidate.candidateId === right.candidate.candidateId &&
    left.candidate.manifestDigest === right.candidate.manifestDigest &&
    left.reviewId === right.reviewId &&
    left.outcome === right.outcome &&
    JSON.stringify(left.issues) === JSON.stringify(right.issues);
}

export function qcStoragePaths(booksRoot: string, bookId: string): QcStoragePaths {
  const bookRoot = bookPaths(booksRoot, requirePathId(bookId, "bookId")).bookRoot;
  const qcRoot = resolve(bookRoot, "qc");
  const diagnosesRoot = resolve(qcRoot, "diagnoses");
  const preservedRoot = resolve(qcRoot, "ledger-preserved");
  return {
    qcRoot,
    ledger: resolve(qcRoot, "ledger.jsonl"),
    round: (roundId) => resolve(qcRoot, `${safeQcId(roundId, "roundId")}.json`),
    diagnosesRoot,
    diagnosis: (diagnosisId) => resolve(diagnosesRoot, `${safeQcId(diagnosisId, "diagnosisId")}.json`),
    preservedRoot,
    preserved: (repairId) => resolve(preservedRoot, `${safeQcId(repairId, "repairId")}.jsonl`),
  };
}

async function createFileAtomic(filePath: string, bytes: Uint8Array): Promise<"CREATED" | "EXISTS"> {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    try {
      await link(temporaryPath, filePath);
      return "CREATED";
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "EEXIST") return "EXISTS";
      throw cause;
    }
  } finally {
    await unlink(temporaryPath).catch((cause: NodeJS.ErrnoException) => {
      if (cause.code !== "ENOENT") throw cause;
    });
  }
}

async function readJsonFile<T>(
  booksRoot: string,
  filePath: string,
  missingCode: string,
  corruptCode: string,
  label: string,
  parse: (value: unknown) => T | null,
): Promise<Result<T>> {
  let bytes: Buffer;
  try {
    bytes = await readRegularFileWithinBooksRoot(booksRoot, filePath);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return failed(missingCode, `${label} not found`);
    return failed(corruptCode, `${label} read failed: ${(cause as Error).message}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    return failed(corruptCode, `${label} JSON is malformed: ${(cause as Error).message}`);
  }
  const parsed = parse(value);
  return parsed ? { ok: true, value: parsed } : failed(corruptCode, `${label} does not match schema 1`);
}

class FileQcStore implements QcStore {
  readonly #booksRoot: string;
  readonly #atomic: AtomicBookFileSeams;

  constructor(booksRoot: string, atomic: AtomicBookFileSeams = {}) {
    this.#booksRoot = requireBooksRoot(booksRoot);
    this.#atomic = atomic;
  }

  paths(bookId: string): Result<QcStoragePaths> {
    try {
      return { ok: true, value: qcStoragePaths(this.#booksRoot, bookId) };
    } catch (cause) {
      return failed("INVALID_QC_ID", (cause as Error).message);
    }
  }

  async getRound(bookId: string, roundId: string): Promise<Result<QcRoundResult>> {
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    let filePath: string;
    try {
      filePath = paths.value.round(roundId);
    } catch (cause) {
      return failed("INVALID_QC_ID", (cause as Error).message);
    }
    return readJsonFile(
      this.#booksRoot,
      filePath,
      "QC_ROUND_NOT_FOUND",
      "QC_ROUND_CORRUPT",
      `QC round ${bookId}/${roundId}`,
      (value) => parseQcRound(value, roundId),
    );
  }

  async commitRound(bookId: string, round: QcRoundResult): Promise<Result<QcRoundResult>> {
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    let roundPath: string;
    try {
      roundPath = paths.value.round(round.roundId);
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, paths.value.qcRoot);
    } catch (cause) {
      return failed("QC_WRITE_FAILED", `QC round directory failed: ${(cause as Error).message}`);
    }

    let stored = await this.getRound(bookId, round.roundId);
    if (!stored.ok && stored.error.code !== "QC_ROUND_NOT_FOUND") return stored;
    if (stored.ok && !equivalentRound(stored.value, round)) {
      return failed("QC_ROUND_ID_CONFLICT", `QC round ID already has conflicting identity: ${round.roundId}`);
    }

    const ledger = await this.readLedger(bookId);
    let events: readonly QcLedgerEvent[];
    if (!ledger.ok) {
      if (ledger.error.code !== "QC_LEDGER_MISSING") return ledger;
      events = [];
    } else {
      events = ledger.value;
    }

    const existingEvents = events.filter(
      (event): event is QcLedgerRoundEvent => event.kind === "ROUND" && event.round.roundId === round.roundId,
    );
    if (existingEvents.some((event) => !equivalentRound(event.round, round))) {
      return failed("QC_ROUND_ID_CONFLICT", `QC ledger already binds conflicting round ID: ${round.roundId}`);
    }
    if (existingEvents.length > 0) {
      if (stored.ok) return stored;
    }

    if (!stored.ok) {
      try {
        const created = await createFileAtomic(roundPath, Buffer.from(`${JSON.stringify(round, null, 2)}\n`, "utf8"));
        if (created === "EXISTS") {
          stored = await this.getRound(bookId, round.roundId);
          if (!stored.ok || !equivalentRound(stored.value, round)) {
            return failed("QC_ROUND_ID_CONFLICT", `QC round ID already exists: ${round.roundId}`);
          }
        } else {
          stored = { ok: true, value: round };
        }
      } catch (cause) {
        return failed("QC_WRITE_FAILED", `QC round create failed: ${(cause as Error).message}`);
      }
    }
    if (!stored.ok) return stored;
    if (existingEvents.length > 0) return stored;

    const event: QcLedgerRoundEvent = {
      schemaVersion: "1",
      kind: "ROUND",
      revision: events.length + 1,
      round: stored.value,
    };
    try {
      await replaceFileAtomic(paths.value.ledger, serializeLedger([...events, event]), this.#atomic);
      return stored;
    } catch (cause) {
      return failed("QC_WRITE_FAILED", `QC ledger replace failed: ${(cause as Error).message}`);
    }
  }

  async getDiagnosis(bookId: string, diagnosisId: string): Promise<Result<QcDiagnosis>> {
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    let filePath: string;
    try {
      filePath = paths.value.diagnosis(diagnosisId);
    } catch (cause) {
      return failed("INVALID_QC_ID", (cause as Error).message);
    }
    return readJsonFile(
      this.#booksRoot,
      filePath,
      "QC_DIAGNOSIS_NOT_FOUND",
      "QC_DIAGNOSIS_CORRUPT",
      `QC diagnosis ${bookId}/${diagnosisId}`,
      (value) => parseDiagnosis(value, diagnosisId),
    );
  }

  /**
   * Every durable diagnosis for the book. READ-ONLY and repeatable: it creates
   * nothing, so a resume can ask the same question as often as it likes.
   *
   * FAIL-CLOSED on anything it cannot establish. A missing `qc/diagnoses`
   * directory is a real, unambiguous "none yet" and answers `[]`; a directory it
   * cannot read, or a file in it that does not parse as a schema-1 diagnosis,
   * FAILS. Reporting an unreadable diagnosis as absent is the dangerous answer:
   * the chained-repair caller reads absence as "the operator has not diagnosed
   * this yet" and escalates, which would turn a corrupt byte into a permanent
   * REPAIR_DIAGNOSIS_REQUIRED that no amount of qc-diagnose can clear.
   *
   * `createFileAtomic` stages under `<file>.tmp-<pid>-<hex>`, so the `.json`
   * filter is what keeps a concurrent write from being read as a corrupt
   * diagnosis. The id is the file's basename, and `getDiagnosis` re-derives the
   * path from it — a name that is not a safe QC id fails INVALID_QC_ID rather
   * than reaching the filesystem.
   */
  async listDiagnoses(bookId: string): Promise<Result<readonly QcDiagnosis[]>> {
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    let entries: readonly string[];
    try {
      entries = await readdir(paths.value.diagnosesRoot);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { ok: true, value: Object.freeze([]) };
      return failed("QC_DIAGNOSIS_LIST_FAILED", `QC diagnoses list failed: ${(cause as Error).message}`);
    }
    const diagnoses: QcDiagnosis[] = [];
    for (const entry of [...entries].filter((name) => name.endsWith(".json")).sort()) {
      const read = await this.getDiagnosis(bookId, entry.slice(0, -".json".length));
      if (!read.ok) return read;
      diagnoses.push(read.value);
    }
    return { ok: true, value: Object.freeze(diagnoses) };
  }

  async createDiagnosis(bookId: string, diagnosis: QcDiagnosis): Promise<Result<QcDiagnosis>> {
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    let filePath: string;
    try {
      filePath = paths.value.diagnosis(diagnosis.diagnosisId);
      await ensureDirectoryWithinBooksRoot(this.#booksRoot, paths.value.diagnosesRoot);
    } catch (cause) {
      return failed("QC_DIAGNOSIS_WRITE_FAILED", `QC diagnosis directory failed: ${(cause as Error).message}`);
    }
    try {
      const created = await createFileAtomic(filePath, Buffer.from(`${JSON.stringify(diagnosis, null, 2)}\n`, "utf8"));
      if (created === "CREATED") return { ok: true, value: diagnosis };
      const existing = await this.getDiagnosis(bookId, diagnosis.diagnosisId);
      if (
        existing.ok &&
        existing.value.roundId === diagnosis.roundId &&
        existing.value.candidate.candidateId === diagnosis.candidate.candidateId &&
        existing.value.candidate.manifestDigest === diagnosis.candidate.manifestDigest &&
        JSON.stringify(existing.value.issues) === JSON.stringify(diagnosis.issues)
      ) {
        return existing;
      }
      return failed("QC_DIAGNOSIS_ID_CONFLICT", `QC diagnosis ID already exists: ${diagnosis.diagnosisId}`);
    } catch (cause) {
      return failed("QC_DIAGNOSIS_WRITE_FAILED", `QC diagnosis create failed: ${(cause as Error).message}`);
    }
  }

  async readLedgerRaw(bookId: string): Promise<Result<Buffer>> {
    const paths = this.paths(bookId);
    if (!paths.ok) return paths;
    try {
      return { ok: true, value: await readRegularFileWithinBooksRoot(this.#booksRoot, paths.value.ledger) };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
        return failed("QC_LEDGER_MISSING", `QC ledger not found: ${bookId}`);
      }
      return failed("QC_LEDGER_READ_FAILED", `QC ledger read failed: ${(cause as Error).message}`);
    }
  }

  async readLedger(bookId: string): Promise<Result<readonly QcLedgerEvent[]>> {
    const raw = await this.readLedgerRaw(bookId);
    if (!raw.ok) return raw;
    const parsed = parseLedgerBytes(raw.value);
    if (parsed.issues.length > 0 || parsed.events.length === 0) {
      const details = parsed.issues.length > 0 ? parsed.issues.join("; ") : "ledger has no valid events";
      return failed("QC_LEDGER_MALFORMED", `QC ledger is malformed: ${details}`);
    }
    return { ok: true, value: parsed.events };
  }
}

export function createQcStore(options: Readonly<{
  booksRoot: string;
  atomic?: AtomicBookFileSeams;
}>): QcStore {
  return new FileQcStore(options.booksRoot, options.atomic);
}
