import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";

import type { Result } from "../contracts/v4Core.js";
import {
  loadRunState,
  withRunStateLock,
  writeCanonicalJson,
  type RunStatePaths,
} from "./fileRunStore.js";
import { normalizeRunDefinition, sameValue } from "./runProjection.js";
import { RunStateFault, runStoreFailure } from "./runStore.js";
import type { RunDefinition } from "./runTypes.js";
import { normalizeStageCheckpoint, projectResume } from "./stageProjection.js";
import type { ResumePlan, StageCheckpoint, StageCoordinator } from "./stageTypes.js";

function parseCheckpoint(path: string): StageCheckpoint {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new RunStateFault("STATE_CORRUPT", `stage checkpoint is unreadable: ${(error as Error).message}`);
  }
  try {
    return normalizeStageCheckpoint(JSON.parse(raw) as unknown, "STATE_CORRUPT");
  } catch (error) {
    if (error instanceof RunStateFault) throw error;
    throw new RunStateFault("STATE_CORRUPT", `stage checkpoint is not valid JSON: ${(error as Error).message}`);
  }
}

function loadCheckpoints(paths: RunStatePaths, definition: RunDefinition): Map<string, StageCheckpoint> {
  const checkpoints = new Map<string, StageCheckpoint>();
  if (!existsSync(paths.stagesDir)) return checkpoints;
  let entries: string[];
  try {
    entries = readdirSync(paths.stagesDir).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  } catch (error) {
    throw new RunStateFault("STATE_CORRUPT", `stage checkpoint directory is unreadable: ${(error as Error).message}`);
  }
  for (const entry of entries) {
    if (!entry.endsWith(".json") || basename(entry) !== entry) throw new RunStateFault("STATE_CORRUPT", `unexpected stage checkpoint entry: ${entry}`);
    const stageId = entry.slice(0, -5);
    const checkpoint = parseCheckpoint(join(paths.stagesDir, entry));
    if (checkpoint.bookId !== definition.bookId || checkpoint.runId !== definition.runId || checkpoint.stageId !== stageId) {
      throw new RunStateFault("STATE_CORRUPT", `stage checkpoint identity does not match path: ${entry}`);
    }
    if (!definition.requiredStages.includes(stageId)) throw new RunStateFault("STATE_CORRUPT", `checkpoint stage is not required by run: ${stageId}`);
    checkpoints.set(stageId, checkpoint);
  }
  return checkpoints;
}

function normalizeRoot(stateRoot: string): string {
  if (typeof stateRoot !== "string" || stateRoot.length === 0 || !isAbsolute(stateRoot)) {
    throw new TypeError("FileStageCoordinator requires an absolute injected stateRoot");
  }
  return resolve(stateRoot);
}

export class FileStageCoordinator implements StageCoordinator {
  readonly stateRoot: string;

  constructor(stateRoot: string) {
    this.stateRoot = normalizeRoot(stateRoot);
  }

  async checkpoint(checkpointInput: StageCheckpoint): Promise<Result<void>> {
    try {
      const checkpoint = normalizeStageCheckpoint(checkpointInput);
      await withRunStateLock(this.stateRoot, checkpoint.bookId, checkpoint.runId, false, (paths) => {
        const state = loadRunState(paths, checkpoint.bookId, checkpoint.runId);
        const definition = state.record.definition;
        const checkpoints = loadCheckpoints(paths, definition);
        const prior = checkpoints.get(checkpoint.stageId);
        if (prior !== undefined) {
          if (!sameValue(prior, checkpoint)) throw new RunStateFault("CONFLICT", `stage ${checkpoint.stageId} already has a different checkpoint`);
          return;
        }
        if (state.record.status === "CANCEL_REQUESTED") throw new RunStateFault("CANCELLED", `run ${checkpoint.runId} has a durable cancellation request`);
        if (state.record.status !== "RUNNING") throw new RunStateFault("TERMINAL", `run ${checkpoint.runId} is terminal: ${state.record.status}`);
        if (!definition.requiredStages.includes(checkpoint.stageId)) {
          throw new RunStateFault("INVALID_INPUT", `checkpoint stage is not required by run: ${checkpoint.stageId}`);
        }
        if (Date.parse(checkpoint.completedAt) < Date.parse(definition.createdAt)) {
          throw new RunStateFault("INVALID_INPUT", "stage checkpoint precedes run creation");
        }
        writeCanonicalJson(join(paths.stagesDir, `${checkpoint.stageId}.json`), checkpoint);
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return runStoreFailure(error);
    }
  }

  async planResume(definitionInput: RunDefinition): Promise<Result<ResumePlan>> {
    try {
      const definition = normalizeRunDefinition(definitionInput);
      const value = await withRunStateLock(this.stateRoot, definition.bookId, definition.runId, false, (paths) => {
        const state = loadRunState(paths, definition.bookId, definition.runId);
        if (!sameValue(state.record.definition, definition)) {
          throw new RunStateFault("CONFLICT", `run ${definition.runId} definition differs from persisted identity`);
        }
        const checkpoints = loadCheckpoints(paths, definition);
        if (state.record.status === "CANCEL_REQUESTED") return projectResume(definition, checkpoints, true);
        if (state.record.status !== "RUNNING") throw new RunStateFault("TERMINAL", `run ${definition.runId} is terminal: ${state.record.status}`);
        return projectResume(definition, checkpoints, false);
      });
      return { ok: true, value };
    } catch (error) {
      return runStoreFailure(error);
    }
  }
}

export function createFileStageCoordinator(stateRoot: string): FileStageCoordinator {
  return new FileStageCoordinator(stateRoot);
}
