import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { canonicalJson, hashCanonical } from "../src/contracts/contractUtil.js";
import { writeFileAtomic } from "../src/lib/atomicWrite.js";
import { canonicalPretty } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  IMP24_CERTIFICATION_ARTIFACT_PATHS,
  materializeImp24InstrumentCertification,
} from "../src/bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
  IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
} from "../src/bakeoff/migration/imp24Corpus.js";
import {
  IMP24D_HISTORICAL_R1_BINDINGS,
  IMP24D_OBSERVABILITY_FREEZE_PATHS,
  IMP24D_R1_CLOSURE_PATHS,
  buildImp24DObservabilityFreeze,
  materializeImp24DObservabilityFreeze,
  verifyHistoricalImp24DObservabilityFreeze,
  verifyImp24DObservabilityFreeze,
} from "../src/bakeoff/migration/imp24ObservabilityFreeze.js";
import { IMP24C_PRE_LIVE_ARTIFACT_PATHS } from "../src/bakeoff/migration/imp24PreLiveFreeze.js";
import { IMP24_FROZEN_ROLE_THRESHOLDS } from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
  materializeForwardProductionInstrumentSeal,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { test } from "./harness.js";
import { walkRootManifest } from "./productionLeakGuard.js";
import { mkTestRoots } from "./testRoots.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const R1_STATE_REL =
  "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/s16-forward-role-qualification-v3-envelope-r1";

function retained(root: string, relativePath: string): string {
  return resolve(root, relativePath);
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function prepareCurrentCertification(root: string, repositoryRoot = REPOSITORY_ROOT): void {
  const thresholdsPath = retained(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds);
  writeFileAtomic(thresholdsPath, canonicalPretty(IMP24_FROZEN_ROLE_THRESHOLDS));
  const productionSealPath = retained(root, IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH);
  materializeForwardProductionInstrumentSeal({
    repositoryRoot,
    outputPath: productionSealPath,
    write: true,
  });
  materializeImp24InstrumentCertification({
    repositoryRoot,
    thresholdsPath,
    productionSealPath,
    outputPaths: {
      corpusBundle: retained(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle),
      certificationBinding: retained(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding),
      legacyClosure: retained(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.legacyClosure),
      productionQualificationParity: retained(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.productionQualificationParity),
      reportJson: retained(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson),
      reportMarkdown: retained(root, IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown),
    },
  });
}

function copyCurrentInstrumentTree(targetRepositoryRoot: string): void {
  for (const relativePath of [
    "scripts/book/prompts/chapterflow-v24-author-pipeline/src",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/config",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/contracts",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/package.json",
    "scripts/book/prompts/chapterflow-v24-author-pipeline/package-lock.json",
    ".agents/skills/chapterflow-book-evaluator/references",
  ]) {
    cpSync(resolve(REPOSITORY_ROOT, relativePath), resolve(targetRepositoryRoot, relativePath), {
      recursive: true,
      force: true,
    });
  }
}

function copyHistoricalR1(root: string): void {
  for (const item of Object.values(IMP24D_HISTORICAL_R1_BINDINGS)) {
    writeFileAtomic(retained(root, item.relativePath), readFileSync(resolve(REPOSITORY_ROOT, item.relativePath), "utf8"));
  }
  for (const relativePath of Object.values(IMP24D_R1_CLOSURE_PATHS)) {
    writeFileAtomic(retained(root, relativePath), readFileSync(resolve(REPOSITORY_ROOT, relativePath), "utf8"));
  }
  const sourceRoot = resolve(REPOSITORY_ROOT, R1_STATE_REL);
  const copyTree = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const source = resolve(directory, name);
      const stat = lstatSync(source);
      if (stat.isDirectory()) copyTree(source);
      else writeFileAtomic(resolve(root, R1_STATE_REL, relative(sourceRoot, source)), readFileSync(source, "utf8"));
    }
  };
  copyTree(sourceRoot);
}

test("IMP-24D advances only the execution identity while IMP-24C remains pinned to r1", () => {
  assert.equal(IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID,
    "s16-forward-role-qualification-v3-envelope-r1");
  assert.equal(IMP24_ROLE_QUALIFICATION_EXECUTION_ID,
    "s16-forward-role-qualification-v3-envelope-r2");
  assert.match(IMP24C_PRE_LIVE_ARTIFACT_PATHS.executionSpec,
    /s16-forward-role-qualification-v3-envelope-r1\/execution-spec\.json$/);
  assert.doesNotMatch(IMP24C_PRE_LIVE_ARTIFACT_PATHS.executionSpec,
    /s16-forward-role-qualification-v3-envelope-r2/);
});

test("IMP-24D observability freeze is deterministic, binds r1/current evidence, and creates no r2 root", () => {
  const roots = mkTestRoots("imp24d-observability-freeze");
  try {
    prepareCurrentCertification(roots.base);
    copyHistoricalR1(roots.base);
    const r2Root = retained(roots.base,
      `scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/${IMP24_ROLE_QUALIFICATION_EXECUTION_ID}`);
    assert.equal(existsSync(r2Root), false);

    const options = {
      repositoryRoot: REPOSITORY_ROOT,
      retainedArtifactRoot: roots.base,
      outputRoot: roots.base,
    };
    const first = buildImp24DObservabilityFreeze(options);
    const second = buildImp24DObservabilityFreeze(options);
    assert.equal(canonicalJson(first), canonicalJson(second));
    assert.equal(first.freeze.historicalR1.executionId, IMP24_ROLE_QUALIFICATION_R1_EXECUTION_ID);
    assert.equal(first.freeze.historicalR1.disposition, "BLOCKED_OBSERVABILITY_INCOMPLETE");
    assert.equal(first.freeze.historicalR1.mayResume, false);
    assert.equal(first.freeze.historicalR1.mayQualifyProfiles, false);
    assert.equal(first.freeze.successor.executionId, IMP24_ROLE_QUALIFICATION_EXECUTION_ID);
    assert.equal(first.freeze.successor.stateRootCreatedByMaterializer, false);
    assert.equal(first.freeze.successor.mayCreateBeforeTransportSmokePass, false);
    assert.equal(first.freeze.successor.transportSmokeRequired, true);
    assert.equal(first.freeze.successor.transportSmokePassedAtFreeze, false);
    assert.equal(first.modelCalls, 0);
    assert.equal(first.apiCalls, 0);

    const materialized = materializeImp24DObservabilityFreeze(options);
    assert.equal(materialized.freeze.freezeSha256, first.freeze.freezeSha256);
    assert.equal(existsSync(r2Root), false, "materializer must not create the r2 state root");
    for (const path of Object.values(IMP24D_OBSERVABILITY_FREEZE_PATHS)) {
      assert.equal(existsSync(retained(roots.base, path)), true, path);
    }

    const before = walkRootManifest(roots.base);
    const verified = verifyImp24DObservabilityFreeze(options);
    assert.equal(verified.status, "VERIFIED_BYTE_IDENTICAL_OBSERVABILITY_FREEZE");
    assert.equal(verified.writes, 0);
    assert.deepEqual(walkRootManifest(roots.base), before, "verify mode must write nothing");

    writeFileAtomic(retained(roots.base, IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown), "drift\n");
    assert.throws(() => verifyImp24DObservabilityFreeze(options), /differs byte-for-byte/);

    writeFileAtomic(retained(roots.base, IMP24D_OBSERVABILITY_FREEZE_PATHS.markdown),
      materialized.outputs.markdown.bytes);
    writeFileAtomic(retained(roots.base, `${R1_STATE_REL}/candidate-availability.json`), "{}\n");
    assert.throws(() => buildImp24DObservabilityFreeze(options),
      /historical r1 state tree differs byte-for-byte/);
  } finally {
    roots.dispose();
  }
});

test("dedicated V25 workflow verifies the IMP-24D freeze read-only and never rewrites historical IMP-24C", () => {
  const workflow = readFileSync(resolve(REPOSITORY_ROOT, ".github/workflows/chapterflow-v25-pipeline.yml"), "utf8");
  assert.match(workflow, /imp24-materialize-observability-freeze --verify --json/);
  assert.match(workflow,
    /imp24-materialize-observability-freeze[\s\\]+--verify-historical --observability-commit/);
  assert.match(workflow, /observabilityImplementationCommit/);
  assert.doesNotMatch(workflow, /imp24-materialize-observability-freeze --write/);
  assert.doesNotMatch(workflow, /imp24-materialize-pre-live-freeze --write/);
  assert.doesNotMatch(workflow, /imp24-materialize-pre-live-freeze --verify --json/);
});

test("later correction and final checkouts verify Commit-A observability-freeze bytes historically", () => {
  const roots = mkTestRoots("imp24d-historical-observability-freeze");
  try {
    const repositoryRoot = resolve(roots.base, "repository");
    execFileSync("git", ["clone", "--local", "--shared", REPOSITORY_ROOT, repositoryRoot], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    git(repositoryRoot, ["config", "user.name", "IMP-24D Freeze Fixture"]);
    git(repositoryRoot, ["config", "user.email", "imp24d-freeze@example.invalid"]);
    copyCurrentInstrumentTree(repositoryRoot);
    prepareCurrentCertification(repositoryRoot, repositoryRoot);
    copyHistoricalR1(repositoryRoot);
    const options = { repositoryRoot };
    const materialized = materializeImp24DObservabilityFreeze(options);
    git(repositoryRoot, ["add", "--all"]);
    git(repositoryRoot, ["commit", "-m", "fixture observability commit"]);
    const observabilityCommit = git(repositoryRoot, ["rev-parse", "HEAD"]);
    const original = materialized.freeze.currentImplementation;

    const liveRunnerPath = retained(repositoryRoot,
      "scripts/book/prompts/chapterflow-v24-author-pipeline/src/orchestrator/forwardRoleQualificationLiveV3.ts");
    writeFileAtomic(liveRunnerPath,
      `${readFileSync(liveRunnerPath, "utf8")}\n// fixture-only bounded transport correction\n`);
    prepareCurrentCertification(repositoryRoot, repositoryRoot);
    git(repositoryRoot, ["add", "--all"]);
    git(repositoryRoot, ["commit", "-m", "fixture valid reminted correction descendant"]);

    const beforeStatus = git(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
    const beforeFreezeBytes = Object.fromEntries(Object.values(IMP24D_OBSERVABILITY_FREEZE_PATHS)
      .map((path) => [path, readFileSync(retained(repositoryRoot, path), "utf8")]));
    const verified = verifyHistoricalImp24DObservabilityFreeze({
      ...options,
      observabilityImplementationCommit: observabilityCommit,
    });
    assert.equal(verified.status, "VERIFIED_BYTE_IDENTICAL_HISTORICAL_OBSERVABILITY_FREEZE");
    assert.equal(verified.freezeSha256, materialized.freeze.freezeSha256);
    assert.equal(verified.frozenSemanticsSha256,
      hashCanonical(materialized.freeze.frozenSemantics));
    assert.notEqual(verified.effectiveImplementation.productionInstrumentSealSha256,
      original.productionInstrumentSealSha256, "valid correction must remint the production seal");
    assert.notEqual(verified.effectiveImplementation.certificationSha256,
      original.certificationSha256, "valid correction must remint certification");
    assert.notEqual(verified.effectiveImplementation.productionQualificationParitySha256,
      original.productionQualificationParitySha256, "valid correction must remint production/qualification parity");
    assert.equal(git(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]), beforeStatus,
      "historical verify must not change working-tree status");
    for (const [path, bytes] of Object.entries(beforeFreezeBytes)) {
      assert.equal(readFileSync(retained(repositoryRoot, path), "utf8"), bytes,
        `historical verify rewrote ${path}`);
    }

    writeFileAtomic(retained(repositoryRoot, IMP24D_OBSERVABILITY_FREEZE_PATHS.json), "{}\n");
    assert.throws(() => verifyHistoricalImp24DObservabilityFreeze({
      ...options,
      observabilityImplementationCommit: observabilityCommit,
    }), /invalid|differs byte-for-byte/);
  } finally {
    roots.dispose();
  }
});
