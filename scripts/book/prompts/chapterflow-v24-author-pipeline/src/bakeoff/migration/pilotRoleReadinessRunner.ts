/**
 * s16-forward-pilot-role-readiness-v1 — bounded live readiness runner
 * (plan v2 P5; IMP-24G §5.6–§5.8 execution discipline).
 *
 * The execution core is deliberately model-free and filesystem-free: the
 * campaign boundary supplies the frozen corpus, the launch-minted plan, the
 * candidate instrument bindings, one injected executor, and one injected
 * evaluator. (The one exception is preparePilotReadinessCases, which reads
 * only the frozen lane schema files and the prompt-source module bytes to
 * derive the same schema/prompt identities the certified IMP-24 instrument
 * binds.) Every behavior-affecting input is frozen before the first call and
 * re-hashed before EVERY attempt (V3 runner discipline).
 *
 * Owner-ratified execution rules encoded here:
 * - Sequential stopping as STATUS, never scheduler: reader 2 / source 2 /
 *   quiz 1 ready profiles; later candidates receive zero calls.
 * - Canary gate: both canaries protocol-valid AND semantically correct before
 *   any holdout call; a canary failure means zero holdout calls.
 * - Budget gate (§5.7 / D5): 84 base calls is a HARD ceiling, not a target.
 *   A profile-role whose full qualification (2 canaries + 12 holdouts) cannot
 *   complete inside the remaining base budget is never started
 *   (NOT_TESTED_BUDGET_EXHAUSTED) — partial holdouts can never qualify, so
 *   starting one would only burn authorized calls.
 * - One typed infrastructure replay per attempted call ({timeout,
 *   provider_capacity, transient_execution_failure}); never for judgment,
 *   refusal, protocol error, or content disagreement. Hard ceiling 168.
 * - policy_failure / integrity_failure receipts latch the whole campaign
 *   fatal after their evidence is retained.
 * - Thresholds are the §5.5 verbatim count bars; a metric with a short
 *   denominator (protocol-invalid case) fails closed as underpowered.
 */

import { hashCanonical, sha256Hex } from "../../contracts/contractUtil.js";
import type { ForwardProductionInstrumentSealV1 } from "../../orchestrator/forwardProductionInstrumentSeal.js";
import { computeForwardProductionInstrumentSealSha256 } from "../../orchestrator/forwardProductionInstrumentSeal.js";
import {
  IMP24_ROLE_QUALIFICATION_ID,
  type Imp24ReviewRole,
} from "./imp24Corpus.js";
import {
  rolePromptSourceHashes,
  schemaPathByRole,
} from "./imp24InstrumentCertification.js";
import {
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  assembleQualificationAttemptV3,
  candidateAvailabilityProvenanceSha256,
  candidateAvailabilitySemanticProjectionV3,
  candidateAvailabilitySemanticSha256,
  candidateAvailabilitySha256,
  instrumentCertificationBindingSha256,
  normalizedCandidateAvailabilityReasonCodeV3,
  projectPreparedQualificationCasesV3,
  qualificationRequestSha256,
  type CandidateAvailabilityV3,
  type InstrumentCertificationBindingV3,
  type PreparedQualificationCaseV3,
  type PreparedQualificationCasesV3,
  type QualificationAttemptV3,
  type QualificationExecutionRequestV3,
  type QualificationExecutorV3,
  type QualificationOutputEvaluatorV3,
} from "./roleQualificationRunnerV3.js";
import {
  compilePilotReadinessCaseInstrument,
} from "./pilotRoleReadinessEvaluator.js";
import {
  PILOT_READINESS_BUDGET,
  PILOT_READINESS_CANDIDATE_ORDERS,
  PILOT_READINESS_METRIC_SEMANTICS,
  PILOT_READINESS_STOPPING,
  PILOT_READINESS_THRESHOLDS,
  PILOT_ROLE_READINESS_EXPERIMENT_ID,
  type PilotRoleReadinessCorpusV1,
  type PilotRoleReadinessPlanV1,
  type ReadinessCaseV1,
  type ReadinessCountBar,
  type ReadinessProfile,
} from "./pilotRoleReadinessInstrument.js";

import { readFileSync } from "node:fs";

export const PILOT_READINESS_FREEZE_SCHEMA = "pilot-role-readiness-freeze-v1" as const;
export const PILOT_READINESS_RUNNER_RESULT_SCHEMA = "pilot-role-readiness-runner-result-v1" as const;
export const PILOT_READINESS_MAX_PARALLEL = 2 as const;
export const PILOT_READINESS_CANARY_CALLS = 2 as const;
export const PILOT_READINESS_HOLDOUT_CALLS = 12 as const;
/** Full qualification cost of one profile-role (canaries + holdout). */
export const PILOT_READINESS_PROFILE_ROLE_CALLS = 14 as const;

const ROLES = ["reader", "source", "quiz"] as const satisfies readonly Imp24ReviewRole[];
const SHA256 = /^[a-f0-9]{64}$/;
/** Conductor-owned metric identities the injected evaluator may never emit. */
const CONDUCTOR_OWNED_METRICS = new Set([
  "protocolValidity",
  "canarySemanticCorrectness",
  "requiredCasesResolved",
  "missingEvidenceInconclusive",
]);
/** Mirrors the V3 runner's frozen forbidden-task scan (self-contained inline
 * instrument only; no filesystem navigation, no private paths). */
const FORBIDDEN_TASK_TEXT = /\b(?:file is at|read (?:only )?this file|open (?:the )?file|use (?:the )?(?:filesystem|shell)\s+to|inspect (?:the )?(?:workspace|path))\b|\/(?:Users|home)\/|(?:^|\s)(?:\.\.?\/)[^\s]+/i;

export class PilotRoleReadinessRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PilotRoleReadinessRunnerError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PilotRoleReadinessRunnerError(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

// ── Availability (readiness-stamped projection of the frozen discovery) ─────

export type ReadinessCandidateAvailabilityV1 = Omit<CandidateAvailabilityV3, "experimentId"> & {
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
};

/** Re-stamp the frozen local-cache discovery under the readiness experiment
 * identity. The semantic and provenance projections deliberately exclude the
 * experiment id, so only the legacy full-snapshot self hash is recomputed. */
export function stampReadinessCandidateAvailability(
  discovered: CandidateAvailabilityV3,
): ReadinessCandidateAvailabilityV1 {
  const { availabilitySha256: _legacy, ...rest } = discovered;
  const draft = { ...rest, experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID };
  return Object.freeze({ ...draft, availabilitySha256: candidateAvailabilitySha256(draft) });
}

function validateReadinessAvailability(availability: ReadinessCandidateAvailabilityV1): void {
  requireCondition(availability.experimentId === PILOT_ROLE_READINESS_EXPERIMENT_ID,
    "candidate availability belongs to another execution");
  requireCondition(availability.source === "codex-local-models-cache",
    "candidate availability must derive from the local Codex models cache");
  requireSha(availability.sourceBytesSha256, "candidate availability source hash");
  requireSha(availability.policyBytesSha256, "candidate availability policy hash");
  requireCondition(Number.isFinite(Date.parse(availability.sourceFetchedAt)),
    "candidate availability timestamp is invalid");
  // The frozen readiness orders (§5.6) must be content-identical to the frozen
  // discovery order the availability snapshot was derived under. Divergence of
  // either constant fails the whole campaign closed.
  requireCondition(hashCanonical(PILOT_READINESS_CANDIDATE_ORDERS) === availability.candidateOrderSha256
      && hashCanonical(IMP24_ROLE_CANDIDATE_ORDER) === availability.candidateOrderSha256,
    "candidate availability order hash differs from the frozen §5.6 readiness orders");
  const expected = ROLES.flatMap((role) =>
    PILOT_READINESS_CANDIDATE_ORDERS[role].map((candidate, ordinal) => ({ role, ordinal, ...candidate })));
  requireCondition(availability.entries.length === expected.length,
    "candidate availability entry count differs from the frozen order");
  expected.forEach((target, index) => {
    const entry = availability.entries[index];
    requireCondition(entry?.role === target.role && entry.ordinal === target.ordinal
        && entry.profileId === target.profileId && entry.model === target.model
        && entry.effort === target.effort,
      `candidate availability entry ${index} reordered or changed`);
    const derived = entry.modelListed && entry.visible && entry.effortSupported ? "AVAILABLE" : "UNAVAILABLE";
    requireCondition(entry.status === derived,
      `candidate availability status does not derive for ${entry.profileId}`);
    requireCondition(entry.reasonCode === normalizedCandidateAvailabilityReasonCodeV3(entry),
      `candidate availability reason code does not derive for ${entry.profileId}`);
    requireCondition(typeof entry.reason === "string" && entry.reason.trim().length > 0,
      `candidate availability reason missing for ${entry.profileId}`);
  });
  requireCondition(typeof availability.sourceFile === "string" && availability.sourceFile.trim().length > 0,
    "candidate availability source file is missing");
  requireCondition(typeof availability.sourceQualifiedAt === "string"
      && Number.isFinite(Date.parse(availability.sourceQualifiedAt)),
    "candidate availability qualification timestamp is invalid");
  requireCondition(typeof availability.sourceAgeSeconds === "number"
      && Number.isFinite(availability.sourceAgeSeconds),
    "candidate availability cache age is invalid");
  requireCondition(typeof availability.cliVersion === "string" && availability.cliVersion.trim().length > 0,
    "candidate availability CLI version is missing");
  requireSha(availability.semanticSha256, "candidate availability semantic hash");
  requireSha(availability.provenanceSha256, "candidate availability provenance hash");
  requireCondition(candidateAvailabilitySemanticSha256(availability) === availability.semanticSha256,
    "candidate availability semantic hash mismatch");
  requireCondition(candidateAvailabilityProvenanceSha256(availability as unknown as CandidateAvailabilityV3)
      === availability.provenanceSha256,
    "candidate availability provenance hash mismatch");
  const { availabilitySha256, ...draft } = availability;
  requireCondition(candidateAvailabilitySha256(draft) === availabilitySha256,
    "candidate availability hash mismatch");
}

// ── Prepared cases ───────────────────────────────────────────────────────────

export type PreparedReadinessCasesV1 = PreparedQualificationCasesV3;

/** Compile every frozen readiness case into a prepared inline instrument.
 * Deterministic; the evaluator recompiles independently at judgment time. */
export function preparePilotReadinessCases(args: {
  repositoryRoot: string;
  corpus: PilotRoleReadinessCorpusV1;
}): {
  schemaHashes: Record<Imp24ReviewRole, string>;
  promptSourceHashes: Record<Imp24ReviewRole, string>;
  preparedCases: PreparedReadinessCasesV1;
} {
  const schemaPaths = schemaPathByRole(args.repositoryRoot);
  const schemaHashes: Record<Imp24ReviewRole, string> = {
    reader: sha256Hex(readFileSync(schemaPaths.reader)),
    source: sha256Hex(readFileSync(schemaPaths.source)),
    quiz: sha256Hex(readFileSync(schemaPaths.quiz)),
  };
  const promptSourceHashes = rolePromptSourceHashes(args.repositoryRoot);
  const preparedCases = {
    reader: { canary: [] as PreparedQualificationCaseV3[], holdout: [] as PreparedQualificationCaseV3[] },
    source: { canary: [] as PreparedQualificationCaseV3[], holdout: [] as PreparedQualificationCaseV3[] },
    quiz: { canary: [] as PreparedQualificationCaseV3[], holdout: [] as PreparedQualificationCaseV3[] },
  };
  for (const role of ROLES) {
    for (const partition of ["canary", "holdout"] as const) {
      for (const entry of args.corpus[role][partition]) {
        requireCondition(entry.role === role && entry.partition === partition,
          `${entry.caseId}: corpus role/partition binding mismatch`);
        const compiled = compilePilotReadinessCaseInstrument(entry);
        assertReadinessTask(compiled.task, compiled.evidenceEnvelopeBytes, entry.caseId);
        preparedCases[role][partition].push({
          role,
          partition,
          caseId: entry.caseId,
          family: entry.category,
          sourceCaseSha256: compiled.sourceCaseSha256,
          goldSha256: hashCanonical(compiled.gold),
          schemaSha256: schemaHashes[role],
          promptSourceSha256: promptSourceHashes[role],
          task: compiled.task,
          envelope: compiled.envelope,
          evidenceEnvelopeBytes: compiled.evidenceEnvelopeBytes,
          evidenceEnvelopeBytesSha256: sha256Hex(compiled.evidenceEnvelopeBytes),
        });
      }
    }
  }
  return { schemaHashes, promptSourceHashes, preparedCases: preparedCases as PreparedReadinessCasesV1 };
}

function assertReadinessTask(task: string, envelopeBytes: string, caseId: string): void {
  requireCondition(task.includes(envelopeBytes), `${caseId}: complete evidence envelope is not inline in task`);
  requireCondition(task.includes("All evidence required for this review is included below."),
    `${caseId}: inline evidence instruction missing`);
  requireCondition(task.includes("Do not use filesystem, shell, network, or external tools."),
    `${caseId}: no-tool instruction missing`);
  requireCondition(task.includes("Judge only the inline evidence envelope."),
    `${caseId}: inline-only instruction missing`);
  requireCondition(!FORBIDDEN_TASK_TEXT.test(task), `${caseId}: task contains file/path navigation instructions`);
}

// ── Input / freeze / schedule ────────────────────────────────────────────────

export type RunPilotRoleReadinessInputV1 = {
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  corpus: PilotRoleReadinessCorpusV1;
  plan: PilotRoleReadinessPlanV1;
  /** Raw retained plan file bytes hash (bind-once launch artifact). */
  planBytesSha256: string;
  certification: InstrumentCertificationBindingV3;
  certificationRawBytesSha256: string;
  productionInstrumentSeal: ForwardProductionInstrumentSealV1;
  productionInstrumentSealRawBytesSha256: string;
  candidateAvailability: ReadinessCandidateAvailabilityV1;
  schemaHashes: Record<Imp24ReviewRole, string>;
  promptSourceHashes: Record<Imp24ReviewRole, string>;
  preparedCases: PreparedReadinessCasesV1;
};

export type ReadinessScheduleEntryV1 = {
  scheduleId: string;
  ordinal: number;
  role: Imp24ReviewRole;
  candidateOrdinal: number;
  profileId: string;
  partition: "canary" | "holdout";
  caseOrdinal: number;
  caseId: string;
  category: string;
  sourceCaseSha256: string;
  goldSha256: string;
  schemaSha256: string;
  promptSourceSha256: string;
  evidenceEnvelopeSha256: string;
  evidenceEnvelopeBytesSha256: string;
  taskSha256: string;
};

export type PilotRoleReadinessFreezeV1 = {
  schema: typeof PILOT_READINESS_FREEZE_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  corpusSha256: string;
  corpusSnapshotSha256: string;
  planSha256: string;
  planSnapshotSha256: string;
  planBytesSha256: string;
  thresholdsSha256: string;
  metricSemanticsSha256: string;
  candidateOrdersSha256: string;
  stoppingSha256: string;
  budgetSha256: string;
  candidateAvailabilitySemanticSha256: string;
  candidateAvailabilitySnapshotSha256: string;
  certificationSha256: string;
  certificationSnapshotSha256: string;
  certificationRawBytesSha256: string;
  productionInstrumentSealSha256: string;
  productionInstrumentSealSnapshotSha256: string;
  productionInstrumentSealRawBytesSha256: string;
  schemaHashesSha256: string;
  promptSourceHashesSha256: string;
  preparedCasesSha256: string;
  scheduleSha256: string;
  maxParallel: typeof PILOT_READINESS_MAX_PARALLEL;
  baseMaximumCalls: number;
  hardMaximumCalls: number;
  freezeSha256: string;
};

export type PilotReadinessExecutionRequestV1 = Omit<QualificationExecutionRequestV3, "experimentId"> & {
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
};

export function buildPilotReadinessSchedule(
  preparedCases: PreparedReadinessCasesV1,
): ReadinessScheduleEntryV1[] {
  const schedule: ReadinessScheduleEntryV1[] = [];
  let ordinal = 0;
  for (const role of ROLES) {
    PILOT_READINESS_CANDIDATE_ORDERS[role].forEach((candidate, candidateOrdinal) => {
      for (const partition of ["canary", "holdout"] as const) {
        preparedCases[role][partition].forEach((item, caseOrdinal) => {
          schedule.push({
            scheduleId: `rdy-${role}-p${candidateOrdinal + 1}-${partition}-c${String(caseOrdinal + 1).padStart(2, "0")}`,
            ordinal: ordinal++,
            role,
            candidateOrdinal,
            profileId: candidate.profileId,
            partition,
            caseOrdinal,
            caseId: item.caseId,
            category: item.family,
            sourceCaseSha256: item.sourceCaseSha256,
            goldSha256: item.goldSha256,
            schemaSha256: item.schemaSha256,
            promptSourceSha256: item.promptSourceSha256,
            evidenceEnvelopeSha256: item.envelope.envelopeSha256,
            evidenceEnvelopeBytesSha256: item.evidenceEnvelopeBytesSha256,
            taskSha256: sha256Hex(item.task),
          });
        });
      }
    });
  }
  // Full enumeration is 4 profiles x 14 cases x 3 roles = 168 entries. This
  // deliberately EXCEEDS the 84-call base ceiling: sequential stopping plus
  // the block-level budget gate decide which entries ever execute. (168 also
  // equals the hard replay ceiling by arithmetic coincidence only.)
  requireCondition(schedule.length === 168,
    `frozen readiness schedule must enumerate 168 candidate-case pairs (got ${schedule.length})`);
  return schedule;
}

function validateCorpus(corpus: PilotRoleReadinessCorpusV1): void {
  requireCondition(corpus.schema === "pilot-role-readiness-corpus-v1"
      && corpus.experimentId === PILOT_ROLE_READINESS_EXPERIMENT_ID
      && corpus.objective === "PILOT_ROLE_READINESS",
    "readiness corpus identity mismatch");
  const { corpusSha256, ...core } = corpus;
  requireCondition(hashCanonical(core) === corpusSha256, "readiness corpus self hash mismatch");
  const categoryCounts = (cases: ReadinessCaseV1[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const entry of cases) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    return counts;
  };
  for (const role of ROLES) {
    requireCondition(corpus[role].canary.length === PILOT_READINESS_CANARY_CALLS
        && corpus[role].holdout.length === PILOT_READINESS_HOLDOUT_CALLS,
      `${role} corpus counts drifted`);
  }
  const readerCounts = categoryCounts(corpus.reader.holdout);
  requireCondition(readerCounts.get("acceptable-control") === 4
      && readerCounts.get("reader-visible-hard-blocker") === 4
      && readerCounts.get("craft-nonblocker") === 4,
    "reader holdout category mix drifted from 4/4/4");
  const sourceClean = corpus.source.holdout.filter((entry) => entry.category === "supported-source-bound").length;
  requireCondition(sourceClean === 2 && corpus.source.holdout.length - sourceClean === 10,
    "source holdout clean/defect mix drifted from 2/10");
  const quizCounts = categoryCounts(corpus.quiz.holdout);
  for (const kind of ["uniquely-correct-clean", "key-mismatch", "genuine-ambiguity", "mechanism-causal-key"]) {
    requireCondition(quizCounts.get(kind) === 3, `quiz holdout kind mix drifted for ${kind}`);
  }
}

function validatePlan(input: RunPilotRoleReadinessInputV1): void {
  const plan = input.plan;
  requireCondition(plan.schema === "pilot-role-readiness-plan-v1"
      && plan.experimentId === PILOT_ROLE_READINESS_EXPERIMENT_ID
      && plan.objective === "PILOT_ROLE_READINESS",
    "readiness plan identity mismatch");
  const { planSha256, ...core } = plan;
  requireCondition(hashCanonical(core) === planSha256, "readiness plan self hash mismatch");
  requireSha(input.planBytesSha256, "retained plan bytes hash");
  requireCondition(plan.corpusSha256 === input.corpus.corpusSha256, "plan is bound to a different corpus");
  requireCondition(hashCanonical(plan.thresholds) === hashCanonical(PILOT_READINESS_THRESHOLDS)
      && plan.thresholdsSha256 === hashCanonical(PILOT_READINESS_THRESHOLDS),
    "readiness thresholds changed or were weakened");
  requireCondition(hashCanonical(plan.metricSemantics) === hashCanonical(PILOT_READINESS_METRIC_SEMANTICS),
    "readiness metric semantics drifted");
  requireCondition(hashCanonical(plan.candidateOrders) === hashCanonical(PILOT_READINESS_CANDIDATE_ORDERS)
      && plan.candidateOrdersSha256 === hashCanonical(PILOT_READINESS_CANDIDATE_ORDERS),
    "readiness candidate orders drifted");
  requireCondition(hashCanonical(plan.stopping) === hashCanonical(PILOT_READINESS_STOPPING),
    "readiness stopping rule drifted");
  requireCondition(hashCanonical(plan.budget) === hashCanonical(PILOT_READINESS_BUDGET),
    "readiness budget drifted");
  requireCondition(plan.canaryGate.requiredCorrect === 2, "readiness canary gate weakened");
  requireCondition(plan.bindings.readerDecisionPolicy === "reader-decision-policy-v3"
      && plan.bindings.aggregatePolicy === "aggregate-chapter-review-policy-v2",
    "readiness decision-policy bindings drifted");
  requireCondition(plan.bindings.candidateSealRawSha256 === input.productionInstrumentSealRawBytesSha256,
    "candidate instrument seal was re-minted after the plan freeze — mint a fresh plan identity");
  requireCondition(plan.bindings.candidateCertificationRawSha256 === input.certificationRawBytesSha256,
    "candidate instrument certification was re-minted after the plan freeze — mint a fresh plan identity");
}

function validateCertification(certification: InstrumentCertificationBindingV3): void {
  requireCondition(certification.schema === "imp24-instrument-certification-binding-v1",
    "candidate instrument certification schema mismatch");
  requireCondition(certification.status === "CERTIFIED_MODEL_FREE",
    "live readiness requires CERTIFIED_MODEL_FREE");
  requireCondition(certification.sourceMissingEvidenceInconclusiveCertified === true,
    "certification did not prove source missing-evidence INCONCLUSIVE behavior");
  requireCondition(certification.experimentId === IMP24_ROLE_QUALIFICATION_ID,
    "certification belongs to another experiment");
  const { certificationSha256, ...draft } = certification;
  requireSha(certificationSha256, "certificationSha256");
  requireCondition(instrumentCertificationBindingSha256(draft) === certificationSha256,
    "instrument certification hash mismatch");
  requireCondition(certification.independentAuditPasses === 2
      && certification.modelCalls === 0 && certification.apiCalls === 0,
    "instrument certification must be two-pass model/API free");
}

function validateProductionSeal(seal: ForwardProductionInstrumentSealV1): void {
  requireCondition(seal?.schema === "forward-production-instrument-seal-v1" && seal.version === 1,
    "production instrument seal schema/version mismatch");
  requireSha(seal.sealSha256, "production instrument seal");
  requireCondition(computeForwardProductionInstrumentSealSha256(seal) === seal.sealSha256,
    "production instrument seal self hash mismatch");
  requireCondition(seal.capabilities.publish === false && seal.capabilities.promote === false
      && seal.capabilities.deploy === false && seal.capabilities.upload === false
      && seal.capabilities.api === false,
    "production instrument seal exposes a prohibited capability");
}

function validatePreparedAgainstCorpus(input: RunPilotRoleReadinessInputV1): void {
  for (const role of ROLES) {
    requireSha(input.schemaHashes[role], `${role} schema hash`);
    requireSha(input.promptSourceHashes[role], `${role} prompt source hash`);
    for (const partition of ["canary", "holdout"] as const) {
      const prepared = input.preparedCases[role][partition];
      const corpusCases = input.corpus[role][partition];
      requireCondition(prepared.length === corpusCases.length,
        `${role} ${partition} prepared count differs from the frozen corpus`);
      prepared.forEach((item, index) => {
        const entry = corpusCases[index];
        requireCondition(item.caseId === entry.caseId && item.family === entry.category,
          `${role} ${partition} prepared case ${index} differs from frozen corpus order`);
        const compiled = compilePilotReadinessCaseInstrument(entry);
        requireCondition(item.sourceCaseSha256 === compiled.sourceCaseSha256,
          `${item.caseId}: prepared source-case binding mismatch`);
        requireCondition(item.goldSha256 === hashCanonical(compiled.gold),
          `${item.caseId}: prepared gold hash mismatch`);
        requireCondition(item.schemaSha256 === input.schemaHashes[role]
            && item.promptSourceSha256 === input.promptSourceHashes[role],
          `${item.caseId}: prepared schema/prompt binding mismatch`);
        requireCondition(item.envelope.envelopeSha256 === compiled.envelope.envelopeSha256
            && item.evidenceEnvelopeBytes === compiled.evidenceEnvelopeBytes
            && item.evidenceEnvelopeBytesSha256 === sha256Hex(compiled.evidenceEnvelopeBytes)
            && item.task === compiled.task,
          `${item.caseId}: prepared instrument differs from the deterministic compiler output`);
        assertReadinessTask(item.task, item.evidenceEnvelopeBytes, item.caseId);
      });
    }
  }
}

function buildFreeze(
  input: RunPilotRoleReadinessInputV1,
  schedule: ReadinessScheduleEntryV1[],
): PilotRoleReadinessFreezeV1 {
  const draft = {
    schema: PILOT_READINESS_FREEZE_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    corpusSha256: input.corpus.corpusSha256,
    corpusSnapshotSha256: hashCanonical(input.corpus),
    planSha256: input.plan.planSha256,
    planSnapshotSha256: hashCanonical(input.plan),
    planBytesSha256: input.planBytesSha256,
    thresholdsSha256: hashCanonical(PILOT_READINESS_THRESHOLDS),
    metricSemanticsSha256: hashCanonical(PILOT_READINESS_METRIC_SEMANTICS),
    candidateOrdersSha256: hashCanonical(PILOT_READINESS_CANDIDATE_ORDERS),
    stoppingSha256: hashCanonical(PILOT_READINESS_STOPPING),
    budgetSha256: hashCanonical(PILOT_READINESS_BUDGET),
    // Bind the SEMANTIC availability projection only. Cache timestamps, CLI
    // provenance, and raw cache bytes may legitimately refresh across a
    // resume; the behavior-affecting ordered-candidate state may not.
    candidateAvailabilitySemanticSha256: candidateAvailabilitySemanticSha256(input.candidateAvailability),
    candidateAvailabilitySnapshotSha256: hashCanonical(candidateAvailabilitySemanticProjectionV3(input.candidateAvailability)),
    certificationSha256: input.certification.certificationSha256,
    certificationSnapshotSha256: hashCanonical(input.certification),
    certificationRawBytesSha256: input.certificationRawBytesSha256,
    productionInstrumentSealSha256: input.productionInstrumentSeal.sealSha256,
    productionInstrumentSealSnapshotSha256: hashCanonical(input.productionInstrumentSeal),
    productionInstrumentSealRawBytesSha256: input.productionInstrumentSealRawBytesSha256,
    schemaHashesSha256: hashCanonical(input.schemaHashes),
    promptSourceHashesSha256: hashCanonical(input.promptSourceHashes),
    preparedCasesSha256: hashCanonical(projectPreparedQualificationCasesV3(input.preparedCases)),
    scheduleSha256: hashCanonical(schedule),
    maxParallel: PILOT_READINESS_MAX_PARALLEL,
    baseMaximumCalls: PILOT_READINESS_BUDGET.baseMaximumCalls,
    hardMaximumCalls: PILOT_READINESS_BUDGET.hardMaximumCalls,
  } as const;
  return Object.freeze({ ...draft, freezeSha256: hashCanonical(draft) });
}

export function assertFrozenReadinessInput(
  input: RunPilotRoleReadinessInputV1,
  freeze: PilotRoleReadinessFreezeV1,
): void {
  requireCondition(input.experimentId === PILOT_ROLE_READINESS_EXPERIMENT_ID,
    "readiness execution identity drifted");
  requireCondition(input.corpus.corpusSha256 === freeze.corpusSha256
      && hashCanonical(input.corpus) === freeze.corpusSnapshotSha256,
    "readiness corpus changed after freeze");
  requireCondition(input.plan.planSha256 === freeze.planSha256
      && hashCanonical(input.plan) === freeze.planSnapshotSha256
      && input.planBytesSha256 === freeze.planBytesSha256,
    "readiness plan changed after freeze");
  requireCondition(hashCanonical(PILOT_READINESS_THRESHOLDS) === freeze.thresholdsSha256,
    "readiness thresholds changed after the first live call");
  requireCondition(hashCanonical(PILOT_READINESS_CANDIDATE_ORDERS) === freeze.candidateOrdersSha256,
    "readiness candidate orders changed after freeze");
  requireCondition(hashCanonical(PILOT_READINESS_STOPPING) === freeze.stoppingSha256
      && hashCanonical(PILOT_READINESS_BUDGET) === freeze.budgetSha256,
    "readiness stopping/budget changed after freeze");
  requireCondition(candidateAvailabilitySemanticSha256(input.candidateAvailability)
        === freeze.candidateAvailabilitySemanticSha256
      && hashCanonical(candidateAvailabilitySemanticProjectionV3(input.candidateAvailability))
        === freeze.candidateAvailabilitySnapshotSha256,
    "candidate availability semantics changed after freeze");
  requireCondition(input.certification.certificationSha256 === freeze.certificationSha256
      && hashCanonical(input.certification) === freeze.certificationSnapshotSha256
      && input.certificationRawBytesSha256 === freeze.certificationRawBytesSha256,
    "instrument certification changed after freeze");
  requireCondition(input.productionInstrumentSeal.sealSha256 === freeze.productionInstrumentSealSha256
      && hashCanonical(input.productionInstrumentSeal) === freeze.productionInstrumentSealSnapshotSha256
      && input.productionInstrumentSealRawBytesSha256 === freeze.productionInstrumentSealRawBytesSha256,
    "production instrument seal changed after freeze");
  requireCondition(hashCanonical(input.schemaHashes) === freeze.schemaHashesSha256
      && hashCanonical(input.promptSourceHashes) === freeze.promptSourceHashesSha256,
    "schemas/prompts changed after the first live call");
  requireCondition(hashCanonical(projectPreparedQualificationCasesV3(input.preparedCases))
      === freeze.preparedCasesSha256,
    "prepared readiness instruments changed after the first live call");
}

export function buildPilotRoleReadinessPlanForExecution(input: RunPilotRoleReadinessInputV1): {
  freeze: PilotRoleReadinessFreezeV1;
  schedule: ReadinessScheduleEntryV1[];
} {
  requireCondition(input.experimentId === PILOT_ROLE_READINESS_EXPERIMENT_ID,
    "wrong readiness execution identity");
  validateCorpus(input.corpus);
  validatePlan(input);
  validateCertification(input.certification);
  validateProductionSeal(input.productionInstrumentSeal);
  validateReadinessAvailability(input.candidateAvailability);
  validatePreparedAgainstCorpus(input);
  const schedule = buildPilotReadinessSchedule(input.preparedCases);
  const freeze = buildFreeze(input, schedule);
  assertFrozenReadinessInput(input, freeze);
  return { freeze, schedule };
}

// ── Execution ────────────────────────────────────────────────────────────────

export function buildPilotReadinessExecutionRequest(
  entry: ReadinessScheduleEntryV1,
  prepared: PreparedQualificationCaseV3,
  candidate: ReadinessProfile,
  freeze: PilotRoleReadinessFreezeV1,
  attemptNumber: 1 | 2,
  replayOfAttemptId: string | null,
): PilotReadinessExecutionRequestV1 {
  const attemptId = `${entry.scheduleId}-a${attemptNumber}`;
  const core = {
    schema: IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    scheduleId: entry.scheduleId,
    attemptId,
    replayOfAttemptId,
    attemptNumber,
    role: entry.role,
    partition: entry.partition,
    caseId: entry.caseId,
    family: entry.category,
    profileId: candidate.profileId,
    model: candidate.model,
    effort: candidate.effort,
    schemaSha256: entry.schemaSha256,
    promptSourceSha256: entry.promptSourceSha256,
    goldSha256: entry.goldSha256,
    sourceCaseSha256: entry.sourceCaseSha256,
    freezeSha256: freeze.freezeSha256,
    certificationSha256: freeze.certificationSha256,
    productionInstrumentSealSha256: freeze.productionInstrumentSealSha256,
    reviewProtocol: "review-evidence-envelope-v1" as const,
    evidenceEnvelopeSha256: prepared.envelope.envelopeSha256,
    evidenceEnvelopeBytesSha256: prepared.evidenceEnvelopeBytesSha256,
    evidenceEnvelopeBytes: prepared.evidenceEnvelopeBytes,
    task: prepared.task,
  };
  const requestSha256 = qualificationRequestSha256(core as unknown as Parameters<typeof qualificationRequestSha256>[0]);
  return Object.freeze({ ...core, requestSha256 }) as PilotReadinessExecutionRequestV1;
}

type ReadinessFatalLatch = { tripped: boolean; error: unknown };

function tripFatalLatch(latch: ReadinessFatalLatch, error: unknown): void {
  if (!latch.tripped) {
    latch.tripped = true;
    latch.error = error;
  }
}

function throwIfFatal(latch: ReadinessFatalLatch): void {
  if (latch.tripped) throw latch.error;
}

/** Bounded fail-closed pool (V3 runner discipline): once any worker reports a
 * fatal runner/retention error no worker may pull another item; in-flight
 * calls drain so their evidence retention completes, then the pool rethrows. */
async function mapPool<T, R>(
  items: readonly T[],
  maxParallel: number,
  fatalLatch: ReadinessFatalLatch,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(maxParallel, items.length || 1)) }, async () => {
    while (true) {
      throwIfFatal(fatalLatch);
      const index = next++;
      if (index >= items.length) return;
      try {
        output[index] = await fn(items[index]);
      } catch (error) {
        tripFatalLatch(fatalLatch, error);
        throw error;
      }
    }
  });
  await Promise.allSettled(workers);
  throwIfFatal(fatalLatch);
  return output;
}

export type RunPilotRoleReadinessDepsV1 = {
  executor: QualificationExecutorV3;
  evaluateOutput: QualificationOutputEvaluatorV3;
  /** Official live campaigns persist this callback's full evaluation before
   * continuing. Pure/model-free tests may omit it. */
  retainAttemptEvaluation?: (attempt: QualificationAttemptV3) => void | Promise<void>;
};

async function runScheduledReadinessCase(args: {
  input: RunPilotRoleReadinessInputV1;
  freeze: PilotRoleReadinessFreezeV1;
  entry: ReadinessScheduleEntryV1;
  preparedCase: PreparedQualificationCaseV3;
  candidate: ReadinessProfile;
  deps: RunPilotRoleReadinessDepsV1;
  attempts: QualificationAttemptV3[];
  fatalLatch: ReadinessFatalLatch;
}): Promise<QualificationAttemptV3> {
  let replayOfAttemptId: string | null = null;
  let finalAttempt: QualificationAttemptV3 | null = null;
  for (const attemptNumber of [1, 2] as const) {
    throwIfFatal(args.fatalLatch);
    assertFrozenReadinessInput(args.input, args.freeze);
    const request = buildPilotReadinessExecutionRequest(
      args.entry, args.preparedCase, args.candidate, args.freeze, attemptNumber, replayOfAttemptId,
    );
    let receipt = null;
    let thrown: string | null = null;
    try {
      receipt = await args.deps.executor(request as unknown as QualificationExecutionRequestV3);
    } catch (error) {
      thrown = (error as Error).message;
    }
    const attempt = assembleQualificationAttemptV3({
      scheduleOrdinal: args.entry.ordinal,
      preparedCase: args.preparedCase,
      request: request as unknown as QualificationExecutionRequestV3,
      receipt,
      evaluateOutput: args.deps.evaluateOutput,
      thrown,
    });
    if (args.deps.retainAttemptEvaluation) {
      try {
        await args.deps.retainAttemptEvaluation(attempt);
      } catch (error) {
        tripFatalLatch(args.fatalLatch, error);
        throw error;
      }
    }
    args.attempts.push(attempt);
    finalAttempt = attempt;
    // Policy and execution-integrity failures are conductor/trust failures,
    // never profile judgments: retain the evidence, then stop the campaign.
    if (receipt?.status === "policy_failure" || receipt?.status === "integrity_failure") {
      const fatal = new PilotRoleReadinessRunnerError(
        `${request.attemptId}: campaign-fatal ${receipt.status} receipt; retained evidence must be diagnosed before any further readiness call`,
      );
      tripFatalLatch(args.fatalLatch, fatal);
      throw fatal;
    }
    if (attemptNumber === 1 && attempt.replayEligible) {
      replayOfAttemptId = request.attemptId;
      continue;
    }
    break;
  }
  requireCondition(finalAttempt !== null, `${args.entry.scheduleId} produced no attempt`);
  return finalAttempt;
}

// ── Scoring (§5.5 verbatim count bars) ───────────────────────────────────────

export type ReadinessMetricCountsV1 = Record<string, { numerator: number; denominator: number }>;

export function scoreReadinessHoldout(
  role: Imp24ReviewRole,
  attempts: readonly QualificationAttemptV3[],
): ReadinessMetricCountsV1 {
  const counts: ReadinessMetricCountsV1 = {};
  const increment = (metricId: string, success: boolean): void => {
    const counter = counts[metricId] ?? { numerator: 0, denominator: 0 };
    counter.denominator += 1;
    if (success) counter.numerator += 1;
    counts[metricId] = counter;
  };
  const allowed = new Set(Object.keys(PILOT_READINESS_THRESHOLDS[role]));
  for (const attempt of attempts) {
    const evaluation = attempt.evaluation;
    const valid = attempt.protocolValid;
    increment("protocolValidity", valid);
    increment("requiredCasesResolved", valid && evaluation?.resolved === true);
    for (const [metricId, success] of Object.entries(evaluation?.metricObservations ?? {})) {
      requireCondition(!CONDUCTOR_OWNED_METRICS.has(metricId),
        `${attempt.request.caseId}: evaluator may not override conductor-owned metric ${metricId}`);
      requireCondition(allowed.has(metricId),
        `${attempt.request.caseId}: evaluator emitted unknown ${role} metric ${metricId}`);
      requireCondition(typeof success === "boolean",
        `${attempt.request.caseId}: metric ${metricId} is not boolean`);
      increment(metricId, success);
    }
  }
  // The candidate instrument's model-free certification proved that absent
  // required source evidence assembles as INCONCLUSIVE before any reviewer
  // spawn (sourceMissingEvidenceInconclusiveCertified, asserted at plan
  // build). Record that certified result exactly once per tested source
  // profile; it is not a live case and consumes no call or replay.
  if (role === "source") increment("missingEvidenceInconclusive", true);
  return counts;
}

export type ReadinessRoleOutcomeV1 = {
  role: Imp24ReviewRole;
  status: "READY" | "NOT_QUALIFIED";
  failedThresholds: string[];
  counts: ReadinessMetricCountsV1;
};

export function qualifyReadinessRole(
  role: Imp24ReviewRole,
  counts: ReadinessMetricCountsV1,
): ReadinessRoleOutcomeV1 {
  const failed: string[] = [];
  const bars = PILOT_READINESS_THRESHOLDS[role] as Record<string, ReadinessCountBar>;
  for (const [metricId, bar] of Object.entries(bars)) {
    const observed = counts[metricId] ?? { numerator: 0, denominator: 0 };
    if (observed.denominator !== bar.of) {
      failed.push(`${metricId}:underpowered(${observed.denominator}/${bar.of})`);
      continue;
    }
    const required = bar.zeroMiss ? bar.of : bar.min;
    if (observed.numerator < required) {
      failed.push(`${metricId}(${observed.numerator}/${bar.of}<${required})`);
    }
  }
  return {
    role,
    status: failed.length === 0 ? "READY" : "NOT_QUALIFIED",
    failedThresholds: failed.sort(),
    counts,
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────

export type ReadinessProfileRoleStatusV1 =
  | "UNAVAILABLE"
  | "NOT_TESTED_SEQUENTIAL_STOP"
  | "NOT_TESTED_BUDGET_EXHAUSTED"
  | "NOT_QUALIFIED_PROTOCOL"
  | "NOT_QUALIFIED_CANARY"
  | "NOT_QUALIFIED"
  | "READY";

export type ReadinessProfileRoleResultV1 = {
  role: Imp24ReviewRole;
  candidateOrdinal: number;
  profile: ReadinessProfile;
  availability: "AVAILABLE" | "UNAVAILABLE";
  status: ReadinessProfileRoleStatusV1;
  canaryStarted: boolean;
  canaryProtocolPassed: boolean;
  canarySemanticCorrectCount: number;
  holdoutStarted: boolean;
  holdoutCaseCount: number;
  attempts: number;
  outcome: ReadinessRoleOutcomeV1 | null;
};

export type PilotRoleReadinessRunnerResultV1 = {
  schema: typeof PILOT_READINESS_RUNNER_RESULT_SCHEMA;
  experimentId: typeof PILOT_ROLE_READINESS_EXPERIMENT_ID;
  freeze: Readonly<PilotRoleReadinessFreezeV1>;
  schedule: readonly ReadinessScheduleEntryV1[];
  attempts: readonly QualificationAttemptV3[];
  profileRoleResults: readonly ReadinessProfileRoleResultV1[];
  qualifiers: Record<Imp24ReviewRole, string[]>;
  selected: {
    readerPrimary: string | null;
    readerAudit: string | null;
    sourcePrimary: string | null;
    sourceAdjudicator: string | null;
    quizSemanticAdjudicator: string | null;
  };
  terminalState: "PILOT_ROLE_SET_READY" | "BLOCKED_ROLE_READINESS";
  blockedReason: string | null;
  budgetExhausted: boolean;
  baseCallsAttempted: number;
  infrastructureReplays: number;
  maxPlanEvents: number;
  totalAttempts: number;
  firstLiveRequestSha256: string | null;
};

/** Execute the frozen readiness plan. No executor call is possible until
 * every corpus/plan/certification/seal/availability/instrument invariant has
 * passed model-free preflight. */
export async function runPilotRoleReadiness(
  input: RunPilotRoleReadinessInputV1,
  deps: RunPilotRoleReadinessDepsV1,
): Promise<PilotRoleReadinessRunnerResultV1> {
  requireCondition(typeof deps?.executor === "function", "readiness execution requires an injected executor");
  requireCondition(typeof deps?.evaluateOutput === "function", "readiness execution requires an injected evaluator");
  const { freeze, schedule } = buildPilotRoleReadinessPlanForExecution(input);
  const attempts: QualificationAttemptV3[] = [];
  const profileRoleResults: ReadinessProfileRoleResultV1[] = [];
  const qualifiers: Record<Imp24ReviewRole, string[]> = { reader: [], source: [], quiz: [] };
  const fatalLatch: ReadinessFatalLatch = { tripped: false, error: null };
  const baseBudget = PILOT_READINESS_BUDGET.baseMaximumCalls;
  let baseCallsIssued = 0;
  let budgetExhausted = false;

  for (const role of ROLES) {
    const stopping = PILOT_READINESS_STOPPING[role];
    for (let candidateOrdinal = 0; candidateOrdinal < PILOT_READINESS_CANDIDATE_ORDERS[role].length; candidateOrdinal += 1) {
      const candidate = PILOT_READINESS_CANDIDATE_ORDERS[role][candidateOrdinal];
      const availability = input.candidateAvailability.entries
        .find((entry) => entry.role === role && entry.ordinal === candidateOrdinal)!;
      const baseResult = {
        role, candidateOrdinal, profile: candidate,
        availability: availability.status,
        canaryStarted: false, canaryProtocolPassed: false, canarySemanticCorrectCount: 0,
        holdoutStarted: false, holdoutCaseCount: 0, attempts: 0, outcome: null,
      };
      if (qualifiers[role].length >= stopping) {
        profileRoleResults.push({ ...baseResult, status: "NOT_TESTED_SEQUENTIAL_STOP" });
        continue;
      }
      if (availability.status === "UNAVAILABLE") {
        profileRoleResults.push({ ...baseResult, status: "UNAVAILABLE" });
        continue;
      }
      // Budget gate: a profile-role only starts when its FULL qualification
      // fits in the remaining base budget. Spend is monotonic, so once this
      // gate fails it fails for every later profile-role too.
      if (baseBudget - baseCallsIssued < PILOT_READINESS_PROFILE_ROLE_CALLS) {
        budgetExhausted = true;
        profileRoleResults.push({ ...baseResult, status: "NOT_TESTED_BUDGET_EXHAUSTED" });
        continue;
      }

      const canaryEntries = schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal && entry.partition === "canary");
      requireCondition(canaryEntries.length === PILOT_READINESS_CANARY_CALLS,
        `${role}/${candidate.profileId} must receive exactly two canaries`);
      baseCallsIssued += canaryEntries.length;
      const canary = await mapPool(canaryEntries, PILOT_READINESS_MAX_PARALLEL, fatalLatch, async (entry) => {
        const preparedCase = input.preparedCases[role].canary[entry.caseOrdinal];
        return runScheduledReadinessCase({ input, freeze, entry, preparedCase, candidate, deps, attempts, fatalLatch });
      });
      const canaryProtocolPassed = canary.every((attempt) => attempt.protocolValid);
      const canarySemanticCorrectCount = canary.filter((attempt) => attempt.semanticCorrect === true).length;
      const attemptCount = (): number => attempts
        .filter((attempt) => attempt.request.role === role && attempt.request.profileId === candidate.profileId).length;
      if (!canaryProtocolPassed) {
        profileRoleResults.push({
          ...baseResult, status: "NOT_QUALIFIED_PROTOCOL", canaryStarted: true,
          canaryProtocolPassed: false, canarySemanticCorrectCount, attempts: attemptCount(),
        });
        continue;
      }
      if (canarySemanticCorrectCount !== PILOT_READINESS_CANARY_CALLS) {
        profileRoleResults.push({
          ...baseResult, status: "NOT_QUALIFIED_CANARY", canaryStarted: true,
          canaryProtocolPassed: true, canarySemanticCorrectCount, attempts: attemptCount(),
        });
        continue;
      }

      const holdoutEntries = schedule.filter((entry) => entry.role === role
        && entry.candidateOrdinal === candidateOrdinal && entry.partition === "holdout");
      requireCondition(holdoutEntries.length === PILOT_READINESS_HOLDOUT_CALLS,
        `${role}/${candidate.profileId} holdout is not the complete frozen role holdout`);
      requireCondition(baseBudget - baseCallsIssued >= holdoutEntries.length,
        `${role}/${candidate.profileId}: holdout no longer fits the base budget after its canary gate`);
      baseCallsIssued += holdoutEntries.length;
      const holdout = await mapPool(holdoutEntries, PILOT_READINESS_MAX_PARALLEL, fatalLatch, async (entry) => {
        const preparedCase = input.preparedCases[role].holdout[entry.caseOrdinal];
        return runScheduledReadinessCase({ input, freeze, entry, preparedCase, candidate, deps, attempts, fatalLatch });
      });
      const counts = scoreReadinessHoldout(role, holdout);
      // Canary semantic correctness is conductor-recorded: the only path to a
      // holdout is the exact 2/2 gate above.
      counts.canarySemanticCorrectness = {
        numerator: canarySemanticCorrectCount,
        denominator: PILOT_READINESS_CANARY_CALLS,
      };
      const outcome = qualifyReadinessRole(role, counts);
      profileRoleResults.push({
        ...baseResult, status: outcome.status === "READY" ? "READY" : "NOT_QUALIFIED",
        canaryStarted: true, canaryProtocolPassed: true, canarySemanticCorrectCount,
        holdoutStarted: true, holdoutCaseCount: holdout.length, attempts: attemptCount(),
        outcome,
      });
      if (outcome.status === "READY") qualifiers[role].push(candidate.profileId);
    }
  }

  attempts.sort((left, right) => left.scheduleOrdinal - right.scheduleOrdinal
    || left.request.attemptNumber - right.request.attemptNumber);
  const baseCallsAttempted = new Set(attempts.map((attempt) => attempt.request.scheduleId)).size;
  requireCondition(baseCallsAttempted === baseCallsIssued,
    `readiness base-call accounting drifted (${baseCallsAttempted} attempted vs ${baseCallsIssued} issued)`);
  requireCondition(baseCallsAttempted <= PILOT_READINESS_BUDGET.baseMaximumCalls,
    "readiness campaign exceeded the 84-call base ceiling");
  requireCondition(attempts.length <= PILOT_READINESS_BUDGET.hardMaximumCalls,
    "readiness campaign exceeded the 168-call hard ceiling");

  const shortfalls = ROLES
    .filter((role) => qualifiers[role].length < PILOT_READINESS_STOPPING[role])
    .map((role) => `${role} ${qualifiers[role].length}/${PILOT_READINESS_STOPPING[role]} ready`);
  const ready = shortfalls.length === 0;
  return {
    schema: PILOT_READINESS_RUNNER_RESULT_SCHEMA,
    experimentId: PILOT_ROLE_READINESS_EXPERIMENT_ID,
    freeze,
    schedule: Object.freeze(schedule),
    attempts: Object.freeze(attempts),
    profileRoleResults: Object.freeze(profileRoleResults),
    qualifiers,
    selected: {
      readerPrimary: qualifiers.reader[0] ?? null,
      readerAudit: qualifiers.reader[1] ?? null,
      sourcePrimary: qualifiers.source[0] ?? null,
      sourceAdjudicator: qualifiers.source[1] ?? null,
      quizSemanticAdjudicator: qualifiers.quiz[0] ?? null,
    },
    terminalState: ready ? "PILOT_ROLE_SET_READY" : "BLOCKED_ROLE_READINESS",
    blockedReason: ready
      ? null
      : `${shortfalls.join("; ")}${budgetExhausted ? "; base budget exhausted before every candidate could be tested" : ""}`,
    budgetExhausted,
    baseCallsAttempted,
    infrastructureReplays: attempts.filter((attempt) => attempt.request.attemptNumber === 2).length,
    maxPlanEvents: attempts.filter((attempt) => attempt.receipt?.status === "provider_capacity").length,
    totalAttempts: attempts.length,
    firstLiveRequestSha256: attempts[0]?.request.requestSha256 ?? null,
  };
}
