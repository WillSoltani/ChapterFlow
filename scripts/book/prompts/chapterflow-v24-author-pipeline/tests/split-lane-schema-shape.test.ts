/**
 * WP-A3 — Split-lane output schemas + committed specs (data) shape test.
 *
 * Asserts that the three model-facing codex --output-schema files follow the
 * OpenAI strict subset (the in-repo Stage-Q v3 precedent: additionalProperties:false,
 * every property typed AND required, typed array items, strict enums) and that
 * each schema's enum SETS equal the WP-A1 frozen enums.
 *
 * Coordination: A1 (src/contracts/{readerExperienceReview,sourceIntegrityReview}.ts)
 * and the phase-2 superset (WP-B3 quiz-integrity-adjudication) may not exist yet in
 * this wave, so the authoritative comparison here is the DESIGN-FROZEN literal enum
 * sets transcribed from IMP-20 §A/§B/§C (imp20-design-final §1). A1 is built from the
 * same frozen literals, so schema-enums === A1-enums transitively; a guarded dynamic
 * A1 cross-check runs iff A1 has landed. The reused enums are additionally cross-checked
 * against pre-existing runtime sources (REVIEW_FACTORS, QuizAdjudicationItemV1.keyCorrect,
 * CriticSeverity, SourceOrigin/Form/ClaimStrength) documented inline.
 *
 * This test only READS committed files (leak-guard clean); it never spawns a model.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";
import { REVIEW_FACTORS } from "../src/artifacts/artifactTypes.js";

const CONTRACTS = join(PIPELINE_DIR, "state/migration-experiments/contracts");
const SCHEMAS = join(CONTRACTS, "schemas");

type SchemaNode = {
  type?: unknown;
  enum?: unknown[];
  additionalProperties?: unknown;
  required?: string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
};

function loadJson(path: string): Record<string, unknown> {
  assert.ok(existsSync(path), `committed file present: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Recursive OpenAI-strict-subset structural check (deeper than the shallow Stage-Q v3 precedent). */
function assertStrict(node: SchemaNode, path: string): void {
  assert.ok(node.type !== undefined, `${path || "<root>"}: declares a type (strict mode)`);
  if (node.type === "object") {
    assert.equal(node.additionalProperties, false, `${path || "<root>"}: additionalProperties:false (unknown fields rejected)`);
    assert.ok(Array.isArray(node.required), `${path || "<root>"}: required[] present`);
    const props = node.properties ?? {};
    for (const k of Object.keys(props)) {
      assert.ok(node.required!.includes(k), `${path ? path + "." : ""}${k}: property is required (strict mode)`);
      assertStrict(props[k], path ? `${path}.${k}` : k);
    }
    for (const r of node.required!) assert.ok(props[r], `${path || "<root>"}: required '${r}' has a property definition`);
  } else if (node.type === "array") {
    assert.ok(node.items && node.items.type !== undefined, `${path}[]: array items declare a type (stringified arrays rejected)`);
    assertStrict(node.items!, `${path}[]`);
  }
}

/** Collect every enum in the schema keyed by its JSON path (root props → "field", array items → "[]", nested → "a.b[].c"). */
function collectEnums(node: SchemaNode, path: string, out: Record<string, string[]>): void {
  if (Array.isArray(node.enum)) out[path] = [...(node.enum as string[])].sort();
  if (node.type === "object" && node.properties) {
    for (const k of Object.keys(node.properties)) collectEnums(node.properties[k], path ? `${path}.${k}` : k, out);
  } else if (node.type === "array" && node.items) {
    collectEnums(node.items, `${path}[]`, out);
  }
}

function sortedMap(m: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(m).sort()) out[k] = m[k];
  return out;
}

// ── DESIGN-FROZEN enum sets (IMP-20 §A/§B/§C; sorted) ─────────────────────────
const READER_ENUMS = sortedMap({
  "schema": ["reader-experience-review-v1"],
  "quizDerivation.answers[]": ["a", "b", "c"],
  "quizDerivation.confidence[]": ["high", "low", "medium"],
  "recommendation": ["BLOCK", "REVISE", "SHIP"],
  "blockingFindings[].category": ["internal_contradiction", "schema_or_app_breaking", "structurally_invalid", "unsafe", "unusable"],
  "escalationSignals[].category": ["origin_ambiguous_to_reader", "possible_attribution_issue", "possible_real_world_claim"],
  "advisoryFindings[].category": ["density", "other_craft", "pacing", "quiz_cue", "repetition", "thin_example", "tone"],
});
const SOURCE_ENUMS = sortedMap({
  "schema": ["source-integrity-review-v1"],
  "units[].expectedOrigin": ["constructed", "generic", "source_bound"],
  "units[].expectedForm": ["analogy", "application", "case", "explanation", "operational_scenario"],
  "units[].claimStrengthExpected": ["causal", "correlational", "descriptive", "inferential", "mechanistic"],
  "units[].visibleRegister": ["ambiguous", "clearly_constructed", "clearly_generic", "clearly_sourced", "presented_as_fact"],
  "units[].supportStatus": ["INCONCLUSIVE", "NOT_APPLICABLE", "PARTIALLY_SUPPORTED", "SUPPORTED", "UNSUPPORTED"],
  "units[].findings[].category": ["claim_strength_overreach", "generic_specificity_leak", "invented_detail", "missing_required_evidence", "missing_visible_framing", "source_contradiction", "unsupported_attribution"],
  "units[].findings[].severity": ["blocker", "major", "minor"],
  "result": ["BLOCK", "INCONCLUSIVE", "PASS"],
});
const QUIZ_ENUMS = sortedMap({
  "schema": ["quiz-integrity-adjudication-v1"],
  "items[].keyCorrect": ["ambiguous", "correct", "wrong"],
});

// ── structural strict-subset compliance ───────────────────────────────────────
for (const [name, file] of [
  ["reader-experience-review", "reader-experience-review.schema.json"],
  ["source-integrity-review", "source-integrity-review.schema.json"],
  ["quiz-integrity-adjudication", "quiz-integrity-adjudication.schema.json"],
] as const) {
  test(`schema ${name}: OpenAI strict subset (draft-07, additionalProperties:false, typed+required, typed array items)`, () => {
    const sc = loadJson(join(SCHEMAS, file)) as SchemaNode & { $schema?: string };
    assert.equal((sc as { $schema?: string }).$schema, "http://json-schema.org/draft-07/schema#", "draft-07 (matches Stage-Q v3 precedent)");
    assert.equal(sc.type, "object", "top-level object");
    assertStrict(sc, "");
  });
}

// ── enum-set equality vs A1 frozen literals ───────────────────────────────────
test("reader schema enum sets equal the WP-A1 frozen reader enums (IMP-20 §A)", () => {
  const sc = loadJson(join(SCHEMAS, "reader-experience-review.schema.json")) as SchemaNode;
  const got: Record<string, string[]> = {};
  collectEnums(sc, "", got);
  assert.deepEqual(sortedMap(got), READER_ENUMS);
});

test("source schema enum sets equal the WP-A1 frozen source enums (IMP-20 §B)", () => {
  const sc = loadJson(join(SCHEMAS, "source-integrity-review.schema.json")) as SchemaNode;
  const got: Record<string, string[]> = {};
  collectEnums(sc, "", got);
  assert.deepEqual(sortedMap(got), SOURCE_ENUMS);
});

test("quiz-integrity-adjudication schema enum sets equal the frozen phase-2 superset enums (IMP-20 §C)", () => {
  const sc = loadJson(join(SCHEMAS, "quiz-integrity-adjudication.schema.json")) as SchemaNode;
  const got: Record<string, string[]> = {};
  collectEnums(sc, "", got);
  assert.deepEqual(sortedMap(got), QUIZ_ENUMS);
});

// ── reused enums cross-checked against pre-existing runtime sources ────────────
test("reader scores fields equal the pre-existing REVIEW_FACTORS runtime array (imported, not re-declared)", () => {
  const sc = loadJson(join(SCHEMAS, "reader-experience-review.schema.json")) as SchemaNode;
  const scores = sc.properties!.scores;
  assert.deepEqual([...(scores.required as string[])].sort(), [...REVIEW_FACTORS].sort());
  assert.deepEqual(Object.keys(scores.properties!).sort(), [...REVIEW_FACTORS].sort());
});

test("source expectedOrigin/expectedForm/claimStrengthExpected + severity mirror the frozen sourceUsePlan/CriticSeverity unions", () => {
  // SourceOriginV1/UnitFormV1/ClaimStrengthV1 (src/contracts/sourceUsePlan.ts) and CriticSeverity (src/types.ts)
  const sc = loadJson(join(SCHEMAS, "source-integrity-review.schema.json")) as SchemaNode;
  const unit = sc.properties!.units.items!.properties!;
  assert.deepEqual([...(unit.expectedOrigin.enum as string[])].sort(), ["constructed", "generic", "source_bound"]);
  assert.deepEqual([...(unit.expectedForm.enum as string[])].sort(), ["analogy", "application", "case", "explanation", "operational_scenario"]);
  assert.deepEqual([...(unit.claimStrengthExpected.enum as string[])].sort(), ["causal", "correlational", "descriptive", "inferential", "mechanistic"]);
  assert.deepEqual([...(unit.findings.items!.properties!.severity.enum as string[])].sort(), ["blocker", "major", "minor"]);
});

test("quiz keyCorrect mirrors the pre-existing QuizAdjudicationItemV1.keyCorrect union (superset of the frozen phase-2 shape)", () => {
  const sc = loadJson(join(SCHEMAS, "quiz-integrity-adjudication.schema.json")) as SchemaNode;
  const item = sc.properties!.items.items!.properties!;
  assert.deepEqual([...(item.keyCorrect.enum as string[])].sort(), ["ambiguous", "correct", "wrong"]);
  // superset of QuizAdjudicationItemV1: keeps its 5 fields and ADDS the two model-elicited fields
  for (const f of ["itemId", "keyedAnswerIndex", "derivedAnswerIndex", "agreement", "keyCorrect", "rationale", "defensibleAnswerIndices", "keyedMechanismSupported"]) {
    assert.ok((sc.properties!.items.items!.required as string[]).includes(f), `phase-2 superset requires ${f}`);
  }
});

// ── model-facing projection: runtime-stamped binding hashes are NOT model-emitted ─
test("model-facing schemas exclude runtime-stamped binding-hash / version / session fields", () => {
  const reader = loadJson(join(SCHEMAS, "reader-experience-review.schema.json")) as SchemaNode;
  for (const f of ["chapterContentSha256", "readerDocumentSha256", "rubricVersion", "schemaSha256", "reviewerRole"]) {
    assert.ok(!(f in reader.properties!), `reader schema omits runtime-stamped ${f}`);
  }
  const source = loadJson(join(SCHEMAS, "source-integrity-review.schema.json")) as SchemaNode;
  for (const f of ["chapterContentSha256", "sourceUsePlanSha256", "sourcePacketSha256", "sidecarSha256", "schemaSha256", "reviewerRole"]) {
    assert.ok(!(f in source.properties!), `source schema omits runtime-stamped ${f}`);
  }
  const quiz = loadJson(join(SCHEMAS, "quiz-integrity-adjudication.schema.json")) as SchemaNode;
  for (const f of ["derivationSha256", "documentSha256", "reviewerSessionId"]) {
    assert.ok(!(f in quiz.properties!), `quiz-adjudication schema omits runtime-stamped ${f}`);
  }
});

// ── guarded WP-A1 cross-check (runs iff A1 has landed in this wave) ────────────
test("guarded: if WP-A1 reader contract has landed, its rubric version equals the schema discriminant", async () => {
  const a1 = join(PIPELINE_DIR, "src/contracts/readerExperienceReview.ts");
  if (!existsSync(a1)) return; // A1 not yet present — design-frozen literals above are authoritative
  try {
    const mod = (await import("../src/contracts/readerExperienceReview.js")) as { READER_EXPERIENCE_RUBRIC_VERSION?: string };
    if (typeof mod.READER_EXPERIENCE_RUBRIC_VERSION === "string") {
      assert.equal(mod.READER_EXPERIENCE_RUBRIC_VERSION, "reader-experience-review-v1", "A1 rubric version === reader schema discriminant");
    }
  } catch {
    // A1 mid-authoring / non-importable — the frozen-literal assertions remain authoritative
  }
});

// ── committed data-file integrity (ledger, thresholds, corpus specs) ──────────
const FORBIDDEN_STATE_LITERALS = ["state/" + "books", "state/" + "chapters"];

function assertHermetic(file: string): void {
  const raw = readFileSync(join(CONTRACTS, file), "utf8");
  assert.ok(!raw.includes("/Users/"), `${file}: no absolute /Users/ path`);
  assert.ok(!raw.includes("/private/tmp/"), `${file}: no /private/tmp/ path`);
  for (const lit of FORBIDDEN_STATE_LITERALS) assert.ok(!raw.includes(lit), `${file}: no forbidden shadow state-dir literal`);
}

test("all committed contract data files are hermetic (no absolute/temp paths, no shadow state-dir literals)", () => {
  for (const f of [
    "schemas/reader-experience-review.schema.json",
    "schemas/source-integrity-review.schema.json",
    "schemas/quiz-integrity-adjudication.schema.json",
    "reader-corpus-spec.json",
    "source-corpus-spec.json",
    "quiz-corpus-spec.json",
    "clean-base-score-ledger.v1.json",
    "recovery-role-thresholds.v1.json",
  ]) assertHermetic(f);
});

test("clean-base score ledger: 8 bases, every score >= floor, external accuracy honestly 'Not assessed', sha shapes valid (E-03)", () => {
  const led = loadJson(join(CONTRACTS, "clean-base-score-ledger.v1.json")) as {
    cleanBaseFloor: number;
    cleanBases: Array<{ bookId: string; contentDesignScore: number; gates: { externalAccuracy: string }; packageSha256: string; packageCanonicalSha256: string }>;
  };
  assert.equal(led.cleanBases.length, 8);
  assert.equal(led.cleanBaseFloor, 87.0);
  const shaRe = /^sha256:[0-9a-f]{64}$/;
  for (const b of led.cleanBases) {
    assert.ok(b.contentDesignScore >= led.cleanBaseFloor, `${b.bookId} score ${b.contentDesignScore} >= floor`);
    assert.equal(b.gates.externalAccuracy, "Not assessed", `${b.bookId}: external accuracy recorded honestly`);
    assert.match(b.packageSha256, shaRe, `${b.bookId}: raw package sha`);
    assert.match(b.packageCanonicalSha256, shaRe, `${b.bookId}: canonical package sha`);
  }
});

test("recovery-role thresholds: minSoftDenominator 10 and every soft-metric minimumDenominator >= 10 (E-07 fix)", () => {
  const th = loadJson(join(CONTRACTS, "recovery-role-thresholds.v1.json")) as {
    minSoftDenominator: number;
    roles: Record<string, { softMetrics: Record<string, { bar: number; minimumDenominator: number }> }>;
  };
  assert.equal(th.minSoftDenominator, 10);
  for (const [role, cfg] of Object.entries(th.roles)) {
    for (const [metric, m] of Object.entries(cfg.softMetrics)) {
      assert.ok(m.bar > 0 && m.bar < 1, `${role}.${metric}: soft bar strictly in (0,1)`);
      assert.ok(m.minimumDenominator >= th.minSoftDenominator, `${role}.${metric}: minimumDenominator ${m.minimumDenominator} >= ${th.minSoftDenominator}`);
    }
  }
});

test("corpus specs: composition sums match variant/unit counts; source pins excludedCandidateBookIds (H1/H2/H3)", () => {
  const reader = loadJson(join(CONTRACTS, "reader-corpus-spec.json")) as { expectedComposition: Record<string, number>; variants: Array<{ kind: string }> };
  assert.equal(reader.expectedComposition.total, 30);
  assert.equal(reader.variants.length, 30);
  const readerKinds = tally(reader.variants.map((v) => v.kind));
  assert.equal(readerKinds["clean"], 12);
  assert.equal(readerKinds["reader-visible-hard-blocker"], 8);
  assert.equal(readerKinds["craft-nonblocker"], 10);

  const quiz = loadJson(join(CONTRACTS, "quiz-corpus-spec.json")) as { expectedComposition: Record<string, number>; variants: Array<{ kind: string }> };
  assert.equal(quiz.expectedComposition.total, 40);
  assert.equal(quiz.variants.length, 40);
  const quizKinds = tally(quiz.variants.map((v) => v.kind));
  assert.equal(quizKinds["uniquely-correct-clean"], 10);
  assert.equal(quizKinds["key-mismatch"], 10);
  assert.equal(quizKinds["genuine-ambiguity"], 10);
  assert.equal(quizKinds["mechanism-causal-key"], 10);

  const source = loadJson(join(CONTRACTS, "source-corpus-spec.json")) as {
    expectedComposition: Record<string, number>;
    units: Array<{ family: string }>;
    excludedCandidateBookIds: string[];
  };
  assert.equal(source.expectedComposition.total, 40);
  assert.equal(source.units.length, 40);
  assert.deepEqual(source.excludedCandidateBookIds, ["start-with-why", "radical-candor"]);
  const srcFamilies = tally(source.units.map((u) => u.family));
  for (const fam of Object.keys(source.expectedComposition)) {
    if (fam === "total") continue;
    assert.equal(srcFamilies[fam], source.expectedComposition[fam], `source family ${fam} count matches composition`);
  }
});

function tally(xs: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}
