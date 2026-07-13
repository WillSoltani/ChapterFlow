import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson, hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { validateWorkerReport } from "../src/contracts/workerReport.js";
import { writeFileAtomic } from "../src/lib/atomicWrite.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  materializeForwardProductionInstrumentSeal,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { canonicalPretty } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  materializeImp24InstrumentCertification,
} from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24B_PRE_LIVE_ARTIFACT_PATHS,
  IMP24B_STARTING_HEAD,
  buildImp24BPreLiveFreeze,
  materializeImp24BPreLiveFreeze,
  validateImp24BPreLiveFreeze,
  type Imp24BPreLiveFreeze,
} from "../src/bakeoff/migration/imp24PreLiveFreeze.js";
import { IMP24_FROZEN_ROLE_THRESHOLDS } from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const PIPELINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(PIPELINE_ROOT, "../../../..");

function retainedPath(root: string, relativePath: string): string {
  return resolve(root, relativePath);
}

function prepareRetainedCertification(root: string): void {
  const thresholdsPath = retainedPath(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds);
  writeFileAtomic(thresholdsPath, canonicalPretty(IMP24_FROZEN_ROLE_THRESHOLDS));
  const productionSealPath = retainedPath(root, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH);
  materializeForwardProductionInstrumentSeal({
    repositoryRoot: REPOSITORY_ROOT,
    outputPath: productionSealPath,
    write: true,
  });
  materializeImp24InstrumentCertification({
    repositoryRoot: REPOSITORY_ROOT,
    thresholdsPath,
    productionSealPath,
    outputPaths: {
      corpusBundle: retainedPath(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle),
      certificationBinding: retainedPath(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding),
      legacyClosure: retainedPath(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.legacyClosure),
      productionQualificationParity: retainedPath(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.productionQualificationParity),
      reportJson: retainedPath(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson),
      reportMarkdown: retainedPath(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown),
    },
  });
}

test("IMP-24B materializes a byte-reproducible, self-hashed, zero-call pre-live freeze in a disposable root", () => {
  const roots = mkTestRoots("imp24b-pre-live-freeze");
  try {
    prepareRetainedCertification(roots.base);
    const firstBuild = buildImp24BPreLiveFreeze({
      repositoryRoot: REPOSITORY_ROOT,
      retainedArtifactRoot: roots.base,
      outputRoot: roots.base,
    });
    const secondBuild = buildImp24BPreLiveFreeze({
      repositoryRoot: REPOSITORY_ROOT,
      retainedArtifactRoot: roots.base,
      outputRoot: roots.base,
    });
    assert.equal(canonicalJson(firstBuild), canonicalJson(secondBuild));
    assert.equal(firstBuild.modelCalls, 0);
    assert.equal(firstBuild.apiCalls, 0);
    assert.deepEqual(validateImp24BPreLiveFreeze(firstBuild.freeze), []);

    const materialized = materializeImp24BPreLiveFreeze({
      repositoryRoot: REPOSITORY_ROOT,
      retainedArtifactRoot: roots.base,
      outputRoot: roots.base,
    });
    assert.equal(materialized.modelCalls, 0);
    assert.equal(materialized.apiCalls, 0);
    assert.equal(materialized.freeze.frozenAssertions.firstLiveCallOccurred, false);
    assert.equal(materialized.freeze.frozenAssertions.promptsFrozen, true);
    assert.equal(materialized.freeze.frozenAssertions.schemasFrozen, true);
    assert.equal(materialized.freeze.frozenAssertions.goldFrozen, true);
    assert.equal(materialized.freeze.frozenAssertions.thresholdsFrozen, true);
    assert.equal(materialized.freeze.frozenAssertions.candidateOrderFrozen, true);
    assert.equal(materialized.freeze.frozenAssertions.casesFrozen, true);
    assert.equal(materialized.freeze.lifecycle.implementationCommit, null);
    assert.equal(materialized.freeze.lifecycle.evidenceCommit, null);

    for (const output of Object.values(materialized.outputs)) {
      assert.equal(existsSync(output.absolutePath), true, output.relativePath);
      assert.equal(sha256Hex(readFileSync(output.absolutePath)), output.bytesSha256, output.relativePath);
    }

    const corpusPaths = [
      IMP24B_PRE_LIVE_ARTIFACT_PATHS.readerCanaryCorpus,
      IMP24B_PRE_LIVE_ARTIFACT_PATHS.readerHoldoutCorpus,
      IMP24B_PRE_LIVE_ARTIFACT_PATHS.sourceCanaryCorpus,
      IMP24B_PRE_LIVE_ARTIFACT_PATHS.sourceHoldoutCorpus,
      IMP24B_PRE_LIVE_ARTIFACT_PATHS.quizCanaryCorpus,
      IMP24B_PRE_LIVE_ARTIFACT_PATHS.quizHoldoutCorpus,
    ];
    assert.equal(new Set(corpusPaths).size, 6);
    const corpusCounts = corpusPaths.map((relativePath) => {
      const value = JSON.parse(readFileSync(retainedPath(roots.base, relativePath), "utf8")) as {
        payload: { cases: Array<{ caseId: string }> };
      };
      return value.payload.cases.length;
    });
    assert.deepEqual(corpusCounts, [2, 30, 2, 40, 2, 40]);

    const schedule = JSON.parse(readFileSync(retainedPath(roots.base, IMP24B_PRE_LIVE_ARTIFACT_PATHS.schedule), "utf8")) as {
      entryCount: number;
      entries: unknown[];
      scheduleSha256: string;
    };
    assert.equal(schedule.entryCount, 464);
    assert.equal(schedule.entries.length, 464);
    assert.equal(schedule.scheduleSha256, hashCanonical(schedule.entries));

    const budget = JSON.parse(readFileSync(retainedPath(roots.base, IMP24B_PRE_LIVE_ARTIFACT_PATHS.callBudget), "utf8")) as {
      derivation: { canaries: number; holdouts: { reader: number; source: number; quiz: number }; baseMaximum: number; hardMaximum: number };
    };
    assert.equal(budget.derivation.canaries, 24);
    assert.deepEqual(budget.derivation.holdouts, { quiz: 160, reader: 120, source: 160 });
    assert.equal(budget.derivation.baseMaximum, 464);
    assert.equal(budget.derivation.hardMaximum, 928);

    const report = JSON.parse(readFileSync(retainedPath(roots.base, IMP24B_PRE_LIVE_ARTIFACT_PATHS.implementationReport), "utf8")) as {
      schema: string;
      promptId: string;
      continuationPromptId: string;
      baselineHash: string;
      resultHash: string;
      contractVersions: Record<string, number>;
      filesChanged: string[];
      implementationCommit: unknown;
      evidenceCommit: unknown;
      canaryCalls: number;
      holdoutCalls: number;
      liveModelCallsMade: number;
      apiCallsMade: number;
      apiCalls: number;
      pilotRun: boolean;
      goldRun: boolean;
      localSolActivation: boolean;
    };
    assert.deepEqual(validateWorkerReport(report), []);
    assert.equal(report.schema, "worker-implementation-report-v1");
    assert.equal(report.promptId, "IMP-24");
    assert.equal(report.continuationPromptId, "IMP-24B");
    assert.equal(report.baselineHash, IMP24B_STARTING_HEAD);
    assert.equal(report.resultHash, materialized.freeze.configurationHashes.productionInstrumentSealSha256);
    const contractManifest = JSON.parse(readFileSync(resolve(PIPELINE_ROOT, "src/contracts/contract-manifest.json"), "utf8")) as {
      contracts: Array<{ name: string; version: number }>;
    };
    const expectedContractVersions = Object.fromEntries(contractManifest.contracts
      .map(({ name, version }) => [name, version] as const)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
    assert.deepEqual(report.contractVersions, expectedContractVersions);
    assert.equal(Object.keys(report.contractVersions).length, 16);
    assert.equal(report.contractVersions["review-evidence-envelope"], 1);
    assert.equal(report.contractVersions["review-model-output-v2"], 2);
    assert.deepEqual(report.filesChanged, [...new Set(report.filesChanged)].sort());
    for (const relativePath of Object.values(IMP24B_PRE_LIVE_ARTIFACT_PATHS)) {
      assert.equal(report.filesChanged.includes(relativePath), true, relativePath);
    }
    assert.equal(report.filesChanged.includes(".github/workflows/chapterflow-v25-pipeline.yml"), true);
    assert.equal(report.filesChanged.includes(
      "scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/imp24PreLiveFreeze.ts"), true);
    assert.equal(report.filesChanged.includes(
      "scripts/book/prompts/chapterflow-v24-author-pipeline/tests/imp24-pre-live-freeze.test.ts"), true);
    assert.equal(report.filesChanged.includes(
      "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/forward-gold-sweep.schema.json"), true);
    assert.equal(report.implementationCommit, null);
    assert.equal(report.evidenceCommit, null);
    assert.equal(report.canaryCalls, 0);
    assert.equal(report.holdoutCalls, 0);
    assert.equal(report.liveModelCallsMade, 0);
    assert.equal(report.apiCallsMade, 0);
    assert.equal(report.apiCalls, 0);
    assert.equal(report.pilotRun, false);
    assert.equal(report.goldRun, false);
    assert.equal(report.localSolActivation, false);
  } finally {
    roots.dispose();
  }
});

test("IMP-24B freeze validation rejects a recomputed-looking nested mutation until the terminal hash is also changed", () => {
  const core = {
    schema: "imp24b-pre-live-freeze-v1",
    status: "FROZEN_MODEL_FREE_PRE_LIVE",
    promptId: "IMP-24B",
    experimentId: "s16-forward-role-qualification-v3-envelope",
    branch: "feat/v25-pipeline-live",
    draftPr: 401,
    lifecycle: {
      startingLocalHead: "19e1837e6d6d1f2ebc6997700956fc0798aa21ca",
      startingRemoteHead: "19e1837e6d6d1f2ebc6997700956fc0798aa21ca",
      implementationCommit: null,
      evidenceCommit: null,
      lifecycleStatus: "PRE_COMMIT_IDENTITIES_NOT_YET_MINTED",
    },
    frozenAssertions: {
      firstLiveCallOccurred: false,
      promptsFrozen: true,
      schemasFrozen: true,
      goldFrozen: true,
      thresholdsFrozen: true,
      candidateOrderFrozen: true,
      casesFrozen: true,
    },
    zeroCallEvidence: { liveCalls: 0, apiCalls: 0, infrastructureReplays: 0, maxPlanEvents: 0 },
    configurationHashes: {
      corpusBundleSha256: `sha256:${"0".repeat(64)}`,
      corpusPartitionHashes: {
        reader: { canary: `sha256:${"1".repeat(64)}`, holdout: `sha256:${"2".repeat(64)}` },
        source: { canary: `sha256:${"3".repeat(64)}`, holdout: `sha256:${"4".repeat(64)}` },
        quiz: { canary: `sha256:${"5".repeat(64)}`, holdout: `sha256:${"6".repeat(64)}` },
      },
      corpusAuditAgreementSha256: "7".repeat(64),
      promptBundleHashes: { reader: "8".repeat(64), source: "9".repeat(64), quiz: "a".repeat(64) },
      schemaInventorySha256: "b".repeat(64),
      thresholdsSha256: "c".repeat(64),
      candidateOrderSha256: "d".repeat(64),
      candidateAvailabilityPolicySha256: "e".repeat(64),
      scheduleSha256: "f".repeat(64),
      callBudgetSha256: "0".repeat(64),
      productionQualificationParitySha256: "1".repeat(64),
      productionInstrumentSealSha256: "2".repeat(64),
      certificationSha256: "3".repeat(64),
    },
    artifactManifest: [],
    artifactManifestSha256: hashCanonical([]),
    modelCalls: 0,
    apiCalls: 0,
  } as const;
  const valid = { ...core, freezeSha256: hashCanonical(core) } as unknown as Imp24BPreLiveFreeze;
  assert.deepEqual(validateImp24BPreLiveFreeze(valid), []);
  const tampered = JSON.parse(JSON.stringify(valid)) as Imp24BPreLiveFreeze;
  tampered.frozenAssertions.promptsFrozen = false as true;
  assert.match(validateImp24BPreLiveFreeze(tampered).join("; "), /frozen assertion drift|self-hash mismatch/);
});
