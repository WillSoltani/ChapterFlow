import type {
  BookContentReader,
  CandidateInputFile,
  CandidateSnapshot,
  CandidateStore,
} from "../books/candidateTypes.js";
import type {
  CandidateIdentity,
  ModelTaskContext,
  PlannedArtifact,
  Result,
  UtcIso,
} from "../contracts/v4Core.js";
import type { QcEvaluation, QcIssue, QcRoundResult, QcService } from "../qc/qcTypes.js";
import type { PromotionService } from "../release/promotionTypes.js";
import type { CanonicalReviewResult, ReviewService } from "../review/reviewTypes.js";
import type { ModelGateway } from "../runtime/modelGateway.js";
import type { ModelTask } from "../runtime/modelRequest.js";
import type { PromptRequest } from "../runtime/promptRequest.js";
import type { RunStore } from "../run-state/runStore.js";
import type { RunDefinition, RunSnapshot } from "../run-state/runTypes.js";
import type { StageCoordinator } from "../run-state/stageTypes.js";

export const WALKING_SKELETON_STAGES = Object.freeze([
  "model-candidate",
  "canonical-review",
  "fresh-qc",
  "promotion",
] as const);

export type WalkingSkeletonStage = typeof WALKING_SKELETON_STAGES[number];

export interface ChapterFlowClock {
  now(): UtcIso;
}

export interface ChapterFlowIdFactory {
  nextRunId(): string;
  candidateId(runId: string): string;
  modelAttemptId(runId: string): string;
  reviewAttemptId(runId: string): string;
  reviewId(runId: string): string;
  qcRoundId(runId: string): string;
}

export interface CandidateGatewayFileV1 {
  readonly kind: PlannedArtifact["kind"];
  readonly logicalPath: string;
  readonly mediaType: PlannedArtifact["mediaType"];
  readonly bytes: Readonly<{
    readonly encoding: "base64";
    readonly data: string;
  }>;
}

export interface CandidateGatewayOutputV1 {
  readonly schemaVersion: "1";
  readonly files: readonly CandidateGatewayFileV1[];
}

export interface WalkingSkeletonInput {
  readonly bookId: string;
  readonly commandId: string;
  readonly sourceGitSha: string;
  readonly resumeRunId?: string;
  readonly requiredInventory: readonly PlannedArtifact[];
  readonly inputCandidate?: CandidateIdentity;
  readonly modelAttemptLimit?: number;
  readonly profileId: string;
  readonly workDir: string;
  readonly prompt: PromptRequest;
  readonly expectedBookRevision: number;
  readonly qcEvaluation: Readonly<{
    outcome: QcEvaluation["outcome"];
    issues: readonly QcIssue[];
  }>;
  readonly signal: AbortSignal;
}

export interface WalkingSkeletonResult {
  readonly schemaVersion: "1";
  readonly runId: string;
  readonly candidate: CandidateIdentity;
  readonly review: CanonicalReviewResult;
  readonly qc: QcRoundResult;
  readonly bookRevision: number;
  readonly readback: "VERIFIED";
  readonly resumedStages: readonly WalkingSkeletonStage[];
  readonly runStatus: "COMPLETED";
}

export interface ChapterFlowPipeline {
  run(input: WalkingSkeletonInput): Promise<Result<WalkingSkeletonResult>>;
}

export interface ChapterFlowPipelineDependencies {
  readonly runStore: RunStore;
  readonly stageCoordinator: StageCoordinator;
  readonly modelGateway: ModelGateway;
  readonly candidateStore: CandidateStore;
  readonly contentReader: BookContentReader;
  readonly reviewService: ReviewService;
  readonly qcService: QcService;
  readonly promotionService: PromotionService;
  readonly clock: ChapterFlowClock;
  readonly ids: ChapterFlowIdFactory;
}

type PipelineContext = Readonly<{
  input: WalkingSkeletonInput;
  definition: RunDefinition;
  runId: string;
  candidateId: string;
  modelAttemptId: string;
  reviewAttemptId: string;
  reviewId: string;
  qcRoundId: string;
}>;

const KINDS = new Set(["CHAPTER", "PROVENANCE", "SIDECAR"]);
const MEDIA_TYPES = new Set(["text/plain", "text/markdown", "application/json"]);

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

function exactDataRecord(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) return false;
  if (ownKeys.length !== expected.length || expected.some((key) => !ownKeys.includes(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!exactKeys(descriptors, expected)) return false;
  return expected.every((key) => {
    const descriptor = descriptors[key];
    return descriptor !== undefined && "value" in descriptor && descriptor.get === undefined && descriptor.set === undefined;
  });
}

function exactDataArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string")) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const expected = ["length", ...value.map((_, index) => String(index))];
  return exactKeys(descriptors, expected) && expected.every((key) => {
    const descriptor = descriptors[key];
    return descriptor !== undefined && "value" in descriptor && descriptor.get === undefined && descriptor.set === undefined;
  });
}

function canonicalUtc(value: unknown): value is UtcIso {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function safeClock(clock: ChapterFlowClock): Result<UtcIso> {
  try {
    const value = clock.now();
    return canonicalUtc(value)
      ? { ok: true, value }
      : failed("PIPELINE_CLOCK_INVALID", "application clock must return canonical UTC ISO time");
  } catch {
    return failed("PIPELINE_CLOCK_INVALID", "application clock failed");
  }
}

function safeLogicalPath(value: string): boolean {
  if (value.length === 0 || value.startsWith("/") || value.endsWith("/") || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function freezeInventory(value: readonly PlannedArtifact[]): Result<readonly PlannedArtifact[]> {
  if (!Array.isArray(value)) return failed("PIPELINE_INPUT_INVALID", "requiredInventory must be an array");
  const seen = new Set<string>();
  const inventory: PlannedArtifact[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index] as PlannedArtifact;
    if (
      !isRecord(item) ||
      !exactKeys(item, ["kind", "logicalPath", "mediaType"]) ||
      typeof item.kind !== "string" ||
      !KINDS.has(item.kind) ||
      typeof item.logicalPath !== "string" ||
      !safeLogicalPath(item.logicalPath) ||
      typeof item.mediaType !== "string" ||
      !MEDIA_TYPES.has(item.mediaType) ||
      seen.has(item.logicalPath)
    ) {
      return failed("PIPELINE_INPUT_INVALID", `requiredInventory[${index}] is invalid`);
    }
    seen.add(item.logicalPath);
    inventory.push(Object.freeze({
      kind: item.kind as PlannedArtifact["kind"],
      logicalPath: item.logicalPath,
      mediaType: item.mediaType as PlannedArtifact["mediaType"],
    }));
  }
  return { ok: true, value: Object.freeze(inventory) };
}

function parseGatewayOutput(
  value: unknown,
  requiredInventory: readonly PlannedArtifact[],
): Result<readonly CandidateInputFile[]> {
  try {
    if (
      !exactDataRecord(value, ["files", "schemaVersion"]) ||
      value.schemaVersion !== "1" ||
      !exactDataArray(value.files)
    ) {
      return failed("PIPELINE_GATEWAY_OUTPUT_INVALID", "gateway output must match candidate-output schema 1");
    }
    if (value.files.length !== requiredInventory.length) {
      return failed("PIPELINE_GATEWAY_OUTPUT_INVALID", "gateway files must exactly match required inventory length");
    }
    const files: CandidateInputFile[] = [];
    for (let index = 0; index < value.files.length; index += 1) {
      const file = value.files[index];
      const expected = requiredInventory[index];
      if (
        !exactDataRecord(file, ["bytes", "kind", "logicalPath", "mediaType"]) ||
        file.kind !== expected.kind ||
        file.logicalPath !== expected.logicalPath ||
        file.mediaType !== expected.mediaType ||
        !exactDataRecord(file.bytes, ["data", "encoding"]) ||
        file.bytes.encoding !== "base64" ||
        typeof file.bytes.data !== "string"
      ) {
        return failed("PIPELINE_GATEWAY_OUTPUT_INVALID", `gateway files[${index}] differs from required inventory`);
      }
      const decoded = Buffer.from(file.bytes.data, "base64");
      if (decoded.toString("base64") !== file.bytes.data) {
        return failed("PIPELINE_GATEWAY_OUTPUT_INVALID", `gateway files[${index}] bytes are not canonical base64`);
      }
      files.push(Object.freeze({
        kind: expected.kind,
        logicalPath: expected.logicalPath,
        mediaType: expected.mediaType,
        bytes: new Uint8Array(decoded),
      }));
    }
    return { ok: true, value: Object.freeze(files) };
  } catch {
    return failed("PIPELINE_GATEWAY_OUTPUT_INVALID", "gateway output could not be decoded safely");
  }
}

function clonePrompt(prompt: PromptRequest): Result<PromptRequest> {
  try {
    if (!isRecord(prompt) || !exactKeys(prompt, ["inputs", "templateId"]) || typeof prompt.templateId !== "string" || !Array.isArray(prompt.inputs)) {
      return failed("PIPELINE_INPUT_INVALID", "prompt request is invalid");
    }
    const inputs = prompt.inputs.map((input, index) => {
      if (
        !isRecord(input) ||
        !exactKeys(input, ["bytes", "mediaType", "name"]) ||
        typeof input.name !== "string" ||
        typeof input.mediaType !== "string" ||
        !MEDIA_TYPES.has(input.mediaType) ||
        !(input.bytes instanceof Uint8Array)
      ) {
        throw new Error(`prompt input ${index} is invalid`);
      }
      return Object.freeze({
        name: input.name,
        mediaType: input.mediaType as PromptRequest["inputs"][number]["mediaType"],
        bytes: Buffer.from(input.bytes),
      });
    });
    return {
      ok: true,
      value: Object.freeze({ templateId: prompt.templateId, inputs: Object.freeze(inputs) }),
    };
  } catch {
    return failed("PIPELINE_INPUT_INVALID", "prompt request is invalid");
  }
}

function cloneQcEvaluation(value: WalkingSkeletonInput["qcEvaluation"]): Result<WalkingSkeletonInput["qcEvaluation"]> {
  if (!isRecord(value) || !exactKeys(value, ["issues", "outcome"]) || !Array.isArray(value.issues)) {
    return failed("PIPELINE_INPUT_INVALID", "QC evaluation fixture is invalid");
  }
  if (value.outcome !== "PASS" && value.outcome !== "FAIL" && value.outcome !== "ERROR") {
    return failed("PIPELINE_INPUT_INVALID", "QC evaluation outcome is invalid");
  }
  const issues: QcIssue[] = [];
  for (const issue of value.issues) {
    if (!isRecord(issue)) return failed("PIPELINE_INPUT_INVALID", "QC evaluation issue is invalid");
    const expected = issue.location === undefined
      ? ["code", "message", "severity"]
      : ["code", "location", "message", "severity"];
    if (
      !exactKeys(issue, expected) ||
      typeof issue.code !== "string" ||
      issue.code.length === 0 ||
      (issue.severity !== "WARN" && issue.severity !== "BLOCKER") ||
      typeof issue.message !== "string" ||
      issue.message.length === 0 ||
      (issue.location !== undefined && (typeof issue.location !== "string" || issue.location.length === 0))
    ) {
      return failed("PIPELINE_INPUT_INVALID", "QC evaluation issue is invalid");
    }
    issues.push(Object.freeze({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...(issue.location === undefined ? {} : { location: issue.location }),
    }));
  }
  return { ok: true, value: Object.freeze({ outcome: value.outcome, issues: Object.freeze(issues) }) };
}

function sameIdentity(left: CandidateIdentity, right: CandidateIdentity): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

function candidateIdentity(snapshot: CandidateSnapshot): CandidateIdentity {
  return {
    candidateId: snapshot.manifest.candidateId,
    manifestDigest: snapshot.manifest.manifestDigest,
  };
}

function definitionFor(
  input: WalkingSkeletonInput,
  runId: string,
  createdAt: UtcIso,
  inventory: readonly PlannedArtifact[],
): RunDefinition {
  const limit = input.modelAttemptLimit ?? 1;
  const byStage = Object.freeze({
    [WALKING_SKELETON_STAGES[0]]: limit,
    [WALKING_SKELETON_STAGES[1]]: 0,
    [WALKING_SKELETON_STAGES[2]]: 0,
    [WALKING_SKELETON_STAGES[3]]: 0,
  });
  return Object.freeze({
    schemaVersion: "1" as const,
    bookId: input.bookId,
    runId,
    commandId: input.commandId,
    sourceGitSha: input.sourceGitSha,
    requiredStages: WALKING_SKELETON_STAGES,
    requiredInventory: inventory,
    ...(input.inputCandidate === undefined
      ? {}
      : { inputCandidate: Object.freeze({ ...input.inputCandidate }) }),
    attemptLimits: Object.freeze({ run: limit, byStage }),
    createdAt,
  });
}

async function safeReadRun(
  dependencies: ChapterFlowPipelineDependencies,
  bookId: string,
  runId: string,
): Promise<Result<RunSnapshot>> {
  const observedAt = safeClock(dependencies.clock);
  if (!observedAt.ok) return observedAt;
  try {
    return await dependencies.runStore.readRun(bookId, runId, observedAt.value);
  } catch {
    return failed("PIPELINE_RUN_UNAVAILABLE", "run state read threw");
  }
}

async function checkpoint(
  dependencies: ChapterFlowPipelineDependencies,
  context: PipelineContext,
  stageId: WalkingSkeletonStage,
  status: "COMPLETED" | "FAILED",
  attemptIds: readonly string[],
  candidate?: CandidateIdentity,
): Promise<Result<void>> {
  const completedAt = safeClock(dependencies.clock);
  if (!completedAt.ok) return completedAt;
  try {
    return await dependencies.stageCoordinator.checkpoint({
      schemaVersion: "1",
      bookId: context.input.bookId,
      runId: context.runId,
      stageId,
      status,
      attemptIds,
      ...(candidate === undefined ? {} : { candidate: { ...candidate } }),
      completedAt: completedAt.value,
    });
  } catch {
    return failed("PIPELINE_CHECKPOINT_FAILED", `stage checkpoint threw: ${stageId}`);
  }
}

async function failRun<T>(
  dependencies: ChapterFlowPipelineDependencies,
  context: PipelineContext,
  stageId: WalkingSkeletonStage,
  code: string,
  message: string,
  attemptIds: readonly string[] = [],
  candidate?: CandidateIdentity,
): Promise<Result<T>> {
  const durableStage = await checkpoint(dependencies, context, stageId, "FAILED", attemptIds, candidate);
  const finishedAt = safeClock(dependencies.clock);
  if (!finishedAt.ok) return finishedAt;
  let terminal: Result<void>;
  try {
    terminal = await dependencies.runStore.finishRun({
      bookId: context.input.bookId,
      runId: context.runId,
      status: "FAILED",
      finishedAt: finishedAt.value,
      reason: `${code}: ${message}`.slice(0, 4096),
    });
  } catch {
    return failed("PIPELINE_TERMINAL_UNCERTAIN", "failed run terminal write threw");
  }
  if (!terminal.ok) {
    const terminalCode = terminal.error.code === "UNSETTLED_ATTEMPTS"
      ? "PIPELINE_ATTEMPT_UNCERTAIN"
      : "PIPELINE_TERMINAL_UNCERTAIN";
    return failed(terminalCode, `run failure could not become durable: ${terminal.error.code}`);
  }
  if (!durableStage.ok) {
    return failed("PIPELINE_CHECKPOINT_FAILED", `run failed durably but stage checkpoint failed: ${durableStage.error.code}`);
  }
  return failed(code, message);
}

async function cancelRun<T>(
  dependencies: ChapterFlowPipelineDependencies,
  context: PipelineContext,
  reason: string,
): Promise<Result<T>> {
  const current = await safeReadRun(dependencies, context.input.bookId, context.runId);
  if (!current.ok) return current;
  if (current.value.status === "RUNNING") {
    const requestedAt = safeClock(dependencies.clock);
    if (!requestedAt.ok) return requestedAt;
    let requested: Result<void>;
    try {
      requested = await dependencies.runStore.requestCancel({
        bookId: context.input.bookId,
        runId: context.runId,
        reason,
        requestedAt: requestedAt.value,
      });
    } catch {
      return failed("PIPELINE_CANCEL_UNCERTAIN", "cancellation request threw");
    }
    if (!requested.ok) return failed("PIPELINE_CANCEL_UNCERTAIN", `cancellation request failed: ${requested.error.code}`);
  } else if (current.value.status !== "CANCEL_REQUESTED" && current.value.status !== "CANCELLED") {
    return failed("PIPELINE_RUN_TERMINAL", `run cannot cancel from ${current.value.status}`);
  }
  if (current.value.status !== "CANCELLED") {
    const finishedAt = safeClock(dependencies.clock);
    if (!finishedAt.ok) return finishedAt;
    let finished: Result<void>;
    try {
      finished = await dependencies.runStore.finishRun({
        bookId: context.input.bookId,
        runId: context.runId,
        status: "CANCELLED",
        finishedAt: finishedAt.value,
        reason,
      });
    } catch {
      return failed("PIPELINE_CANCEL_UNCERTAIN", "cancelled run terminal write threw");
    }
    if (!finished.ok) {
      return failed(
        finished.error.code === "UNSETTLED_ATTEMPTS" ? "PIPELINE_CANCEL_PENDING" : "PIPELINE_CANCEL_UNCERTAIN",
        `cancellation could not become terminal: ${finished.error.code}`,
      );
    }
  }
  const verified = await safeReadRun(dependencies, context.input.bookId, context.runId);
  if (!verified.ok || verified.value.status !== "CANCELLED") {
    return failed("PIPELINE_CANCEL_UNCERTAIN", "cancelled run readback was not durable");
  }
  return failed("PIPELINE_CANCELLED", reason);
}

async function cancelBeforeBoundary<T>(
  dependencies: ChapterFlowPipelineDependencies,
  context: PipelineContext,
): Promise<Result<T> | null> {
  const snapshot = await safeReadRun(dependencies, context.input.bookId, context.runId);
  if (!snapshot.ok) return snapshot;
  if (context.input.signal.aborted || snapshot.value.status === "CANCEL_REQUESTED") {
    return cancelRun(dependencies, context, "walking skeleton cancellation requested");
  }
  if (snapshot.value.status !== "RUNNING") {
    return failed("PIPELINE_RUN_TERMINAL", `run is terminal: ${snapshot.value.status}`);
  }
  return null;
}

async function openCandidate(
  dependencies: ChapterFlowPipelineDependencies,
  context: PipelineContext,
): Promise<Result<CandidateSnapshot>> {
  try {
    return await dependencies.contentReader.open({
      bookId: context.input.bookId,
      selector: { kind: "CANDIDATE", candidateId: context.candidateId },
    });
  } catch {
    return failed("PIPELINE_CANDIDATE_UNAVAILABLE", "candidate read threw");
  }
}

type PromotionReadiness =
  | Readonly<{ status: "READY" }>
  | Readonly<{ status: "VERIFIED"; bookRevision: number }>;

async function inspectPromotionReadiness(
  dependencies: ChapterFlowPipelineDependencies,
  context: PipelineContext,
  identity: CandidateIdentity,
): Promise<Result<PromotionReadiness>> {
  let current;
  try {
    current = await dependencies.contentReader.open({
      bookId: context.input.bookId,
      selector: { kind: "CURRENT" },
    });
  } catch {
    return failed("PIPELINE_READBACK_FAILED", "CURRENT inspection threw");
  }
  if (!current.ok) {
    return current.error.code === "CURRENT_NOT_SET" && context.input.expectedBookRevision === 0
      ? { ok: true, value: { status: "READY" } }
      : failed("PIPELINE_READBACK_FAILED", `CURRENT inspection failed: ${current.error.code}`);
  }
  if (
    current.value.currentRevision === context.input.expectedBookRevision + 1 &&
    sameIdentity(candidateIdentity(current.value), identity)
  ) {
    return {
      ok: true,
      value: { status: "VERIFIED", bookRevision: context.input.expectedBookRevision + 1 },
    };
  }
  if (current.value.currentRevision === context.input.expectedBookRevision) {
    return { ok: true, value: { status: "READY" } };
  }
  return failed(
    "PIPELINE_PROMOTION_CONFLICT",
    "CURRENT revision or candidate proves promotion cannot safely replay",
  );
}

async function loadCompletedResult(
  dependencies: ChapterFlowPipelineDependencies,
  context: PipelineContext,
  resumedStages: readonly WalkingSkeletonStage[],
): Promise<Result<WalkingSkeletonResult>> {
  const candidate = await openCandidate(dependencies, context);
  if (!candidate.ok) return failed("PIPELINE_CANDIDATE_UNAVAILABLE", candidate.error.message);
  const identity = candidateIdentity(candidate.value);
  let review;
  try {
    review = await dependencies.reviewService.get(context.input.bookId, context.reviewId);
  } catch {
    return failed("PIPELINE_REVIEW_UNAVAILABLE", "canonical review read threw");
  }
  if (!review.ok || review.value.outcome !== "PASS" || !sameIdentity(review.value.candidate, identity)) {
    return failed("PIPELINE_REVIEW_UNAVAILABLE", "completed canonical PASS is unavailable or mismatched");
  }
  let qc;
  try {
    qc = await dependencies.qcService.getRound(context.input.bookId, context.qcRoundId);
  } catch {
    return failed("PIPELINE_QC_UNAVAILABLE", "fresh QC read threw");
  }
  if (!qc.ok || qc.value.outcome !== "PASS" || !sameIdentity(qc.value.candidate, identity) || qc.value.reviewId !== context.reviewId) {
    return failed("PIPELINE_QC_UNAVAILABLE", "completed fresh QC PASS is unavailable or mismatched");
  }
  let current;
  try {
    current = await dependencies.contentReader.open({ bookId: context.input.bookId, selector: { kind: "CURRENT" } });
  } catch {
    return failed("PIPELINE_READBACK_FAILED", "CURRENT readback threw");
  }
  const expectedRevision = context.input.expectedBookRevision + 1;
  if (
    !current.ok ||
    !sameIdentity(candidateIdentity(current.value), identity) ||
    current.value.currentRevision !== expectedRevision
  ) {
    return failed("PIPELINE_READBACK_FAILED", "CURRENT readback does not match completed promotion");
  }
  return {
    ok: true,
    value: {
      schemaVersion: "1",
      runId: context.runId,
      candidate: identity,
      review: review.value,
      qc: qc.value,
      bookRevision: expectedRevision,
      readback: "VERIFIED",
      resumedStages: [...resumedStages],
      runStatus: "COMPLETED",
    },
  };
}

export function createChapterFlowPipeline(dependencies: ChapterFlowPipelineDependencies): ChapterFlowPipeline {
  return {
    async run(rawInput: WalkingSkeletonInput): Promise<Result<WalkingSkeletonResult>> {
      const inventory = freezeInventory(rawInput.requiredInventory);
      if (!inventory.ok) return inventory;
      const prompt = clonePrompt(rawInput.prompt);
      if (!prompt.ok) return prompt;
      const qcEvaluation = cloneQcEvaluation(rawInput.qcEvaluation);
      if (!qcEvaluation.ok) return qcEvaluation;
      const limit = rawInput.modelAttemptLimit ?? 1;
      if (!Number.isSafeInteger(limit) || limit < 0) {
        return failed("PIPELINE_INPUT_INVALID", "modelAttemptLimit must be a non-negative safe integer");
      }
      if (!Number.isSafeInteger(rawInput.expectedBookRevision) || rawInput.expectedBookRevision < 0) {
        return failed("PIPELINE_INPUT_INVALID", "expectedBookRevision must be a non-negative safe integer");
      }
      const input: WalkingSkeletonInput = Object.freeze({
        ...rawInput,
        requiredInventory: inventory.value,
        prompt: prompt.value,
        qcEvaluation: qcEvaluation.value,
        ...(rawInput.inputCandidate === undefined
          ? {}
          : { inputCandidate: Object.freeze({ ...rawInput.inputCandidate }) }),
      });

      let runId = input.resumeRunId;
      let createdAt: UtcIso | null = null;
      if (runId !== undefined) {
        const existing = await safeReadRun(dependencies, input.bookId, runId);
        if (existing.ok) createdAt = existing.value.definition.createdAt;
        else if (existing.error.code !== "NOT_FOUND") return existing;
      } else {
        try {
          runId = dependencies.ids.nextRunId();
        } catch {
          return failed("PIPELINE_ID_INVALID", "run ID factory failed");
        }
      }
      if (createdAt === null) {
        const observed = safeClock(dependencies.clock);
        if (!observed.ok) return observed;
        createdAt = observed.value;
      }

      let definition = definitionFor(input, runId, createdAt, inventory.value);
      let created: Result<RunSnapshot>;
      try {
        created = await dependencies.runStore.createRun(definition);
      } catch {
        return failed("PIPELINE_RUN_UNAVAILABLE", "run creation threw");
      }
      if (!created.ok && created.error.code === "CONFLICT" && input.resumeRunId !== undefined) {
        try {
          runId = dependencies.ids.nextRunId();
        } catch {
          return failed("PIPELINE_ID_INVALID", "changed intent run ID factory failed");
        }
        const nextCreatedAt = safeClock(dependencies.clock);
        if (!nextCreatedAt.ok) return nextCreatedAt;
        definition = definitionFor(input, runId, nextCreatedAt.value, inventory.value);
        try {
          created = await dependencies.runStore.createRun(definition);
        } catch {
          return failed("PIPELINE_RUN_UNAVAILABLE", "changed-intent run creation threw");
        }
      }
      if (!created.ok) return failed("PIPELINE_RUN_UNAVAILABLE", `run creation failed: ${created.error.code}`);

      let context: PipelineContext;
      try {
        context = Object.freeze({
          input,
          definition,
          runId,
          candidateId: dependencies.ids.candidateId(runId),
          modelAttemptId: dependencies.ids.modelAttemptId(runId),
          reviewAttemptId: dependencies.ids.reviewAttemptId(runId),
          reviewId: dependencies.ids.reviewId(runId),
          qcRoundId: dependencies.ids.qcRoundId(runId),
        });
      } catch {
        return failed("PIPELINE_ID_INVALID", "lifecycle ID factory failed");
      }

      const liveSnapshot = await safeReadRun(dependencies, input.bookId, runId);
      if (!liveSnapshot.ok) return liveSnapshot;
      if (liveSnapshot.value.status === "CANCEL_REQUESTED") {
        return cancelRun(dependencies, context, "walking skeleton cancellation requested");
      }
      if (liveSnapshot.value.status === "COMPLETED") {
        let completedPlan;
        try {
          completedPlan = await dependencies.stageCoordinator.planResume(definition);
        } catch {
          return failed("PIPELINE_RESUME_UNAVAILABLE", "completed resume verification threw");
        }
        if (!completedPlan.ok || completedPlan.value.pendingStages.length > 0 || completedPlan.value.cancelled) {
          return failed("PIPELINE_INCOMPLETE", "completed run lacks every required durable checkpoint");
        }
        return loadCompletedResult(dependencies, context, WALKING_SKELETON_STAGES);
      }
      if (liveSnapshot.value.status !== "RUNNING") {
        return failed("PIPELINE_RUN_TERMINAL", `run is terminal: ${liveSnapshot.value.status}`);
      }

      let plan;
      try {
        plan = await dependencies.stageCoordinator.planResume(definition);
      } catch {
        return failed("PIPELINE_RESUME_UNAVAILABLE", "resume plan threw");
      }
      if (!plan.ok) return failed("PIPELINE_RESUME_UNAVAILABLE", `resume plan failed: ${plan.error.code}`);
      if (plan.value.cancelled) return cancelRun(dependencies, context, "walking skeleton cancellation requested");
      const completed = new Set(plan.value.completedStages);
      const resumedStages = WALKING_SKELETON_STAGES.filter((stage) => completed.has(stage));

      if (!completed.has(WALKING_SKELETON_STAGES[0])) {
        const priorModelAttempts = liveSnapshot.value.attempts.filter(
          (attempt) => attempt.admission.stageId === WALKING_SKELETON_STAGES[0],
        );
        if (priorModelAttempts.length > 0) {
          if (priorModelAttempts.some((attempt) => attempt.status === "ACTIVE" || attempt.status === "STALE")) {
            return failed("PIPELINE_ATTEMPT_UNCERTAIN", "admitted model work is unsettled; automatic replay refused");
          }
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            "PIPELINE_ATTEMPT_NOT_REPLAYABLE",
            "prior admitted model work lacks a completed candidate checkpoint",
            priorModelAttempts.map((attempt) => attempt.admission.attemptId),
          );
        }
      }

      let candidate: CandidateSnapshot;
      let identity: CandidateIdentity;
      if (completed.has(WALKING_SKELETON_STAGES[0])) {
        const opened = await openCandidate(dependencies, context);
        if (!opened.ok) {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[1], "PIPELINE_CANDIDATE_UNAVAILABLE", opened.error.message);
        }
        candidate = opened.value;
        identity = candidateIdentity(candidate);
      } else {
        const cancelled = await cancelBeforeBoundary<WalkingSkeletonResult>(dependencies, context);
        if (cancelled) return cancelled;
        const task: ModelTask = {
          bookId: input.bookId,
          runId,
          attemptId: context.modelAttemptId,
          stageId: WALKING_SKELETON_STAGES[0],
          operationId: "generate-candidate",
          profileId: input.profileId,
          workDir: input.workDir,
          prompt: input.prompt,
          signal: input.signal,
        };
        let model;
        try {
          model = await dependencies.modelGateway.execute(task);
        } catch {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[0], "PIPELINE_MODEL_UNCERTAIN", "model gateway threw");
        }
        const afterModel = await safeReadRun(dependencies, input.bookId, runId);
        const admittedAttemptIds = afterModel.ok && afterModel.value.attempts.some(
          (attempt) => attempt.admission.attemptId === context.modelAttemptId,
        ) ? [context.modelAttemptId] : [];
        if (model.attemptId !== context.modelAttemptId) {
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            "PIPELINE_MODEL_UNCERTAIN",
            "model gateway returned a different attempt ID",
            admittedAttemptIds,
          );
        }
        if (model.outcome === "CANCELLED" || input.signal.aborted) {
          return cancelRun(dependencies, context, "model task cancelled");
        }
        if (model.outcome !== "SUCCEEDED") {
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            model.outcome === "UNKNOWN" ? "PIPELINE_MODEL_UNCERTAIN" : "PIPELINE_MODEL_FAILED",
            `model gateway outcome ${model.outcome}`,
            admittedAttemptIds,
          );
        }
        const output = parseGatewayOutput(model.output, definition.requiredInventory);
        if (!output.ok) {
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            output.error.code,
            output.error.message,
            admittedAttemptIds,
          );
        }
        const cancelledBeforeStage = await cancelBeforeBoundary<WalkingSkeletonResult>(dependencies, context);
        if (cancelledBeforeStage) return cancelledBeforeStage;
        const stagedAt = safeClock(dependencies.clock);
        if (!stagedAt.ok) return stagedAt;
        let staged;
        try {
          staged = await dependencies.candidateStore.stage({
            bookId: input.bookId,
            candidateId: context.candidateId,
            ...(input.inputCandidate === undefined ? {} : { parentCandidateId: input.inputCandidate.candidateId }),
            createdByRunId: runId,
            expectedInventory: definition.requiredInventory,
            files: output.value,
            createdAt: stagedAt.value,
          });
        } catch {
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            "PIPELINE_CANDIDATE_FAILED",
            "candidate stage threw",
            admittedAttemptIds,
          );
        }
        if (!staged.ok) {
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            "PIPELINE_CANDIDATE_FAILED",
            `candidate stage failed: ${staged.error.code}`,
            admittedAttemptIds,
          );
        }
        const opened = await openCandidate(dependencies, context);
        if (!opened.ok) {
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            "PIPELINE_CANDIDATE_UNAVAILABLE",
            opened.error.message,
            admittedAttemptIds,
          );
        }
        candidate = opened.value;
        identity = candidateIdentity(candidate);
        const completedStage = await checkpoint(
          dependencies,
          context,
          WALKING_SKELETON_STAGES[0],
          "COMPLETED",
          admittedAttemptIds,
          identity,
        );
        if (!completedStage.ok) {
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[0],
            "PIPELINE_CHECKPOINT_FAILED",
            completedStage.error.message,
            admittedAttemptIds,
            identity,
          );
        }
        completed.add(WALKING_SKELETON_STAGES[0]);
      }

      let review: CanonicalReviewResult;
      if (completed.has(WALKING_SKELETON_STAGES[1])) {
        let storedReview;
        try {
          storedReview = await dependencies.reviewService.get(input.bookId, context.reviewId);
        } catch {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[2], "PIPELINE_REVIEW_UNAVAILABLE", "canonical review read threw", [], identity);
        }
        if (!storedReview.ok || storedReview.value.outcome !== "PASS" || !sameIdentity(storedReview.value.candidate, identity)) {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[2], "PIPELINE_REVIEW_UNAVAILABLE", "completed canonical PASS is unavailable", [], identity);
        }
        review = storedReview.value;
      } else {
        const cancelled = await cancelBeforeBoundary<WalkingSkeletonResult>(dependencies, context);
        if (cancelled) return cancelled;
        try {
          await dependencies.reviewService.screen(candidate);
        } catch {
          // Screening is observational only and has no promotion authority.
        }
        const cancelledAfterScreen = await cancelBeforeBoundary<WalkingSkeletonResult>(dependencies, context);
        if (cancelledAfterScreen) return cancelledAfterScreen;
        const taskContext: ModelTaskContext = {
          bookId: input.bookId,
          runId,
          attemptId: context.reviewAttemptId,
          stageId: WALKING_SKELETON_STAGES[1],
          operationId: "canonical-review",
          workDir: input.workDir,
          signal: input.signal,
        };
        let canonical;
        try {
          canonical = await dependencies.reviewService.reviewCanonical({
            reviewId: context.reviewId,
            candidate,
            taskContext,
          });
        } catch {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[1], "PIPELINE_REVIEW_FAILED", "canonical review threw", [], identity);
        }
        if (!canonical.ok || canonical.value.outcome !== "PASS") {
          const detail = canonical.ok ? canonical.value.outcome : canonical.error.code;
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[1],
            "PIPELINE_REVIEW_FAILED",
            `canonical review did not PASS: ${detail}`,
            [],
            identity,
          );
        }
        review = canonical.value;
        const completedStage = await checkpoint(dependencies, context, WALKING_SKELETON_STAGES[1], "COMPLETED", [], identity);
        if (!completedStage.ok) {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[1], "PIPELINE_CHECKPOINT_FAILED", completedStage.error.message, [], identity);
        }
        completed.add(WALKING_SKELETON_STAGES[1]);
      }

      let qc: QcRoundResult;
      if (completed.has(WALKING_SKELETON_STAGES[2])) {
        let storedQc;
        try {
          storedQc = await dependencies.qcService.getRound(input.bookId, context.qcRoundId);
        } catch {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], "PIPELINE_QC_UNAVAILABLE", "fresh QC read threw", [], identity);
        }
        if (
          !storedQc.ok ||
          storedQc.value.outcome !== "PASS" ||
          storedQc.value.reviewId !== context.reviewId ||
          !sameIdentity(storedQc.value.candidate, identity)
        ) {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], "PIPELINE_QC_UNAVAILABLE", "completed fresh QC PASS is unavailable", [], identity);
        }
        qc = storedQc.value;
      } else {
        const cancelled = await cancelBeforeBoundary<WalkingSkeletonResult>(dependencies, context);
        if (cancelled) return cancelled;
        const evaluation: QcEvaluation = {
          roundId: context.qcRoundId,
          candidate: { ...identity },
          reviewId: context.reviewId,
          outcome: input.qcEvaluation.outcome,
          issues: input.qcEvaluation.issues.map((issue) => ({ ...issue })),
        };
        let fresh;
        try {
          fresh = await dependencies.qcService.runFresh({
            roundId: context.qcRoundId,
            candidate,
            canonicalReview: review,
            evaluation,
          });
        } catch {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[2], "PIPELINE_QC_FAILED", "fresh QC threw", [], identity);
        }
        if (!fresh.ok || fresh.value.outcome !== "PASS") {
          const detail = fresh.ok ? fresh.value.outcome : fresh.error.code;
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[2],
            "PIPELINE_QC_FAILED",
            `fresh QC did not PASS: ${detail}`,
            [],
            identity,
          );
        }
        qc = fresh.value;
        const completedStage = await checkpoint(dependencies, context, WALKING_SKELETON_STAGES[2], "COMPLETED", [], identity);
        if (!completedStage.ok) {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[2], "PIPELINE_CHECKPOINT_FAILED", completedStage.error.message, [], identity);
        }
        completed.add(WALKING_SKELETON_STAGES[2]);
      }

      let bookRevision: number;
      if (completed.has(WALKING_SKELETON_STAGES[3])) {
        const loaded = await loadCompletedResult(dependencies, context, resumedStages);
        if (!loaded.ok) return loaded;
        bookRevision = loaded.value.bookRevision;
      } else {
        const cancelled = await cancelBeforeBoundary<WalkingSkeletonResult>(dependencies, context);
        if (cancelled) return cancelled;
        const beforePromotion = await inspectPromotionReadiness(dependencies, context, identity);
        if (!beforePromotion.ok) {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], beforePromotion.error.code, beforePromotion.error.message, [], identity);
        }
        if (beforePromotion.value.status === "READY") {
          const promotedAt = safeClock(dependencies.clock);
          if (!promotedAt.ok) return promotedAt;
          let promoted;
          try {
            promoted = await dependencies.promotionService.promote({
              bookId: input.bookId,
              candidate: { ...identity },
              reviewId: context.reviewId,
              qcRoundId: context.qcRoundId,
              expectedBookRevision: input.expectedBookRevision,
              promotedAt: promotedAt.value,
            });
          } catch {
            return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], "PIPELINE_PROMOTION_FAILED", "promotion threw", [], identity);
          }
          if (!promoted.ok || promoted.value.readback !== "VERIFIED") {
            const detail = promoted.ok ? "unverified" : promoted.error.code;
            return failRun(
              dependencies,
              context,
              WALKING_SKELETON_STAGES[3],
              "PIPELINE_PROMOTION_FAILED",
              `promotion failed: ${detail}`,
              [],
              identity,
            );
          }
        }
        const verifiedPromotion = await inspectPromotionReadiness(dependencies, context, identity);
        if (!verifiedPromotion.ok || verifiedPromotion.value.status !== "VERIFIED") {
          const detail = verifiedPromotion.ok ? "unverified" : verifiedPromotion.error.code;
          return failRun(
            dependencies,
            context,
            WALKING_SKELETON_STAGES[3],
            "PIPELINE_READBACK_FAILED",
            `promotion readback failed: ${detail}`,
            [],
            identity,
          );
        }
        bookRevision = verifiedPromotion.value.bookRevision;
        const completedStage = await checkpoint(dependencies, context, WALKING_SKELETON_STAGES[3], "COMPLETED", [], identity);
        if (!completedStage.ok) {
          return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], "PIPELINE_CHECKPOINT_FAILED", completedStage.error.message, [], identity);
        }
        completed.add(WALKING_SKELETON_STAGES[3]);
      }

      const cancelledBeforeFinish = await cancelBeforeBoundary<WalkingSkeletonResult>(dependencies, context);
      if (cancelledBeforeFinish) return cancelledBeforeFinish;
      let finalPlan;
      try {
        finalPlan = await dependencies.stageCoordinator.planResume(definition);
      } catch {
        return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], "PIPELINE_RESUME_UNAVAILABLE", "final resume verification threw", [], identity);
      }
      if (!finalPlan.ok || finalPlan.value.pendingStages.length > 0 || finalPlan.value.cancelled) {
        return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], "PIPELINE_INCOMPLETE", "required stage checkpoints are incomplete", [], identity);
      }
      const finalPromotion = await inspectPromotionReadiness(dependencies, context, identity);
      if (!finalPromotion.ok || finalPromotion.value.status !== "VERIFIED" || finalPromotion.value.bookRevision !== bookRevision) {
        return failRun(dependencies, context, WALKING_SKELETON_STAGES[3], "PIPELINE_READBACK_FAILED", "final promotion readback is not durable", [], identity);
      }
      const finishedAt = safeClock(dependencies.clock);
      if (!finishedAt.ok) return finishedAt;
      let finished;
      try {
        finished = await dependencies.runStore.finishRun({
          bookId: input.bookId,
          runId,
          status: "COMPLETED",
          finishedAt: finishedAt.value,
        });
      } catch {
        return failed("PIPELINE_TERMINAL_UNCERTAIN", "completed run terminal write threw");
      }
      if (!finished.ok) return failed("PIPELINE_TERMINAL_UNCERTAIN", `completed run terminal write failed: ${finished.error.code}`);
      const terminal = await safeReadRun(dependencies, input.bookId, runId);
      if (!terminal.ok || terminal.value.status !== "COMPLETED") {
        return failed("PIPELINE_TERMINAL_UNCERTAIN", "completed run readback is not durable");
      }
      return {
        ok: true,
        value: {
          schemaVersion: "1",
          runId,
          candidate: identity,
          review,
          qc,
          bookRevision,
          readback: "VERIFIED",
          resumedStages,
          runStatus: "COMPLETED",
        },
      };
    },
  };
}
