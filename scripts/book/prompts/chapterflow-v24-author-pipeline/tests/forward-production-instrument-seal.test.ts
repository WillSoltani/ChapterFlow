/** IMP-22 complete production-instrument byte seal. */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  buildForwardProductionInstrumentSeal,
  computeForwardProductionInstrumentSealSha256,
  materializeForwardProductionInstrumentSeal,
  validateForwardProductionInstrumentSeal,
} from "../src/orchestrator/forwardProductionInstrumentSeal.js";
import { test } from "./harness.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { runMigrationBakeoffCli } from "../src/bakeoff/migration/cli.js";

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
      output: outputPath,
      json: true,
    }), 0);
    assert.equal(existsSync(outputPath), false);
    assert.equal(await runMigrationBakeoffCli(["forward-materialize-production-instrument-seal"], {
      output: outputPath,
      write: true,
      json: true,
    }), 0);
    assert.doesNotThrow(() => validateForwardProductionInstrumentSeal(JSON.parse(readFileSync(outputPath, "utf8"))));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
