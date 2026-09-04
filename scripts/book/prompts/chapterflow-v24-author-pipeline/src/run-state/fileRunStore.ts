import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import type { BookId, Result, RunId, UtcIso } from "../contracts/v4Core.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { canonicalJson } from "../lib/canonicalJson.js";
import {
  assertLifecycleConsistent,
  attemptSnapshot,
  foldAttemptEvents,
  normalizeAttemptAdmission,
  normalizeAttemptEvent,
  normalizePersistedRun,
  normalizeRunDefinition,
  normalizeSafeId,
  normalizeUtc,
  projectRun,
  sameValue,
} from "./runProjection.js";
import { RunStateFault, runStoreFailure, type RunStore } from "./runStore.js";
import type {
  AttemptAdmission,
  AttemptEventV1,
  AttemptFinishedEventV1,
  AttemptHistory,
  AttemptOutcome,
  AttemptSnapshot,
  PersistedRunV1,
  RunDefinition,
  RunSnapshot,
} from "./runTypes.js";

const OUTCOMES: readonly AttemptOutcome[] = ["SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED", "UNKNOWN", "ABANDONED"];
const LOCK_WAIT_MS = 5_000;
const LOCK_INITIALIZATION_GRACE_MS = 30_000;
const LOCK_OWNER_FILE = "owner.json";
const LOCK_REAPER_DIR = ".reap";
const LOCAL_HOSTNAME = hostname();
const LOCAL_TAILS = new Map<string, Promise<void>>();

interface LockOwnerV1 {
  readonly schemaVersion: "1";
  readonly token: string;
  readonly pid: number;
  readonly hostname: string;
  readonly createdAt: string;
}

export interface RunStatePaths {
  readonly runDir: string;
  readonly runFile: string;
  readonly attemptsFile: string;
  readonly stagesDir: string;
  readonly lockDir: string;
}

export interface LoadedRunState {
  readonly record: PersistedRunV1;
  readonly rawJournal: string;
  readonly events: readonly AttemptEventV1[];
  readonly histories: readonly AttemptHistory[];
}

export function runStatePaths(stateRoot: string, bookId: string, runId: string): RunStatePaths {
  const runDir = join(stateRoot, "books", bookId, "runs", runId);
  return {
    runDir,
    runFile: join(runDir, "run.json"),
    attemptsFile: join(runDir, "attempts.jsonl"),
    stagesDir: join(runDir, "stages"),
    lockDir: join(runDir, ".writer.lock"),
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((done) => setTimeout(done, milliseconds));
}

async function withLocalQueue<T>(key: string, task: () => Promise<T> | T): Promise<T> {
  const previous = LOCAL_TAILS.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((done) => { release = done; });
  const tail = previous.then(() => gate);
  LOCAL_TAILS.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (LOCAL_TAILS.get(key) === tail) LOCAL_TAILS.delete(key);
  }
}

function lockOwnerPath(paths: RunStatePaths): string {
  return join(paths.lockDir, LOCK_OWNER_FILE);
}

function readLockOwner(paths: RunStatePaths): LockOwnerV1 | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(lockOwnerPath(paths), "utf8")) as unknown;
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const owner = value as Record<string, unknown>;
  if (
    owner.schemaVersion !== "1"
    || typeof owner.token !== "string"
    || owner.token.length === 0
    || !Number.isSafeInteger(owner.pid)
    || (owner.pid as number) <= 0
    || typeof owner.hostname !== "string"
    || owner.hostname.length === 0
    || typeof owner.createdAt !== "string"
  ) return null;
  return {
    schemaVersion: "1",
    token: owner.token,
    pid: owner.pid as number,
    hostname: owner.hostname,
    createdAt: owner.createdAt,
  };
}

function ownerIsAlive(owner: LockOwnerV1): boolean {
  // Local-file lock only. Never reap a lock written by another host.
  if (owner.hostname !== LOCAL_HOSTNAME) return true;
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function tryRecoverAbandonedLock(paths: RunStatePaths): boolean {
  const observedOwner = readLockOwner(paths);
  let observedAge: number;
  try {
    observedAge = Date.now() - statSync(paths.lockDir).mtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
  if (observedOwner !== null && ownerIsAlive(observedOwner)) return false;
  if (observedOwner === null && observedAge < LOCK_INITIALIZATION_GRACE_MS) return false;

  // One reaper wins inside still-existing lock. Other contenders must loop;
  // they cannot remove a replacement lock after winner completes recovery.
  try {
    mkdirSync(join(paths.lockDir, LOCK_REAPER_DIR));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOENT") return false;
    throw error;
  }

  const currentOwner = readLockOwner(paths);
  const mayRecover = observedOwner === null
    ? currentOwner === null
    : currentOwner?.token === observedOwner.token && !ownerIsAlive(currentOwner);
  if (!mayRecover) {
    try { rmSync(join(paths.lockDir, LOCK_REAPER_DIR), { recursive: true, force: true }); } catch { /* fail closed on next loop */ }
    return false;
  }
  rmSync(paths.lockDir, { recursive: true, force: true });
  return true;
}

function releaseFileLock(paths: RunStatePaths, token: string): void {
  const owner = readLockOwner(paths);
  if (owner?.token !== token) {
    throw new RunStateFault("STATE_CORRUPT", `run writer lock ownership changed before release: ${paths.runDir}`);
  }
  rmSync(paths.lockDir, { recursive: true, force: true });
}

async function acquireFileLock(paths: RunStatePaths, createRunDir: boolean): Promise<() => void> {
  if (!existsSync(paths.runDir)) {
    if (!createRunDir) throw new RunStateFault("NOT_FOUND", `run does not exist: ${paths.runDir}`);
    mkdirSync(paths.runDir, { recursive: true });
  }
  const startedAt = Date.now();
  while (true) {
    const token = randomUUID();
    try {
      mkdirSync(paths.lockDir);
      const owner: LockOwnerV1 = {
        schemaVersion: "1",
        token,
        pid: process.pid,
        hostname: LOCAL_HOSTNAME,
        createdAt: new Date().toISOString(),
      };
      try {
        writeFileSync(lockOwnerPath(paths), `${canonicalJson(owner)}\n`, { encoding: "utf8", flag: "wx" });
      } catch (error) {
        rmSync(paths.lockDir, { recursive: true, force: true });
        throw error;
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        releaseFileLock(paths, token);
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      if (tryRecoverAbandonedLock(paths)) continue;
      if (Date.now() - startedAt >= LOCK_WAIT_MS) {
        throw new RunStateFault("LOCK_TIMEOUT", `timed out waiting for run writer lock: ${paths.runDir}`, true);
      }
      await sleep(5);
    }
  }
}

export async function withRunStateLock<T>(
  stateRoot: string,
  bookId: string,
  runId: string,
  createRunDir: boolean,
  task: (paths: RunStatePaths) => Promise<T> | T,
): Promise<T> {
  const paths = runStatePaths(stateRoot, bookId, runId);
  return withLocalQueue(paths.runDir, async () => {
    const release = await acquireFileLock(paths, createRunDir);
    try {
      return await task(paths);
    } finally {
      release();
    }
  });
}

function parseJson(raw: string, where: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new RunStateFault("STATE_CORRUPT", `${where} is not valid JSON: ${(error as Error).message}`);
  }
}

function readRequiredFile(path: string, where: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new RunStateFault("NOT_FOUND", `${where} does not exist: ${path}`);
    throw new RunStateFault("STATE_CORRUPT", `${where} is unreadable: ${(error as Error).message}`);
  }
}

function readAttemptJournal(path: string): { readonly raw: string; readonly events: readonly AttemptEventV1[] } {
  if (!existsSync(path)) throw new RunStateFault("STATE_CORRUPT", `attempt journal is missing: ${path}`);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new RunStateFault("STATE_CORRUPT", `attempt journal is unreadable: ${(error as Error).message}`);
  }
  if (raw.length > 0 && !raw.endsWith("\n")) throw new RunStateFault("STATE_CORRUPT", "attempt journal has a torn final record");
  const lines = raw.length === 0 ? [] : raw.slice(0, -1).split("\n");
  if (lines.some((line) => line.length === 0)) throw new RunStateFault("STATE_CORRUPT", "attempt journal contains an empty record");
  return {
    raw,
    events: lines.map((line, index) => normalizeAttemptEvent(parseJson(line, `attempt journal line ${index + 1}`))),
  };
}

export function loadRunState(paths: RunStatePaths, expectedBookId: string, expectedRunId: string): LoadedRunState {
  const record = normalizePersistedRun(parseJson(readRequiredFile(paths.runFile, "run record"), "run record"), expectedBookId, expectedRunId);
  const journal = readAttemptJournal(paths.attemptsFile);
  const histories = foldAttemptEvents(record.definition, journal.events);
  assertLifecycleConsistent(record, histories);
  return { record, rawJournal: journal.raw, events: journal.events, histories };
}

export function writeCanonicalJson(path: string, value: unknown): void {
  writeFileAtomic(path, `${canonicalJson(value)}\n`);
}

export function appendAttemptEvent(paths: RunStatePaths, rawJournal: string, event: AttemptEventV1): void {
  writeFileAtomic(paths.attemptsFile, `${rawJournal}${canonicalJson(event)}\n`);
}

function normalizeRoot(stateRoot: string): string {
  if (typeof stateRoot !== "string" || stateRoot.length === 0 || !isAbsolute(stateRoot)) {
    throw new TypeError("FileRunStore requires an absolute injected stateRoot");
  }
  return resolve(stateRoot);
}

function sameIdentity(left: RunDefinition, right: RunDefinition): boolean {
  return sameValue(left, right);
}

function validateFinishInput(input: Readonly<{
  bookId: string;
  runId: string;
  attemptId: string;
  outcome: AttemptOutcome;
  finishedAt: string;
  detail?: string;
}>): AttemptFinishedEventV1 {
  if (!OUTCOMES.includes(input.outcome)) throw new RunStateFault("INVALID_INPUT", "attempt outcome is invalid");
  if (input.detail !== undefined && (typeof input.detail !== "string" || input.detail.length > 8192 || input.detail.includes("\0"))) {
    throw new RunStateFault("INVALID_INPUT", "attempt detail is invalid");
  }
  return {
    schemaVersion: "1",
    type: "ATTEMPT_FINISHED",
    bookId: normalizeSafeId(input.bookId, "finishAttempt.bookId"),
    runId: normalizeSafeId(input.runId, "finishAttempt.runId"),
    attemptId: normalizeSafeId(input.attemptId, "finishAttempt.attemptId"),
    outcome: input.outcome,
    finishedAt: normalizeUtc(input.finishedAt, "finishAttempt.finishedAt"),
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
  };
}

export class FileRunStore implements RunStore {
  readonly stateRoot: string;

  constructor(stateRoot: string) {
    this.stateRoot = normalizeRoot(stateRoot);
  }

  /** The absolute directory this store keeps one run's state in. Exposed so a
   *  stage can write DIAGNOSTICS beside the run it is executing (the compiler's
   *  rejected section packs) without being handed a second copy of the state root
   *  that could drift from the store's own. The store reads this directory by
   *  exact filename only (`run.json`, `attempts.jsonl`, `stages/`), so nothing
   *  written alongside can be mistaken for run state. */
  runDirectory(bookIdInput: BookId, runIdInput: RunId): string {
    return runStatePaths(
      this.stateRoot,
      normalizeSafeId(bookIdInput, "runDirectory.bookId"),
      normalizeSafeId(runIdInput, "runDirectory.runId"),
    ).runDir;
  }

  async createRun(definitionInput: RunDefinition): Promise<Result<RunSnapshot>> {
    try {
      const definition = normalizeRunDefinition(definitionInput);
      const value = await withRunStateLock(this.stateRoot, definition.bookId, definition.runId, true, (paths) => {
        if (existsSync(paths.runFile)) {
          const existing = loadRunState(paths, definition.bookId, definition.runId);
          if (!sameIdentity(existing.record.definition, definition)) {
            throw new RunStateFault("CONFLICT", `run ${definition.runId} already exists with a different definition`);
          }
          return projectRun(existing.record, existing.histories, definition.createdAt);
        }
        const unexpected = readdirSync(paths.runDir).filter((entry) => entry !== ".writer.lock");
        if (unexpected.length > 0) throw new RunStateFault("STATE_CORRUPT", `run directory lacks run.json but contains: ${unexpected.sort().join(", ")}`);
        const record: PersistedRunV1 = { schemaVersion: "1", definition, status: "RUNNING" };
        writeFileAtomic(paths.attemptsFile, "");
        writeCanonicalJson(paths.runFile, record);
        return projectRun(record, [], definition.createdAt);
      });
      return { ok: true, value };
    } catch (error) {
      return runStoreFailure(error);
    }
  }

  async readRun(bookIdInput: BookId, runIdInput: RunId, observedAtInput: UtcIso): Promise<Result<RunSnapshot>> {
    try {
      const bookId = normalizeSafeId(bookIdInput, "readRun.bookId");
      const runId = normalizeSafeId(runIdInput, "readRun.runId");
      const observedAt = normalizeUtc(observedAtInput, "readRun.observedAt");
      const value = await withRunStateLock(this.stateRoot, bookId, runId, false, (paths) => {
        const state = loadRunState(paths, bookId, runId);
        return projectRun(state.record, state.histories, observedAt);
      });
      return { ok: true, value };
    } catch (error) {
      return runStoreFailure(error);
    }
  }

  async admitAttempt(admissionInput: AttemptAdmission): Promise<Result<AttemptSnapshot>> {
    try {
      const admission = normalizeAttemptAdmission(admissionInput);
      const value = await withRunStateLock(this.stateRoot, admission.bookId, admission.runId, false, (paths) => {
        const state = loadRunState(paths, admission.bookId, admission.runId);
        const prior = state.histories.find((history) => history.admission.attemptId === admission.attemptId);
        if (prior !== undefined) {
          if (!sameValue(prior.admission, admission)) throw new RunStateFault("CONFLICT", `attempt ${admission.attemptId} admission conflicts with persisted data`);
          return attemptSnapshot(prior, admission.admittedAt);
        }
        if (state.record.status === "CANCEL_REQUESTED") throw new RunStateFault("CANCELLED", `run ${admission.runId} has a durable cancellation request`);
        if (state.record.status !== "RUNNING") throw new RunStateFault("TERMINAL", `run ${admission.runId} is terminal: ${state.record.status}`);
        if (admission.stageId === undefined || !state.record.definition.requiredStages.includes(admission.stageId)) {
          throw new RunStateFault("INVALID_INPUT", `attempt stage is not required by run: ${admission.stageId}`);
        }
        if (Date.parse(admission.admittedAt) < Date.parse(state.record.definition.createdAt)) {
          throw new RunStateFault("INVALID_INPUT", "attempt admission precedes run creation");
        }
        const runConsumed = state.histories.length;
        const stageConsumed = state.histories.filter((history) => history.admission.stageId === admission.stageId).length;
        if (runConsumed >= state.record.definition.attemptLimits.run) {
          throw new RunStateFault("LIMIT_REACHED", `run attempt limit reached: ${state.record.definition.attemptLimits.run}`);
        }
        const stageLimit = state.record.definition.attemptLimits.byStage[admission.stageId];
        if (stageConsumed >= stageLimit) throw new RunStateFault("LIMIT_REACHED", `stage ${admission.stageId} attempt limit reached: ${stageLimit}`);
        const event: AttemptEventV1 = { schemaVersion: "1", type: "ATTEMPT_ADMITTED", admission };
        appendAttemptEvent(paths, state.rawJournal, event);
        return { admission, status: "ACTIVE" as const };
      });
      return { ok: true, value };
    } catch (error) {
      return runStoreFailure(error);
    }
  }

  async finishAttempt(input: Readonly<{
    bookId: BookId;
    runId: RunId;
    attemptId: string;
    outcome: AttemptOutcome;
    finishedAt: UtcIso;
    detail?: string;
  }>): Promise<Result<AttemptSnapshot>> {
    try {
      const event = validateFinishInput(input);
      const value = await withRunStateLock(this.stateRoot, event.bookId, event.runId, false, (paths) => {
        const state = loadRunState(paths, event.bookId, event.runId);
        const prior = state.histories.find((history) => history.admission.attemptId === event.attemptId);
        if (prior === undefined) throw new RunStateFault("NOT_FOUND", `attempt is not admitted: ${event.attemptId}`);
        if (prior.finish !== undefined) {
          if (!sameValue(prior.finish, event)) throw new RunStateFault("CONFLICT", `attempt ${event.attemptId} already has a different terminal outcome`);
          return attemptSnapshot(prior, event.finishedAt);
        }
        if (Date.parse(event.finishedAt) < Date.parse(prior.admission.admittedAt)) {
          throw new RunStateFault("INVALID_INPUT", "attempt finish precedes admission");
        }
        appendAttemptEvent(paths, state.rawJournal, event);
        return attemptSnapshot({ admission: prior.admission, finish: event }, event.finishedAt);
      });
      return { ok: true, value };
    } catch (error) {
      return runStoreFailure(error);
    }
  }

  async requestCancel(input: Readonly<{
    bookId: BookId;
    runId: RunId;
    reason: string;
    requestedAt: UtcIso;
  }>): Promise<Result<void>> {
    try {
      const bookId = normalizeSafeId(input.bookId, "requestCancel.bookId");
      const runId = normalizeSafeId(input.runId, "requestCancel.runId");
      if (typeof input.reason !== "string" || input.reason.length === 0 || input.reason.length > 4096 || input.reason.includes("\0")) {
        throw new RunStateFault("INVALID_INPUT", "cancellation reason is invalid");
      }
      const requestedAt = normalizeUtc(input.requestedAt, "requestCancel.requestedAt");
      await withRunStateLock(this.stateRoot, bookId, runId, false, (paths) => {
        const state = loadRunState(paths, bookId, runId);
        const requested = { reason: input.reason, requestedAt };
        if (state.record.cancellation !== undefined) {
          if (!sameValue(state.record.cancellation, requested)) throw new RunStateFault("CONFLICT", `run ${runId} already has a different cancellation request`);
          return;
        }
        if (state.record.status !== "RUNNING") throw new RunStateFault("TERMINAL", `run ${runId} is terminal: ${state.record.status}`);
        if (Date.parse(requestedAt) < Date.parse(state.record.definition.createdAt)) {
          throw new RunStateFault("INVALID_INPUT", "cancellation request precedes run creation");
        }
        const next: PersistedRunV1 = { ...state.record, status: "CANCEL_REQUESTED", cancellation: requested };
        writeCanonicalJson(paths.runFile, next);
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return runStoreFailure(error);
    }
  }

  async finishRun(input: Readonly<{
    bookId: BookId;
    runId: RunId;
    status: "CANCELLED" | "FAILED" | "COMPLETED";
    finishedAt: UtcIso;
    reason?: string;
  }>): Promise<Result<void>> {
    try {
      const bookId = normalizeSafeId(input.bookId, "finishRun.bookId");
      const runId = normalizeSafeId(input.runId, "finishRun.runId");
      if (input.status !== "CANCELLED" && input.status !== "FAILED" && input.status !== "COMPLETED") {
        throw new RunStateFault("INVALID_INPUT", "finishRun.status is invalid");
      }
      const finishedAt = normalizeUtc(input.finishedAt, "finishRun.finishedAt");
      if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length === 0 || input.reason.length > 4096 || input.reason.includes("\0"))) {
        throw new RunStateFault("INVALID_INPUT", "terminal reason is invalid");
      }
      if (input.status === "FAILED" && input.reason === undefined) throw new RunStateFault("INVALID_INPUT", "failed run requires a terminal reason");
      if (input.status === "COMPLETED" && input.reason !== undefined) throw new RunStateFault("INVALID_INPUT", "completed run does not accept a terminal reason");
      const terminal: NonNullable<PersistedRunV1["terminal"]> = {
        status: input.status,
        finishedAt,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      };
      await withRunStateLock(this.stateRoot, bookId, runId, false, (paths) => {
        const state = loadRunState(paths, bookId, runId);
        if (state.record.terminal !== undefined) {
          if (!sameValue(state.record.terminal, terminal)) throw new RunStateFault("CONFLICT", `run ${runId} already has a different terminal outcome`);
          return;
        }
        if (state.histories.some((history) => history.finish === undefined)) {
          throw new RunStateFault("UNSETTLED_ATTEMPTS", `run ${runId} still has admitted work to settle or reconcile`);
        }
        if (input.status === "CANCELLED" && state.record.status !== "CANCEL_REQUESTED") {
          throw new RunStateFault("CONFLICT", "run must have a durable cancellation request before CANCELLED");
        }
        if (
          input.status === "CANCELLED"
          && state.record.cancellation !== undefined
          && Date.parse(finishedAt) < Date.parse(state.record.cancellation.requestedAt)
        ) {
          throw new RunStateFault("INVALID_INPUT", "cancelled run finish precedes cancellation request");
        }
        if (input.status === "COMPLETED" && state.record.status !== "RUNNING") {
          throw new RunStateFault("CANCELLED", "cancel-requested run cannot complete");
        }
        if (input.status === "FAILED" && state.record.status !== "RUNNING" && state.record.status !== "CANCEL_REQUESTED") {
          throw new RunStateFault("TERMINAL", `run ${runId} cannot fail from ${state.record.status}`);
        }
        const latest = state.histories.reduce(
          (value, history) => Math.max(value, history.finish === undefined ? 0 : Date.parse(history.finish.finishedAt)),
          Date.parse(state.record.definition.createdAt),
        );
        if (Date.parse(finishedAt) < latest) throw new RunStateFault("INVALID_INPUT", "run finish precedes persisted lifecycle work");
        const next: PersistedRunV1 = { ...state.record, status: input.status, terminal };
        writeCanonicalJson(paths.runFile, next);
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return runStoreFailure(error);
    }
  }
}

export function createFileRunStore(stateRoot: string): FileRunStore {
  return new FileRunStore(stateRoot);
}
