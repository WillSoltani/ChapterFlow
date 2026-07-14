import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  validateQuizIntegrityModelOutputV2,
  validateReaderExperienceModelOutputV2,
  validateSourceIntegrityModelOutputV2,
} from "../src/contracts/reviewModelOutputV2.js";
import {
  CODEX_TRANSPORT_SUPPORTED_SCHEMA_KEYWORDS,
  codexTransportSchemaCompatibilityErrors,
  codexTransportSchemaKeywordInventory,
} from "../src/exec/codexTransportConfig.js";
import { syntheticQualification } from "../src/exec/cliQualification.js";
import { hermeticExecArgv, resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import { materializeForwardGoldSweepOutputSchema } from "../src/orchestrator/forwardGoldEvaluatorInstrument.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const SCHEMA_DIR = resolve(PIPELINE_DIR, "state/migration-experiments/contracts/schemas");
const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const QUALIFICATION_AND_PILOT_SCHEMAS = [
  resolve(SCHEMA_DIR, "reader-experience-review.schema.json"),
  resolve(SCHEMA_DIR, "source-integrity-review.schema.json"),
  resolve(SCHEMA_DIR, "quiz-integrity-adjudication.schema.json"),
  resolve(SCHEMA_DIR, "reader-experience-model-output-v2.schema.json"),
  resolve(SCHEMA_DIR, "source-integrity-model-output-v2.schema.json"),
  resolve(SCHEMA_DIR, "quiz-integrity-model-output-v2.schema.json"),
  resolve(SCHEMA_DIR, "forward-author-operation-receipt.schema.json"),
  resolve(SCHEMA_DIR, "forward-repair-operation-receipt.schema.json"),
] as const;
const ALL_PRODUCTION_MODEL_FACING_SCHEMAS = [
  ...QUALIFICATION_AND_PILOT_SCHEMAS,
  resolve(REPOSITORY_ROOT, ".agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json"),
  resolve(REPOSITORY_ROOT, ".agents/skills/chapterflow-book-evaluator/references/adjudicated-book.schema.json"),
  resolve(SCHEMA_DIR, "forward-gold-sweep.schema.json"),
] as const;
const DIRECTLY_PASSED_STATIC_SCHEMAS = ALL_PRODUCTION_MODEL_FACING_SCHEMAS.slice(0, 10);

test("IMP-24E inventories every production output schema and keeps directly passed static schemas compatible", () => {
  assert.equal(ALL_PRODUCTION_MODEL_FACING_SCHEMAS.length, 11);
  assert.equal(new Set(ALL_PRODUCTION_MODEL_FACING_SCHEMAS).size, 11);
  for (const schemaPath of ALL_PRODUCTION_MODEL_FACING_SCHEMAS) {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as unknown;
    const inventory = codexTransportSchemaKeywordInventory(schema);
    assert.ok(inventory.length > 0, `${schemaPath}: empty keyword inventory`);
  }
  for (const schemaPath of DIRECTLY_PASSED_STATIC_SCHEMAS) {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as unknown;
    assert.deepEqual(codexTransportSchemaCompatibilityErrors(schema), [], schemaPath);
    const inventory = codexTransportSchemaKeywordInventory(schema);
    for (const keyword of inventory) {
      assert.ok(new Set<string>(CODEX_TRANSPORT_SUPPORTED_SCHEMA_KEYWORDS).has(keyword),
        `${schemaPath}: unsupported keyword ${keyword}`);
    }
    for (const unsupported of [
      "uniqueItems", "minLength", "const", "definitions", "allOf",
    ]) {
      assert.equal(inventory.includes(unsupported), false, `${schemaPath}: ${unsupported} must stay validator-side`);
    }
  }
});

test("IMP-24E materialized sweep schema is strict-subset compatible and exact for frozen chapters", () => {
  const expectedChapters = Array.from({ length: 8 }, (_, index) => ({
    chapterIndex: index + 1,
    chapterId: `gold-book-ch${String(index + 1).padStart(2, "0")}`,
    title: `Gold chapter ${index + 1}`,
    packagePath: `chapters/ch${String(index + 1).padStart(2, "0")}.chapter.json`,
  }));
  const materialized = materializeForwardGoldSweepOutputSchema({
    expectedChapters,
    repositoryRoot: REPOSITORY_ROOT,
  });
  const schema = JSON.parse(materialized.bytes) as Record<string, unknown>;
  assert.deepEqual(codexTransportSchemaCompatibilityErrors(schema), []);
  assert.equal(materialized.bytesSha256.length, 64);
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const sweep = properties.sweep.properties as Record<string, Record<string, unknown>>;
  const contentHashes = sweep.contentHashes;
  const keys = expectedChapters.map((chapter) => String(chapter.chapterIndex));
  assert.deepEqual(contentHashes.required, keys);
  assert.deepEqual(Object.keys(contentHashes.properties as object), keys);
  assert.equal(contentHashes.additionalProperties, false);

  const roots = mkTestRoots("imp24e-materialized-sweep-schema");
  try {
    const schemaPath = resolve(roots.base, "forward-gold-sweep.materialized.schema.json");
    writeFileSync(schemaPath, materialized.bytes);
    const { profile } = resolveExecutionProfile("chapter-reviewer");
    const argv = hermeticExecArgv({
      profile,
      qualification: syntheticQualification(),
      sandbox: "read-only",
      model: "gpt-5.6-sol",
      reasoningEffort: "xhigh",
      writableRoots: [],
      skipGitRepoCheck: true,
      lastMessagePath: resolve(roots.base, "last-message.json"),
      task: "fixture",
      outputSchemaPath: schemaPath,
    });
    assert.equal(argv[argv.indexOf("--output-schema") + 1], schemaPath);
  } finally {
    roots.dispose();
  }
});

test("IMP-24E hermetic broker rejects an unsupported schema before runner argv is authorized", () => {
  const roots = mkTestRoots("imp24e-schema-policy");
  try {
    const schemaPath = resolve(roots.base, "unsupported.schema.json");
    writeFileSync(schemaPath, JSON.stringify({
      type: "object",
      additionalProperties: false,
      required: ["refs"],
      properties: {
        refs: { type: "array", uniqueItems: true, items: { type: "string" } },
      },
    }));
    const errors = codexTransportSchemaCompatibilityErrors(JSON.parse(readFileSync(schemaPath, "utf8")));
    assert.ok(errors.includes('$.properties.refs.uniqueItems: unsupported Codex transport schema keyword "uniqueItems"'));
    const { profile } = resolveExecutionProfile("chapter-reviewer");
    assert.throws(() => hermeticExecArgv({
      profile,
      qualification: syntheticQualification(),
      sandbox: "read-only",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      writableRoots: [],
      skipGitRepoCheck: true,
      lastMessagePath: resolve(roots.base, "last-message.json"),
      task: "fixture",
      outputSchemaPath: schemaPath,
    }), /unsupported Codex transport schema keyword "uniqueItems"/);
  } finally {
    roots.dispose();
  }
});

test("IMP-24E compatible schemas bind their canonical path without an ephemeral rewrite", () => {
  const roots = mkTestRoots("imp24e-schema-canonical");
  try {
    const { profile } = resolveExecutionProfile("chapter-reviewer");
    for (const schemaPath of QUALIFICATION_AND_PILOT_SCHEMAS) {
      const argv = hermeticExecArgv({
        profile,
        qualification: syntheticQualification(),
        sandbox: "read-only",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
        writableRoots: [],
        skipGitRepoCheck: true,
        lastMessagePath: resolve(roots.base, `${schemaPath.split("/").pop()}.last-message.json`),
        task: "fixture",
        outputSchemaPath: schemaPath,
      });
      assert.equal(argv[argv.indexOf("--output-schema") + 1], schemaPath);
    }
  } finally {
    roots.dispose();
  }
});

test("IMP-24E post-parse validators identify each duplicate field and value", () => {
  const readerErrors = validateReaderExperienceModelOutputV2({
    schema: "reader-experience-model-output-v2",
    scores: {
      retention: 90, quizzes: 90, transfer: 90, practical: 90, summaries: 90,
      tone: 90, limits: 90, insight: 90, density: 90, beginner: 90,
    },
    quizDerivation: {
      answers: ["a"], mechanisms: ["mechanism"], confidence: ["high"], ambiguities: [], tells: [],
      evidenceRefIds: [["RD-001", "RD-001"]],
    },
    recommendation: "SHIP",
    blockingFindings: [{ category: "unsafe", unit: "x", problem: "x", evidenceRefIds: ["RD-002", "RD-002"] }],
    escalationSignals: [{ category: "origin_ambiguous_to_reader", unit: "y", problem: "y", evidenceRefIds: ["RD-003", "RD-003"] }],
    advisoryFindings: [{ category: "tone", unit: "z", problem: "z", evidenceRefIds: ["RD-004", "RD-004"] }],
    strongestEvidenceRefIds: ["RD-005", "RD-005"],
    weakestEvidenceRefIds: ["RD-006", "RD-006"],
    oneParagraphVerdict: "verdict",
  });
  for (const expected of [
    'reader-model-output-v2.quizDerivation.evidenceRefIds[0]: duplicate value "RD-001"',
    'reader-model-output-v2.blockingFindings[0].evidenceRefIds: duplicate value "RD-002"',
    'reader-model-output-v2.escalationSignals[0].evidenceRefIds: duplicate value "RD-003"',
    'reader-model-output-v2.advisoryFindings[0].evidenceRefIds: duplicate value "RD-004"',
    'reader-model-output-v2.strongestEvidenceRefIds: duplicate value "RD-005"',
    'reader-model-output-v2.weakestEvidenceRefIds: duplicate value "RD-006"',
  ]) assert.ok(readerErrors.includes(expected), expected);

  const sourceErrors = validateSourceIntegrityModelOutputV2({
    schema: "source-integrity-model-output-v2",
    assessments: [{
      targetRef: "T-001", visibleRegister: "clearly_sourced", supportStatus: "SUPPORTED",
      framingAdequate: true, claimStrengthFit: true, namedSpecificityAllowed: true,
      findings: [{
        primaryCategory: "invented_detail",
        secondaryCategories: ["missing_visible_framing", "missing_visible_framing"],
        severity: "major", explanation: "x",
        chapterEvidenceRefIds: ["CH-001", "CH-001"],
        sourceEvidenceRefIds: ["SRC-001", "SRC-001"],
      }],
      rationale: "x",
    }],
  });
  for (const expected of [
    'source-model-output-v2.assessments[0].findings[0].secondaryCategories: duplicate value "missing_visible_framing"',
    'source-model-output-v2.assessments[0].findings[0].chapterEvidenceRefIds: duplicate value "CH-001"',
    'source-model-output-v2.assessments[0].findings[0].sourceEvidenceRefIds: duplicate value "SRC-001"',
  ]) assert.ok(sourceErrors.includes(expected), expected);

  const quizErrors = validateQuizIntegrityModelOutputV2({
    schema: "quiz-integrity-model-output-v2",
    items: [{
      questionRef: "Q-001", keyCorrect: "ambiguous", defensibleAnswerIndices: [1, 1],
      keyedMechanismSupported: true, rationale: "x", evidenceRefIds: ["QZ-001", "QZ-001"],
    }],
  });
  assert.ok(quizErrors.includes("quiz-model-output-v2.items[0].defensibleAnswerIndices: duplicate value 1"));
  assert.ok(quizErrors.includes('quiz-model-output-v2.items[0].evidenceRefIds: duplicate value "QZ-001"'));
});
