/**
 * WS-2 — the structured-output JSON Schemas (submissionSchemas.ts) must stay in SYNC
 * with the hand-written validators (schemas.ts). The drift guard: for each role a known-
 * VALID fixture passes BOTH the schema and `validateSubmission`; and each FIELD-LEVEL
 * violation (short reason, out-of-range score, bad enum, missing required) fails BOTH.
 * If a schema drifts loose (forgets a constraint) or tight (rejects a valid submission),
 * a case here fails. Uses a tiny JSON-Schema-subset checker — no new dependency.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { allSubmissionJsonSchemas, submissionJsonSchemaForRole } from "../src/qc/orchestrator/submissionSchemas.js";
import { validateSubmission, type SubmissionRole } from "../src/qc/orchestrator/schemas.js";

// ── A minimal JSON-Schema-subset validator (covers the dialect submissionSchemas.ts uses). ──
function schemaErrors(schema: any, value: any, path = "$"): string[] {
  const errs: string[] = [];
  if (schema.const !== undefined && value !== schema.const) errs.push(`${path}: const ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: enum`);
  if (schema.anyOf) {
    if (!schema.anyOf.some((s: any) => schemaErrors(s, value, path).length === 0)) errs.push(`${path}: anyOf`);
    return errs;
  }
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : null;
  if (types) {
    const t = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    const ok = types.some((ty: string) => ty === t || (ty === "integer" && t === "number" && Number.isInteger(value)));
    if (!ok) { errs.push(`${path}: type ${types.join("|")} got ${t}`); return errs; }
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${path}: minLength ${schema.minLength}`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path}: maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: minItems ${schema.minItems}`);
    if (schema.items) value.forEach((v, i) => errs.push(...schemaErrors(schema.items, v, `${path}[${i}]`)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const req of schema.required ?? []) if (!(req in value)) errs.push(`${path}.${req}: required`);
    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(value)) if (!(k in schema.properties)) errs.push(`${path}.${k}: additional`);
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in value) errs.push(...schemaErrors(sub, value[k], `${path}.${k}`));
    }
  }
  return errs;
}

const BOOK = "zz-fixture-schema";
const ROUND = "r-schema";

function validFixtures(): Record<SubmissionRole, any> {
  const env = { bookId: BOOK, roundId: ROUND };
  const finding = { unitId: "quiz.questions[1]", repairClass: "quiz_distractor_quality", severity: "major", quote: "q", problem: "p", expectedFix: "f" };
  const nonKeyAxes = ["example_coherence", "prose_coherence", "quiz_distractor_quality", "card_learning_value", "plan_actionability", "factual_accuracy", "behavioral_naturalness", "memorable_line_quality"];
  return {
    sweep: { schemaVersion: "qc-sweep-submission-v1", ...env, role: "sweep", reviewer: "codex-qc:r:sweep", verdict: "PASS", checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"], findings: [] },
    keyA: { schemaVersion: "qc-key-derive-v2", ...env, role: "keyA", reviewer: "codex-qc:r:keyA", chapters: [{ chapterNumber: 1, packHash: "h", answers: [{ questionIndex: 0, choiceIndex: 1, confidence: "high", reason: "Derived from the source fact that the chapter corrects.", sourceFactIds: ["ch01.fact.1"] }] }] },
    keyB: { schemaVersion: "qc-key-derive-v2", ...env, role: "keyB", reviewer: "codex-qc:r:keyB", chapters: [{ chapterNumber: 1, packHash: "h", answers: [{ questionIndex: 0, choiceIndex: 1, confidence: 0.9, reason: "Derived from the source fact that the chapter corrects.", sourceFactIds: ["ch01.fact.1"] }] }] },
    bar: { schemaVersion: "qc-bar-read-v2", ...env, role: "bar", reviewer: "codex-qc:r:bar:ch01", chapterNumber: 1, chapterId: `${BOOK}-ch01`, contentHash: "abc", axes: nonKeyAxes.map((axis) => ({ axis, score: 0.9, tier: "PUBLISHABLE", hits: [] })) },
    confirm: { schemaVersion: "qc-confirm-read-v1", ...env, role: "confirm", reviewer: "codex-qc:r:confirm:ch01", chapterNumber: 1, chapterId: `${BOOK}-ch01`, contentHash: "abc", decision: "PUBLISHABLE", reason: "A second independent read confirms the chapter is publishable.", findings: [] },
    major: { schemaVersion: "qc-major-triage-v1", ...env, role: "major", reviewer: "codex-qc:r:major", findings: [finding], dispositions: [{ findingId: "qcf-1", status: "waived_false_positive", reason: "Gold reference books trip this." }] },
  };
}

const ROLES: SubmissionRole[] = ["sweep", "keyA", "keyB", "bar", "confirm", "major"];

test("every reviewer role has a JSON schema", () => {
  for (const role of ROLES) assert.ok(submissionJsonSchemaForRole(role), `missing schema for ${role}`);
  assert.equal(Object.keys(allSubmissionJsonSchemas()).length, 6);
});

for (const role of ROLES) {
  test(`schema↔validator sync: a valid ${role} fixture passes BOTH the schema and validateSubmission`, () => {
    const fixture = validFixtures()[role];
    const schema = submissionJsonSchemaForRole(role)!.schema;
    assert.deepEqual(schemaErrors(schema, fixture), [], `schema rejected a valid ${role} submission`);
    const v = validateSubmission(BOOK, ROUND, role, fixture);
    assert.equal(v.ok, true, `validator rejected a valid ${role} submission: ${"errors" in v ? v.errors.join("; ") : ""}`);
  });
}

test("schema↔validator sync: a sweep REVISE finding (with its required `family`) passes BOTH", () => {
  const schema = submissionJsonSchemaForRole("sweep")!.schema;
  const finding = { family: "scene_skeleton", chapters: [1, 2], unitId: "examples", quote: "two chapters share one scene frame", problem: "templated shell", expectedFix: "vary the scene structure" };
  const valid = { schemaVersion: "qc-sweep-submission-v1", bookId: BOOK, roundId: ROUND, role: "sweep", reviewer: "codex-qc:r:sweep", verdict: "REVISE", checkedFamilies: ["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"], findings: [finding] };
  assert.deepEqual(schemaErrors(schema, valid), [], "schema rejected a valid sweep REVISE finding");
  assert.equal(validateSubmission(BOOK, ROUND, "sweep", valid).ok, true);
  // Dropping the required `family` must fail BOTH.
  const noFamily = structuredClone(valid);
  delete (noFamily.findings[0] as any).family;
  assert.ok(schemaErrors(schema, noFamily).length > 0, "schema MISSED a sweep finding without family");
  assert.equal(validateSubmission(BOOK, ROUND, "sweep", noFamily).ok, false, "validator MISSED a sweep finding without family");
});

test("schema↔validator sync: a 'no current majors' triage (empty findings + dispositions) passes BOTH", () => {
  const schema = submissionJsonSchemaForRole("major")!.schema;
  const empty = { schemaVersion: "qc-major-triage-v1", bookId: BOOK, roundId: ROUND, role: "major", reviewer: "codex-qc:r:major", findings: [], dispositions: [] };
  assert.deepEqual(schemaErrors(schema, empty), [], "schema must accept an empty major triage (it would force inventing a disposition otherwise)");
  assert.equal(validateSubmission(BOOK, ROUND, "major", empty).ok, true);
  // The validator REQUIRES reviewer — the schema must too (was missing).
  const noReviewer = structuredClone(empty);
  delete (noReviewer as any).reviewer;
  assert.ok(schemaErrors(schema, noReviewer).length > 0, "schema must require reviewer");
  assert.equal(validateSubmission(BOOK, ROUND, "major", noReviewer).ok, false);
});

test("schema↔validator sync: field-level violations fail BOTH (no drift)", () => {
  const f = validFixtures();
  const schema = (role: SubmissionRole) => submissionJsonSchemaForRole(role)!.schema;
  const fails = (role: SubmissionRole, mutate: (x: any) => void, label: string) => {
    const fixture = structuredClone(f[role]);
    mutate(fixture);
    assert.ok(schemaErrors(schema(role), fixture).length > 0, `schema MISSED: ${label}`);
    assert.equal(validateSubmission(BOOK, ROUND, role, fixture).ok, false, `validator MISSED: ${label}`);
  };
  fails("confirm", (x) => { x.reason = "too short"; }, "confirm reason < 40 chars");
  fails("bar", (x) => { x.axes[0].score = 1.5; }, "bar axis score > 1");
  fails("sweep", (x) => { x.verdict = "MAYBE"; }, "sweep verdict not in enum");
  fails("major", (x) => { x.dispositions[0].status = "ignored"; }, "major disposition status not in enum");
  fails("keyA", (x) => { x.chapters[0].answers[0].reason = "short"; }, "key reason < 40 chars");
});
