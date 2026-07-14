/**
 * Deterministic IMP-22 forward-gold evaluator instrument.
 *
 * This is a configuration seal, not a model boundary.  It freezes the exact
 * Rubric v2.0 source, scoring/adjudication protocols, output schemas, call
 * order, actors, model/effort, prompts, and no-publish/no-API capabilities.
 * Production callers may materialize the bound assets in isolated evaluator
 * workspaces, but may not substitute a caller-authored prompt or schema.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { renderSweepFamilyRubric } from "../qc/sweepSpec.js";

export const FORWARD_GOLD_EVALUATOR_CONFIG_SCHEMA = "forward-explicit-gold-evaluator-config-v1" as const;
export const FORWARD_GOLD_EVALUATOR_INSTRUMENT_ID = "imp22-forward-gold-rubric-v2-fixed-v1" as const;
export const FORWARD_GOLD_EVALUATOR_INSTRUMENT_VERSION = 1 as const;
export const FORWARD_GOLD_RUBRIC_NAME = "ChapterFlow Evidence, Learning, and Reader Experience Rubric" as const;
export const FORWARD_GOLD_RUBRIC_VERSION = "2.0" as const;
export const FORWARD_GOLD_EVALUATOR_MODEL = "gpt-5.6-sol" as const;
export const FORWARD_GOLD_EVALUATOR_EFFORT = "xhigh" as const;
export const FORWARD_GOLD_JSON_SCHEMA_VALIDATOR = "ajv@6.15.0" as const;
export const FORWARD_GOLD_EVALUATOR_INSTRUMENT_SHA256 = "9e927c97ece6201dbb0ccd229c47e1895815adc73c885d5c6fcd8657708915a0" as const;

const SHA256 = /^[a-f0-9]{64}$/;
const CHAPTER_CONTENT_HASH = /^[a-f0-9]{16}$/;
const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
const DEFAULT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const localRequire = createRequire(import.meta.url);

type JsonSchemaValidator = ((value: unknown) => boolean) & {
  errors?: Array<{ dataPath?: string; instancePath?: string; message?: string }> | null;
};
type AjvInstance = { compile: (schema: object) => JsonSchemaValidator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv = localRequire("ajv") as AjvConstructor;
const AJV_PACKAGE_VERSION = (localRequire("ajv/package.json") as { version?: unknown }).version;

export class ForwardGoldEvaluatorInstrumentError extends Error {
  readonly classification = "STATE_OR_PROVENANCE" as const;
  constructor(message: string) {
    super(message);
    this.name = "ForwardGoldEvaluatorInstrumentError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardGoldEvaluatorInstrumentError(message);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (value !== null && typeof value === "object") {
    const object = value as object;
    if (!seen.has(object)) {
      seen.add(object);
      for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
      Object.freeze(object);
    }
  }
  return value;
}

export const FORWARD_GOLD_RUBRIC_CONFIG = deepFreeze({
  name: FORWARD_GOLD_RUBRIC_NAME,
  version: FORWARD_GOLD_RUBRIC_VERSION,
  ratingScale: {
    blindRaters: "integer-0-through-4",
    adjudicator: "half-points-allowed-only-after-evidence-reconciliation",
  },
  domains: [
    { id: "epistemic_integrity", weight: 15, subcriteria: ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"] },
    { id: "audience_fit", weight: 12, subcriteria: ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"] },
    { id: "mental_model_coherence", weight: 15, subcriteria: ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"] },
    { id: "learning_architecture", weight: 12, subcriteria: ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"] },
    { id: "retention_retrieval", weight: 10, subcriteria: ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"] },
    { id: "transfer_action_judgment", weight: 15, subcriteria: ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"] },
    { id: "motivation_autonomy", weight: 8, subcriteria: ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"] },
    { id: "engagement_momentum", weight: 8, subcriteria: ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"] },
    { id: "whole_book_coherence", weight: 5, subcriteria: ["chapter_necessity_order", "quality_consistency_pacing", "redundancy_cumulative_load", "synthesis_completion_value"] },
  ],
  hardGates: [
    "technical_completeness",
    "epistemic_instructional_safety",
    "ethics_reader_autonomy",
    "purpose_audience_declaration",
    "external_accuracy",
  ],
  scoreFormula: "sum(((mean(domain.subcriteria)/4)*domain.weight) for all nine domains)",
  minimumGoldContentDesignScore: 80,
  requiredEvidence: {
    fullBookRead: true,
    everyChapterReadStatus: "full",
    strengthsPerDomainMinimum: 2,
    limitationsPerDomainMinimum: 1,
    wholeBookPatternPerDomainMinimum: 1,
    preciseLocalLocatorsRequired: true,
    measuredReaderOutcomesMayBeClaimed: false,
  },
});

export type ForwardGoldInstrumentAssetRole =
  | "rubric-source"
  | "blind-rater-prompt-source"
  | "scoring-protocol"
  | "blind-rater-output-schema"
  | "adjudication-protocol"
  | "adjudicator-output-schema"
  | "sweep-spec-source"
  | "sweep-output-schema";

type FixedAssetSpec = {
  role: ForwardGoldInstrumentAssetRole;
  repositoryRelPath: string;
  materializedRelPath: string;
  bytesSha256: string;
};

/** Pinned bytes, not hashes learned from the current tree.  A changed rubric,
 * protocol, schema, or sweep definition requires a deliberate instrument
 * version/seal update. */
const FIXED_ASSET_SPECS: readonly FixedAssetSpec[] = [
  {
    role: "rubric-source",
    repositoryRelPath: ".agents/skills/chapterflow-book-evaluator/references/rubric-v2.md",
    materializedRelPath: "instrument/rubric-v2.md",
    bytesSha256: "8f93b4f4d5e5749931c8bebb9dca959ba9763754aee252fbb4c5dfeed710a4a0",
  },
  {
    role: "blind-rater-prompt-source",
    repositoryRelPath: ".agents/skills/chapterflow-book-evaluator/references/book-rater-prompt.md",
    materializedRelPath: "instrument/book-rater-prompt.md",
    bytesSha256: "1a84e1e2521c08ec7f87361da1ec851f5abbd498cf731f254e4f7ec2dc1249ad",
  },
  {
    role: "scoring-protocol",
    repositoryRelPath: ".agents/skills/chapterflow-book-evaluator/references/scoring-protocol.md",
    materializedRelPath: "instrument/scoring-protocol.md",
    bytesSha256: "1090e34c8ace1baa52875c8658b3a6484bf30127748790a01090bd3384d51b82",
  },
  {
    role: "blind-rater-output-schema",
    repositoryRelPath: ".agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json",
    materializedRelPath: "instrument/book-evaluation.schema.json",
    bytesSha256: "cdb13cfaeb555d9a978015f5a3963c053840774b4dd57d2c46feda5ebc229f13",
  },
  {
    role: "adjudication-protocol",
    repositoryRelPath: ".agents/skills/chapterflow-book-evaluator/references/adjudication-protocol.md",
    materializedRelPath: "instrument/adjudication-protocol.md",
    bytesSha256: "2d021d8b358b68be21095c56ae72b46693fc500735a8fd69f6239666ebf08b2b",
  },
  {
    role: "adjudicator-output-schema",
    repositoryRelPath: ".agents/skills/chapterflow-book-evaluator/references/adjudicated-book.schema.json",
    materializedRelPath: "instrument/adjudicated-book.schema.json",
    bytesSha256: "3e9dcd7d71491c337eccabf5d960bdb5041cf85497f480e9eace665ef50e8e59",
  },
  {
    role: "sweep-spec-source",
    repositoryRelPath: `${PIPELINE_REL}/src/qc/sweepSpec.ts`,
    materializedRelPath: "instrument/sweepSpec.ts",
    bytesSha256: "170e2788b38fb831233c358a9f77b983e64c684c21600e1753bb1d7335df8320",
  },
  {
    role: "sweep-output-schema",
    repositoryRelPath: `${PIPELINE_REL}/state/migration-experiments/contracts/schemas/forward-gold-sweep.schema.json`,
    materializedRelPath: "instrument/forward-gold-sweep.schema.json",
    bytesSha256: "816f3d3dd4b49f9f3579c47c20d2c1fc0f40ebe4857de5fdbf439f6d4a67e10e",
  },
] as const;

export type ForwardGoldInstrumentAssetBindingV1 = FixedAssetSpec;

export const FORWARD_GOLD_EVALUATOR_CAPABILITIES = deepFreeze({
  executionRoute: "codex_exec_chatgpt_subscription" as const,
  authMode: "chatgpt" as const,
  apiKeyPresent: false as const,
  apiFallbackAllowed: false as const,
  directModelSdkAllowed: false as const,
  directModelHttpAllowed: false as const,
  webBrowsingAllowed: false as const,
  externalFactCheckAllowed: false as const,
  sandbox: "read-only" as const,
  repositoryWritesAllowed: false as const,
  publishAllowed: false as const,
  pushAllowed: false as const,
  deployAllowed: false as const,
  uploadAllowed: false as const,
  priorVerdictsAllowedForBlindRaters: false as const,
  retainedOutputSchemaValidator: FORWARD_GOLD_JSON_SCHEMA_VALIDATOR,
  modelCallCount: 4 as const,
});

const COMMON_PROMPT = `IMP-22 FORWARD-ONLY GOLD EVALUATION — FIXED INSTRUMENT

This is a read-only, no-publish evaluation of one fresh experiment-local book. Read every authoritative file under chapters/, source/, and book/ before judging. Read the complete bound instrument under instrument/, including rubric-v2.md and the applicable protocol and schema. Hashes and prior verdicts are never substitutes for reading the prose and evidence.

Apply ChapterFlow Evidence, Learning, and Reader Experience Rubric v2.0 exactly: all nine weighted domains, all 36 subcriteria, all five hard gates, full-book evidence minimums, and deterministic arithmetic. Evaluate support for learning and transfer; do not claim measured retention, behavior change, satisfaction, or completion. A high weighted score cannot erase a hard-gate defect. In this isolated rubric record, external_accuracy must remain not_assessed; a separate deterministic proof from the source-aware production lanes controls the final campaign externalAccuracy result.

Use only the supplied local artifacts. Do not browse, use outside reputation or remembered source-book content, call a model API/SDK/HTTP endpoint, inspect historical scores, modify files, publish, push, deploy, upload, or spawn another agent. Never default to PASS, infer PASS from schema validity, or tune a judgment to the acceptance threshold. A gate or verdict passes only when specific full-book evidence supports it.`;

const BLIND_PRIMARY_PROMPT = `${COMMON_PROMPT}

ROLE: PRIMARY BLIND RATER
You are the first of exactly two mutually blind independent raters. Do not inspect or infer the verification rater's identity, task, receipt, or result. Follow instrument/book-rater-prompt.md and instrument/scoring-protocol.md. Return one complete result conforming to instrument/book-evaluation.schema.json with rater_role "primary". Use integer 0–4 subcriterion ratings. Record exactly one full-read chapter evidence entry for every frozen chapter and preserve the frozen source/inventory identity in the result.`;

const BLIND_VERIFICATION_PROMPT = `${COMMON_PROMPT}

ROLE: VERIFICATION BLIND RATER
You are the second of exactly two mutually blind independent raters. Do not inspect or infer the primary rater's identity, task, receipt, or result. Follow instrument/book-rater-prompt.md and instrument/scoring-protocol.md. Return one complete result conforming to instrument/book-evaluation.schema.json with rater_role "verification". Use integer 0–4 subcriterion ratings. Record exactly one full-read chapter evidence entry for every frozen chapter and preserve the frozen source/inventory identity in the result.`;

const ADJUDICATOR_PROMPT = `${COMMON_PROMPT}

ROLE: EVIDENCE-BASED ADJUDICATOR
Run only after both independently retained blind-rater results are supplied in blind-rater-results.json. Follow instrument/adjudication-protocol.md. Revalidate both records against the same frozen source inventory, reread the actual full book and implicated source evidence, reconcile all 36 subcriteria and five gates, and never average automatically. Return one complete result conforming to instrument/adjudicated-book.schema.json with rater_role "adjudicated". Preserve the primary/verification comparison trail, record why the controlling anchor fits, and recalculate the final score deterministically. Keep external_accuracy at not_assessed exactly as the normative isolated schema requires; do not self-assert source truth or a production external-accuracy PASS.`;

const SWEEP_PROMPT = `${COMMON_PROMPT}

ROLE: INDEPENDENT FULL-BOOK SWEEP
This call is independent of the blind raters and adjudicator. Read the actual final chapter prose, not their outputs. Return exactly one object conforming to instrument/forward-gold-sweep.schema.json. Echo the frozen source_hash and this call's worker_dispatch_receipt_sha256, then bind bookId, roundId, reviewer, reviewerSessionId, and the exact content hash of every final chapter. Check every required canonical sweep family and ground every finding in specific chapter numbers and quoted local evidence.

${renderSweepFamilyRubric()}`;

export const FORWARD_GOLD_EVALUATOR_PROMPTS = deepFreeze({
  blindPrimary: BLIND_PRIMARY_PROMPT,
  blindVerification: BLIND_VERIFICATION_PROMPT,
  adjudicator: ADJUDICATOR_PROMPT,
  bookSweep: SWEEP_PROMPT,
});

// Filled from the built-in prompt bytes; checked before an instrument is issued.
const PINNED_PROMPT_SHA256 = {
  blindPrimary: "3d967def8c8618697512f3da32a81aada3b31af077a2a20696fc5f150b2243e1",
  blindVerification: "417fb21e4380b68cfb74f50b0a222623c3cd49553d8fdd5f4f22c32336853a5c",
  adjudicator: "cf95948d1196d2688abf5d13fccaade65bceb0e7bcc6dd04ea6de2cc48e27ede",
  bookSweep: "1a5550e044c088b9c92ad2409efdd090dbdee80b53161965584993d58b5eb200",
} as const;

export type ForwardGoldEvaluatorCallRole = "blind-rater" | "adjudicator" | "book-sweep";

export type ForwardGoldEvaluatorInstrumentCallV1 = {
  callId: string;
  actorId: string;
  evaluationRole: ForwardGoldEvaluatorCallRole;
  model: typeof FORWARD_GOLD_EVALUATOR_MODEL;
  effort: typeof FORWARD_GOLD_EVALUATOR_EFFORT;
  prompt: string;
  promptSha256: string;
  outputSchemaRelPath: string;
  outputSchemaSha256: string;
};

export type ForwardGoldAdjudicationProjectionV1 = {
  technicalCompleteness: "PASS" | "FAIL";
  epistemicInstructionalSafety: "PASS" | "FAIL";
  ethicsReaderAutonomy: "PASS" | "FAIL";
  purposeAudienceDeclaration: "PASS" | "FAIL";
  externalAccuracy: "PASS" | "FAIL";
  contentDesignScore: number;
};

export type ForwardGoldEvaluatorInstrumentV1 = {
  schema: typeof FORWARD_GOLD_EVALUATOR_CONFIG_SCHEMA;
  instrumentId: typeof FORWARD_GOLD_EVALUATOR_INSTRUMENT_ID;
  instrumentVersion: typeof FORWARD_GOLD_EVALUATOR_INSTRUMENT_VERSION;
  rubric: {
    name: typeof FORWARD_GOLD_RUBRIC_NAME;
    version: typeof FORWARD_GOLD_RUBRIC_VERSION;
    sourceBytesSha256: string;
    configSha256: string;
    rubricBindingSha256: string;
  };
  referenceAssets: ForwardGoldInstrumentAssetBindingV1[];
  capabilities: typeof FORWARD_GOLD_EVALUATOR_CAPABILITIES;
  adjudicationProjection: {
    technicalCompleteness: "gates.technical_completeness.status";
    epistemicInstructionalSafety: "gates.epistemic_instructional_safety.status";
    ethicsReaderAutonomy: "gates.ethics_reader_autonomy.status";
    purposeAudienceDeclaration: "gates.purpose_audience_declaration.status";
    externalAccuracy: "gates.external_accuracy.status";
    contentDesignScore: "overall_score";
    solePassingGateStatus: "pass";
  };
  calls: ForwardGoldEvaluatorInstrumentCallV1[];
  instrumentSha256: string;
};

function fixedAsset(role: ForwardGoldInstrumentAssetRole): FixedAssetSpec {
  const asset = FIXED_ASSET_SPECS.find((candidate) => candidate.role === role);
  requireCondition(asset !== undefined, `missing fixed gold instrument asset ${role}`);
  return asset;
}

function loadPinnedOutputSchema(
  role: "blind-rater-output-schema" | "adjudicator-output-schema" | "sweep-output-schema",
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
): Record<string, unknown> {
  requireCondition(AJV_PACKAGE_VERSION === "6.15.0",
    `forward gold schema validator drift: expected ajv 6.15.0, got ${String(AJV_PACKAGE_VERSION)}`);
  const asset = fixedAsset(role);
  const path = resolve(repositoryRoot, asset.repositoryRelPath);
  let bytes: Buffer;
  try { bytes = readFileSync(path); }
  catch (error) { throw new ForwardGoldEvaluatorInstrumentError(`cannot read pinned ${role}: ${(error as Error).message}`); }
  const actualSha256 = sha256Hex(bytes);
  requireCondition(actualSha256 === asset.bytesSha256,
    `pinned ${role} bytes drift: expected ${asset.bytesSha256}, got ${actualSha256}`);
  try { return JSON.parse(bytes.toString("utf8")) as Record<string, unknown>; }
  catch (error) { throw new ForwardGoldEvaluatorInstrumentError(`pinned ${role} is invalid JSON: ${(error as Error).message}`); }
}

function validateAgainstPinnedOutputSchema(
  value: unknown,
  role: "blind-rater-output-schema" | "adjudicator-output-schema" | "sweep-output-schema",
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  expectedChapters: readonly ForwardGoldExpectedChapterIdentityV1[] = [],
): void {
  const schema = loadPinnedOutputSchema(role, repositoryRoot);
  // Ajv v6 is the repository's installed validator.  The pinned schemas use
  // only keywords it implements, but declare the newer 2020-12 meta-schema;
  // remove only that declaration from the in-memory compile copy.  The exact
  // source bytes were already hash-verified above and every substantive schema
  // keyword remains unchanged.
  const compileSchema = role === "sweep-output-schema"
    ? materializeForwardGoldSweepSchemaObject(schema, expectedChapters)
    : JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  delete compileSchema.$schema;
  const ajv = new Ajv({ allErrors: true, jsonPointers: true, schemaId: "auto", validateSchema: false, unknownFormats: "ignore" });
  let validate: JsonSchemaValidator;
  try { validate = ajv.compile(compileSchema); }
  catch (error) { throw new ForwardGoldEvaluatorInstrumentError(`cannot compile pinned ${role}: ${(error as Error).message}`); }
  if (validate(value)) return;
  const detail = (validate.errors ?? []).slice(0, 8).map((error) =>
    `${error.instancePath ?? error.dataPath ?? "$"} ${error.message ?? "schema violation"}`.trim()).join("; ");
  throw new ForwardGoldEvaluatorInstrumentError(`gold retained output violates pinned ${role}: ${detail || "unknown schema violation"}`);
}

function loadAndVerifyAssets(repositoryRoot: string): ForwardGoldInstrumentAssetBindingV1[] {
  const root = resolve(repositoryRoot);
  return FIXED_ASSET_SPECS.map((asset) => {
    const path = resolve(root, asset.repositoryRelPath);
    const rel = relative(root, path);
    requireCondition(rel !== "" && !rel.startsWith("..") && !resolve(path).startsWith(`${root}/../`),
      `gold instrument asset escapes repository root: ${asset.repositoryRelPath}`);
    let bytes: Buffer;
    try { bytes = readFileSync(path); }
    catch (error) { throw new ForwardGoldEvaluatorInstrumentError(`cannot read fixed gold instrument asset ${asset.repositoryRelPath}: ${(error as Error).message}`); }
    const actual = sha256Hex(bytes);
    requireCondition(actual === asset.bytesSha256,
      `fixed gold instrument asset drift (${asset.role}): expected ${asset.bytesSha256}, got ${actual}`);
    return { ...asset };
  });
}

function promptHash(prompt: string, key: keyof typeof PINNED_PROMPT_SHA256): string {
  const actual = sha256Hex(prompt);
  const pinned = PINNED_PROMPT_SHA256[key];
  requireCondition(actual === pinned, `fixed gold ${key} prompt drift: expected ${pinned}, got ${actual}`);
  return actual;
}

function portableInstrumentPayload(value: ForwardGoldEvaluatorInstrumentV1): unknown {
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  delete clone.instrumentSha256;
  return clone;
}

export function computeForwardGoldEvaluatorInstrumentSha256(value: ForwardGoldEvaluatorInstrumentV1): string {
  return hashCanonical(portableInstrumentPayload(value));
}

export function buildForwardGoldEvaluatorInstrument(args: {
  repositoryRoot?: string;
} = {}): Readonly<ForwardGoldEvaluatorInstrumentV1> {
  const repositoryRoot = resolve(args.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT);
  const referenceAssets = loadAndVerifyAssets(repositoryRoot);
  const blindSchema = fixedAsset("blind-rater-output-schema");
  const adjudicatorSchema = fixedAsset("adjudicator-output-schema");
  const sweepSchema = fixedAsset("sweep-output-schema");
  const rubricSource = fixedAsset("rubric-source");
  const outputCall = (
    callId: string,
    actorId: string,
    evaluationRole: ForwardGoldEvaluatorCallRole,
    prompt: string,
    promptKey: keyof typeof PINNED_PROMPT_SHA256,
    schema: FixedAssetSpec,
  ): ForwardGoldEvaluatorInstrumentCallV1 => ({
    callId,
    actorId,
    evaluationRole,
    model: FORWARD_GOLD_EVALUATOR_MODEL,
    effort: FORWARD_GOLD_EVALUATOR_EFFORT,
    prompt,
    promptSha256: promptHash(prompt, promptKey),
    outputSchemaRelPath: schema.repositoryRelPath,
    outputSchemaSha256: schema.bytesSha256,
  });
  const configSha256 = hashCanonical(FORWARD_GOLD_RUBRIC_CONFIG);
  const rubric = {
    name: FORWARD_GOLD_RUBRIC_NAME,
    version: FORWARD_GOLD_RUBRIC_VERSION,
    sourceBytesSha256: rubricSource.bytesSha256,
    configSha256,
    rubricBindingSha256: hashCanonical({
      name: FORWARD_GOLD_RUBRIC_NAME,
      version: FORWARD_GOLD_RUBRIC_VERSION,
      sourceBytesSha256: rubricSource.bytesSha256,
      configSha256,
    }),
  } as const;
  const withoutSelf: Omit<ForwardGoldEvaluatorInstrumentV1, "instrumentSha256"> = {
    schema: FORWARD_GOLD_EVALUATOR_CONFIG_SCHEMA,
    instrumentId: FORWARD_GOLD_EVALUATOR_INSTRUMENT_ID,
    instrumentVersion: FORWARD_GOLD_EVALUATOR_INSTRUMENT_VERSION,
    rubric,
    referenceAssets,
    capabilities: FORWARD_GOLD_EVALUATOR_CAPABILITIES,
    adjudicationProjection: {
      technicalCompleteness: "gates.technical_completeness.status",
      epistemicInstructionalSafety: "gates.epistemic_instructional_safety.status",
      ethicsReaderAutonomy: "gates.ethics_reader_autonomy.status",
      purposeAudienceDeclaration: "gates.purpose_audience_declaration.status",
      externalAccuracy: "gates.external_accuracy.status",
      contentDesignScore: "overall_score",
      solePassingGateStatus: "pass",
    },
    calls: [
      outputCall("blind-rater-primary", "imp22-gold-rater-primary", "blind-rater", BLIND_PRIMARY_PROMPT, "blindPrimary", blindSchema),
      outputCall("blind-rater-verification", "imp22-gold-rater-verification", "blind-rater", BLIND_VERIFICATION_PROMPT, "blindVerification", blindSchema),
      outputCall("gold-adjudicator", "imp22-gold-adjudicator", "adjudicator", ADJUDICATOR_PROMPT, "adjudicator", adjudicatorSchema),
      outputCall("independent-book-sweep", "imp22-gold-book-sweep", "book-sweep", SWEEP_PROMPT, "bookSweep", sweepSchema),
    ],
  };
  const provisional = { ...withoutSelf, instrumentSha256: "" };
  provisional.instrumentSha256 = computeForwardGoldEvaluatorInstrumentSha256(provisional);
  requireCondition(provisional.instrumentSha256 === FORWARD_GOLD_EVALUATOR_INSTRUMENT_SHA256,
    `fixed forward gold evaluator instrument drift: expected ${FORWARD_GOLD_EVALUATOR_INSTRUMENT_SHA256}, got ${provisional.instrumentSha256}`);
  return deepFreeze(provisional);
}

/** Validate a retained config against the built-in instrument, not against the
 * config's own assertions.  Recomputing self hashes after changing a prompt,
 * role, model, effort, capability, or schema therefore cannot bless drift. */
export function validateForwardGoldEvaluatorInstrument(
  value: unknown,
  args: { repositoryRoot?: string } = {},
): Readonly<ForwardGoldEvaluatorInstrumentV1> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value),
    "forward gold evaluator instrument must be an object");
  const expected = buildForwardGoldEvaluatorInstrument(args);
  const candidate = value as ForwardGoldEvaluatorInstrumentV1;
  requireCondition(typeof candidate.instrumentSha256 === "string" && SHA256.test(candidate.instrumentSha256),
    "forward gold evaluator instrument has no valid self hash");
  let actualSelfHash: string;
  let actualPortableHash: string;
  try {
    actualSelfHash = computeForwardGoldEvaluatorInstrumentSha256(candidate);
    actualPortableHash = hashCanonical(portableInstrumentPayload(candidate));
  } catch (error) {
    throw new ForwardGoldEvaluatorInstrumentError(`malformed forward gold evaluator instrument: ${(error as Error).message}`);
  }
  requireCondition(candidate.instrumentSha256 === actualSelfHash,
    "forward gold evaluator instrument self hash mismatch");
  requireCondition(candidate.instrumentSha256 === expected.instrumentSha256,
    "forward gold evaluator instrument is not the fixed IMP-22 instrument");
  requireCondition(actualPortableHash === hashCanonical(portableInstrumentPayload(expected)),
    "forward gold evaluator instrument configuration drift");
  requireCondition(Array.isArray(candidate.calls) && candidate.calls.length === 4,
    "forward gold evaluator instrument must contain exactly four calls");
  for (let index = 0; index < expected.calls.length; index++) {
    const actualCall = candidate.calls[index];
    const expectedCall = expected.calls[index];
    requireCondition(actualCall?.outputSchemaRelPath === expectedCall.outputSchemaRelPath,
      `${expectedCall.callId}: output schema relative path drift`);
    resolveForwardGoldEvaluatorOutputSchemaPath(actualCall, args);
  }
  return deepFreeze(candidate);
}

/** Resolve a validated call's pinned repository-relative schema only at the
 * execution boundary.  The retained instrument never serializes a host path. */
export function resolveForwardGoldEvaluatorOutputSchemaPath(
  call: Pick<ForwardGoldEvaluatorInstrumentCallV1, "callId" | "outputSchemaRelPath" | "outputSchemaSha256">,
  args: { repositoryRoot?: string } = {},
): string {
  const repositoryRoot = resolve(args.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT);
  const fixed = FIXED_ASSET_SPECS.find((asset) => asset.repositoryRelPath === call.outputSchemaRelPath
    && (asset.role === "blind-rater-output-schema"
      || asset.role === "adjudicator-output-schema"
      || asset.role === "sweep-output-schema"));
  requireCondition(fixed !== undefined && fixed.bytesSha256 === call.outputSchemaSha256,
    `${call.callId}: output schema is not a fixed gold instrument schema`);
  const path = resolve(repositoryRoot, fixed.repositoryRelPath);
  const rel = relative(repositoryRoot, path);
  requireCondition(rel !== "" && !rel.startsWith(".."), `${call.callId}: output schema escapes repository root`);
  let bytes: Buffer;
  try { bytes = readFileSync(path); }
  catch (error) { throw new ForwardGoldEvaluatorInstrumentError(`${call.callId}: cannot read output schema: ${(error as Error).message}`); }
  requireCondition(sha256Hex(bytes) === fixed.bytesSha256, `${call.callId}: output schema bytes drift`);
  return path;
}

export type ForwardGoldExpectedChapterIdentityV1 = {
  chapterIndex: number;
  chapterId: string;
  title: string;
  packagePath: string;
};

export type ForwardGoldComponentInventoryV1 = {
  examples: number;
  quiz_questions: number;
  review_cards: number;
  implementation_items: number;
  exercises: number;
  memorable_lines: number;
  other: Record<string, number>;
};

const FORWARD_GOLD_JSON_OTHER_COMPONENT_KEYS = [
  "hooks", "counterintuitions", "breakdown_sections", "key_takeaways",
] as const;

function materializeForwardGoldSweepSchemaObject(
  sourceSchema: Record<string, unknown>,
  expectedChapters: readonly ForwardGoldExpectedChapterIdentityV1[],
): Record<string, unknown> {
  requireCondition(expectedChapters.length >= 8,
    "forward gold sweep transport schema requires at least eight frozen chapters");
  const indexes = expectedChapters.map((chapter) => chapter.chapterIndex);
  requireCondition(indexes.every((index) => Number.isInteger(index) && index > 0)
    && new Set(indexes).size === indexes.length,
  "forward gold sweep transport schema requires distinct positive chapter indexes");
  const schema = JSON.parse(JSON.stringify(sourceSchema)) as Record<string, unknown>;
  const properties = record(schema.properties, "gold sweep transport schema properties");
  const sweep = record(properties.sweep, "gold sweep transport schema sweep");
  const sweepProperties = record(sweep.properties, "gold sweep transport schema sweep properties");
  sweepProperties.schemaVersion = { type: "string", enum: ["sweep-attest-v1"] };
  for (const key of ["bookId", "roundId", "reviewer", "reviewerSessionId"] as const) {
    const property = record(sweepProperties[key], `gold sweep transport schema ${key}`);
    delete property.minLength;
  }
  record(sweepProperties.verdict, "gold sweep transport schema verdict").type = "string";
  const contentHashes = record(sweepProperties.contentHashes, "gold sweep transport schema contentHashes");
  const keys = indexes.map(String).sort((a, b) => Number(a) - Number(b));
  delete contentHashes.minProperties;
  delete contentHashes.propertyNames;
  contentHashes.additionalProperties = false;
  contentHashes.required = keys;
  contentHashes.properties = Object.fromEntries(keys.map((key) => [key, {
    type: "string",
    pattern: "^[0-9a-f]{16}$",
  }]));
  const checkedFamilies = record(sweepProperties.checkedFamilies,
    "gold sweep transport schema checkedFamilies");
  delete checkedFamilies.uniqueItems;
  record(checkedFamilies.items, "gold sweep transport schema checkedFamilies items").type = "string";
  const findings = record(sweepProperties.findings, "gold sweep transport schema findings");
  const finding = record(findings.items, "gold sweep transport schema finding item");
  const findingProperties = record(finding.properties, "gold sweep transport schema finding properties");
  record(findingProperties.family, "gold sweep transport schema finding family").type = "string";
  record(findingProperties.severity, "gold sweep transport schema finding severity").type = "string";
  const chapters = record(findingProperties.chapters, "gold sweep transport schema finding chapters");
  delete chapters.uniqueItems;
  for (const key of ["unitId", "quote", "problem", "expectedFix"] as const) {
    delete record(findingProperties[key], `gold sweep transport schema finding ${key}`).minLength;
  }
  return schema;
}

/** Build the exact strict-subset sweep schema for one already-frozen book.
 * The JSON output shape is unchanged; only the known chapter-number keys of
 * the contentHashes object are materialized before dispatch. */
export function materializeForwardGoldSweepOutputSchema(args: {
  expectedChapters: readonly ForwardGoldExpectedChapterIdentityV1[];
  repositoryRoot?: string;
}): Readonly<{ bytes: string; bytesSha256: string }> {
  const repositoryRoot = resolve(args.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT);
  const source = loadPinnedOutputSchema("sweep-output-schema", repositoryRoot);
  const schema = materializeForwardGoldSweepSchemaObject(source, args.expectedChapters);
  const bytes = `${JSON.stringify(schema, null, 2)}\n`;
  return deepFreeze({ bytes, bytesSha256: sha256Hex(bytes) });
}

function countComponent(chapters: readonly unknown[], key: string): number {
  return chapters.reduce<number>((total, raw) => {
    const chapter = raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
    const value = chapter[key];
    if (Array.isArray(value)) return total + value.length;
    if (value !== null && typeof value === "object") return total + Object.keys(value).length;
    return total + (value !== undefined && value !== null && value !== ""
      && value !== false && value !== 0 ? 1 : 0);
  }, 0);
}

function countNestedList(chapters: readonly unknown[], parent: string, child: string): number {
  return chapters.reduce<number>((total, raw) => {
    const chapter = raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
    const container = chapter[parent];
    if (container === null || typeof container !== "object" || Array.isArray(container)) return total;
    const value = (container as Record<string, unknown>)[child];
    return total + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

/** TypeScript parity with the fixed evaluator inspector's JSON-package
 * component inventory. It is derived only from frozen final ChapterV21 bytes. */
export function buildForwardGoldComponentInventory(
  chapters: readonly unknown[],
): Readonly<ForwardGoldComponentInventoryV1> {
  return deepFreeze({
    examples: countComponent(chapters, "examples"),
    quiz_questions: countNestedList(chapters, "quiz", "questions"),
    review_cards: countComponent(chapters, "reviewCards"),
    implementation_items: countNestedList(chapters, "implementationPlan", "ifThenPlans"),
    exercises: countComponent(chapters, "tryThisNow") + countComponent(chapters, "exercises"),
    memorable_lines: countComponent(chapters, "memorableLines"),
    other: {
      hooks: countComponent(chapters, "hook"),
      counterintuitions: countComponent(chapters, "counterintuition"),
      breakdown_sections: countComponent(chapters, "breakdown"),
      key_takeaways: countComponent(chapters, "keyTakeaway"),
    },
  });
}

export type ForwardGoldEvaluationValidationContextV1 = {
  expectedBookId: string;
  expectedSourceHash: string;
  expectedChapters: ForwardGoldExpectedChapterIdentityV1[];
  expectedComponentInventory?: ForwardGoldComponentInventoryV1;
  repositoryRoot?: string;
};

export type ForwardGoldSourceLaneEvidenceV1 = ForwardGoldExpectedChapterIdentityV1 & {
  candidateContentSha256: string;
  sourceResultSha256: string;
  executionEnvelopeSha256: string;
  sourceStatus: "PASS" | "REVISE" | "INCONCLUSIVE";
  sourceBlockerCount: number;
  evidenceFresh: boolean;
};

export type ForwardGoldSourceAwareExternalAccuracyProofV1 = {
  schema: "forward-gold-source-aware-external-accuracy-proof-v1";
  bookId: string;
  sourceHash: string;
  allFinalSourceLanesPass: boolean;
  chapters: ForwardGoldSourceLaneEvidenceV1[];
  proofSha256: string;
};

export type ForwardGoldBlindRaterValidationContextV1 = ForwardGoldEvaluationValidationContextV1 & {
  expectedRaterRole: "primary" | "verification";
  expectedDispatchReceiptSha256: string;
};

export type ForwardGoldAdjudicationValidationContextV1 = ForwardGoldEvaluationValidationContextV1 & {
  sourceAwareExternalAccuracy: ForwardGoldSourceAwareExternalAccuracyProofV1;
  expectedSourceLaneEvidence: ForwardGoldSourceLaneEvidenceV1[];
  blindRaters: {
    primary: { output: unknown; expectedDispatchReceiptSha256: string };
    verification: { output: unknown; expectedDispatchReceiptSha256: string };
  };
};

export type ForwardGoldValidatedRaterSummaryV1 = {
  bookId: string;
  sourceHash: string;
  chapterCount: number;
  contentDesignScore: number;
};

const ARITHMETIC_TOLERANCE = 1e-9;
const GATE_STATUSES = new Set(["pass", "conditional", "fail", "not_assessed", "unevaluable"]);

function record(value: unknown, label: string): Record<string, unknown> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string): string {
  requireCondition(typeof value === "string" && value.trim().length > 0, `${label} must be a non-empty string`);
  return value;
}

function sha(value: unknown, label: string): string {
  const text = nonEmptyString(value, label);
  requireCondition(SHA256.test(text), `${label} must be a lowercase SHA-256`);
  return text;
}

function chapterContentHash(value: unknown, label: string): string {
  const text = nonEmptyString(value, label);
  requireCondition(CHAPTER_CONTENT_HASH.test(text),
    `${label} must be the canonical 16-hex ChapterV21 content hash`);
  return text;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  requireCondition(actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    `${label} keys differ from the fixed schema: expected ${wanted.join(",")}, got ${actual.join(",")}`);
}

function stringArray(value: unknown, label: string, minimum = 0): string[] {
  requireCondition(Array.isArray(value) && value.length >= minimum
    && value.every((item) => typeof item === "string" && item.trim().length > 0),
  `${label} must contain at least ${minimum} non-empty string(s)`);
  return value as string[];
}

function requireUniquePrimitiveValues(
  value: unknown,
  label: string,
): asserts value is Array<string | number> {
  requireCondition(Array.isArray(value), `${label} must be an array`);
  const seen = new Set<string | number>();
  for (const item of value) {
    requireCondition(typeof item === "string" || typeof item === "number",
      `${label} must contain only primitive string/number values`);
    requireCondition(!seen.has(item), `${label}: duplicate value ${JSON.stringify(item)}`);
    seen.add(item);
  }
}

function validateGoldComponentInventory(
  value: unknown,
  expected: ForwardGoldComponentInventoryV1 | undefined,
): void {
  const inventory = record(value, "gold evaluator component_inventory");
  exactKeys(inventory, [
    "examples", "quiz_questions", "review_cards", "implementation_items",
    "exercises", "memorable_lines", "other",
  ], "gold evaluator component_inventory");
  for (const key of [
    "examples", "quiz_questions", "review_cards", "implementation_items", "exercises", "memorable_lines",
  ] as const) {
    requireCondition(Number.isSafeInteger(inventory[key]) && Number(inventory[key]) >= 0,
      `gold evaluator component_inventory.${key} must be a non-negative integer`);
  }
  const other = record(inventory.other, "gold evaluator component_inventory.other");
  const keys = Object.keys(other).sort();
  const jsonKeys = [...FORWARD_GOLD_JSON_OTHER_COMPONENT_KEYS].sort();
  requireCondition(keys.length === 0 || keys.length === jsonKeys.length
    && keys.every((key, index) => key === jsonKeys[index]),
  "gold evaluator component_inventory.other must be empty for text or use the fixed JSON-package keys");
  for (const [key, count] of Object.entries(other)) {
    requireCondition(Number.isSafeInteger(count) && Number(count) >= 0,
      `gold evaluator component_inventory.other.${key} must be a non-negative integer`);
  }
  if (expected !== undefined) {
    requireCondition(hashCanonical(inventory) === hashCanonical(expected),
      "gold evaluator component_inventory differs from the deterministic frozen-package inventory");
  }
}

function validateGoldRemovedMinLengthConstraints(
  output: Record<string, unknown>,
  args: ForwardGoldEvaluationValidationContextV1,
): void {
  nonEmptyString(output.run_id, "gold evaluator run_id");
  nonEmptyString(output.job_id, "gold evaluator job_id");
  const book = record(output.book, "gold evaluator book declaration");
  for (const key of [
    "book_id", "title", "package_path", "package_format", "nonfiction_type",
    "declared_or_inferred_audience", "assumed_prior_knowledge", "declared_or_inferred_purpose",
  ] as const) nonEmptyString(book[key], `gold evaluator book.${key}`);
  // The retained slug pattern already excludes the empty string.
  validateGoldComponentInventory(book.component_inventory, args.expectedComponentInventory);

  requireCondition(Array.isArray(output.technical_findings), "gold evaluator technical_findings must be an array");
  output.technical_findings.forEach((raw, index) => {
    const finding = record(raw, `gold evaluator technical_findings[${index}]`);
    for (const key of ["locator", "description", "scoring_treatment"] as const) {
      nonEmptyString(finding[key], `gold evaluator technical_findings[${index}].${key}`);
    }
  });

  const analysis = record(output.analysis, "gold evaluator analysis");
  for (const key of [
    "overall_reader_experience", "comprehension_and_retention_support", "practical_use_and_judgment",
    "best_fit_reader", "readers_who_may_struggle", "final_verdict",
  ] as const) nonEmptyString(analysis[key], `gold evaluator analysis.${key}`);
  stringArray(analysis.highest_impact_improvements, "gold evaluator analysis.highest_impact_improvements", 3);
  requireCondition(Array.isArray(analysis.engagement_curve), "gold evaluator analysis.engagement_curve must be an array");
  analysis.engagement_curve.forEach((raw, index) => {
    const item = record(raw, `gold evaluator analysis.engagement_curve[${index}]`);
    nonEmptyString(item.chapter_range, `gold evaluator analysis.engagement_curve[${index}].chapter_range`);
    nonEmptyString(item.explanation, `gold evaluator analysis.engagement_curve[${index}].explanation`);
  });
}

function validateEvidence(value: unknown, label: string): void {
  const evidence = record(value, label);
  exactKeys(evidence, ["package_path", "chapter", "section", "item_id", "paraphrase"], label);
  nonEmptyString(evidence.package_path, `${label}.package_path`);
  nonEmptyString(evidence.chapter, `${label}.chapter`);
  nonEmptyString(evidence.paraphrase, `${label}.paraphrase`);
  requireCondition(evidence.section === null || typeof evidence.section === "string", `${label}.section must be string or null`);
  requireCondition(evidence.item_id === null || typeof evidence.item_id === "string", `${label}.item_id must be string or null`);
  requireCondition((typeof evidence.section === "string" && evidence.section.trim().length > 0)
    || (typeof evidence.item_id === "string" && evidence.item_id.trim().length > 0),
  `${label} needs a precise section or item_id locator`);
}

function evidenceArray(value: unknown, label: string, minimum: number): unknown[] {
  requireCondition(Array.isArray(value) && value.length >= minimum, `${label} must contain at least ${minimum} evidence item(s)`);
  value.forEach((item, index) => validateEvidence(item, `${label}[${index}]`));
  return value;
}

function validateAllEvidenceLocators(value: unknown, args: ForwardGoldEvaluationValidationContextV1): void {
  const byChapter = new Map(args.expectedChapters.map((chapter) => [chapter.chapterId, chapter]));
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, `${path}[${index}]`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    const object = node as Record<string, unknown>;
    const evidenceKeys = ["package_path", "chapter", "section", "item_id", "paraphrase"];
    if (evidenceKeys.every((key) => key in object)) {
      validateEvidence(object, path);
      const chapter = byChapter.get(String(object.chapter));
      requireCondition(chapter !== undefined, `${path}.chapter is outside the frozen chapter inventory`);
      requireCondition(object.package_path === chapter.packagePath,
        `${path}.package_path is not the frozen path for ${chapter.chapterId}`);
    }
    for (const [key, child] of Object.entries(object)) walk(child, `${path}.${key}`);
  };
  walk(value, "$retained");
}

function validateExpectedContext(args: ForwardGoldEvaluationValidationContextV1): void {
  nonEmptyString(args.expectedBookId, "expected gold book id");
  sha(args.expectedSourceHash, "expected gold source hash");
  requireCondition(Array.isArray(args.expectedChapters) && args.expectedChapters.length >= 8,
    "expected gold chapter inventory must contain the complete book (at least eight chapters)");
  const indexes = new Set<number>();
  const ids = new Set<string>();
  const packagePaths = new Set<string>();
  for (const [position, chapter] of args.expectedChapters.entries()) {
    requireCondition(Number.isInteger(chapter.chapterIndex) && chapter.chapterIndex > 0,
      `expected gold chapter[${position}] has an invalid index`);
    nonEmptyString(chapter.chapterId, `expected gold chapter[${position}].chapterId`);
    nonEmptyString(chapter.title, `expected gold chapter[${position}].title`);
    nonEmptyString(chapter.packagePath, `expected gold chapter[${position}].packagePath`);
    requireCondition(!indexes.has(chapter.chapterIndex), `expected gold chapter inventory repeats index ${chapter.chapterIndex}`);
    requireCondition(!ids.has(chapter.chapterId), `expected gold chapter inventory repeats id ${chapter.chapterId}`);
    requireCondition(!packagePaths.has(chapter.packagePath), `expected gold chapter inventory repeats path ${chapter.packagePath}`);
    indexes.add(chapter.chapterIndex);
    ids.add(chapter.chapterId);
    packagePaths.add(chapter.packagePath);
  }
}

function validateCoverage(
  output: Record<string, unknown>,
  args: ForwardGoldEvaluationValidationContextV1,
): void {
  validateExpectedContext(args);
  requireCondition(output.source_hash === args.expectedSourceHash, "gold evaluator source_hash differs from the frozen source inventory");
  const book = record(output.book, "gold evaluator book declaration");
  requireCondition(book.book_id === args.expectedBookId, "gold evaluator book_id differs from the frozen book");
  const count = args.expectedChapters.length;
  requireCondition(book.chapter_count_expected === count && book.chapter_count_read_full === count,
    "gold evaluator book counts do not equal the frozen full-book denominator");
  requireCondition(book.chapter_count_partial === 0 && book.chapter_count_inaccessible === 0
    && book.all_accessible_chapters_read === true,
  "gold evaluator claims partial/inaccessible or unread chapter content");
  requireCondition(Array.isArray(output.chapter_evidence) && output.chapter_evidence.length === count,
    "gold evaluator chapter evidence does not equal the frozen full-book denominator");
  output.chapter_evidence.forEach((raw, position) => {
    const actual = record(raw, `gold chapter evidence[${position}]`);
    const expected = args.expectedChapters[position];
    requireCondition(actual.chapter_index === expected.chapterIndex
      && actual.chapter_id === expected.chapterId
      && actual.title === expected.title,
    `gold chapter evidence[${position}] differs from frozen chapter ${expected.chapterId}`);
    requireCondition(actual.read_status === "full", `gold chapter evidence[${position}] is not a full read`);
    stringArray(actual.central_ideas, `gold chapter evidence[${position}].central_ideas`, 1);
    for (const key of ["mental_model_contribution", "engagement_and_pacing", "learning_support", "retention_support", "transfer_support"] as const) {
      nonEmptyString(actual[key], `gold chapter evidence[${position}].${key}`);
    }
    stringArray(actual.trust_qa_safety_issues, `gold chapter evidence[${position}].trust_qa_safety_issues`, 0);
    const chapterEvidence = evidenceArray(actual.evidence, `gold chapter evidence[${position}].evidence`, 1);
    for (const [evidenceIndex, item] of chapterEvidence.entries()) {
      const locator = record(item, `gold chapter evidence[${position}].evidence[${evidenceIndex}]`);
      requireCondition(locator.chapter === expected.chapterId && locator.package_path === expected.packagePath,
        `gold chapter evidence[${position}].evidence[${evidenceIndex}] is not bound to ${expected.chapterId}`);
    }
  });
  validateAllEvidenceLocators(output, args);
}

function validateQa(output: Record<string, unknown>): void {
  const qa = record(output.qa, "gold evaluator QA");
  exactKeys(qa, [
    "all_36_subcriteria_present", "evidence_minimums_pass", "calculation_check_pass",
    "semantic_quiz_issues", "formulaic_pattern_notes", "unsupported_outcome_claims_found",
    "self_validation_notes",
  ], "gold evaluator QA");
  requireCondition(qa.all_36_subcriteria_present === true, "gold evaluator QA did not confirm all 36 subcriteria");
  requireCondition(qa.evidence_minimums_pass === true, "gold evaluator QA did not confirm evidence minimums");
  requireCondition(qa.calculation_check_pass === true, "gold evaluator QA did not confirm its arithmetic");
  requireCondition(qa.unsupported_outcome_claims_found === false, "gold evaluator made unsupported reader-outcome claims");
  stringArray(qa.semantic_quiz_issues, "gold evaluator QA semantic_quiz_issues", 0);
  stringArray(qa.formulaic_pattern_notes, "gold evaluator QA formulaic_pattern_notes", 0);
  stringArray(qa.self_validation_notes, "gold evaluator QA self_validation_notes", 1);
}

function closeEnough(actual: unknown, expected: number, label: string): void {
  requireCondition(typeof actual === "number" && Number.isFinite(actual)
    && Math.abs(actual - expected) <= ARITHMETIC_TOLERANCE,
  `${label} arithmetic mismatch: expected ${expected}, got ${String(actual)}`);
}

function validateDomains(output: Record<string, unknown>, ratingStep: 0.5 | 1): number {
  const domains = record(output.domains, "gold evaluator domains");
  const domainNames = FORWARD_GOLD_RUBRIC_CONFIG.domains.map((domain) => domain.id);
  exactKeys(domains, domainNames, "gold evaluator domains");
  let total = 0;
  for (const config of FORWARD_GOLD_RUBRIC_CONFIG.domains) {
    const domain = record(domains[config.id], `gold domain ${config.id}`);
    exactKeys(domain, ["weight", "subcriteria", "whole_book_pattern", "domain_score", "weighted_points"], `gold domain ${config.id}`);
    requireCondition(domain.weight === config.weight, `gold domain ${config.id} weight drift`);
    nonEmptyString(domain.whole_book_pattern, `gold domain ${config.id}.whole_book_pattern`);
    const subcriteria = record(domain.subcriteria, `gold domain ${config.id}.subcriteria`);
    exactKeys(subcriteria, config.subcriteria, `gold domain ${config.id}.subcriteria`);
    let ratingTotal = 0;
    let strengthCount = 0;
    let limitationCount = 0;
    for (const name of config.subcriteria) {
      const ratingRecord = record(subcriteria[name], `gold subcriterion ${config.id}.${name}`);
      exactKeys(ratingRecord, ["rating", "rationale", "strength_evidence", "limitation_evidence"],
        `gold subcriterion ${config.id}.${name}`);
      const rating = ratingRecord.rating;
      requireCondition(typeof rating === "number" && Number.isFinite(rating) && rating >= 0 && rating <= 4
        && Number.isInteger(rating / ratingStep),
      `gold subcriterion ${config.id}.${name} rating must be a ${ratingStep}-step value from 0 to 4`);
      nonEmptyString(ratingRecord.rationale, `gold subcriterion ${config.id}.${name}.rationale`);
      strengthCount += evidenceArray(ratingRecord.strength_evidence,
        `gold subcriterion ${config.id}.${name}.strength_evidence`, 0).length;
      limitationCount += evidenceArray(ratingRecord.limitation_evidence,
        `gold subcriterion ${config.id}.${name}.limitation_evidence`, 0).length;
      ratingTotal += rating;
    }
    requireCondition(strengthCount >= 2, `gold domain ${config.id} has fewer than two chapter-level strengths`);
    requireCondition(limitationCount >= 1, `gold domain ${config.id} has no chapter-level limitation`);
    const domainScore = ratingTotal / config.subcriteria.length;
    const weightedPoints = (domainScore / 4) * config.weight;
    closeEnough(domain.domain_score, domainScore, `gold domain ${config.id}.domain_score`);
    closeEnough(domain.weighted_points, weightedPoints, `gold domain ${config.id}.weighted_points`);
    total += weightedPoints;
  }
  closeEnough(output.overall_score, total, "gold evaluator overall_score");
  return total;
}

function validateGates(output: Record<string, unknown>): Record<string, unknown> {
  const gates = record(output.gates, "gold evaluator gates");
  exactKeys(gates, FORWARD_GOLD_RUBRIC_CONFIG.hardGates, "gold evaluator gates");
  for (const key of FORWARD_GOLD_RUBRIC_CONFIG.hardGates) {
    const gate = record(gates[key], `gold gate ${key}`);
    exactKeys(gate, ["status", "rationale", "evidence"], `gold gate ${key}`);
    requireCondition(GATE_STATUSES.has(String(gate.status)), `gold gate ${key} has an invalid status`);
    nonEmptyString(gate.rationale, `gold gate ${key}.rationale`);
    evidenceArray(gate.evidence, `gold gate ${key}.evidence`, gate.status === "pass" ? 1 : 0);
  }
  requireCondition(record(gates.external_accuracy, "gold external_accuracy gate").status === "not_assessed",
    "normative isolated Rubric v2 evaluator must leave external_accuracy not_assessed");
  return gates;
}

function validateEvaluationCore(
  value: unknown,
  args: ForwardGoldEvaluationValidationContextV1,
  expectedRole: "primary" | "verification" | "adjudicated",
  ratingStep: 0.5 | 1,
): { output: Record<string, unknown>; gates: Record<string, unknown>; score: number } {
  validateAgainstPinnedOutputSchema(value,
    expectedRole === "adjudicated" ? "adjudicator-output-schema" : "blind-rater-output-schema",
    resolve(args.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT));
  const output = record(value, "gold evaluator output");
  requireCondition(output.schema_version === "2.0.0", "gold evaluator output has the wrong schema version");
  requireCondition(output.rater_role === expectedRole, `gold evaluator output has the wrong role (expected ${expectedRole})`);
  validateGoldRemovedMinLengthConstraints(output, args);
  validateCoverage(output, args);
  validateQa(output);
  const score = validateDomains(output, ratingStep);
  const gates = validateGates(output);
  return { output, gates, score };
}

export function validateForwardGoldBlindRaterOutput(
  value: unknown,
  args: ForwardGoldBlindRaterValidationContextV1,
): ForwardGoldValidatedRaterSummaryV1 {
  return validatedBlindRater(value, args).summary;
}

function validatedBlindRater(
  value: unknown,
  args: ForwardGoldBlindRaterValidationContextV1,
): ReturnType<typeof validateEvaluationCore> & { summary: ForwardGoldValidatedRaterSummaryV1 } {
  sha(args.expectedDispatchReceiptSha256, "expected blind-rater dispatch receipt hash");
  const validated = validateEvaluationCore(value, args, args.expectedRaterRole, 1);
  requireCondition(validated.output.worker_dispatch_receipt_sha256 === args.expectedDispatchReceiptSha256,
    "blind-rater output is bound to another dispatch receipt");
  return {
    ...validated,
    summary: {
      bookId: args.expectedBookId,
      sourceHash: args.expectedSourceHash,
      chapterCount: args.expectedChapters.length,
      contentDesignScore: validated.score,
    },
  };
}

function ratingEntries(output: Record<string, unknown>): Array<{ path: string; rating: number }> {
  const domains = record(output.domains, "gold evaluator domains for agreement");
  const entries: Array<{ path: string; rating: number }> = [];
  for (const domain of FORWARD_GOLD_RUBRIC_CONFIG.domains) {
    const subcriteria = record(record(domains[domain.id], `agreement domain ${domain.id}`).subcriteria,
      `agreement domain ${domain.id}.subcriteria`);
    for (const name of domain.subcriteria) {
      const rating = record(subcriteria[name], `agreement subcriterion ${domain.id}.${name}`).rating;
      requireCondition(typeof rating === "number", `agreement subcriterion ${domain.id}.${name} has no rating`);
      entries.push({ path: `domains.${domain.id}.subcriteria.${name}`, rating });
    }
  }
  return entries;
}

function expectedCertification(gates: Record<string, unknown>): "pass" | "conditional" | "fail" | "unevaluable" {
  const status = (key: string) => String(record(gates[key], `certification gate ${key}`).status);
  const core = [
    status("technical_completeness"),
    status("epistemic_instructional_safety"),
    status("ethics_reader_autonomy"),
    status("purpose_audience_declaration"),
  ];
  if (status("technical_completeness") === "fail"
    || status("epistemic_instructional_safety") === "fail"
    || status("ethics_reader_autonomy") === "fail") return "fail";
  if (core.includes("unevaluable")) return "unevaluable";
  if (status("purpose_audience_declaration") === "fail") return "unevaluable";
  if (core.includes("conditional")) return "conditional";
  return core.every((value) => value === "pass") ? "pass" : "unevaluable";
}

function expectedClassification(
  output: Record<string, unknown>,
  score: number,
  certification: string,
): string {
  if (certification === "unevaluable") return "Unevaluable";
  const domains = record(output.domains, "gold classification domains");
  const coreIds = FORWARD_GOLD_RUBRIC_CONFIG.domains.slice(0, 6).map((domain) => domain.id);
  const coreAtLeastThree = coreIds.every((id) => {
    const value = record(domains[id], `gold classification domain ${id}`).domain_score;
    return typeof value === "number" && value >= 3;
  });
  if (score >= 90 && certification === "pass" && coreAtLeastThree) {
    return "Reference-standard design, subject to gate and core-domain rules";
  }
  if (score >= 80) return "Strong design with identifiable improvements";
  if (score >= 70) return "Valuable but materially uneven; targeted redesign needed";
  if (score >= 60) return "Substantial redesign needed";
  return "Not ready as a ChapterFlow learning product";
}

function validateAdjudicationAgainstBlindRaters(
  adjudicated: ReturnType<typeof validateEvaluationCore>,
  primary: ReturnType<typeof validatedBlindRater>,
  verification: ReturnType<typeof validatedBlindRater>,
): void {
  requireCondition(Array.isArray(adjudicated.output.calibration_changes)
    && adjudicated.output.calibration_changes.length === 0,
  "forward-only gold adjudication must not contain cross-book calibration changes");
  const runId = nonEmptyString(adjudicated.output.run_id, "gold adjudication run_id");
  requireCondition(primary.output.run_id === runId && verification.output.run_id === runId,
    "gold adjudication and blind raters do not share one run_id");
  const adjudicationJob = nonEmptyString(adjudicated.output.job_id, "gold adjudication job_id");
  const primaryJob = nonEmptyString(primary.output.job_id, "primary blind-rater job_id");
  const verificationJob = nonEmptyString(verification.output.job_id, "verification blind-rater job_id");
  requireCondition(new Set([adjudicationJob, primaryJob, verificationJob]).size === 3,
    "gold adjudication/blind raters reuse a job identity");
  const strippedJudgmentHash = (output: Record<string, unknown>): string => {
    const clone = JSON.parse(JSON.stringify(output)) as Record<string, unknown>;
    for (const key of ["run_id", "job_id", "rater_role", "worker_dispatch_receipt_sha256"]) delete clone[key];
    return hashCanonical(clone);
  };
  requireCondition(strippedJudgmentHash(primary.output) !== strippedJudgmentHash(verification.output),
    "gold blind-rater judgments are identical after administrative fields are stripped");
  const primaryRatings = ratingEntries(primary.output);
  const verificationRatings = ratingEntries(verification.output);
  const finalRatings = ratingEntries(adjudicated.output);
  requireCondition(primaryRatings.length === 36 && verificationRatings.length === 36 && finalRatings.length === 36,
    "gold adjudication agreement does not cover all 36 ratings");
  const differences = primaryRatings.map((entry, index) => Math.abs(entry.rating - verificationRatings[index].rating));
  const mean = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  const maximum = Math.max(...differences);
  const overallDifference = Math.abs(primary.score - verification.score);
  const agreement = record(adjudicated.output.rater_agreement, "gold adjudication rater_agreement");
  closeEnough(agreement.mean_absolute_subcriterion_difference, mean,
    "gold rater_agreement.mean_absolute_subcriterion_difference");
  closeEnough(agreement.maximum_subcriterion_difference, maximum,
    "gold rater_agreement.maximum_subcriterion_difference");
  closeEnough(agreement.overall_score_difference, overallDifference,
    "gold rater_agreement.overall_score_difference");

  const expectedDisagreements = differences.map((difference, index) => ({ difference, index }))
    .filter(({ difference, index }) => difference > 0
      || finalRatings[index].rating !== primaryRatings[index].rating
      || finalRatings[index].rating !== verificationRatings[index].rating);
  requireCondition(Array.isArray(agreement.disagreements)
    && agreement.disagreements.length === expectedDisagreements.length,
  "gold adjudication disagreement inventory differs from the two retained blind raters");
  expectedDisagreements.forEach(({ index }, position) => {
    const actual = record((agreement.disagreements as unknown[])[position], `gold disagreement[${position}]`);
    requireCondition(actual.path === primaryRatings[index].path
      && actual.primary === primaryRatings[index].rating
      && actual.verification === verificationRatings[index].rating
      && actual.final === finalRatings[index].rating,
    `gold disagreement[${position}] differs from retained blind/final ratings`);
    nonEmptyString(actual.adjudication_rationale,
      `gold disagreement[${position}].adjudication_rationale`);
    evidenceArray(actual.evidence, `gold disagreement[${position}].evidence`, 1);
  });

  const expectedGateConflicts = FORWARD_GOLD_RUBRIC_CONFIG.hardGates.filter((key) => {
    const primaryStatus = record(primary.gates[key], `primary gate ${key}`).status;
    const verificationStatus = record(verification.gates[key], `verification gate ${key}`).status;
    const finalStatus = record(adjudicated.gates[key], `adjudicated gate ${key}`).status;
    return primaryStatus !== verificationStatus || finalStatus !== primaryStatus || finalStatus !== verificationStatus;
  });
  requireCondition(Array.isArray(agreement.gate_conflicts)
    && agreement.gate_conflicts.length === expectedGateConflicts.length,
  "gold adjudication gate-conflict inventory differs from the two retained blind raters");
  expectedGateConflicts.forEach((key, position) => {
    const actual = record((agreement.gate_conflicts as unknown[])[position], `gold gate conflict[${position}]`);
    requireCondition(actual.gate === key
      && actual.primary === record(primary.gates[key], `primary gate ${key}`).status
      && actual.verification === record(verification.gates[key], `verification gate ${key}`).status
      && actual.final === record(adjudicated.gates[key], `adjudicated gate ${key}`).status,
    `gold gate conflict[${position}] differs from retained blind/final gates`);
    nonEmptyString(actual.rationale, `gold gate conflict[${position}].rationale`);
    evidenceArray(actual.evidence, `gold gate conflict[${position}].evidence`, 1);
  });

  const confidence = record(adjudicated.output.confidence, "gold adjudication confidence");
  nonEmptyString(confidence.rationale, "gold adjudication confidence.rationale");

  const certification = expectedCertification(adjudicated.gates);
  requireCondition(adjudicated.output.certification_status === certification,
    `gold adjudication certification_status mismatch: expected ${certification}`);
  const classification = expectedClassification(adjudicated.output, adjudicated.score, certification);
  requireCondition(adjudicated.output.classification === classification,
    `gold adjudication classification mismatch: expected ${classification}`);
}

/** Bind the independent sweep's schema-enforced top-level echoes to the
 * authoritative evaluator inventory and its role-specific dispatch receipt. */
export function validateForwardGoldSweepOutputBinding(
  value: unknown,
  args: {
    expectedBookId: string;
    expectedSourceHash: string;
    expectedDispatchReceiptSha256: string;
    expectedChapters: ForwardGoldExpectedChapterIdentityV1[];
    repositoryRoot?: string;
  },
): void {
  validateAgainstPinnedOutputSchema(value, "sweep-output-schema",
    resolve(args.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT), args.expectedChapters);
  nonEmptyString(args.expectedBookId, "expected sweep book id");
  sha(args.expectedSourceHash, "expected sweep source hash");
  sha(args.expectedDispatchReceiptSha256, "expected sweep dispatch receipt hash");
  const output = record(value, "gold sweep output");
  requireCondition(output.source_hash === args.expectedSourceHash,
    "gold sweep output is bound to another source inventory");
  requireCondition(output.worker_dispatch_receipt_sha256 === args.expectedDispatchReceiptSha256,
    "gold sweep output is bound to another dispatch receipt");
  const sweep = record(output.sweep, "gold sweep artifact");
  requireCondition(sweep.schemaVersion === "sweep-attest-v1", "gold sweep has the wrong schemaVersion");
  requireCondition(nonEmptyString(sweep.bookId, "gold sweep bookId") === args.expectedBookId,
    "gold sweep output is bound to another book");
  nonEmptyString(sweep.roundId, "gold sweep roundId");
  nonEmptyString(sweep.reviewer, "gold sweep reviewer");
  nonEmptyString(sweep.reviewerSessionId, "gold sweep reviewerSessionId");
  const attestedAt = nonEmptyString(sweep.attestedAt, "gold sweep attestedAt");
  requireCondition(!Number.isNaN(Date.parse(attestedAt)), "gold sweep attestedAt must be a date-time");

  const contentHashes = record(sweep.contentHashes, "gold sweep contentHashes");
  const expectedIndexes = args.expectedChapters.map((chapter) => chapter.chapterIndex);
  requireCondition(args.expectedChapters.length >= 8
    && expectedIndexes.every((index) => Number.isInteger(index) && index > 0)
    && new Set(expectedIndexes).size === expectedIndexes.length,
  "gold sweep expected chapters must contain at least eight distinct positive indexes");
  const expectedKeys = expectedIndexes.map(String).sort((a, b) => Number(a) - Number(b));
  exactKeys(contentHashes, expectedKeys, "gold sweep contentHashes");
  for (const key of expectedKeys) chapterContentHash(contentHashes[key], `gold sweep contentHashes.${key}`);

  requireUniquePrimitiveValues(sweep.checkedFamilies, "gold sweep checkedFamilies");
  requireCondition(Array.isArray(sweep.findings), "gold sweep findings must be an array");
  sweep.findings.forEach((raw, index) => {
    const finding = record(raw, `gold sweep findings[${index}]`);
    requireUniquePrimitiveValues(finding.chapters, `gold sweep findings[${index}].chapters`);
    for (const key of ["unitId", "quote", "problem", "expectedFix"] as const) {
      nonEmptyString(finding[key], `gold sweep findings[${index}].${key}`);
    }
  });
}

function sourceProofPayload(value: ForwardGoldSourceAwareExternalAccuracyProofV1): unknown {
  const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  delete clone.proofSha256;
  return clone;
}

export function computeForwardGoldSourceAwareExternalAccuracyProofSha256(
  value: ForwardGoldSourceAwareExternalAccuracyProofV1,
): string {
  return hashCanonical(sourceProofPayload(value));
}

export function buildForwardGoldSourceAwareExternalAccuracyProof(
  value: Omit<ForwardGoldSourceAwareExternalAccuracyProofV1, "schema" | "allFinalSourceLanesPass" | "proofSha256">,
): Readonly<ForwardGoldSourceAwareExternalAccuracyProofV1> {
  const allFinalSourceLanesPass = value.chapters.every((chapter) => chapter.sourceStatus === "PASS"
    && chapter.sourceBlockerCount === 0 && chapter.evidenceFresh === true);
  const proof: ForwardGoldSourceAwareExternalAccuracyProofV1 = {
    schema: "forward-gold-source-aware-external-accuracy-proof-v1",
    ...JSON.parse(JSON.stringify(value)) as typeof value,
    allFinalSourceLanesPass,
    proofSha256: "",
  };
  proof.proofSha256 = computeForwardGoldSourceAwareExternalAccuracyProofSha256(proof);
  return deepFreeze(proof);
}

function validateSourceAwareProof(
  proof: ForwardGoldSourceAwareExternalAccuracyProofV1,
  args: ForwardGoldAdjudicationValidationContextV1,
): boolean {
  const raw = record(proof, "gold source-aware external-accuracy proof");
  const value = raw as unknown as ForwardGoldSourceAwareExternalAccuracyProofV1;
  exactKeys(raw, ["schema", "bookId", "sourceHash", "allFinalSourceLanesPass", "chapters", "proofSha256"],
    "gold source-aware external-accuracy proof");
  requireCondition(value.schema === "forward-gold-source-aware-external-accuracy-proof-v1",
    "gold source-aware proof has the wrong schema");
  requireCondition(value.bookId === args.expectedBookId && value.sourceHash === args.expectedSourceHash,
    "gold source-aware proof is bound to another book/source inventory");
  sha(value.proofSha256, "gold source-aware proof hash");
  requireCondition(value.proofSha256 === computeForwardGoldSourceAwareExternalAccuracyProofSha256(value),
    "gold source-aware proof self hash mismatch");
  requireCondition(Array.isArray(value.chapters) && value.chapters.length === args.expectedChapters.length,
    "gold source-aware proof has the wrong chapter denominator");
  requireCondition(Array.isArray(args.expectedSourceLaneEvidence)
    && args.expectedSourceLaneEvidence.length === args.expectedChapters.length,
  "authoritative retained source-lane evidence has the wrong chapter denominator");
  value.chapters.forEach((chapter, position) => {
    exactKeys(record(chapter, `gold source-aware proof chapter[${position}]`), [
      "chapterIndex", "chapterId", "title", "packagePath", "candidateContentSha256", "sourceResultSha256",
      "executionEnvelopeSha256", "sourceStatus", "sourceBlockerCount", "evidenceFresh",
    ], `gold source-aware proof chapter[${position}]`);
    const expected = args.expectedChapters[position];
    requireCondition(chapter.chapterIndex === expected.chapterIndex && chapter.chapterId === expected.chapterId
      && chapter.title === expected.title && chapter.packagePath === expected.packagePath,
    `gold source-aware proof chapter[${position}] differs from frozen inventory`);
    const authoritative = args.expectedSourceLaneEvidence[position];
    requireCondition(authoritative !== undefined
      && chapter.chapterIndex === authoritative.chapterIndex
      && chapter.chapterId === authoritative.chapterId
      && chapter.title === authoritative.title
      && chapter.packagePath === authoritative.packagePath
      && chapter.candidateContentSha256 === authoritative.candidateContentSha256
      && chapter.sourceResultSha256 === authoritative.sourceResultSha256
      && chapter.executionEnvelopeSha256 === authoritative.executionEnvelopeSha256
      && chapter.sourceStatus === authoritative.sourceStatus
      && chapter.sourceBlockerCount === authoritative.sourceBlockerCount
      && chapter.evidenceFresh === authoritative.evidenceFresh,
    `gold source-aware proof chapter[${position}] differs from authoritative retained source-lane evidence`);
    chapterContentHash(chapter.candidateContentSha256,
      `gold source-aware proof chapter[${position}].candidateContentSha256`);
    sha(chapter.sourceResultSha256, `gold source-aware proof chapter[${position}].sourceResultSha256`);
    sha(chapter.executionEnvelopeSha256, `gold source-aware proof chapter[${position}].executionEnvelopeSha256`);
    requireCondition(["PASS", "REVISE", "INCONCLUSIVE"].includes(chapter.sourceStatus),
      `gold source-aware proof chapter[${position}] has an invalid source status`);
    requireCondition(Number.isInteger(chapter.sourceBlockerCount) && chapter.sourceBlockerCount >= 0,
      `gold source-aware proof chapter[${position}] has an invalid blocker count`);
    requireCondition(typeof chapter.evidenceFresh === "boolean",
      `gold source-aware proof chapter[${position}] has an invalid freshness flag`);
  });
  const recomputed = value.chapters.every((chapter) => chapter.sourceStatus === "PASS"
    && chapter.sourceBlockerCount === 0 && chapter.evidenceFresh === true);
  requireCondition(value.allFinalSourceLanesPass === recomputed,
    "gold source-aware proof allFinalSourceLanesPass assertion is inconsistent with chapter evidence");
  return recomputed;
}

function projectedGate(gates: Record<string, unknown>, key: string): "PASS" | "FAIL" {
  const gate = record(gates[key], `adjudicated gold gate ${key}`);
  return gate.status === "pass" ? "PASS" : "FAIL";
}

/** Deterministic compatibility projection for the campaign's six final fields.
 * Five fields are derived from validated Rubric v2 records and recomputed
 * arithmetic.  External accuracy comes only from the separately bound,
 * source-aware final-lane proof; the source-blind rubric evaluator truthfully
 * remains `not_assessed`. */
export function projectForwardGoldAdjudication(
  value: unknown,
  args: ForwardGoldAdjudicationValidationContextV1,
): ForwardGoldAdjudicationProjectionV1 {
  const validated = validateEvaluationCore(value, args, "adjudicated", 0.5);
  requireCondition(args.blindRaters.primary.expectedDispatchReceiptSha256
    !== args.blindRaters.verification.expectedDispatchReceiptSha256,
  "gold adjudication blind raters reuse one dispatch receipt");
  const primary = validatedBlindRater(args.blindRaters.primary.output, {
    expectedBookId: args.expectedBookId,
    expectedSourceHash: args.expectedSourceHash,
    expectedChapters: args.expectedChapters,
    expectedComponentInventory: args.expectedComponentInventory,
    repositoryRoot: args.repositoryRoot,
    expectedRaterRole: "primary",
    expectedDispatchReceiptSha256: args.blindRaters.primary.expectedDispatchReceiptSha256,
  });
  const verification = validatedBlindRater(args.blindRaters.verification.output, {
    expectedBookId: args.expectedBookId,
    expectedSourceHash: args.expectedSourceHash,
    expectedChapters: args.expectedChapters,
    expectedComponentInventory: args.expectedComponentInventory,
    repositoryRoot: args.repositoryRoot,
    expectedRaterRole: "verification",
    expectedDispatchReceiptSha256: args.blindRaters.verification.expectedDispatchReceiptSha256,
  });
  validateAdjudicationAgainstBlindRaters(validated, primary, verification);
  const sourceAwarePass = validateSourceAwareProof(args.sourceAwareExternalAccuracy, args);
  return {
    technicalCompleteness: projectedGate(validated.gates, "technical_completeness"),
    epistemicInstructionalSafety: projectedGate(validated.gates, "epistemic_instructional_safety"),
    ethicsReaderAutonomy: projectedGate(validated.gates, "ethics_reader_autonomy"),
    purposeAudienceDeclaration: projectedGate(validated.gates, "purpose_audience_declaration"),
    externalAccuracy: sourceAwarePass ? "PASS" : "FAIL",
    contentDesignScore: validated.score,
  };
}
