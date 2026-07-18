/** Deterministically materialize the IMP-24F reader adjudication packet and result. */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { writeFileAtomic } from "../src/lib/atomicWrite.js";
import { completeKeyFreeReaderDocumentSha256V2 } from "../src/review/completeKeyFreeReaderDocumentV2.js";
import {
  QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION,
  QUIZ_INTEGRITY_SEMANTIC_SHA256,
} from "../src/review/quizIntegritySemanticRules.js";
import {
  READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION,
  READER_EXPERIENCE_SEMANTIC_SHA256,
} from "../src/review/readerExperienceSemanticRubric.js";
import {
  SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION,
  SOURCE_INTEGRITY_SEMANTIC_SHA256,
} from "../src/review/sourceIntegritySemanticRules.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { canonicalPretty } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  buildImp24CorpusBundle,
  loadImp24FrozenV2Inputs,
  type Imp24ReaderCase,
} from "../src/bakeoff/migration/imp24Corpus.js";
import {
  IMP24_SEMANTIC_PROMPT_HASHES,
  prepareImp24QualificationCases,
} from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import { IMP24_FROZEN_ROLE_THRESHOLDS } from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { certifyImp24fThresholdCoverage } from "../src/bakeoff/migration/imp24fThresholdCoverageCertification.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const REPORT_DIR = resolve(REPOSITORY_ROOT, "docs/v25/reports");
const CORPUS_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/imp24/role-qualification-corpus-bundle.v3-envelope.json";
const FORENSICS_JSON_REL = "docs/v25/reports/IMP-24F_RETAINED_QUALIFICATION_FORENSICS.json";
const FORENSICS_MD_REL = "docs/v25/reports/IMP-24F_RETAINED_QUALIFICATION_FORENSICS.md";
const PACKET_JSON_REL = "docs/v25/reports/IMP-24F_READER_GOLD_ADJUDICATION_PACKET.json";
const PACKET_MD_REL = "docs/v25/reports/IMP-24F_READER_GOLD_ADJUDICATION_PACKET.md";
const RESULT_JSON_REL = "docs/v25/reports/IMP-24F_INSTRUMENT_REPAIR_RESULT.json";
const RESULT_MD_REL = "docs/v25/reports/IMP-24F_INSTRUMENT_REPAIR_RESULT.md";

type AuditFinding = {
  visibleOriginAmbiguityPresent: true;
  readerAdvisoryDefectPresent: true;
  hardBlockerPresent: false;
  compositeAtLeast80Plausible: boolean;
  reason: string;
};

const AUDIT: Readonly<Record<string, AuditFinding>> = Object.freeze({
  "READER-V3-HOLDOUT-clean-behave-ch01": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "TED2017/April 2017 backstage scenes, Kenyan baboon fieldwork, and weapons-training vignettes read as factual but are not marked hypothetical or composite. Six examples repeat the same time-slicing move; quiz distractors use giveaway absolutes; one memorable-line wording differs from the reader prose.",
  },
  "READER-V3-HOLDOUT-clean-checklist-ch01": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "The Austrian drowning-rescue and superspecialist claims, plus named and timestamped scenes, read as factual without an origin marker. Examples repeat owner assignment and the quiz distractors telegraph their keys.",
  },
  "READER-V3-HOLDOUT-clean-checklist-ch02": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "B-17, Keystone, and Pronovost material reads as factual without an origin marker. The examples repeat the same vital-minimum move and several distractors are weak.",
  },
  "READER-V3-HOLDOUT-clean-decisive-ch02": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "Claireabelle, Quaker, Snapple, and research anecdotes read as factual without an origin marker. Examples recycle the teen/Snapple frame, one review card depends on chapter 1, and distractors are weak.",
  },
  "READER-V3-HOLDOUT-clean-difficult-conversations-ch02": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "Precise named and timed scenes read as factual without a hypothetical/composite marker. Six examples repeat the same pivot and quiz choices contain giveaways.",
  },
  "READER-V3-HOLDOUT-clean-make-it-stick-ch01": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "UCLA extinguisher, Matt Brown, Cessna, and Prist material reads as factual without an origin marker. Examples repeat cue removal, distractors are weak, and density drops through repetition.",
  },
  "READER-V3-HOLDOUT-clean-peak-ch02": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "Exact names, times, and places read as factual without an origin marker. Examples repeat one practice recipe, quiz choices are giveaway-prone, and one sentence is malformed.",
  },
  "READER-V3-HOLDOUT-clean-power-of-moments-ch02": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: false,
    reason: "John Deere, Mary Kay, and Ritz/Joshie branded stories read as factual without an origin marker. The same three stories are recycled throughout, density is low, and distractors are obvious; an intended composite of at least 80 is not credible.",
  },
  "READER-V3-HOLDOUT-clean-willpower-ch01": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "Miller, Cohen, Gage, Cavendish, and 2001 Review claims read as factual without an origin marker. The hook is awkward, research attributions are pasted into scenes, and distractors are straw choices.",
  },
  "READER-V3-HOLDOUT-clean-willpower-ch02": {
    visibleOriginAmbiguityPresent: true,
    readerAdvisoryDefectPresent: true,
    hardBlockerPresent: false,
    compositeAtLeast80Plausible: true,
    reason: "TSST, Segerstrom, Nes, Tang, and Kirschbaum material reads as factual without an origin marker. Research citations are pasted into examples, one review card depends on chapter 1, and distractors are weak.",
  },
});

function bytesSha256(relativePath: string): string {
  return sha256Hex(readFileSync(resolve(REPOSITORY_ROOT, relativePath)));
}

function selfHashed<T extends Record<string, unknown>>(core: T, field: string): T & Record<string, string> {
  return { ...core, [field]: hashCanonical(core) };
}

function escapeMd(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildReaderPacket(cleanCases: Imp24ReaderCase[]) {
  const cases = cleanCases.map((item) => {
    const audit = AUDIT[item.caseId];
    if (!audit) throw new Error(`${item.caseId}: missing independent content-only audit`);
    if (item.kind !== "clean") throw new Error(`${item.caseId}: reader adjudication packet received a non-clean case`);
    return {
      caseId: item.caseId,
      currentGold: {
        kind: item.kind,
        expectedRecommendation: item.expected.expectedRecommendation,
        prohibitBlockingFindings: item.expected.prohibitBlockingFindings,
      },
      readerDocumentSha256: completeKeyFreeReaderDocumentSha256V2(item.chapter),
      independentProvenanceOfCurrentGold: {
        independentHumanRater: item.curation.independentHumanRater,
        labelProvenance: item.curation.labelProvenance,
        goldProvenance: item.imp24.goldProvenance,
        sourceDesignation: item.curation.sourceDesignation,
        ownerApprovedForDevelopmentBakeoff: item.curation.ownerApprovedForDevelopmentBakeoff,
        qualifiesAsIndependentReaderHoldoutGold: false,
      },
      productionRubricAudit: {
        scoreScale: "0-100",
        visibleOriginAmbiguityPresent: audit.visibleOriginAmbiguityPresent,
        readerAdvisoryDefectPresent: audit.readerAdvisoryDefectPresent,
        hardBlockerPresent: audit.hardBlockerPresent,
        compositeAtLeast80Plausible: audit.compositeAtLeast80Plausible,
        deterministicDecisionEligibility: "REVISE_NOT_PASS",
      },
      cleanControlEligibility: false,
      reason: audit.reason,
      retainedDisposition: "DEVELOPMENT_DIAGNOSTIC_ONLY_DO_NOT_DELETE_OR_RELABEL_FROM_MODEL_OUTPUTS",
    };
  });
  const core = {
    schema: "imp24f-reader-gold-adjudication-packet-v1",
    decision: "BLOCKED_NEEDS_INDEPENDENT_GOLD",
    corpusInput: { relativePath: CORPUS_REL, bytesSha256: bytesSha256(CORPUS_REL) },
    auditMethod: {
      rubric: `${READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION}@${READER_EXPERIENCE_SEMANTIC_SHA256}`,
      contentOnlyDirectPageAudit: true,
      candidateOutputsConsultedForLabels: false,
      modelAgreementUsedAsGoldAuthority: false,
      replacementCasesSelected: false,
      auditTaskIsolation: "fresh read-only adjudication task",
    },
    eligibilityRule: {
      noReaderBlocker: true,
      noReaderAdvisoryDefect: true,
      noOriginAmbiguity: true,
      intendedCompositeAtLeast80OnExplicitScale: true,
    },
    cases,
    summary: {
      currentCleanControlsAudited: cases.length,
      eligibleCleanControls: cases.filter((item) => item.cleanControlEligibility).length,
      independentlyGovernedUnusedReaderGoldFound: 0,
      independentReaderHoldoutGoldAvailable: false,
    },
    requiredOwnerAction: {
      action: "Commission and owner-approve an independent reader-rubric adjudication of pre-existing unused cases before any reader holdout.",
      provenanceRequirements: [
        "created before the corrected live campaign",
        "not selected from retained qualification outputs",
        "not used by candidate books",
        "reader-rubric-specific",
        "owner-approved or independently adjudicated",
      ],
      holdoutAuthorizationBeforeCompletion: false,
    },
    modelCalls: 0,
    apiCalls: 0,
    holdoutCalls: 0,
  };
  return selfHashed(core, "packetSha256");
}

function renderPacketMarkdown(packet: ReturnType<typeof buildReaderPacket>): string {
  const rows = packet.cases.map((item) => [
    item.caseId,
    item.readerDocumentSha256,
    "Yes",
    "Yes",
    "No",
    item.productionRubricAudit.compositeAtLeast80Plausible ? "Yes" : "No",
    "No",
    item.reason,
  ].map(escapeMd).join(" | "));
  return [
    "# IMP-24F Reader Gold Adjudication Packet",
    "",
    "Decision: `BLOCKED_NEEDS_INDEPENDENT_GOLD`.",
    "",
    "All 10 retained reader clean controls were audited directly against the corrected production rubric without using candidate agreement as label authority. None is eligible for `cleanControlPassRate`: every page has reader-visible origin ambiguity and at least one advisory defect. The current labels are development-only and explicitly lack an independent human rater.",
    "",
    "| Case | Reader document SHA-256 | Origin ambiguity | Advisory defect | Hard blocker | 80+ plausible | Eligible | Reason |",
    "|---|---|---:|---:|---:|---:|---:|---|",
    ...rows,
    "",
    "## Required owner action",
    "",
    packet.requiredOwnerAction.action,
    "",
    "The new gold must predate the corrected live campaign, remain independent of retained model outputs and candidate books, be reader-rubric-specific, and be owner-approved or independently adjudicated. Until then, no reader holdout is authorized.",
    "",
    `Packet SHA-256: \`${packet.packetSha256}\`. Model/API/holdout calls: 0/0/0.`,
    "",
  ].join("\n");
}

function buildRepairResult(args: {
  readerPacket: ReturnType<typeof buildReaderPacket>;
  coverage: ReturnType<typeof certifyImp24fThresholdCoverage>;
}) {
  const coverage = args.coverage;
  const implementationSources = [
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/imp24InstrumentCertification.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/imp24ThresholdCoverage.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/imp24fThresholdCoverageCertification.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/roleQualificationRunnerV3.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/orchestrator/forwardRetainedRoleQualificationEvidenceV3.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/orchestrator/forwardRoleQualificationLiveV3.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/quizIntegrityReview.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/readerExperienceSemanticRubric.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/readerExperienceReview.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/reviewModelOutputV2.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/sourceIntegritySemanticRules.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/quizIntegritySemanticRules.ts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src/review/sourceIntegrityReview.ts",
  ].sort().map((relativePath) => ({ relativePath, bytesSha256: bytesSha256(relativePath) }));
  const core = {
    schema: "imp24f-instrument-repair-result-v1",
    finalDecision: "BLOCKED_NEEDS_INDEPENDENT_GOLD",
    startingHead: "09b53ef815125a57bd5b786e9bacb372fb7256d0",
    implementationCommit: "SELF_RECORDED_BY_GIT_AND_FINAL_RESPONSE",
    exactV25Ci: "POST_COMMIT_EXTERNAL_GATE_RECORDED_IN_FINAL_RESPONSE",
    calls: { model: 0, api: 0, holdout: 0, pilot: 0, readerCanary: 0, sourceCanary: 0, quiz: 0 },
    confirmedRootCauses: [
      "The V3 inline reader and source prompts omitted canonical lane semantics; reader also omitted the explicit 0-100 scale and factor definitions. A material quiz semantic mismatch was also proven.",
      "All retained reader clean controls were development-only, lacked an independent human rater, and fail corrected clean-control eligibility.",
      "The old certification proved fixture assembly but did not prove threshold-to-corpus reachability and exact evaluator observation emission before live calls.",
      "The runner admitted holdouts after two protocol-valid canaries even when one or both semantic judgments were wrong.",
      "The terminal verifier compared set-like threshold arrays in reconstruction order instead of a comparison-only canonical set projection.",
    ],
    semanticPromptIdentities: {
      reader: { version: READER_EXPERIENCE_SEMANTIC_RUBRIC_VERSION, sha256: READER_EXPERIENCE_SEMANTIC_SHA256, previousQualificationStale: true },
      source: { version: SOURCE_INTEGRITY_SEMANTIC_RULES_VERSION, sha256: SOURCE_INTEGRITY_SEMANTIC_SHA256, previousQualificationStale: true },
      quiz: { version: QUIZ_INTEGRITY_SEMANTIC_RULES_VERSION, sha256: QUIZ_INTEGRITY_SEMANTIC_SHA256, previousQualificationStale: true },
    },
    promptSourceSemanticBindings: IMP24_SEMANTIC_PROMPT_HASHES,
    offlineGates: {
      retainedTerminalEvidencePreserved: "PASS",
      readerProductionQualificationSemanticParity: "PASS",
      readerExplicitZeroToOneHundredScale: "PASS",
      sourceProductionQualificationSemanticParity: "PASS",
      quizProductionQualificationAudit: "MATERIAL_MISMATCH_REPAIRED_PRIOR_QUALIFICATION_STALE",
      semanticCanaryGateTwoOfTwoRequired: "PASS",
      thresholdToCorpusCoverage: coverage.coverageProof.status,
      modelFreeCoverageCertification: coverage.status,
      verifierCanonicalSetProjection: "PASS",
      independentReaderHoldoutGold: "FAIL_MISSING",
      exactImplementationCi: "PENDING_POST_COMMIT",
    },
    thresholdCoverageCertification: coverage,
    sourceContradiction: {
      ...coverage.coverageProof.sourceContradiction,
      retainedProfileActualDenominators: [
        { profileId: "gpt-5.5@high", numerator: 2, denominator: 2 },
        { profileId: "gpt-5.5@xhigh", numerator: 2, denominator: 2 },
        { profileId: "gpt-5.6-sol@high", numerator: 2, denominator: 2 },
        { profileId: "gpt-5.6-sol@xhigh", numerator: 2, denominator: 2 },
      ],
      lostObservationCount: 0,
    },
    readerGold: {
      auditedCleanControls: args.readerPacket.summary.currentCleanControlsAudited,
      eligibleCleanControls: args.readerPacket.summary.eligibleCleanControls,
      independentReaderHoldoutGoldAvailable: false,
      adjudicationPacketSha256: args.readerPacket.packetSha256,
    },
    retainedForensics: {
      json: { relativePath: FORENSICS_JSON_REL, bytesSha256: bytesSha256(FORENSICS_JSON_REL) },
      markdown: { relativePath: FORENSICS_MD_REL, bytesSha256: bytesSha256(FORENSICS_MD_REL) },
    },
    correctedCanary: {
      phaseAuthorized: false,
      identity: null,
      reasonNotRun: "Independent reader holdout/canary gold is unavailable; the optional live phase failed closed before identity creation or any call.",
      readerCalls: 0,
      sourceCalls: 0,
      quizCalls: 0,
      holdoutCalls: 0,
    },
    implementationSources,
    invariants: {
      existingTerminalEvidenceModified: false,
      thresholdsWeakened: false,
      goldRelabeledFromModelOutputs: false,
      oldScoresNormalized: false,
      retainedCasesDeletedOrRelabeled: false,
      transportSchemasChanged: false,
      retriesIncreased: false,
    },
    nextAuthorizedAction: "Obtain owner-approved, independently adjudicated, reader-rubric-specific unused gold; then re-run offline certification at the exact implementation commit before authorizing any fresh canary-only identity.",
  };
  return selfHashed(core, "resultSha256");
}

function renderResultMarkdown(result: ReturnType<typeof buildRepairResult>): string {
  const coverageRows = (["reader", "source", "quiz"] as const).flatMap((role) =>
    result.thresholdCoverageCertification.coverageProof.roles[role].metrics.map((metric) =>
      `| ${role} | ${metric.metricId} | ${metric.expectedDenominator} | ${metric.minimumDenominator} | ${metric.zeroMiss ? "yes" : "no"} | ${metric.actualObservationDenominator} | ${metric.status} |`));
  return [
    "# IMP-24F Instrument Repair Result",
    "",
    "Final decision: `BLOCKED_NEEDS_INDEPENDENT_GOLD`.",
    "",
    "The qualification instrument is repaired offline: production and qualification share lane-specific semantic projections, reader scoring explicitly uses 0-100, holdout admission requires 2/2 semantically correct canaries, threshold coverage is certified against the real model-free evaluator, and the retained verifier uses comparison-only canonical sets. No live phase ran because independently governed reader gold does not exist.",
    "",
    "## Offline gates",
    "",
    ...Object.entries(result.offlineGates).map(([name, status]) => `- ${name}: \`${status}\``),
    "",
    "## Threshold coverage",
    "",
    "| Role | Metric | Expected | Minimum | Zero-miss | Evaluator observations | Status |",
    "|---|---|---:|---:|---:|---:|---|",
    ...coverageRows,
    "",
    `Source contradiction is exactly 2/2 for \`${result.sourceContradiction.caseIds.join("\` and \`")}\`; no contradiction observation was lost.`,
    "",
    "## Reader clean controls",
    "",
    `Audited: ${result.readerGold.auditedCleanControls}. Eligible: ${result.readerGold.eligibleCleanControls}. Independent holdout gold available: no. See \`${PACKET_JSON_REL}\` and \`${PACKET_MD_REL}\`.`,
    "",
    "## Live activity",
    "",
    "Model/API/holdout/pilot calls: 0/0/0/0. No corrected canary identity or canary report was created because the independent-gold prerequisite failed.",
    "",
    "## Next authorized action",
    "",
    result.nextAuthorizedAction,
    "",
    `Result SHA-256: \`${result.resultSha256}\`.`,
    "",
  ].join("\n");
}

function main(): void {
  const corpusBundle = buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
  const cleanCases = corpusBundle.reader.holdout.cases
    .filter((item) => item.kind === "clean")
    .sort((left, right) => left.caseId.localeCompare(right.caseId));
  if (cleanCases.length !== 10) throw new Error(`expected 10 retained reader clean controls, received ${cleanCases.length}`);
  const packet = buildReaderPacket(cleanCases);
  writeFileAtomic(resolve(REPOSITORY_ROOT, PACKET_JSON_REL), canonicalPretty(packet));
  writeFileAtomic(resolve(REPOSITORY_ROOT, PACKET_MD_REL), renderPacketMarkdown(packet));

  const preparedCases = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle }).preparedCases;
  const coverage = certifyImp24fThresholdCoverage({
    corpusBundle,
    preparedCases,
    thresholds: IMP24_FROZEN_ROLE_THRESHOLDS,
  });
  const result = buildRepairResult({ readerPacket: packet, coverage });
  writeFileAtomic(resolve(REPOSITORY_ROOT, RESULT_JSON_REL), canonicalPretty(result));
  writeFileAtomic(resolve(REPOSITORY_ROOT, RESULT_MD_REL), renderResultMarkdown(result));

  process.stdout.write(canonicalPretty({
    decision: result.finalDecision,
    packetSha256: packet.packetSha256,
    coverageCertificationSha256: coverage.certificationSha256,
    resultSha256: result.resultSha256,
    semanticHashes: IMP24_SEMANTIC_PROMPT_HASHES,
    outputs: [PACKET_JSON_REL, PACKET_MD_REL, RESULT_JSON_REL, RESULT_MD_REL],
    calls: result.calls,
  }));
}

main();
