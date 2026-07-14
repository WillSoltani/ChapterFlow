import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  validateQuizIntegrityModelOutputV2,
  validateReaderExperienceModelOutputV2,
  validateSourceIntegrityModelOutputV2,
} from "../src/contracts/reviewModelOutputV2.js";
import { codexTransportSchemaCompatibilityErrors } from "../src/exec/codexTransportConfig.js";
import { hermeticExecArgv, resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import { syntheticQualification } from "../src/exec/cliQualification.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

const SCHEMA_DIR = resolve(PIPELINE_DIR, "state/migration-experiments/contracts/schemas");
const FROZEN_SCHEMAS = [
  "reader-experience-model-output-v2.schema.json",
  "source-integrity-model-output-v2.schema.json",
  "quiz-integrity-model-output-v2.schema.json",
] as const;

test("IMP-24E committed reviewer schemas bind directly after static compatibility validation", () => {
  const roots = mkTestRoots("imp24d-codex-transport-schema");
  try {
    const { profile } = resolveExecutionProfile("chapter-reviewer");
    for (const filename of FROZEN_SCHEMAS) {
      const schemaPath = resolve(SCHEMA_DIR, filename);
      const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as unknown;
      assert.deepEqual(codexTransportSchemaCompatibilityErrors(schema), [], filename);

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
      assert.equal(transportPath, schemaPath, `${filename}: Codex must receive the validated canonical schema`);
    }
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
  assert.ok(quizErrors.some((error) => error.includes("defensibleAnswerIndices: duplicate value 0")));
  assert.ok(quizErrors.some((error) => error.includes('evidenceRefIds: duplicate value "QZ-001"')));

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
  assert.ok(readerErrors.filter((error) => error.includes("duplicate value")).length >= 2);

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
