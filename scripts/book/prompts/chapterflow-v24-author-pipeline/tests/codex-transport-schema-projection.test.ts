import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  validateQuizIntegrityModelOutputV2,
  validateReaderExperienceModelOutputV2,
  validateSourceIntegrityModelOutputV2,
} from "../src/contracts/reviewModelOutputV2.js";
import { describeCodexTransportOutputSchema } from "../src/exec/codexTransportConfig.js";
import { hermeticExecArgv, resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import { syntheticQualification } from "../src/exec/cliQualification.js";
import { spawnCodexAgent } from "../src/orchestrator/codexAgent.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const SCHEMA_DIR = resolve(PIPELINE_DIR, "state/migration-experiments/contracts/schemas");
const FROZEN_SCHEMAS = [
  "reader-experience-model-output-v2.schema.json",
  "source-integrity-model-output-v2.schema.json",
  "quiz-integrity-model-output-v2.schema.json",
] as const;

function stripUniqueItems(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUniqueItems);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "uniqueItems")
    .map(([key, child]) => [key, stripUniqueItems(child)]));
}

function uniqueItemsCount(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum, child) => sum + uniqueItemsCount(child), 0);
  if (value === null || typeof value !== "object") return 0;
  return Object.entries(value as Record<string, unknown>)
    .reduce((sum, [key, child]) => sum + (key === "uniqueItems" ? 1 : uniqueItemsCount(child)), 0);
}

test("IMP-24D transport projects only unsupported uniqueItems while frozen schemas remain byte-identical", () => {
  const roots = mkTestRoots("imp24d-codex-transport-schema");
  try {
    const { profile } = resolveExecutionProfile("chapter-reviewer");
    for (const filename of FROZEN_SCHEMAS) {
      const schemaPath = resolve(SCHEMA_DIR, filename);
      const originalBytes = readFileSync(schemaPath, "utf8");
      const original = JSON.parse(originalBytes) as unknown;
      assert.ok(uniqueItemsCount(original) > 0, `${filename}: fixture must exercise the rejected keyword`);

      const argv = hermeticExecArgv({
        profile,
        qualification: syntheticQualification(),
        sandbox: "read-only",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
        writableRoots: [],
        skipGitRepoCheck: true,
        lastMessagePath: resolve(roots.base, `${filename}.last-message.json`),
        task: "fixture",
        outputSchemaPath: schemaPath,
      });
      const transportPath = argv[argv.indexOf("--output-schema") + 1];
      assert.notEqual(transportPath, schemaPath, `${filename}: Codex receives an ephemeral projection`);
      const projected = JSON.parse(readFileSync(transportPath!, "utf8")) as unknown;
      assert.equal(uniqueItemsCount(projected), 0, `${filename}: rejected keyword removed recursively`);
      assert.deepEqual(projected, stripUniqueItems(original),
        `${filename}: no schema field other than uniqueItems may change`);
      assert.equal(readFileSync(schemaPath, "utf8"), originalBytes,
        `${filename}: canonical schema bytes changed`);
    }
  } finally {
    roots.dispose();
  }
});

test("IMP-24D schema projection preserves literal and property names while traversing only schema positions", () => {
  const roots = mkTestRoots("imp24d-codex-transport-schema-context");
  try {
    const schemaPath = resolve(roots.base, "context.schema.json");
    const lastMessagePath = resolve(roots.base, "session", "last-message.txt");
    const schema = JSON.parse(`{
      "type": "object",
      "properties": {
        "uniqueItems": { "type": "string" },
        "__proto__": { "type": "array", "uniqueItems": true, "items": { "type": "string" } }
      },
      "dependentRequired": { "uniqueItems": ["__proto__"] },
      "dependencies": {
        "uniqueItems": ["__proto__"],
        "schemaDependency": { "type": "array", "uniqueItems": true }
      },
      "default": { "uniqueItems": true },
      "enum": [{ "uniqueItems": true }]
    }`) as Record<string, unknown>;
    writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
    const projection = describeCodexTransportOutputSchema({ outputSchemaPath: schemaPath, lastMessagePath });
    assert.equal(projection.removedUniqueItems, 2);
    assert.notEqual(projection.projectedBytes, null);
    const projected = JSON.parse(projection.projectedBytes!) as Record<string, unknown>;
    const properties = projected.properties as Record<string, unknown>;
    assert.ok(Object.hasOwn(properties, "uniqueItems"));
    assert.ok(Object.hasOwn(properties, "__proto__"));
    assert.deepEqual(projected.dependentRequired, { uniqueItems: ["__proto__"] });
    assert.deepEqual(projected.default, { uniqueItems: true });
    assert.deepEqual(projected.enum, [{ uniqueItems: true }]);
    assert.deepEqual((projected.dependencies as Record<string, unknown>).uniqueItems, ["__proto__"]);
    assert.equal("uniqueItems" in ((projected.dependencies as Record<string, unknown>)
      .schemaDependency as Record<string, unknown>), false);

    const plainPath = resolve(roots.base, "plain.schema.json");
    writeFileSync(plainPath, `${JSON.stringify({ type: "string" }, null, 2)}\n`);
    const plain = describeCodexTransportOutputSchema({ outputSchemaPath: plainPath, lastMessagePath });
    assert.equal(plain.transportPath, plainPath);
    assert.equal(plain.projectedBytes, null);
    assert.equal(plain.removedUniqueItems, 0);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D projected schema is private during the runner and removed with the isolated session", async () => {
  const roots = mkTestRoots("imp24d-codex-transport-schema-lifetime");
  try {
    const schemaPath = resolve(SCHEMA_DIR, FROZEN_SCHEMAS[0]);
    let transportPath: string | null = null;
    const result = await spawnCodexAgent({
      task: "fixture",
      sessionId: "imp24d-schema-lifetime",
      cwd: roots.base,
      sandbox: "read-only",
      skipGitRepoCheck: true,
      role: "chapter-reviewer",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      outputSchemaPath: schemaPath,
      qualification: syntheticQualification(),
      manifestSink: resolve(roots.base, "manifests"),
      qualificationCacheDir: resolve(roots.base, "qualification"),
      execBaseDir: resolve(roots.base, "sessions"),
      runner: async ({ argv }) => {
        transportPath = argv[argv.indexOf("--output-schema") + 1] ?? null;
        assert.ok(transportPath !== null && existsSync(transportPath));
        assert.equal(statSync(transportPath).mode & 0o777, 0o600);
        return { stdout: "{}\n", stderr: "", code: 0 };
      },
    });
    assert.equal(result.ok, true);
    assert.ok(transportPath !== null);
    assert.equal(existsSync(transportPath!), false);
    assert.equal(existsSync(dirname(transportPath!)), false);
    const manifest = JSON.parse(readFileSync(result.manifestPath!, "utf8")) as { argv: string[] };
    assert.equal(manifest.argv[manifest.argv.indexOf("--output-schema") + 1], transportPath);
  } finally {
    roots.dispose();
  }
});

test("IMP-24D canonical post-parse validators still reject duplicates in every qualification lane", () => {
  const quizErrors = validateQuizIntegrityModelOutputV2({
    schema: "quiz-integrity-model-output-v2",
    items: [{
      questionRef: "Q-001",
      keyCorrect: "ambiguous",
      defensibleAnswerIndices: [0, 0],
      keyedMechanismSupported: true,
      rationale: "Two options were claimed as defensible.",
      evidenceRefIds: ["QZ-001", "QZ-001"],
    }],
  });
  assert.ok(quizErrors.some((error) => error.includes("duplicate defensible answer index")));
  assert.ok(quizErrors.some((error) => error.includes("duplicate evidence reference")));

  const readerErrors = validateReaderExperienceModelOutputV2({
    schema: "reader-experience-model-output-v2",
    scores: {},
    quizDerivation: {
      answers: ["a"], mechanisms: ["mechanism"], confidence: ["high"], ambiguities: [], tells: [],
      evidenceRefIds: [["RD-001", "RD-001"]],
    },
    recommendation: "SHIP",
    blockingFindings: [], escalationSignals: [], advisoryFindings: [],
    strongestEvidenceRefIds: ["RD-001", "RD-001"],
    weakestEvidenceRefIds: ["RD-002"],
    oneParagraphVerdict: "The chapter is readable.",
  });
  assert.ok(readerErrors.filter((error) => error.includes("duplicate evidence reference")).length >= 2);

  const sourceAssessment = {
    targetRef: "SRC-TARGET-001",
    visibleRegister: "presented_as_fact",
    supportStatus: "SUPPORTED",
    framingAdequate: true,
    claimStrengthFit: true,
    namedSpecificityAllowed: true,
    findings: [],
    rationale: "The source supports the target.",
  };
  const sourceErrors = validateSourceIntegrityModelOutputV2({
    schema: "source-integrity-model-output-v2",
    assessments: [sourceAssessment, { ...sourceAssessment }],
  });
  assert.ok(sourceErrors.some((error) => error.includes("duplicate targetRef")));
});
