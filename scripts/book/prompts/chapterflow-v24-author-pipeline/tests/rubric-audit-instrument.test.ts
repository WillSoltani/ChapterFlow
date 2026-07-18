/** s16-rubric-audit-v1 — the D7 gate instrument (plan v2 P1).
 * Proves: (1) the TS receipt/validator port is bit-compatible with the sealed
 * owner audit run (every stored canonical hash reproduced, every record
 * re-validated); (2) audit rendering is app-faithful (full key surface REQUIRED,
 * serialization leaks fail closed, per-layer docs stand alone); (3) batch
 * manifests are create-once and calibration-pinned; (4) the report verdict is
 * fail-closed on the bar, gates, layer independence, and the ±3.0 calibration
 * guard (VOID, never re-scored). */

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  artifactSha256FromText,
  canonicalPyJson,
  judgmentSha256FromText,
  parsePyTree,
} from "../src/bakeoff/migration/rubricAuditCanonical.js";
import { loadRecord } from "../src/bakeoff/migration/rubricAuditReceipts.js";
import {
  RUBRIC_AUDIT_BAR_D7,
  RUBRIC_CALIBRATION_REFERENCES,
  RUBRIC_CORE_DOMAIN_KEYS,
  RUBRIC_DOMAINS,
  RUBRIC_OWNER_RUN_REL_PATH,
  buildRubricAuditBatch,
  buildRubricAuditReport,
  materializeRubricAuditBatch,
  renderAuditChapterDocument,
  renderLayerDocument,
  rubricBand,
  validateChapterRaterRecord,
  verifyOwnerRubricAuditRun,
  type AuditChapter,
  type RubricAuditBatchManifestV1,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const OWNER_RUN_DIR = resolve(REPOSITORY_ROOT, RUBRIC_OWNER_RUN_REL_PATH);
const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";

function chapterFixture(): AuditChapter {
  return {
    number: 3,
    title: "Test Chapter",
    hook: "A hook.",
    counterintuition: "A twist.",
    tryThisNow: "Try it.",
    keyTakeaway: "Take it away.",
    breakdown: { fastRead: "Fast prose.", deepRead: "Deep prose.", fullRead: "Full prose." },
    examples: [{ title: "Ex", scenario: "S", whatToDo: "W", whyItMatters: "M" }],
    quiz: {
      questions: [{
        prompt: "Which?",
        choices: ["first", "second", "third"],
        correctIndex: 1,
        explanation: "The second is right because of the mechanism.",
      }],
    },
    reviewCards: [{ front: "F", back: "B" }],
    implementationPlan: {
      coreSkill: "C",
      ifThenPlans: [{ context: "ctx", plan: "plan" }],
      twentyFourHourChallenge: "24h",
      weeklyPractice: "weekly",
    },
    memorableLines: [{ text: "Line." }],
  };
}

// ── Canonical hashing: python float fidelity ─────────────────────────────────

test("canonicalPyJson preserves python float identity and integer identity", () => {
  assert.equal(canonicalPyJson(parsePyTree('{"a": 3.0}')), '{"a":3.0}');
  assert.equal(canonicalPyJson(parsePyTree('{"a": 3}')), '{"a":3}');
  assert.equal(canonicalPyJson(parsePyTree('{"b": 0.1875, "a": 2.5}')), '{"a":2.5,"b":0.1875}');
  assert.equal(canonicalPyJson(parsePyTree('{"a": [1, 1.0, "x"]}')), '{"a":[1,1.0,"x"]}');
  assert.throws(() => canonicalPyJson(parsePyTree('{"a": 1e-7}')), /proven/);
});

test("TS canonical hashing reproduces the sealed owner-run hashes bit for bit", () => {
  const unit = "nudge-ch03";
  const seal = JSON.parse(readFileSync(resolve(OWNER_RUN_DIR, `jobs/${unit}.receipts/pair.seal.json`), "utf8")) as {
    workers: { primary: Record<string, string>; verification: Record<string, string> };
  };
  const primaryRaw = readFileSync(resolve(OWNER_RUN_DIR, `raw/primary/${unit}.json`), "utf8");
  const verificationRaw = readFileSync(resolve(OWNER_RUN_DIR, `raw/verification/${unit}.json`), "utf8");
  // The primary record carries whole-number floats ("3.0") — a plain
  // JSON.parse/stringify hash CANNOT reproduce this; the fidelity path must.
  assert.equal(artifactSha256FromText(primaryRaw), seal.workers.primary.result_canonical_sha256);
  assert.equal(artifactSha256FromText(verificationRaw), seal.workers.verification.result_canonical_sha256);
  assert.equal(judgmentSha256FromText(primaryRaw), seal.workers.primary.judgment_sha256);
  assert.equal(judgmentSha256FromText(verificationRaw), seal.workers.verification.judgment_sha256);
});

// ── Owner-run end-to-end re-validation (the calibration chain of custody) ───

test("the sealed owner audit run re-validates end-to-end under the TS port", () => {
  const out = verifyOwnerRubricAuditRun({ repositoryRoot: REPOSITORY_ROOT });
  assert.equal(out.allValid, true, JSON.stringify(out.units.flatMap((unit) => unit.errors)));
  assert.equal(out.units.length, 3);
  for (const [index, reference] of RUBRIC_CALIBRATION_REFERENCES.entries()) {
    assert.equal(out.units[index].unit, reference.unit);
    assert.equal(out.units[index].adjudicatedScore, reference.expectedChapterDiagnostic);
  }
});

test("calibration reference documents match their owner-audited bytes", () => {
  for (const reference of RUBRIC_CALIBRATION_REFERENCES) {
    const bytes = readFileSync(resolve(REPOSITORY_ROOT, reference.docRelPath));
    assert.equal(sha256Hex(bytes), reference.docSha256,
      `calibration source drifted: ${reference.unit}`);
  }
});

test("v25 profile requires the layer-independence gate; owner-compat rejects it", () => {
  const unit = "nudge-ch03";
  const inspection = JSON.parse(readFileSync(resolve(OWNER_RUN_DIR, `jobs/${unit}.inspection.json`), "utf8"));
  const dispatch = loadRecord(readFileSync(resolve(OWNER_RUN_DIR, `jobs/${unit}.receipts/primary.dispatch.json`), "utf8"));
  const sourceText = readFileSync(
    resolve(REPOSITORY_ROOT, RUBRIC_CALIBRATION_REFERENCES[0].docRelPath), "utf8");
  const primaryRaw = readFileSync(resolve(OWNER_RUN_DIR, `raw/primary/${unit}.json`), "utf8");

  const asV25 = validateChapterRaterRecord({
    record: loadRecord(primaryRaw), dispatch, inspection, sourceText, profile: "v25",
  });
  assert.ok(asV25.some((error) => error.includes("gates must contain exactly")),
    "a 6-gate record must fail the v25 profile");

  const mutated = JSON.parse(primaryRaw) as Record<string, unknown>;
  (mutated.gates as Record<string, unknown>).layer_independence = {
    status: "pass",
    rationale: "All three layers re-establish their own context.",
    layers: {
      fast: { self_contained: true, findings: [] },
      deep: { self_contained: true, findings: [] },
      full: { self_contained: true, findings: [] },
    },
  };
  const mutatedRecord = { raw: JSON.stringify(mutated), value: mutated };
  const v25Errors = validateChapterRaterRecord({
    record: mutatedRecord, dispatch, inspection, sourceText, profile: "v25",
  });
  assert.deepEqual(v25Errors, [], "a well-formed 7-gate record must pass the v25 profile");

  const layers = ((mutated.gates as Record<string, unknown>).layer_independence as Record<string, unknown>)
    .layers as Record<string, { self_contained: boolean; findings: string[] }>;
  layers.deep.self_contained = false;
  const inconsistent = validateChapterRaterRecord({
    record: { raw: JSON.stringify(mutated), value: mutated }, dispatch, inspection, sourceText, profile: "v25",
  });
  assert.ok(inconsistent.some((error) => error.includes("cannot pass with a non-self-contained layer")),
    "a passing gate over a non-self-contained layer must fail closed");
});

// ── App-faithful rendering ────────────────────────────────────────────────────

test("audit documents carry the full key surface and label app modes", () => {
  const doc = renderAuditChapterDocument({ bookId: "test-book", chapter: chapterFixture() });
  assert.ok(doc.includes("Answer: b)"));
  assert.ok(doc.includes("Explanation: The second is right because of the mechanism."));
  assert.ok(doc.includes("## Fast read (app mode: Guided)"));
  assert.ok(doc.includes("## Deep read (app mode: Standard)"));
  assert.ok(doc.includes("## Full read (app mode: Challenge)"));
});

test("audit rendering fails closed on a missing explanation or serialization leak", () => {
  const noExplanation = chapterFixture();
  noExplanation.quiz.questions[0].explanation = " ";
  assert.throws(() => renderAuditChapterDocument({ bookId: "b", chapter: noExplanation }), /no explanation/);

  const leaking = chapterFixture();
  leaking.hook = `Broken ${String({})}`;
  assert.throws(() => renderAuditChapterDocument({ bookId: "b", chapter: leaking }), /object Object/);

  const badIndex = chapterFixture();
  badIndex.quiz.questions[0].correctIndex = 7;
  assert.throws(() => renderAuditChapterDocument({ bookId: "b", chapter: badIndex }), /out of range/);
});

test("Format v25 quiz feedback fields render when present", () => {
  const chapter = chapterFixture();
  chapter.quiz.questions[0].choiceRationales = ["first is wrong", "second is right", "third is wrong"];
  chapter.quiz.questions[0].revisit = { component: "Deep read", ref: "mechanism paragraph" };
  chapter.quiz.questions[0].confidencePrompt = "How sure were you?";
  const doc = renderAuditChapterDocument({ bookId: "b", chapter });
  assert.ok(doc.includes("Choice a) rationale: first is wrong"));
  assert.ok(doc.includes("Revisit: Deep read — mechanism paragraph"));
  assert.ok(doc.includes("Confidence prompt: How sure were you?"));
});

test("layer documents render exactly one standalone layer with its app mode", () => {
  const chapter = chapterFixture();
  const deep = renderLayerDocument({ bookId: "b", chapter, layer: "deep" });
  assert.ok(deep.includes("## Deep read (app mode: Standard)"));
  assert.ok(deep.includes("Deep prose."));
  assert.ok(!deep.includes("Fast prose.") && !deep.includes("Full prose."));
  const empty = chapterFixture();
  empty.breakdown.fullRead = "  ";
  assert.throws(() => renderLayerDocument({ bookId: "b", chapter: empty, layer: "full" }), /empty/);
});

// ── Batch manifest: create-once + calibration pinning ────────────────────────

function makeTempRepo(): { base: string; dispose: () => void; packageRel: string } {
  const roots = mkTestRoots("rubric-audit");
  const calibrationRel = RUBRIC_CALIBRATION_REFERENCES[0].docRelPath;
  const calibrationBytes = readFileSync(resolve(REPOSITORY_ROOT, calibrationRel));
  const calibrationAbs = resolve(roots.base, calibrationRel);
  mkdirSync(dirname(calibrationAbs), { recursive: true });
  writeFileSync(calibrationAbs, calibrationBytes);
  const packageRel = "book-packages/test-book.v21.json";
  const packageAbs = resolve(roots.base, packageRel);
  mkdirSync(dirname(packageAbs), { recursive: true });
  writeFileSync(packageAbs, JSON.stringify({
    book: { slug: "test-book" },
    chapters: [chapterFixture()],
  }));
  return { base: roots.base, dispose: roots.dispose, packageRel };
}

test("rubric-audit batches are deterministic and create-once", () => {
  const repo = makeTempRepo();
  try {
    const args = {
      repositoryRoot: repo.base,
      auditId: "test-audit-1",
      purpose: "unit test",
      packagePath: repo.packageRel,
      chapterNumbers: [3],
      calibrationUnit: "nudge-ch03",
    };
    const first = materializeRubricAuditBatch({ ...args, write: true });
    assert.equal(first.written, true);
    assert.equal(first.chapterCount, 1);
    const again = materializeRubricAuditBatch({ ...args });
    assert.equal(again.manifestSha256, first.manifestSha256);

    const manifestPath = first.manifestPath;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RubricAuditBatchManifestV1;
    assert.equal(manifest.calibration.docSha256, RUBRIC_CALIBRATION_REFERENCES[0].docSha256);
    assert.equal(manifest.bar.meanMin, RUBRIC_AUDIT_BAR_D7.meanMin);
    const docPath = resolve(repo.base, manifest.chapters[0].docRelPath);
    assert.ok(readFileSync(docPath, "utf8").includes("Answer: b)"));

    // Tampering with a retained audit document must fail the rebuild compare.
    writeFileSync(docPath, "tampered\n");
    assert.throws(() => materializeRubricAuditBatch({ ...args }), /differs from the deterministic rebuild/);
  } finally {
    repo.dispose();
  }
});

test("a drifted calibration source fails batch creation closed", () => {
  const repo = makeTempRepo();
  try {
    const calibrationAbs = resolve(repo.base, RUBRIC_CALIBRATION_REFERENCES[0].docRelPath);
    writeFileSync(calibrationAbs, "drifted calibration bytes\n");
    assert.throws(() => buildRubricAuditBatch({
      repositoryRoot: repo.base,
      auditId: "test-audit-2",
      purpose: "unit test",
      packagePath: repo.packageRel,
      chapterNumbers: [3],
      calibrationUnit: "nudge-ch03",
    }), /calibration reference document drifted/);
  } finally {
    repo.dispose();
  }
});

// ── Report verdicts ───────────────────────────────────────────────────────────

function syntheticAdjudication(score: number, options?: {
  coreDomainScore?: number;
  layerIndependence?: "pass" | "fail";
  safetyGate?: string;
}): Record<string, unknown> {
  const domains: Record<string, unknown> = {};
  for (const spec of RUBRIC_DOMAINS) {
    domains[spec.key] = {
      domain_score: RUBRIC_CORE_DOMAIN_KEYS.includes(spec.key)
        ? options?.coreDomainScore ?? 3.5
        : 3.5,
    };
  }
  return {
    chapter_diagnostic_score: score,
    domains,
    gates: {
      chapter_artifact_completeness: { status: "pass" },
      epistemic_instructional_safety: { status: options?.safetyGate ?? "pass" },
      ethics_reader_autonomy: { status: "pass" },
      purpose_audience_declaration: { status: "conditional" },
      external_accuracy: { status: "not_assessed" },
      actual_book_completeness: { status: "unevaluable" },
      layer_independence: { status: options?.layerIndependence ?? "pass" },
    },
    rater_agreement: {
      mean_absolute_subcriterion_difference: 0.125,
      maximum_subcriterion_difference: 1,
      chapter_diagnostic_score_difference: 1.5,
    },
  };
}

function reportManifest(repo: { base: string; packageRel: string }): RubricAuditBatchManifestV1 {
  const built = buildRubricAuditBatch({
    repositoryRoot: repo.base,
    auditId: "test-report",
    purpose: "unit test",
    packagePath: repo.packageRel,
    chapterNumbers: [3],
    calibrationUnit: "nudge-ch03",
  });
  return built.manifest;
}

test("report verdicts: PASS, FAIL on the bar, VOID on calibration drift", () => {
  const repo = makeTempRepo();
  try {
    const manifest = reportManifest(repo);
    const expected = manifest.calibration.expectedChapterDiagnostic;
    const unit = manifest.chapters[0].unit;

    const pass = buildRubricAuditReport({
      manifest,
      adjudications: new Map([[unit, syntheticAdjudication(88)]]),
      calibrationAdjudication: syntheticAdjudication(expected + 2.9),
    });
    assert.equal(pass.summary.verdict, "PASS");
    assert.equal(pass.chapters[0].band, rubricBand(88));

    const failLow = buildRubricAuditReport({
      manifest,
      adjudications: new Map([[unit, syntheticAdjudication(84)]]),
      calibrationAdjudication: syntheticAdjudication(expected),
    });
    assert.equal(failLow.summary.verdict, "FAIL", "mean below 85 must fail");

    const failLayer = buildRubricAuditReport({
      manifest,
      adjudications: new Map([[unit, syntheticAdjudication(92, { layerIndependence: "fail" })]]),
      calibrationAdjudication: syntheticAdjudication(expected),
    });
    assert.equal(failLayer.summary.verdict, "FAIL", "layer-independence failure must fail regardless of score");

    const failCore = buildRubricAuditReport({
      manifest,
      adjudications: new Map([[unit, syntheticAdjudication(90, { coreDomainScore: 2.75 })]]),
      calibrationAdjudication: syntheticAdjudication(expected),
    });
    assert.equal(failCore.summary.verdict, "FAIL", "a core domain below 3.0 must fail");

    const failGate = buildRubricAuditReport({
      manifest,
      adjudications: new Map([[unit, syntheticAdjudication(90, { safetyGate: "conditional" })]]),
      calibrationAdjudication: syntheticAdjudication(expected),
    });
    assert.equal(failGate.summary.verdict, "FAIL", "a conditional safety gate must fail");

    const voided = buildRubricAuditReport({
      manifest,
      adjudications: new Map([[unit, syntheticAdjudication(95)]]),
      calibrationAdjudication: syntheticAdjudication(expected + 3.1),
    });
    assert.equal(voided.summary.verdict, "VOID_CALIBRATION",
      "calibration drift beyond tolerance voids the batch even at a passing score");
  } finally {
    repo.dispose();
  }
});
