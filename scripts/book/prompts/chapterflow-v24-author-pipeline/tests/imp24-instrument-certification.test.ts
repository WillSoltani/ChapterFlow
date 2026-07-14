import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { hashValue } from "../src/bakeoff/migration/corpusBuilderCore.js";
import { canonicalJson, hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import {
  materializeForwardProductionInstrumentSeal,
  type ForwardProductionInstrumentSealV1,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_ID,
  buildImp24CorpusBundle,
  certifyImp24Corpora,
  loadImp24FrozenV2Inputs,
  type Imp24CorpusBundle,
} from "../src/bakeoff/migration/imp24Corpus.js";
import {
  IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
  IMP24_INSTRUMENT_VERSION,
  Imp24InstrumentCertificationError,
  certifyImp24SourceMissingEvidence,
  compileEveryImp24CorpusCase,
  compileImp24QuizProductionInstrument,
  compileImp24SourceProductionPartition,
  createImp24QualificationEvaluator,
  imp24FreshnessCandidateMatchesBinding,
  materializeImp24InstrumentCertification,
  prepareImp24QualificationCases,
  validateImp24InstrumentCertificationBinding,
} from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  compileProductionQuizEnvelopeV2,
  compileProductionResolvedSourceEnvelopeSetV2,
} from "../src/review/forwardProductionReviewV2.js";
import {
  IMP24_BASE_MAXIMUM_CALLS,
  IMP24_FROZEN_ROLE_THRESHOLDS,
  IMP24_ROLE_CANDIDATE_ORDER,
  IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
  IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
  buildRoleQualificationPlanV3,
  candidateAvailabilityProvenanceSha256,
  candidateAvailabilitySemanticSha256,
  candidateAvailabilitySha256,
  instrumentCertificationBindingSha256,
  qualificationReceiptSha256,
  qualificationRequestSha256,
  type CandidateAvailabilityV3,
  type InstrumentCertificationBindingV3,
  type PreparedQualificationCaseV3,
  type QualificationExecutionReceiptV3,
  type QualificationExecutionRequestV3,
  type RunRoleQualificationInputV3,
} from "../src/bakeoff/migration/roleQualificationRunnerV3.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CONTRACTS_DIR = resolve(PIPELINE_DIR, "state", "migration-experiments", "contracts");
const HASH = "a".repeat(64);

function build(): Imp24CorpusBundle {
  return buildImp24CorpusBundle(loadImp24FrozenV2Inputs(CONTRACTS_DIR));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function snapshotFilesBelow(root: string): Record<string, string> {
  if (!existsSync(root)) return {};
  const files: Record<string, string> = {};
  const walk = (path: string): void => {
    for (const name of readdirSync(path).sort()) {
      const child = resolve(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else files[relative(root, child)] = sha256Hex(readFileSync(child));
    }
  };
  walk(root);
  return files;
}

function flattenedPrepared(bundle: Imp24CorpusBundle): PreparedQualificationCaseV3[] {
  const prepared = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle: bundle }).preparedCases;
  return (["reader", "source", "quiz"] as const).flatMap((role) =>
    (["canary", "holdout"] as const).flatMap((partition) => [...prepared[role][partition]]));
}

function boundRequest(preparedCase: PreparedQualificationCaseV3): QualificationExecutionRequestV3 {
  const core: Omit<QualificationExecutionRequestV3, "requestSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_REQUEST_SCHEMA,
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    scheduleId: `test-${preparedCase.caseId}`,
    attemptId: `test-${preparedCase.caseId}-a1`,
    replayOfAttemptId: null,
    attemptNumber: 1,
    role: preparedCase.role,
    partition: preparedCase.partition,
    caseId: preparedCase.caseId,
    family: preparedCase.family,
    profileId: "model-free-fixture@high",
    model: "model-free-fixture",
    effort: "high",
    schemaSha256: preparedCase.schemaSha256,
    promptSourceSha256: preparedCase.promptSourceSha256,
    goldSha256: preparedCase.goldSha256,
    sourceCaseSha256: preparedCase.sourceCaseSha256,
    freezeSha256: HASH,
    certificationSha256: HASH,
    productionInstrumentSealSha256: HASH,
    reviewProtocol: "review-evidence-envelope-v1",
    evidenceEnvelopeSha256: preparedCase.envelope.envelopeSha256,
    evidenceEnvelopeBytesSha256: preparedCase.evidenceEnvelopeBytesSha256,
    evidenceEnvelopeBytes: preparedCase.evidenceEnvelopeBytes,
    task: preparedCase.task,
  };
  return { ...core, requestSha256: qualificationRequestSha256(core) };
}

function boundReceipt(request: QualificationExecutionRequestV3, rawOutput: string): QualificationExecutionReceiptV3 {
  const core: Omit<QualificationExecutionReceiptV3, "receiptSha256"> = {
    schema: IMP24_ROLE_QUALIFICATION_RECEIPT_SCHEMA,
    executionId: `fixture-${request.attemptId}`,
    status: "completed",
    requestSha256: request.requestSha256,
    freezeSha256: request.freezeSha256,
    certificationSha256: request.certificationSha256,
    productionInstrumentSealSha256: request.productionInstrumentSealSha256,
    role: request.role,
    profileId: request.profileId,
    model: request.model,
    effort: request.effort,
    schemaSha256: request.schemaSha256,
    reviewProtocol: request.reviewProtocol,
    evidenceEnvelopeSha256: request.evidenceEnvelopeSha256,
    evidenceEnvelopeBytesSha256: request.evidenceEnvelopeBytesSha256,
    evidenceEnvelopeBytes: request.evidenceEnvelopeBytes,
    rawOutput,
  };
  return { ...core, receiptSha256: qualificationReceiptSha256(core) };
}

function allAvailable(): CandidateAvailabilityV3 {
  const draft: Omit<CandidateAvailabilityV3,
    "availabilitySha256" | "semanticSha256" | "provenanceSha256"> = {
    schema: "imp24-role-candidate-availability-v3",
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    source: "codex-local-models-cache",
    sourceFile: "$CODEX_HOME/models_cache.json",
    sourceBytesSha256: HASH,
    sourceFetchedAt: "2026-07-13T12:00:00.000Z",
    sourceQualifiedAt: "2026-07-13T14:00:00.000Z",
    sourceAgeSeconds: 7_200,
    cliVersion: "codex-cli 0.144.1",
    policyBytesSha256: HASH,
    candidateOrderSha256: hashCanonical(IMP24_ROLE_CANDIDATE_ORDER),
    entries: (["reader", "source", "quiz"] as const).flatMap((role) =>
      IMP24_ROLE_CANDIDATE_ORDER[role].map((profile, ordinal) => ({
        role,
        ordinal,
        ...profile,
        status: "AVAILABLE" as const,
        modelListed: true,
        visible: true,
        effortSupported: true,
        reasonCode: "AVAILABLE" as const,
        reason: "deterministic model-free plan fixture",
      }))),
  };
  const split = {
    ...draft,
    semanticSha256: candidateAvailabilitySemanticSha256(draft),
    provenanceSha256: "0".repeat(64),
  };
  split.provenanceSha256 = candidateAvailabilityProvenanceSha256(split as CandidateAvailabilityV3);
  return { ...split, availabilitySha256: candidateAvailabilitySha256(split) };
}

test("IMP-24 certification compiles every one of the 116 exact inline instruments deterministically", () => {
  const bundle = build();
  const first = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle: bundle });
  const second = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle: build() });
  assert.deepEqual(second, first);

  const prepared = flattenedPrepared(bundle);
  assert.equal(prepared.length, 116);
  assert.equal(new Set(prepared.map((item) => item.caseId)).size, 116);
  for (const item of prepared) {
    assert.ok(item.task.includes(item.evidenceEnvelopeBytes), item.caseId);
    assert.equal(sha256Hex(item.evidenceEnvelopeBytes), item.evidenceEnvelopeBytesSha256, item.caseId);
    assert.doesNotMatch(item.task, /\bfile is at\b|\bread this file\b|\/(?:Users|home|private\/tmp)\//i, item.caseId);
    assert.doesNotMatch(item.task, /\b(?:emit|echo|copy|return)\b[^\n]{0,80}\b(?:hash|keyed index|derived index)\b/i, item.caseId);
  }

  const compiled = compileEveryImp24CorpusCase(bundle);
  assert.equal(compiled.length, 116);
  assert.deepEqual(
    {
      reader: compiled.filter((item) => item.role === "reader").length,
      source: compiled.filter((item) => item.role === "source").length,
      quiz: compiled.filter((item) => item.role === "quiz").length,
    },
    { reader: 32, source: 42, quiz: 42 },
  );
  assert.ok(compiled.every((item) => item.protocolValid && item.referenceResolutionValid && item.taskSelfContained));
  assert.ok(compiled.every((item) => item.expectedOutcome === item.derivedOutcome));
  assert.equal(certifyImp24SourceMissingEvidence(bundle), true);
});

test("IMP-24 frozen-gold evaluator validates all 116 canonical fixtures without conflating protocol and semantics", () => {
  const bundle = build();
  const prepared = flattenedPrepared(bundle);
  const { evaluateOutput, fixtureOutputByCaseId } = createImp24QualificationEvaluator(bundle);
  assert.equal(Object.keys(fixtureOutputByCaseId).length, 116);

  const failures: string[] = [];
  for (const preparedCase of prepared) {
    const rawOutput = fixtureOutputByCaseId[preparedCase.caseId];
    assert.ok(rawOutput, preparedCase.caseId);
    const request = boundRequest(preparedCase);
    const receipt = boundReceipt(request, rawOutput);
    const result = evaluateOutput({ preparedCase, request, receipt, rawOutput });
    for (const [key, value] of Object.entries({
      schemaValid: result.schemaValid,
      envelopeBound: result.envelopeBound,
      evidenceReferenceValid: result.evidenceReferenceValid,
      authorityCompliant: result.authorityCompliant,
      complete: result.complete,
      resolved: result.resolved,
      semanticCorrect: result.semanticCorrect,
    })) if (!value) failures.push(`${preparedCase.caseId}: ${key}=false (${result.semanticSummary})`);
    if (result.fileAccessFailure) failures.push(`${preparedCase.caseId}: false file-access failure`);
    if (result.prohibitedConductorEcho) failures.push(`${preparedCase.caseId}: false prohibited echo`);
  }
  assert.deepEqual(failures, []);

  const original = prepared[0];
  const tampered = { ...original, goldSha256: "b".repeat(64) };
  const rawOutput = fixtureOutputByCaseId[original.caseId];
  const request = boundRequest(tampered);
  const receipt = boundReceipt(request, rawOutput);
  assert.throws(
    () => evaluateOutput({ preparedCase: tampered, request, receipt, rawOutput }),
    (error: unknown) => error instanceof Imp24InstrumentCertificationError && /gold hash mismatch/.test(error.message),
  );
});

test("IMP-24 qualification marks schema-valid reader authority violations noncompliant without rejecting uncertainty", () => {
  const bundle = build();
  const preparedCase = flattenedPrepared(bundle).find((item) => item.role === "reader");
  assert.ok(preparedCase);
  const { evaluateOutput, fixtureOutputByCaseId } = createImp24QualificationEvaluator(bundle);
  const canonical = JSON.parse(fixtureOutputByCaseId[preparedCase.caseId]) as Record<string, unknown>;

  const violatingRaw = canonicalJson({
    ...canonical,
    oneParagraphVerdict: "The author fabricated this study, and the passage contradicts the source.",
  });
  const violatingRequest = boundRequest(preparedCase);
  const violating = evaluateOutput({
    preparedCase,
    request: violatingRequest,
    receipt: boundReceipt(violatingRequest, violatingRaw),
    rawOutput: violatingRaw,
  });
  assert.equal(violating.schemaValid, true);
  assert.equal(violating.authorityCompliant, false);
  assert.match(violating.semanticSummary, /reader authority violation/i);

  const uncertainRaw = canonicalJson({
    ...canonical,
    oneParagraphVerdict: "I cannot tell from the page whether the study is fabricated; the passage may contradict its source, so this possible attribution issue needs source review.",
  });
  const uncertainRequest = boundRequest(preparedCase);
  const uncertain = evaluateOutput({
    preparedCase,
    request: uncertainRequest,
    receipt: boundReceipt(uncertainRequest, uncertainRaw),
    rawOutput: uncertainRaw,
  });
  assert.equal(uncertain.schemaValid, true);
  assert.equal(uncertain.authorityCompliant, true);
});

test("IMP-24 source fixture and prepared gold ignore stored expected relabels", () => {
  const canonical = build();
  const canonicalPrepared = flattenedPrepared(canonical);
  const canonicalSource = canonical.source.holdout.cases.find((item) =>
    item.provenance.basisKind === "source-bound-fact"
      && item.pairSide === "defect"
      && item.expected.expectedPrimaryCategory === "source_contradiction");
  assert.ok(canonicalSource);
  const canonicalPreparedCase = canonicalPrepared.find((item) => item.caseId === canonicalSource.caseId);
  assert.ok(canonicalPreparedCase);

  const relabeled = deepClone(canonical);
  const relabeledSource = relabeled.source.holdout.cases.find((item) => item.caseId === canonicalSource.caseId)!;
  relabeledSource.expected.expectedCategory = "invented_detail";
  relabeledSource.expected.expectedPrimaryCategory = "invented_detail";
  relabeledSource.expected.expectedSecondaryCategories = [];
  const payload = deepClone(relabeledSource) as unknown as Record<string, unknown>;
  delete payload.substantiveCaseSha256;
  relabeledSource.substantiveCaseSha256 = hashValue(payload);

  const relabeledPreparedCase = flattenedPrepared(relabeled).find((item) => item.caseId === relabeledSource.caseId);
  assert.ok(relabeledPreparedCase);
  assert.equal(relabeledPreparedCase.goldSha256, canonicalPreparedCase.goldSha256, "source gold must come from independent source semantics");
  assert.notEqual(relabeledPreparedCase.sourceCaseSha256, canonicalPreparedCase.sourceCaseSha256, "case identity still records the relabeling drift");

  const compiled = compileEveryImp24CorpusCase(relabeled).find((item) => item.caseId === relabeledSource.caseId);
  assert.ok(compiled);
  assert.equal(compiled.expectedOutcome, "BLOCK");
  assert.equal(compiled.derivedOutcome, "BLOCK");

  const { evaluateOutput, fixtureOutputByCaseId } = createImp24QualificationEvaluator(relabeled);
  const rawOutput = fixtureOutputByCaseId[relabeledPreparedCase.caseId];
  const request = boundRequest(relabeledPreparedCase);
  const receipt = boundReceipt(request, rawOutput);
  const evaluation = evaluateOutput({ preparedCase: relabeledPreparedCase, request, receipt, rawOutput });
  assert.equal(evaluation.semanticCorrect, true);
  assert.match(evaluation.semanticSummary, /primary=source_contradiction/);
});

test("IMP-24 qualification source and quiz adapters use exact shared production compilers", () => {
  const bundle = build();
  const source = bundle.source.canary.cases[0];
  const qualificationSource = compileImp24SourceProductionPartition(source);
  const directSource = compileProductionResolvedSourceEnvelopeSetV2({
    caseId: source.caseId,
    instrumentVersion: IMP24_INSTRUMENT_VERSION,
    targets: [{ targetRef: "U1", unit: source.evidence.sourceUsePlanUnit, chapterSpans: [source.evidence.chapterUnit] }],
    packet: source.evidence.sourcePacket,
    anchorCatalog: source.evidence.anchorCatalog,
    chapterContentSha256: source.evidence.provenanceHashes.chapterContentSha256,
    sourceUsePlanSha256: source.evidence.provenanceHashes.sourceUsePlanSha256,
    sourcePacketSha256: source.evidence.provenanceHashes.sourcePacketSha256,
    sidecarSha256: source.evidence.provenanceHashes.sidecarSha256,
  }).partitions[0];
  assert.deepEqual(qualificationSource, directSource);
  assert.equal(qualificationSource.envelope.caseId, `${source.caseId}:U1`);
  const sourcePartitionBinding = qualificationSource.envelope.immutableBindings.partition as Record<string, unknown>;
  assert.equal(sourcePartitionBinding.targetRef, "U1");
  assert.match(String(qualificationSource.envelope.immutableBindings.chapterEvidenceSetSha256), /^[a-f0-9]{64}$/);

  const goldOnlyTamper = deepClone(source);
  goldOnlyTamper.evidence.goldSourceEvidenceSpans = ["QUALIFICATION-ONLY-GOLD-SENTINEL"];
  const tamperedSource = compileImp24SourceProductionPartition(goldOnlyTamper);
  assert.equal(tamperedSource.envelope.envelopeSha256, qualificationSource.envelope.envelopeSha256);
  assert.equal(tamperedSource.task, qualificationSource.task);
  assert.ok(!tamperedSource.envelopeBytes.includes("QUALIFICATION-ONLY-GOLD-SENTINEL"));

  const quiz = bundle.quiz.canary.cases[0];
  const qualificationQuiz = compileImp24QuizProductionInstrument(quiz);
  const directQuiz = compileProductionQuizEnvelopeV2({
    caseId: quiz.caseId,
    instrumentVersion: IMP24_INSTRUMENT_VERSION,
    chapter: quiz.chapter,
    phase1Document: qualificationQuiz.phase1Document,
    chapterContentSha256: quiz.provenance.variantContentSha256,
    committedDerivation: qualificationQuiz.committedDerivation,
  });
  assert.deepEqual(qualificationQuiz.compiled, directQuiz);
  assert.equal(
    qualificationQuiz.compiled.envelope.immutableBindings.derivationSha256,
    qualificationQuiz.committedDerivation.sha256,
  );
  assert.equal(
    qualificationQuiz.compiled.envelope.immutableBindings.phase1DocumentSha256,
    sha256Hex(qualificationQuiz.phase1Document),
  );
});

test("IMP-24 certification binding is self-hashed and rejects V1/V2 freshness", () => {
  const core: Omit<InstrumentCertificationBindingV3, "certificationSha256"> = {
    schema: IMP24_INSTRUMENT_CERTIFICATION_BINDING_SCHEMA,
    status: "CERTIFIED_MODEL_FREE",
    sourceMissingEvidenceInconclusiveCertified: true,
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    corpusCertificationSha256: HASH,
    corpusBundleSha256: `sha256:${HASH}`,
    productionInstrumentSealSha256: HASH,
    envelopeContractSha256: HASH,
    envelopeCompilerSha256: HASH,
    modelOutputContractsSha256: HASH,
    productionQualificationParitySha256: HASH,
    scorerSha256: HASH,
    promptBundleSha256: HASH,
    schemaBundleSha256: HASH,
    thresholdsSha256: HASH,
    legacyEvidenceClosureSha256: HASH,
    independentAuditPasses: 2,
    modelCalls: 0,
    apiCalls: 0,
  };
  const binding: InstrumentCertificationBindingV3 = {
    ...core,
    certificationSha256: instrumentCertificationBindingSha256(core),
  };
  assert.deepEqual(validateImp24InstrumentCertificationBinding(binding), []);
  assert.equal(imp24FreshnessCandidateMatchesBinding({
    experimentId: IMP24_ROLE_QUALIFICATION_ID,
    evidenceEnvelopeSha256: HASH,
    certificationSha256: binding.certificationSha256,
    corpusBundleSha256: binding.corpusBundleSha256,
  }, binding), true);
  for (const experimentId of ["s16-forward-role-qualification-v1", "s16-forward-role-qualification-v2"]) {
    assert.equal(imp24FreshnessCandidateMatchesBinding({
      experimentId,
      evidenceEnvelopeSha256: HASH,
      certificationSha256: binding.certificationSha256,
      corpusBundleSha256: binding.corpusBundleSha256,
    }, binding), false);
  }
  const uncertifiedProbe = { ...binding, sourceMissingEvidenceInconclusiveCertified: false } as unknown as InstrumentCertificationBindingV3;
  assert.ok(validateImp24InstrumentCertificationBinding(uncertifiedProbe).some((issue) => /missing-source-evidence/.test(issue)));
});

test("IMP-24 materializes all certification artifacts deterministically and its binding passes runner preflight", () => {
  const temp = mkdtempSync(resolve(tmpdir(), "imp24-instrument-certification-"));
  const stateBooksRoot = resolve(PIPELINE_DIR, "state", "books");
  const stateBooksBefore = snapshotFilesBelow(stateBooksRoot);
  const productionSealPath = resolve(temp, "contracts", "imp24", "forward-production-instrument-seal.json");
  const thresholdsPath = resolve(temp, "contracts", "imp24", "role-thresholds.v3-envelope.json");
  materializeForwardProductionInstrumentSeal({
    repositoryRoot: REPOSITORY_ROOT,
    outputPath: productionSealPath,
    write: true,
  });
  const thresholdBytes = `${canonicalJson(IMP24_FROZEN_ROLE_THRESHOLDS)}\n`;
  writeFileSync(thresholdsPath, thresholdBytes);

  const outputPaths = {
    corpusBundle: resolve(temp, "contracts", "imp24", "role-qualification-corpus-bundle.v3-envelope.json"),
    certificationBinding: resolve(temp, "contracts", "imp24", "instrument-certification-binding.json"),
    legacyClosure: resolve(temp, "contracts", "imp24", "legacy-v1-v2-evidence-closure.json"),
    productionQualificationParity: resolve(temp, "contracts", "imp24", "production-qualification-parity.json"),
    reportJson: resolve(temp, "reports", "IMP-24_INSTRUMENT_CERTIFICATION.json"),
    reportMarkdown: resolve(temp, "reports", "IMP-24_INSTRUMENT_CERTIFICATION.md"),
  };
  const options = {
    repositoryRoot: REPOSITORY_ROOT,
    thresholdsPath,
    productionSealPath,
    outputPaths,
  };
  const first = materializeImp24InstrumentCertification(options);
  const firstBytes = Object.fromEntries(Object.entries(outputPaths).map(([key, path]) => [key, readFileSync(path, "utf8")]));
  const second = materializeImp24InstrumentCertification(options);
  assert.deepEqual(snapshotFilesBelow(stateBooksRoot), stateBooksBefore,
    "model-free certification must not create or rewrite production state/books artifacts");
  const secondBytes = Object.fromEntries(Object.entries(outputPaths).map(([key, path]) => [key, readFileSync(path, "utf8")]));
  assert.deepEqual(second, first);
  assert.deepEqual(secondBytes, firstBytes);
  assert.equal(first.status, "CERTIFIED_MODEL_FREE");
  assert.equal(first.modelCalls, 0);
  assert.equal(first.apiCalls, 0);
  assert.deepEqual(Object.keys(first.outputs).sort(), [
    "certificationBinding", "corpusBundle", "legacyClosure", "productionQualificationParity", "reportJson", "reportMarkdown",
  ]);
  const retainedReport = JSON.parse(readFileSync(outputPaths.reportJson, "utf8")) as {
    corpusAudit: { passB: { artifactBytesSha256: string } };
    binding: { productionQualificationParitySha256: string };
  };
  assert.equal(retainedReport.corpusAudit.passB.artifactBytesSha256, first.outputs.corpusBundle.bytesSha256,
    "certification Pass B must be the audit of the exact retained corpus bytes");
  assert.equal(retainedReport.binding.productionQualificationParitySha256,
    JSON.parse(readFileSync(outputPaths.productionQualificationParity, "utf8")).paritySha256);

  const corpusBundle = build();
  const corpusCertification = certifyImp24Corpora(corpusBundle);
  const prepared = prepareImp24QualificationCases({ repositoryRoot: REPOSITORY_ROOT, corpusBundle });
  const productionInstrumentSeal = JSON.parse(readFileSync(productionSealPath, "utf8")) as ForwardProductionInstrumentSealV1;
  const input: RunRoleQualificationInputV3 = {
    experimentId: IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    corpusBundle,
    corpusCertification,
    certification: first.binding,
    productionInstrumentSeal,
    candidateAvailability: allAvailable(),
    thresholds: IMP24_FROZEN_ROLE_THRESHOLDS,
    thresholdBytesSha256: sha256Hex(thresholdBytes),
    schemaHashes: prepared.schemaHashes,
    promptSourceHashes: prepared.promptSourceHashes,
    preparedCases: prepared.preparedCases,
  };
  const plan = buildRoleQualificationPlanV3(input);
  assert.equal(plan.schedule.length, IMP24_BASE_MAXIMUM_CALLS);
  assert.equal(plan.freeze.certificationSha256, first.binding.certificationSha256);
  assert.equal(plan.freeze.corpusBundleSha256, corpusBundle.substantiveBundleSha256);
  assert.equal(plan.freeze.productionInstrumentSealSha256, productionInstrumentSeal.sealSha256);
  assert.equal(plan.freeze.productionQualificationParitySha256,
    first.binding.productionQualificationParitySha256);

  const tamperedInput: RunRoleQualificationInputV3 = {
    ...input,
    certification: { ...first.binding, certificationSha256: "0".repeat(64) },
  };
  assert.throws(() => buildRoleQualificationPlanV3(tamperedInput), /instrument certification hash mismatch/);
});
