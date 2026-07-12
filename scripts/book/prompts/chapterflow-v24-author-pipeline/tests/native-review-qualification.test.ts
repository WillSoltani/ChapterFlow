/**
 * IMP-19 — Layer-N v2 (native production-reviewer qualification): full-semantic
 * corpus hashing, fail-closed corpus admission (incl. the v1 stub-corpus
 * regression), capability-specific scoring through the CORRECT channel (the
 * LN-04 fix), the non-pooled qualification conjunction, and candidate-review
 * enforcement (missing / not-qualified / dry-run / v1-record / hash-drift /
 * profile-mismatch all fail closed).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import type { ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";
import { CHAPTER_REVIEW_SCHEMA_VERSION } from "../src/artifacts/artifactTypes.js";
import { migrationRoots, MigrationGuardError } from "../src/bakeoff/migration/guards.js";
import {
  admitChapter,
  nativeReviewCorpusSha256,
  scoreNativeReviewCase,
  scoreNativeReviewJudge,
  qualifyNativeReviewJudge,
  validateNativeReviewCorpusV2,
  type NativeReviewRead,
} from "../src/bakeoff/migration/nativeReviewQualification.js";
import {
  assertLayerOPrerequisiteFresh,
  assertNativeReviewQualified,
  buildLayerOPrerequisiteBinding,
  nativeReviewQualificationPath,
  sealNativeReview,
} from "../src/bakeoff/migration/nativeReviewSeal.js";
import type {
  LayerOPrerequisiteBindingV1,
  NativeReviewCorpusItemV2,
  NativeReviewCorpusV2,
  NativeReviewQualificationV2,
  NativeReviewSealV2,
  NativeReviewThresholdsV2,
} from "../src/bakeoff/migration/nativeReviewTypes.js";
import type { ChapterV21 } from "../src/types.js";
import type { JudgeSpec } from "../src/bakeoff/review.js";
import { fxChapter } from "./migrationFixtures.js";
import { tmpRoot } from "./model-bakeoff-helpers.js";

const OI = resolve("state/migration-experiments/_owner-inputs");
const CORPUS_PATH = resolve(OI, "stage-q/layer-n-v2-corpus.json");
const V1_CORPUS_PATH = resolve(OI, "stage-q/layer-n-corpus.owner-approved.v1.json");
const THRESHOLDS_PATH = resolve(OI, "native-review-thresholds.v2.json");
const LAYER_O_SEAL_PATH = resolve(OI, "stage-q/STAGE-Q-V3-SEAL.json");

/** Hermetic fake Layer-O prerequisite binding for enforcement unit tests (no file
 *  reads — assertNativeReviewQualified only deep-compares it unless ownerInputsDir
 *  is passed). Real binding construction is covered by the seal + drift tests. */
const PREREQ: LayerOPrerequisiteBindingV1 = {
  schema: "migration-layer-o-prerequisite-binding-v1", instrument: "stage-q-layer-o-v3",
  sealSchema: "s16-stage-q-v3-seal-v1", sealPath: "stage-q/STAGE-Q-V3-SEAL.json", sealSha256: "OSEAL",
  qualificationResultPath: "stage-q/v3/STAGE-Q-V3-QUALIFICATION-RESULT.json", qualificationResultSha256: "ORES",
  qualificationOutcome: "ALL_THREE_JUDGES_QUALIFIED", ownerAdjudicationPath: "stage-q/v3/STAGE-Q-V3-QUALIFICATION-ADDENDUM.json",
  ownerAdjudicationSha256: "OADD", ownerAdjudicationOutcome: "PASS_WITH_DISCLOSED_NON_MATERIAL_AMBIGUITY",
  panel: [{ model: "gpt-5.5", effort: "high" }],
  requiredSecurityResult: { allJudgesQualified: true, injectionDetectionRate: 1, takeoverResistanceRate: 1, boundaryPreservationRate: 1, maxSuccessfulTakeovers: 0 },
};

function loadV2Corpus(): NativeReviewCorpusV2 {
  return JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as NativeReviewCorpusV2;
}
function loadThresholds(): NativeReviewThresholdsV2 {
  return JSON.parse(readFileSync(THRESHOLDS_PATH, "utf8")) as NativeReviewThresholdsV2;
}

/** A ChapterReviewV1 with sane defaults; override only what a test asserts on. */
function mkReview(over: Partial<ChapterReviewV1> = {}): ChapterReviewV1 {
  return {
    schemaVersion: CHAPTER_REVIEW_SCHEMA_VERSION,
    chapterId: "x", chapterNumber: 1, contentHash: "h", reviewerSessionId: "s",
    scores: {} as never, composite: 90, ship84: true, pass: true, valid: true,
    keyCheck: { derived: [], matches: 9, of: 9, disagreements: [] },
    quotes: [], tells: [], complaints: [], oneParagraphVerdict: "ok",
    ...over,
  };
}

/** A quiz chapter whose questions carry the ids the quiz scorers look up. */
function quizChapter(): ChapterV21 {
  const c = fxChapter() as ChapterV21 & { quiz: { questions: Array<{ questionId: string }> } };
  c.quiz = { passingScorePercent: 70, questions: [
    { questionId: "q1", prompt: "p1", choices: ["a", "b", "c"], correctIndex: 0, explanation: "e1" },
    { questionId: "q2", prompt: "p2", choices: ["a", "b", "c"], correctIndex: 1, explanation: "e2" },
  ] } as never;
  return c;
}

function item(over: Partial<NativeReviewCorpusItemV2>): NativeReviewCorpusItemV2 {
  return {
    itemId: "i", baseItemId: "i", kind: "clean-pass", chapter: fxChapter(),
    expected: {}, mutationManifest: null, evidenceProvenance: "test",
    approvalStatus: "owner-approved-development-fixture", requiresPhase2: false,
    ...over,
  };
}
const read = (itemId: string, review: ChapterReviewV1 | null, raw: string | null = null): NativeReviewRead => ({ itemId, review, rawFinalMessage: raw });

// ── Full-semantic corpus hash (LN-07) ─────────────────────────────────────────

test("native-review corpus hash changes on gold/kind/evidence/provenance edits", () => {
  const base: NativeReviewCorpusV2 = {
    schema: "migration-native-review-corpus-v2", corpusId: "c", version: "v", sourceCorpus: "s",
    approvalStatus: "owner-approved-development-fixture", independentHumanRater: false,
    items: [item({ itemId: "a", expected: { expectedPass: true, prohibitMustFix: true } })],
  };
  const h0 = nativeReviewCorpusSha256(base);
  const mut = (f: (c: NativeReviewCorpusV2) => void): string => { const c = JSON.parse(JSON.stringify(base)) as NativeReviewCorpusV2; f(c); return nativeReviewCorpusSha256(c); };
  assert.notEqual(h0, mut((c) => { c.items[0].kind = "craft-nonblocker"; }), "kind change must move the hash");
  assert.notEqual(h0, mut((c) => { c.items[0].expected.requireMustFix = true; }), "expected change must move the hash");
  assert.notEqual(h0, mut((c) => { c.items[0].expected.acceptedEvidenceSpans = ["z"]; }), "evidence span change must move the hash");
  assert.notEqual(h0, mut((c) => { c.items[0].evidenceProvenance = "other"; }), "provenance change must move the hash");
  assert.notEqual(h0, mut((c) => { c.independentHumanRater = true; }), "corpus-level provenance change must move the hash");
  assert.equal(h0, mut((c) => { void c; }), "no change ⇒ stable hash");
});

// ── Corpus admission (fail-closed) ────────────────────────────────────────────

test("the real v2 corpus validates with zero problems", () => {
  if (!existsSync(CORPUS_PATH)) return; // artifact present in the pipeline tree
  assert.deepEqual(validateNativeReviewCorpusV2(loadV2Corpus()), []);
});

test("REGRESSION: the v1 stub corpus is rejected before any spawn", () => {
  if (!existsSync(V1_CORPUS_PATH)) return;
  const v1 = JSON.parse(readFileSync(V1_CORPUS_PATH, "utf8")) as { items: Array<{ itemId: string; chapter: ChapterV21 }> };
  // Present the v1 stub chapters as v2 clean-pass items: they must be rejected on
  // the render-size floor / completeness / ship-clean gate (the v1 defect).
  const asV2: NativeReviewCorpusV2 = {
    schema: "migration-native-review-corpus-v2", corpusId: "v1asv2", version: "v", sourceCorpus: "v1",
    approvalStatus: "owner-approved-development-fixture", independentHumanRater: false,
    items: v1.items.slice(0, 8).map((it) => item({ itemId: `s-${it.itemId}`, baseItemId: `s-${it.itemId}`, kind: "clean-pass", chapter: it.chapter, expected: { expectedPass: true, prohibitMustFix: true } })),
  };
  const problems = validateNativeReviewCorpusV2(asV2);
  assert.ok(problems.length > 0, "v1 stubs must be rejected");
  assert.ok(problems.some((p) => /stub|render|incomplete|ship-clean|NOT ship/i.test(p)), `expected a stub/size/ship rejection, got: ${problems.slice(0, 3).join(" | ")}`);
});

test("wrong-schema corpus (a v1 QualCorpusV1) is rejected immediately", () => {
  const problems = validateNativeReviewCorpusV2({ schema: "migration-qual-corpus-v1" } as unknown as NativeReviewCorpusV2);
  assert.ok(problems.some((p) => /schema must be/.test(p)));
});

test("variant with an undeclared changed path is rejected", () => {
  const c = loadV2Corpus();
  const km = c.items.find((i) => i.kind === "quiz-key-mismatch")!;
  // mutate a field NOT in the manifest's allowedPaths → undeclared diff
  (km.chapter as unknown as { title: string }).title = "TAMPERED TITLE";
  const problems = validateNativeReviewCorpusV2(c);
  assert.ok(problems.some((p) => /undeclared changed paths|variantContentSha256|protected region/i.test(p)), problems.slice(0, 3).join(" | "));
});

test("min-count coverage is enforced (LN-10: no single-seed capability)", () => {
  const c = loadV2Corpus();
  c.items = c.items.filter((i) => i.kind !== "reader-visible-hard-blocker"); // drop a whole capability
  const problems = validateNativeReviewCorpusV2(c);
  assert.ok(problems.some((p) => /reader-visible-hard-blocker.*minimum/.test(p)));
});

// ── Deterministic admission ───────────────────────────────────────────────────

test("admitChapter flags a tiny stub and passes a complete clean chapter", () => {
  const stub = fxChapter({ examples: [], quiz: { passingScorePercent: 70, questions: [] } } as never);
  const a = admitChapter(stub);
  assert.equal(a.complete, false, "a stub is incomplete");
  const c = loadV2Corpus();
  const clean = c.items.find((i) => i.kind === "clean-pass")!;
  const ac = admitChapter(clean.chapter);
  assert.equal(ac.complete, true);
  assert.equal(ac.shipClean, true);
  assert.ok(ac.renderedBytes > 8000);
});

// ── Capability-specific scoring (LN-04) ───────────────────────────────────────

test("clean-pass scores correct only when the reviewer ships with clean keys and no mustFix", () => {
  const it = item({ kind: "clean-pass", expected: { expectedPass: true, prohibitMustFix: true } });
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview())).contrib.cleanPassCorrect, true);
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ complaints: [{ unit: "deep read", problem: "x", mustFix: true }] }))).contrib.cleanPassCorrect, false);
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ pass: false }))).contrib.cleanPassCorrect, false);
});

test("hard-blocker detected via mustFix-in-unit + verified mutation evidence; ship bit does NOT gate detection (v2.2 fix)", () => {
  const it = item({ kind: "reader-visible-hard-blocker", baseItemId: "b", expected: { requireMustFix: true, targetUnits: ["example 3"], acceptedEvidenceSpans: ["THE PLANTED LIE"] } });
  // mustFix in the target unit + a complaint quoting the span
  const hit = scoreNativeReviewCase(it, read("i", mkReview({ pass: false, complaints: [{ unit: "example 3", problem: "this says THE PLANTED LIE which contradicts the chapter", mustFix: true }] })));
  assert.equal(hit.detected, true);
  assert.equal(hit.contrib.hardBlockerEvidenceOk, true);
  // top-level verified quote provides the evidence instead of the complaint text
  const viaQuote = scoreNativeReviewCase(it, read("i", mkReview({ pass: false, quotes: [{ quote: "THE PLANTED LIE", why: "contradiction", verified: true }], complaints: [{ unit: "example 3", problem: "internal contradiction", mustFix: true }] })));
  assert.equal(viaQuote.contrib.hardBlockerEvidenceOk, true, "a verified top-level quote must satisfy evidence matching");
  // v2.2 REGRESSION (INSTRUMENT_INVALID fix): the reviewer SHIPPED (ship84/pass=true)
  // but raised the reserved-category mustFix on the target unit with verified mutation
  // evidence — production treats the mustFix as the ship-blocker, so this IS a detection
  // (the score-based ship bit must NOT gate hard-blocker detection).
  const shippedButFlagged = scoreNativeReviewCase(it, read("i", mkReview({ pass: true, ship84: true, quotes: [{ quote: "THE PLANTED LIE", why: "contradiction", verified: true }], complaints: [{ unit: "example 3", problem: "contradicts the chapter", mustFix: true }] })));
  assert.equal(shippedButFlagged.detected, true, "ship84=true must NOT gate hard-blocker detection (v2.2)");
  assert.equal(shippedButFlagged.contrib.directionalityVariantBlocks, false, "ship-direction is tracked separately (this variant did not block on score)");
  // mustFix in the WRONG unit → not detected
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ pass: false, complaints: [{ unit: "quiz Q2", problem: "unrelated", mustFix: true }] }))).detected, false);
  // no reserved-category mustFix at all → not detected (regardless of ship)
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ pass: false }))).detected, false);
});

test("key-mismatch detected via keyCheck.disagreements OR phase-2 keyCorrect=wrong (not a complaint anchor)", () => {
  const it = item({ kind: "quiz-key-mismatch", baseItemId: "b", chapter: quizChapter(), requiresPhase2: true, expected: { expectedKeyMismatchQuestions: [1] } });
  // phase-2 channel
  const p2 = scoreNativeReviewCase(it, read("i", mkReview({ quizAdjudication: { status: "adjudicated", items: [{ itemId: "q1", keyedAnswerIndex: 0, derivedAnswerIndex: 1, agreement: false, keyCorrect: "wrong", rationale: "r" }] } })));
  assert.equal(p2.resolved, true); assert.equal(p2.detected, true);
  // phase-1 keyCheck channel (disagreement names the question)
  const p1 = scoreNativeReviewCase(it, read("i", mkReview({ quizAdjudication: { status: "adjudicated", items: [] }, keyCheck: { derived: [], matches: 8, of: 9, disagreements: ["Q1"] } })));
  assert.equal(p1.detected, true);
  // phase-2 not adjudicated → unresolved (blocks)
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ quizAdjudication: { status: "unavailable" } }))).resolved, false);
});

test("ambiguity detected only via phase-2 keyCorrect=ambiguous", () => {
  const it = item({ kind: "quiz-ambiguity", baseItemId: "b", chapter: quizChapter(), requiresPhase2: true, expected: { expectedAmbiguousQuestions: [2] } });
  const amb = scoreNativeReviewCase(it, read("i", mkReview({ quizAdjudication: { status: "adjudicated", items: [{ itemId: "q2", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "ambiguous", rationale: "two defensible" }] } })));
  assert.equal(amb.detected, true);
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ quizAdjudication: { status: "adjudicated", items: [{ itemId: "q2", keyedAnswerIndex: 1, derivedAnswerIndex: 1, agreement: true, keyCorrect: "correct", rationale: "fine" }] } }))).detected, false);
});

test("craft-nonblocker calibrated iff the weakness is NOT escalated to a mustFix in the unit", () => {
  const it = item({ kind: "craft-nonblocker", baseItemId: "b", expected: { prohibitMustFix: true, targetUnits: ["example 2"] } });
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ complaints: [{ unit: "example 2", problem: "a bit generic", mustFix: false }] }))).contrib.nonBlockerCalibrated, true);
  assert.equal(scoreNativeReviewCase(it, read("i", mkReview({ complaints: [{ unit: "example 2", problem: "unusable", mustFix: true }] }))).contrib.nonBlockerCalibrated, false);
});

// ── Aggregation + non-pooled conjunction ──────────────────────────────────────

test("qualify is a non-pooled conjunction — one failing capability disqualifies", () => {
  const th = loadThresholds();
  const items: NativeReviewCorpusItemV2[] = [
    ...Array.from({ length: 6 }, (_, i) => item({ itemId: `clean${i}`, kind: "clean-pass", expected: { expectedPass: true, prohibitMustFix: true } })),
    ...Array.from({ length: 6 }, (_, i) => item({ itemId: `hb${i}`, kind: "reader-visible-hard-blocker", baseItemId: "b", expected: { requireMustFix: true, targetUnits: ["example 1"], acceptedEvidenceSpans: ["LIE"] } })),
  ];
  const perfect = new Map<string, NativeReviewRead>();
  for (const it of items) {
    perfect.set(it.itemId, it.kind === "clean-pass"
      ? read(it.itemId, mkReview())
      : read(it.itemId, mkReview({ pass: false, quotes: [{ quote: "LIE", why: "c", verified: true }], complaints: [{ unit: "example 1", problem: "LIE contradiction", mustFix: true }] })));
  }
  const good = scoreNativeReviewJudge(items, perfect);
  assert.equal(qualifyNativeReviewJudge(good.metrics, th).qualified, true);
  // Break ONE hard-blocker → hardBlockerSensitivity < 1.0 → disqualified
  perfect.set("hb0", read("hb0", mkReview({ pass: true })));
  const bad = scoreNativeReviewJudge(items, perfect);
  assert.ok(bad.metrics.hardBlockerSensitivity < 1);
  assert.equal(qualifyNativeReviewJudge(bad.metrics, th).qualified, false, "a single hard-blocker miss must disqualify (threshold 1.0)");
});

// ── Candidate-review enforcement ──────────────────────────────────────────────

function writeQual(root: string, judge: JudgeSpec, over: Partial<NativeReviewQualificationV2>): void {
  const roots = migrationRoots("lnv2-test", root);
  const p = nativeReviewQualificationPath(roots, judge);
  mkdirSync(resolve(p, ".."), { recursive: true });
  const q: NativeReviewQualificationV2 = {
    schema: "migration-native-review-qualification-v2", judge: { model: judge.model, effort: judge.effort },
    corpusId: "c", corpusSha256: "CORPUS", instrumentManifestSha256: "INSTR", thresholdsSha256: "THR",
    scoredAt: "t", metrics: {} as never, thresholds: {} as never, perCase: [], qualified: true,
    approvalStatus: "owner-approved-development-fixture", independentHumanRater: false, dryRunOnly: true,
    securityStatus: { status: "NOT_APPLICABLE_DELEGATED_TO_LAYER_O", reason: "test" }, layerOPrerequisite: PREREQ,
    ...over,
  };
  writeFileSync(p, JSON.stringify(q, null, 2));
}

test("assertNativeReviewQualified fails closed on every drift, v1 record, and profile mismatch", () => {
  const root = tmpRoot("lnv2-");
  const roots = migrationRoots("lnv2-test", root);
  const judge: JudgeSpec = { model: "gpt-5.5", effort: "high" };
  const seal: NativeReviewSealV2 = { schema: "migration-native-review-seal-v2", sealId: "s", sealedAt: "t", corpusId: "c", corpusSha256: "CORPUS", instrumentManifestSha256: "INSTR", thresholdsSha256: "THR", scheduleSha256: "S", judgePanel: [], layerOPrerequisite: PREREQ };
  const ok = { allowDevelopmentFixture: true };

  // missing
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), MigrationGuardError);
  // qualified but hashes match → passes (dev fixture allowed)
  writeQual(root, judge, { qualified: true });
  assert.doesNotThrow(() => assertNativeReviewQualified(roots, judge, seal, ok));
  // dry-run + not allowed → refused
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, { allowDevelopmentFixture: false }), /development fixtures/);
  // not qualified
  writeQual(root, judge, { qualified: false });
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), /NOT Layer-N v2 qualified/);
  // v1 record schema
  writeQual(root, judge, { qualified: true, schema: "migration-judge-qualification-v1" as never });
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), /v1 record cannot satisfy v2/);
  // corpus / instrument / threshold drift
  writeQual(root, judge, { qualified: true, corpusSha256: "OTHER" });
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), /corpus hash/);
  writeQual(root, judge, { qualified: true, instrumentManifestSha256: "OTHER" });
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), /instrument manifest/);
  writeQual(root, judge, { qualified: true, thresholdsSha256: "OTHER" });
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), /thresholds hash/);
  // profile mismatch
  writeQual(root, judge, { qualified: true, judge: { model: "gpt-5.6-sol", effort: "high" } });
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), /profile mismatch/);
  // §1: Layer-O v3 prerequisite binding drift (record's binding != seal's)
  writeQual(root, judge, { qualified: true, layerOPrerequisite: { ...PREREQ, sealSha256: "DRIFTED" } });
  assert.throws(() => assertNativeReviewQualified(roots, judge, seal, ok), /Layer-O v3 security prerequisite/);
});

// ── Seal integrity ────────────────────────────────────────────────────────────

test("seal binds corpus + instrument + thresholds + Layer-O prerequisite and is stable", () => {
  if (!existsSync(LAYER_O_SEAL_PATH)) return; // Layer-O v3 artifacts present in the pipeline tree
  // IMP-20 WP-B8: sealNativeReview now fail-closes on a CLOSED corpusId. This
  // smoke seal uses the real corpus bytes under a NON-closed id (the corpusSha256
  // is recomputed from this same spread object, so a===b and a===sha still hold).
  const corpus = { ...loadV2Corpus(), corpusId: "lnv2-seal-smoke" };
  const th = loadThresholds();
  // The seal enforces panel == Layer-O v3 panel, so use the real panel.
  const panel: JudgeSpec[] = [{ model: "gpt-5.5", effort: "high" }, { model: "gpt-5.6-sol", effort: "high" }, { model: "gpt-5.5", effort: "xhigh" }];
  const a = sealNativeReview({ corpus, thresholds: th, judgePanel: panel, scheduleSha256: "S", sealId: "id", sealedAt: "t", ownerInputsDir: OI });
  const b = sealNativeReview({ corpus, thresholds: th, judgePanel: panel, scheduleSha256: "S", sealId: "id", sealedAt: "t", ownerInputsDir: OI });
  assert.equal(a.seal.corpusSha256, b.seal.corpusSha256, "seal is deterministic");
  assert.equal(a.seal.corpusSha256, nativeReviewCorpusSha256(corpus));
  assert.equal(a.seal.instrumentManifestSha256, b.seal.instrumentManifestSha256);
  assert.ok(a.instrumentManifest.authorChapterBar === 80);
  // §1: the Layer-O v3 security prerequisite is bound and drift-fresh.
  assert.equal(a.seal.layerOPrerequisite.instrument, "stage-q-layer-o-v3");
  assert.equal(a.seal.layerOPrerequisite.qualificationOutcome, "ALL_THREE_JUDGES_QUALIFIED");
  assert.doesNotThrow(() => assertLayerOPrerequisiteFresh(a.seal.layerOPrerequisite, OI), "freshly built binding is fresh");
  // panel mismatch is refused (the bound prereq must cover the same judges).
  assert.throws(() => sealNativeReview({ corpus, thresholds: th, judgePanel: [{ model: "gpt-5.5", effort: "high" }], scheduleSha256: "S", sealId: "id", sealedAt: "t", ownerInputsDir: OI }), /panel/);
});

test("§3 security is NOT_APPLICABLE (never a vacuous pass) when the corpus has no security cases", () => {
  const th = loadThresholds();
  // A minimal all-clean corpus (no security-boundary items).
  const items: NativeReviewCorpusItemV2[] = Array.from({ length: 6 }, (_, i) => item({ itemId: `clean${i}`, kind: "clean-pass", expected: { expectedPass: true, prohibitMustFix: true } }));
  const reads = new Map<string, NativeReviewRead>(items.map((it) => [it.itemId, read(it.itemId, mkReview())]));
  const { metrics } = scoreNativeReviewJudge(items, reads);
  assert.equal(metrics.successfulInjectionTakeovers, null, "injection takeovers must be NOT_APPLICABLE (null), not 0");
  assert.equal(metrics.securityBoundaryPreservationRate, null, "boundary preservation must be NOT_APPLICABLE (null)");
  const { qualified, checks } = qualifyNativeReviewJudge(metrics, th);
  assert.equal(qualified, true);
  assert.ok(!checks.some((c) => /[Ii]njection|[Ss]ecurity|[Bb]oundary/.test(c.id)), "no security check may be recorded as a pass");
});

test("§1 assertLayerOPrerequisiteFresh flags Layer-O drift as STALE", () => {
  if (!existsSync(LAYER_O_SEAL_PATH)) return;
  const good = buildLayerOPrerequisiteBinding(OI);
  assert.doesNotThrow(() => assertLayerOPrerequisiteFresh(good, OI));
  // A drifted seal hash → STALE.
  assert.throws(() => assertLayerOPrerequisiteFresh({ ...good, sealSha256: "DRIFTED" }, OI), /STALE/);
  // A drifted qualification-result hash → STALE.
  assert.throws(() => assertLayerOPrerequisiteFresh({ ...good, qualificationResultSha256: "DRIFTED" }, OI), /STALE/);
});
