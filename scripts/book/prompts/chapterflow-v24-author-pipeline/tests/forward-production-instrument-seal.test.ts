/** IMP-22 complete production-instrument byte seal. */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import {
  buildForwardProductionInstrumentSeal,
  computeForwardProductionInstrumentSealSha256,
  materializeForwardProductionInstrumentSeal,
  validateForwardProductionInstrumentSeal,
  verifyRetainedForwardProductionInstrumentSeal,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { test, xenv } from "./harness.js";
import { hashCanonical, sha256Hex } from "../src/contracts/contractUtil.js";
import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";
import { IMP24_FROZEN_ROLE_THRESHOLDS } from "../src/bakeoff/migration/roleQualificationRunnerV3.js";
import { campaignInstrumentChecksEnabled, CAMPAIGN_INSTRUMENT_CHECKS_SKIP_REASON } from "../src/lib/campaignInstrumentChecks.js";

test("production instrument seal inventories all implementation/config/schema bytes and validates current checkout", () => {
  const seal = buildForwardProductionInstrumentSeal();
  assert.ok(seal.files.some((file) => file.relativePath.endsWith("src/orchestrator/authorRun.ts")));
  assert.ok(seal.files.some((file) => file.relativePath.endsWith("src/orchestrator/forwardLiveValidationDriver.ts")));
  assert.ok(seal.files.some((file) => file.relativePath.endsWith("config/rubric-thresholds.json")));
  assert.ok(seal.files.some((file) => file.relativePath.endsWith("chapterflow-v24-author-pipeline/package.json")));
  assert.ok(seal.files.some((file) => file.relativePath.endsWith("chapterflow-v24-author-pipeline/package-lock.json")));
  assert.ok(seal.files.some((file) => file.relativePath.endsWith("forward-author-operation-receipt.schema.json")));
  assert.ok(seal.files.some((file) => file.relativePath.endsWith(".agents/skills/chapterflow-book-evaluator/references/rubric-v2.md")));
  assert.equal(seal.sealSha256, computeForwardProductionInstrumentSealSha256(seal));
  assert.doesNotThrow(() => validateForwardProductionInstrumentSeal(seal));
});

test("production instrument seal excludes ignored OS and installed-dependency metadata so clean checkouts reproduce it", () => {
  const root = mkdtempSync(resolve(tmpdir(), "forward-production-seal-portable-"));
  const pipelineRel = "scripts/book/prompts/chapterflow-v24-author-pipeline";
  const fixtureFiles = [
    `${pipelineRel}/src/index.ts`,
    `${pipelineRel}/src/.DS_Store`,
    `${pipelineRel}/src/node_modules/transient-package/index.js`,
    `${pipelineRel}/config/example.json`,
    `${pipelineRel}/state/migration-experiments/contracts/schemas/example.schema.json`,
    `${pipelineRel}/package.json`,
    `${pipelineRel}/package-lock.json`,
    ".agents/skills/chapterflow-book-evaluator/references/rubric-v2.md",
    ".agents/skills/chapterflow-book-evaluator/references/book-rater-prompt.md",
    ".agents/skills/chapterflow-book-evaluator/references/scoring-protocol.md",
    ".agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json",
    ".agents/skills/chapterflow-book-evaluator/references/adjudication-protocol.md",
    ".agents/skills/chapterflow-book-evaluator/references/adjudicated-book.schema.json",
  ];
  try {
    for (const relativePath of fixtureFiles) {
      const path = resolve(root, relativePath);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, relativePath.endsWith(".DS_Store") ? "ignored metadata" : `${relativePath}\n`);
    }
    const seal = buildForwardProductionInstrumentSeal({ repositoryRoot: root });
    assert.ok(seal.files.some((file) => file.relativePath.endsWith("src/index.ts")));
    assert.equal(seal.files.some((file) => file.relativePath.endsWith("/.DS_Store")), false);
    assert.equal(seal.files.some((file) => file.relativePath.includes("/node_modules/")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("recomputed self hash cannot bless substituted package-lock dependency bytes", () => {
  const seal = buildForwardProductionInstrumentSeal();
  const tampered = structuredClone(seal) as any;
  const lock = tampered.files.find((file: { relativePath: string }) => file.relativePath.endsWith("chapterflow-v24-author-pipeline/package-lock.json"));
  assert.ok(lock);
  lock.bytesSha256 = "0".repeat(64);
  tampered.sealSha256 = computeForwardProductionInstrumentSealSha256(tampered);
  assert.throws(() => validateForwardProductionInstrumentSeal(tampered), /bytes drifted/);
});

test("recomputed self hash cannot bless a substituted production-instrument file", () => {
  const seal = buildForwardProductionInstrumentSeal();
  const tampered = structuredClone(seal) as any;
  tampered.files[0].bytesSha256 = "f".repeat(64);
  tampered.sealSha256 = computeForwardProductionInstrumentSealSha256(tampered);
  assert.throws(() => validateForwardProductionInstrumentSeal(tampered), /bytes drifted/);
});

test("zero-model materializer is dry by default and atomically writes reproducible validated bytes", () => {
  const root = mkdtempSync(resolve(tmpdir(), "forward-production-seal-materialize-"));
  const outputPath = resolve(root, "retained", "forward-production-instrument-seal.json");
  try {
    const dry = materializeForwardProductionInstrumentSeal({ outputPath });
    assert.equal(dry.written, false);
    assert.equal(dry.modelCalls, 0);
    assert.equal(dry.apiCalls, 0);
    assert.equal(existsSync(outputPath), false);

    const first = materializeForwardProductionInstrumentSeal({ outputPath, write: true });
    const firstBytes = readFileSync(outputPath);
    assert.equal(first.written, true);
    assert.equal(first.artifactBytesSha256, sha256Hex(firstBytes));
    assert.doesNotThrow(() => validateForwardProductionInstrumentSeal(JSON.parse(firstBytes.toString("utf8"))));

    writeFileSync(outputPath, "{\"tampered\":true}\n");
    const second = materializeForwardProductionInstrumentSeal({ outputPath, write: true });
    assert.deepEqual(readFileSync(outputPath), firstBytes);
    assert.equal(second.sealSha256, first.sealSha256);
    assert.equal(second.artifactBytesSha256, first.artifactBytesSha256);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("production-seal CLI subverb stays dry unless --write is explicit", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "forward-production-seal-cli-"));
  const outputPath = resolve(root, "seal.json");
  try {
    assert.equal(await runMigrationBakeoffCli(["forward-materialize-production-instrument-seal"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      output: outputPath,
      json: true,
    }), 0);
    assert.equal(existsSync(outputPath), false);
    assert.equal(await runMigrationBakeoffCli(["forward-materialize-production-instrument-seal"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      output: outputPath,
      write: true,
      json: true,
    }), 0);
    assert.doesNotThrow(() => validateForwardProductionInstrumentSeal(JSON.parse(readFileSync(outputPath, "utf8"))));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("IMP-24 retained-seal verification fails closed on missing or drifted artifacts", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "forward-production-seal-verify-"));
  const outputPath = resolve(root, "seal.json");
  try {
    assert.throws(() => verifyRetainedForwardProductionInstrumentSeal({ outputPath }), /seal is missing/);
    materializeForwardProductionInstrumentSeal({ outputPath, write: true });
    const verified = verifyRetainedForwardProductionInstrumentSeal({ outputPath });
    assert.equal(verified.verified, true);
    assert.equal(verified.modelCalls, 0);
    assert.equal(verified.apiCalls, 0);
    assert.equal(await runMigrationBakeoffCli(["forward-verify-production-instrument-seal-v2"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      output: outputPath,
      json: true,
    }), 0);
    writeFileSync(outputPath, "{\"tampered\":true}\n");
    assert.throws(() => verifyRetainedForwardProductionInstrumentSeal({ outputPath }), /schema\/version mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// CLOSED campaign instrument (decision ledger L-16; formal retirement in
// WP-202/203/204). The whole-src drift comparison against the current checkout
// runs ONLY under the campaign opt-in, so by default this reports xenv
// (skip-with-reason) and an ordinary src edit cannot break the default suite.
// With CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS=1 it proves today's strict
// behaviour byte-for-byte: a freshly minted seal at an UNEDITED tree verifies,
// and after an authorized byte change it fails exactly as today.
xenv(
  "[campaign] retained-seal STRICT drift refuses a stale seal vs current bytes (CHAPTERFLOW_CAMPAIGN_INSTRUMENT_CHECKS=1)",
  CAMPAIGN_INSTRUMENT_CHECKS_SKIP_REASON,
  () => campaignInstrumentChecksEnabled(),
  () => {
    const root = mkdtempSync(resolve(tmpdir(), "forward-production-seal-campaign-strict-"));
    const outputPath = resolve(root, "retained", "forward-production-instrument-seal.json");
    const pipelineRel = "scripts/book/prompts/chapterflow-v24-author-pipeline";
    const fixtureFiles = [
      `${pipelineRel}/src/index.ts`,
      `${pipelineRel}/config/example.json`,
      `${pipelineRel}/state/migration-experiments/contracts/schemas/example.schema.json`,
      `${pipelineRel}/package.json`,
      `${pipelineRel}/package-lock.json`,
      ".agents/skills/chapterflow-book-evaluator/references/rubric-v2.md",
      ".agents/skills/chapterflow-book-evaluator/references/book-rater-prompt.md",
      ".agents/skills/chapterflow-book-evaluator/references/scoring-protocol.md",
      ".agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json",
      ".agents/skills/chapterflow-book-evaluator/references/adjudication-protocol.md",
      ".agents/skills/chapterflow-book-evaluator/references/adjudicated-book.schema.json",
    ];
    try {
      let mutableSource = "";
      for (const relativePath of fixtureFiles) {
        const path = resolve(root, relativePath);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${relativePath}\n`);
        if (relativePath.endsWith("src/index.ts")) mutableSource = path;
      }
      // UNEDITED tree: strict verify of a freshly minted seal passes.
      materializeForwardProductionInstrumentSeal({ repositoryRoot: root, outputPath, write: true });
      const verified = verifyRetainedForwardProductionInstrumentSeal({ repositoryRoot: root, outputPath });
      assert.equal(verified.verified, true);
      // After an authorized instrument byte change: strict verify fails as today.
      writeFileSync(mutableSource, "export const successor = true;\n");
      assert.throws(() => verifyRetainedForwardProductionInstrumentSeal({ repositoryRoot: root, outputPath }),
        /bytes drifted/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test("IMP-24 threshold CLI writes only the exact frozen model-free artifact", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "imp24-threshold-cli-"));
  const outputPath = resolve(root, "role-thresholds.json");
  try {
    assert.equal(await runMigrationBakeoffCli(["imp24-materialize-thresholds"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      output: outputPath,
      json: true,
    }), 0);
    assert.equal(existsSync(outputPath), false);
    assert.equal(await runMigrationBakeoffCli(["imp24-materialize-thresholds"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      output: outputPath,
      write: true,
      json: true,
    }), 0);
    assert.equal(hashCanonical(JSON.parse(readFileSync(outputPath, "utf8"))), hashCanonical(IMP24_FROZEN_ROLE_THRESHOLDS));
    writeFileSync(outputPath, "{}\n");
    await assert.rejects(() => runMigrationBakeoffCli(["imp24-materialize-thresholds"], {
      campaign: true, // WP-202: un-gate the quarantined subverb
      output: outputPath,
      json: true,
    }), /thresholds differ/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
