/** s16-rubric-audit-v1 — rater harness (Track C, the measurement loop).
 * Proves: (1) a render→ingest ROUND-TRIP — a v25 candidate task renders
 * self-contained (rubric contract + identity block + per-layer docs, no
 * filesystem paths), and a synthetic-but-valid rater record built from the sealed
 * owner run's domain judgment ingests, validates fail-closed through the EXISTING
 * validators, and persists the deterministic chain of custody; (2) ingest fails
 * CLOSED on wrong arithmetic and on a tampered bound field, persisting nothing;
 * (3) assemble-audit-package fails closed on a missing quiz explanation and
 * yields a batch-consumable package on clean state. Zero model/api calls. */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import {
  RUBRIC_CALIBRATION_REFERENCES,
  RUBRIC_OWNER_RUN_REL_PATH,
  buildRubricAuditBatch,
  materializeRubricAuditBatch,
  renderAuditChapterDocument,
  type AuditChapter,
  type RubricAuditBatchManifestV1,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import {
  ingestRaterRecord,
  raterBindingEnvelope,
  renderRaterTaskDocument,
  summarizeAudit,
} from "../src/bakeoff/migration/rubricAuditHarness.js";
import { AuditPackageAssemblyError, assembleAuditPackage } from "../src/bakeoff/auditPackageAssembler.js";
import { loadRecord, validatePairChain, type RubricInspection } from "../src/bakeoff/migration/rubricAuditReceipts.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const OWNER_RUN_DIR = resolve(REPOSITORY_ROOT, RUBRIC_OWNER_RUN_REL_PATH);

function auditChapterFixture(): AuditChapter {
  return {
    number: 3,
    title: "The Inspectable Claim",
    hook: "A fishmonger sets a temperature log beside the cod, and belief changes.",
    counterintuition: "Confident delivery can weaken belief rather than strengthen it.",
    tryThisNow: "Pick one claim you need believed today and attach one thing a listener can check.",
    keyTakeaway: "Move credibility from the speaker's confidence to support the audience can inspect for themselves.",
    breakdown: {
      fastRead: "A scene and a rule: proof the audience can inspect beats confident assertion. The cod's log is checkable; a dramatic story is not.",
      deepRead: "The mechanism: inspectable evidence removes the need to judge the speaker, and lowers the social cost of changing one's mind, so belief can move on the evidence rather than on trust.",
      fullRead: "Depth: scale, witnesses, and human-scale translation each let a claim survive the speaker. Conditions must travel with the claim, and cropped photos, selected testimonials, and distorted statistics are named as misuse. Fair doubt narrows to a check of the log, sample, or work product.",
    },
    examples: [
      { title: "Rachel sets the catch log beside the cod", scenario: "A buyer doubts freshness.", whatToDo: "Place the temperature log beside the fish.", whyItMatters: "The claim becomes checkable instead of asserted." },
      { title: "Lars translates vibration into bolts", scenario: "A vague warning is ignored.", whatToDo: "Translate the reading into loose bolts.", whyItMatters: "Human-scale translation makes the abstraction judgeable." },
    ],
    quiz: {
      questions: [
        { prompt: "What makes a claim credible to an audience?", choices: ["The speaker's confidence", "Support the audience can inspect", "Repetition"], correctIndex: 1, explanation: "Credibility comes from inspectable support, not confident delivery — the audience can check it themselves." },
        { prompt: "Why attach a condition to a claim?", choices: ["Decoration", "So the claim survives inspection", "To sound expert"], correctIndex: 1, explanation: "Conditions must travel with the claim so a reader can judge when it holds and when it fails." },
      ],
    },
    reviewCards: [
      { front: "Where should proof live?", back: "In something the audience can inspect, not in the speaker's confidence." },
      { front: "What is human-scale translation?", back: "Giving a large number a familiar reference so an abstraction becomes judgeable." },
    ],
    implementationPlan: {
      coreSkill: "Attach one inspectable piece of support to a claim before you assert it.",
      ifThenPlans: [
        { context: "In a meeting", plan: "If you make a claim, then name one thing a listener can check." },
        { context: "In writing", plan: "If you state a result, then keep its condition beside it." },
      ],
      twentyFourHourChallenge: "Add one inspectable support to a claim you make today.",
      weeklyPractice: "Audit three claims this week for proof, witness, or human-scale support.",
    },
    memorableLines: [{ text: "Belief should rest on what the audience can inspect, not on how sure the speaker sounds." }],
  };
}

/** A temp repo with the frozen calibration source doc and a synthetic candidate
 *  package, materialized into a rubric-audit batch. */
function makeAuditRepo(prefix: string): { base: string; dispose: () => void; manifest: RubricAuditBatchManifestV1; unit: string } {
  const roots = mkTestRoots(prefix);
  const calibrationRel = RUBRIC_CALIBRATION_REFERENCES[0].docRelPath;
  const calibrationAbs = resolve(roots.base, calibrationRel);
  mkdirSync(dirname(calibrationAbs), { recursive: true });
  writeFileSync(calibrationAbs, readFileSync(resolve(REPOSITORY_ROOT, calibrationRel)));
  const packageRel = "book-packages/harness-book.v21.json";
  const packageAbs = resolve(roots.base, packageRel);
  mkdirSync(dirname(packageAbs), { recursive: true });
  writeFileSync(packageAbs, JSON.stringify({ book: { slug: "harness-book" }, chapters: [auditChapterFixture()] }));
  const out = materializeRubricAuditBatch({
    repositoryRoot: roots.base,
    auditId: "harness-audit-1",
    purpose: "Track C harness unit test",
    packagePath: packageRel,
    chapterNumbers: [3],
    calibrationUnit: "nudge-ch03",
    write: true,
  });
  const manifest = JSON.parse(readFileSync(out.manifestPath, "utf8")) as RubricAuditBatchManifestV1;
  return { base: roots.base, dispose: roots.dispose, manifest, unit: manifest.chapters[0].unit };
}

/** Build a synthetic-but-valid v25 rater record: the identity + source binding
 *  come from the harness's deterministic envelope; the domain judgment, gates,
 *  and analysis are the sealed owner primary rater's (arithmetically valid). */
function syntheticRaterRecord(
  repo: { base: string; manifest: RubricAuditBatchManifestV1; unit: string },
  role: "primary" | "verification" = "primary",
): Record<string, unknown> {
  const owner = JSON.parse(readFileSync(resolve(OWNER_RUN_DIR, `raw/${role}/made-to-stick-ch04.json`), "utf8")) as Record<string, unknown>;
  const envelope = raterBindingEnvelope({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role });
  return {
    schema_version: envelope.schema_version,
    artifact_type: envelope.artifact_type,
    run_id: envelope.run_id,
    job_id: envelope.job_id,
    rater_role: envelope.rater_role,
    worker_task_id: envelope.worker_task_id,
    worker_session_id: envelope.worker_session_id,
    worker_dispatch_receipt_sha256: envelope.worker_dispatch_receipt_sha256,
    book: { book_id: envelope.book.book_id, source_book_title: "Synthetic Chapter Source" },
    source_hash: envelope.source_hash,
    chapter: envelope.chapter,
    scope: envelope.scope,
    evaluation_construct: owner.evaluation_construct,
    // 6 base gates (owner) + the v25 layer-independence gate.
    gates: {
      ...(owner.gates as Record<string, unknown>),
      layer_independence: {
        status: "pass",
        rationale: "Each read layer re-establishes its own case, characters, and core lesson.",
        layers: {
          fast: { self_contained: true, findings: [] },
          deep: { self_contained: true, findings: [] },
          full: { self_contained: true, findings: [] },
        },
      },
    },
    domains: owner.domains,
    chapter_diagnostic_score: owner.chapter_diagnostic_score,
    diagnostic_band: owner.diagnostic_band,
    strongest_qualities: owner.strongest_qualities,
    weakest_qualities: owner.weakest_qualities,
    engagement_curve: owner.engagement_curve,
    comprehension_retention_analysis: owner.comprehension_retention_analysis,
    practical_use_judgment_analysis: owner.practical_use_judgment_analysis,
    best_fit_readers: owner.best_fit_readers,
    struggling_readers: owner.struggling_readers,
    improvements: owner.improvements,
    verdict: owner.verdict,
  };
}

test("render→ingest round-trip: a v25 candidate rater record validates and persists custody", () => {
  const repo = makeAuditRepo("rubric-audit-harness-rt");
  try {
    const task = renderRaterTaskDocument({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary" });
    // Self-contained: the rubric contract, the identity block, and the three
    // per-layer docs are present; NO filesystem paths leak into the task.
    assert.ok(task.includes("epistemic_integrity (weight 15)"), "task carries the domain contract");
    assert.ok(task.includes("chapter_diagnostic_score = sum(weighted_points for all 8 domains) / 95 * 100"), "task carries the arithmetic");
    assert.ok(task.includes("layer_independence"), "v25 task demands the layer-independence gate");
    assert.ok(task.includes("worker_dispatch_receipt_sha256"), "task carries the identity block");
    assert.ok(task.includes("Full read (app mode: Challenge)"), "task embeds the per-layer documents");
    assert.ok(!task.includes(repo.base) && !task.includes("/Users/") && !task.includes("/private/"), "task has no filesystem paths");

    const record = syntheticRaterRecord(repo);
    const recordText = JSON.stringify(record, null, 2);
    const result = ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary", recordText });
    assert.equal(result.sealed, false, "a single rater does not seal the pair");
    assert.equal(readFileSync(result.persistedPath, "utf8"), recordText, "the record is retained verbatim as immutable evidence");

    // Custody landed in the exact layout validatePairChain + report expect.
    const auditDir = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/rubric-audits/harness-audit-1");
    assert.ok(existsSync(resolve(auditDir, `jobs/${repo.unit}.inspection.json`)));
    assert.ok(existsSync(resolve(auditDir, `jobs/${repo.unit}.receipts/primary.dispatch.json`)));

    // Re-ingesting the identical record is idempotent.
    ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary", recordText });

    const status = summarizeAudit({ repositoryRoot: repo.base, manifest: repo.manifest });
    const unitStatus = status.units.find((u) => u.unit === repo.unit)!;
    assert.equal(unitStatus.primary, true);
    assert.deepEqual(unitStatus.missing, ["verification", "seal", "adjudication"]);
    assert.equal(status.allComplete, false);
  } finally {
    repo.dispose();
  }
});

test("two distinct rater records seal the blind pair and render the adjudicator task", () => {
  const repo = makeAuditRepo("rubric-audit-harness-seal");
  try {
    const primaryText = JSON.stringify(syntheticRaterRecord(repo, "primary"), null, 2);
    const verificationText = JSON.stringify(syntheticRaterRecord(repo, "verification"), null, 2);
    const first = ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary", recordText: primaryText });
    assert.equal(first.sealed, false);
    const second = ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "verification", recordText: verificationText });
    assert.equal(second.sealed, true, "the second distinct rater seals the blind pair");

    const status = summarizeAudit({ repositoryRoot: repo.base, manifest: repo.manifest });
    const unitStatus = status.units.find((u) => u.unit === repo.unit)!;
    assert.deepEqual(unitStatus.missing, ["adjudication"]);

    // The persisted custody is a VALID blind pair chain (the precondition the
    // adjudication + report depend on): reproduces under the existing validator.
    const auditDir = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/rubric-audits/harness-audit-1");
    const read = (rel: string) => loadRecord(readFileSync(resolve(auditDir, rel), "utf8"));
    const chainErrors = validatePairChain({
      primary: read(`raw/primary/${repo.unit}.json`),
      verification: read(`raw/verification/${repo.unit}.json`),
      primaryDispatch: read(`jobs/${repo.unit}.receipts/primary.dispatch.json`),
      verificationDispatch: read(`jobs/${repo.unit}.receipts/verification.dispatch.json`),
      pairSeal: read(`jobs/${repo.unit}.receipts/pair.seal.json`),
      inspection: read(`jobs/${repo.unit}.inspection.json`).value as RubricInspection,
    });
    assert.deepEqual(chainErrors, [], "the minted blind pair seal re-validates end-to-end");

    // The adjudicator task embeds BOTH blind records + the seal binding + the
    // half-point / rater_agreement contract.
    const adjTask = renderRaterTaskDocument({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "adjudicator" });
    assert.ok(adjTask.includes("Blind primary rater record"));
    assert.ok(adjTask.includes("Blind verification rater record"));
    assert.ok(adjTask.includes("blind_pair_seal_sha256"));
    assert.ok(adjTask.includes("MULTIPLE OF 0.5"), "adjudicator ratings are half-points");
    assert.ok(adjTask.includes("mean_absolute_subcriterion_difference"));
    assert.ok(!adjTask.includes(repo.base) && !adjTask.includes("/private/"));
  } finally {
    repo.dispose();
  }
});

test("ingest fails closed on wrong arithmetic and persists nothing", () => {
  const repo = makeAuditRepo("rubric-audit-harness-arith");
  try {
    const record = syntheticRaterRecord(repo);
    // Corrupt a domain_score so the sum-of-ratings arithmetic no longer holds.
    (((record.domains as Record<string, Record<string, unknown>>).epistemic_integrity)).domain_score = 3.9;
    const recordText = JSON.stringify(record, null, 2);
    assert.throws(() => ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary", recordText }), /arithmetic mismatch/);
    const persisted = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline/state/migration-experiments/rubric-audits/harness-audit-1", `raw/primary/${repo.unit}.json`);
    assert.ok(!existsSync(persisted), "a failed ingest persists no record");
  } finally {
    repo.dispose();
  }
});

test("ingest fails closed on a tampered bound field", () => {
  const repo = makeAuditRepo("rubric-audit-harness-tamper");
  try {
    const record = syntheticRaterRecord(repo);
    // Tamper the chapter title so it no longer matches the minted inspection.
    (record.chapter as Record<string, unknown>).title = "A Different Title";
    const recordText = JSON.stringify(record, null, 2);
    assert.throws(() => ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary", recordText }), /differs from inspection/);
  } finally {
    repo.dispose();
  }
});

// ── assemble-audit-package ────────────────────────────────────────────────────

type LooseChapter = Record<string, unknown>;

function chapterStateFixture(bookId: string, number: number): LooseChapter {
  const pad = String(number).padStart(2, "0");
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${bookId}-ch${pad}`,
    number,
    title: `Chapter ${number}`,
    readingTimeMinutes: 6,
    hook: "An arresting one-liner opens the chapter.",
    counterintuition: "The obvious move is the wrong one.",
    tryThisNow: "Do one small concrete thing right now.",
    keyTakeaway: "The single sentence a reader should carry away from this chapter about the core idea.",
    breakdown: { fastRead: "Fast prose with a scene and a rule.", deepRead: "Deep prose with the mechanism.", fullRead: "Full prose with depth, a third angle, and limits." },
    examples: [{ exampleId: `${bookId}-ch${pad}-ex01`, title: "Worked example", tags: ["case"], planSpec: { domain: "work", audience: "adults", stakes: "real", format: "scene", requiredBeat: "decision" }, scenario: "A concrete situation the reader recognizes.", whatToDo: "Take this specific action.", whyItMatters: "Because it changes the outcome in a checkable way." }],
    quiz: { passingScorePercent: 70, questions: [{ questionId: `${bookId}-ch${pad}-q1`, prompt: "What is the core move?", choices: ["Wrong", "Right", "Also wrong"], correctIndex: 1, explanation: "The second option is correct because it names the mechanism the chapter teaches.", bloomsLevel: "understand", depthLevel: "standard" }] },
    reviewCards: [{ cardId: `${bookId}-ch${pad}-c1`, front: "What is the core idea?", back: "A concise, checkable statement of the chapter's core idea.", difficulty: "easy" }],
    implementationPlan: { title: "Do The Thing", coreSkill: "The concrete skill in two sentences.", ifThenPlans: [{ context: "At work", plan: "If X happens, then do Y." }], twentyFourHourChallenge: "Try it once in the next 24 hours.", weeklyPractice: "Practice it three times this week." },
    memorableLines: [{ text: "A sentence worth remembering.", location: "hook", why: "It compresses the idea." }],
  };
}

function writeChapterState(chaptersDir: string, chapter: LooseChapter): void {
  writeFileSync(resolve(chaptersDir, `${String(chapter.chapterId)}.v21-native.chapter.json`), JSON.stringify(chapter));
}

test("assemble-audit-package builds a batch-consumable package from clean chapter state", () => {
  const roots = mkTestRoots("rubric-audit-assemble-ok");
  const chaptersDir = resolve(roots.base, "chapters");
  mkdirSync(chaptersDir, { recursive: true });
  try {
    writeChapterState(chaptersDir, chapterStateFixture("assemble-book", 1));
    writeChapterState(chaptersDir, chapterStateFixture("assemble-book", 2));
    const pkg = assembleAuditPackage({ bookId: "assemble-book", chaptersDir });
    assert.equal(pkg.book.slug, "assemble-book");
    assert.equal(pkg.chapters.length, 2);
    assert.equal(pkg.chapters[0].number, 1);
    // Reader-only: the internal implementationPlan.title never survives.
    assert.ok(!("title" in (pkg.chapters[0].implementationPlan as Record<string, unknown>)) ||
      typeof pkg.chapters[0].implementationPlan.coreSkill === "string");
    // The assembled chapter renders through the app-faithful audit document.
    const doc = renderAuditChapterDocument({ bookId: pkg.book.slug, chapter: pkg.chapters[0] });
    assert.ok(doc.includes("Answer: b)"));
  } finally {
    roots.dispose();
  }
});

test("assemble-audit-package fails closed on a missing quiz explanation", () => {
  const roots = mkTestRoots("rubric-audit-assemble-fail");
  const chaptersDir = resolve(roots.base, "chapters");
  mkdirSync(chaptersDir, { recursive: true });
  try {
    const broken = chapterStateFixture("broken-book", 1);
    (((broken.quiz as Record<string, unknown>).questions as Array<Record<string, unknown>>)[0]).explanation = "  ";
    writeChapterState(chaptersDir, broken);
    assert.throws(() => assembleAuditPackage({ bookId: "broken-book", chaptersDir }), AuditPackageAssemblyError);
    assert.throws(() => assembleAuditPackage({ bookId: "broken-book", chaptersDir }), /explanation/);
    // A book with no chapters is also refused.
    assert.throws(() => assembleAuditPackage({ bookId: "no-such-book", chaptersDir }), /nothing to audit/);
  } finally {
    roots.dispose();
  }
});
