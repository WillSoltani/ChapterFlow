import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  IMP24C_FROZEN_CONTRACT_COUNT,
  IMP24C_PRE_LIVE_ARTIFACT_PATHS,
  IMP24C_STARTING_HEAD,
  IMP24C_DEDICATED_WORKFLOW_REL,
  assertImp24cFrozenContractCount,
  buildImp24BPreLiveFreeze,
  materializeImp24BPreLiveFreeze,
  validateImp24CDedicatedWorkflowBinding,
  validateImp24BPreLiveFreeze,
  verifyImp24CPreLiveFreeze,
  type Imp24BPreLiveFreeze,
} from "../src/bakeoff/migration/imp24PreLiveFreeze.js";
import { IMP24_FROZEN_ROLE_THRESHOLDS } from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { campaignInstrumentChecksEnabled, CAMPAIGN_INSTRUMENT_CHECKS_SKIP_REASON } from "../src/lib/campaignInstrumentChecks.js";
import { test, xenv } from "./harness.js";
import { walkRootManifest } from "./productionLeakGuard.js";
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

test("IMP-24C materializes a byte-reproducible, self-hashed, zero-call pre-live freeze in a disposable root", () => {
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

    const terminalPath = retainedPath(roots.base, "docs/v25/reports/implementation-report.imp-24.json");
    const terminalSentinel = canonicalPretty({ schema: "old-code-conflict-fixture", finalDecision: "BLOCKED" });
    writeFileAtomic(terminalPath, terminalSentinel);

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
    for (const relativePath of [
      "docs/v25/reports/IMP-24C_CONTROL_PLANE_CORRECTION.md",
      "docs/v25/reports/IMP-24C_PROTOCOL_NOTE.md",
      "docs/v25/reports/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.json",
      "docs/v25/reports/IMP-24C_MODEL_FREE_VERIFICATION_LEDGER.md",
    ]) {
      const bindings = materialized.freeze.artifactManifest.filter((item) => item.relativePath === relativePath);
      assert.equal(bindings.length, 1, `${relativePath}: exactly one manifest binding`);
      const bytes = readFileSync(resolve(REPOSITORY_ROOT, relativePath));
      assert.equal(bindings[0].bytes, bytes.length, `${relativePath}: byte length`);
      assert.equal(bindings[0].bytesSha256, sha256Hex(bytes), `${relativePath}: byte hash`);
    }
    assert.equal(readFileSync(terminalPath, "utf8"), terminalSentinel,
      "pre-live write mode must never overwrite the terminal report");
    assert.notEqual(IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport,
      "docs/v25/reports/implementation-report.imp-24.json");

    for (const output of Object.values(materialized.outputs)) {
      assert.equal(existsSync(output.absolutePath), true, output.relativePath);
      assert.equal(sha256Hex(readFileSync(output.absolutePath)), output.bytesSha256, output.relativePath);
    }

    const corpusPaths = [
      IMP24C_PRE_LIVE_ARTIFACT_PATHS.readerCanaryCorpus,
      IMP24C_PRE_LIVE_ARTIFACT_PATHS.readerHoldoutCorpus,
      IMP24C_PRE_LIVE_ARTIFACT_PATHS.sourceCanaryCorpus,
      IMP24C_PRE_LIVE_ARTIFACT_PATHS.sourceHoldoutCorpus,
      IMP24C_PRE_LIVE_ARTIFACT_PATHS.quizCanaryCorpus,
      IMP24C_PRE_LIVE_ARTIFACT_PATHS.quizHoldoutCorpus,
    ];
    assert.equal(new Set(corpusPaths).size, 6);
    const corpusCounts = corpusPaths.map((relativePath) => {
      const value = JSON.parse(readFileSync(retainedPath(roots.base, relativePath), "utf8")) as {
        payload: { cases: Array<{ caseId: string }> };
      };
      return value.payload.cases.length;
    });
    assert.deepEqual(corpusCounts, [2, 30, 2, 40, 2, 40]);

    const schedule = JSON.parse(readFileSync(retainedPath(roots.base, IMP24C_PRE_LIVE_ARTIFACT_PATHS.schedule), "utf8")) as {
      entryCount: number;
      entries: unknown[];
      scheduleSha256: string;
    };
    assert.equal(schedule.entryCount, 464);
    assert.equal(schedule.entries.length, 464);
    assert.equal(schedule.scheduleSha256, hashCanonical(schedule.entries));

    const budget = JSON.parse(readFileSync(retainedPath(roots.base, IMP24C_PRE_LIVE_ARTIFACT_PATHS.callBudget), "utf8")) as {
      derivation: { canaries: number; holdouts: { reader: number; source: number; quiz: number }; baseMaximum: number; hardMaximum: number };
    };
    assert.equal(budget.derivation.canaries, 24);
    assert.deepEqual(budget.derivation.holdouts, { quiz: 160, reader: 120, source: 160 });
    assert.equal(budget.derivation.baseMaximum, 464);
    assert.equal(budget.derivation.hardMaximum, 928);

    const report = JSON.parse(readFileSync(retainedPath(roots.base, IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport), "utf8")) as {
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
    assert.equal(report.continuationPromptId, "IMP-24C");
    assert.equal(report.baselineHash, IMP24C_STARTING_HEAD);
    assert.equal(report.resultHash, materialized.freeze.configurationHashes.productionInstrumentSealSha256);
    const contractManifest = JSON.parse(readFileSync(resolve(PIPELINE_ROOT, "src/contracts/contract-manifest.json"), "utf8")) as {
      contracts: Array<{ name: string; version: number }>;
    };
    const expectedContractVersions = Object.fromEntries(contractManifest.contracts
      .map(({ name, version }) => [name, version] as const)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
    assert.deepEqual(report.contractVersions, expectedContractVersions);
    // Dynamic against the live manifest so a later WP's additive contract does
    // not break this retained-integrity assertion (the exact-count pin is a
    // CLOSED campaign check gated behind CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS=1;
    // ledger L-16).
    assert.equal(Object.keys(report.contractVersions).length, contractManifest.contracts.length);
    assert.equal(report.contractVersions["review-evidence-envelope"], 1);
    assert.equal(report.contractVersions["review-model-output-v2"], 2);
    assert.deepEqual(report.filesChanged, [...new Set(report.filesChanged)].sort());
    for (const relativePath of Object.values(IMP24C_PRE_LIVE_ARTIFACT_PATHS)) {
      assert.equal(report.filesChanged.includes(relativePath), true, relativePath);
    }
    assert.equal(report.filesChanged.includes(".github/workflows/chapterflow-v25-pipeline.yml"), true, "workflow inventory");
    assert.equal(report.filesChanged.includes(
      "scripts/book/prompts/chapterflow-v24-author-pipeline/src/bakeoff/migration/imp24PreLiveFreeze.ts"), true, "pre-live source inventory");
    assert.equal(report.filesChanged.includes(
      "scripts/book/prompts/chapterflow-v24-author-pipeline/tests/imp24-pre-live-freeze.test.ts"), true, "pre-live test inventory");
    assert.equal(report.filesChanged.includes(
      "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts/schemas/forward-gold-sweep.schema.json"), true, "frozen gold schema inventory");
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

    const executionSpec = JSON.parse(readFileSync(
      retainedPath(roots.base, IMP24C_PRE_LIVE_ARTIFACT_PATHS.executionSpec),
      "utf8",
    )) as { taskBoundary: Record<string, unknown> };
    assert.equal(executionSpec.taskBoundary.authorizedLivePhase, "ROLE_QUALIFICATION_ONLY");
    assert.equal(executionSpec.taskBoundary.automaticFollowOnAllowed, false);
    for (const action of [
      "pilot", "gold", "contentDesignScore", "localSolActivation", "publish", "promote",
      "deploy", "upload", "merge", "forcePush",
    ]) assert.equal(executionSpec.taskBoundary[action], false, action);

    const beforeVerify = walkRootManifest(roots.base);
    const verified = verifyImp24CPreLiveFreeze({
      repositoryRoot: REPOSITORY_ROOT,
      retainedArtifactRoot: roots.base,
      outputRoot: roots.base,
    });
    assert.equal(verified.status, "VERIFIED_BYTE_IDENTICAL_MODEL_FREE_PRE_LIVE");
    assert.equal(verified.writes, 0);
    assert.deepEqual(walkRootManifest(roots.base), beforeVerify, "verify mode must write nothing");
    assert.equal(readFileSync(terminalPath, "utf8"), terminalSentinel,
      "terminal report must survive pre-live verification byte-for-byte");

    const workflowBytes = readFileSync(resolve(REPOSITORY_ROOT, IMP24C_DEDICATED_WORKFLOW_REL));
    const workflowText = workflowBytes.toString("utf8");
    const disposableWorkflowPath = retainedPath(roots.base, IMP24C_DEDICATED_WORKFLOW_REL);
    writeFileAtomic(disposableWorkflowPath, workflowText);
    validateImp24CDedicatedWorkflowBinding(materialized.freeze, roots.base);
    writeFileAtomic(disposableWorkflowPath, `${workflowText}\n# drift\n`);
    assert.throws(() => validateImp24CDedicatedWorkflowBinding(materialized.freeze, roots.base),
      /workflow bytes drifted/);
    writeFileAtomic(disposableWorkflowPath, workflowText);

    writeFileAtomic(retainedPath(roots.base, IMP24C_PRE_LIVE_ARTIFACT_PATHS.runbook), "drift\n");
    assert.throws(() => verifyImp24CPreLiveFreeze({
      repositoryRoot: REPOSITORY_ROOT,
      retainedArtifactRoot: roots.base,
      outputRoot: roots.base,
    }), /differs byte-for-byte/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24C freeze validation rejects a recomputed-looking nested mutation until the terminal hash is also changed", () => {
  const core = {
    schema: "imp24c-pre-live-freeze-v1",
    status: "FROZEN_MODEL_FREE_PRE_LIVE",
    promptId: "IMP-24C",
    experimentId: "s16-forward-role-qualification-v3-envelope-r1",
    branch: "feat/v25-pipeline-live",
    draftPr: 401,
    lifecycle: {
      startingLocalHead: "0ba1b168e350fa5d6c05480a28c7c944411f54ee",
      startingRemoteHead: "0ba1b168e350fa5d6c05480a28c7c944411f54ee",
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

test("IMP-24C reproduces the old terminal-rematerialization conflict fixture and prevents it by path ownership", () => {
  const oldCodeFixture = {
    preliminaryOutputPath: "docs/v25/reports/implementation-report.imp-24.json",
    preliminaryBytes: canonicalPretty({
      implementationCommit: null,
      evidenceCommit: null,
      finalDecision: "INCONCLUSIVE",
    }),
  };
  const finalBytes = canonicalPretty({
    implementationCommit: "e9a90bc17cd997fe1707b5cd62d86ef7a4e743b8",
    evidenceCommit: "7af0f8f91f5892166f534f4438a46343c6251e82",
    finalDecision: "BLOCKED",
  });
  assert.equal(oldCodeFixture.preliminaryOutputPath,
    "docs/v25/reports/implementation-report.imp-24.json");
  assert.notEqual(oldCodeFixture.preliminaryBytes, finalBytes,
    "old write mode would replace the final attestation with preliminary bytes");
  assert.equal(IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport,
    "docs/v25/reports/implementation-report.imp-24.pre-live.json");
  assert.notEqual(IMP24C_PRE_LIVE_ARTIFACT_PATHS.implementationReport,
    oldCodeFixture.preliminaryOutputPath,
    "new pre-live path ownership prevents FINAL_ATTESTATION_REMATERIALIZATION_CONFLICT");
});

test("IMP-24C dedicated V25 workflow uses only read-only lifecycle verification commands", () => {
  const workflow = readFileSync(resolve(REPOSITORY_ROOT, ".github/workflows/chapterflow-v25-pipeline.yml"), "utf8");
  assert.match(workflow, /imp24-materialize-observability-freeze --verify --json/);
  assert.doesNotMatch(workflow, /imp24-materialize-pre-live-freeze --write/);
  assert.doesNotMatch(workflow, /imp24-materialize-pre-live-freeze --verify --json/);
  assert.match(workflow, /imp24-materialize-final-attestation --verify-retained --json/);
  assert.doesNotMatch(workflow, /imp24-materialize-final-attestation --write/);
  assert.match(workflow, /Require a clean worktree/);
});

test("IMP-24C dedicated model-free CI commands preserve every checkout byte", () => {
  const status = (): string => execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  });
  const before = status();
  const smokeReportPath = resolve(REPOSITORY_ROOT, "docs/v25/reports/IMP-24D_TRANSPORT_SMOKE_RESULT.json");
  const observabilityVerificationArgs = existsSync(smokeReportPath)
    ? [
        "migration-bakeoff", "imp24-materialize-observability-freeze", "--verify-historical",
        "--observability-commit",
        String((JSON.parse(readFileSync(smokeReportPath, "utf8")) as Record<string, unknown>)
          .observabilityImplementationCommit ?? ""),
        "--json",
      ]
    : ["migration-bakeoff", "imp24-materialize-observability-freeze", "--verify", "--json"];
  for (const args of [
    ["migration-bakeoff", "imp24-materialize-thresholds", "--json"],
    ["migration-bakeoff", "imp24-certify-instrument", "--json"],
    observabilityVerificationArgs,
    ["migration-bakeoff", "forward-verify-production-instrument-seal-v2", "--json"],
  ]) {
    execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
      cwd: PIPELINE_ROOT,
      env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "1" },
      stdio: ["ignore", "ignore", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
  }
  assert.equal(status(), before, "dedicated CI verification commands must not modify the checkout");
});

// CLOSED campaign instrument (decision ledger L-16; formal retirement in
// WP-202/203/204). The exact-contract-count pin against the CURRENT manifest
// runs ONLY under the campaign opt-in, so by default this reports xenv
// (skip-with-reason) and an additive contract from a later WP cannot break the
// default suite. With CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS=1 it proves the
// strict assertion: exactly the frozen count passes; any drift fails.
xenv(
  "[campaign] pre-live freeze pins the current manifest at the frozen contract count (CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS=1)",
  CAMPAIGN_INSTRUMENT_CHECKS_SKIP_REASON,
  () => campaignInstrumentChecksEnabled(),
  () => {
    const contract = (name: string, version: number) => ({ name, version, ownerPrompt: "IMP-24", hash: "0".repeat(64) });
    const frozen = { contracts: Array.from({ length: IMP24C_FROZEN_CONTRACT_COUNT }, (_v, i) => contract(`c${i}`, 1)) };
    assert.equal(frozen.contracts.length, IMP24C_FROZEN_CONTRACT_COUNT);
    assert.doesNotThrow(() => assertImp24cFrozenContractCount(frozen));
    const additive = { contracts: [...frozen.contracts, contract("c-additive", 1)] };
    assert.throws(() => assertImp24cFrozenContractCount(additive),
      new RegExp(`exactly ${IMP24C_FROZEN_CONTRACT_COUNT} contracts`));
  },
);
