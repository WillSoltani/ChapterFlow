/**
 * WP-E13 — the standalone chapter-diagnostic RUNNER. Every rater/adjudicator turn
 * is an INJECTED session double (never a real spawn); the receipt chain is either
 * an injected fake harness (hermetic unit path) or the REAL WP-E12 skill scripts
 * (xenv-gated on python3 — offline/deterministic, proves the skill's own receipt
 * validators accept the runner's records). Covers: full adjudicated run validates;
 * retry-once → cap → instrument-fail with attempts preserved; blind identity
 * distinctness; unblinding absent from every rater-visible artifact.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test, xenv } from "./harness.js";
import { assertPython3Available } from "../src/evaluation/evaluatorSkillHarness.js";
import {
  DEFAULT_DIAGNOSTIC_HARNESS,
  runChapterDiagnostic,
  validateChapterAdjudicationRecord,
  validateChapterRatingRecord,
  type ChapterDiagnosticRunInput,
  type DiagnosticHarness,
  type UltraSessionRunner,
} from "../src/evaluation/chapterDiagnosticRun.js";
import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";
import type { UltraSessionRequestV1, UltraSessionResultV1 } from "../src/exec/ultraSession.js";

const TMP = mkdtempSync(join(tmpdir(), "chapter-diagnostic-run-"));
let seq = 0;
function freshStateRoot(): string {
  seq += 1;
  return join(TMP, `state-${seq}`);
}

function canRunPython3(): boolean {
  try { assertPython3Available(); return true; } catch { return false; }
}

// ── Domains table (mirrors chapterDiagnosticRun's DOMAINS; the known-answer side) ─
const DOMAINS: Array<{ key: string; weight: number; subcriteria: [string, string, string, string] }> = [
  { key: "epistemic_integrity", weight: 15, subcriteria: ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"] },
  { key: "audience_fit", weight: 12, subcriteria: ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"] },
  { key: "mental_model_coherence", weight: 15, subcriteria: ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"] },
  { key: "learning_architecture", weight: 12, subcriteria: ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"] },
  { key: "retention_retrieval", weight: 10, subcriteria: ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"] },
  { key: "transfer_action_judgment", weight: 15, subcriteria: ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"] },
  { key: "motivation_autonomy", weight: 8, subcriteria: ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"] },
  { key: "engagement_momentum", weight: 8, subcriteria: ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"] },
];
const WEIGHT_TOTAL = 95;

type Matrix = [number, number, number, number][]; // 8 rows × 4

function domainScore(row: number[]): number { return (row[0] + row[1] + row[2] + row[3]) / 4; }
function diagnosticScore(matrix: Matrix): number {
  let total = 0;
  DOMAINS.forEach((d, i) => { total += (domainScore(matrix[i]) / 4) * d.weight; });
  return (total / WEIGHT_TOTAL) * 100;
}

function buildDomains(matrix: Matrix, halfOk: boolean): Record<string, unknown> {
  const domains: Record<string, unknown> = {};
  DOMAINS.forEach((d, i) => {
    const row = matrix[i];
    const subs: Record<string, unknown> = {};
    d.subcriteria.forEach((sub, j) => {
      subs[sub] = { rating: row[j], rationale: `Fixture ${halfOk ? "adjudicated " : ""}rationale for ${d.key}.${sub}.`, evidence: [{ locator: "/hook", paraphrase: "Fixture evidence paraphrase." }] };
    });
    const ds = domainScore(row);
    domains[d.key] = {
      weight: d.weight,
      subcriteria: subs,
      domain_score: ds,
      weighted_points: (ds / 4) * d.weight,
      strengths: ["Fixture strength one.", "Fixture strength two."],
      limitations: ["Fixture limitation one."],
      pattern: `Fixture within-chapter pattern for ${d.key}.`,
      anchor_linked_rationale: `Fixture anchor-linked rationale for ${d.key}.`,
      scope_note: `Fixture scope note for ${d.key}.`,
    };
  });
  return domains;
}

const NARRATIVE = {
  diagnostic_band: "Chapter diagnostic: strong design with identifiable improvements",
  strongest_qualities: ["Fixture strongest one.", "Fixture strongest two."],
  weakest_qualities: ["Fixture weakest one."],
  engagement_curve: { opening: "High.", middle: "Mostly high.", practice_and_close: "High." },
  comprehension_retention_analysis: "Fixture comprehension/retention analysis paragraph.",
  practical_use_judgment_analysis: "Fixture practical-use/judgment analysis paragraph.",
  best_fit_readers: ["Fixture best-fit reader."],
  struggling_readers: ["Fixture struggling reader."],
  verdict: "Fixture chapter-local verdict. Domain 9 and full-book certification remain unevaluable.",
};
const GATES = {
  chapter_artifact_completeness: { status: "pass", rationale: "Fixture: all sections read." },
  epistemic_instructional_safety: { status: "pass", rationale: "Fixture: safe." },
  ethics_reader_autonomy: { status: "pass", rationale: "Fixture: autonomy protected." },
  purpose_audience_declaration: { status: "pass", rationale: "Fixture: purpose inferable." },
  external_accuracy: { status: "not_assessed", rationale: "Fixture: outside isolated audit." },
  actual_book_completeness: { status: "unevaluable", rationale: "Fixture: one chapter only." },
};
function improvements(): unknown[] {
  return [1, 2, 3].map((order) => ({ order, action: `Fixture improvement ${order}.`, rationale: `Fixture rationale ${order}.`, local_locators: ["/quiz/questions/4/revisit"] }));
}

function mintRatingJudgment(matrix: Matrix): Record<string, unknown> {
  return {
    domains: buildDomains(matrix, false),
    chapter_diagnostic_score: diagnosticScore(matrix),
    ...NARRATIVE,
    improvements: improvements(),
    gates: GATES,
    evaluation_construct: { audience: "Fixture audience.", purpose: "Fixture purpose." },
  };
}

function mintAdjudicationJudgment(pMatrix: Matrix, vMatrix: Matrix, fMatrix: Matrix): Record<string, unknown> {
  const diffs: Record<string, number> = {};
  const disagreements: unknown[] = [];
  DOMAINS.forEach((d, i) => {
    d.subcriteria.forEach((sub, j) => {
      const path = `domains.${d.key}.subcriteria.${sub}`;
      const diff = Math.abs(pMatrix[i][j] - vMatrix[i][j]);
      diffs[path] = diff;
      if (diff !== 0) {
        disagreements.push({ path, primary: pMatrix[i][j], verification: vMatrix[i][j], final: fMatrix[i][j], source_rechecked: true, rationale: "Fixture adjudication rationale.", evidence: [{ locator: "/hook", paraphrase: "Fixture." }] });
      }
    });
  });
  const diffValues = Object.values(diffs);
  return {
    domains: buildDomains(fMatrix, true),
    chapter_diagnostic_score: diagnosticScore(fMatrix),
    ...NARRATIVE,
    improvements: improvements(),
    gates: GATES,
    evaluation_construct: { audience: "Fixture audience.", purpose: "Fixture purpose." },
    calibration_changes: [],
    confidence: { level: "high", rationale: "Fixture high confidence.", supplied_chapter_completeness_ratio: 1.0, actual_book_ambiguity: "material", unresolved_issues: ["Domain 9 unevaluable."] },
    rater_agreement: {
      mean_absolute_subcriterion_difference: diffValues.reduce((a, b) => a + b, 0) / diffValues.length,
      maximum_subcriterion_difference: Math.max(...diffValues),
      chapter_diagnostic_score_difference: Math.abs(diagnosticScore(pMatrix) - diagnosticScore(vMatrix)),
      gate_conflicts: [],
      disagreements,
      input_records: { primary_canonical_sha256: "0".repeat(64), verification_canonical_sha256: "0".repeat(64) },
    },
  };
}

// A clean primary/verification/final rating matrix trio (small disagreements).
const P: Matrix = [[3, 4, 3, 4], [3, 3, 2, 3], [3, 3, 3, 4], [3, 3, 3, 3], [3, 3, 3, 2], [4, 4, 4, 4], [3, 4, 4, 3], [3, 2, 3, 3]];
const V: Matrix = [[3, 4, 3, 4], [3, 3, 3, 3], [3, 3, 3, 4], [3, 4, 3, 3], [4, 3, 3, 3], [4, 3, 4, 4], [3, 3, 4, 4], [3, 3, 3, 3]];
const F: Matrix = P.map((row, i) => row.map((p, j) => (p === V[i][j] ? p : (p + V[i][j]) / 2)) as [number, number, number, number]);

// ── Session double ────────────────────────────────────────────────────────────

type DoubleConfig = {
  pMatrix?: Matrix; vMatrix?: Matrix; fMatrix?: Matrix;
  /** Fail the first N attempts of a role (before eventually succeeding). */
  failFirst?: Partial<Record<"primary" | "verification" | "adjudicator", number>>;
  model?: string;
  /** Override the reply body for a role (to inject an invalid record). */
  replyOverride?: Partial<Record<"primary" | "verification" | "adjudicator", (base: Record<string, unknown>) => Record<string, unknown>>>;
};

function makeSessionDouble(cfg: DoubleConfig = {}): { runner: UltraSessionRunner; calls: UltraSessionRequestV1[] } {
  const calls: UltraSessionRequestV1[] = [];
  const attemptCount = new Map<string, number>();
  const pMatrix = cfg.pMatrix ?? P;
  const vMatrix = cfg.vMatrix ?? V;
  const fMatrix = cfg.fMatrix ?? F;
  const runner: UltraSessionRunner = async (req) => {
    calls.push(req);
    const role = req.role as "primary" | "verification" | "adjudicator";
    const n = (attemptCount.get(role) ?? 0) + 1;
    attemptCount.set(role, n);
    const base: UltraSessionResultV1 = {
      ok: true, model: cfg.model ?? "codex-default", effort: "ultra",
      sessionId: `sess-${role}-${n}`, manifestPath: "", manifestSha256: "0".repeat(64),
      replyPath: null, latencyMs: 1, outcome: "ok",
    };
    const failN = cfg.failFirst?.[role] ?? 0;
    if (n <= failN) {
      return { ...base, ok: false, replyPath: null, outcome: "error", failure: "injected session failure" };
    }
    let judgment: Record<string, unknown>;
    if (role === "adjudicator") judgment = mintAdjudicationJudgment(pMatrix, vMatrix, fMatrix);
    else judgment = mintRatingJudgment(role === "primary" ? pMatrix : vMatrix);
    const override = cfg.replyOverride?.[role];
    if (override) judgment = override(judgment);
    const replyPath = join(req.cwd, "reply.json");
    writeFileSync(replyPath, JSON.stringify(judgment));
    return { ...base, replyPath };
  };
  return { runner, calls };
}

// ── Fake harness (hermetic — no python) ───────────────────────────────────────

function fakeProcess(script: string): { script: string; command: string[]; cwd: string; exitCode: number; signal: null; stdout: string; stderr: string } {
  return { script, command: [script], cwd: "", exitCode: 0, signal: null, stdout: "", stderr: "" };
}

function fakeHarness(): DiagnosticHarness {
  return {
    inspectPackage: (packagePath: string) => ({
      process: fakeProcess("inspect_package.py"),
      artifact: {
        package_path: packagePath,
        source_hash: "a".repeat(64),
        inspection: {
          package_id: "pkg", book_id: "blind", title: "Fixture Chapter", subtitle: null,
          package_format: "chapterflow-v21-authored", schema_version_detected: "chapterflow-v21-authored",
          chapter_count: 1, word_count_estimate: 3000, component_inventory: {},
          chapter_inventory: [{ chapter_index: 1, chapter_id: null, number: 1, title: "Fixture Chapter", word_count_estimate: 3000, fields: [] }],
          inventory_complete: true, inventory_errors: [], warnings: [],
        },
        diagnostics: {},
      },
    }),
    issueWorkerReceipts: (args) => {
      mkdirSync(args.outputDir, { recursive: true });
      const mk = (role: "primary" | "verification", jobId: string, taskId: string, sessionId: string) => ({
        schema_version: "1.0.0" as const, artifact_type: "chapterflow_worker_dispatch_receipt" as const,
        issuer: "chapterflow_evaluation_orchestrator" as const, pair_id: args.pairId, issued_at_utc: "2026-07-17T00:00:00Z",
        run_id: args.runId, book_id: args.bookId, source_hash: "a".repeat(64), inventory_sha256: "b".repeat(64),
        role, job_id: jobId, worker_task_id: taskId, worker_session_id: sessionId, binding_sha256: "c".repeat(64),
      });
      const primaryDispatch = mk("primary", args.primaryJobId, args.primaryTaskId, args.primarySessionId);
      const verificationDispatch = mk("verification", args.verificationJobId, args.verificationTaskId, args.verificationSessionId);
      const primaryDispatchPath = join(args.outputDir, "primary.dispatch.json");
      const verificationDispatchPath = join(args.outputDir, "verification.dispatch.json");
      writeFileSync(primaryDispatchPath, JSON.stringify(primaryDispatch, null, 2));
      writeFileSync(verificationDispatchPath, JSON.stringify(verificationDispatch, null, 2));
      return {
        process: fakeProcess("issue_worker_receipts.py"),
        hashes: { primary_sha256: "d".repeat(64), verification_sha256: "e".repeat(64) },
        primaryDispatch, verificationDispatch, primaryDispatchPath, verificationDispatchPath,
      };
    },
    sealBlindPairReceipt: (args) => {
      const seal = {
        schema_version: "1.0.0" as const, artifact_type: "chapterflow_blind_pair_seal" as const,
        issuer: "chapterflow_evaluation_orchestrator" as const, pair_id: "pair", sealed_at_utc: "2026-07-17T00:00:00Z",
        run_id: "run", book_id: "blind", source_hash: "a".repeat(64), inventory_sha256: "b".repeat(64),
        workers: {
          primary: { job_id: "jp", worker_task_id: "/root/primary", worker_session_id: "sp", dispatch_receipt_sha256: "d".repeat(64), result_canonical_sha256: "1".repeat(64), judgment_sha256: "aa".repeat(32) },
          verification: { job_id: "jv", worker_task_id: "/root/verification", worker_session_id: "sv", dispatch_receipt_sha256: "e".repeat(64), result_canonical_sha256: "2".repeat(64), judgment_sha256: "bb".repeat(32) },
        },
        binding_sha256: "f".repeat(64),
      };
      writeFileSync(args.output, JSON.stringify(seal, null, 2));
      return { process: fakeProcess("seal_blind_pair_receipt.py"), summary: { pair_seal_sha256: "9".repeat(64), output: args.output }, seal };
    },
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function fixtureChapter(): ChapterV21 {
  return {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId: "nudge-ch03",
    number: 3,
    title: "Following the Herd",
    readingTimeMinutes: 8,
    hook: "A short arresting hook line about a group-decision moment worth reading.",
    counterintuition: "The obvious reading of the crowd is usually the wrong one.",
    tryThisNow: "List every reason behind your next group decision and mark the independent ones.",
    keyTakeaway: "Count independent reasons before you trust a unanimous show of hands.",
    breakdown: {
      fastRead: "Fast read paragraph with enough words to look like real prose content for testing here.",
      deepRead: "Deep read paragraph explaining the two-channel mechanism in a bit more depth for the reader.",
      fullRead: "Full read paragraph going into the mechanism, its limits, and a second worked case for depth.",
    },
    examples: [
      { exampleId: "ex01", title: "Example One", tags: ["case"], planSpec: { domain: "d", audience: "a", stakes: "s", format: "f", requiredBeat: "b" }, scenario: "Scenario text describing a concrete situation for testing with enough detail here.", whatToDo: "What-to-do guidance sentence for the reader to act on in this scenario right now.", whyItMatters: "Why-it-matters sentence explaining the stakes of the scenario for the reader clearly." },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [
        { questionId: "q01", prompt: "Which answer is correct for this test question about the concept here?", choices: ["Wrong one", "Correct answer", "Wrong two"], correctIndex: 1, explanation: "Explanation describing why the correct choice is correct for this test question here.", bloomsLevel: "understand", depthLevel: "standard" },
      ],
    },
    reviewCards: [{ cardId: "c01", front: "Card front question text about the concept?", back: "Card back answer text explaining the concept for retrieval.", difficulty: "medium" }],
    implementationPlan: {
      title: "Skill Name",
      coreSkill: "Core skill description spanning a couple of sentences for test realism here.",
      ifThenPlans: [{ context: "A triggering situation arises for the reader.", plan: "If the context happens, then take the specified action next." }],
      twentyFourHourChallenge: "Within 24 hours, perform the challenge action once and note the result.",
      weeklyPractice: "For one week, repeat the practice daily and record what changes over time.",
    },
    memorableLines: [{ text: "Count reasons, not hands, before you trust the crowd.", location: "breakdown.deepRead", why: "Rationale." }],
  };
}

function baseInput(overrides: Partial<ChapterDiagnosticRunInput> = {}): ChapterDiagnosticRunInput {
  return {
    label: "A",
    runHash: "e13fixture",
    blockCode: "nudge-ch03",
    slot: "w1",
    runId: "20260717T140020Z",
    chapter: fixtureChapter(),
    book: { title: "Nudge", categories: ["Behavioral Economics"], tags: ["choice-architecture"] },
    stateRoot: freshStateRoot(),
    now: () => new Date("2026-07-17T14:00:20.000Z"),
    harness: fakeHarness(),
    ...overrides,
  };
}

const MODEL_TOKENS = ["gpt-5.6", "sol", "terra", "luna"];
function assertNoModelToken(text: string, where: string): void {
  for (const token of MODEL_TOKENS) {
    assert.ok(!new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text), `${where} leaked model token ${token}`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("full adjudicated run over doubles → judged; adjudicated record validates against the chapter-audit rules", async () => {
  const { runner } = makeSessionDouble();
  const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner }));

  assert.equal(result.diagnostic.terminalState, "judged");
  assert.equal(result.roles.primary.terminalState, "judged");
  assert.equal(result.roles.verification.terminalState, "judged");
  assert.equal(result.roles.adjudicator?.terminalState, "judged");

  // The primary metric equals the ADJUDICATED (final matrix) diagnostic, never a book score.
  assert.ok(result.diagnostic.chapterDiagnostic !== null);
  assert.ok(Math.abs((result.diagnostic.chapterDiagnostic as number) - diagnosticScore(F)) < 1e-9);
  assert.equal(result.diagnostic.confidence, "high");
  assert.equal(result.diagnostic.gatesPass, true);
  assert.equal(result.diagnostic.schemaVersion, "model-bakeoff-candidate-eval-diagnostic-v1");
  assert.ok(result.summaryLine.includes("CHAPTER DIAGNOSTIC — NOT A BOOK SCORE"));

  // The persisted adjudicated record re-validates against the runner's mirror of the
  // skill's chapter-adjudication rules (arithmetic + agreement + scope + confidence).
  const adjudicated = JSON.parse(readFileSync(join(result.runRoot, result.diagnostic.receipts.adjudicated), "utf8"));
  const primary = JSON.parse(readFileSync(join(result.runRoot, "raw/primary/rating.json"), "utf8"));
  const verification = JSON.parse(readFileSync(join(result.runRoot, "raw/verification/rating.json"), "utf8"));
  assert.deepEqual(validateChapterAdjudicationRecord(adjudicated, primary, verification), []);
  assert.deepEqual(validateChapterRatingRecord(primary), []);
  assert.equal(adjudicated.scope.scope_type, "standalone_chapter_audit");
  assert.equal(adjudicated.scope.full_book_score, null);
  assert.equal(adjudicated.scope.full_book_certification, "unevaluable");
  assert.equal(adjudicated.scope.domain_9, "unassessable");
  assert.equal(adjudicated.rater_role, "adjudicated");

  // raterModels recorded from the session results.
  assert.deepEqual(result.diagnostic.raterModels, { primary: "codex-default", verification: "codex-default", adjudicator: "codex-default" });

  // The summary wrapper carries not_a_book_score.
  const wrapper = JSON.parse(readFileSync(join(result.runRoot, "diagnostic.summary.json"), "utf8"));
  assert.equal(wrapper.not_a_book_score, true);
});

test("blind identity distinctness: primary / verification / adjudicator carry distinct job, task, and session ids", async () => {
  const { runner } = makeSessionDouble();
  const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner }));
  const primary = JSON.parse(readFileSync(join(result.runRoot, "raw/primary/rating.json"), "utf8"));
  const verification = JSON.parse(readFileSync(join(result.runRoot, "raw/verification/rating.json"), "utf8"));
  const adjudicated = JSON.parse(readFileSync(join(result.runRoot, result.diagnostic.receipts.adjudicated), "utf8"));

  for (const field of ["job_id", "worker_task_id", "worker_session_id"]) {
    const ids = [primary[field], verification[field], adjudicated[field]];
    assert.equal(new Set(ids).size, 3, `${field} must be distinct across roles, got ${JSON.stringify(ids)}`);
  }
  // The worker task ids never encode a model (blind) — only the role.
  assert.equal(primary.worker_task_id, "/root/primary");
  assert.equal(verification.worker_task_id, "/root/verification");
  assert.equal(adjudicated.worker_task_id, "/root/adjudicator");
});

test("unblinding data is absent from every rater-visible artifact (package, prompts, records)", async () => {
  const { runner } = makeSessionDouble({ model: "codex-default" });
  const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner }));

  // The blind package, every rendered prompt, and every produced record must be free
  // of model-identity tokens (model identity is the only secret — §5.5).
  const visible = [
    join(result.runRoot, "package.json"),
    join(result.runRoot, "primary/attempt-1/prompt.md"),
    join(result.runRoot, "verification/attempt-1/prompt.md"),
    join(result.runRoot, "adjudicator/attempt-1/prompt.md"),
    join(result.runRoot, "raw/primary/rating.json"),
    join(result.runRoot, "raw/verification/rating.json"),
    join(result.runRoot, result.diagnostic.receipts.adjudicated),
  ];
  for (const path of visible) {
    assert.ok(existsSync(path), `${path} should exist`);
    assertNoModelToken(readFileSync(path, "utf8"), path);
  }
  // The blind book id itself carries no model token and the chapterdiag-- prefix.
  assert.ok(result.blindBookId.startsWith("chapterdiag--"));
  assertNoModelToken(result.blindBookId, "blindBookId");
});

test("retry once: a primary attempt-1 failure recovers on attempt-2 and the run still adjudicates", async () => {
  const { runner } = makeSessionDouble({ failFirst: { primary: 1 } });
  const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner }));

  assert.equal(result.roles.primary.terminalState, "judged");
  assert.equal(result.roles.primary.attempts.length, 2);
  assert.equal(result.roles.primary.attempts[0].ok, false);
  assert.equal(result.roles.primary.attempts[1].ok, true);
  assert.equal(result.diagnostic.terminalState, "judged");
  // BOTH attempt dirs are preserved on disk (never deleted).
  assert.ok(existsSync(join(result.runRoot, "primary/attempt-1/prompt.md")));
  assert.ok(existsSync(join(result.runRoot, "primary/attempt-2/record.json")));
});

test("cap → instrument-fail: a role that fails both attempts is terminal, attempts preserved, no book score", async () => {
  const { runner } = makeSessionDouble({ failFirst: { verification: 2 } });
  const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner }));

  assert.equal(result.roles.verification.terminalState, "instrument-fail");
  assert.equal(result.roles.verification.attempts.length, 2);
  assert.ok(result.roles.verification.attempts.every((a) => !a.ok));
  assert.equal(result.roles.adjudicator, null, "no adjudication once a rater caps");
  assert.equal(result.diagnostic.terminalState, "instrument-fail");
  assert.equal(result.diagnostic.chapterDiagnostic, null);
  assert.equal(result.diagnostic.confidence, null);
  assert.equal(result.diagnostic.gatesPass, null);
  assert.ok((result.diagnostic.ineligibleReason ?? "").startsWith("INSTRUMENT_FAIL:"));
  // Both failed attempts stay on disk as evidence.
  assert.ok(existsSync(join(result.runRoot, "verification/attempt-1/prompt.md")));
  assert.ok(existsSync(join(result.runRoot, "verification/attempt-2/prompt.md")));
  // raterModels still record the model that ran (primary judged before the cap).
  assert.equal(result.diagnostic.raterModels.primary, "codex-default");
});

test("adjudicator cap → instrument-fail after both raters judged (attempts preserved)", async () => {
  const { runner } = makeSessionDouble({ failFirst: { adjudicator: 2 } });
  const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner }));

  assert.equal(result.roles.primary.terminalState, "judged");
  assert.equal(result.roles.verification.terminalState, "judged");
  assert.equal(result.roles.adjudicator?.terminalState, "instrument-fail");
  assert.equal(result.roles.adjudicator?.attempts.length, 2);
  assert.equal(result.diagnostic.terminalState, "instrument-fail");
  assert.equal(result.diagnostic.chapterDiagnostic, null);
  assert.ok(existsSync(join(result.runRoot, "adjudicator/attempt-1/prompt.md")));
  assert.ok(existsSync(join(result.runRoot, "adjudicator/attempt-2/prompt.md")));
});

test("an invalid rater record (broken arithmetic) is rejected and drives the retry/cap path", async () => {
  // Corrupt the primary chapter_diagnostic_score so the record fails validation on
  // BOTH attempts → primary caps → instrument-fail.
  const { runner } = makeSessionDouble({
    replyOverride: { primary: (base) => ({ ...base, chapter_diagnostic_score: 999 }) },
  });
  const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner }));
  assert.equal(result.roles.primary.terminalState, "instrument-fail");
  assert.ok((result.roles.primary.attempts[0].failure ?? "").includes("chapter_diagnostic_score arithmetic mismatch"));
  assert.equal(result.diagnostic.terminalState, "instrument-fail");
});

test("a model-identity leak in the authored chapter is refused (masquerade/blinding wall)", async () => {
  const leaky = fixtureChapter();
  leaky.title = "How Sol Decides"; // "sol" whole-word → E11 forbidden-token scan trips at build.
  const { runner } = makeSessionDouble();
  await assert.rejects(
    () => runChapterDiagnostic(baseInput({ sessionRunner: runner, chapter: leaky })),
    /forbidden-token|model-identity/i,
  );
});

// ── xenv: the REAL skill receipt scripts accept the runner's standalone records ─

xenv(
  "real skill harness: issue → seal accepts the runner's blind standalone records; adjudicated binds to the sealed pair",
  "python3 not available on this machine",
  canRunPython3,
  async () => {
    const { runner } = makeSessionDouble();
    // Default harness = the real WP-E12 skill scripts (offline python).
    const result = await runChapterDiagnostic(baseInput({ sessionRunner: runner, harness: DEFAULT_DIAGNOSTIC_HARNESS }));

    assert.equal(result.diagnostic.terminalState, "judged", JSON.stringify(result.roles.primary.attempts));
    // The real seal (worker_receipts.validate_dispatch_receipt + clone check) accepted
    // the two blind standalone rating records — proof the skill's own receipt validator
    // binds them. The adjudicated record binds to that exact real seal + rater hashes.
    const seal = JSON.parse(readFileSync(join(result.runRoot, "pair.seal.json"), "utf8"));
    const adjudicated = JSON.parse(readFileSync(join(result.runRoot, result.diagnostic.receipts.adjudicated), "utf8"));
    const primary = JSON.parse(readFileSync(join(result.runRoot, "raw/primary/rating.json"), "utf8"));
    const verification = JSON.parse(readFileSync(join(result.runRoot, "raw/verification/rating.json"), "utf8"));

    assert.equal(adjudicated.blind_pair_seal_sha256.length, 64);
    assert.equal(adjudicated.rater_agreement.input_records.primary_canonical_sha256, seal.workers.primary.result_canonical_sha256);
    assert.equal(adjudicated.rater_agreement.input_records.verification_canonical_sha256, seal.workers.verification.result_canonical_sha256);
    assert.notEqual(seal.workers.primary.judgment_sha256, seal.workers.verification.judgment_sha256, "distinct blind judgments, not a clone");
    assert.deepEqual(validateChapterAdjudicationRecord(adjudicated, primary, verification), []);
  },
);
