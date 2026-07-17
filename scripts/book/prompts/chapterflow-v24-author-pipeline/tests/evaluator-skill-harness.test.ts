/**
 * WP-E12 — typed subprocess harness for the ChapterFlow Book Evaluator skill's
 * scripts. Drives the REAL, read-only skill scripts under
 * `.agents/skills/chapterflow-book-evaluator/scripts/` (never mocked — they
 * are offline and deterministic) over packages built by the WP-E11 builder.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test, xenv } from "./harness.js";
import {
  assertPython3Available,
  EvaluatorSkillHarnessError,
  inspectPackage,
  issueWorkerReceipts,
  sealBlindPairReceipt,
  validateBookResult,
} from "../src/evaluation/evaluatorSkillHarness.js";
import { buildChapterDiagnosticPackage, type ChapterDiagnosticPackageInput } from "../src/evaluation/chapterDiagnosticPackage.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";

const TMP = mkdtempSync(join(tmpdir(), "evaluator-skill-harness-"));

function canRunPython3(): boolean {
  try {
    assertPython3Available();
    return true;
  } catch {
    return false;
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function fixtureChapter(): ChapterV21 {
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: "nudge-ch03",
    number: 3,
    title: "Fixture Harness Chapter",
    readingTimeMinutes: 8,
    hook: "A short arresting hook line about a fixture decision moment.",
    keyTakeaway: "Fixture chapters give the harness deterministic, non-identifying test content.",
    breakdown: {
      fastRead: "Fixture fast read paragraph with enough words to look like real prose content for testing.",
      deepRead: "Fixture deep read paragraph explaining the fixture mechanism in a bit more depth.",
      fullRead: "Fixture full read paragraph going into the fixture mechanism, its limits, and a second case.",
    },
    examples: [
      {
        exampleId: "ex01",
        title: "Fixture Example One",
        tags: ["fixture"],
        planSpec: { domain: "fixture", audience: "fixture reader", stakes: "fixture stakes", format: "fixture format", requiredBeat: "fixture beat" },
        scenario: "Fixture scenario text describing a concrete situation for testing with enough detail to look real.",
        whatToDo: "Fixture what-to-do guidance sentence for the reader to act on in this scenario right now.",
        whyItMatters: "Fixture why-it-matters sentence explaining the stakes of the fixture scenario for the reader.",
      },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        {
          questionId: "q01",
          prompt: "Which fixture answer is correct for this test question about the fixture concept?",
          choices: ["Fixture wrong answer one", "Fixture correct answer", "Fixture wrong answer two"],
          correctIndex: 1,
          explanation: "Fixture explanation describing why the correct choice is correct for this test question.",
          bloomsLevel: "understand",
          depthLevel: "standard",
        },
      ],
    },
    reviewCards: [
      { cardId: "c01", front: "Fixture card front question text?", back: "Fixture card back answer text explaining the concept.", difficulty: "medium" },
    ],
    implementationPlan: {
      title: "Fixture Skill Name",
      coreSkill: "Fixture core skill description spanning a couple of sentences for test realism.",
      ifThenPlans: [{ context: "A fixture triggering situation arises.", plan: "If the fixture context happens, then take the fixture action." }],
      twentyFourHourChallenge: "Within 24 hours, perform the fixture challenge action once and note the result.",
      weeklyPractice: "For one week, repeat the fixture practice daily and record what changes.",
    },
    memorableLines: [{ text: "Fixture lines fix nothing but they are enough to test the strip.", location: "breakdown.deepRead", why: "Fixture rationale." }],
  };
}

function fixturePackageInput(overrides: Partial<ChapterDiagnosticPackageInput> = {}): ChapterDiagnosticPackageInput {
  return {
    runHash: "e12fixture",
    blockCode: "nudge-ch03",
    slot: "A",
    chapter: fixtureChapter(),
    book: { title: "Nudge", categories: ["Behavioral Economics"], tags: ["choice-architecture"] },
    ...overrides,
  };
}

function writeFixturePackage(dir: string): { path: string; blindBookId: string; chapterId: string; title: string } {
  const built = buildChapterDiagnosticPackage(fixturePackageInput());
  const path = join(dir, "package.json");
  writeFileSync(path, built.bytes);
  return { path, blindBookId: built.blindBookId, chapterId: built.package.chapters[0].chapterId, title: built.package.chapters[0].title };
}

/** Drives the full real dispatch → two blind results → seal chain once, so
 *  more than one test can exercise `validateBookResult`'s full-content BLIND
 *  path (which requires a worker dispatch receipt AND a sealed pair — see
 *  `validate_book_result.py`'s `not adjudicated and require_full_content`
 *  branch) without re-deriving the plumbing each time. */
function buildAndSealPair(dir: string, runId: string, ratings: { primary: number; verification: number }) {
  const fixture = writeFixturePackage(dir);
  const receipts = issueWorkerReceipts(
    {
      package: fixture.path,
      tempRoot: join(dir, "inspect-tmp"),
      runId,
      bookId: fixture.blindBookId,
      pairId: `pair-${runId}`,
      primaryJobId: "job-primary",
      primaryTaskId: "task-primary",
      primarySessionId: "session-primary",
      verificationJobId: "job-verification",
      verificationTaskId: "task-verification",
      verificationSessionId: "session-verification",
      outputDir: join(dir, "receipts"),
    },
  );
  if (receipts.process.exitCode !== 0) {
    throw new Error(`issueWorkerReceipts fixture setup failed: ${receipts.process.stderr}`);
  }
  const primaryResult = buildFixtureRaterResult({
    runId,
    jobId: "job-primary",
    bookId: fixture.blindBookId,
    sourceHash: receipts.primaryDispatch!.source_hash,
    workerDispatchReceiptSha256: receipts.hashes!.primary_sha256,
    raterRole: "primary",
    chapterId: fixture.chapterId,
    chapterTitle: fixture.title,
    rating: ratings.primary,
  });
  const verificationResult = buildFixtureRaterResult({
    runId,
    jobId: "job-verification",
    bookId: fixture.blindBookId,
    sourceHash: receipts.verificationDispatch!.source_hash,
    workerDispatchReceiptSha256: receipts.hashes!.verification_sha256,
    raterRole: "verification",
    chapterId: fixture.chapterId,
    chapterTitle: fixture.title,
    rating: ratings.verification,
  });
  const primaryPath = join(dir, "primary.result.json");
  const verificationPath = join(dir, "verification.result.json");
  writeFileSync(primaryPath, JSON.stringify(primaryResult));
  writeFileSync(verificationPath, JSON.stringify(verificationResult));

  const sealPath = join(dir, "pair.seal.json");
  const seal = sealBlindPairReceipt({
    package: fixture.path,
    tempRoot: join(dir, "inspect-tmp"),
    primary: primaryPath,
    verification: verificationPath,
    primaryDispatch: receipts.primaryDispatchPath,
    verificationDispatch: receipts.verificationDispatchPath,
    output: sealPath,
  });
  if (seal.process.exitCode !== 0) {
    throw new Error(`sealBlindPairReceipt fixture setup failed: ${seal.process.stderr}`);
  }
  return { fixture, receipts, primaryPath, verificationPath, sealPath, seal };
}

// The 9 rubric domains × 4 subcriteria (common.py `DOMAINS`) — key set/weights
// only; the skill's scripts are the sole authority on scoring semantics.
const DOMAINS_FIXTURE: Array<{ key: string; weight: number; subcriteria: string[] }> = [
  { key: "epistemic_integrity", weight: 15, subcriteria: ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"] },
  { key: "audience_fit", weight: 12, subcriteria: ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"] },
  { key: "mental_model_coherence", weight: 15, subcriteria: ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"] },
  { key: "learning_architecture", weight: 12, subcriteria: ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"] },
  { key: "retention_retrieval", weight: 10, subcriteria: ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"] },
  { key: "transfer_action_judgment", weight: 15, subcriteria: ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"] },
  { key: "motivation_autonomy", weight: 8, subcriteria: ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"] },
  { key: "engagement_momentum", weight: 8, subcriteria: ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"] },
  { key: "whole_book_coherence", weight: 5, subcriteria: ["chapter_necessity_order", "quality_consistency_pacing", "redundancy_cumulative_load", "synthesis_completion_value"] },
];
const GATE_KEYS_FIXTURE = ["technical_completeness", "epistemic_instructional_safety", "ethics_reader_autonomy", "purpose_audience_declaration", "external_accuracy"];

function classificationFor(score: number): string {
  if (score >= 90) return "Reference-standard design, subject to gate and core-domain rules";
  if (score >= 80) return "Strong design with identifiable improvements";
  if (score >= 70) return "Valuable but materially uneven; targeted redesign needed";
  if (score >= 60) return "Substantial redesign needed";
  return "Not ready as a ChapterFlow learning product";
}

/** A well-formed `chapterflow_book_evaluation` v2.0.0 rater result over a
 *  genuine 1-chapter source, satisfying every check in `validate_book_result.py`
 *  `validate_result()`. Every subcriterion rates the same integer (blind raters
 *  require plain ints, never half points) so overall_score/classification are
 *  trivial to compute in lockstep with `calculate_scores`. */
function buildFixtureRaterResult(args: {
  runId: string;
  jobId: string;
  bookId: string;
  sourceHash: string;
  workerDispatchReceiptSha256: string;
  raterRole: "primary" | "verification";
  chapterId: string;
  chapterTitle: string;
  rating: number;
}): Record<string, unknown> {
  const domains: Record<string, unknown> = {};
  let overall = 0;
  for (const domain of DOMAINS_FIXTURE) {
    const subcriteria: Record<string, unknown> = {};
    for (const subcriterion of domain.subcriteria) {
      subcriteria[subcriterion] = {
        rating: args.rating,
        rationale: `Fixture rationale for ${domain.key}.${subcriterion}.`,
        strength_evidence: ["Fixture strength one.", "Fixture strength two."],
        limitation_evidence: ["Fixture limitation one."],
      };
    }
    const domainScore = args.rating; // sum(4 equal ratings)/4 == rating
    const weightedPoints = (domainScore / 4) * domain.weight;
    overall += weightedPoints;
    domains[domain.key] = {
      weight: domain.weight,
      whole_book_pattern: `Fixture whole-book pattern note for ${domain.key}.`,
      subcriteria,
      domain_score: domainScore,
      weighted_points: weightedPoints,
    };
  }
  const gates: Record<string, unknown> = {};
  for (const key of GATE_KEYS_FIXTURE) {
    gates[key] = { status: key === "external_accuracy" ? "not_assessed" : "pass", rationale: `Fixture gate rationale for ${key}.` };
  }
  return {
    schema_version: "2.0.0",
    run_id: args.runId,
    job_id: args.jobId,
    rater_role: args.raterRole,
    worker_dispatch_receipt_sha256: args.workerDispatchReceiptSha256,
    source_hash: args.sourceHash,
    book: {
      book_id: args.bookId,
      chapter_count_expected: 1,
      chapter_count_read_full: 1,
      chapter_count_partial: 0,
      chapter_count_inaccessible: 0,
      all_accessible_chapters_read: true,
    },
    chapter_evidence: [
      { chapter_index: 1, chapter_id: args.chapterId, title: args.chapterTitle, read_status: "full", evidence: ["Fixture read-in-full evidence note."] },
    ],
    gates,
    domains,
    overall_score: overall,
    classification: classificationFor(overall),
    certification_status: "pass",
    analysis: { highest_impact_improvements: ["Fixture improvement one.", "Fixture improvement two.", "Fixture improvement three."] },
    qa: { all_36_subcriteria_present: true, evidence_minimums_pass: true, calculation_check_pass: true, unsupported_outcome_claims_found: false },
  };
}

// ── python3 availability ────────────────────────────────────────────────────

test("assertPython3Available throws a helpful EvaluatorSkillHarnessError for a missing interpreter", () => {
  assert.throws(
    () => assertPython3Available("python3-does-not-exist-on-this-machine"),
    (err: unknown) => err instanceof EvaluatorSkillHarnessError && /not found on PATH/.test(err.message),
  );
});

xenv("assertPython3Available does not throw when python3 is on PATH", "python3 not available on this machine", canRunPython3, () => {
  assertPython3Available();
});

// ── inspect_package.py ───────────────────────────────────────────────────────

xenv(
  "inspectPackage: a genuine E11 blind package reports chapter_count 1 and inventory_complete true",
  "python3 not available on this machine",
  canRunPython3,
  () => {
    const dir = join(TMP, "inspect");
    mkdirSync(dir, { recursive: true });
    const fixture = writeFixturePackage(dir);
    const { process, artifact } = inspectPackage(fixture.path, { tempRoot: join(dir, "tmp") });
    assert.equal(process.exitCode, 0, process.stderr);
    assert.ok(artifact);
    assert.equal(artifact!.inspection.chapter_count, 1);
    assert.equal(artifact!.inspection.inventory_complete, true);
    assert.equal(artifact!.inspection.book_id, fixture.blindBookId);
    assert.equal(artifact!.inspection.chapter_inventory.length, 1);
    assert.equal(artifact!.inspection.chapter_inventory[0].chapter_id, fixture.chapterId);
  },
);

xenv(
  "inspectPackage: an unreachable timeout throws a specific 'killed/timeout' error, not a generic spawn-failure message",
  "python3 not available on this machine",
  canRunPython3,
  () => {
    // Regression: spawnSync sets BOTH result.error (code ETIMEDOUT) and
    // result.signal on a real timeout — an earlier cut of runPython() checked
    // result.error first and always reported the generic "failed to spawn"
    // message, so the timeout-specific diagnosis was unreachable dead code.
    const dir = join(TMP, "inspect-timeout");
    mkdirSync(dir, { recursive: true });
    const fixture = writeFixturePackage(dir);
    assert.throws(
      () => inspectPackage(fixture.path, { tempRoot: join(dir, "tmp"), timeoutMs: 1 }),
      (err: unknown) => err instanceof EvaluatorSkillHarnessError && /killed/i.test(err.message) && /timeout/i.test(err.message),
    );
  },
);

xenv(
  "inspectPackage: source_hash matches an independent sha256 of the bytes the builder returned",
  "python3 not available on this machine",
  canRunPython3,
  () => {
    const dir = join(TMP, "inspect-hash");
    mkdirSync(dir, { recursive: true });
    const built = buildChapterDiagnosticPackage(fixturePackageInput());
    const path = join(dir, "package.json");
    writeFileSync(path, built.bytes);
    const { artifact } = inspectPackage(path, { tempRoot: join(dir, "tmp") });
    assert.equal(artifact!.source_hash, built.sha256);
  },
);

// ── issue_worker_receipts.py + seal_blind_pair_receipt.py ──────────────────

xenv(
  "issueWorkerReceipts + sealBlindPairReceipt: distinct rater results seal into a valid blind-pair receipt",
  "python3 not available on this machine",
  canRunPython3,
  () => {
    const dir = join(TMP, "pair-ok");
    mkdirSync(dir, { recursive: true });
    // deliberately different ratings — a real disagreement, not a clone.
    const { receipts, seal } = buildAndSealPair(dir, "run-pair-ok", { primary: 3, verification: 4 });

    assert.ok(receipts.primaryDispatch);
    assert.ok(receipts.verificationDispatch);
    assert.equal(receipts.primaryDispatch!.role, "primary");
    assert.equal(receipts.verificationDispatch!.role, "verification");
    assert.notEqual(receipts.primaryDispatch!.worker_session_id, receipts.verificationDispatch!.worker_session_id);

    assert.equal(seal.process.exitCode, 0, seal.process.stderr);
    assert.ok(seal.seal);
    assert.notEqual(seal.seal!.workers.primary.judgment_sha256, seal.seal!.workers.verification.judgment_sha256);
    assert.notEqual(seal.seal!.workers.primary.worker_session_id, seal.seal!.workers.verification.worker_session_id);
  },
);

xenv(
  "sealBlindPairReceipt rejects an administrative clone (identical judgment content under two identities)",
  "python3 not available on this machine",
  canRunPython3,
  () => {
    const dir = join(TMP, "pair-clone");
    mkdirSync(dir, { recursive: true });
    const fixture = writeFixturePackage(dir);

    const receipts = issueWorkerReceipts(
      {
        package: fixture.path,
        tempRoot: join(dir, "inspect-tmp"),
        runId: "run-pair-clone",
        bookId: fixture.blindBookId,
        pairId: "pair-clone",
        primaryJobId: "job-primary",
        primaryTaskId: "task-primary",
        primarySessionId: "session-primary",
        verificationJobId: "job-verification",
        verificationTaskId: "task-verification",
        verificationSessionId: "session-verification",
        outputDir: join(dir, "receipts"),
      },
    );
    assert.equal(receipts.process.exitCode, 0, receipts.process.stderr);

    // Same rating content on both sides — only the role/dispatch-linking fields
    // differ, which `judgment_sha256` deliberately excludes. This is exactly
    // the "one worker's judgment copy-pasted under a second identity" attack
    // the seal script's clone check exists to catch.
    const primaryResult = buildFixtureRaterResult({
      runId: "run-pair-clone",
      jobId: "job-primary",
      bookId: fixture.blindBookId,
      sourceHash: receipts.primaryDispatch!.source_hash,
      workerDispatchReceiptSha256: receipts.hashes!.primary_sha256,
      raterRole: "primary",
      chapterId: fixture.chapterId,
      chapterTitle: fixture.title,
      rating: 3,
    });
    const clonedResult = buildFixtureRaterResult({
      runId: "run-pair-clone",
      jobId: "job-verification",
      bookId: fixture.blindBookId,
      sourceHash: receipts.verificationDispatch!.source_hash,
      workerDispatchReceiptSha256: receipts.hashes!.verification_sha256,
      raterRole: "verification",
      chapterId: fixture.chapterId,
      chapterTitle: fixture.title,
      rating: 3, // identical rating content to primary — the clone
    });
    const primaryPath = join(dir, "primary.result.json");
    const clonedPath = join(dir, "verification.result.json");
    writeFileSync(primaryPath, JSON.stringify(primaryResult));
    writeFileSync(clonedPath, JSON.stringify(clonedResult));

    const seal = sealBlindPairReceipt({
      package: fixture.path,
      tempRoot: join(dir, "inspect-tmp"),
      primary: primaryPath,
      verification: clonedPath,
      primaryDispatch: receipts.primaryDispatchPath,
      verificationDispatch: receipts.verificationDispatchPath,
      output: join(dir, "pair.seal.json"),
    });
    assert.notEqual(seal.process.exitCode, 0);
    assert.equal(seal.seal, null);
    assert.match(seal.process.stderr, /clone/i);
  },
);

// ── validate_book_result.py ──────────────────────────────────────────────────

xenv(
  "validateBookResult reports a well-formed 1-chapter full-content record as valid",
  "python3 not available on this machine",
  canRunPython3,
  () => {
    const dir = join(TMP, "validate-ok");
    mkdirSync(dir, { recursive: true });
    // Full-content BLIND validation requires a worker dispatch receipt AND a
    // sealed pair (validate_book_result.py: `not adjudicated and
    // require_full_content`) — reuse the real chain, not a shortcut.
    const { fixture, receipts, primaryPath, sealPath } = buildAndSealPair(dir, "run-validate-ok", { primary: 3, verification: 4 });

    const { process, result: validation } = validateBookResult({
      input: primaryPath,
      sourcePackage: fixture.path,
      workerDispatchReceipt: receipts.primaryDispatchPath,
      blindPairSeal: sealPath,
      expectedRole: "primary",
      requireFullContent: true,
      tempRoot: join(dir, "validate-tmp"),
    });
    assert.ok(validation, process.stderr);
    assert.equal(validation!.valid, true, JSON.stringify(validation!.errors));
    assert.equal(process.exitCode, 0);
  },
);

xenv(
  "validateBookResult rejects a result claiming 2 chapters against a genuinely 1-chapter source package",
  "python3 not available on this machine",
  canRunPython3,
  () => {
    const dir = join(TMP, "validate-2ch");
    mkdirSync(dir, { recursive: true });
    const fixture = writeFixturePackage(dir);
    const { artifact } = inspectPackage(fixture.path, { tempRoot: join(dir, "inspect-tmp") });
    const result = buildFixtureRaterResult({
      runId: "run-validate-2ch",
      jobId: "job-primary",
      bookId: fixture.blindBookId,
      sourceHash: artifact!.source_hash,
      workerDispatchReceiptSha256: "0".repeat(64),
      raterRole: "primary",
      chapterId: fixture.chapterId,
      chapterTitle: fixture.title,
      rating: 3,
    }) as { book: Record<string, unknown>; chapter_evidence: unknown[] };
    result.book.chapter_count_expected = 2;
    result.book.chapter_count_read_full = 2;
    result.chapter_evidence.push({
      chapter_index: 2,
      chapter_id: "fabricated-ch02",
      title: "Fabricated Second Chapter",
      read_status: "full",
      evidence: ["Fabricated evidence — this chapter does not exist in the source package."],
    });
    const inputPath = join(dir, "result.json");
    writeFileSync(inputPath, JSON.stringify(result));

    const { process, result: validation } = validateBookResult({
      input: inputPath,
      sourcePackage: fixture.path,
      requireFullContent: true,
      tempRoot: join(dir, "validate-tmp"),
    });
    assert.ok(validation);
    assert.equal(validation!.valid, false);
    assert.ok(validation!.error_count > 0);
    assert.ok(
      validation!.errors.some((e) => /chapter_count_expected does not match source inventory/.test(e)),
      JSON.stringify(validation!.errors),
    );
    assert.equal(process.exitCode, 1);
  },
);
