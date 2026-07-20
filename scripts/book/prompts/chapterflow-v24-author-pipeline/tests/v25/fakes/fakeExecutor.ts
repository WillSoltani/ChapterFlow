import type { CandidateInputFile } from "../../../src/books/candidateTypes.js";
import type { ChapterFlowClock, CandidateGatewayOutputV1 } from "../../../src/app/pipeline.js";
import type { ModelGateway } from "../../../src/runtime/modelGateway.js";
import type { ModelTask } from "../../../src/runtime/modelRequest.js";
import type { ModelResult } from "../../../src/runtime/modelResult.js";
import type { RunStore } from "../../../src/run-state/runStore.js";

export interface NoLiveCounters {
  providerCalls: number;
  apiCalls: number;
  networkCalls: number;
  productionRootMutations: number;
}

export interface FakeExecutorCounters extends NoLiveCounters {
  gatewayCalls: number;
  durableAdmissions: number;
  processObservations: number;
  terminalAttempts: number;
}

export interface FakeExecutorPlan {
  readonly outcome?: ModelResult["outcome"];
  readonly output?: unknown;
  readonly leaveUnsettledAfterAdmission?: boolean;
}

function cloneTask(task: ModelTask): ModelTask {
  return {
    bookId: task.bookId,
    runId: task.runId,
    attemptId: task.attemptId,
    stageId: task.stageId,
    operationId: task.operationId,
    profileId: task.profileId,
    workDir: task.workDir,
    prompt: {
      templateId: task.prompt.templateId,
      inputs: task.prompt.inputs.map((input) => ({
        name: input.name,
        mediaType: input.mediaType,
        bytes: Buffer.from(input.bytes),
      })),
    },
    signal: task.signal,
  };
}

export function candidateGatewayOutput(files: readonly CandidateInputFile[]): CandidateGatewayOutputV1 {
  const snapshot = files.map((file) => Object.freeze({
    kind: file.kind,
    logicalPath: file.logicalPath,
    mediaType: file.mediaType,
    bytes: Object.freeze({
      encoding: "base64" as const,
      data: Buffer.from(new Uint8Array(file.bytes)).toString("base64"),
    }),
  }));
  return Object.freeze({
    schemaVersion: "1",
    files: Object.freeze(snapshot),
  });
}

export class FakeExecutor implements ModelGateway {
  readonly counters: FakeExecutorCounters = {
    gatewayCalls: 0,
    durableAdmissions: 0,
    processObservations: 0,
    terminalAttempts: 0,
    providerCalls: 0,
    apiCalls: 0,
    networkCalls: 0,
    productionRootMutations: 0,
  };
  readonly tasks: ModelTask[] = [];
  readonly #runStore: RunStore;
  readonly #clock: ChapterFlowClock;
  #plan: FakeExecutorPlan;

  constructor(runStore: RunStore, clock: ChapterFlowClock, plan: FakeExecutorPlan = {}) {
    this.#runStore = runStore;
    this.#clock = clock;
    this.#plan = plan;
  }

  setPlan(plan: FakeExecutorPlan): void {
    this.#plan = plan;
  }

  async execute(task: ModelTask): Promise<ModelResult> {
    this.counters.gatewayCalls += 1;
    this.tasks.push(cloneTask(task));
    if (task.signal.aborted) {
      return { attemptId: task.attemptId, outcome: "CANCELLED" };
    }

    const admittedAt = this.#clock.now();
    const staleAt = new Date(Date.parse(admittedAt) + 60_000).toISOString();
    let admitted;
    try {
      admitted = await this.#runStore.admitAttempt({
        bookId: task.bookId,
        runId: task.runId,
        attemptId: task.attemptId,
        stageId: task.stageId,
        operationId: task.operationId,
        admittedAt,
        staleAt,
      });
    } catch {
      return { attemptId: task.attemptId, outcome: "UNKNOWN" };
    }
    if (!admitted.ok) {
      return {
        attemptId: task.attemptId,
        outcome: admitted.error.code === "CANCELLED" ? "CANCELLED" : "FAILED",
        error: { code: "FAKE_ADMISSION_DENIED", message: admitted.error.code },
      };
    }
    this.counters.durableAdmissions += 1;
    if (this.#plan.leaveUnsettledAfterAdmission === true) {
      return {
        attemptId: task.attemptId,
        outcome: "UNKNOWN",
        error: { code: "FAKE_UNSETTLED", message: "injected uncertainty after durable admission" },
      };
    }

    this.counters.processObservations += 1;
    const outcome = task.signal.aborted ? "CANCELLED" : (this.#plan.outcome ?? "SUCCEEDED");
    const finishedAt = this.#clock.now();
    let finished;
    try {
      finished = await this.#runStore.finishAttempt({
        bookId: task.bookId,
        runId: task.runId,
        attemptId: task.attemptId,
        outcome,
        finishedAt,
        detail: `fake-executor=${outcome}`,
      });
    } catch {
      return { attemptId: task.attemptId, outcome: "UNKNOWN" };
    }
    if (!finished.ok) return { attemptId: task.attemptId, outcome: "UNKNOWN" };
    this.counters.terminalAttempts += 1;
    return {
      attemptId: task.attemptId,
      outcome,
      ...(outcome === "SUCCEEDED" ? { output: this.#plan.output } : {}),
    };
  }
}

export function zeroLiveCounters(counters: NoLiveCounters): boolean {
  return counters.providerCalls === 0 &&
    counters.apiCalls === 0 &&
    counters.networkCalls === 0 &&
    counters.productionRootMutations === 0;
}
