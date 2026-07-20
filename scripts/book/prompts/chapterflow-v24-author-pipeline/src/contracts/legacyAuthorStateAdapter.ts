import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, isAbsolute, relative, resolve, sep } from "path";

import type { BookContentReader, CandidateInputFile, CandidateManifest, CandidateStore } from "../books/candidateTypes.js";
import type { PlannedArtifact, PortError, Result } from "./v4Core.js";
import type { RunStore } from "../run-state/runStore.js";
import type {
  AttemptAdmission,
  AttemptOutcome,
  AttemptSnapshot,
  RunDefinition,
  RunSnapshot,
} from "../run-state/runTypes.js";
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
  | "INVALID_ROOT"
  | "INVALID_PATH"
  | "UNSUPPORTED_CATEGORY"
  | "MISSING_RECORD"
  | "CORRUPT_RECORD"
  | "IO_ERROR"
  | "INCOMPLETE_CANDIDATE"
  | "PORT_BLOCKED";

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
  readonly runStore: RunStore;
  readonly stageCoordinator: StageCoordinator;
  readonly candidateStore: CandidateStore;
  readonly contentReader: BookContentReader;
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
    this.legacyRoot = requireExplicitRoot(options.legacyRoot, "legacyRoot");
    this.shadowRoot = requireExplicitRoot(options.shadowRoot, "shadowRoot");
    if (this.legacyRoot === this.shadowRoot) throw new TypeError("legacyRoot and shadowRoot must be distinct");
    this.#runStore = options.runStore;
    this.#stageCoordinator = options.stageCoordinator;
    this.#candidateStore = options.candidateStore;
    this.#contentReader = options.contentReader;
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

  /** Pure authority-separated read through BookContentReader. */
  openShadowCandidate(input: Parameters<BookContentReader["open"]>[0]): ReturnType<BookContentReader["open"]> {
    return this.#contentReader.open(input);
  }
}
