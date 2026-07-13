/**
 * Real execution adapter for forwardChapterConductor's split-lane requests.
 *
 * The adapter is intentionally additive: it does not register itself as a
 * default conductor, alter routing policy, or expose a CLI. A caller creates an
 * executor and explicitly injects it. The default spawn path is the hermetic
 * ChatGPT-subscription `spawnCodexAgent` path; tests replace the whole spawn
 * function and therefore make zero live calls.
 */

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PIPELINE_DIR } from "../bakeoff/paths.js";
import { sha256Hex } from "../contracts/contractUtil.js";
import type { ReviewEvidenceEnvelopeV1 } from "../contracts/reviewEvidenceEnvelope.js";
import type { EffortLevelV1 } from "../contracts/executionProfile.js";
import { resolveExecutionProfile } from "../exec/executionEnvelope.js";
import {
  assertReviewerWorkspaceIntact,
  buildReviewerWorkspace,
  type ReviewerArtifact,
  type ReviewerWorkspace,
} from "../review/reviewerWorkspace.js";
import {
  assertReviewEvidenceEnvelope,
  serializeReviewEvidenceEnvelope,
} from "../review/reviewEvidenceEnvelope.js";
import {
  type CodexAgentResult,
  type SpawnCodexAgentOptions,
  spawnCodexAgent,
} from "./codexAgent.js";
import type {
  ForwardReviewArtifactV1,
  ForwardReviewExecutionRequestV1,
  ForwardReviewExecutionResultV1,
  ForwardReviewLane,
  ForwardReviewerExecutor,
  ForwardReviewerWorkspaceRole,
} from "./forwardChapterConductor.js";
import {
  ROUTE_POLICY_VERSION,
  classifyProviderOutcome,
  resolveRoute,
} from "./modelPolicy.js";
import { FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA, FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA } from "./forwardChapterConductor.js";

export type ForwardReviewerSchemaMap = Readonly<Record<ForwardReviewLane, string>>;

const SCHEMA_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts", "schemas");

export const DEFAULT_FORWARD_REVIEWER_SCHEMA_MAP: ForwardReviewerSchemaMap = Object.freeze({
  reader: resolve(SCHEMA_DIR, "reader-experience-review.schema.json"),
  source: resolve(SCHEMA_DIR, "source-integrity-review.schema.json"),
  quiz: resolve(SCHEMA_DIR, "quiz-integrity-adjudication.schema.json"),
});

export const DEFAULT_FORWARD_REVIEWER_V2_SCHEMA_MAP: ForwardReviewerSchemaMap = Object.freeze({
  reader: resolve(SCHEMA_DIR, "reader-experience-model-output-v2.schema.json"),
  source: resolve(SCHEMA_DIR, "source-integrity-model-output-v2.schema.json"),
  quiz: resolve(SCHEMA_DIR, "quiz-integrity-model-output-v2.schema.json"),
});

export type ForwardReviewerSpawn = (
  options: SpawnCodexAgentOptions,
) => Promise<CodexAgentResult>;

export type ForwardReviewerSessionContext = {
  request: Readonly<ForwardReviewExecutionRequestV1>;
  nowMs: number;
  sequence: number;
};

export type ForwardReviewerExecutorDeps = {
  spawn?: ForwardReviewerSpawn;
  schemaMap?: ForwardReviewerSchemaMap;
  /** Optional test/deployment override. Envelope-bound requests otherwise use
   * the frozen IMP-24 semantic-only V2 schema map. */
  v2SchemaMap?: ForwardReviewerSchemaMap;
  sessionIdFactory?: (context: ForwardReviewerSessionContext) => string;
  clock?: () => number;
  workspaceBaseDir?: string;
  timeoutMs?: number;
  /** IMP-22 phase-local broker evidence/cache roots. Existing callers omit
   * these and retain the normal broker defaults. */
  manifestSink?: string;
  qualificationCacheDir?: string;
  execBaseDir?: string;
};

export type ForwardReviewerFailureCode =
  | "policy_preflight_failure"
  | "timeout"
  | "provider_capacity"
  | "transient_execution_failure"
  | "refusal"
  | "invalid_output"
  | "integrity_failure";

export class ForwardReviewerExecutorError extends Error {
  readonly code: ForwardReviewerFailureCode;

  constructor(message: string, code: ForwardReviewerFailureCode = "policy_preflight_failure") {
    super(message);
    this.name = "ForwardReviewerExecutorError";
    this.code = code;
  }
}

type EnforcedRequest = Omit<ForwardReviewExecutionRequestV1, "artifacts"> & {
  artifacts: ForwardReviewArtifactV1[];
};

const SHA256 = /^[a-f0-9]{64}$/;
const EFFORTS: readonly EffortLevelV1[] = ["minimal", "low", "medium", "high", "xhigh"];
const LANE_WORKSPACE_ROLE: Readonly<Record<ForwardReviewLane, ForwardReviewerWorkspaceRole>> = Object.freeze({
  reader: "direct-reader",
  source: "source-verifier",
  quiz: "quiz-adjudication",
});

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireCondition(
  condition: unknown,
  message: string,
  code: ForwardReviewerFailureCode = "policy_preflight_failure",
): asserts condition {
  if (!condition) throw new ForwardReviewerExecutorError(message, code);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function snapshotAndValidateRequest(request: ForwardReviewExecutionRequestV1): EnforcedRequest {
  requireCondition(request && typeof request === "object", "forward reviewer: request is required");
  requireCondition(request.schema === FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA, "forward reviewer: wrong request schema");
  requireCondition(request.lane === "reader" || request.lane === "source" || request.lane === "quiz", `forward reviewer: unknown lane "${String(request.lane)}"`);
  requireCondition(nonEmpty(request.reviewOperationKey)
    && request.reviewOperationKey === request.reviewOperationKey.trim()
    && !/[\u0000-\u001f\u007f]/.test(request.reviewOperationKey),
  "forward reviewer: reviewOperationKey is empty or unstable");
  requireCondition(
    request.workspaceRole === LANE_WORKSPACE_ROLE[request.lane],
    `forward reviewer: lane ${request.lane} requires workspace role ${LANE_WORKSPACE_ROLE[request.lane]}, got ${String(request.workspaceRole)}`,
  );
  requireCondition(nonEmpty(request.task), "forward reviewer: task is empty");
  requireCondition(nonEmpty(request.model), "forward reviewer: model is empty");
  requireCondition(EFFORTS.includes(request.effort), `forward reviewer: invalid effort ${String(request.effort)}`);
  requireCondition(request.profileId === `${request.model}@${request.effort}`, "forward reviewer: profileId must equal <model>@<effort>");
  requireCondition(nonEmpty(request.instrumentVersion), "forward reviewer: instrumentVersion is empty");
  if (request.reviewProtocol !== undefined || request.evidenceEnvelopeSha256 !== undefined || request.evidenceEnvelopeBytesSha256 !== undefined) {
    requireCondition(request.reviewProtocol === "review-evidence-envelope-v1", "forward reviewer: unknown or missing evidence-envelope protocol");
    requireSha(request.evidenceEnvelopeSha256, "forward reviewer evidenceEnvelopeSha256");
    requireSha(request.evidenceEnvelopeBytesSha256, "forward reviewer evidenceEnvelopeBytesSha256");
  }
  requireSha(request.schemaSha256, "forward reviewer schemaSha256");
  requireSha(request.roleAssignmentSha256, "forward reviewer roleAssignmentSha256");
  requireSha(request.instrumentManifestSha256, "forward reviewer instrumentManifestSha256");
  requireSha(request.executionProfileHash, "forward reviewer executionProfileHash");
  requireCondition(request.routePolicyVersion === ROUTE_POLICY_VERSION, `forward reviewer: stale routePolicyVersion ${request.routePolicyVersion}`);

  const { profile, profileHash } = resolveExecutionProfile("chapter-reviewer");
  requireCondition(request.executionProfileHash === profileHash, "forward reviewer: executionProfileHash does not match the enforced chapter-reviewer envelope");
  requireCondition(profile.workingDir === "isolated-workspace", "forward reviewer: chapter-reviewer profile is not isolated");
  requireCondition(profile.codexHome === "isolated-auth-only", "forward reviewer: chapter-reviewer CODEX_HOME is not isolated-auth-only");
  requireCondition(profile.ignoreUserConfig === true && profile.ignoreRules === true && profile.neutralizeProjectDocs === true, "forward reviewer: chapter-reviewer envelope is not hermetic");
  requireCondition(profile.allowedSandboxes.length === 1 && profile.allowedSandboxes[0] === "read-only", "forward reviewer: chapter-reviewer profile permits a writable sandbox");

  const resolvedRoute = resolveRoute({
    role: "chapter-reviewer",
    requestedModel: request.model,
    requestedEffort: request.effort,
  });
  requireCondition(resolvedRoute.model === request.model && resolvedRoute.effort === request.effort, "forward reviewer: explicit model/effort did not resolve exactly");
  requireCondition(resolvedRoute.routePolicyVersion === request.routePolicyVersion, "forward reviewer: route policy drifted during preflight");

  requireCondition(Array.isArray(request.artifacts) && request.artifacts.length > 0, "forward reviewer: no artifacts");
  const seenPaths = new Set<string>();
  const artifacts = request.artifacts.map((artifact, index): ForwardReviewArtifactV1 => {
    requireCondition(artifact && typeof artifact === "object", `forward reviewer: artifact ${index} is invalid`);
    requireCondition(nonEmpty(artifact.relPath), `forward reviewer: artifact ${index} has an empty relPath`);
    requireCondition(!seenPaths.has(artifact.relPath), `forward reviewer: duplicate artifact relPath ${artifact.relPath}`);
    seenPaths.add(artifact.relPath);
    requireCondition(typeof artifact.content === "string", `forward reviewer: artifact ${artifact.relPath} content must be text`);
    requireSha(artifact.sha256, `forward reviewer artifact ${artifact.relPath} sha256`);
    const actual = sha256Hex(artifact.content);
    requireCondition(actual === artifact.sha256, `forward reviewer: artifact ${artifact.relPath} hash mismatch (${artifact.sha256} != ${actual})`);
    return {
      kind: artifact.kind,
      relPath: artifact.relPath,
      content: artifact.content,
      sha256: artifact.sha256,
    };
  });

  if (request.reviewProtocol === "review-evidence-envelope-v1") {
    const envelopeArtifacts = artifacts.filter((artifact) => artifact.kind === "evidence-envelope");
    requireCondition(envelopeArtifacts.length === 1, "forward reviewer: envelope protocol requires exactly one evidence-envelope artifact");
    const envelopeArtifact = envelopeArtifacts[0]!;
    requireCondition(envelopeArtifact.sha256 === request.evidenceEnvelopeBytesSha256,
      "forward reviewer: retained evidence-envelope bytes do not match the request binding");
    let parsed: ReviewEvidenceEnvelopeV1;
    try {
      parsed = JSON.parse(envelopeArtifact.content) as ReviewEvidenceEnvelopeV1;
      assertReviewEvidenceEnvelope(parsed);
    } catch (error) {
      throw new ForwardReviewerExecutorError(
        `forward reviewer: retained evidence envelope is invalid (${(error as Error).message})`,
        "integrity_failure",
      );
    }
    requireCondition(serializeReviewEvidenceEnvelope(parsed) === envelopeArtifact.content,
      "forward reviewer: retained evidence-envelope bytes are not canonical", "integrity_failure");
    requireCondition(parsed.lane === request.lane,
      "forward reviewer: retained evidence-envelope lane does not match request", "integrity_failure");
    requireCondition(parsed.envelopeSha256 === request.evidenceEnvelopeSha256,
      "forward reviewer: retained evidence-envelope semantic hash does not match request", "integrity_failure");
    requireCondition(request.task.includes(envelopeArtifact.content),
      "forward reviewer: complete retained evidence envelope is not present inline in the task");
  }

  return {
    schema: request.schema,
    lane: request.lane,
    reviewOperationKey: request.reviewOperationKey,
    workspaceRole: request.workspaceRole,
    profileId: request.profileId,
    model: request.model,
    effort: request.effort,
    schemaSha256: request.schemaSha256,
    instrumentVersion: request.instrumentVersion,
    ...(request.reviewProtocol ? { reviewProtocol: request.reviewProtocol } : {}),
    ...(request.evidenceEnvelopeSha256 ? { evidenceEnvelopeSha256: request.evidenceEnvelopeSha256 } : {}),
    ...(request.evidenceEnvelopeBytesSha256 ? { evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256 } : {}),
    roleAssignmentSha256: request.roleAssignmentSha256,
    instrumentManifestSha256: request.instrumentManifestSha256,
    executionProfileHash: request.executionProfileHash,
    routePolicyVersion: request.routePolicyVersion,
    task: request.task,
    artifacts,
  };
}

function verifySchemaFile(path: string, expectedSha256: string, phase: "pre-spawn" | "post-spawn"): void {
  requireCondition(nonEmpty(path), `forward reviewer: ${phase} schema path is empty`);
  requireCondition(existsSync(path), `forward reviewer: ${phase} schema file is missing: ${path}`);
  const bytes = readFileSync(path);
  const actual = sha256Hex(bytes);
  requireCondition(actual === expectedSha256, `forward reviewer: ${phase} schema hash drift (${expectedSha256} != ${actual})`);
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    requireCondition(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed), `forward reviewer: ${phase} schema must be a JSON object`);
  } catch (error) {
    if (error instanceof ForwardReviewerExecutorError) throw error;
    throw new ForwardReviewerExecutorError(`forward reviewer: ${phase} schema is not JSON (${(error as Error).message})`);
  }
}

function verifyWorkspaceManifest(workspace: ReviewerWorkspace, artifacts: readonly ForwardReviewArtifactV1[]): void {
  requireCondition(workspace.files.length === artifacts.length, "forward reviewer: workspace manifest file count mismatch");
  const expected = new Map(artifacts.map((artifact) => [artifact.relPath, artifact]));
  for (const file of workspace.files) {
    const artifact = expected.get(file.relPath);
    requireCondition(artifact !== undefined, `forward reviewer: workspace contains unrequested file ${file.relPath}`);
    requireCondition(file.sha256 === artifact.sha256, `forward reviewer: workspace manifest hash mismatch for ${file.relPath}`);
    requireCondition(file.bytes === Buffer.byteLength(artifact.content), `forward reviewer: workspace manifest byte count mismatch for ${file.relPath}`);
  }
}

function refusalSignal(result: CodexAgentResult): string | null {
  const final = typeof result.finalMessage === "string" ? result.finalMessage.trim() : "";
  if (/^(?:i(?:'m| am) sorry\b[\s\S]{0,160}\b(?:cannot|can't|unable|won't)|i (?:cannot|can't|am unable|won't)\b|unable to comply\b|request (?:was )?refused\b)/i.test(final)) {
    return "final output is a refusal";
  }
  const transport = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
  if (/\b(?:provider safeguard|safeguard triggered|safety refusal|policy refusal|refused by (?:the )?provider)\b/i.test(transport)) {
    return "provider reported a safeguard/refusal";
  }
  return null;
}

function validateSpawnResult(result: CodexAgentResult, sessionId: string): string {
  requireCondition(result && typeof result === "object", "forward reviewer: spawn returned no result");
  requireCondition(
    result.sessionId === sessionId,
    `forward reviewer: spawn session mismatch (${String(result.sessionId)} != ${sessionId})`,
    "integrity_failure",
  );
  if (result.ok !== true || result.exitCode !== 0) {
    const providerOutcome = classifyProviderOutcome({
      completed: true,
      exitCode: result.exitCode,
      stderr: result.stderr,
      finalMessage: result.finalMessage,
    });
    const code: ForwardReviewerFailureCode = providerOutcome === "provider_rate_or_capacity"
      ? "provider_capacity"
      : providerOutcome === "provider_safeguard_or_refusal"
        ? "refusal"
        : "transient_execution_failure";
    throw new ForwardReviewerExecutorError(
      `forward reviewer: codex exec failed (ok=${String(result.ok)}, exitCode=${String(result.exitCode)}, outcome=${providerOutcome})`,
      code,
    );
  }
  const refusal = refusalSignal(result);
  requireCondition(refusal === null, `forward reviewer: ${refusal}`, "refusal");
  requireCondition(
    typeof result.finalMessage === "string" && result.finalMessage.trim().length > 0,
    "forward reviewer: missing final output",
    "invalid_output",
  );
  try {
    JSON.parse(result.finalMessage);
  } catch (error) {
    throw new ForwardReviewerExecutorError(
      `forward reviewer: schema-bound final output is not JSON (${(error as Error).message})`,
      "invalid_output",
    );
  }
  return result.finalMessage;
}

function defaultSessionId(context: ForwardReviewerSessionContext): string {
  return `forward-${context.request.lane}-${context.nowMs}-${context.sequence}-${randomUUID()}`;
}

/** Create one executor instance. Its local seen-session set prevents a broken
 * injected factory from reusing an identity within the run. */
export function createForwardReviewerExecutor(deps: ForwardReviewerExecutorDeps = {}): ForwardReviewerExecutor {
  const spawn: ForwardReviewerSpawn = deps.spawn ?? spawnCodexAgent;
  const legacySchemaMap: ForwardReviewerSchemaMap = deps.schemaMap ?? DEFAULT_FORWARD_REVIEWER_SCHEMA_MAP;
  const v2SchemaMap: ForwardReviewerSchemaMap = deps.v2SchemaMap ?? deps.schemaMap ?? DEFAULT_FORWARD_REVIEWER_V2_SCHEMA_MAP;
  const clock = deps.clock ?? Date.now;
  const sessionIdFactory = deps.sessionIdFactory ?? defaultSessionId;
  const seenSessionIds = new Set<string>();
  let sequence = 0;

  return async (request): Promise<ForwardReviewExecutionResultV1> => {
    const enforced = snapshotAndValidateRequest(request);
    const schemaMap = enforced.reviewProtocol === "review-evidence-envelope-v1" ? v2SchemaMap : legacySchemaMap;
    const schemaPath = schemaMap[enforced.lane];
    requireCondition(nonEmpty(schemaPath), `forward reviewer: schema map has no explicit path for lane ${enforced.lane}`);
    verifySchemaFile(schemaPath, enforced.schemaSha256, "pre-spawn");

    const reviewerArtifacts: ReviewerArtifact[] = enforced.artifacts.map((artifact) => ({
      kind: artifact.kind,
      relPath: artifact.relPath,
      content: artifact.content,
    }));
    const workspace = buildReviewerWorkspace({
      role: enforced.workspaceRole,
      artifacts: reviewerArtifacts,
      forbiddenStrings: [enforced.model, enforced.profileId],
      ...(deps.workspaceBaseDir ? { baseDir: deps.workspaceBaseDir } : {}),
    });

    try {
      verifyWorkspaceManifest(workspace, enforced.artifacts);
      sequence += 1;
      const nowMs = clock();
      requireCondition(Number.isFinite(nowMs), "forward reviewer: injected clock returned a non-finite value");
      const sessionId = sessionIdFactory({ request: enforced, nowMs, sequence });
      requireCondition(nonEmpty(sessionId), "forward reviewer: sessionIdFactory returned an empty id");
      requireCondition(!seenSessionIds.has(sessionId), `forward reviewer: session id reused: ${sessionId}`);
      seenSessionIds.add(sessionId);

      let result: CodexAgentResult | undefined;
      let spawnError: unknown = null;
      try {
        result = await spawn({
          task: enforced.task,
          sessionId,
          cwd: workspace.dir,
          sandbox: "read-only",
          writableRoots: [],
          skipGitRepoCheck: true,
          timeoutMs: deps.timeoutMs ?? 900_000,
          model: enforced.model,
          reasoningEffort: enforced.effort,
          role: "chapter-reviewer",
          outputSchemaPath: schemaPath,
          ...(deps.manifestSink ? { manifestSink: deps.manifestSink } : {}),
          ...(deps.qualificationCacheDir ? { qualificationCacheDir: deps.qualificationCacheDir } : {}),
          ...(deps.execBaseDir ? { execBaseDir: deps.execBaseDir } : {}),
        });
      } catch (error) {
        spawnError = error;
      }

      const postSpawnErrors: string[] = [];
      try { assertReviewerWorkspaceIntact(workspace); } catch (error) { postSpawnErrors.push((error as Error).message); }
      try { verifySchemaFile(schemaPath, enforced.schemaSha256, "post-spawn"); } catch (error) { postSpawnErrors.push((error as Error).message); }
      requireCondition(
        postSpawnErrors.length === 0,
        `forward reviewer: post-spawn integrity failure:\n- ${postSpawnErrors.join("\n- ")}`,
        "integrity_failure",
      );
      if (spawnError) {
        const message = (spawnError as Error).message;
        const providerOutcome = classifyProviderOutcome({ completed: false, errorMessage: message });
        const classification = (spawnError as Error & { classification?: unknown }).classification;
        throw new ForwardReviewerExecutorError(
          `forward reviewer: codex spawn threw: ${message}`,
          classification === "policy_preflight_failure"
            ? "policy_preflight_failure"
            : providerOutcome === "timeout"
              ? "timeout"
              : "transient_execution_failure",
        );
      }

      const output = validateSpawnResult(result!, sessionId);
      return {
        schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
        executionId: sessionId,
        lane: enforced.lane,
        reviewOperationKey: enforced.reviewOperationKey,
        workspaceRole: enforced.workspaceRole,
        profileId: enforced.profileId,
        model: enforced.model,
        effort: enforced.effort,
        schemaSha256: enforced.schemaSha256,
        instrumentVersion: enforced.instrumentVersion,
        ...(enforced.reviewProtocol ? { reviewProtocol: enforced.reviewProtocol } : {}),
        ...(enforced.evidenceEnvelopeSha256 ? { evidenceEnvelopeSha256: enforced.evidenceEnvelopeSha256 } : {}),
        ...(enforced.evidenceEnvelopeBytesSha256 ? { evidenceEnvelopeBytesSha256: enforced.evidenceEnvelopeBytesSha256 } : {}),
        roleAssignmentSha256: enforced.roleAssignmentSha256,
        instrumentManifestSha256: enforced.instrumentManifestSha256,
        executionProfileHash: enforced.executionProfileHash,
        routePolicyVersion: enforced.routePolicyVersion,
        output,
      };
    } finally {
      workspace.cleanup();
    }
  };
}
