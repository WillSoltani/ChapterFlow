/**
 * Canonical JSON Schemas for the QC submission roles — for GPT structured outputs
 * (`response_format: { type: "json_schema", json_schema: … }`). A subagent that emits
 * under one of these schemas CANNOT produce a shape/field-invalid submission, which
 * removes the malformed-submission failure class (the FILL_ME placeholder round-trips and
 * the field-path rejections seen in the the-daily-stoic run). [[gpt-pipeline-run-daily-stoic-2026-06-16]]
 *
 * These mirror the FIELD-LEVEL constraints enforced by `validateSubmission` in schemas.ts
 * (const/enum, minLength, number ranges, minItems, additionalProperties:false). The
 * CROSS-FIELD rules below are NOT expressible in JSON Schema and stay validator-enforced —
 * **the CLI `qc-submit` validator remains authoritative**; structured output guarantees the
 * shape, the CLI re-checks the semantics:
 *   - sweep: PASS requires all 4 families; PASS findings advisory-only; REVISE/CORRUPTION ≥1 finding
 *   - bar: an axis score < 0.6 (or tier CORRUPTION) requires ≥1 cited hit; non-GREEN requires
 *          notes or hits; the FULL required axis set must be present with no duplicates
 *   - confirm: PUBLISHABLE requires zero findings; REVISE/CORRUPTION ≥1 finding
 *   - key: questionIndex/choiceIndex must be real numbers (no null/coercible placeholder)
 *   - the reviewer id must carry an approved QC role prefix (qcReviewerId)
 *
 * KEEP IN SYNC with schemas.ts — `submission-schema-sync.test.ts` fails if a schema drifts
 * from the validator (a valid fixture must pass both; a field-level violation must fail both).
 */

import { ORCHESTRATOR_SUBMISSION_SCHEMAS, SWEEP_FAMILIES, type OrchestratorSubmissionSchema } from "./schemas.js";
import { AXIS_WEIGHTS } from "../../critics/semantic/publishableBar.js";

const FINDING_SEVERITIES = ["blocker", "major", "minor", "advisory"] as const;
const ALL_AXES = Object.keys(AXIS_WEIGHTS);
const NON_KEY_AXES = ALL_AXES.filter((a) => a !== "quiz_key_correctness");

const str = (extra: Record<string, unknown> = {}) => ({ type: "string", ...extra });
const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});

const FINDING = obj(
  {
    chapterNumber: { type: "integer", minimum: 1 },
    chapters: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1 },
    unitId: str({ minLength: 1 }),
    repairClass: str({ minLength: 1 }),
    severity: { type: "string", enum: [...FINDING_SEVERITIES] },
    quote: str({ minLength: 1 }),
    problem: str({ minLength: 1 }),
    expectedFix: str({ minLength: 1 }),
    globalTheme: str(),
  },
  ["unitId", "repairClass", "quote", "problem", "expectedFix"],
);

// A SWEEP finding additionally REQUIRES `family` (one of the 4 templating families);
// its repairClass is DERIVED from family by the validator, so it is optional here.
const SWEEP_FINDING = obj(
  {
    chapterNumber: { type: "integer", minimum: 1 },
    chapters: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1 },
    family: { type: "string", enum: [...SWEEP_FAMILIES] },
    unitId: str({ minLength: 1 }),
    repairClass: str({ minLength: 1 }),
    severity: { type: "string", enum: [...FINDING_SEVERITIES] },
    quote: str({ minLength: 1 }),
    problem: str({ minLength: 1 }),
    expectedFix: str({ minLength: 1 }),
    globalTheme: str(),
  },
  ["family", "unitId", "quote", "problem", "expectedFix"],
);

const AXIS_HIT = obj(
  // `fix` is OPTIONAL (not required) — the reviewer's concrete per-hit remediation, threaded
  // into the repair finding's expectedFix. Legacy submissions omit it (schema stays back-compat).
  { unitId: str({ minLength: 1 }), quote: str({ minLength: 1 }), defect: str({ minLength: 1 }), fix: str({ minLength: 1 }) },
  ["unitId", "quote", "defect"],
);

const axisScore = (axisEnum: string[]) => obj(
  {
    axis: { type: "string", enum: axisEnum },
    score: { type: "number", minimum: 0, maximum: 1 },
    tier: { type: "string", enum: ["CORRUPTION", "GENERATED_DRAFT", "PUBLISHABLE"] },
    hits: { type: "array", items: AXIS_HIT },
  },
  ["axis", "score", "tier", "hits"],
);

const envelope = (schemaVersion: string, role: object) => ({
  schemaVersion: { const: schemaVersion },
  bookId: str({ minLength: 1 }),
  roundId: str({ minLength: 1 }),
  role,
});

function barSchema(version: "qc-bar-read-v1" | "qc-bar-read-v2"): object {
  const axisEnum = version === "qc-bar-read-v2" ? NON_KEY_AXES : ALL_AXES;
  return obj(
    {
      ...envelope(version, { const: "bar" }),
      reviewer: str({ minLength: 1 }),
      chapterNumber: { type: "integer", minimum: 1 },
      chapterId: str({ minLength: 1 }),
      contentHash: str({ minLength: 1 }),
      sourceHash: { type: ["string", "null"] },
      axes: { type: "array", items: axisScore(axisEnum), minItems: axisEnum.length },
      notes: str(),
      // No `verdict` field: the CLI RE-COMPUTES the verdict from the axes (validateBar
      // ignores any submitted verdict), so a structured-output reviewer must not emit one.
    },
    ["schemaVersion", "bookId", "roundId", "role", "reviewer", "chapterNumber", "chapterId", "contentHash", "axes"],
  );
}

const SCHEMAS: Record<OrchestratorSubmissionSchema, object> = {
  "qc-sweep-submission-v1": obj(
    {
      ...envelope("qc-sweep-submission-v1", { const: "sweep" }),
      reviewer: str({ minLength: 1 }),
      verdict: { type: "string", enum: ["PASS", "REVISE", "CORRUPTION"] },
      checkedFamilies: { type: "array", items: { type: "string", enum: [...SWEEP_FAMILIES] }, minItems: 1 },
      findings: { type: "array", items: SWEEP_FINDING },
    },
    ["schemaVersion", "bookId", "roundId", "role", "reviewer", "verdict", "checkedFamilies", "findings"],
  ),
  "qc-key-derive-v2": obj(
    {
      ...envelope("qc-key-derive-v2", { type: "string", enum: ["keyA", "keyB"] }),
      reviewer: str({ minLength: 1 }),
      chapters: {
        type: "array",
        minItems: 1,
        items: obj(
          {
            chapterNumber: { type: "integer", minimum: 1 },
            chapterId: str({ minLength: 1 }),
            packHash: str({ minLength: 1 }),
            contentHash: str({ minLength: 1 }),
            sourceHash: str({ minLength: 1 }),
            answers: {
              type: "array",
              minItems: 1,
              items: obj(
                {
                  questionIndex: { type: "integer", minimum: 0 },
                  choiceIndex: { type: "integer", minimum: 0 },
                  confidence: { anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "string", enum: ["low", "medium", "high"] }] },
                  reason: str({ minLength: 40 }),
                  sourceFactIds: { type: "array", items: str({ minLength: 1 }), minItems: 1 },
                },
                ["questionIndex", "choiceIndex", "confidence", "reason", "sourceFactIds"],
              ),
            },
          },
          ["chapterNumber", "packHash", "answers"],
        ),
      },
    },
    ["schemaVersion", "bookId", "roundId", "role", "chapters"],
  ),
  "qc-bar-read-v1": barSchema("qc-bar-read-v1"),
  "qc-bar-read-v2": barSchema("qc-bar-read-v2"),
  "qc-confirm-read-v1": obj(
    {
      ...envelope("qc-confirm-read-v1", { const: "confirm" }),
      reviewer: str({ minLength: 1 }),
      chapterNumber: { type: "integer", minimum: 1 },
      chapterId: str({ minLength: 1 }),
      contentHash: str({ minLength: 1 }),
      decision: { type: "string", enum: ["PUBLISHABLE", "REVISE", "CORRUPTION"] },
      reason: str({ minLength: 40 }),
      findings: { type: "array", items: FINDING },
    },
    ["schemaVersion", "bookId", "roundId", "role", "reviewer", "chapterNumber", "chapterId", "contentHash", "decision", "reason", "findings"],
  ),
  "qc-major-triage-v1": obj(
    {
      ...envelope("qc-major-triage-v1", { const: "major" }),
      reviewer: str({ minLength: 1 }),
      findings: { type: "array", items: FINDING },
      // dispositions may be EMPTY (a "no current majors" triage) — the validator allows it,
      // so no minItems: forcing ≥1 would make structured output invent a disposition.
      dispositions: {
        type: "array",
        items: obj(
          {
            findingId: str({ minLength: 1 }),
            status: { type: "string", enum: ["open", "waived_false_positive", "waived_accepted_debt"] },
            reason: str({ minLength: 20 }),
          },
          ["findingId", "status", "reason"],
        ),
      },
    },
    ["schemaVersion", "bookId", "roundId", "role", "reviewer", "dispositions"],
  ),
};

/** The QC submission roles a reviewer fills (excludes the orchestrator-only schemas). */
export const SUBMISSION_SCHEMA_BY_ROLE: Record<string, OrchestratorSubmissionSchema> = {
  sweep: "qc-sweep-submission-v1",
  keyA: "qc-key-derive-v2",
  keyB: "qc-key-derive-v2",
  bar: "qc-bar-read-v2", // the round uses v2 (key is injected from the manual keyjudge)
  confirm: "qc-confirm-read-v1",
  major: "qc-major-triage-v1",
};

/** The JSON Schema for a submission schemaVersion (the structured-output `response_format`). */
export function submissionJsonSchema(schemaVersion: OrchestratorSubmissionSchema): object {
  return SCHEMAS[schemaVersion];
}

/** The JSON Schema for a reviewer role (what a `bar`/`confirm`/… subagent emits under). */
export function submissionJsonSchemaForRole(role: string): { schemaVersion: OrchestratorSubmissionSchema; schema: object } | null {
  const schemaVersion = SUBMISSION_SCHEMA_BY_ROLE[role];
  if (!schemaVersion) return null;
  return { schemaVersion, schema: SCHEMAS[schemaVersion] };
}

export function allSubmissionJsonSchemas(): Record<OrchestratorSubmissionSchema, object> {
  return SCHEMAS;
}

// Compile-time guard: a schema exists for every orchestrator submission schemaVersion.
const _exhaustive: Record<OrchestratorSubmissionSchema, object> = SCHEMAS;
void _exhaustive;
void ORCHESTRATOR_SUBMISSION_SCHEMAS;
