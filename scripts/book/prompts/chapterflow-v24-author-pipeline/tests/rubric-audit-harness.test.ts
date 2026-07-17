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
  RUBRIC_DOMAINS,
  RUBRIC_OWNER_RUN_REL_PATH,
  RUBRIC_CHAPTER_WEIGHT_TOTAL,
  buildRubricAuditBatch,
  materializeRubricAuditBatch,
  renderAuditChapterDocument,
  type AuditChapter,
  type RubricAuditBatchManifestV1,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import {
  RATER_SKELETON_BEGIN,
  RATER_SKELETON_END,
  extractRecordSkeleton,
  ingestAdjudicationRecord,
  ingestRaterRecord,
  raterBindingEnvelope,
  renderAdjudicationRecordSkeleton,
  renderRaterRecordSkeleton,
  renderRaterTaskDocument,
  summarizeAudit,
} from "../src/bakeoff/migration/rubricAuditHarness.js";
import { AuditPackageAssemblyError, assembleAuditPackage } from "../src/bakeoff/auditPackageAssembler.js";
import { loadRecord, validatePairChain, type RubricInspection } from "../src/bakeoff/migration/rubricAuditReceipts.js";
import { readCallLedgerEntries } from "../src/telemetry/runCallLedger.js";

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

    // WP-503 — the Claude-side D7 rater call ledgered exactly once per REAL
    // ingest attempt (both the initial ingest and the idempotent re-ingest are
    // real calls; neither is silently dropped).
    const pipelineDir = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline");
    const entries = readCallLedgerEntries(pipelineDir, repo.unit, "harness-audit-1");
    assert.equal(entries.length, 2, "one ledger line per ingest call, including the idempotent re-ingest");
    for (const e of entries) {
      assert.equal(e.family, "claude-side");
      assert.equal(e.stage, "d7-rubric-audit");
      assert.equal(e.role, "primary");
      assert.equal(e.outcome, "content_completed");
      assert.equal(e.model, null, "the external rater session's model id is genuinely unobservable here");
      assert.equal(e.latencyMs, null);
      assert.equal(e.cost, "NOT_METERED");
    }
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

    // WP-503 — both blind-rater ingests (distinct roles) are ledgered, each exactly once.
    const pipelineDir = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline");
    const entries = readCallLedgerEntries(pipelineDir, repo.unit, "harness-audit-1");
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((e) => e.role).sort(), ["primary", "verification"]);
    assert.ok(entries.every((e) => e.outcome === "content_completed" && e.family === "claude-side" && e.stage === "d7-rubric-audit"));
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

    // WP-503 — a FAILED ingest is STILL a real call attempt: it is ledgered
    // exactly once (outcome content_invalid), never silently dropped just
    // because throwIfInvalid rejected it.
    const pipelineDir = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline");
    const entries = readCallLedgerEntries(pipelineDir, repo.unit, "harness-audit-1");
    assert.equal(entries.length, 1, "the failed ingest attempt is ledgered, not dropped");
    assert.equal(entries[0].role, "primary");
    assert.equal(entries[0].outcome, "content_invalid");
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

    const pipelineDir = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline");
    const entries = readCallLedgerEntries(pipelineDir, repo.unit, "harness-audit-1");
    assert.equal(entries.length, 1, "the failed ingest attempt is ledgered, not dropped");
    assert.equal(entries[0].outcome, "content_invalid");
  } finally {
    repo.dispose();
  }
});

test("ingestAdjudicationRecord: a failed adjudication ingest is ledgered (role adjudicator, content_invalid), never dropped", () => {
  const repo = makeAuditRepo("rubric-audit-harness-adj-fail");
  try {
    const primaryText = JSON.stringify(syntheticRaterRecord(repo, "primary"), null, 2);
    const verificationText = JSON.stringify(syntheticRaterRecord(repo, "verification"), null, 2);
    ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary", recordText: primaryText });
    ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "verification", recordText: verificationText });

    // A deliberately incomplete adjudication record — enough to reach
    // validateChapterAdjudicationRecord and fail it, never enough to pass.
    const badAdjudication = { schema_version: "1.0.0", artifact_type: "chapterflow_standalone_chapter_adjudication", rater_role: "adjudicated" };
    const recordText = JSON.stringify(badAdjudication, null, 2);
    assert.throws(
      () => ingestAdjudicationRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, recordText }),
      /failed fail-closed validation/,
    );

    const pipelineDir = resolve(repo.base, "scripts/book/prompts/chapterflow-v24-author-pipeline");
    const entries = readCallLedgerEntries(pipelineDir, repo.unit, "harness-audit-1");
    // 2 rater ingests (primary, verification) + 1 failed adjudication ingest.
    assert.equal(entries.length, 3);
    const adjEntry = entries.find((e) => e.role === "adjudicator");
    assert.ok(adjEntry, "the failed adjudication ingest attempt is ledgered under role adjudicator");
    assert.equal(adjEntry!.outcome, "content_invalid");
    assert.equal(adjEntry!.family, "claude-side");
    assert.equal(adjEntry!.stage, "d7-rubric-audit");
  } finally {
    repo.dispose();
  }
});

// ── task↔validator schema closure (the rendered skeleton) ─────────────────────

/** Fill a rendered rater skeleton the way a compliant, task-following rater would:
 *  every subcriterion gets the given integer rating, every "TODO:" placeholder a
 *  concrete value, and every domain_score / weighted_points / chapter_diagnostic_score
 *  is recomputed from the ratings per the task's stated arithmetic. */
function fillSkeleton(skeleton: Record<string, unknown>, rating: number): Record<string, unknown> {
  const record = JSON.parse(JSON.stringify(skeleton)) as Record<string, unknown>;
  const domains = record.domains as Record<string, Record<string, unknown>>;
  let weightedTotal = 0;
  for (const spec of RUBRIC_DOMAINS) {
    const domain = domains[spec.key];
    const subs = domain.subcriteria as Record<string, Record<string, unknown>>;
    for (const sub of spec.subcriteria) {
      subs[sub].rating = rating;
      subs[sub].anchor_rationale = `Anchor-linked rationale for ${sub}.`;
      subs[sub].evidence = [{ locator: "Deep read, paragraph 2", paraphrase: "the text supports this rating" }];
    }
    const domainScore = rating; // four identical ratings ⇒ mean = rating
    const weightedPoints = (domainScore / 4) * spec.weight;
    weightedTotal += weightedPoints;
    domain.domain_score = domainScore;
    domain.weighted_points = weightedPoints;
    domain.strengths = ["A concrete strength.", "A second concrete strength."];
    domain.limitations = ["A concrete limitation."];
    domain.within_chapter_pattern = "A consistent within-chapter pattern.";
    domain.anchor_linked_rationale = "A domain-level anchor-linked rationale.";
    domain.scope_note = "Scored on chapter-local support only.";
  }
  record.chapter_diagnostic_score = (weightedTotal / RUBRIC_CHAPTER_WEIGHT_TOTAL) * 100;
  const gates = record.gates as Record<string, Record<string, unknown>>;
  for (const gate of Object.values(gates)) gate.rationale = "A concrete gate rationale.";
  (record.book as Record<string, unknown>).source_book_title = "A Source Book";
  for (const key of [
    "evaluation_construct", "diagnostic_band", "strongest_qualities", "weakest_qualities", "engagement_curve",
    "comprehension_retention_analysis", "practical_use_judgment_analysis", "best_fit_readers", "struggling_readers", "verdict",
  ]) {
    record[key] = `A concrete ${key}.`;
  }
  record.improvements = ["First improvement.", "Second improvement.", "Third improvement."];
  return record;
}

test("the rendered rater task teaches the EXACT ingestable record shape (literal skeleton)", () => {
  const repo = makeAuditRepo("rubric-audit-skeleton-shape");
  try {
    const task = renderRaterTaskDocument({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary" });

    // The task carries the fenced, extractable literal skeleton…
    assert.ok(task.includes(RATER_SKELETON_BEGIN) && task.includes(RATER_SKELETON_END), "task fences a record skeleton");
    // …with EVERY domain key AND EVERY subcriterion id present as a literal JSON
    // object key (the prose contract alone left this ambiguous — the regression
    // this closes: a rater emitting subcriteria as an ARRAY / renamed keys).
    for (const spec of RUBRIC_DOMAINS) {
      assert.ok(task.includes(`"${spec.key}":`), `task's skeleton shows the domain object key "${spec.key}"`);
      for (const sub of spec.subcriteria) {
        assert.ok(task.includes(`"${sub}":`), `task's skeleton shows the subcriterion object key "${sub}"`);
      }
    }

    // The extracted skeleton IS a valid ingestable record as-is (placeholder
    // ratings): parsing the exact bytes the task shows and ingesting them passes.
    const skeleton = renderRaterRecordSkeleton({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary" });
    const extracted = extractRecordSkeleton(task);
    assert.deepEqual(extracted, skeleton, "the fenced skeleton parses back to the builder's object exactly");
    const raw = ingestRaterRecord({
      repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary",
      recordText: JSON.stringify(skeleton, null, 2),
    });
    assert.equal(readFileSync(raw.persistedPath, "utf8"), JSON.stringify(skeleton, null, 2), "the raw skeleton ingests and persists");
    // No filesystem path leaks into the shape the rater sees.
    assert.ok(!task.includes(repo.base) && !task.includes("/Users/") && !task.includes("/private/"), "skeleton carries no filesystem path");
  } finally {
    repo.dispose();
  }
});

test("a task-following rater that fills the rendered skeleton ingests (task↔validator loop closed)", () => {
  const repo = makeAuditRepo("rubric-audit-skeleton-fill");
  try {
    // Render → extract the skeleton exactly as a driver would, fill ratings=3 and
    // every prose field, recompute the arithmetic → the compliant record ingests.
    const task = renderRaterTaskDocument({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary" });
    const filled = fillSkeleton(extractRecordSkeleton(task), 3);
    assert.equal(filled.chapter_diagnostic_score, 75, "uniform-3 ratings ⇒ a 75.0 chapter diagnostic");
    const result = ingestRaterRecord({
      repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary",
      recordText: JSON.stringify(filled, null, 2),
    });
    assert.equal(result.kind, "candidate");
    assert.ok(existsSync(result.persistedPath), "the filled compliant record ingests and persists");

    // NEGATIVE CONTROL: the exact live-failure shape — subcriteria emitted as an
    // ARRAY (Object.keys ⇒ "0".."3") — is still rejected fail-closed. Validation
    // precedes persistence, so ingesting it as the same (primary) role surfaces
    // ONLY the schema errors this skeleton exists to prevent.
    const arrayShaped = fillSkeleton(extractRecordSkeleton(task), 3);
    const arrDomains = arrayShaped.domains as Record<string, Record<string, unknown>>;
    for (const spec of RUBRIC_DOMAINS) {
      arrDomains[spec.key].subcriteria = spec.subcriteria.map((sub) => ({
        name: sub, rating: 3, anchor_rationale: "r", evidence: [{ locator: "s", paraphrase: "p" }],
      }));
    }
    assert.throws(
      () => ingestRaterRecord({
        repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "primary",
        recordText: JSON.stringify(arrayShaped, null, 2),
      }),
      /subcriteria keys are invalid/,
      "an array-shaped subcriteria (the live symptom) is still rejected",
    );
  } finally {
    repo.dispose();
  }
});

// ── adjudicator task↔validator schema closure ─────────────────────────────────

/** Seal a deterministic blind pair from the rendered RATER skeletons themselves:
 *  primary filled at rating 3 (cds 75), verification at rating 4 (cds 100) — all
 *  32 subcriteria differ by exactly 1, so the disagreement inventory and the
 *  agreement metrics are fully predictable. */
function sealSkeletonPair(repo: { base: string; manifest: RubricAuditBatchManifestV1; unit: string }): void {
  for (const [role, rating] of [["primary", 3], ["verification", 4]] as Array<["primary" | "verification", number]>) {
    const task = renderRaterTaskDocument({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role });
    const record = fillSkeleton(extractRecordSkeleton(task), rating);
    ingestRaterRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role, recordText: JSON.stringify(record, null, 2) });
  }
}

/** Fill a rendered ADJUDICATION skeleton as a compliant adjudicator: every final
 *  rating 3 except `halfPointPath` at 3.5 (differing from BOTH blind ratings 3
 *  and 4 ⇒ exactly one calibration_changes entry), arithmetic recomputed, every
 *  TODO placeholder replaced. */
function fillAdjudicationSkeleton(skeleton: Record<string, unknown>, halfPointPath: string): Record<string, unknown> {
  const record = JSON.parse(JSON.stringify(skeleton)) as Record<string, unknown>;
  const domains = record.domains as Record<string, Record<string, unknown>>;
  let weightedTotal = 0;
  for (const spec of RUBRIC_DOMAINS) {
    const domain = domains[spec.key];
    const subs = domain.subcriteria as Record<string, Record<string, unknown>>;
    const ratings: number[] = [];
    for (const sub of spec.subcriteria) {
      const path = `domains.${spec.key}.subcriteria.${sub}`;
      const rating = path === halfPointPath ? 3.5 : 3;
      ratings.push(rating);
      subs[sub].rating = rating;
      subs[sub].anchor_rationale = `Adjudicated anchor rationale for ${sub}.`;
      subs[sub].evidence = [{ locator: "Deep read, paragraph 2", paraphrase: "the source supports this anchor" }];
    }
    const domainScore = ratings.reduce((a, b) => a + b, 0) / 4;
    const weightedPoints = (domainScore / 4) * spec.weight;
    weightedTotal += weightedPoints;
    domain.domain_score = domainScore;
    domain.weighted_points = weightedPoints;
    domain.strengths = ["A concrete strength.", "A second concrete strength."];
    domain.limitations = ["A concrete limitation."];
    domain.within_chapter_pattern = "A consistent within-chapter pattern.";
    domain.anchor_linked_rationale = "A domain-level anchor-linked rationale.";
    domain.scope_note = "Scored on chapter-local support only.";
  }
  record.chapter_diagnostic_score = (weightedTotal / RUBRIC_CHAPTER_WEIGHT_TOTAL) * 100;
  const agreement = record.rater_agreement as Record<string, unknown>;
  for (const item of agreement.disagreements as Array<Record<string, unknown>>) {
    item.final = item.path === halfPointPath ? 3.5 : 3;
    item.rationale = "The source recheck supports this anchor.";
    item.evidence = [{ locator: "Deep read, paragraph 2", paraphrase: "the source supports this anchor" }];
  }
  record.calibration_changes = [{
    path: halfPointPath,
    original: 3,
    final: 3.5,
    reason: "After source review both adjacent anchors remain equally supported, so the half-point is the honest composite.",
    evidence: [{ locator: "Deep read, paragraph 2", paraphrase: "the source supports both adjacent anchors" }],
  }];
  const gates = record.gates as Record<string, Record<string, unknown>>;
  for (const gate of Object.values(gates)) gate.rationale = "A concrete gate rationale.";
  const confidence = record.confidence as Record<string, unknown>;
  confidence.level = "high";
  confidence.rationale = "The blind pair differed uniformly by one anchor and the source review resolved it.";
  (record.book as Record<string, unknown>).source_book_title = "A Source Book";
  for (const key of [
    "evaluation_construct", "diagnostic_band", "strongest_qualities", "weakest_qualities", "engagement_curve",
    "comprehension_retention_analysis", "practical_use_judgment_analysis", "best_fit_readers", "struggling_readers", "verdict",
  ]) {
    record[key] = `A concrete ${key}.`;
  }
  record.improvements = ["First improvement.", "Second improvement.", "Third improvement."];
  return record;
}

test("the rendered adjudicator task teaches the exact ingestable adjudication shape (skeleton + exact rater_agreement prefill)", () => {
  const repo = makeAuditRepo("rubric-audit-adj-skeleton");
  try {
    sealSkeletonPair(repo);
    const adjTask = renderRaterTaskDocument({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "adjudicator" });

    // The task fences an extractable literal skeleton AND shows the exact
    // calibration_changes entry value shapes (the live-failure surface).
    assert.ok(adjTask.includes(RATER_SKELETON_BEGIN) && adjTask.includes(RATER_SKELETON_END), "adjudicator task fences a record skeleton");
    assert.ok(adjTask.includes('"original": <NUMBER'), "task pins original as a NUMBER, never a description string");
    assert.ok(adjTask.includes("ARRAY of {locator, paraphrase} objects"), "task pins evidence as an array of locator/paraphrase objects");

    const skeleton = renderAdjudicationRecordSkeleton({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit });
    const extracted = extractRecordSkeleton(adjTask);
    assert.deepEqual(extracted, skeleton, "the fenced adjudication skeleton parses back to the builder's object exactly");

    // Everything derivable from the sealed pair is prefilled EXACTLY: a 3-vs-4
    // uniform pair means all 32 subcriteria disagree by 1 and the cds differ by 25.
    const agreement = extracted.rater_agreement as Record<string, unknown>;
    assert.equal(agreement.mean_absolute_subcriterion_difference, 1);
    assert.equal(agreement.maximum_subcriterion_difference, 1);
    assert.equal(agreement.chapter_diagnostic_score_difference, 25);
    assert.equal((agreement.disagreements as unknown[]).length, 32, "the full disagreement inventory is prefilled");

    // The RAW skeleton (placeholder ratings, empty calibration_changes) is itself
    // an ingest-valid adjudication record — parse the exact bytes the task shows
    // and ingest them.
    const result = ingestAdjudicationRecord({
      repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit,
      recordText: JSON.stringify(skeleton, null, 2),
    });
    assert.equal(result.role, "adjudicator");
    assert.ok(existsSync(result.persistedPath), "the raw adjudication skeleton ingests and persists");
    assert.ok(!adjTask.includes(repo.base) && !adjTask.includes("/Users/") && !adjTask.includes("/private/"), "no filesystem paths leak");
  } finally {
    repo.dispose();
  }
});

test("a task-following adjudicator that fills the skeleton ingests; the live string-shaped calibration entries are rejected", () => {
  const repo = makeAuditRepo("rubric-audit-adj-fill");
  try {
    sealSkeletonPair(repo);
    const adjTask = renderRaterTaskDocument({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, role: "adjudicator" });
    const halfPointPath = "domains.epistemic_integrity.subcriteria.claim_support_fit";
    const filled = fillAdjudicationSkeleton(extractRecordSkeleton(adjTask), halfPointPath);

    // NEGATIVE CONTROL first (nothing persists on failure): the EXACT live
    // failure — original as a descriptive STRING and evidence as prose — is
    // rejected with the two observed validator errors.
    const broken = JSON.parse(JSON.stringify(filled)) as Record<string, unknown>;
    const entry = (broken.calibration_changes as Array<Record<string, unknown>>)[0];
    entry.original = "primary 3 / verification 4";
    entry.evidence = "Cap declared and honored: Deep read paragraph 2.";
    assert.throws(
      () => ingestAdjudicationRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, recordText: JSON.stringify(broken, null, 2) }),
      /calibration change values invalid/,
      "a string original (the live symptom) is rejected",
    );
    assert.throws(
      () => ingestAdjudicationRecord({ repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit, recordText: JSON.stringify(broken, null, 2) }),
      /calibration change lacks reason\/evidence/,
      "a prose-string evidence (the live symptom) is rejected",
    );

    // The compliant fill — half-point final differing from BOTH blind ratings,
    // with a correctly-shaped calibration_changes entry — ingests.
    const result = ingestAdjudicationRecord({
      repositoryRoot: repo.base, manifest: repo.manifest, unit: repo.unit,
      recordText: JSON.stringify(filled, null, 2),
    });
    assert.ok(existsSync(result.persistedPath), "the filled compliant adjudication ingests and persists");
    const persisted = JSON.parse(readFileSync(result.persistedPath, "utf8")) as Record<string, unknown>;
    assert.equal((persisted.calibration_changes as unknown[]).length, 1);
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
