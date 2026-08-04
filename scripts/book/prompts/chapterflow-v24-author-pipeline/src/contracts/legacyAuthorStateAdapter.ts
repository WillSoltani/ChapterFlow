import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "path";

import { createBookContentReader } from "../books/bookContentReader.js";
import { createBookWriteLock } from "../books/bookLease.js";
import { createCandidateStore } from "../books/candidateStore.js";
import type { BookContentReader, CandidateInputFile, CandidateManifest, CandidateStore } from "../books/candidateTypes.js";
import { createCurrentPointerStore } from "../books/currentPointer.js";
import type { PlannedArtifact, PortError, Result } from "./v4Core.js";
import { FileRunStore } from "../run-state/fileRunStore.js";
import type { RunStore } from "../run-state/runStore.js";
import type {
  AttemptAdmission,
  AttemptOutcome,
  AttemptSnapshot,
  RunDefinition,
  RunSnapshot,
} from "../run-state/runTypes.js";
import { FileStageCoordinator } from "../run-state/stageCoordinator.js";
import type { ResumePlan, StageCheckpoint, StageCoordinator } from "../run-state/stageTypes.js";

export const LEGACY_AUTHOR_STATE_CATEGORIES = [
  "LEAD_OVERRIDE",
  "AUTHOR_ACCEPTANCE",
  "KEY_JUDGE_EVIDENCE",
  "SWEEP_EVIDENCE",
  "REVIEW_HISTORY",
  "REVIEW_CLEARS",
  "REGEN_LEDGER",
  "KEY_EVIDENCE_CLEARS",
  "COST_REPORT",
  "RUN_MANIFEST",
  "SECTION_SESSION",
] as const;

export type LegacyAuthorStateCategory = typeof LEGACY_AUTHOR_STATE_CATEGORIES[number];

/** Inventory only. Legacy modules remain schema/path authority. */
export const LEGACY_AUTHOR_STATE_CATEGORY_MAP: Readonly<Record<LegacyAuthorStateCategory, string>> = {
  LEAD_OVERRIDE: "authorRun lead override sidecar",
  AUTHOR_ACCEPTANCE: "authorAcceptanceState acceptance record",
  KEY_JUDGE_EVIDENCE: "authorEvidence key-judge records",
  SWEEP_EVIDENCE: "authorEvidence sweep records",
  REVIEW_HISTORY: "authorReviewLedger content-bound history",
  REVIEW_CLEARS: "authorReviewLedger materialized clears",
  REGEN_LEDGER: "authorRegenLedger consumed-attempt ledger",
  KEY_EVIDENCE_CLEARS: "keyEvidenceLedger materialized clears",
  COST_REPORT: "sessionLedger cost report",
  RUN_MANIFEST: "sessionLedger run manifest",
  SECTION_SESSION: "sectionSessionRecord sidecar",
};

export type LegacyAdapterBlockerCode =
  | "INVALID_PATH"
  | "UNSUPPORTED_CATEGORY"
  | "MISSING_RECORD"
  | "CORRUPT_RECORD"
  | "IO_ERROR"
  | "INCOMPLETE_CANDIDATE";

export interface LegacyAdapterBlocker extends PortError {
  readonly code: LegacyAdapterBlockerCode;
  readonly category?: LegacyAuthorStateCategory;
}

export interface LegacyRecordRef {
  readonly category: LegacyAuthorStateCategory | string;
  /** Legacy-owned path relative to injected legacyRoot. Adapter invents no mapping. */
  readonly relativePath: string;
}

export interface LegacyRecord<T> {
  readonly category: LegacyAuthorStateCategory;
  readonly relativePath: string;
  readonly bytes: Uint8Array;
  readonly parsed: T;
}

export interface LegacyComparison<TLegacy, TShadow> {
  readonly authority: "LEGACY";
  readonly legacy: TLegacy;
  readonly shadow: TShadow;
  readonly matches: boolean;
  readonly mismatch?: Readonly<{ legacy: unknown; shadow: unknown }>;
}

export interface LegacyAuthorStateAdapterOptions {
  readonly legacyRoot: string;
  readonly shadowRoot: string;
  /** Required opt-in: this adapter is forbidden for ambient/canonical roots. */
  readonly disposable: true;
}

export interface LegacyAuthorShadowProjectionPlan {
  readonly definition: RunDefinition;
  readonly observedAt: string;
  readonly attempt?: Readonly<{
    admission: AttemptAdmission;
    terminal?: Readonly<{
      outcome: AttemptOutcome;
      finishedAt: string;
      detail?: string;
    }>;
  }>;
  readonly cancel?: Readonly<{ reason: string; requestedAt: string }>;
  readonly checkpoint?: StageCheckpoint;
  readonly candidate?: Readonly<{
    bookId: string;
    candidateId: string;
    parentCandidateId?: string;
    createdByRunId: string;
    expectedInventory: readonly PlannedArtifact[];
    files: readonly CandidateInputFile[];
    createdAt: string;
  }>;
  /** Caller-owned semantic projection. Adapter never invents a legacy mapping. */
  readonly compare?: Readonly<{
    legacy: unknown;
    shadow: (report: LegacyAuthorShadowProjectionReport) => unknown;
  }>;
}

export interface LegacyAuthorShadowStep {
  readonly name: string;
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
}

export interface LegacyAuthorShadowProjectionReport {
  readonly authority: "LEGACY";
  readonly ok: boolean;
  readonly steps: readonly LegacyAuthorShadowStep[];
  readonly run?: RunSnapshot;
  readonly candidate?: CandidateManifest;
  readonly matches?: boolean;
  readonly mismatch?: Readonly<{ legacy: unknown; shadow: unknown }>;
}

function blocked<T>(code: LegacyAdapterBlockerCode, message: string, category?: LegacyAuthorStateCategory): Result<T, LegacyAdapterBlocker> {
  return { ok: false, error: { code, message, ...(category ? { category } : {}) } };
}

function categoryOf(value: string): LegacyAuthorStateCategory | null {
  return (LEGACY_AUTHOR_STATE_CATEGORIES as readonly string[]).includes(value)
    ? value as LegacyAuthorStateCategory
    : null;
}

function requireExplicitRoot(root: string, label: string): string {
  if (!root || !isAbsolute(root)) throw new TypeError(`${label} must be an absolute injected root`);
  return resolve(root);
}

function pathWithin(root: string, requested: string): string | null {
  if (!requested || isAbsolute(requested) || requested.includes("\0")) return null;
  const destination = resolve(root, requested);
  const rel = relative(root, destination);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null;
  return destination;
}

function sameInventory(expected: readonly PlannedArtifact[], files: readonly CandidateInputFile[]): boolean {
  if (expected.length !== files.length) return false;
  const expectedByPath = new Map(expected.map((entry) => [entry.logicalPath, entry]));
  if (expectedByPath.size !== expected.length) return false;
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.logicalPath)) return false;
    seen.add(file.logicalPath);
    const planned = expectedByPath.get(file.logicalPath);
    if (!planned || planned.kind !== file.kind || planned.mediaType !== file.mediaType) return false;
  }
  return true;
}

/**
 * Temporary author-state bridge. Legacy callbacks and bytes stay authoritative;
 * V4 ports receive shadow lifecycle/candidate operations in injected disposable roots.
 */
export class LegacyAuthorStateAdapter {
  readonly legacyRoot: string;
  readonly shadowRoot: string;
  readonly #runStore: RunStore;
  readonly #stageCoordinator: StageCoordinator;
  readonly #candidateStore: CandidateStore;
  readonly #contentReader: BookContentReader;

  constructor(options: LegacyAuthorStateAdapterOptions) {
    if (options.disposable !== true) throw new TypeError("legacy author-state adapter requires disposable: true");
    this.legacyRoot = requireExplicitRoot(options.legacyRoot, "legacyRoot");
    this.shadowRoot = requireExplicitRoot(options.shadowRoot, "shadowRoot");
    if (this.legacyRoot === this.shadowRoot) throw new TypeError("legacyRoot and shadowRoot must be distinct");
    const runStateRoot = join(this.shadowRoot, "run-state");
    const booksRoot = join(this.shadowRoot, "books");
    mkdirSync(booksRoot, { recursive: true });
    this.#runStore = new FileRunStore(runStateRoot);
    this.#stageCoordinator = new FileStageCoordinator(runStateRoot);
    const writeLock = createBookWriteLock({ booksRoot, timeoutMs: 1_000, pollMs: 1 });
    const currentPointerStore = createCurrentPointerStore({ booksRoot, writeLock });
    this.#candidateStore = createCandidateStore({ booksRoot, writeLock, currentPointerStore });
    this.#contentReader = createBookContentReader({ booksRoot, currentPointerStore });
  }

  /** Pure read: never creates, repairs, quarantines, touches, or rewrites. */
  readLegacy<T>(ref: LegacyRecordRef, parse: (bytes: Uint8Array) => T): Result<LegacyRecord<T>, LegacyAdapterBlocker> {
    const category = categoryOf(ref.category);
    if (!category) return blocked("UNSUPPORTED_CATEGORY", `unsupported legacy author-state category: ${ref.category}`);
    const path = pathWithin(this.legacyRoot, ref.relativePath);
    if (!path) return blocked("INVALID_PATH", `legacy record path is not a safe relative path: ${ref.relativePath}`, category);
    if (!existsSync(path)) return blocked("MISSING_RECORD", `legacy record is missing: ${ref.relativePath}`, category);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(path));
    } catch (error) {
      return blocked("IO_ERROR", `legacy record is unreadable: ${(error as Error).message}`, category);
    }
    try {
      return { ok: true, value: { category, relativePath: ref.relativePath, bytes, parsed: parse(bytes) } };
    } catch (error) {
      return blocked("CORRUPT_RECORD", `legacy record parser rejected ${ref.relativePath}: ${(error as Error).message}`, category);
    }
  }

  /** Fixture-only byte writer. Validation finishes before first filesystem mutation. */
  writeLegacyBytes(ref: LegacyRecordRef, bytes: Uint8Array): Result<void, LegacyAdapterBlocker> {
    const category = categoryOf(ref.category);
    if (!category) return blocked("UNSUPPORTED_CATEGORY", `unsupported legacy author-state category: ${ref.category}`);
    const path = pathWithin(this.legacyRoot, ref.relativePath);
    if (!path) return blocked("INVALID_PATH", `legacy record path is not a safe relative path: ${ref.relativePath}`, category);
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
      return { ok: true, value: undefined };
    } catch (error) {
      return blocked("IO_ERROR", `legacy record write failed: ${(error as Error).message}`, category);
    }
  }

  /** Runs legacy first. Comparison never changes returned authority. */
  async compareLegacyFirst<TLegacy, TShadow>(input: Readonly<{
    legacy: () => TLegacy | Promise<TLegacy>;
    shadow: () => TShadow | Promise<TShadow>;
    normalizeLegacy: (value: TLegacy) => unknown;
    normalizeShadow: (value: TShadow) => unknown;
  }>): Promise<LegacyComparison<TLegacy, TShadow>> {
    const legacy = await input.legacy();
    const shadow = await input.shadow();
    const normalizedLegacy = input.normalizeLegacy(legacy);
    const normalizedShadow = input.normalizeShadow(shadow);
    const matches = JSON.stringify(normalizedLegacy) === JSON.stringify(normalizedShadow);
    return {
      authority: "LEGACY",
      legacy,
      shadow,
      matches,
      ...(matches ? {} : { mismatch: { legacy: normalizedLegacy, shadow: normalizedShadow } }),
    };
  }

  createShadowRun(definition: RunDefinition): Promise<Result<RunSnapshot>> {
    return this.#runStore.createRun(definition);
  }

  /** One call delegates exactly once; RunStore owns durable replay/conflict rules. */
  startShadowAttempt(admission: AttemptAdmission): Promise<Result<AttemptSnapshot>> {
    return this.#runStore.admitAttempt(admission);
  }

  /** One call delegates exactly once; RunStore owns terminal idempotency. */
  finishShadowAttempt(input: Readonly<{
    bookId: string;
    runId: string;
    attemptId: string;
    outcome: AttemptOutcome;
    finishedAt: string;
    detail?: string;
  }>): Promise<Result<AttemptSnapshot>> {
    return this.#runStore.finishAttempt(input);
  }

  /** Observation only. STALE remains consumed; adapter starts no process/replay. */
  readShadowRun(bookId: string, runId: string, observedAt: string): Promise<Result<RunSnapshot>> {
    return this.#runStore.readRun(bookId, runId, observedAt);
  }

  planShadowResume(definition: RunDefinition): Promise<Result<ResumePlan>> {
    return this.#stageCoordinator.planResume(definition);
  }

  checkpointShadowStage(checkpoint: StageCheckpoint): Promise<Result<void>> {
    return this.#stageCoordinator.checkpoint(checkpoint);
  }

  requestShadowCancel(input: Readonly<{ bookId: string; runId: string; reason: string; requestedAt: string }>): Promise<Result<void>> {
    return this.#runStore.requestCancel(input);
  }

  /** Partial inventory never reaches CandidateStore and cannot become visible. */
  async stageCompleteCandidate(input: Readonly<{
    bookId: string;
    candidateId: string;
    parentCandidateId?: string;
    createdByRunId: string;
    expectedInventory: readonly PlannedArtifact[];
    files: readonly CandidateInputFile[];
    createdAt: string;
  }>): Promise<Result<CandidateManifest>> {
    if (!sameInventory(input.expectedInventory, input.files)) {
      return blocked("INCOMPLETE_CANDIDATE", "candidate files do not exactly match complete expected inventory");
    }
    return this.#candidateStore.stage(input);
  }

  /**
   * Project one already-completed legacy author operation. Every shadow error is
   * data in the report; none throws back into or replaces the legacy result.
   */
  async projectLegacyAuthorOperation(plan: LegacyAuthorShadowProjectionPlan): Promise<LegacyAuthorShadowProjectionReport> {
    const steps: LegacyAuthorShadowStep[] = [];
    let run: RunSnapshot | undefined;
    let candidate: CandidateManifest | undefined;
    const record = <T>(name: string, result: Result<T>): T | undefined => {
      if (result.ok) {
        steps.push({ name, ok: true });
        return result.value;
      }
      steps.push({ name, ok: false, code: result.error.code, message: result.error.message });
      return undefined;
    };
    const safe = async <T>(name: string, operation: () => Promise<Result<T>>): Promise<T | undefined> => {
      try {
        return record(name, await operation());
      } catch (error) {
        steps.push({ name, ok: false, code: "SHADOW_EXCEPTION", message: (error as Error).message });
        return undefined;
      }
    };

    const created = await safe("run.create", () => this.createShadowRun(plan.definition));
    if (created) run = created;
    await safe("stage.resume.before", () => this.planShadowResume(plan.definition));

    if (plan.cancel) {
      await safe("run.cancel", () => this.requestShadowCancel({
        bookId: plan.definition.bookId,
        runId: plan.definition.runId,
        reason: plan.cancel!.reason,
        requestedAt: plan.cancel!.requestedAt,
      }));
      await safe("stage.resume.cancelled", () => this.planShadowResume(plan.definition));
    } else if (plan.attempt) {
      await safe("attempt.admit", () => this.startShadowAttempt(plan.attempt!.admission));
      const observed = await safe("run.observe", () => this.readShadowRun(
        plan.definition.bookId,
        plan.definition.runId,
        plan.observedAt,
      ));
      if (observed) run = observed;
      if (plan.attempt.terminal) {
        const terminal = plan.attempt.terminal;
        await safe("attempt.finish", () => this.finishShadowAttempt({
          bookId: plan.definition.bookId,
          runId: plan.definition.runId,
          attemptId: plan.attempt!.admission.attemptId,
          outcome: terminal.outcome,
          finishedAt: terminal.finishedAt,
          ...(terminal.detail === undefined ? {} : { detail: terminal.detail }),
        }));
      }
    }

    if (plan.checkpoint) await safe("stage.checkpoint", () => this.checkpointShadowStage(plan.checkpoint!));
    if (plan.candidate) {
      const staged = await safe("candidate.stage", () => this.stageCompleteCandidate(plan.candidate!));
      if (staged) candidate = staged;
    }
    const finalRun = await safe("run.read.final", () => this.readShadowRun(
      plan.definition.bookId,
      plan.definition.runId,
      plan.observedAt,
    ));
    if (finalRun) run = finalRun;

    let matches: boolean | undefined;
    let mismatch: Readonly<{ legacy: unknown; shadow: unknown }> | undefined;
    if (plan.compare) {
      try {
        const partial: LegacyAuthorShadowProjectionReport = {
          authority: "LEGACY",
          ok: steps.every((step) => step.ok),
          steps,
          ...(run ? { run } : {}),
          ...(candidate ? { candidate } : {}),
        };
        const shadow = plan.compare.shadow(partial);
        matches = JSON.stringify(plan.compare.legacy) === JSON.stringify(shadow);
        if (!matches) mismatch = { legacy: plan.compare.legacy, shadow };
      } catch (error) {
        steps.push({ name: "compare", ok: false, code: "SHADOW_EXCEPTION", message: (error as Error).message });
      }
    }
    return {
      authority: "LEGACY",
      ok: steps.every((step) => step.ok) && matches !== false,
      steps,
      ...(run ? { run } : {}),
      ...(candidate ? { candidate } : {}),
      ...(matches === undefined ? {} : { matches }),
      ...(mismatch ? { mismatch } : {}),
    };
  }

  /** Pure authority-separated read through BookContentReader. */
  openShadowCandidate(input: Parameters<BookContentReader["open"]>[0]): ReturnType<BookContentReader["open"]> {
    return this.#contentReader.open(input);
  }
}
